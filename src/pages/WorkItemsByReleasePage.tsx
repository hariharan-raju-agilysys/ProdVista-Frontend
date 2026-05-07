import { useState, useEffect, useMemo } from 'react'
import { Package, Bug, RefreshCw, AlertCircle, ChevronRight, Filter, Search, BarChart3, Clock, ExternalLink } from 'lucide-react'
import {
  getConnections,
  getReleases,
  getReleaseWorkItems,
  type QualityConnection,
  type QualityReleaseDto,
  type QualityWorkItemDto,
} from '../services/qualityService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ReleaseType = 'HF' | 'Minor' | 'Major' | 'Other'
type ItemFilter = 'All' | 'Bugs'

function classifyRelease(name: string): ReleaseType {
  const n = name.toLowerCase()
  if (n.includes('hotfix') || n.includes('hf') || n.match(/\d+\.\d+\.\d+\.\d+/)) return 'HF'
  if (n.match(/\d+\.\d+\.0/) || n.includes('minor')) return 'Minor'
  if (n.match(/v?\d+\.0\.0/) || n.includes('major')) return 'Major'
  return 'Other'
}

function releaseTypeBadge(t: ReleaseType) {
  switch (t) {
    case 'HF': return 'bg-amber-100 text-amber-700 border border-amber-200'
    case 'Minor': return 'bg-blue-100 text-blue-700 border border-blue-200'
    case 'Major': return 'bg-purple-100 text-purple-700 border border-purple-200'
    default: return 'bg-gray-100 text-gray-600 border border-gray-200'
  }
}

function stateBadge(state: string) {
  const s = state?.toLowerCase()
  if (s === 'active' || s === 'current') return 'bg-green-100 text-green-700'
  if (s === 'closed' || s === 'past') return 'bg-gray-100 text-gray-500'
  return 'bg-blue-100 text-blue-700'
}

