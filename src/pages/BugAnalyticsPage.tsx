// ============================================================================
// BugAnalyticsPage — Deep bug analytics with area drill-down, iteration range,
// user analysis, team efficiency, feature child status
// ============================================================================
import { useState, useEffect, useCallback } from 'react'
import {
  Bug, ChevronRight, ChevronDown, Users, BarChart3, Layers, GitBranch,
  AlertTriangle, Clock, ExternalLink, Search, Filter, Calendar,
  X, Loader2,
  Shield, Target,
  FolderTree, Award,
} from 'lucide-react'
import clsx from 'clsx'
import {
  type QualityWorkItemDto, type QualityIteration, type QualityConnection,
  type AreaBugResponse, type IterationRangeResponse, type UserAnalysisResponse,
  type FeatureChildrenResponse, type TeamSummaryResponse, type BugAnalyticsFilter,
  getConnections, getIterations, getBugsByArea, getIterationRangeBugs,
  getUserBugAnalysis, getFeatureChildrenStatus, getTeamSummary,
  getFilterOptions, getSeverityColor, getStateColor, formatDate,
} from '../services/qualityService'

// ── Types ───────────────────────────────────────────────────────────────────
type TabId = 'area' | 'iteration' | 'users' | 'team' | 'features'

interface Tab {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
}

const TABS: Tab[] = [
  { id: 'area', label: 'Area Drill-Down', icon: FolderTree, desc: 'Browse bugs by project area path' },
  { id: 'iteration', label: 'Iteration Range', icon: Calendar, desc: 'Bugs within iteration/date range' },
  { id: 'users', label: 'User Analysis', icon: Users, desc: 'Per-user bug stats & patterns' },
  { id: 'team', label: 'Team Efficiency', icon: Award, desc: 'Team scoreboard & velocity' },
  { id: 'features', label: 'Feature Status', icon: GitBranch, desc: 'Features with open child bugs' },
]

// ── Main Page ───────────────────────────────────────────────────────────────
export default function BugAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('area')
  const [connections, setConnections] = useState<QualityConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string>('')
  const [iterations, setIterations] = useState<QualityIteration[]>([])
  const [areaPaths, setAreaPaths] = useState<string[]>([])
  const [filter, setFilter] = useState<BugAnalyticsFilter>({})
  const [selectedIteration, setSelectedIteration] = useState('')
  const [selectedArea, setSelectedArea] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Load connections on mount
  useEffect(() => {
    getConnections().then(c => {
      setConnections(c)
      if (c.length > 0) setSelectedConnection(c[0].id)
    }).catch(() => {})
  }, [])

  // Load metadata when connection changes
  useEffect(() => {
    if (!selectedConnection) return
    getIterations(selectedConnection).then(setIterations).catch(() => {})
    getFilterOptions(selectedConnection).then(opts => {
      setAreaPaths(opts.areaPaths)
    }).catch(() => {})
  }, [selectedConnection])

  // Update filter when selections change
  useEffect(() => {
    setFilter({
      connectionId: selectedConnection || undefined,
      iterationPath: selectedIteration || undefined,
      areaPath: selectedArea || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
  }, [selectedConnection, selectedIteration, selectedArea, dateFrom, dateTo])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bug className="w-7 h-7 text-red-500" />
            Bug Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Deep drill-down into bugs, team efficiency, and feature health</p>
        </div>
      </div>

      {/* Global Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Connection */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Connection</label>
            <select value={selectedConnection} onChange={e => setSelectedConnection(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-400">
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.connectionName} — {c.projectName}</option>
              ))}
            </select>
          </div>

          {/* Iteration */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Iteration Path</label>
            <select value={selectedIteration} onChange={e => setSelectedIteration(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-400">
              <option value="">All Iterations</option>
              {iterations.map(it => (
                <option key={it.id} value={it.path}>
                  {it.path} {it.state === 'Current' ? '⚡' : it.state === 'Past' ? '' : '🔮'}
                </option>
              ))}
            </select>
          </div>

          {/* Area Path */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Area Path</label>
            <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-400">
              <option value="">All Areas</option>
              {areaPaths.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* Date To */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 shadow-sm overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md shadow-red-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
              )}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'area' && <AreaDrillDown filter={filter} />}
      {activeTab === 'iteration' && <IterationRangeView filter={filter} />}
      {activeTab === 'users' && <UserAnalysisView filter={filter} />}
      {activeTab === 'team' && <TeamEfficiencyView filter={filter} />}
      {activeTab === 'features' && <FeatureStatusView filter={filter} />}
    </div>
  )
}

// ── Shared Components ───────────────────────────────────────────────────────
function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Loader2 className="w-8 h-8 animate-spin mb-3 text-red-400" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Bug className="w-10 h-10 mb-3 opacity-30" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className={clsx('rounded-xl border p-4 bg-gradient-to-br shadow-sm', color)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  )
}

