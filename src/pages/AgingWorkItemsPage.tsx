import { useState, useEffect, useMemo } from 'react'
import { Clock, Bug, User, RefreshCw, AlertCircle, ChevronUp, ChevronDown, Search, Filter } from 'lucide-react'
import {
  getConnections,
  getBugs,
  type QualityConnection,
  type QualityWorkItemDto,
} from '../services/qualityService'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type OwnerType = 'All' | 'Dev' | 'BA'
type MinAge = 7 | 14 | 30 | 60
type SortField = 'ageDays' | 'id' | 'devOwner' | 'baOwner' | 'severity' | 'priority'
type SortDir = 'asc' | 'desc'

const SEVERITY_ORDER: Record<string, number> = {
  '1 - Critical': 1, '2 - High': 2, '3 - Medium': 3, '4 - Low': 4,
}

function severityBadge(s?: string) {
  if (!s) return 'bg-gray-100 text-gray-500'
  if (s.includes('1') || s.toLowerCase().includes('critical')) return 'bg-red-100 text-red-700'
  if (s.includes('2') || s.toLowerCase().includes('high')) return 'bg-amber-100 text-amber-700'
  if (s.includes('3') || s.toLowerCase().includes('med')) return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-500'
}

function ageBadge(days: number) {
  if (days >= 60) return 'bg-red-100 text-red-700 font-bold'
  if (days >= 30) return 'bg-amber-100 text-amber-700 font-semibold'
  if (days >= 14) return 'bg-yellow-100 text-yellow-700'
  return 'bg-blue-100 text-blue-700'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgingWorkItemsPage() {
  const [connections, setConnections] = useState<QualityConnection[]>([])
  const [selectedConn, setSelectedConn] = useState<string>('')
  const [items, setItems] = useState<QualityWorkItemDto[]>([])
  const [loading, setLoading] = useState(false)
  const [connLoading, setConnLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const [ownerType, setOwnerType] = useState<OwnerType>('All')
  const [minAge, setMinAge] = useState<MinAge>(14)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('ageDays')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Load connections on mount
  useEffect(() => {
    setConnLoading(true)
    getConnections()
      .then(conns => {
        setConnections(conns)
        if (conns.length > 0) setSelectedConn(conns[0].id)
      })
      .catch(() => setError('Failed to load Azure DevOps connections'))
      .finally(() => setConnLoading(false))
  }, [])

  // Load bugs when connection changes
  const load = async () => {
    if (!selectedConn) return
    setLoading(true)
    setError(null)
    try {
      const bugs = await getBugs({ state: 'Active' }, selectedConn)
      setItems(bugs)
      setLastRefreshed(new Date())
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load work items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedConn) load()
  }, [selectedConn])

  // Filter & sort
  const filtered = useMemo(() => {
    return items
      .filter(item => {
        if (item.ageDays < minAge) return false
        if (ownerType === 'Dev' && !item.devOwner) return false
        if (ownerType === 'BA' && !item.baOwner) return false
        if (search) {
          const q = search.toLowerCase()
          return (
            item.title?.toLowerCase().includes(q) ||
            String(item.id).includes(q) ||
            item.devOwner?.toLowerCase().includes(q) ||
            item.baOwner?.toLowerCase().includes(q) ||
            item.areaPath?.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        let va: number | string, vb: number | string
        if (sortField === 'ageDays') { va = a.ageDays; vb = b.ageDays }
        else if (sortField === 'id') { va = a.id; vb = b.id }
        else if (sortField === 'devOwner') { va = a.devOwner ?? ''; vb = b.devOwner ?? '' }
        else if (sortField === 'baOwner') { va = a.baOwner ?? ''; vb = b.baOwner ?? '' }
        else if (sortField === 'severity') {
          va = SEVERITY_ORDER[a.severity ?? ''] ?? 99
          vb = SEVERITY_ORDER[b.severity ?? ''] ?? 99
        } else {
          va = a.priority ?? 99; vb = b.priority ?? 99
        }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [items, ownerType, minAge, search, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'ageDays' ? 'desc' : 'asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  // Summary
  const aged60Plus = filtered.filter(i => i.ageDays >= 60).length
  const aged30Plus = filtered.filter(i => i.ageDays >= 30).length

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-7 h-7 text-amber-600" />
            Aging Work Items
          </h1>
          <p className="text-sm text-gray-500 mt-1">Active bugs &amp; work items that have been open longer than expected</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading || !selectedConn}
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
          { label: '60+ days old', val: aged60Plus, color: 'red' },
          { label: '30+ days old', val: aged30Plus, color: 'amber' },
          { label: 'Total active', val: items.length, color: 'gray' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`text-2xl font-bold text-${color}-600`}>{val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-wrap gap-4 items-center">
        {/* Connection */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedConn}
            onChange={e => setSelectedConn(e.target.value)}
            disabled={connLoading}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
          >
            {connLoading ? (
              <option>Loading connections...</option>
            ) : connections.length === 0 ? (
              <option value="">No connections configured</option>
            ) : (
              connections.map(c => <option key={c.id} value={c.id}>{c.connectionName} — {c.projectName}</option>)
            )}
          </select>
        </div>

        {/* Owner type */}
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          {(['All', 'Dev', 'BA'] as OwnerType[]).map(t => (
            <button
              key={t}
              onClick={() => setOwnerType(t)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${ownerType === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Min age */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          {([7, 14, 30, 60] as MinAge[]).map(d => (
            <button
              key={d}
              onClick={() => setMinAge(d)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${minAge === d ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {d}d+
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 flex items-center gap-2 min-w-48">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search title, ID, owner, area..."
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
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('id')}>
                  ID <SortIcon field="id" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-80">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('ageDays')}>
                  Age <SortIcon field="ageDays" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('devOwner')}>
                  Dev Owner <SortIcon field="devOwner" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('baOwner')}>
                  BA Owner <SortIcon field="baOwner" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">State</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => handleSort('severity')}>
                  Severity <SortIcon field="severity" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Area</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading work items...
                  </td>
                </tr>
              ) : !selectedConn ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No Azure DevOps connection configured
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <Bug className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No aging work items matching your filters
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <a
                        href={item.devOpsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-indigo-600 hover:underline text-xs"
                      >
                        #{item.id}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 line-clamp-2 text-sm">{item.title}</div>
                      {item.iterationPath && (
                        <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-xs">{item.iterationPath}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${ageBadge(item.ageDays)}`}>
                        <Clock className="w-3 h-3" />
                        {item.ageDays}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {item.devOwner ? (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-blue-400" />
                          {item.devOwner.split(' <')[0]}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {item.baOwner ? (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-purple-400" />
                          {item.baOwner.split(' <')[0]}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{item.state}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityBadge(item.severity)}`}>
                        {item.severity || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-32 truncate" title={item.areaPath}>
                      {item.areaPath?.split('\\').slice(-2).join(' › ') || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''} · Filtered from {items.length} active bugs
            {lastRefreshed && ` · Data as of ${lastRefreshed.toLocaleString()}`}
          </div>
        )}
      </div>
    </div>
  )
}
