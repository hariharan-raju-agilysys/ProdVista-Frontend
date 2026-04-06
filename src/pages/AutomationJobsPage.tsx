import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, Plus, Play, Pause, Trash2, RefreshCw, Clock, CheckCircle2,
  XCircle, AlertTriangle, Settings2, ChevronDown, ChevronRight,
  ExternalLink, Loader2, Activity, BarChart3, Power,
  Hammer, Database, FileText, RotateCcw, Send
} from 'lucide-react'
import {
  getDashboard, getJobs, createJob, updateJob, deleteJob,
  toggleJob, triggerJob, getJobRuns, cancelRun,
  type AutomationJobDto, type AutomationJobRunDto, type AutomationDashboardDto,
  type AutomationJobType, type ScheduleType,
  JOB_TYPE_LABELS, JOB_TYPE_COLORS, SCHEDULE_TYPE_LABELS, RUN_STATUS_COLORS,
} from '../services/automationJobService'

// ─── helpers ────────────────────────────────────────────────────
function timeAgo(dateStr?: string) {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatDuration(ms?: number) {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

const JOB_TYPE_ICONS: Record<AutomationJobType, typeof Zap> = {
  BuildTrigger: Hammer,
  DataSync: Database,
  ReleaseNotes: FileText,
  HealthCheck: Activity,
  Webhook: Send,
  CacheRefresh: RotateCcw,
  ReportGeneration: BarChart3,
}

// ─── main page ──────────────────────────────────────────────────
export default function AutomationJobsPage() {
  const [dashboard, setDashboard] = useState<AutomationDashboardDto | null>(null)
  const [jobs, setJobs] = useState<AutomationJobDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<AutomationJobDto | null>(null)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [jobRuns, setJobRuns] = useState<AutomationJobRunDto[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [d, j] = await Promise.all([getDashboard(), getJobs()])
      setDashboard(d)
      setJobs(j)
    } catch (e) {
      console.error('Failed to load automation data:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleToggle = async (job: AutomationJobDto) => {
    try {
      await toggleJob(job.id, !job.isEnabled)
      await loadData()
    } catch (e) { console.error('Toggle failed:', e) }
  }

  const handleTrigger = async (jobId: string) => {
    setTriggeringId(jobId)
    try {
      await triggerJob(jobId)
      await loadData()
    } catch (e) { console.error('Trigger failed:', e) }
    finally { setTriggeringId(null) }
  }

  const handleDelete = async (jobId: string) => {
    if (!confirm('Delete this automation job? This cannot be undone.')) return
    try {
      await deleteJob(jobId)
      await loadData()
    } catch (e) { console.error('Delete failed:', e) }
  }

  const handleExpandRuns = async (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null)
      return
    }
    setExpandedJobId(jobId)
    setRunsLoading(true)
    try {
      const runs = await getJobRuns(jobId, 10)
      setJobRuns(runs)
    } catch (e) { console.error('Failed to load runs:', e) }
    finally { setRunsLoading(false) }
  }

  const handleCreateSuccess = async () => {
    setShowCreateModal(false)
    await loadData()
  }

  // ─── render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/20">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Automation Jobs</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Scheduled builds, syncs & workflows</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={isLoading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => { setSelectedJob(null); setShowCreateModal(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg shadow hover:shadow-lg hover:shadow-amber-500/20 transition-all font-medium text-sm"
              >
                <Plus className="w-4 h-4" /> New Job
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ─── Dashboard Stats ──────────────────────────── */}
        {dashboard && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <StatCard label="Total Jobs" value={dashboard.totalJobs} icon={Zap} color="from-blue-500 to-cyan-500" />
            <StatCard label="Active" value={dashboard.enabledJobs} icon={Power} color="from-emerald-500 to-teal-500" />
            <StatCard label="Runs Today" value={dashboard.runsToday} icon={Activity} color="from-violet-500 to-purple-500" />
            <StatCard
              label="Success Rate"
              value={`${dashboard.successRate.toFixed(0)}%`}
              icon={BarChart3}
              color={dashboard.successRate >= 80 ? 'from-emerald-500 to-green-500' : 'from-red-500 to-rose-500'}
            />
          </motion.div>
        )}

        {/* ─── Job Cards ───────────────────────────────── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : jobs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Zap className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No automation jobs yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first job to automate builds, syncs, and more.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg shadow font-medium"
            >
              <Plus className="w-4 h-4 inline mr-2" /> Create Job
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {jobs.map((job, i) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={i}
                  isExpanded={expandedJobId === job.id}
                  runs={expandedJobId === job.id ? jobRuns : []}
                  runsLoading={runsLoading && expandedJobId === job.id}
                  triggering={triggeringId === job.id}
                  onToggle={() => handleToggle(job)}
                  onTrigger={() => handleTrigger(job.id)}
                  onDelete={() => handleDelete(job.id)}
                  onEdit={() => { setSelectedJob(job); setShowCreateModal(true) }}
                  onExpandRuns={() => handleExpandRuns(job.id)}
                  onCancelRun={(runId) => cancelRun(runId).then(loadData)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ─── Recent Runs ─────────────────────────────── */}
        {dashboard && dashboard.recentRuns.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" /> Recent Activity
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboard.recentRuns.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateJobModal
            job={selectedJob}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Stat Card ──────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: typeof Zap; color: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg bg-gradient-to-br ${color} shadow`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  )
}

// ─── Job Card ───────────────────────────────────────────────────
function JobCard({ job, index, isExpanded, runs, runsLoading, triggering, onToggle, onTrigger, onDelete, onEdit, onExpandRuns, onCancelRun }: {
  job: AutomationJobDto
  index: number
  isExpanded: boolean
  runs: AutomationJobRunDto[]
  runsLoading: boolean
  triggering: boolean
  onToggle: () => void
  onTrigger: () => void
  onDelete: () => void
  onEdit: () => void
  onExpandRuns: () => void
  onCancelRun: (runId: string) => void
}) {
  const TypeIcon = JOB_TYPE_ICONS[job.jobType] || Zap
  const successPct = job.totalRuns > 0 ? ((job.successfulRuns / job.totalRuns) * 100).toFixed(0) : '—'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ delay: index * 0.04 }}
      className={`bg-white dark:bg-gray-800 rounded-xl border ${
        job.isEnabled
          ? 'border-gray-200 dark:border-gray-700'
          : 'border-gray-200/50 dark:border-gray-700/50 opacity-60'
      } overflow-hidden`}
    >
      {/* header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* icon badge */}
        <div className={`p-2.5 rounded-lg bg-gradient-to-br ${JOB_TYPE_COLORS[job.jobType]} shadow flex-shrink-0`}>
          <TypeIcon className="w-5 h-5 text-white" />
        </div>

        {/* title & meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">{job.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${
              job.isEnabled ? 'bg-emerald-500' : 'bg-gray-400'
            }`}>
              {job.isEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            <span>{JOB_TYPE_LABELS[job.jobType]}</span>
            <span>•</span>
            <span>{SCHEDULE_TYPE_LABELS[job.scheduleType]}{job.scheduleType === 'Interval' && job.intervalMinutes ? ` (${job.intervalMinutes}m)` : ''}{job.scheduleType === 'Cron' && job.cronExpression ? ` (${job.cronExpression})` : ''}</span>
            <span>•</span>
            <span>Last: {timeAgo(job.lastRunAt)}</span>
            {job.nextRunAt && (
              <>
                <span>•</span>
                <span className="text-amber-500">Next: {timeAgo(job.nextRunAt)}</span>
              </>
            )}
          </div>
        </div>

        {/* stats */}
        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="text-center">
            <p className="font-bold text-gray-900 dark:text-white">{job.totalRuns}</p>
            <p className="text-gray-400">runs</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-emerald-500">{successPct}%</p>
            <p className="text-gray-400">success</p>
          </div>
          {job.lastRunDurationMs && (
            <div className="text-center">
              <p className="font-bold text-gray-900 dark:text-white">{formatDuration(job.lastRunDurationMs)}</p>
              <p className="text-gray-400">last</p>
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onTrigger}
            disabled={triggering || !job.isEnabled}
            className="p-2 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-30 transition-colors"
            title="Trigger now"
          >
            {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggle}
            className={`p-2 rounded-lg transition-colors ${
              job.isEnabled
                ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
            }`}
            title={job.isEnabled ? 'Disable' : 'Enable'}
          >
            {job.isEnabled ? <Pause className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          </button>
          <button onClick={onEdit} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Edit">
            <Settings2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onExpandRuns} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="View runs">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* last error */}
      {job.lastRunStatus === 'Failed' && job.lastRunError && (
        <div className="px-5 pb-3">
          <div className="text-xs bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{job.lastRunError}</span>
          </div>
        </div>
      )}

      {/* expanded run history */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Run History</h4>
              {runsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : runs.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No runs yet</p>
              ) : (
                <div className="space-y-1.5">
                  {runs.map((run) => (
                    <RunRow key={run.id} run={run} compact onCancel={run.status === 'Running' ? () => onCancelRun(run.id) : undefined} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Run Row ────────────────────────────────────────────────────
function RunRow({ run, compact, onCancel }: {
  run: AutomationJobRunDto; compact?: boolean; onCancel?: () => void
}) {
  return (
    <div className={`flex items-center gap-3 ${compact ? 'py-1.5' : 'px-5 py-3'} text-sm`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${RUN_STATUS_COLORS[run.status]}`} />
      {!compact && run.jobName && (
        <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[120px] truncate">{run.jobName}</span>
      )}
      <span className="text-gray-500 dark:text-gray-400 text-xs">
        {new Date(run.startedAt).toLocaleString()}
      </span>
      <span className="text-gray-400 text-xs">
        {formatDuration(run.durationMs)}
      </span>
      {run.triggerType && (
        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-[10px] uppercase">
          {run.triggerType}
        </span>
      )}
      {run.externalBuildUrl && (
        <a href={run.externalBuildUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      {run.errorMessage && (
        <span className="text-red-400 text-xs truncate max-w-[200px]" title={run.errorMessage}>{run.errorMessage}</span>
      )}
      <div className="flex-1" />
      {onCancel && (
        <button onClick={onCancel} className="text-xs text-red-400 hover:text-red-500">Cancel</button>
      )}
    </div>
  )
}

// ─── Create / Edit Modal ────────────────────────────────────────
function CreateJobModal({ job, onClose, onSuccess }: {
  job: AutomationJobDto | null; onClose: () => void; onSuccess: () => void
}) {
  const isEdit = !!job
  const [name, setName] = useState(job?.name || '')
  const [description, setDescription] = useState(job?.description || '')
  const [jobType, setJobType] = useState<AutomationJobType>(job?.jobType || 'BuildTrigger')
  const [scheduleType, setScheduleType] = useState<ScheduleType>(job?.scheduleType || 'Manual')
  const [cronExpression, setCronExpression] = useState(job?.cronExpression || '')
  const [intervalMinutes, setIntervalMinutes] = useState(job?.intervalMinutes || 30)
  const [configJson, setConfigJson] = useState(job?.configurationJson || '{}')
  const [maxRetries, setMaxRetries] = useState(job?.maxRetries || 0)
  const [retryDelay, setRetryDelay] = useState(job?.retryDelaySeconds || 60)
  const [notifyFail, setNotifyFail] = useState(job?.notifyOnFailure ?? true)
  const [notifySuc, setNotifySuc] = useState(job?.notifyOnSuccess ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await updateJob(job!.id, {
          name, description, scheduleType, cronExpression: scheduleType === 'Cron' ? cronExpression : undefined,
          intervalMinutes: scheduleType === 'Interval' ? intervalMinutes : undefined,
          configurationJson: configJson, maxRetries, retryDelaySeconds: retryDelay,
          notifyOnFailure: notifyFail, notifyOnSuccess: notifySuc,
        })
      } else {
        await createJob({
          name, description, jobType, scheduleType,
          cronExpression: scheduleType === 'Cron' ? cronExpression : undefined,
          intervalMinutes: scheduleType === 'Interval' ? intervalMinutes : undefined,
          configurationJson: configJson, maxRetries, retryDelaySeconds: retryDelay,
          notifyOnFailure: notifyFail, notifyOnSuccess: notifySuc,
        })
      }
      onSuccess()
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  const jobTypes: AutomationJobType[] = ['BuildTrigger', 'DataSync', 'ReleaseNotes', 'HealthCheck', 'Webhook', 'CacheRefresh', 'ReportGeneration']
  const scheduleTypes: ScheduleType[] = ['Manual', 'Interval', 'Cron', 'Event']

  // Config templates per job type
  const configTemplates: Record<AutomationJobType, string> = {
    BuildTrigger: JSON.stringify({ provider: "jenkins", connectionId: "", jobName: "", parameters: {} }, null, 2),
    DataSync: JSON.stringify({ connectionId: "", syncTypes: ["users", "areas", "iterations"] }, null, 2),
    ReleaseNotes: JSON.stringify({ configurationId: "" }, null, 2),
    HealthCheck: JSON.stringify({ url: "https://example.com/health", expectedStatus: 200, timeoutMs: 5000 }, null, 2),
    Webhook: JSON.stringify({ url: "https://example.com/webhook", method: "POST", headers: {}, body: {} }, null, 2),
    CacheRefresh: JSON.stringify({ scope: "all" }, null, 2),
    ReportGeneration: JSON.stringify({ reportType: "summary" }, null, 2),
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {isEdit ? 'Edit Job' : 'Create Automation Job'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name & Description */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                placeholder="e.g. Nightly Build Trigger"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Job Type (create only) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {jobTypes.map((jt) => {
                  const JIcon = JOB_TYPE_ICONS[jt]
                  return (
                    <button
                      key={jt}
                      onClick={() => { setJobType(jt); setConfigJson(configTemplates[jt]) }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        jobType === jt
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      <JIcon className="w-4 h-4" />
                      <span className="truncate">{JOB_TYPE_LABELS[jt]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule</label>
            <div className="flex gap-2 mb-3">
              {scheduleTypes.map((st) => (
                <button
                  key={st}
                  onClick={() => setScheduleType(st)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    scheduleType === st
                      ? 'bg-amber-500 text-white shadow'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {SCHEDULE_TYPE_LABELS[st]}
                </button>
              ))}
            </div>
            {scheduleType === 'Cron' && (
              <div>
                <input
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="0 0 * * * (every midnight)"
                />
                <p className="mt-1 text-xs text-gray-400">Standard cron: minute hour day month weekday</p>
              </div>
            )}
            {scheduleType === 'Interval' && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">minutes between runs</span>
              </div>
            )}
          </div>

          {/* Configuration JSON */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Configuration (JSON)</label>
            <textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>

          {/* Retry & Notification */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Retries</label>
              <input
                type="number"
                min={0}
                max={10}
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Retry Delay (sec)</label>
              <input
                type="number"
                min={5}
                value={retryDelay}
                onChange={(e) => setRetryDelay(parseInt(e.target.value) || 60)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={notifyFail} onChange={(e) => setNotifyFail(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Notify on failure</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={notifySuc} onChange={(e) => setNotifySuc(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Notify on success</span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg shadow font-medium text-sm disabled:opacity-50 hover:shadow-lg transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isEdit ? 'Save Changes' : 'Create Job'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
