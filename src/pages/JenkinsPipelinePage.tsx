import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch, Activity, Clock, CheckCircle2, XCircle, AlertTriangle,
  Loader2, RefreshCw, Server, Terminal,
  BarChart3, Zap, Timer, HardDrive, Settings,
  Search, ExternalLink, ChevronDown, Play, Hash, Layers, Octagon, X
} from 'lucide-react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import jenkinsService, {
  type JenkinsConnection,
  type JenkinsJob,
  type JenkinsBuild,
  type JenkinsBuildDetail,
  type JenkinsDashboardStats,
  type JenkinsNode,
  type JenkinsPipelineConfig,
  type JenkinsParameterDefinition
} from '../services/jenkinsService'

type TabView = 'overview' | 'pipelines' | 'builds' | 'nodes'

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle2; label: string }> = {
  SUCCESS: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2, label: 'Success' },
  FAILURE: { color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle, label: 'Failed' },
  UNSTABLE: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle, label: 'Unstable' },
  ABORTED: { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: XCircle, label: 'Aborted' },
  BUILDING: { color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Loader2, label: 'Building' },
  NOT_BUILT: { color: 'text-gray-500', bg: 'bg-gray-500/10', icon: Clock, label: 'Not Built' },
}

function getStatusFromColor(color?: string): string {
  if (!color) return 'NOT_BUILT'
  if (color.includes('_anime')) return 'BUILDING'
  if (color.startsWith('blue')) return 'SUCCESS'
  if (color.startsWith('red')) return 'FAILURE'
  if (color.startsWith('yellow')) return 'UNSTABLE'
  if (color === 'disabled' || color === 'notbuilt') return 'NOT_BUILT'
  if (color === 'aborted') return 'ABORTED'
  return 'NOT_BUILT'
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours}h ${remainMinutes}m`
}

function formatTimestamp(ts: number): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function timeAgo(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_BUILT
  const Icon = cfg.icon
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 font-medium rounded-full',
      cfg.color, cfg.bg,
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
    )}>
      <Icon className={clsx(
        size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5',
        status === 'BUILDING' && 'animate-spin'
      )} />
      {cfg.label}
    </span>
  )
}

function HealthBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-8">{score}%</span>
    </div>
  )
}

export default function JenkinsPipelinePage() {
  const [connections, setConnections] = useState<JenkinsConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [tab, setTab] = useState<TabView>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data
  const [stats, setStats] = useState<JenkinsDashboardStats | null>(null)
  const [jobs, setJobs] = useState<JenkinsJob[]>([])
  const [nodes, setNodes] = useState<JenkinsNode[]>([])
  const [, setPipelines] = useState<JenkinsPipelineConfig[]>([])
  const [selectedJob, setSelectedJob] = useState<JenkinsJob | null>(null)
  const [jobBuilds, setJobBuilds] = useState<JenkinsBuild[]>([])
  const [buildDetail, setBuildDetail] = useState<JenkinsBuildDetail | null>(null)
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null)
  const [loadingBuilds, setLoadingBuilds] = useState(false)
  const [loadingConsole, setLoadingConsole] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showConnectionPicker, setShowConnectionPicker] = useState(false)

  // Build Trigger
  const [triggerModal, setTriggerModal] = useState<{ job: JenkinsJob; params: JenkinsParameterDefinition[] } | null>(null)
  const [triggerParams, setTriggerParams] = useState<Record<string, string>>({})
  const [triggering, setTriggering] = useState<string | null>(null) // jobPath being triggered
  const [triggerMessage, setTriggerMessage] = useState<{ text: string; success: boolean } | null>(null)

  // Load connections on mount
  useEffect(() => {
    (async () => {
      try {
        const conns = await jenkinsService.getConnections()
        setConnections(conns)
        if (conns.length > 0) {
          setSelectedConnection(conns[0].id)
        }
      } catch {
        // Will show empty state
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Load data when connection changes
  const loadData = useCallback(async (connId: string) => {
    try {
      setRefreshing(true)
      const [statsData, jobsData, nodesData, pipelinesData] = await Promise.all([
        jenkinsService.getStats(connId).catch(() => null),
        jenkinsService.getJobs(connId).catch(() => []),
        jenkinsService.getNodes(connId).catch(() => []),
        jenkinsService.getPipelines().catch(() => [])
      ])
      setStats(statsData)
      setJobs(jobsData)
      setNodes(nodesData)
      setPipelines(pipelinesData)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (selectedConnection) {
      loadData(selectedConnection)
    }
  }, [selectedConnection, loadData])

  // Auto-refresh every 30s
  useEffect(() => {
    if (!selectedConnection) return
    const interval = setInterval(() => loadData(selectedConnection), 30000)
    return () => clearInterval(interval)
  }, [selectedConnection, loadData])

  // Load builds for a job
  const handleJobClick = async (job: JenkinsJob) => {
    if (!selectedConnection) return
    setSelectedJob(job)
    setJobBuilds([])
    setBuildDetail(null)
    setConsoleOutput(null)
    try {
      setLoadingBuilds(true)
      const builds = await jenkinsService.getBuilds(selectedConnection, job.fullName || job.name)
      setJobBuilds(builds)
    } finally {
      setLoadingBuilds(false)
    }
  }

  // Load build detail + console
  const handleBuildClick = async (build: JenkinsBuild) => {
    if (!selectedConnection || !selectedJob) return
    const jobPath = selectedJob.fullName || selectedJob.name
    try {
      setLoadingConsole(true)
      const [detail, output] = await Promise.all([
        jenkinsService.getBuildDetail(selectedConnection, jobPath, build.number).catch(() => null),
        jenkinsService.getBuildConsole(selectedConnection, jobPath, build.number).catch(() => null)
      ])
      setBuildDetail(detail ?? null)
      setConsoleOutput(output)
    } finally {
      setLoadingConsole(false)
    }
  }

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      const name = (j.fullName || j.name).toLowerCase()
      if (searchTerm && !name.includes(searchTerm.toLowerCase())) return false
      if (statusFilter !== 'all') {
        const s = getStatusFromColor(j.color)
        if (s !== statusFilter) return false
      }
      return true
    })
  }, [jobs, searchTerm, statusFilter])

  // Trigger a build
  const handleTriggerBuild = async (job: JenkinsJob, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!selectedConnection) return
    const jobPath = job.fullName || job.name

    try {
      setTriggering(jobPath)
      // Check if job has parameters
      const params = await jenkinsService.getJobParameters(selectedConnection, jobPath)
      if (params.length > 0) {
        // Show parameter modal
        const defaults: Record<string, string> = {}
        params.forEach(p => {
          if (p.defaultParameterValue?.value) defaults[p.name] = p.defaultParameterValue.value
        })
        setTriggerParams(defaults)
        setTriggerModal({ job, params })
        setTriggering(null)
        return
      }

      // No params — trigger directly
      const result = await jenkinsService.triggerBuild(selectedConnection, jobPath)
      setTriggerMessage({ text: result.message, success: result.success })
      if (result.success) {
        // Refresh data after a short delay
        setTimeout(() => loadData(selectedConnection), 2000)
      }
    } catch {
      setTriggerMessage({ text: 'Failed to trigger build', success: false })
    } finally {
      setTriggering(null)
      setTimeout(() => setTriggerMessage(null), 4000)
    }
  }

  // Trigger with parameters
  const handleTriggerWithParams = async () => {
    if (!selectedConnection || !triggerModal) return
    const jobPath = triggerModal.job.fullName || triggerModal.job.name

    try {
      setTriggering(jobPath)
      const result = await jenkinsService.triggerBuild(selectedConnection, jobPath, triggerParams)
      setTriggerMessage({ text: result.message, success: result.success })
      setTriggerModal(null)
      setTriggerParams({})
      if (result.success) {
        setTimeout(() => loadData(selectedConnection), 2000)
      }
    } catch {
      setTriggerMessage({ text: 'Failed to trigger build', success: false })
    } finally {
      setTriggering(null)
      setTimeout(() => setTriggerMessage(null), 4000)
    }
  }

  // Stop a running build
  const handleStopBuild = async (job: JenkinsJob, buildNumber: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!selectedConnection) return
    const jobPath = job.fullName || job.name

    try {
      const result = await jenkinsService.stopBuild(selectedConnection, jobPath, buildNumber)
      setTriggerMessage({ text: result.message, success: result.success })
      if (result.success) {
        setTimeout(() => loadData(selectedConnection), 2000)
      }
    } catch {
      setTriggerMessage({ text: 'Failed to stop build', success: false })
    } finally {
      setTimeout(() => setTriggerMessage(null), 4000)
    }
  }

  const activeConn = connections.find(c => c.id === selectedConnection)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (connections.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mb-6">
            <Server className="w-10 h-10 text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No Jenkins Connections</h2>
          <p className="text-gray-400 mb-6">Set up a Jenkins connection first to start tracking pipelines and builds.</p>
          <Link
            to="/jenkins-setup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/20"
          >
            <Settings className="w-4 h-4" />
            Go to Jenkins Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jenkins Pipelines</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Monitor builds, track pipelines, and view deployment status</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Picker */}
            <div className="relative">
              <button
                onClick={() => setShowConnectionPicker(!showConnectionPicker)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <Server className="w-3.5 h-3.5 text-orange-400" />
                {activeConn?.connectionName ?? 'Select Server'}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showConnectionPicker && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1">
                  {connections.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedConnection(c.id); setShowConnectionPicker(false) }}
                      className={clsx(
                        'w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
                        c.id === selectedConnection ? 'text-orange-400' : 'text-gray-700 dark:text-gray-300'
                      )}
                    >
                      <div className="font-medium">{c.connectionName}</div>
                      <div className="text-[10px] text-gray-500">{c.serverUrl}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => selectedConnection && loadData(selectedConnection)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-colors disabled:opacity-50 border border-gray-200 dark:border-gray-700"
            >
              <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
            </button>

            <Link
              to="/jenkins-setup"
              className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
              { label: 'Total Jobs', value: stats.totalJobs, icon: Layers, color: 'text-blue-400' },
              { label: 'Successful', value: stats.successfulJobs, icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'Failed', value: stats.failedJobs, icon: XCircle, color: 'text-red-400' },
              { label: 'Unstable', value: stats.unstableJobs, icon: AlertTriangle, color: 'text-amber-400' },
              { label: 'Building', value: stats.buildingJobs, icon: Play, color: 'text-blue-400' },
              { label: 'Nodes Online', value: `${stats.onlineNodes}/${stats.totalNodes}`, icon: HardDrive, color: 'text-cyan-400' },
              { label: 'Builds 24h', value: stats.buildsLast24h, icon: BarChart3, color: 'text-purple-400' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-900 rounded-xl border border-gray-800 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={clsx('w-4 h-4', stat.color)} />
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-6 bg-gray-900 rounded-xl p-1 w-fit">
          {([
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'pipelines', label: 'Pipelines', icon: GitBranch },
            { id: 'builds', label: 'Build History', icon: Clock },
            { id: 'nodes', label: 'Nodes', icon: HardDrive },
          ] as { id: TabView; label: string; icon: typeof Activity }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all',
                tab === t.id
                  ? 'bg-orange-600 text-white font-medium shadow-lg'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ==========================================
              OVERVIEW TAB
             ========================================== */}
          {tab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Builds */}
                <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800">
                  <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-400" />
                      Recent Builds
                    </h3>
                    <span className="text-xs text-gray-500">{jobs.length} jobs</span>
                  </div>
                  <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
                    {jobs.filter(j => j.lastBuild).sort((a, b) => (b.lastBuild?.timestamp ?? 0) - (a.lastBuild?.timestamp ?? 0)).slice(0, 15).map(job => (
                      <div
                        key={job.fullName || job.name}
                        className="flex items-center p-4 hover:bg-gray-800/50 transition-colors group"
                      >
                        <button
                          onClick={() => handleJobClick(job)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <StatusBadge status={job.lastBuild?.result || getStatusFromColor(job.color)} />
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white truncate">
                                  {job.fullName || job.name}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Hash className="w-2.5 h-2.5" />
                                    {job.lastBuild?.number}
                                  </span>
                                  <span>{timeAgo(job.lastBuild?.timestamp ?? 0)}</span>
                                  {job.lastBuild?.duration ? (
                                    <span className="flex items-center gap-1">
                                      <Timer className="w-2.5 h-2.5" />
                                      {formatDuration(job.lastBuild.duration)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            {job.healthReport?.[0] && (
                              <div className="w-24 hidden md:block">
                                <HealthBar score={job.healthReport[0].score} />
                              </div>
                            )}
                          </div>
                        </button>
                        {job.buildable && (
                          <button
                            onClick={(e) => handleTriggerBuild(job, e)}
                            disabled={triggering === (job.fullName || job.name)}
                            className="ml-2 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0"
                            title="Trigger build"
                          >
                            {triggering === (job.fullName || job.name) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                    {jobs.length === 0 && (
                      <div className="p-8 text-center text-gray-500 text-sm">
                        No jobs found. Try syncing your connection first.
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Sidebar */}
                <div className="space-y-6">
                  {/* Health Overview */}
                  {stats && (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-orange-400" />
                        Health
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Average Health Score</span>
                          <span className="text-sm font-bold text-white">{stats.averageHealthScore}%</span>
                        </div>
                        <HealthBar score={stats.averageHealthScore} />
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <div className="p-2 bg-gray-950 rounded-lg text-center">
                            <div className="text-lg font-bold text-emerald-400">{stats.successfulJobs}</div>
                            <div className="text-[10px] text-gray-500">Passing</div>
                          </div>
                          <div className="p-2 bg-gray-950 rounded-lg text-center">
                            <div className="text-lg font-bold text-red-400">{stats.failedJobs}</div>
                            <div className="text-[10px] text-gray-500">Failing</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Executors */}
                  {stats && (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        Executors
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none" stroke="#1f2937" strokeWidth="3"
                            />
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none" stroke="#f97316" strokeWidth="3"
                              strokeDasharray={`${stats.totalExecutors > 0 ? (stats.busyExecutors / stats.totalExecutors) * 100 : 0}, 100`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-white">{stats.busyExecutors}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-300">{stats.busyExecutors} / {stats.totalExecutors} busy</div>
                          <div className="text-[10px] text-gray-500">{stats.queuedBuilds} queued</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Server Info */}
                  {activeConn && (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <Server className="w-4 h-4 text-gray-400" />
                        Server
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Version</span>
                          <span className="text-gray-300 font-mono text-xs">{activeConn.jenkinsVersion ?? '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Status</span>
                          <span className={clsx(
                            'text-xs font-medium',
                            activeConn.lastSyncStatus === 'Synced' || activeConn.lastSyncStatus === 'Connected'
                              ? 'text-emerald-400' : 'text-gray-400'
                          )}>
                            {activeConn.lastSyncStatus ?? 'Unknown'}
                          </span>
                        </div>
                        <a
                          href={activeConn.serverUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-orange-400 hover:text-orange-300 text-xs mt-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open Jenkins
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==========================================
              PIPELINES TAB
             ========================================== */}
          {tab === 'pipelines' && (
            <motion.div key="pipelines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Filters */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search pipelines..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-orange-500 outline-none"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-300 focus:border-orange-500 outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="SUCCESS">Success</option>
                  <option value="FAILURE">Failed</option>
                  <option value="UNSTABLE">Unstable</option>
                  <option value="BUILDING">Building</option>
                </select>
                <span className="text-xs text-gray-500">{filteredJobs.length} pipelines</span>
              </div>

              {/* Pipeline Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredJobs.map((job, i) => {
                  const status = job.lastBuild?.result || getStatusFromColor(job.color)
                  return (
                    <motion.button
                      key={job.fullName || job.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => handleJobClick(job)}
                      className="text-left bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 p-4 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-medium text-white truncate group-hover:text-orange-300 transition-colors">
                            {job.displayName || job.name}
                          </h4>
                          {job.fullName && job.fullName !== job.name && (
                            <div className="text-[10px] text-gray-600 truncate">{job.fullName}</div>
                          )}
                        </div>
                        <StatusBadge status={status} />
                      </div>

                      {job.lastBuild && (
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
                          <span className="flex items-center gap-1">
                            <Hash className="w-2.5 h-2.5" />
                            {job.lastBuild.number}
                          </span>
                          <span>{timeAgo(job.lastBuild.timestamp)}</span>
                          {job.lastBuild.duration > 0 && (
                            <span className="flex items-center gap-1">
                              <Timer className="w-2.5 h-2.5" />
                              {formatDuration(job.lastBuild.duration)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {job.healthReport?.[0] && (
                            <HealthBar score={job.healthReport[0].score} />
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {status === 'BUILDING' && job.lastBuild ? (
                            <button
                              onClick={(e) => handleStopBuild(job, job.lastBuild!.number, e)}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                              title="Stop build"
                            >
                              <Octagon className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                          {job.buildable && (
                            <button
                              onClick={(e) => handleTriggerBuild(job, e)}
                              disabled={triggering === (job.fullName || job.name)}
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                              title="Trigger build"
                            >
                              {triggering === (job.fullName || job.name) ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {job.description && (
                        <p className="text-[10px] text-gray-600 mt-2 line-clamp-1">{job.description}</p>
                      )}
                    </motion.button>
                  )
                })}
              </div>

              {filteredJobs.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <GitBranch className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                  <p>No pipelines match your filters</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ==========================================
              BUILDS TAB (Job detail + build history)
             ========================================== */}
          {tab === 'builds' && (
            <motion.div key="builds" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!selectedJob ? (
                <div className="text-center py-16 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                  <p>Select a pipeline from the Overview or Pipelines tab to view build history</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Build List */}
                  <div className="bg-gray-900 rounded-xl border border-gray-800">
                    <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white truncate">{selectedJob.fullName || selectedJob.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">Build History</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedJob.buildable && (
                          <button
                            onClick={() => handleTriggerBuild(selectedJob)}
                            disabled={triggering === (selectedJob.fullName || selectedJob.name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-colors disabled:opacity-50"
                            title="Trigger build"
                          >
                            {triggering === (selectedJob.fullName || selectedJob.name) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                            Build
                          </button>
                        )}
                      </div>
                    </div>
                    {loadingBuilds ? (
                      <div className="p-8 flex justify-center">
                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
                        {jobBuilds.map(build => (
                          <button
                            key={build.number}
                            onClick={() => handleBuildClick(build)}
                            className={clsx(
                              'w-full text-left p-3 hover:bg-gray-800/50 transition-colors',
                              buildDetail?.number === build.number && 'bg-gray-800/30'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={build.result || (build.building ? 'BUILDING' : 'NOT_BUILT')} />
                                <span className="text-sm text-gray-300 font-mono">#{build.number}</span>
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {formatDuration(build.duration)}
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-600 mt-1">{formatTimestamp(build.timestamp)}</div>
                          </button>
                        ))}
                        {jobBuilds.length === 0 && (
                          <div className="p-6 text-center text-gray-500 text-sm">No builds found</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Build Detail + Console */}
                  <div className="lg:col-span-2 space-y-4">
                    {buildDetail && (
                      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-white flex items-center gap-2">
                            Build #{buildDetail.number}
                            <StatusBadge status={buildDetail.result || (buildDetail.building ? 'BUILDING' : 'NOT_BUILT')} size="md" />
                          </h3>
                          <div className="flex items-center gap-2">
                            {buildDetail.building && selectedJob && (
                              <button
                                onClick={() => handleStopBuild(selectedJob!, buildDetail.number)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
                              >
                                <Octagon className="w-3.5 h-3.5" />
                                Stop
                              </button>
                            )}
                            {activeConn && (
                              <a
                                href={`${activeConn.serverUrl}/job/${(selectedJob.fullName || selectedJob.name).replace(/\//g, '/job/')}/${buildDetail.number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open in Jenkins
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase">Started</div>
                            <div className="text-gray-300">{formatTimestamp(buildDetail.timestamp)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase">Duration</div>
                            <div className="text-gray-300">{formatDuration(buildDetail.duration)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase">Estimated</div>
                            <div className="text-gray-300">{formatDuration(buildDetail.estimatedDuration)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase">Artifacts</div>
                            <div className="text-gray-300">{buildDetail.artifacts?.length ?? 0}</div>
                          </div>
                        </div>

                        {/* Change Sets */}
                        {buildDetail.changeSets && buildDetail.changeSets.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-800">
                            <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                              <GitBranch className="w-3 h-3" />
                              Changes
                            </h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {buildDetail.changeSets.flatMap(cs => cs.items ?? []).slice(0, 10).map((item, i) => (
                                <div key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                  <span className="font-mono text-gray-600 shrink-0">{item.commitId?.substring(0, 7)}</span>
                                  <span className="truncate">{item.msg}</span>
                                  {item.author?.fullName && (
                                    <span className="text-gray-600 shrink-0">— {item.author.fullName}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Console Output */}
                    {loadingConsole ? (
                      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 flex justify-center">
                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                      </div>
                    ) : consoleOutput ? (
                      <div className="bg-gray-900 rounded-xl border border-gray-800">
                        <div className="p-3 border-b border-gray-800 flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-300">Console Output</span>
                        </div>
                        <pre className="p-4 text-[11px] font-mono text-gray-400 max-h-[400px] overflow-auto whitespace-pre-wrap break-words leading-5">
                          {consoleOutput}
                        </pre>
                      </div>
                    ) : buildDetail ? (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        Console output not available
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ==========================================
              NODES TAB
             ========================================== */}
          {tab === 'nodes' && (
            <motion.div key="nodes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {nodes.map((node, i) => (
                  <motion.div
                    key={node.displayName}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-gray-900 rounded-xl border border-gray-800 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <HardDrive className={clsx(
                          'w-4 h-4',
                          node.offline ? 'text-red-400' : node.idle ? 'text-emerald-400' : 'text-amber-400'
                        )} />
                        <h4 className="text-sm font-medium text-white">{node.displayName}</h4>
                      </div>
                      <span className={clsx(
                        'px-2 py-0.5 text-[10px] font-medium rounded-full',
                        node.offline
                          ? 'bg-red-500/10 text-red-400'
                          : node.idle
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                      )}>
                        {node.offline ? 'Offline' : node.idle ? 'Idle' : 'Busy'}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Executors</span>
                        <span className="text-gray-300">{node.numExecutors}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Agent Type</span>
                        <span className="text-gray-300">{node.jnlpAgent ? 'JNLP Agent' : 'SSH Agent'}</span>
                      </div>
                      {node.description && (
                        <p className="text-gray-600 pt-1 line-clamp-2">{node.description}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {nodes.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <HardDrive className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                  <p>No nodes found. Sync your connection to fetch node data.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Trigger Toast Notification */}
      <AnimatePresence>
        {triggerMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={clsx(
              'fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 z-50',
              triggerMessage.success
                ? 'bg-emerald-900/90 border-emerald-700 text-emerald-200'
                : 'bg-red-900/90 border-red-700 text-red-200'
            )}
          >
            {triggerMessage.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="text-sm">{triggerMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parameterized Build Modal */}
      <AnimatePresence>
        {triggerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            onClick={() => setTriggerModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Play className="w-5 h-5 text-emerald-400" />
                    Trigger Build
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[360px]">
                    {triggerModal.job.fullName || triggerModal.job.name}
                  </p>
                </div>
                <button
                  onClick={() => setTriggerModal(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Parameters */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <p className="text-xs text-gray-500 mb-2">This job requires parameters. Configure and trigger:</p>
                {triggerModal.params.map(param => (
                  <div key={param.name}>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      {param.name}
                      {param.description && (
                        <span className="text-[10px] text-gray-500 ml-2 font-normal">{param.description}</span>
                      )}
                    </label>
                    {param.choices && param.choices.length > 0 ? (
                      <select
                        value={triggerParams[param.name] ?? ''}
                        onChange={e => setTriggerParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-xl text-sm text-white focus:border-orange-500 outline-none"
                      >
                        {param.choices.map(choice => (
                          <option key={choice} value={choice}>{choice}</option>
                        ))}
                      </select>
                    ) : param.type === 'BooleanParameterDefinition' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={triggerParams[param.name] === 'true'}
                          onChange={e => setTriggerParams(prev => ({ ...prev, [param.name]: e.target.checked ? 'true' : 'false' }))}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-950 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-400">{triggerParams[param.name] === 'true' ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={triggerParams[param.name] ?? ''}
                        onChange={e => setTriggerParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                        placeholder={param.defaultParameterValue?.value ?? `Enter ${param.name}`}
                        className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-orange-500 outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button
                  onClick={() => setTriggerModal(null)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTriggerWithParams}
                  disabled={!!triggering}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
                >
                  {triggering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Trigger Build
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
