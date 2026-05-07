// ============================================================================
// DeveloperDashboardPage — Role-based home dashboard
//   Manager / Admin → Team Efficiency Command Center
//   Developer       → Productivity Hub (bug flow, PR queue, live tech feed, AI tools)
// ============================================================================
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bug, GitPullRequest, Rocket, AlertTriangle, Activity, Users,
  Clock, ExternalLink, RefreshCw, ChevronRight, Code2,
  BarChart3, Layers, MessageSquare, BookOpen,
  CheckCircle2, Circle, AlertCircle, ArrowUpRight, TrendingUp,
  Zap, Bot, FileText, Terminal,
  Flame, RotateCcw, Target, Award,
  Rss, Star, Crown, Timer, GitMerge,
  Cpu, Radio,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import {
  getSummary, getPRSummaryWithFallback,
  type DashboardSummary, type PRInfo, type PRSummaryResponse,
} from '../services/overviewService'
import {
  getQualitySummary, getBugs, getMyBugs, getOwnerEfficiency,
  type QualitySummaryDto, type QualityWorkItemDto, type OwnerEfficiencyDto,
} from '../services/qualityService'

// ── types ────────────────────────────────────────────────────────────────────
interface HnItem {
  objectID: string
  title: string
  url?: string
  author: string
  points: number
  num_comments: number
  created_at_i: number
}

// ── helpers ───────────────────────────────────────────────────────────────────
function greeting(name: string): string {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name} 🌤️`
  if (h < 17) return `Good afternoon, ${name} ☀️`
  return `Good evening, ${name} 🌙`
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function ageLabel(dateStr?: string): string {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d'
  return `${days}d`
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() / 1000 - ts) / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const PRIORITY_CFG = [
  { p: 1, label: 'P1 · Critical', short: 'P1', bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500',    flame: true  },
  { p: 2, label: 'P2 · High',     short: 'P2', bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400', flame: false },
  { p: 3, label: 'P3 · Medium',   short: 'P3', bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', flame: false },
  { p: 4, label: 'P4 · Low',      short: 'P4', bar: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-300',   flame: false },
]

// ── sub-components ────────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon: Icon, gradient, sub, loading, onClick,
}: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>;
  gradient: string; sub?: string; loading?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-200',
        'bg-white border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5',
        onClick ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      <div className={clsx('absolute inset-0 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity', gradient)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
          {loading ? (
            <div className="h-8 w-14 bg-gray-100 animate-pulse rounded-lg" />
          ) : (
            <p className="text-3xl font-black text-gray-900 leading-none">{value}</p>
          )}
          {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
        </div>
        <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', gradient)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </button>
  )
}

function SectionCard({ title, icon: Icon, iconColor, action, onAction, children, className }: {
  title: string; icon?: React.ComponentType<{ className?: string }>; iconColor?: string;
  action?: string; onAction?: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={clsx('bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={clsx('w-4 h-4', iconColor ?? 'text-gray-400')} />}
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">{title}</h2>
        </div>
        {action && (
          <button onClick={onAction} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
            {action} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Tech Pulse fetch (direct to HN Algolia — no backend needed) ───────────────
async function fetchTechPulse(): Promise<HnItem[]> {
  const topics = ['angular dotnet typescript', 'react AI developer', 'csharp nodejs tooling']
  try {
    const results = await Promise.allSettled(
      topics.map(q =>
        fetch(`https://hn.algolia.com/api/v1/search?tags=story&query=${encodeURIComponent(q)}&hitsPerPage=5&numericFilters=points%3E3`)
          .then(r => r.json() as Promise<{ hits: HnItem[] }>)
      )
    )
    const seen = new Set<string>()
    const items: HnItem[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const hit of r.value?.hits ?? []) {
          if (!seen.has(hit.objectID) && hit.url) {
            seen.add(hit.objectID)
            items.push(hit)
          }
        }
      }
    }
    return items.sort((a, b) => b.points - a.points).slice(0, 9)
  } catch {
    return []
  }
}