function severityBadge(s?: string) {
  if (!s) return 'bg-gray-100 text-gray-500'
  if (s.includes('1') || s.toLowerCase().includes('critical')) return 'bg-red-100 text-red-700'
  if (s.includes('2') || s.toLowerCase().includes('high')) return 'bg-amber-100 text-amber-700'
  if (s.includes('3') || s.toLowerCase().includes('med')) return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-500'
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkItemsByReleasePage() {
  const [connections, setConnections] = useState<QualityConnection[]>([])
  const [selectedConn, setSelectedConn] = useState<string>('')
  const [connLoading, setConnLoading] = useState(true)

  const [releases, setReleases] = useState<QualityReleaseDto[]>([])
  const [releasesLoading, setReleasesLoading] = useState(false)

  const [selectedRelease, setSelectedRelease] = useState<QualityReleaseDto | null>(null)
  const [workItems, setWorkItems] = useState<QualityWorkItemDto[]>([])
  const [wiLoading, setWiLoading] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<Set<ReleaseType>>(new Set(['HF', 'Minor', 'Major', 'Other']))
  const [itemFilter, setItemFilter] = useState<ItemFilter>('All')
  const [search, setSearch] = useState('')

  // Load connections
  useEffect(() => {
    setConnLoading(true)
    getConnections()
      .then(conns => {
        setConnections(conns)
        if (conns.length > 0) setSelectedConn(conns[0].id)
      })
      .catch(() => setError('Failed to load connections'))
      .finally(() => setConnLoading(false))
  }, [])

  // Load releases when connection changes
  useEffect(() => {
    if (!selectedConn) return
    setReleasesLoading(true)
    setSelectedRelease(null)
    setWorkItems([])
    setError(null)
    getReleases(selectedConn)
      .then(r => setReleases(r))
      .catch(() => setError('Failed to load releases'))
      .finally(() => setReleasesLoading(false))
  }, [selectedConn])

  // Load work items when release selected
  const selectRelease = async (release: QualityReleaseDto) => {
    setSelectedRelease(release)
    setWiLoading(true)
    setWorkItems([])
    setError(null)
    try {
      const items = await getReleaseWorkItems(release.iterationPath, selectedConn)
      setWorkItems(items)
      setLastRefreshed(new Date())
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load work items')
    } finally {
      setWiLoading(false)
    }
  }

  // Toggle release type filter
  const toggleType = (t: ReleaseType) => {
    setTypeFilter(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  // Grouped releases by type
  const groupedReleases = useMemo(() => {
    const filtered = releases.filter(r => typeFilter.has(classifyRelease(r.name)))
    const groups: Record<ReleaseType, QualityReleaseDto[]> = { HF: [], Minor: [], Major: [], Other: [] }
    for (const r of filtered) groups[classifyRelease(r.name)].push(r)
    return groups
  }, [releases, typeFilter])

  // Filter work items
  const filteredItems = useMemo(() => {
    return workItems.filter(item => {
      if (itemFilter === 'Bugs' && !['Bug'].includes(item.workItemType)) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          item.title?.toLowerCase().includes(q) ||
          String(item.id).includes(q) ||
          item.assignedTo?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [workItems, itemFilter, search])

  const bugCount = workItems.filter(i => i.workItemType === 'Bug').length
  const hasReleases = (Object.values(groupedReleases) as QualityReleaseDto[][]).some(arr => arr.length > 0)

  return (
    <div className="p-6 max-w-full mx-auto h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-indigo-600" />
            Work Items by Release
          </h1>
          <p className="text-sm text-gray-500 mt-1">Browse work items grouped by release iteration</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection selector */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedConn}
              onChange={e => setSelectedConn(e.target.value)}
              disabled={connLoading}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
            >
              {connLoading ? <option>Loading...</option> :
                connections.length === 0 ? <option value="">No connections</option> :
                  connections.map(c => <option key={c.id} value={c.id}>{c.connectionName} — {c.projectName}</option>)
              }
            </select>
          </div>

          {/* Type toggles */}
          {(['HF', 'Minor', 'Major', 'Other'] as ReleaseType[]).map(t => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${typeFilter.has(t) ? releaseTypeBadge(t) : 'bg-gray-50 text-gray-300 border border-gray-100'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Split pane */}
      <div className="flex gap-4 flex-1 min-h-0 h-[calc(100vh-260px)]">
        {/* Left: Release list */}
        <div className="w-72 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" />
              Releases
              {!releasesLoading && (
                <span className="ml-auto text-xs text-gray-400 font-normal">{releases.length} total</span>
              )}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {releasesLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading releases...
              </div>
            ) : !hasReleases ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No releases found
              </div>
            ) : (
              (['HF', 'Minor', 'Major', 'Other'] as ReleaseType[]).map(type => {
                const group = groupedReleases[type]
                if (group.length === 0 || !typeFilter.has(type)) return null
                return (
                  <div key={type}>
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${releaseTypeBadge(type)}`}>
                        {type === 'HF' ? 'Hotfix' : type}
                      </span>
                      <span className="ml-2 text-[11px] text-gray-400">{group.length}</span>
                    </div>
                    {group.map(r => (
                      <button
                        key={r.id}
                        onClick={() => selectRelease(r)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors hover:bg-indigo-50 ${selectedRelease?.id === r.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 transition-transform ${selectedRelease?.id === r.id ? 'rotate-90 text-indigo-600' : 'text-gray-300'}`} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{r.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stateBadge(r.state)}`}>{r.state}</span>
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <Bug className="w-3 h-3" />{r.totalBugs}
                              </span>
                              <span className="text-[10px] text-gray-400">{r.totalWorkItems} items</span>
                            </div>
                            {r.completionRate > 0 && (
                              <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(r.completionRate, 100)}%` }} />
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right: Work items */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          {!selectedRelease ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a release to view work items</p>
              </div>
            </div>
          ) : (
            <>
              {/* Work items header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    {selectedRelease.name}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${stateBadge(selectedRelease.state)}`}>{selectedRelease.state}</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {filteredItems.length} items · {bugCount} bugs · {selectedRelease.completionRate.toFixed(0)}% complete
                    {lastRefreshed && ` · ${lastRefreshed.toLocaleTimeString()}`}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {/* Item filter */}
                  {(['All', 'Bugs'] as ItemFilter[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setItemFilter(f)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${itemFilter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {f === 'Bugs' ? <span className="flex items-center gap-1"><Bug className="w-3 h-3" />Bugs only</span> : 'All types'}
                    </button>
                  ))}
                  {/* Search */}
                  <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2 py-1">
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="text-xs w-32 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Release stats bar */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs text-gray-600">
                <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5 text-indigo-500" />{selectedRelease.totalWorkItems} total</span>
                <span className="flex items-center gap-1"><Bug className="w-3.5 h-3.5 text-red-500" />{selectedRelease.totalBugs} bugs</span>
                <span className="flex items-center gap-1 text-green-600">✓ {selectedRelease.resolvedBugs} resolved</span>
                <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3.5 h-3.5" />{selectedRelease.activeBugs} active</span>
                {selectedRelease.startDate && (
                  <span className="ml-auto text-gray-400">
                    {new Date(selectedRelease.startDate).toLocaleDateString()} → {selectedRelease.endDate ? new Date(selectedRelease.endDate).toLocaleDateString() : 'TBD'}
                  </span>
                )}
              </div>

              {/* Work items table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">ID</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Type</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs w-96">Title</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">State</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Severity</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Assigned To</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600 text-xs">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {wiLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading work items...
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                          No work items match your filters
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <a
                              href={item.devOpsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-indigo-600 hover:underline flex items-center gap-1"
                            >
                              #{item.id}
                              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                            </a>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${item.workItemType === 'Bug' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>
                              {item.workItemType}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="text-sm text-gray-900 line-clamp-2">{item.title}</div>
                            {item.customer && <div className="text-[11px] text-gray-400 mt-0.5">{item.customer}</div>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${stateBadge(item.state)}`}>{item.state}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${severityBadge(item.severity)}`}>
                              {item.severity || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">
                            {item.assignedTo?.split(' <')[0] || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {item.ageDays > 0 && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${item.ageDays >= 30 ? 'text-amber-700' : 'text-gray-500'}`}>
                                {item.ageDays}d
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
