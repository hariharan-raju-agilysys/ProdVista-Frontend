import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, Building2, Globe, AlertCircle, Clock, RefreshCw, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { getCustomers, type CustomerDetailDto } from '../services/customerService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const today = () => new Date()
today.toString = () => new Date().toISOString()

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000)
}

function urgencyColor(days: number): string {
  if (days < 0) return 'text-gray-400'
  if (days <= 7) return 'text-red-600 font-bold'
  if (days <= 30) return 'text-amber-600 font-semibold'
  if (days <= 60) return 'text-blue-600'
  return 'text-green-600'
}

function urgencyBadge(days: number): string {
  if (days < 0) return 'bg-gray-100 text-gray-500'
  if (days <= 7) return 'bg-red-100 text-red-700 animate-pulse'
  if (days <= 30) return 'bg-amber-100 text-amber-700'
  if (days <= 60) return 'bg-blue-100 text-blue-700'
  return 'bg-green-100 text-green-700'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type SortField = 'daysUntil' | 'customerName' | 'region' | 'openTickets'
type SortDir = 'asc' | 'desc'
type WindowDays = 30 | 60 | 90 | 180

export default function UpcomingGoLivesPage() {
  const [customers, setCustomers] = useState<CustomerDetailDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const [window, setWindow] = useState<WindowDays>(90)
  const [regionFilter, setRegionFilter] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('daysUntil')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const all = await getCustomers({ status: 'Active' })
      setCustomers(all)
      setLastRefreshed(new Date())
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load customer data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Derive available regions
  const regions = useMemo(() => {
    const set = new Set(customers.map(c => c.region).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [customers])

  // Filter: must have goLiveDate in future, within window
  const filtered = useMemo(() => {
    return customers
      .filter(c => {
        if (!c.goLiveDate) return false
        const days = daysUntil(c.goLiveDate)
        if (days < 0 || days > window) return false
        if (regionFilter !== 'All' && c.region !== regionFilter) return false
        if (search) {
          const q = search.toLowerCase()
          return (
            c.customerName?.toLowerCase().includes(q) ||
            c.tenantId?.toLowerCase().includes(q) ||
            c.propertyId?.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        let va: number | string, vb: number | string
        if (sortField === 'daysUntil') {
          va = daysUntil(a.goLiveDate)
          vb = daysUntil(b.goLiveDate)
        } else if (sortField === 'openTickets') {
          va = a.openTickets ?? 0
          vb = b.openTickets ?? 0
        } else if (sortField === 'customerName') {
          va = a.customerName ?? ''
          vb = b.customerName ?? ''
        } else {
          va = a.region ?? ''
          vb = b.region ?? ''
        }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [customers, window, regionFilter, search, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  // Summary counts
  const within7 = filtered.filter(c => daysUntil(c.goLiveDate) <= 7).length
  const within30 = filtered.filter(c => daysUntil(c.goLiveDate) <= 30).length

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-indigo-600" />
            Upcoming Go Lives
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Customers scheduled to go live in the next {window} days
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Showing', val: filtered.length, color: 'indigo' },
          { label: 'Within 7 days', val: within7, color: 'red' },
          { label: 'Within 30 days', val: within30, color: 'amber' },
          { label: 'Total in window', val: filtered.length, color: 'green' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`text-2xl font-bold text-${color}-600`}>{val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-wrap gap-4 items-center">
        {/* Window */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">Window:</span>
          {([30, 60, 90, 180] as WindowDays[]).map(w => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${window === w ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {w}d
            </button>
          ))}
        </div>

        {/* Region */}
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400" />
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {regions.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1 flex items-center gap-2 min-w-48">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search customer, tenant, property..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('daysUntil')}>
                  Days Until <SortIcon field="daysUntil" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('customerName')}>
                  Customer <SortIcon field="customerName" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tenant ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Property ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('region')}>
                  Region <SortIcon field="region" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Go Live Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('openTickets')}>
                  Open Tickets <SortIcon field="openTickets" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading customer data...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No upcoming go lives in the selected window
                  </td>
                </tr>
              ) : (
                filtered.map(c => {
                  const days = daysUntil(c.goLiveDate)
                  const goLive = new Date(c.goLiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${urgencyBadge(days)}`}>
                          <Clock className="w-3 h-3" />
                          {days === 0 ? 'Today!' : `${days}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                          <div>
                            <div className="font-medium text-gray-900">{c.customerName}</div>
                            {c.customerNameAlias && <div className="text-xs text-gray-400">{c.customerNameAlias}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.tenantId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.propertyId}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-gray-600">
                          <Globe className="w-3.5 h-3.5 text-gray-400" />
                          {c.region || '—'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-medium ${urgencyColor(days)}`}>{goLive}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.status === 'Active' ? 'bg-green-100 text-green-700' :
                          c.status === 'Onboarding' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.openTickets > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {c.openTickets}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">0</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            Showing {filtered.length} customer{filtered.length !== 1 ? 's' : ''} · Data as of {lastRefreshed.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}