// ── AI Productivity shortcuts ─────────────────────────────────────────────────
const AI_TOOLS = [
  { label: 'AI Chat',       sub: 'Ask anything',    icon: Bot,        path: '/ai-chat',           gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',  key: '⇧A' },
  { label: 'AI Query',      sub: 'Natural → SQL',   icon: Terminal,   path: '/ai-query',          gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',    key: '⇧Q' },
  { label: 'Observability', sub: 'KQL & logs',      icon: Activity,   path: '/observability',     gradient: 'bg-gradient-to-br from-teal-500 to-cyan-600',        key: '⇧O' },
  { label: 'Release Notes', sub: 'Auto-generate',   icon: FileText,   path: '/release-notes',     gradient: 'bg-gradient-to-br from-green-500 to-emerald-600',    key: '⇧R' },
  { label: 'DevOps',        sub: 'Pipelines & PRs', icon: GitMerge,   path: '/devops',            gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600',      key: '⇧G' },
  { label: 'Dev Toolkit',   sub: 'Advanced tools',  icon: Cpu,        path: '/developer-toolkit', gradient: 'bg-gradient-to-br from-pink-500 to-rose-600',        key: '⇧D' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function DeveloperDashboardPage() {
  const { user, isManager, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<'mine' | 'team'>('mine')
  const [viewOverride, setViewOverride] = useState<'auto' | 'dev'>('auto')
  const canOverrideView = isManager || isAdmin
  const isDevView = viewOverride === 'dev' ? true : (!isManager && !isAdmin)

  // shared state
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [prData, setPrData] = useState<PRSummaryResponse | null>(null)
  const [qualitySummary, setQualitySummary] = useState<QualitySummaryDto | null>(null)
  const [myBugs, setMyBugs] = useState<QualityWorkItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // manager-only
  const [ownerEfficiency, setOwnerEfficiency] = useState<OwnerEfficiencyDto[]>([])

  // dev-only
  const [techPulse, setTechPulse] = useState<HnItem[]>([])
  const [techLoading, setTechLoading] = useState(false)
  const [reopenedBugs, setReopenedBugs] = useState<QualityWorkItemDto[]>([])

  const displayName = user?.displayName || user?.email?.split('@')[0] || (isManager ? 'Manager' : 'Developer')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, prRes] = await Promise.allSettled([
        getSummary(),
        getPRSummaryWithFallback(undefined, view === 'mine' ? 'mine' : 'all'),
      ])
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value)
      if (prRes.status === 'fulfilled') setPrData(prRes.value)

      // Quality data (shared)
      try {
        const [qsRes, bugsRes, reopenRes] = await Promise.allSettled([
          getQualitySummary(),
          view === 'mine'
            ? getMyBugs(undefined, undefined, 'Active')
            : getBugs({ state: 'Active' }),
          getBugs({ state: 'Active' }),
        ])
        if (qsRes.status === 'fulfilled') setQualitySummary(qsRes.value)
        if (bugsRes.status === 'fulfilled') setMyBugs((bugsRes.value as QualityWorkItemDto[]).slice(0, 12))
        if (reopenRes.status === 'fulfilled') {
          const all = reopenRes.value as QualityWorkItemDto[]
          setReopenedBugs(
            all.filter(b => b.reopenCount > 0)
              .sort((a, b) => b.reopenCount - a.reopenCount)
              .slice(0, 6)
          )
        }
      } catch { /* quality not configured */ }

      // Manager-only: owner efficiency
      if (isManager || isAdmin) {
        getOwnerEfficiency().then(setOwnerEfficiency).catch(() => {})
      }
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [view, isManager, isAdmin])

  useEffect(() => { load() }, [load])

  // Tech Pulse — load once per session
  useEffect(() => {
    if (!isDevView) return
    setTechLoading(true)
    fetchTechPulse().then(setTechPulse).finally(() => setTechLoading(false))
  }, [isDevView])

  // ── Role-view shortcut: Ctrl+Shift+V (Admin/Manager only) ──────────────────
  useEffect(() => {
    if (!canOverrideView) return
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault()
        setViewOverride(v => v === 'dev' ? 'auto' : 'dev')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [canOverrideView])

  // ── derived ────────────────────────────────────────────────────────────────
  const openBugs         = qualitySummary?.activeBugs ?? 0
  const criticalBugs     = qualitySummary?.criticalBugs ?? 0
  const prsAwaitingReview = prData?.waitingApproval ?? prData?.totalActive ?? 0
  const openPRs          = prData?.totalActive ?? summary?.devops?.openPRs ?? 0
  const buildSuccessRate = summary?.devops?.buildSuccessRate ?? null
  const activePipelines  = summary?.devops?.activePipelines ?? 0
  const prsToReview      = (prData?.prs ?? []).filter((p: PRInfo) => p.needsMyReview || p.status === 'active')

  // bug priority breakdown
  const bugsByPriority: Record<number, QualityWorkItemDto[]> = { 1: [], 2: [], 3: [], 4: [] }
  myBugs.forEach(b => {
    const p = b.priority ?? 4
    ;(bugsByPriority[p] ?? bugsByPriority[4]).push(b)
  })
  const maxBugCount = Math.max(...Object.values(bugsByPriority).map(a => a.length), 1)

  // Build feed
  const buildFeed = ((summary?.devops as any)?.todayBuilds?.builds ?? []).slice(0, 5)

  // ── Shared header bar ──────────────────────────────────────────────────────
  const header = (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-black text-gray-900">{greeting(displayName)}</h1>
        <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {todayLabel()}
          {lastRefresh && (
            <span className="ml-2 text-gray-300">
              · refreshed {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isDevView && (
          <div className="flex items-center bg-gray-100 rounded-xl p-1 text-sm">
            {(['mine', 'team'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={clsx('px-3 py-1.5 rounded-lg font-medium transition-all capitalize',
                  view === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >{v === 'mine' ? 'My View' : 'Team View'}</button>
            ))}
          </div>
        )}
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
        {canOverrideView && (
          <button
            onClick={() => setViewOverride(v => v === 'dev' ? 'auto' : 'dev')}
            title="Ctrl+Shift+V — toggle role view"
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all',
              viewOverride === 'dev'
                ? 'bg-violet-100 text-violet-700 border-violet-300 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            )}
          >
            {viewOverride === 'dev'
              ? <><Code2 className="w-3.5 h-3.5" /><span>Dev Preview</span></>
              : <><Crown className="w-3.5 h-3.5" /><span>Mgr View</span></>
            }
          </button>
        )}
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // ── MANAGER / ADMIN VIEW ──────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  if (!isDevView) {
    const topOwners = ownerEfficiency.slice(0, 8)
    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {header}

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Team Members"    value={summary?.team?.totalMembers ?? '—'}
            icon={Users}         gradient="bg-blue-500"    sub="active members"  loading={loading} onClick={() => navigate('/users')} />
          <KpiCard label="Build Success"   value={buildSuccessRate != null ? `${Math.round(buildSuccessRate)}%` : '—'}
            icon={TrendingUp}    gradient="bg-green-500"   sub="last 30 days"    loading={loading} onClick={() => navigate('/devops')} />
          <KpiCard label="Bug Escape Rate" value={qualitySummary?.bugEscapeRate != null ? `${qualitySummary.bugEscapeRate.toFixed(1)}%` : '—'}
            icon={AlertTriangle} gradient="bg-orange-500"  sub="escaping to prod" loading={loading} onClick={() => navigate('/quality')} />
          <KpiCard label="Avg Fix Days"    value={qualitySummary?.avgResolutionDays != null ? `${qualitySummary.avgResolutionDays.toFixed(1)}d` : '—'}
            icon={Timer}         gradient="bg-purple-500"  sub="bug resolution"  loading={loading} onClick={() => navigate('/quality')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2/3 */}
          <div className="lg:col-span-2 space-y-6">

            {/* Developer Efficiency Table */}
            <SectionCard title="Developer Efficiency" icon={Award} iconColor="text-amber-500"
              action="Full Report" onAction={() => navigate('/quality')}
            >
              <div className="overflow-x-auto">
                {loading || ownerEfficiency.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    {loading ? (
                      <div className="space-y-3 px-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="h-10 bg-gray-50 animate-pulse rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <>
                        <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        Connect Azure DevOps to see developer efficiency
                      </>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Developer', 'Assigned', 'Resolved', 'Active', 'Avg Days', 'Score', 'Reopen %'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {topOwners.map((o, i) => (
                        <tr key={o.ownerName} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={clsx(
                                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0',
                                i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-700' : 'bg-gray-300'
                              )}>
                                {i < 3 ? (i + 1) : o.ownerName.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-800 truncate max-w-[120px]">{o.ownerName}</span>
                              {i === 0 && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{o.totalAssigned}</td>
                          <td className="px-4 py-3"><span className="font-semibold text-green-600">{o.resolved}</span></td>
                          <td className="px-4 py-3 text-blue-600 font-semibold">{o.active}</td>
                          <td className="px-4 py-3 text-gray-500">{o.avgResolutionDays?.toFixed(1) ?? '—'}d</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div className={clsx('h-1.5 rounded-full',
                                  o.efficiencyScore >= 80 ? 'bg-green-500' : o.efficiencyScore >= 60 ? 'bg-yellow-400' : 'bg-red-400'
                                )} style={{ width: `${Math.min(o.efficiencyScore, 100)}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-700">{Math.round(o.efficiencyScore)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={clsx('text-xs font-semibold',
                              o.reopenRate > 20 ? 'text-red-600' : o.reopenRate > 10 ? 'text-orange-500' : 'text-green-600'
                            )}>
                              {o.reopenRate?.toFixed(1) ?? 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </SectionCard>

            {/* Bug Priority Distribution */}
            <SectionCard title="Bug Priority Distribution" icon={Bug} iconColor="text-red-500"
              action="Quality Center" onAction={() => navigate('/quality')}
            >
              <div className="p-5 space-y-3">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-gray-50 animate-pulse rounded-lg" />)
                ) : (
                  PRIORITY_CFG.map(({ p, label, bar, badge }) => {
                    const counts = [
                      qualitySummary?.criticalBugs ?? 0,
                      qualitySummary?.highBugs ?? 0,
                      qualitySummary?.mediumBugs ?? 0,
                      qualitySummary?.lowBugs ?? 0,
                    ]
                    const val  = counts[p - 1]
                    const total = qualitySummary?.activeBugs ?? 1
                    const pct  = Math.round((val / Math.max(total, 1)) * 100)
                    return (
                      <div key={p} className="flex items-center gap-3">
                        <span className={clsx('px-2 py-0.5 text-[11px] font-bold rounded flex-shrink-0 w-24', badge)}>
                          {label}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                          <div className={clsx('h-2.5 rounded-full transition-all duration-700', bar)}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-6 text-right">{val}</span>
                        <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                      </div>
                    )
                  })
                )}
                <div className="pt-1 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
                  <span>Total active: <strong className="text-gray-700">{qualitySummary?.activeBugs ?? 0}</strong></span>
                  <span>Reopened: <strong className="text-orange-600">{qualitySummary?.reopenedBugs ?? 0}</strong></span>
                  <span>Resolved: <strong className="text-green-600">{qualitySummary?.resolvedBugs ?? 0}</strong></span>
                </div>
              </div>
            </SectionCard>

          </div>

          {/* Right 1/3 */}
          <div className="space-y-5">
            {/* Team Stats */}
            <SectionCard title="Team Overview" icon={Users} iconColor="text-blue-500">
              <div className="p-4 space-y-2.5">
                {[
                  { label: 'Active Pipelines', value: activePipelines, icon: <Rocket className="w-4 h-4 text-green-500" />, color: 'text-green-700' },
                  { label: 'Open PRs',          value: openPRs,         icon: <GitMerge className="w-4 h-4 text-purple-500" />, color: 'text-purple-700' },
                  { label: 'Active Incidents',  value: (summary?.support as any)?.openIncidents ?? 0, icon: <AlertTriangle className="w-4 h-4 text-orange-500" />, color: 'text-orange-700' },
                  { label: 'Repositories',      value: summary?.devops?.totalRepositories ?? '—', icon: <Layers className="w-4 h-4 text-indigo-500" />, color: 'text-indigo-700' },
                  { label: 'Customers',         value: (summary?.customers as any)?.total ?? '—', icon: <BarChart3 className="w-4 h-4 text-cyan-500" />, color: 'text-cyan-700' },
                  { label: 'Reopened Bugs',     value: qualitySummary?.reopenedBugs ?? 0, icon: <RotateCcw className="w-4 h-4 text-red-400" />, color: 'text-red-600' },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 text-sm text-gray-600">{icon}{label}</div>
                    <span className={clsx('text-sm font-bold', color)}>{loading ? '…' : value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Quick navigation */}
            <SectionCard title="Quick Navigate" icon={Zap} iconColor="text-amber-500">
              <div className="p-3 grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Quality',       path: '/quality',       icon: Bug,            color: 'bg-red-50 text-red-600' },
                  { label: 'Engineering',   path: '/engineering',   icon: Code2,          color: 'bg-blue-50 text-blue-600' },
                  { label: 'Releases',      path: '/releases',      icon: Rocket,         color: 'bg-green-50 text-green-600' },
                  { label: 'Pull Requests', path: '/pull-requests', icon: GitPullRequest, color: 'bg-purple-50 text-purple-600' },
                  { label: 'Jenkins',       path: '/jenkins',       icon: Terminal,       color: 'bg-gray-50 text-gray-700' },
                  { label: 'Customers',     path: '/customers',     icon: Users,          color: 'bg-pink-50 text-pink-600' },
                ].map(({ label, path, icon: Icon, color }) => (
                  <button key={path} onClick={() => navigate(path)}
                    className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── DEVELOPER PRODUCTIVITY HUB ────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {header}

      {/* Admin/Manager Dev Preview mode indicator */}
      {canOverrideView && viewOverride === 'dev' && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700 font-medium">
          <Code2 className="w-4 h-4 flex-shrink-0" />
          <span>Dev Preview — you are viewing the <strong>developer perspective</strong></span>
          <button
            onClick={() => setViewOverride('auto')}
            className="ml-auto text-xs text-violet-500 hover:text-violet-700 underline underline-offset-2"
          >
            Exit preview
          </button>
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Bugs"    value={openBugs}
          icon={Bug}           gradient="bg-red-500"
          sub={criticalBugs > 0 ? `${criticalBugs} critical 🔥` : '0 critical ✓'}
          loading={loading}    onClick={() => navigate('/quality')} />
        <KpiCard label="PRs to Review" value={prsAwaitingReview}
          icon={GitPullRequest} gradient="bg-purple-500"
          sub={openPRs > 0 ? `${openPRs} open total` : 'all clear'}
          loading={loading}    onClick={() => navigate('/pull-requests')} />
        <KpiCard label="Critical Bugs" value={criticalBugs}
          icon={Flame}         gradient="bg-orange-500"
          sub={criticalBugs > 0 ? 'needs immediate fix' : 'clean slate ✓'}
          loading={loading}    onClick={() => navigate('/quality')} />
        <KpiCard label="Build Rate"    value={buildSuccessRate != null ? `${Math.round(buildSuccessRate)}%` : '—'}
          icon={TrendingUp}    gradient="bg-green-500"
          sub={`${activePipelines} pipeline${activePipelines !== 1 ? 's' : ''} active`}
          loading={loading}    onClick={() => navigate('/devops')} />
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left 2/3 ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* ────────────── Bug Priority Flow Chart ────────────────────── */}
          <SectionCard title="Today's Fix Priority" icon={Target} iconColor="text-red-500"
            action="Quality Center" onAction={() => navigate('/quality')}
          >
            <div className="p-5">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : myBugs.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-2" />
                  <p className="font-semibold text-gray-500">No active bugs!</p>
                  <p className="text-xs mt-1">Connect Azure DevOps quality to see your bug queue.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {PRIORITY_CFG.map(({ p, label, bar, badge, dot, flame }) => {
                    const bugs = bugsByPriority[p] ?? []
                    const count = bugs.length
                    if (count === 0) return null
                    const barPct = Math.round((count / maxBugCount) * 100)
                    const oldest = bugs.reduce((acc, b) => {
                      const d = b.ageDays ?? 0
                      return d > acc ? d : acc
                    }, 0)
                    const topBug = bugs[0]
                    return (
                      <button
                        key={p}
                        onClick={() => navigate('/quality')}
                        className="w-full group rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all p-3.5 text-left bg-white hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {flame && <Flame className="w-4 h-4 text-red-500 animate-pulse" />}
                            <span className={clsx('px-2 py-0.5 text-[11px] font-black rounded', badge)}>
                              {label}
                            </span>
                          </div>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={clsx('h-2 rounded-full transition-all duration-700', bar)}
                              style={{ width: `${barPct}%` }} />
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-lg font-black text-gray-900">{count}</span>
                            <span className="text-[10px] text-gray-400 font-mono">oldest {oldest}d</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </div>
                        {topBug && (
                          <p className="text-xs text-gray-500 truncate pl-1">
                            <span className={clsx('inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-0.5', dot)} />
                            Top: {topBug.title}
                          </p>
                        )}
                      </button>
                    )
                  })}
                  <div className="pt-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-50">
                    <span>Fix P1 → P2 → P3 → P4 order · <strong className="text-gray-600">{myBugs.length}</strong> total active</span>
                    <button onClick={() => navigate('/quality')} className="text-blue-500 hover:text-blue-700 flex items-center gap-1">
                      View all <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ────────────── Reopened Issues ──────────────────────────────── */}
          {(reopenedBugs.length > 0 || loading) && (
            <SectionCard title="Reopened Issues" icon={RotateCcw} iconColor="text-orange-500"
              action="View All" onAction={() => navigate('/quality')}
            >
              <div className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-4 bg-gray-100 animate-pulse rounded" />
                      <div className="flex-1 h-4 bg-gray-100 animate-pulse rounded" />
                    </div>
                  ))
                ) : (
                  reopenedBugs.map(bug => {
                    const pCfg = PRIORITY_CFG.find(c => c.p === (bug.priority ?? 4)) ?? PRIORITY_CFG[3]
                    return (
                      <div key={bug.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 group">
                        <span className={clsx('flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded flex-shrink-0', pCfg.badge)}>
                          <RotateCcw className="w-2.5 h-2.5" />
                          {bug.reopenCount}×
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{bug.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                            <span>{pCfg.label}</span>
                            {bug.assignedTo && <><span>·</span><span>{bug.assignedTo}</span></>}
                            <span>·</span><span>{bug.ageDays}d old</span>
                          </div>
                        </div>
                        {bug.devOpsUrl && (
                          <a href={bug.devOpsUrl} target="_blank" rel="noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500" />
                          </a>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </SectionCard>
          )}

          {/* ────────────── PR Review Queue ──────────────────────────────── */}
          <SectionCard title="PR Review Queue" icon={GitPullRequest} iconColor="text-purple-500"
            action="All PRs" onAction={() => navigate('/pull-requests')}
          >
            <div className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 h-4 bg-gray-100 animate-pulse rounded" />
                    <div className="w-16 h-4 bg-gray-100 animate-pulse rounded" />
                  </div>
                ))
              ) : prsToReview.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-green-300 mx-auto mb-2" />
                  <p>No PRs waiting for review</p>
                  {!prData && <p className="text-xs mt-1">Connect Azure DevOps to see PRs</p>}
                </div>
              ) : (
                prsToReview.slice(0, 6).map((pr: PRInfo) => (
                  <div key={pr.pullRequestId} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 group">
                    <div className={clsx(
                      'mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
                      pr.needsMyReview ? 'bg-purple-100' : 'bg-gray-100'
                    )}>
                      <GitPullRequest className={clsx('w-3.5 h-3.5', pr.needsMyReview ? 'text-purple-600' : 'text-gray-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate font-medium">{pr.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                        <span className="font-mono text-gray-500">{pr.repositoryName}</span>
                        <span>·</span><span>{pr.createdBy}</span>
                        <span>·</span><span>{ageLabel(pr.creationDate)}</span>
                        {pr.needsMyReview && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">NEEDS REVIEW</span>
                        )}
                      </div>
                    </div>
                    {pr.webUrl && (
                      <a href={pr.webUrl} target="_blank" rel="noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Open <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* ────────────── Build Pipeline Status ──────────────────────── */}
          {buildFeed.length > 0 && (
            <SectionCard title="Build Pipeline Status" icon={Rocket} iconColor="text-green-500"
              action="Jenkins" onAction={() => navigate('/jenkins')}
            >
              <div className="divide-y divide-gray-50">
                {buildFeed.map((b: any) => {
                  const ok   = b.result === 'succeeded'
                  const fail = b.result === 'failed'
                  return (
                    <div key={b.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                      {ok   ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : fail ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        : <Circle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">{b.definitionName}</p>
                        <p className="text-xs text-gray-400 font-mono">{b.buildNumber}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={clsx('px-2 py-0.5 text-[10px] font-bold rounded uppercase',
                          ok ? 'bg-green-100 text-green-700' : fail ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {b.result ?? b.status ?? 'running'}
                        </span>
                        <span className="text-xs text-gray-400">{ageLabel(b.startTime)}</span>
                        {b.webUrl && (
                          <a href={b.webUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3 h-3 text-gray-300 hover:text-blue-500" />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── Right 1/3 ──────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* ── AI Productivity Hub ───────────────────────────────────────── */}
          <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-4 shadow-lg shadow-indigo-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-white/80" />
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">AI Productivity Hub</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AI_TOOLS.map(({ label, sub, icon: Icon, path, gradient, key }) => (
                <button key={path} onClick={() => navigate(path)}
                  className="group flex flex-col gap-1.5 p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur transition-all text-left hover:scale-105"
                >
                  <div className="flex items-center justify-between">
                    <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', gradient)}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[9px] text-white/40 font-mono">^{key}</span>
                  </div>
                  <span className="text-xs font-bold text-white leading-tight">{label}</span>
                  <span className="text-[10px] text-white/60 leading-tight">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Tech Pulse (live HN feed) ─────────────────────────────────── */}
          <SectionCard title="Tech Pulse" icon={Radio} iconColor="text-blue-500">
            <div className="px-1 py-1">
              {techLoading ? (
                <div className="space-y-1 px-3 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : techPulse.length === 0 ? (
                <div className="px-5 py-6 text-center text-gray-400 text-sm">
                  <Rss className="w-6 h-6 mx-auto mb-2 text-gray-200" />
                  <p>No feed data</p>
                  <p className="text-xs text-gray-300 mt-1">Check internet connectivity</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {techPulse.map(item => (
                    <a
                      key={item.objectID}
                      href={item.url ?? `https://news.ycombinator.com/item?id=${item.objectID}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2.5 px-4 py-3 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                          <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" />{item.points}</span>
                          <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" />{item.num_comments}</span>
                          <span>{timeAgo(item.created_at_i)}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-50 flex items-center justify-between">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Rss className="w-2.5 h-2.5" /> Hacker News · live
              </span>
              <button
                onClick={() => { setTechLoading(true); fetchTechPulse().then(setTechPulse).finally(() => setTechLoading(false)) }}
                className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" /> refresh
              </button>
            </div>
          </SectionCard>

          {/* ── Quick Snapshot ────────────────────────────────────────────── */}
          <SectionCard title="Snapshot" icon={BarChart3} iconColor="text-gray-400">
            <div className="p-4 space-y-2">
              {[
                { label: 'Reopened bugs',  value: qualitySummary?.reopenedBugs ?? 0,
                  icon: <RotateCcw className="w-3.5 h-3.5 text-orange-400" />, color: 'text-orange-600' },
                { label: 'Avg fix days',
                  value: qualitySummary?.avgResolutionDays != null ? `${qualitySummary.avgResolutionDays.toFixed(1)}d` : '—',
                  icon: <Timer className="w-3.5 h-3.5 text-blue-400" />, color: 'text-blue-600' },
                { label: 'Team members',   value: (summary?.team as any)?.totalMembers ?? '—',
                  icon: <Users className="w-3.5 h-3.5 text-indigo-400" />, color: 'text-indigo-600' },
                { label: 'Repositories',   value: summary?.devops?.totalRepositories ?? '—',
                  icon: <Layers className="w-3.5 h-3.5 text-purple-400" />, color: 'text-purple-600' },
                { label: 'Open incidents', value: (summary?.support as any)?.openIncidents ?? 0,
                  icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />, color: 'text-red-600' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500">{icon}{label}</div>
                  <span className={clsx('text-sm font-bold', color)}>{loading ? '…' : value}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── Resources ─────────────────────────────────────────────────── */}
          <SectionCard title="Resources" icon={BookOpen} iconColor="text-amber-500">
            <div className="p-3 space-y-1">
              {[
                { label: 'Knowledge Base',  path: '/knowledge-center', icon: BookOpen,        color: 'text-amber-600 bg-amber-50' },
                { label: 'API Catalog',     path: '/tools',            icon: Code2,           color: 'text-blue-600 bg-blue-50' },
                { label: 'MCP Tools',       path: '/mcp-tools',        icon: Cpu,             color: 'text-violet-600 bg-violet-50' },
                { label: 'Automation Jobs', path: '/automation',       icon: Zap,             color: 'text-green-600 bg-green-50' },
                { label: 'Observability',   path: '/observability',    icon: Activity,        color: 'text-teal-600 bg-teal-50' },
              ].map(({ label, path, icon: Icon, color }) => (
                <button key={path} onClick={() => navigate(path)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={clsx('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{label}</span>
                  <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />
                </button>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  )
}
