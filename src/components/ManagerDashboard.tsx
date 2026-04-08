import { useEffect, useState, useCallback } from 'react'
import {
  RefreshCw, X, Wand2,
  Building2, Cloud, HardDrive, Server, Users,
  Headphones, Activity, Search,
  ChevronRight, AlertTriangle,
  Ticket, UserCheck, Heart,
  GitPullRequest, GitCommit, Code2,
  Layers, Clock, Copy, Check,
} from 'lucide-react'
import clsx from 'clsx'
import * as customerService from '../services/customerService'
import { CustomerDetailDto, CustomerSummaryDto, getStatusColor, getPriorityColor } from '../services/customerService'
import {
  getSummary as getInternalSummary,
  getPRSummary, getCommitStats, getKnowledgeShares, getProductionSupport,
  getApiCatalog, getCustomersOverview,
  type DashboardSummary, type PRSummaryResponse, type CommitStatsResponse,
  type KnowledgeShareInfo, type ProductionSupportResponse, type ApiCatalogInfo,
  type CustomersOverviewResponse,
} from '../services/internalDashboardService'
import CustomerDetailPopup from './CustomerDetailPopup'
import WidgetConfigWizard from './widget-wizard/WidgetConfigWizard'
import MagicalQuoteOverlay, { getRandomQuote, fetchAiQuote } from './MagicalQuoteOverlay'
import { useAuth } from '../context/AuthContext'
import { AdvancedPRListModal } from './AdvancedPRListModal'
import { CommitsDetailModal, CommitDetail } from './CommitsDetailModal'