function SeverityBadge({ severity }: { severity?: string }) {
  return severity ? (
    <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', getSeverityColor(severity))}>
      {severity.replace(/^\d+ - /, '')}
    </span>
  ) : null
}

function StateBadge({ state }: { state: string }) {
  return (
    <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', getStateColor(state))}>
      {state}
    </span>
  )
}

// ── Bug Detail Popup ────────────────────────────────────────────────────────
function BugDetailPopup({ bug, onClose }: { bug: QualityWorkItemDto; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-start justify-between rounded-t-2xl">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">#{bug.id}</span>
              <StateBadge state={bug.state} />
              <SeverityBadge severity={bug.severity} />
            </div>
            <h3 className="text-sm font-bold text-gray-900 leading-tight">{bug.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {/* Iteration Path — full breadcrumb */}
          {bug.iterationPath && (
            <div className="bg-indigo-50 border border-indigo-200/60 rounded-lg px-3 py-2">
              <span className="text-[10px] font-semibold text-indigo-400 uppercase block mb-0.5">Iteration Path</span>
              <div className="flex items-center gap-1 flex-wrap">
                {bug.iterationPath.split('\\').map((seg, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className={clsx('text-xs', i === arr.length - 1 ? 'font-bold text-indigo-700' : 'text-indigo-500')}>{seg}</span>
                    {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-indigo-300" />}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Detail label="Assigned To" value={bug.assignedTo} />
            <Detail label="Area Path" value={bug.areaPath} />
            <Detail label="Priority" value={bug.priority?.toString()} />
            <Detail label="Created" value={formatDate(bug.createdDate)} />
            <Detail label="Resolved" value={formatDate(bug.resolvedDate)} />
            <Detail label="Closed" value={formatDate(bug.closedDate)} />
            <Detail label="Age" value={`${bug.ageDays} days`} />
          </div>
          {bug.tags.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase">Tags</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {bug.tags.map(t => (
                  <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </div>
          )}
          <a href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-medium mt-2">
            <ExternalLink className="w-3.5 h-3.5" /> Open in Azure DevOps
          </a>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-[10px] font-semibold text-gray-400 uppercase block">{label}</span>
      <span className="text-gray-700 font-medium">{value || 'N/A'}</span>
    </div>
  )
}

// ── Bug Row (shared) ────────────────────────────────────────────────────────
function BugRow({ bug, onSelect }: { bug: QualityWorkItemDto; onSelect: (b: QualityWorkItemDto) => void }) {
  const iterShort = bug.iterationPath ? bug.iterationPath.split('\\').slice(-1)[0] : '-'
  return (
    <tr className="hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
      onClick={() => onSelect(bug)}>
      <td className="px-3 py-2.5 text-xs font-mono text-gray-400">#{bug.id}</td>
      <td className="px-3 py-2.5">
        <div className="text-xs font-medium text-gray-900 max-w-md truncate">{bug.title}</div>
      </td>
      <td className="px-3 py-2.5"><StateBadge state={bug.state} /></td>
      <td className="px-3 py-2.5"><SeverityBadge severity={bug.severity} /></td>
      <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[120px] truncate">{bug.assignedTo || '-'}</td>
      <td className="px-3 py-2.5 text-xs text-indigo-600 max-w-[160px] truncate" title={bug.iterationPath || ''}>{iterShort}</td>
      <td className="px-3 py-2.5 text-xs text-gray-400">{bug.ageDays}d</td>
      <td className="px-3 py-2.5">
        <a href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="text-blue-500 hover:text-blue-700"><ExternalLink className="w-3.5 h-3.5" /></a>
      </td>
    </tr>
  )
}

// ── Mini Bar Chart (inline CSS) ─────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-20">
      <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1: Area Drill-Down
// ════════════════════════════════════════════════════════════════════════════
function AreaDrillDown({ filter }: { filter: BugAnalyticsFilter }) {
  const [data, setData] = useState<AreaBugResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedArea, setExpandedArea] = useState<string | null>(null)
  const [areaBugs, setAreaBugs] = useState<QualityWorkItemDto[]>([])
  const [loadingBugs, setLoadingBugs] = useState(false)
  const [selectedBug, setSelectedBug] = useState<QualityWorkItemDto | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getBugsByArea(filter)) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const drillInto = async (areaPath: string) => {
    if (expandedArea === areaPath) { setExpandedArea(null); return }
    setExpandedArea(areaPath)
    setLoadingBugs(true)
    try {
      const result = await getIterationRangeBugs({ ...filter, areaPath })
      setAreaBugs(result.bugs)
    } catch { setAreaBugs([]) }
    finally { setLoadingBugs(false) }
  }

  if (loading) return <LoadingSpinner text="Loading area breakdown..." />
  if (!data) return <EmptyState text="No data. Select a connection and iteration." />

  const maxBugs = Math.max(...data.areas.map(a => a.total), 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Bugs" value={data.totalBugs} icon={Bug} color="from-red-50 to-rose-50 border-red-200/60 text-red-800" />
        <StatCard label="Areas" value={data.areas.length} icon={FolderTree} color="from-blue-50 to-indigo-50 border-blue-200/60 text-blue-800" />
        <StatCard label="Critical" value={data.areas.reduce((s, a) => s + a.critical, 0)} icon={AlertTriangle} color="from-orange-50 to-amber-50 border-orange-200/60 text-orange-800" />
        <StatCard label="Avg Age" value={`${Math.round(data.areas.reduce((s, a) => s + a.avgAgeDays, 0) / (data.areas.length || 1))}d`} icon={Clock} color="from-purple-50 to-violet-50 border-purple-200/60 text-purple-800" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-700">Area Paths</span>
          <span className="text-xs text-gray-400 ml-auto">{data.areas.length} areas</span>
        </div>

        {data.areas.map(area => (
          <div key={area.areaPath}>
            <button onClick={() => drillInto(area.areaPath)}
              className={clsx(
                'w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-all border-b border-gray-50',
                expandedArea === area.areaPath && 'bg-red-50/50'
              )}>
              {expandedArea === area.areaPath
                ? <ChevronDown className="w-4 h-4 text-red-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{area.shortName}</div>
                <div className="text-[10px] text-gray-400 truncate">{area.areaPath}</div>
              </div>
              <div className="flex items-center gap-4 text-xs flex-shrink-0">
                <div className="text-right">
                  <span className="font-bold text-gray-900">{area.total}</span>
                  <span className="text-gray-400 ml-1">bugs</span>
                </div>
                <MiniBar value={area.total} max={maxBugs} color="bg-red-400" />
                <div className="w-16 text-right">
                  <span className="text-green-600 font-medium">{area.resolved}</span>
                  <span className="text-gray-300 mx-0.5">/</span>
                  <span className="text-orange-500 font-medium">{area.active}</span>
                </div>
                {area.critical > 0 && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                    {area.critical} crit
                  </span>
                )}
              </div>
            </button>

            {/* Expanded: Bug list */}
            {expandedArea === area.areaPath && (
              <div className="bg-gray-50/80 px-5 py-3 border-b border-gray-200">
                {loadingBugs ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading bugs...
                  </div>
                ) : areaBugs.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">No bugs found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-200">
                          <th className="px-3 py-2 text-left">ID</th>
                          <th className="px-3 py-2 text-left">Title</th>
                          <th className="px-3 py-2 text-left">State</th>
                          <th className="px-3 py-2 text-left">Severity</th>
                          <th className="px-3 py-2 text-left">Assigned</th>
                          <th className="px-3 py-2 text-left">Iteration</th>
                          <th className="px-3 py-2 text-left">Age</th>
                          <th className="px-3 py-2 text-left">Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaBugs.map(bug => (
                          <BugRow key={bug.id} bug={bug} onSelect={setSelectedBug} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedBug && <BugDetailPopup bug={selectedBug} onClose={() => setSelectedBug(null)} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2: Iteration Range View
// ════════════════════════════════════════════════════════════════════════════
function IterationRangeView({ filter }: { filter: BugAnalyticsFilter }) {
  const [data, setData] = useState<IterationRangeResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedBug, setSelectedBug] = useState<QualityWorkItemDto | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getIterationRangeBugs(filter)) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner text="Loading iteration range data..." />
  if (!data) return <EmptyState text="No data" />

  const filteredBugs = searchTerm
    ? data.bugs.filter(b =>
        b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.assignedTo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.id.toString().includes(searchTerm))
    : data.bugs

  const maxDaily = Math.max(...data.dailyTimeline.map(d => Math.max(d.opened, d.resolved, d.closed)), 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Bugs" value={data.totalBugs} icon={Bug} color="from-red-50 to-rose-50 border-red-200/60 text-red-800" />
        <StatCard label="Active" value={data.active} icon={AlertTriangle} color="from-amber-50 to-yellow-50 border-amber-200/60 text-amber-800" />
        <StatCard label="Resolved" value={data.resolved} icon={Target} color="from-green-50 to-emerald-50 border-green-200/60 text-green-800" />
        <StatCard label="Date Range" value={`${new Date(data.dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(data.dateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`} icon={Calendar} color="from-blue-50 to-indigo-50 border-blue-200/60 text-blue-800" />
      </div>

      {/* Daily Timeline Bar Chart */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-700">Daily Bug Activity</span>
          <div className="ml-auto flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Created</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Resolved</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Closed</span>
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-32">
          {data.dailyTimeline.map((day, idx) => {
            const d = new Date(day.date)
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                {/* Bars */}
                <div className="w-full flex flex-col items-center gap-px">
                  <div className="w-full max-w-[14px] bg-red-400 rounded-t-sm transition-all"
                    style={{ height: `${(day.opened / maxDaily) * 100}px` }} />
                  <div className="w-full max-w-[14px] bg-green-400 rounded-sm transition-all"
                    style={{ height: `${(day.resolved / maxDaily) * 100}px` }} />
                </div>
                {/* Date label (every 2nd) */}
                {idx % 2 === 0 && (
                  <span className="text-[8px] text-gray-300 mt-0.5 leading-none">
                    {d.getMonth() + 1}/{d.getDate()}
                  </span>
                )}
                {/* Tooltip */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-10">
                  {d.toLocaleDateString()}: +{day.opened} / ✓{day.resolved}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bug List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Bug className="w-4 h-4 text-red-400" />
          <span className="text-sm font-bold text-gray-700">Bugs ({filteredBugs.length})</span>
          <div className="ml-auto relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filter bugs..."
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:ring-2 focus:ring-red-300" />
          </div>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-200">
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">State</th>
                <th className="px-3 py-2 text-left">Severity</th>
                <th className="px-3 py-2 text-left">Assigned</th>
                <th className="px-3 py-2 text-left">Iteration</th>
                <th className="px-3 py-2 text-left">Age</th>
                <th className="px-3 py-2 text-left">Link</th>
              </tr>
            </thead>
            <tbody>
              {filteredBugs.map(bug => (
                <BugRow key={bug.id} bug={bug} onSelect={setSelectedBug} />
              ))}
            </tbody>
          </table>
          {filteredBugs.length === 0 && <EmptyState text="No bugs match filter" />}
        </div>
      </div>

      {selectedBug && <BugDetailPopup bug={selectedBug} onClose={() => setSelectedBug(null)} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3: User Analysis
// ════════════════════════════════════════════════════════════════════════════
function UserAnalysisView({ filter }: { filter: BugAnalyticsFilter }) {
  const [data, setData] = useState<UserAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [selectedBug, setSelectedBug] = useState<QualityWorkItemDto | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getUserBugAnalysis(filter)) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner text="Loading user analysis..." />
  if (!data) return <EmptyState text="No data" />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Team Members" value={data.totalUsers} icon={Users} color="from-blue-50 to-indigo-50 border-blue-200/60 text-blue-800" />
        <StatCard label="Total Bugs" value={data.totalBugs} icon={Bug} color="from-red-50 to-rose-50 border-red-200/60 text-red-800" />
        <StatCard label="Total Work Items" value={data.totalWorkItems} icon={Layers} color="from-purple-50 to-violet-50 border-purple-200/60 text-purple-800" />
      </div>

      <div className="space-y-2">
        {data.users.map(user => (
          <div key={user.userName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button onClick={() => setExpandedUser(expandedUser === user.userName ? null : user.userName)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user.userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900">{user.userName}</div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                  <span>{user.totalItems} items</span>
                  <span>{user.totalBugs} bugs</span>
                  <span>{user.features} features</span>
                  {user.topAreas.length > 0 && (
                    <span className="text-blue-500">{user.topAreas[0].area}</span>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-center">
                  <div className="text-xs font-bold text-green-600">{user.resolvedBugs}</div>
                  <div className="text-[9px] text-gray-400">Resolved</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-orange-500">{user.activeBugs}</div>
                  <div className="text-[9px] text-gray-400">Active</div>
                </div>
                <div className="text-center">
                  <div className={clsx('text-xs font-bold', user.avgResolutionDays <= 3 ? 'text-green-600' : user.avgResolutionDays <= 7 ? 'text-yellow-600' : 'text-red-600')}>
                    {user.avgResolutionDays}d
                  </div>
                  <div className="text-[9px] text-gray-400">Avg Res</div>
                </div>

                {/* Efficiency gauge */}
                <div className="relative w-11 h-11">
                  <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="22" cy="22" r="18" fill="none"
                      stroke={user.efficiencyScore >= 80 ? '#22c55e' : user.efficiencyScore >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${(user.efficiencyScore / 100) * 113} 113`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-700">
                    {Math.round(user.efficiencyScore)}%
                  </span>
                </div>

                {expandedUser === user.userName
                  ? <ChevronDown className="w-4 h-4 text-gray-300" />
                  : <ChevronRight className="w-4 h-4 text-gray-300" />}
              </div>
            </button>

            {/* Expanded: User's recent bugs */}
            {expandedUser === user.userName && (
              <div className="bg-gray-50/80 px-5 py-3 border-t border-gray-200 space-y-3">
                {/* Top areas */}
                {user.topAreas.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Primary Areas</div>
                    <div className="flex gap-2">
                      {user.topAreas.map(a => (
                        <span key={a.area} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-1 rounded-lg">
                          {a.area} <span className="font-bold">({a.count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent bugs */}
                {user.recentBugs.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Recent Bugs</div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <tbody>
                          {user.recentBugs.map(bug => (
                            <BugRow key={bug.id} bug={bug} onSelect={setSelectedBug} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Stats summary */}
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{user.totalItems}</div>
                    <div className="text-[9px] text-gray-400">Total Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">{user.criticalBugs + user.highBugs}</div>
                    <div className="text-[9px] text-gray-400">Critical/High</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{user.resolutionRate}%</div>
                    <div className="text-[9px] text-gray-400">Resolution Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{user.tasks}</div>
                    <div className="text-[9px] text-gray-400">Tasks</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedBug && <BugDetailPopup bug={selectedBug} onClose={() => setSelectedBug(null)} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 4: Team Efficiency
// ════════════════════════════════════════════════════════════════════════════
function TeamEfficiencyView({ filter }: { filter: BugAnalyticsFilter }) {
  const [data, setData] = useState<TeamSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getTeamSummary(filter)) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner text="Computing team efficiency..." />
  if (!data) return <EmptyState text="No data" />

  const maxResolved = Math.max(...data.userScoreboard.map(u => u.resolved), 1)
  const maxDailyCreated = Math.max(...data.dailyVelocity.map(d => d.created), 1)
  const maxDailyResolved = Math.max(...data.dailyVelocity.map(d => d.resolved), 1)
  const maxDaily = Math.max(maxDailyCreated, maxDailyResolved, 1)

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Bugs" value={data.totalBugs} icon={Bug} color="from-red-50 to-rose-50 border-red-200/60 text-red-800" />
        <StatCard label="Active" value={data.activeBugs} icon={AlertTriangle} color="from-amber-50 to-yellow-50 border-amber-200/60 text-amber-800" />
        <StatCard label="Resolved" value={data.resolvedBugs} icon={Target} color="from-green-50 to-emerald-50 border-green-200/60 text-green-800" />
        <StatCard label="Critical" value={data.criticalBugs} icon={Shield} color="from-orange-50 to-red-50 border-orange-200/60 text-orange-800" />
        <StatCard label="Avg Resolution" value={`${data.avgResolutionDays}d`} icon={Clock} color="from-purple-50 to-violet-50 border-purple-200/60 text-purple-800" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Velocity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-700">Daily Velocity</span>
            <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Created</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Resolved</span>
            </div>
          </div>
          <div className="flex items-end gap-0.5 h-28">
            {data.dailyVelocity.map((day, idx) => {
              const d = new Date(day.date)
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-px group relative">
                  <div className="w-full max-w-[12px] bg-red-400 rounded-t-sm"
                    style={{ height: `${(day.created / maxDaily) * 90}px` }} />
                  <div className="w-full max-w-[12px] bg-green-400 rounded-b-sm"
                    style={{ height: `${(day.resolved / maxDaily) * 90}px` }} />
                  {idx % 3 === 0 && (
                    <span className="text-[7px] text-gray-300 mt-0.5">{d.getMonth() + 1}/{d.getDate()}</span>
                  )}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2 py-1 rounded hidden group-hover:block whitespace-nowrap z-10">
                    {d.toLocaleDateString()}: +{day.created} / ✓{day.resolved}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-bold text-gray-700">Bug Distribution</span>
          </div>
          <div className="space-y-3">
            {/* By Severity */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">By Severity</div>
              <div className="space-y-1.5">
                {Object.entries(data.bySeverity).map(([sev, count]) => (
                  <div key={sev} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-20 truncate">{sev.replace(/^\d+ - /, '')}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={clsx('h-full rounded-full',
                        sev.includes('Critical') ? 'bg-red-500' :
                        sev.includes('High') ? 'bg-orange-400' :
                        sev.includes('Medium') ? 'bg-yellow-400' : 'bg-green-400'
                      )} style={{ width: `${(count / data.totalBugs) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By State */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">By State</div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(data.byState).map(([st, cnt]) => (
                  <span key={st} className={clsx('text-[10px] font-semibold px-2 py-1 rounded-lg', getStateColor(st))}>
                    {st}: {cnt}
                  </span>
                ))}
              </div>
            </div>

            {/* By Area */}
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">By Area</div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(data.byArea).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([area, cnt]) => (
                  <span key={area} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-1 rounded-lg">
                    {area}: <span className="font-bold">{cnt}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Scoreboard */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-gray-700">Team Scoreboard</span>
          <span className="text-xs text-gray-400 ml-auto">Resolved bugs ranking</span>
        </div>
        <div className="divide-y divide-gray-100">
          {data.userScoreboard.map((user, idx) => (
            <div key={user.userName} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
              {/* Rank */}
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                idx === 0 ? 'bg-amber-100 text-amber-700' :
                idx === 1 ? 'bg-gray-200 text-gray-600' :
                idx === 2 ? 'bg-orange-100 text-orange-600' :
                'bg-gray-50 text-gray-400'
              )}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">{user.userName}</div>
                <div className="text-[10px] text-gray-400">Avg {user.avgDays}d resolution</div>
              </div>
              <MiniBar value={user.resolved} max={maxResolved} color="bg-green-400" />
              <span className="text-sm font-bold text-green-600 w-10 text-right">{user.resolved}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 5: Feature Status (with child bug counts)
// ════════════════════════════════════════════════════════════════════════════
function FeatureStatusView({ filter }: { filter: BugAnalyticsFilter }) {
  const [data, setData] = useState<FeatureChildrenResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null)
  const [selectedBug, setSelectedBug] = useState<QualityWorkItemDto | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getFeatureChildrenStatus(filter)) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner text="Checking feature health..." />
  if (!data) return <EmptyState text="No data" />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Features" value={data.totalFeatures} icon={GitBranch} color="from-purple-50 to-violet-50 border-purple-200/60 text-purple-800" />
        <StatCard label="With Open Bugs" value={data.featuresWithOpenBugs} icon={Bug} color="from-orange-50 to-amber-50 border-orange-200/60 text-orange-800" />
        <StatCard label="At Risk" value={data.featuresAtRisk} sub="Closed but has open bugs"
          icon={AlertTriangle} color="from-red-50 to-rose-50 border-red-200/60 text-red-800" />
      </div>

      <div className="space-y-2">
        {data.features.map(feature => (
          <div key={feature.id} className={clsx(
            'bg-white rounded-xl border shadow-sm overflow-hidden',
            feature.hasRisk ? 'border-red-200' : 'border-gray-200'
          )}>
            <button onClick={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors">
              {expandedFeature === feature.id
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">#{feature.id}</span>
                  <span className={clsx(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                    feature.workItemType === 'Epic' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                  )}>
                    {feature.workItemType}
                  </span>
                  <StateBadge state={feature.state} />
                  {feature.hasRisk && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" /> Risk
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-gray-900 mt-0.5 truncate">{feature.title}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{feature.assignedTo || 'Unassigned'} · {feature.areaPath}</div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                <div className="text-center">
                  <div className="font-bold text-orange-500">{feature.openBugCount}</div>
                  <div className="text-[9px] text-gray-400">Open</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">{feature.resolvedBugCount}</div>
                  <div className="text-[9px] text-gray-400">Fixed</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-gray-500">{feature.totalRelatedBugs}</div>
                  <div className="text-[9px] text-gray-400">Total</div>
                </div>
                {feature.criticalOpenBugs > 0 && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                    {feature.criticalOpenBugs} crit
                  </span>
                )}
                <a href={feature.devOpsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  className="text-blue-500 hover:text-blue-700"><ExternalLink className="w-3.5 h-3.5" /></a>
              </div>
            </button>

            {/* Expanded: Open bugs */}
            {expandedFeature === feature.id && feature.openBugs.length > 0 && (
              <div className="bg-gray-50/80 px-5 py-3 border-t border-gray-200">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Open Bugs</div>
                <table className="w-full">
                  <tbody>
                    {feature.openBugs.map(bug => (
                      <BugRow key={bug.id} bug={bug} onSelect={setSelectedBug} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {expandedFeature === feature.id && feature.openBugs.length === 0 && (
              <div className="bg-green-50/50 px-5 py-3 border-t border-green-200 text-xs text-green-600 text-center">
                ✅ No open bugs — clean delivery
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedBug && <BugDetailPopup bug={selectedBug} onClose={() => setSelectedBug(null)} />}
    </div>
  )
}
