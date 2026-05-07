// ============================================================================
// DeveloperDashboardPage — Developer-focused home dashboard
// Replaces OverviewPage as the default "/" route
// ============================================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bug, GitPullRequest, Rocket, AlertTriangle, Activity, Users,
  Clock, ExternalLink, RefreshCw, ChevronRight, Code2,
  BarChart3, Layers, MessageSquare, BookOpen,
  CheckCircle2, Circle, AlertCircle, ArrowUpRight, TrendingUp
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import {
  getSummary, getPRSummaryWithFallback,
  type DashboardSummary, type PRInfo, type PRSummaryResponse
} from '../services/overviewService'
import {
  getQualitySummary, getBugs, getMyBugs,
  type QualitySummaryDto, type QualityWorkItemDto
} from '../services/qualityService'

// ── helpers ──────────────────────────────────────────────────────────────────
function greeting(name: string): string {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name}`
  if (h < 17) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })
}

function ageLabel(dateStr?: string): string {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d'
  return `${days}d`
}

const PRIORITY_BADGE: Record<number, string> = {
  1: 'bg-red-100 text-red-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-gray-100 text-gray-600',
}
const PRIORITY_LABEL: Record<number, string> = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' }

const STATE_ICON: Record<string, JSX.Element> = {
  Active: <Circle className="w-3.5 h-3.5 text-blue-500" />,
  Resolved: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
  'In Progress': <AlertCircle className="w-3.5 h-3.5 text-orange-500" />,
}

const QUICK_LINKS = [
  { label: 'Quality Center', icon: Bug, path: '/quality', color: 'text-red-600 bg-red-50' },
  { label: 'Engineering', icon: Code2, path: '/engineering', color: 'text-blue-600 bg-blue-50' },
  { label: 'Releases', icon: Rocket, path: '/releases', color: 'text-green-600 bg-green-50' },
  { label: 'Pull Requests', icon: GitPullRequest, path: '/pull-requests', color: 'text-purple-600 bg-purple-50' },
  { label: 'AI Chat', icon: MessageSquare, path: '/ai-chat', color: 'text-indigo-600 bg-indigo-50' },
  { label: 'Knowledge', icon: BookOpen, path: '/knowledge-center', color: 'text-amber-600 bg-amber-50' },
  { label: 'Observability', icon: Activity, path: '/observability', color: 'text-cyan-600 bg-cyan-50' },
  { label: 'Customers', icon: Users, path: '/customers', color: 'text-pink-600 bg-pink-50' },
]

// ── sub-components ───────────────────────────────────────────────────────────
function KpiCard({
  label, value, icon: Icon, color, sub, loading
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
  sub?: string
  loading?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">{label}</p>
        {loading ? (
          <div className="h-7 w-12 bg-gray-100 animate-pulse rounded" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
          {action} <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function DeveloperDashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<'mine' | 'team'>('mine')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [prData, setPrData] = useState<PRSummaryResponse | null>(null)
  const [qualitySummary, setQualitySummary] = useState<QualitySummaryDto | null>(null)
  const [myBugs, setMyBugs] = useState<QualityWorkItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Developer'

  const load = async () => {
    setLoading(true)
    try {
      const [sum, prs] = await Promise.allSettled([
        getSummary(),
        getPRSummaryWithFallback(undefined, view === 'mine' ? 'mine' : 'all'),
      ])
      if (sum.status === 'fulfilled') setSummary(sum.value)
      if (prs.status === 'fulfilled') setPrData(prs.value)

      // Load quality data — ignore errors if not configured
      try {
        const [qs, bugs] = await Promise.allSettled([
          getQualitySummary(),
          view === 'mine' ? getMyBugs(undefined, undefined, 'Active') : getBugs({ state: 'Active' }),
        ])
        if (qs.status === 'fulfilled') setQualitySummary(qs.value)
        if (bugs.status === 'fulfilled') setMyBugs((bugs.value as QualityWorkItemDto[]).slice(0, 8))
      } catch { /* quality not configured */ }

    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }

  useEffect(() => { load() }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  // derived values
  const openBugs = qualitySummary?.activeBugs ?? 0
  const criticalBugs = qualitySummary?.criticalBugs ?? 0
  const prsAwaitingReview = prData?.waitingApproval ?? prData?.totalActive ?? 0
  const openPRs = prData?.totalActive ?? summary?.devops?.openPRs ?? 0

  // Upcoming deployments: from build stats
  const upcomingDeploys = summary?.devops?.todayBuilds?.inProgress ?? 0
  const activePipelines = summary?.devops?.activePipelines ?? 0

  // PRs that need my review
  const prsToReview: PRInfo[] = (prData?.prs ?? []).filter(p => p.needsMyReview || p.status === 'active')

  // Team activity feed from recent PR/build events
  const teamActivity = [
    ...(summary?.devops?.recentActivity?.recentPRs ?? []).slice(0, 3).map(pr => ({
      id: `pr-${pr.pullRequestId}`,
      icon: <GitPullRequest className="w-3.5 h-3.5 text-purple-500" />,
      text: `${pr.createdBy} opened PR: ${pr.title.slice(0, 50)}${pr.title.length > 50 ? '…' : ''}`,
      time: ageLabel(pr.creationDate),
      url: pr.webUrl,
    })),
    ...(summary?.devops?.todayBuilds?.builds ?? []).slice(0, 2).map(b => ({
      id: `build-${b.id}`,
      icon: b.result === 'succeeded'
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
      text: `Build ${b.buildNumber} ${b.result ?? b.status} — ${b.definitionName}`,
      time: ageLabel(b.startTime),
      url: b.webUrl,
    })),
  ].slice(0, 6)

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">

      {/* ── Greeting bar ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting(displayName)} 👋</h1>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {todayLabel()}
            {lastRefresh && (
              <span className="ml-2 text-gray-300">
                · Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* My View / Team View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 text-sm">
            <button
              onClick={() => setView('mine')}
              className={clsx(
                'px-3 py-1.5 rounded-md font-medium transition-all',
                view === 'mine' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              My View
            </button>
            <button
              onClick={() => setView('team')}
              className={clsx(
                'px-3 py-1.5 rounded-md font-medium transition-all',
                view === 'team' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Team View
            </button>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Bugs"
          value={openBugs}
          icon={Bug}
          color="bg-red-50 text-red-600"
          sub={criticalBugs > 0 ? `${criticalBugs} critical` : 'No critical'}
          loading={loading}
        />
        <KpiCard
          label="PRs Awaiting Review"
          value={prsAwaitingReview}
          icon={GitPullRequest}
          color="bg-blue-50 text-blue-600"
          sub={openPRs > 0 ? `${openPRs} open total` : undefined}
          loading={loading}
        />
        <KpiCard
          label="Active Pipelines"
          value={activePipelines}
          icon={Rocket}
          color="bg-green-50 text-green-600"
          sub={upcomingDeploys > 0 ? `${upcomingDeploys} in progress` : 'None running'}
          loading={loading}
        />
        <KpiCard
          label="Critical Issues"
          value={criticalBugs}
          icon={AlertTriangle}
          color="bg-orange-50 text-orange-600"
          sub={openBugs > 0 ? `${openBugs} bugs open` : 'All clear'}
          loading={loading}
        />
      </div>

      {/* ── Main Content Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2/3 column */}
        <div className="lg:col-span-2 space-y-6">

          {/* My Active Bugs */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <SectionHeader
                title={view === 'mine' ? 'My Active Bugs' : 'Team Active Bugs'}
                action="View All"
                onAction={() => navigate('/quality')}
              />
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-4 bg-gray-100 animate-pulse rounded" />
                    <div className="flex-1 h-4 bg-gray-100 animate-pulse rounded" />
                    <div className="w-12 h-4 bg-gray-100 animate-pulse rounded" />
                  </div>
                ))
              ) : myBugs.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  No active bugs — great work!
                </div>
              ) : (
                myBugs.map(bug => {
                  const prio = bug.priority ?? 3
                  const progress = bug.efficiencyScore ? Math.min(Math.round(bug.efficiencyScore), 100) : 0
                  return (
                    <div key={bug.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 group">
                      <span className={clsx(
                        'px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0',
                        PRIORITY_BADGE[prio] ?? PRIORITY_BADGE[4]
                      )}>
                        {PRIORITY_LABEL[prio] ?? 'P?'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{bug.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[120px]">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400">{progress}% fixed</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {STATE_ICON[bug.state] ?? <Circle className="w-3.5 h-3.5 text-gray-400" />}
                        <span className="text-xs text-gray-400">{bug.state}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{ageLabel(bug.createdDate)}</span>
                        {bug.devOpsUrl && (
                          <a
                            href={bug.devOpsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500" />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* PRs Needing Review */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <SectionHeader
                title="Open PRs Needing Review"
                action="View All PRs"
                onAction={() => navigate('/pull-requests')}
              />
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 h-4 bg-gray-100 animate-pulse rounded" />
                    <div className="w-16 h-4 bg-gray-100 animate-pulse rounded" />
                  </div>
                ))
              ) : prsToReview.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  No PRs waiting for your review
                </div>
              ) : (
                prsToReview.slice(0, 6).map(pr => (
                  <div key={pr.pullRequestId} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 group">
                    <GitPullRequest className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{pr.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                        <span>{pr.repositoryName}</span>
                        <span>·</span>
                        <span>{pr.createdBy}</span>
                        <span>·</span>
                        <span>{ageLabel(pr.creationDate)}</span>
                      </div>
                    </div>
                    {pr.webUrl && (
                      <a
                        href={pr.webUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Open <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Team Activity Feed */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <SectionHeader
                title="Team Activity Feed"
                action="DevOps"
                onAction={() => navigate('/devops')}
              />
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-4 h-4 bg-gray-100 animate-pulse rounded-full" />
                    <div className="flex-1 h-4 bg-gray-100 animate-pulse rounded" />
                  </div>
                ))
              ) : teamActivity.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-400 text-sm">
                  Connect Azure DevOps to see team activity
                </div>
              ) : (
                teamActivity.map(item => (
                  <div key={item.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50">
                    <span className="mt-0.5 flex-shrink-0">{item.icon}</span>
                    <p className="flex-1 text-sm text-gray-700 leading-snug">{item.text}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{item.time}</span>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3 h-3 text-gray-300 hover:text-blue-500" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1/3 column */}
        <div className="space-y-6">

          {/* Stats Summary card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-4">Team Overview</h2>
            <div className="space-y-3">
              {[
                {
                  label: 'Team Members',
                  value: summary?.team?.totalMembers ?? '—',
                  icon: <Users className="w-4 h-4 text-blue-500" />,
                  color: 'text-blue-700',
                },
                {
                  label: 'Active Incidents',
                  value: summary?.support?.openIncidents ?? 0,
                  icon: <AlertTriangle className="w-4 h-4 text-orange-500" />,
                  color: 'text-orange-700',
                },
                {
                  label: 'Build Success Rate',
                  value: summary?.devops?.buildSuccessRate
                    ? `${Math.round(summary.devops.buildSuccessRate)}%`
                    : '—',
                  icon: <TrendingUp className="w-4 h-4 text-green-500" />,
                  color: 'text-green-700',
                },
                {
                  label: 'Repositories',
                  value: summary?.devops?.totalRepositories ?? '—',
                  icon: <Layers className="w-4 h-4 text-purple-500" />,
                  color: 'text-purple-700',
                },
                {
                  label: 'Customers',
                  value: summary?.customers?.total ?? '—',
                  icon: <BarChart3 className="w-4 h-4 text-cyan-500" />,
                  color: 'text-cyan-700',
                },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    {icon}
                    {label}
                  </div>
                  <span className={clsx('text-sm font-bold', color)}>{loading ? '…' : value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quality snapshot */}
          {(qualitySummary || loading) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-4">Quality Snapshot</h2>
              <div className="space-y-2">
                {[
                  {
                    label: 'Critical', value: qualitySummary?.criticalBugs ?? 0,
                    bar: 'bg-red-400', pct: Math.min(((qualitySummary?.criticalBugs ?? 0) / Math.max(qualitySummary?.totalBugs ?? 1, 1)) * 100, 100),
                  },
                  {
                    label: 'High', value: qualitySummary?.highBugs ?? 0,
                    bar: 'bg-orange-400', pct: Math.min(((qualitySummary?.highBugs ?? 0) / Math.max(qualitySummary?.totalBugs ?? 1, 1)) * 100, 100),
                  },
                  {
                    label: 'Medium', value: qualitySummary?.mediumBugs ?? 0,
                    bar: 'bg-yellow-400', pct: Math.min(((qualitySummary?.mediumBugs ?? 0) / Math.max(qualitySummary?.totalBugs ?? 1, 1)) * 100, 100),
                  },
                  {
                    label: 'Low', value: qualitySummary?.lowBugs ?? 0,
                    bar: 'bg-blue-300', pct: Math.min(((qualitySummary?.lowBugs ?? 0) / Math.max(qualitySummary?.totalBugs ?? 1, 1)) * 100, 100),
                  },
                ].map(({ label, value, bar, pct }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-xs font-semibold text-gray-700">{loading ? '…' : value}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={clsx('h-1.5 rounded-full', bar)} style={{ width: loading ? '0%' : `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/quality')}
                className="mt-4 w-full text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
              >
                Full Quality Report <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-4">Quick Links</h2>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.map(({ label, icon: Icon, path, color }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group text-center"
                >
                  <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-gray-600 group-hover:text-gray-900 font-medium leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Jenkins status if available */}
          {summary?.jenkins?.connected && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-4">Jenkins</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Health Score</span>
                  <span className="font-bold text-green-600">{summary.jenkins.healthScore ?? '—'}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Jobs Failed</span>
                  <span className="font-bold text-red-600">{summary.jenkins.failedJobs ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Nodes Online</span>
                  <span className="font-bold text-blue-600">{summary.jenkins.onlineNodes ?? '—'}/{summary.jenkins.totalNodes ?? '—'}</span>
                </div>
                <button
                  onClick={() => navigate('/jenkins')}
                  className="mt-2 w-full text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
                >
                  Jenkins Pipelines <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