// Product icon/color map
const productConfig: Record<string, { color: string; bg: string; border: string }> = {
  'VisualOne PMS': { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  'Retail POS': { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Golf Management': { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  'Spa & Activities': { color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
  'F&B Management': { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
}

export default function ManagerDashboard() {
  const { isManager: authIsManager } = useAuth()
  const [customers, setCustomers] = useState<CustomerDetailDto[]>([])
  const [summary, setSummary] = useState<CustomerSummaryDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetailDto | null>(null)
  const [activeProductTab, setActiveProductTab] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showWidgetWizard, setShowWidgetWizard] = useState(false)

  // Motivational quote popup — once per session
  const [showQuote, setShowQuote] = useState(() => {
    if (sessionStorage.getItem('prodvista_quote_shown')) return false
    sessionStorage.setItem('prodvista_quote_shown', '1')
    return true
  })
  const [quote, setQuote] = useState<{ text: string; author: string; isAiGenerated?: boolean }>(getRandomQuote)

  // Fetch AI-generated quote on mount (replaces fallback if successful)
  useEffect(() => {
    if (!showQuote) return
    fetchAiQuote().then(setQuote)
  }, [showQuote])

  // Internal dashboard data
  const [intSummary, setIntSummary] = useState<DashboardSummary | null>(null)
  const [prData, setPrData] = useState<PRSummaryResponse | null>(null)
  const [commitData, setCommitData] = useState<CommitStatsResponse | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeShareInfo[]>([])
  const [support, setSupport] = useState<ProductionSupportResponse | null>(null)
  const [apiCatalog, setApiCatalog] = useState<ApiCatalogInfo[]>([])
  const [custOverview, setCustOverview] = useState<CustomersOverviewResponse | null>(null)
  const [showAllPRs, setShowAllPRs] = useState(false)
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null)
  const [showPRModal, setShowPRModal] = useState(false)
  const [showCommitModal, setShowCommitModal] = useState(false)

  const isManager = authIsManager

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [custs, sum, intSum, prs, commits, kb, sup, apis, cov] = await Promise.allSettled([
        customerService.getCustomers(),
        customerService.getCustomerSummary(),
        getInternalSummary(),
        getPRSummary(),
        getCommitStats(undefined, 30),
        getKnowledgeShares(),
        getProductionSupport(),
        getApiCatalog(),
        getCustomersOverview(),
      ])
      if (custs.status === 'fulfilled') setCustomers(custs.value)
      if (sum.status === 'fulfilled') setSummary(sum.value)
      if (intSum.status === 'fulfilled') setIntSummary(intSum.value)
      if (prs.status === 'fulfilled') setPrData(prs.value)
      if (commits.status === 'fulfilled') setCommitData(commits.value)
      if (kb.status === 'fulfilled') setKnowledge(kb.value)
      if (sup.status === 'fulfilled') setSupport(sup.value)
      if (apis.status === 'fulfilled') setApiCatalog(apis.value)
      if (cov.status === 'fulfilled') setCustOverview(cov.value)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const allProducts = Array.from(new Set(customers.flatMap(c => c.products || []))).sort()

  const filteredCustomers = customers.filter(c => {
    if (activeProductTab !== 'all' && !(c.products || []).includes(activeProductTab)) return false
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      return c.customerName.toLowerCase().includes(q) ||
        c.customerId.toLowerCase().includes(q) ||
        (c.tenantId || '').toLowerCase().includes(q) ||
        (c.customerManager || '').toLowerCase().includes(q)
    }
    return true
  })

  // Summary counts
  const totalUsers = customers.reduce((s, c) => s + (c.activeUsers || 0), 0)
  const totalTickets = customers.reduce((s, c) => s + (c.openTickets || 0), 0)
  const saasCount = customers.filter(c => c.deploymentType === 'SaaS').length
  const onPremCount = customers.filter(c => c.deploymentType === 'OnPremise').length
  const hybridCount = customers.filter(c => c.deploymentType === 'Hybrid').length
  const healthGood = customers.filter(c => c.healthScore === 'Good').length
  const healthWarn = customers.filter(c => c.healthScore === 'Warning').length
  const healthCrit = customers.filter(c => c.healthScore === 'Critical').length

  const d = intSummary?.devops
  const birthdays = intSummary?.birthdays || []
  const todayBD = birthdays.filter(b => b.isToday)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Motivational Quote Popup */}
      {showQuote && <MagicalQuoteOverlay quote={quote} onDismiss={() => setShowQuote(false)} />}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Layers className="w-7 h-7 text-blue-600" />
            Dashboard
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {customers.length} customers &middot; {allProducts.length} products &middot; Real-time KPI view
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-700">
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Refresh
          </button>
          {isManager && (
            <>
              <button onClick={() => setShowWidgetWizard(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-500 hover:to-purple-500 text-sm shadow-lg shadow-blue-500/20">
                <Wand2 className="w-4 h-4" /> Widget Wizard
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
           SECTION 1: Master KPI Row
           ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        <KpiCard icon={Building2} label="Total Customers" value={customers.length} color="blue" onClick={() => setExpandedKpi(expandedKpi === 'customers' ? null : 'customers')} active={expandedKpi === 'customers'} />
        <KpiCard icon={Activity} label="Active" value={summary?.activeCustomers ?? 0} color="green" onClick={() => setExpandedKpi(expandedKpi === 'active' ? null : 'active')} active={expandedKpi === 'active'} />
        <KpiCard icon={Users} label="Total Users" value={totalUsers} color="purple" format onClick={() => setExpandedKpi(expandedKpi === 'users' ? null : 'users')} active={expandedKpi === 'users'} />
        <KpiCard icon={GitPullRequest} label="Open PRs" value={d?.openPRs ?? 0} color="indigo" onClick={() => setExpandedKpi(expandedKpi === 'prs' ? null : 'prs')} active={expandedKpi === 'prs'} />
        <KpiCard icon={Clock} label="PR Waiting" value={d?.prsWaitingApproval ?? 0} color={d?.prsWaitingApproval ? 'red' : 'green'} onClick={() => setExpandedKpi(expandedKpi === 'prWaiting' ? null : 'prWaiting')} active={expandedKpi === 'prWaiting'} />
        <KpiCard icon={GitCommit} label="Commits (30d)" value={commitData?.totalCommits ?? d?.totalCommits ?? 0} color="sky" onClick={() => setExpandedKpi(expandedKpi === 'commits' ? null : 'commits')} active={expandedKpi === 'commits'} />
        <KpiCard icon={Code2} label="Today Builds" value={d?.todayBuilds?.total ?? 0} color={d?.todayBuilds?.failed ? 'red' : 'green'} onClick={() => setExpandedKpi(expandedKpi === 'builds' ? null : 'builds')} active={expandedKpi === 'builds'} />
        <KpiCard icon={Ticket} label="Open Tickets" value={totalTickets} color={totalTickets > 20 ? 'red' : 'amber'} onClick={() => setExpandedKpi(expandedKpi === 'tickets' ? null : 'tickets')} active={expandedKpi === 'tickets'} />
      </div>

      {/* ── KPI Detail Popup ── */}
      {expandedKpi && (
        <KpiDetailPanel
          kpiKey={expandedKpi}
          onClose={() => setExpandedKpi(null)}
          customers={customers}
          summary={summary}
          intSummary={intSummary}
          commitData={commitData}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
           SECTION 2: Three-column smart row
           ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Birthdays ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <span>🎂</span> Birthdays
              {todayBD.length > 0 && <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{todayBD.length} today!</span>}
            </h3>
            <span className="text-[10px] text-gray-400">{birthdays.length} upcoming</span>
          </div>
          <div className="p-3 max-h-48 overflow-y-auto">
            {birthdays.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No upcoming birthdays</p>
            ) : (
              <div className="space-y-1">
                {birthdays.map(b => (
                  <div key={b.id} className={clsx(
                    'flex items-center justify-between text-xs py-1.5 px-2 rounded',
                    b.isToday ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'
                  )}>
                    <div>
                      <span className="font-medium text-gray-900">{b.isToday && '🎉 '}{b.name}</span>
                      {b.role && <span className="text-gray-400 ml-1.5 text-[10px]">{b.role}</span>}
                    </div>
                    <span className={clsx(
                      'text-[10px] px-1.5 py-0.5 rounded-full',
                      b.isToday ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-500'
                    )}>
                      {b.isToday ? 'Today!' : `${b.daysUntil}d`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Knowledge Sharing ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <span>📚</span> Knowledge Sharing
            </h3>
            <span className="text-[10px] text-gray-400">{knowledge.length} items</span>
          </div>
          <div className="p-3 max-h-48 overflow-y-auto">
            {knowledge.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No knowledge entries yet</p>
            ) : (
              <div className="space-y-1">
                {knowledge.slice(0, 8).map(k => {
                  const catIcon: Record<string, string> = { Article: '📄', Video: '🎥', Tool: '🔧', 'Best Practice': '⭐', Tutorial: '📖' }
                  return (
                    <div key={k.id} className="flex items-start gap-1.5 text-xs py-1 px-1.5 rounded hover:bg-gray-50">
                      <span className="flex-shrink-0">{catIcon[k.category || ''] || '📌'}</span>
                      <div className="min-w-0 flex-1">
                        {k.url ? (
                          <a href={k.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">{k.title}</a>
                        ) : (
                          <span className="text-gray-800 font-medium">{k.title}</span>
                        )}
                        {k.description && <div className="text-[10px] text-gray-400 truncate">{k.description}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Production Support ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <span>🛟</span> Production Support
            </h3>
            {support && support.summary.total > 0 && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-red-600 font-medium">{support.summary.open} open</span>
                {support.summary.critical > 0 && (
                  <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">{support.summary.critical} crit</span>
                )}
              </div>
            )}
          </div>
          <div className="p-3 max-h-48 overflow-y-auto">
            {!support || support.summary.total === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No production incidents</p>
            ) : (
              <div className="space-y-0.5">
                <div className="flex gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800">Open: {support.summary.open}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">In Progress: {support.summary.inProgress}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">Resolved: {support.summary.resolved}</span>
                </div>
                {support.entries.slice(0, 6).map(e => (
                  <div key={e.id} className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded hover:bg-gray-50">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={clsx('px-1 py-0 rounded text-[9px]',
                        e.severity === 'Critical' ? 'bg-red-100 text-red-800' :
                        e.severity === 'High' ? 'bg-orange-100 text-orange-800' : 'bg-yellow-100 text-yellow-800'
                      )}>{e.severity}</span>
                      <span className="text-gray-900 truncate">{e.title}</span>
                    </div>
                    <span className={clsx('text-[9px] px-1 py-0 rounded ml-1 flex-shrink-0',
                      e.status === 'Open' ? 'bg-red-100 text-red-800' :
                      e.status === 'Resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    )}>{e.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           SECTION 3: DevOps + Builds + Commits
           ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Today Builds ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <span>🏗</span> Today Builds
            </h3>
            {d?.todayBuilds && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-green-600">✅ {d.todayBuilds.succeeded}</span>
                <span className="text-red-600">❌ {d.todayBuilds.failed}</span>
                {d.todayBuilds.inProgress > 0 && <span className="text-amber-600">⏳ {d.todayBuilds.inProgress}</span>}
              </div>
            )}
          </div>
          <div className="p-3 max-h-52 overflow-y-auto">
            {(!d?.todayBuilds?.builds || d.todayBuilds.builds.length === 0) ? (
              <p className="text-xs text-gray-400 text-center py-4">No builds today</p>
            ) : (
              <div className="space-y-1">
                {d.todayBuilds.builds.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-gray-50">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span>{b.result === 'succeeded' ? '✅' : b.result === 'failed' ? '❌' : '⏳'}</span>
                      <a href={b.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate font-medium">{b.buildNumber}</a>
                      <span className="text-gray-400 truncate">{b.definitionName}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                      {b.requestedBy?.split(' ')[0]} &bull; {b.durationMinutes ? `${b.durationMinutes.toFixed(1)}m` : '...'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Total Commits + LOC ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-100 to-cyan-100">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <span>📊</span> Commits + LOC ({commitData?.daysBack ?? 30}d)
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">{commitData?.totalCommits ?? 0} commits · {commitData?.totalChanges ?? 0} changes</span>
              <button 
                onClick={() => setShowCommitModal(true)}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                View All
              </button>
            </div>
          </div>
          <div className="p-3">
            {commitData?.byAuthor && commitData.byAuthor.length > 0 ? (
              <div className="space-y-1.5">
                {commitData.byAuthor.slice(0, 6).map(a => (
                  <div key={a.author} className="flex items-center gap-2">
                    <span className="w-24 text-xs text-gray-800 truncate">{a.author}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min((a.commits / (commitData.byAuthor[0]?.commits || 1)) * 100, 100)}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-gray-500 w-10 text-right">{a.commits}c</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">No commit data</p>
            )}
          </div>
        </div>

        {/* ── Pull Requests ── */}
        <div className="bg-white rounded-xl border-4 border-red-500 overflow-hidden shadow-xl">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-100 to-indigo-100">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <span>🔃</span> Pull Requests
            </h3>
            <div className="flex items-center gap-3">
              {prData && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-purple-600 font-medium">{prData.totalActive} active</span>
                  <span className="text-red-600 font-medium">{prData.waitingApproval} waiting</span>
                  <span className="text-green-600 font-medium">{prData.approved} approved</span>
                </div>
              )}
              <button 
                onClick={() => setShowPRModal(true)}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                View All
              </button>
            </div>
          </div>
          <div className="p-3 max-h-52 overflow-y-auto">
            {!prData || prData.prs.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No PRs found</p>
            ) : (
              <div className="space-y-1">
                {prData.prs.filter(pr => !pr.isApproved && !pr.isDraft).slice(0, showAllPRs ? 50 : 5).map(pr => (
                  <div key={pr.pullRequestId} className="text-xs py-1.5 px-1.5 rounded hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          #{pr.pullRequestId}
                        </a>
                        <span className="text-gray-800 ml-1 truncate">{pr.title}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                        {new Date(pr.creationDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {pr.createdBy} &bull; {pr.repositoryName} &bull;
                      <span className="font-mono"> {pr.sourceBranch?.replace('refs/heads/', '')}</span>
                      {' → '}
                      <span className="font-mono">{pr.targetBranch?.replace('refs/heads/', '')}</span>
                    </div>
                  </div>
                ))}
                {prData.prs.filter(pr => !pr.isApproved && !pr.isDraft).length > 5 && (
                  <button onClick={() => setShowAllPRs(!showAllPRs)}
                    className="text-[10px] text-blue-500 hover:underline w-full text-center py-1">
                    {showAllPRs ? 'Show less' : `View all ${prData.prs.filter(pr => !pr.isApproved && !pr.isDraft).length} PRs`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           SECTION 4: API Catalog + Customer Deployment Mix
           ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── API Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <span>🔌</span> API Details
            </h3>
            <span className="text-[10px] text-gray-400">{apiCatalog.length} endpoints</span>
          </div>
          <div className="p-3 max-h-52 overflow-y-auto">
            {apiCatalog.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No API entries</p>
            ) : (
              <div className="space-y-0.5">
                {apiCatalog.map(a => {
                  const methodColor: Record<string, string> = {
                    GET: 'bg-green-100 text-green-700', POST: 'bg-blue-100 text-blue-700',
                    PUT: 'bg-yellow-100 text-yellow-700', DELETE: 'bg-red-100 text-red-700',
                  }
                  return (
                    <div key={a.id} className="flex items-center gap-1.5 text-[11px] py-1 px-1.5 rounded hover:bg-gray-50">
                      <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-mono font-bold', methodColor[a.httpMethod || 'GET'] || '')}>{a.httpMethod}</span>
                      <span className="font-medium text-gray-900">{a.serviceName}</span>
                      <span className="font-mono text-gray-400 truncate">{a.endpoint}</span>
                      {a.category && <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">{a.category}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Customer Deployment (On-Prem / SaaS) with Tenant/Project ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <span>🏢</span> Customers — On-Prem / SaaS
            </h3>
            {custOverview && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">SaaS: {custOverview.saas.count}</span>
                <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full">On-Prem: {custOverview.onPremise.count}</span>
                {custOverview.hybrid.count > 0 && <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">Hybrid: {custOverview.hybrid.count}</span>}
              </div>
            )}
          </div>
          <div className="p-3 max-h-52 overflow-y-auto">
            {!custOverview || custOverview.total === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No customer data</p>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-[10px] text-gray-500 uppercase">
                    <th className="pb-1.5 pr-2">Customer</th>
                    <th className="pb-1.5 pr-2">Type</th>
                    <th className="pb-1.5 pr-2">Tenant ID</th>
                    <th className="pb-1.5 pr-2">Project ID</th>
                    <th className="pb-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...custOverview.saas.customers, ...custOverview.onPremise.customers, ...custOverview.hybrid.customers].map(c => (
                    <tr key={c.id} className="border-t border-gray-50">
                      <td className="py-1.5 pr-2 font-medium text-gray-900">{c.customerName}</td>
                      <td className="py-1.5 pr-2">
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px]',
                          custOverview.saas.customers.some(s => s.id === c.id) ? 'bg-blue-50 text-blue-700' :
                          custOverview.onPremise.customers.some(s => s.id === c.id) ? 'bg-purple-50 text-purple-700' : 'bg-yellow-50 text-yellow-700'
                        )}>
                          {custOverview.saas.customers.some(s => s.id === c.id) ? 'SaaS' :
                           custOverview.onPremise.customers.some(s => s.id === c.id) ? 'On-Prem' : 'Hybrid'}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 font-mono text-[10px] text-gray-600">{c.customerTenantId || '—'}</td>
                      <td className="py-1.5 pr-2 font-mono text-[10px] text-gray-600">{c.propertyId || '—'}</td>
                      <td className="py-1.5">
                        <span className={clsx('px-1.5 py-0.5 rounded text-[10px]',
                          c.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                        )}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           SECTION 5: Deployment + Health + Product adoption
           ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Deployment Mix</h3>
          <div className="space-y-3">
            <DeploymentBar label="SaaS (Cloud)" count={saasCount} total={customers.length} color="bg-blue-500" icon={Cloud} />
            <DeploymentBar label="On-Premise" count={onPremCount} total={customers.length} color="bg-amber-500" icon={HardDrive} />
            <DeploymentBar label="Hybrid" count={hybridCount} total={customers.length} color="bg-purple-500" icon={Server} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Health Overview</h3>
          <div className="space-y-3">
            <HealthRow label="Good" count={healthGood} total={customers.length} color="bg-emerald-500" />
            <HealthRow label="Warning" count={healthWarn} total={customers.length} color="bg-amber-500" />
            <HealthRow label="Critical" count={healthCrit} total={customers.length} color="bg-red-500" />
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
            <Heart className="w-3 h-3" />
            {Math.round((healthGood / Math.max(customers.length, 1)) * 100)}% healthy
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Product Adoption</h3>
          <div className="space-y-2">
            {allProducts.map(p => {
              const count = customers.filter(c => (c.products || []).includes(p)).length
              const cfg = productConfig[p] || { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' }
              return (
                <div key={p} className="flex items-center gap-3">
                  <div className={`flex-1 text-xs font-medium ${cfg.color} truncate`}>{p}</div>
                  <div className="w-24 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${cfg.color.replace('text-', 'bg-')}`}
                      style={{ width: `${(count / Math.max(customers.length, 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-600 w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
           SECTION 6: Live Customer Details (cards + search)
           ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-100 px-4 pt-3 flex items-center gap-3 overflow-x-auto">
          <TabButton active={activeProductTab === 'all'} onClick={() => setActiveProductTab('all')}
            label="All Customers" count={customers.length} />
          {allProducts.map(p => (
            <TabButton key={p} active={activeProductTab === p} onClick={() => setActiveProductTab(p)}
              label={p} count={customers.filter(c => (c.products || []).includes(p)).length} />
          ))}
          <div className="ml-auto flex items-center gap-2 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search customers..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" />
            </div>
          </div>
        </div>

        <div className="p-4">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg font-medium">No customers found</p>
              <p className="text-sm mt-1">{customers.length === 0 ? 'No customer data available' : 'Try a different filter or search'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCustomers.map(c => (
                <CustomerCard key={c.id} customer={c} onClick={() => setSelectedCustomer(c)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Popups */}
      {selectedCustomer && (
        <CustomerDetailPopup customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
      {showWidgetWizard && (
        <WidgetConfigWizard
          pageId="manager-dashboard"
          onClose={() => setShowWidgetWizard(false)}
          onSaved={() => setShowWidgetWizard(false)}
        />
      )}

      {/* Full View Modals */}
      <AdvancedPRListModal
        prs={prData?.prs?.map(pr => ({
          pullRequestId: pr.pullRequestId,
          title: pr.title,
          description: '',
          createdBy: pr.createdBy,
          creationDate: pr.creationDate,
          sourceBranch: pr.sourceBranch,
          targetBranch: pr.targetBranch,
          repositoryName: pr.repositoryName,
          url: pr.url,
          webUrl: pr.webUrl,
          isApproved: pr.isApproved,
          isDraft: pr.isDraft,
          status: pr.status || 'active',
          reviewers: pr.reviewers?.map(r => ({ displayName: r.displayName, vote: r.vote })) || [],
          mergeStatus: undefined,
        })) || []}
        isOpen={showPRModal}
        onClose={() => setShowPRModal(false)}
        title="All Pull Requests - Full View"
      />

      {/* Commit Full View Modal */}
      <CommitsDetailModal
        commits={(commitData?.recentCommits || []).map(c => ({
          commitId: c.commitId || c.shortCommitId,
          shortId: c.shortCommitId,
          comment: c.comment,
          authorName: c.authorName,
          authorEmail: c.authorEmail,
          authorDate: c.authorDate,
          repository: c.repositoryName,
          url: c.url || '',
          changeCounts: c.changeCounts ? {
            add: c.changeCounts.add || 0,
            edit: c.changeCounts.edit || 0,
            delete: c.changeCounts.delete || 0,
          } : undefined,
        } as CommitDetail))}
        isOpen={showCommitModal}
        onClose={() => setShowCommitModal(false)}
        title="All Commits - Full View"
      />
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function KpiCard({ icon: Icon, label, value, color, format, onClick, active }: {
  icon: any; label: string; value: number; color: string; format?: boolean; onClick?: () => void; active?: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }
  const displayVal = format && value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString()
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-xl border p-3 transition-all cursor-pointer',
        colors[color] || colors.blue,
        active ? 'ring-2 ring-offset-1 ring-blue-500 shadow-lg scale-[1.03]' : 'hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-xs font-medium opacity-70 truncate">{label}</span>
      </div>
      <div className="text-2xl font-bold">{displayVal}</div>
      <div className="text-[9px] opacity-50 mt-1">Click for details</div>
    </div>
  )
}

// ─────────────────────────────────────────
// KPI Detail Panel — expandable data view + share
// ─────────────────────────────────────────
function KpiDetailPanel({ kpiKey, onClose, customers, summary, intSummary, commitData }: {
  kpiKey: string;
  onClose: () => void;
  customers: CustomerDetailDto[];
  summary: CustomerSummaryDto | null;
  intSummary: DashboardSummary | null;
  commitData: CommitStatsResponse | null;
}) {
  const [copied, setCopied] = useState(false)
  const d = intSummary?.devops

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderContent = () => {
    switch (kpiKey) {
      case 'builds': {
        const builds = d?.todayBuilds?.builds || []
        const shareText = `Today Builds Summary (${new Date().toLocaleDateString()})\n` +
          `Total: ${d?.todayBuilds?.total ?? 0} | Succeeded: ${d?.todayBuilds?.succeeded ?? 0} | Failed: ${d?.todayBuilds?.failed ?? 0} | In Progress: ${d?.todayBuilds?.inProgress ?? 0}\n\n` +
          builds.map(b => `${b.result === 'succeeded' ? '✅' : b.result === 'failed' ? '❌' : '⏳'} ${b.buildNumber} — ${b.definitionName} (${b.requestedBy?.split(' ')[0]}, ${b.durationMinutes?.toFixed(1)}m)`).join('\n')
        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Code2 className="w-4 h-4" /> Today Builds (Azure DevOps)
              </h3>
              <button onClick={() => handleCopyToClipboard(shareText)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                {copied ? <><Check className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Share</>}
              </button>
            </div>
            {/* Summary chips */}
            <div className="flex gap-2 mb-3">
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">Total: {d?.todayBuilds?.total ?? 0}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">✅ {d?.todayBuilds?.succeeded ?? 0}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">❌ {d?.todayBuilds?.failed ?? 0}</span>
              {(d?.todayBuilds?.inProgress ?? 0) > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">⏳ {d?.todayBuilds?.inProgress}</span>
              )}
            </div>
            {builds.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No builds today</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {builds.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-xs py-2 px-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{b.result === 'succeeded' ? '✅' : b.result === 'failed' ? '❌' : '⏳'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {b.url ? (
                            <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium truncate">
                              {b.buildNumber}
                            </a>
                          ) : (
                            <span className="font-medium truncate">{b.buildNumber}</span>
                          )}
                          <span className="text-gray-400">·</span>
                          <span className="text-gray-500 truncate">{b.definitionName}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {b.sourceBranch?.replace('refs/heads/', '')} · {b.requestedBy}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 whitespace-nowrap ml-2 text-right">
                      <div>{b.durationMinutes ? `${b.durationMinutes.toFixed(1)} min` : 'Running...'}</div>
                      <div>{b.startTime ? new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      }
      case 'customers': {
        const shareText = `Customer Summary\nTotal: ${customers.length} | Active: ${summary?.activeCustomers ?? 0}`
        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Building2 className="w-4 h-4" /> Total Customers</h3>
              <button onClick={() => handleCopyToClipboard(shareText)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                {copied ? <><Check className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Share</>}
              </button>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p>Total: <strong>{customers.length}</strong></p>
              <p>Active: <strong>{summary?.activeCustomers ?? 0}</strong></p>
              <p>SaaS: <strong>{customers.filter(c => c.deploymentType === 'SaaS').length}</strong> · On-Premise: <strong>{customers.filter(c => c.deploymentType === 'OnPremise').length}</strong> · Hybrid: <strong>{customers.filter(c => c.deploymentType === 'Hybrid').length}</strong></p>
            </div>
          </>
        )
      }
      case 'prs': {
        const shareText = `Open PRs: ${d?.openPRs ?? 0} | Waiting Approval: ${d?.prsWaitingApproval ?? 0} | Merged (7d): ${d?.mergedPRsLast7Days ?? 0}`
        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><GitPullRequest className="w-4 h-4" /> Open PRs</h3>
              <button onClick={() => handleCopyToClipboard(shareText)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                {copied ? <><Check className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Share</>}
              </button>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p>Open: <strong>{d?.openPRs ?? 0}</strong></p>
              <p>Waiting Approval: <strong>{d?.prsWaitingApproval ?? 0}</strong></p>
              <p>Merged (last 7 days): <strong>{d?.mergedPRsLast7Days ?? 0}</strong></p>
              <p>Total Repositories: <strong>{d?.totalRepositories ?? 0}</strong></p>
            </div>
          </>
        )
      }
      case 'commits': {
        const shareText = `Commits (30d): ${commitData?.totalCommits ?? d?.totalCommits ?? 0} | Today: ${d?.commitsToday ?? 0}`
        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><GitCommit className="w-4 h-4" /> Commits (30d)</h3>
              <button onClick={() => handleCopyToClipboard(shareText)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                {copied ? <><Check className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Share</>}
              </button>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p>Total (30 days): <strong>{commitData?.totalCommits ?? d?.totalCommits ?? 0}</strong></p>
              <p>Today: <strong>{d?.commitsToday ?? 0}</strong></p>
            </div>
          </>
        )
      }
      default: {
        const labels: Record<string, string> = {
          active: `Active Customers: ${summary?.activeCustomers ?? 0}`,
          users: `Total Users: ${customers.reduce((s, c) => s + (c.activeUsers || 0), 0)}`,
          prWaiting: `PRs Waiting Approval: ${d?.prsWaitingApproval ?? 0}`,
          tickets: `Open Tickets: ${customers.reduce((s, c) => s + (c.openTickets || 0), 0)}`,
        }
        const shareText = labels[kpiKey] || kpiKey
        return (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">{kpiKey.charAt(0).toUpperCase() + kpiKey.slice(1)} Details</h3>
              <button onClick={() => handleCopyToClipboard(shareText)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                {copied ? <><Check className="w-3 h-3 text-green-500" /> Copied!</> : <><Copy className="w-3 h-3" /> Share</>}
              </button>
            </div>
            <p className="text-xs text-gray-600">{shareText}</p>
          </>
        )
      }
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">KPI Details</span>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div className="p-4">
        {renderContent()}
      </div>
    </div>
  )
}

function DeploymentBar({ label, count, total, color, icon: Icon }: {
  label: string; count: number; total: number; color: string; icon: any
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-gray-400" />
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-gray-500">{count} ({pct}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

function HealthRow({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-gray-500">{count} ({pct}%)</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number
}) {
  return (
    <button onClick={onClick}
      className={clsx(
        'px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
        active ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
      )}>
      {label} <span className={clsx('ml-1 text-xs', active ? 'text-blue-500' : 'text-gray-400')}>({count})</span>
    </button>
  )
}

function CustomerCard({ customer: c, onClick }: { customer: CustomerDetailDto; onClick: () => void }) {
  const deployIcon = c.deploymentType === 'SaaS' ? Cloud
    : c.deploymentType === 'OnPremise' ? HardDrive : Server
  const DeployIcon = deployIcon
  const healthColor = c.healthScore === 'Good' ? 'bg-emerald-500'
    : c.healthScore === 'Warning' ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div onClick={onClick}
      className="group bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-lg transition-all duration-200"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-sm font-bold">
            {c.customerName.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{c.customerName}</div>
            <div className="text-xs text-gray-400 font-mono">{c.customerId} &middot; Tenant: {c.tenantId || 'N/A'}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${healthColor}`} />
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>{c.status}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(c.priority)}`}>{c.priority}</span>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex items-center gap-1">
          <DeployIcon className="w-3 h-3" /> {c.deploymentType}
        </span>
      </div>

      {/* Mini metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg py-1.5">
          <div className="text-xs text-gray-500">Users</div>
          <div className="text-sm font-bold text-gray-800">{c.activeUsers ?? 0}</div>
        </div>
        <div className="bg-gray-50 rounded-lg py-1.5">
          <div className="text-xs text-gray-500">Props</div>
          <div className="text-sm font-bold text-gray-800">{c.totalProperties ?? 0}</div>
        </div>
        <div className="bg-gray-50 rounded-lg py-1.5">
          <div className="text-xs text-gray-500">Tickets</div>
          <div className={clsx('text-sm font-bold', c.openTickets && c.openTickets > 5 ? 'text-red-600' : 'text-gray-800')}>
            {c.openTickets ?? 0}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="mt-3 flex flex-wrap gap-1">
        {(c.products || []).slice(0, 3).map((p, i) => {
          const cfg = productConfig[p] || { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' }
          return (
            <span key={i} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
              {p.replace('Management', 'Mgmt').replace('Activities', 'Act.')}
            </span>
          )
        })}
        {(c.products || []).length > 3 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500">
            +{(c.products || []).length - 3}
          </span>
        )}
      </div>

      {/* Manager info */}
      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> {c.customerManager || 'N/A'}</span>
        <span className="flex items-center gap-1"><Headphones className="w-3 h-3" /> {c.supportManager || 'N/A'}</span>
      </div>
    </div>
  )
}
