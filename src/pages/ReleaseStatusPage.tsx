import { useState, useEffect, useCallback } from 'react'
import {
  GitBranch, RefreshCw, Package, Bug, CheckCircle2, AlertTriangle,
  ChevronRight, ExternalLink, Clock, Layers, Zap, TrendingUp, X
} from 'lucide-react'
import {
  getConnections,
  getReleases,
  getReleaseWorkItems,
  type QualityConnection,
  type QualityReleaseDto,
  type QualityWorkItemDto,
} from '../services/qualityService'
import { getReleaseBranches, type ReleaseBranch } from '../services/releaseBranchService'
import { DataFreshnessBadge } from '../components/DataFreshnessBadge'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ReleaseType = 'HF' | 'Minor' | 'Major'

function classifyRelease(name: string): ReleaseType | null {
  const n = name.toLowerCase()
  if (n.includes('hotfix') || n.includes('hf') || n.match(/\d+\.\d+\.\d+\.\d+/)) return 'HF'
  if (n.match(/\d+\.\d+\.0($|\s)/) || n.includes('minor')) return 'Minor'
  if (n.match(/v?\d+\.0\.0($|\s)/) || n.includes('major')) return 'Major'
  return null
}

function isActiveRelease(state: string) {
  const s = state?.toLowerCase()
  return s === 'active' || s === 'current' || s === 'in progress' || s === 'planned'
}

interface TypeConfig {
  label: string
  short: string
  color: string
  headerColor: string
  badgeColor: string
  icon: React.ReactNode
  branchType: ReleaseBranch['branchType']
}

const TYPE_CONFIG: Record<ReleaseType, TypeConfig> = {
  HF: {
    label: 'Current Hotfix',
    short: 'HF',
    color: 'border-amber-200 bg-amber-50',
    headerColor: 'bg-amber-500',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <Zap className="w-5 h-5 text-white" />,
    branchType: 'Hotfix',
  },
  Minor: {
    label: 'Current Minor Release',
    short: 'Minor',
    color: 'border-blue-200 bg-blue-50',
    headerColor: 'bg-blue-500',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <Package className="w-5 h-5 text-white" />,
    branchType: 'Main',
  },
  Major: {
    label: 'Current Major Release',
    short: 'Major',
    color: 'border-purple-200 bg-purple-50',
    headerColor: 'bg-purple-500',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: <Layers className="w-5 h-5 text-white" />,
    branchType: 'Main',
  },
}

function stateBadge(state: string) {
  const s = state?.toLowerCase()
  if (s === 'active' || s === 'current') return 'bg-green-100 text-green-700'
  if (s === 'closed' || s === 'past') return 'bg-gray-100 text-gray-500'
  if (s === 'planned') return 'bg-blue-100 text-blue-600'
  return 'bg-gray-100 text-gray-600'
}

function workItemStateBadge(state: string) {
  const s = state?.toLowerCase()
  if (s === 'active' || s === 'in progress') return 'bg-yellow-100 text-yellow-700'
  if (s === 'resolved' || s === 'done') return 'bg-green-100 text-green-700'
  if (s === 'closed') return 'bg-gray-100 text-gray-500'
  if (s === 'new' || s === 'proposed') return 'bg-blue-100 text-blue-600'
  return 'bg-gray-100 text-gray-600'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReleasePanel {
  type: ReleaseType
  release: QualityReleaseDto | null
  workItems: QualityWorkItemDto[]
  branch: ReleaseBranch | null
  workItemsLoading: boolean
  expanded: boolean
}

// ---------------------------------------------------------------------------
// WorkItems Drawer
// ---------------------------------------------------------------------------

function WorkItemsDrawer({
  panel, onClose
}: {
  panel: ReleasePanel
  onClose: () => void
}) {
  const cfg = TYPE_CONFIG[panel.type]
  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
      <div className={`${cfg.headerColor} px-5 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {cfg.icon}
          <div>
            <p className="text-white font-semibold">{panel.release?.name || cfg.label}</p>
            <p className="text-white/80 text-xs">{panel.workItems.length} work items</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {panel.workItemsLoading && (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}
        {!panel.workItemsLoading && panel.workItems.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">No work items found</p>
        )}
        {panel.workItems.map(item => (
          <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="flex items-start gap-2">
              {item.workItemType?.toLowerCase() === 'bug' ? (
                <Bug className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${workItemStateBadge(item.state)}`}>{item.state}</span>
                  {item.assignedTo && (
                    <span className="text-xs text-gray-400">{item.assignedTo}</span>
                  )}
                  {item.severity && (
                    <span className="text-xs text-red-500">{item.severity}</span>
                  )}
                  {item.id && (
                    <a
                      href={`https://dev.azure.com/_workitems/edit/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
                    >
                      #{item.id} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Release Card
// ---------------------------------------------------------------------------

function ReleaseCard({
  panel,
  onViewItems,
}: {
  panel: ReleasePanel
  onViewItems: () => void
}) {
  const cfg = TYPE_CONFIG[panel.type]
  const r = panel.release

  return (
    <div className={`rounded-xl border-2 ${cfg.color} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className={`${cfg.headerColor} px-4 py-3 flex items-center gap-2`}>
        {cfg.icon}
        <span className="text-white font-semibold text-sm">{cfg.label}</span>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {!r ? (
          <div className="text-center py-6 text-gray-400 text-sm">No active {cfg.short} release found</div>
        ) : (
          <>
            {/* Release name + state */}
            <div>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-800 text-base leading-tight">{r.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stateBadge(r.state)}`}>
                  {r.state}
                </span>
              </div>
              {r.iterationPath && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {r.iterationPath}
                </p>
              )}
            </div>

            {/* Branch */}
            {panel.branch && (
              <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-gray-100">
                <GitBranch className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Branch</p>
                  <p className="text-sm font-mono text-gray-700 truncate">{panel.branch.branchName}</p>
                  {panel.branch.version && (
                    <p className="text-xs text-gray-400">{panel.branch.version}</p>
                  )}
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  panel.branch.availability === 'Available' ? 'text-green-600 bg-green-50' :
                  panel.branch.availability === 'Unavailable' ? 'text-red-600 bg-red-50' :
                  'text-gray-500 bg-gray-50'
                }`}>
                  {panel.branch.availability === 'Available' ? '✓ Available' :
                   panel.branch.availability === 'Unavailable' ? '✗ Unavailable' : '? Unknown'}
                </span>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                <p className="text-lg font-bold text-gray-800">{r.totalWorkItems}</p>
                <p className="text-xs text-gray-400">Items</p>
              </div>
              <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                <p className="text-lg font-bold text-red-600">{r.activeBugs}</p>
                <p className="text-xs text-gray-400">Active Bugs</p>
              </div>
              <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                <p className="text-lg font-bold text-green-600">{Math.round(r.completionRate)}%</p>
                <p className="text-xs text-gray-400">Complete</p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{r.resolvedBugs} resolved bugs</span>
                <span>{r.totalBugs} total bugs</span>
              </div>
              <div className="h-2 bg-white rounded-full border border-gray-100">
                <div
                  className={`h-2 rounded-full transition-all ${
                    panel.type === 'HF' ? 'bg-amber-400' :
                    panel.type === 'Minor' ? 'bg-blue-400' : 'bg-purple-400'
                  }`}
                  style={{ width: `${Math.min(100, r.completionRate)}%` }}
                />
              </div>
            </div>

            {/* Dates */}
            {(r.startDate || r.endDate) && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {r.startDate && <span>Start: {new Date(r.startDate).toLocaleDateString()}</span>}
                {r.startDate && r.endDate && <span>→</span>}
                {r.endDate && <span>End: {new Date(r.endDate).toLocaleDateString()}</span>}
              </div>
            )}

            {/* Work items preview */}
            <div>
              <button
                onClick={onViewItems}
                className="w-full flex items-center justify-between text-xs font-medium text-gray-600 hover:text-gray-800 py-2 px-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <span className="flex items-center gap-1">
                  <Bug className="w-3.5 h-3.5" />
                  View all work items
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReleaseStatusPage() {
  const [connections, setConnections] = useState<QualityConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string>('')
  const [allReleases, setAllReleases] = useState<QualityReleaseDto[]>([])
  const [panels, setPanels] = useState<ReleasePanel[]>([
    { type: 'HF', release: null, workItems: [], branch: null, workItemsLoading: false, expanded: false },
    { type: 'Minor', release: null, workItems: [], branch: null, workItemsLoading: false, expanded: false },
    { type: 'Major', release: null, workItems: [], branch: null, workItemsLoading: false, expanded: false },
  ])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [drawerPanel, setDrawerPanel] = useState<ReleasePanel | null>(null)

  // Load connections on mount
  useEffect(() => {
    getConnections().then(conns => {
      setConnections(conns)
      if (conns.length > 0) setSelectedConnection(conns[0].id)
    }).catch(() => setError('Failed to load DevOps connections'))
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [releasesData, branchesData] = await Promise.all([
        getReleases(selectedConnection || undefined),
        getReleaseBranches(),
      ])
      setAllReleases(releasesData)

      // Find most-recent active release of each type
      const byType: Record<ReleaseType, QualityReleaseDto | null> = { HF: null, Minor: null, Major: null }
      for (const rel of releasesData) {
        const t = classifyRelease(rel.name)
        if (t && !byType[t] && isActiveRelease(rel.state)) {
          byType[t] = rel
        }
      }
      // Fallback: most recent regardless of state
      for (const rel of releasesData) {
        const t = classifyRelease(rel.name)
        if (t && !byType[t]) byType[t] = rel
      }

      // Match branches
      const matchBranch = (type: ReleaseType, rel: QualityReleaseDto | null): ReleaseBranch | null => {
        if (!rel) return null
        const name = rel.name.toLowerCase()
        return branchesData.find(b => {
          const bn = (b.name + b.branchName + (b.version || '')).toLowerCase()
          return bn.includes(name) || name.includes(b.name?.toLowerCase() || '') || (
            type === 'HF' && b.branchType === 'Hotfix'
          )
        }) ?? (type === 'HF' ? branchesData.find(b => b.branchType === 'Hotfix') ?? null : null)
      }

      const newPanels: ReleasePanel[] = (['HF', 'Minor', 'Major'] as ReleaseType[]).map(t => ({
        type: t,
        release: byType[t],
        workItems: [],
        branch: matchBranch(t, byType[t]),
        workItemsLoading: false,
        expanded: false,
      }))
      setPanels(newPanels)
      setLastRefreshed(new Date())

      // Load work items for each active release
      for (const p of newPanels) {
        if (p.release) {
          setPanels(prev => prev.map(x => x.type === p.type ? { ...x, workItemsLoading: true } : x))
          getReleaseWorkItems(p.release.iterationPath, selectedConnection || undefined)
            .then(items => {
              setPanels(prev => prev.map(x => x.type === p.type ? { ...x, workItems: items, workItemsLoading: false } : x))
            })
            .catch(() => {
              setPanels(prev => prev.map(x => x.type === p.type ? { ...x, workItemsLoading: false } : x))
            })
        }
      }
    } catch {
      setError('Failed to load release data')
    } finally {
      setLoading(false)
    }
  }, [selectedConnection])

  useEffect(() => {
    if (selectedConnection !== undefined) loadData()
  }, [selectedConnection, loadData])

  const handleViewItems = (type: ReleaseType) => {
    const p = panels.find(x => x.type === type) ?? null
    setDrawerPanel(p)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Current Release Status
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Active HF, Minor, and Major releases with branch and work item tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <DataFreshnessBadge lastRefreshed={lastRefreshed} onRefresh={loadData} isRefreshing={loading} />
          {connections.length > 1 && (
            <select
              value={selectedConnection}
              onChange={e => setSelectedConnection(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.connectionName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['HF', 'Minor', 'Major'].map(t => (
              <div key={t} className="rounded-xl border-2 border-gray-100 bg-gray-50 h-72 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {panels.map(p => (
              <ReleaseCard
                key={p.type}
                panel={p}
                onViewItems={() => handleViewItems(p.type)}
              />
            ))}
          </div>
        )}

        {/* All releases summary */}
        {!loading && allReleases.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">All Releases ({allReleases.length})</h2>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Release</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">State</th>
                    <th className="text-right px-4 py-3">Items</th>
                    <th className="text-right px-4 py-3">Bugs</th>
                    <th className="text-right px-4 py-3">Complete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allReleases.map(r => {
                    const t = classifyRelease(r.name) || 'Other'
                    const cfg = t !== 'Other' ? TYPE_CONFIG[t as ReleaseType] : null
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-700">{r.name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg?.badgeColor || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {t}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${stateBadge(r.state)}`}>{r.state}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{r.totalWorkItems}</td>
                        <td className="px-4 py-2.5 text-right text-red-500">{r.activeBugs}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={r.completionRate >= 80 ? 'text-green-600' : r.completionRate >= 50 ? 'text-yellow-600' : 'text-gray-500'}>
                            {Math.round(r.completionRate)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Work items drawer */}
      {drawerPanel && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDrawerPanel(null)} />
          <WorkItemsDrawer
            panel={drawerPanel}
            onClose={() => setDrawerPanel(null)}
          />
        </>
      )}
    </div>
  )
}

// Attach type to TypeConfig for use in card
Object.assign(TYPE_CONFIG.HF, { type: 'HF' })
Object.assign(TYPE_CONFIG.Minor, { type: 'Minor' })
Object.assign(TYPE_CONFIG.Major, { type: 'Major' })
