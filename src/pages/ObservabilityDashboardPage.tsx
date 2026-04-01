import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Activity, AlertCircle, Loader2, Settings2, RefreshCw, Zap,
  CheckCircle2, XCircle, Clock, ArrowRight, Terminal, Heart,
  BarChart3, Shield, Server, GitBranch, Search, ChevronDown,
  Layers, PanelTop, ExternalLink, Play, AlertTriangle
} from 'lucide-react'
import clsx from 'clsx'
import {
  monitoringService,
  MonitoringDashboardStatus,
  LogEntry,
  MonitoringMetric,
  TraceEntry,
} from '../services/cloudService'

// Provider theme configuration
const PROVIDER_THEMES: Record<string, { gradient: string; accent: string; badge: string; bg: string; border: string }> = {
  dynatrace: {
    gradient: 'from-emerald-600 to-teal-600',
    accent: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  appinsights: {
    gradient: 'from-blue-600 to-indigo-600',
    accent: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  none: {
    gradient: 'from-gray-600 to-gray-700',
    accent: 'text-gray-400',
    badge: 'bg-gray-500/20 text-gray-300',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
  },
}

function getTheme(providerId: string) {
  return PROVIDER_THEMES[providerId] || PROVIDER_THEMES.none
}

// Time range options
const TIME_RANGES = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '4h', minutes: 240 },
  { label: '12h', minutes: 720 },
  { label: '24h', minutes: 1440 },
  { label: '7d', minutes: 10080 },
]

export default function ObservabilityDashboardPage() {
  const navigate = useNavigate()

  // Dashboard status
  const [status, setStatus] = useState<MonitoringDashboardStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [provisioning, setProvisioning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live data
  const [healthStatus, setHealthStatus] = useState<{ isHealthy: boolean; message: string | null } | null>(null)
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([])
  const [metrics, setMetrics] = useState<MonitoringMetric[]>([])
  const [traces, setTraces] = useState<TraceEntry[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [timeRange, setTimeRange] = useState(60)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // Load dashboard status
  const loadStatus = useCallback(async () => {
    try {
      setLoading(true)
      const data = await monitoringService.getDashboardStatus()
      setStatus(data)
    } catch (err) {
      setError('Failed to load monitoring status')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load live monitoring data
  const loadMonitoringData = useCallback(async () => {
    if (!status?.isProviderConfigured) return
    try {
      setLoadingData(true)
      const from = new Date(Date.now() - timeRange * 60000).toISOString()
      const to = new Date().toISOString()

      const [healthRes, logsRes, metricsRes, tracesRes] = await Promise.allSettled([
        monitoringService.healthCheck(),
        monitoringService.searchLogs(undefined, from, to, 20),
        monitoringService.getMetrics(undefined, from, to),
        monitoringService.getTraces(undefined, from, to),
      ])

      if (healthRes.status === 'fulfilled') setHealthStatus(healthRes.value)
      if (logsRes.status === 'fulfilled') setRecentLogs(logsRes.value.logs || [])
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.metrics || [])
      if (tracesRes.status === 'fulfilled') setTraces(tracesRes.value.traces || [])
      
      setLastRefresh(new Date())
    } catch {
      // partial failures are OK
    } finally {
      setLoadingData(false)
    }
  }, [status?.isProviderConfigured, timeRange])

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => { if (status?.isProviderConfigured) loadMonitoringData() }, [status?.isProviderConfigured, loadMonitoringData])

  // Auto-provision dashboard
  const handleProvisionDashboard = async (replaceExisting = false) => {
    try {
      setProvisioning(true)
      setError(null)
      await monitoringService.setupDashboard(replaceExisting)
      await loadStatus()
      await loadMonitoringData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to provision dashboard'
      setError(msg)
    } finally {
      setProvisioning(false)
    }
  }

  const theme = getTheme(status?.providerId || 'none')

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Loading monitoring status...</p>
        </div>
      </div>
    )
  }

  // No provider configured
  if (!status?.isProviderConfigured) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Activity className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">No Monitoring Provider Configured</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Configure Azure App Insights, Dynatrace, or another monitoring provider in Tenant Admin to enable the observability dashboard.
          </p>
          <button onClick={() => navigate('/tenant-admin')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">
            <Settings2 className="w-5 h-5" />
            Go to Tenant Admin
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={clsx('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center', theme.gradient)}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Observability Dashboard</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', theme.badge)}>
                  <Zap className="w-3 h-3" /> {status.provider}
                </span>
                <span className="text-xs text-gray-400 uppercase tracking-wide">{status.queryLanguage}</span>
                {healthStatus && (
                  <span className={clsx('inline-flex items-center gap-1 text-xs',
                    healthStatus.isHealthy ? 'text-green-600' : 'text-red-500'
                  )}>
                    {healthStatus.isHealthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {healthStatus.isHealthy ? 'Healthy' : 'Degraded'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Time range selector */}
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value))}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 hover:border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TIME_RANGES.map(tr => (
                  <option key={tr.minutes} value={tr.minutes}>{tr.label}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button onClick={loadMonitoringData} disabled={loadingData}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={clsx('w-4 h-4', loadingData && 'animate-spin')} />
              Refresh
            </button>

            <button onClick={() => navigate('/observability-query')}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <Terminal className="w-4 h-4" />
              Query Explorer
            </button>
          </div>
        </div>

        {lastRefresh && (
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Last refreshed: {lastRefresh.toLocaleTimeString()}
          </p>
        )}
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">×</button>
        </motion.div>
      )}

      {/* Setup Banner — if dashboard not provisioned yet */}
      {!status.isDashboardProvisioned && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={clsx('mb-6 p-6 rounded-2xl border', theme.border, theme.bg)}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={clsx('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0', theme.gradient)}>
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Auto-Provision {status.provider} Dashboard</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Create a monitoring dashboard with {status.availableTemplateCount} pre-configured {status.queryLanguage} widgets
                  tailored for {status.provider}. Includes performance metrics, error tracking, logs, and infrastructure monitoring.
                </p>
              </div>
            </div>
            <button onClick={() => handleProvisionDashboard(false)} disabled={provisioning}
              className={clsx('inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium transition-all',
                'bg-gradient-to-r', theme.gradient, 'hover:shadow-lg disabled:opacity-50 flex-shrink-0')}>
              {provisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {provisioning ? 'Provisioning...' : 'Setup Dashboard'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Dashboard provisioned — show link to dynamic page */}
      {status.isDashboardProvisioned && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">
                {status.provider} dashboard active with {status.widgetCount} widgets
              </p>
              <p className="text-xs text-green-600">{status.pageDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/p/${status.pageSlug}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <PanelTop className="w-3.5 h-3.5" /> Open Dashboard
              <ExternalLink className="w-3 h-3" />
            </button>
            <button onClick={() => handleProvisionDashboard(true)} disabled={provisioning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={clsx('w-3.5 h-3.5', provisioning && 'animate-spin')} />
              Reprovision
            </button>
          </div>
        </motion.div>
      )}

      {/* Live Monitoring Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Health Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold text-gray-700">Health</h3>
            </div>
            {healthStatus && (
              <span className={clsx('w-3 h-3 rounded-full', healthStatus.isHealthy ? 'bg-green-500' : 'bg-red-500')} />
            )}
          </div>
          <p className={clsx('text-2xl font-bold', healthStatus?.isHealthy ? 'text-green-600' : 'text-red-600')}>
            {healthStatus ? (healthStatus.isHealthy ? 'Healthy' : 'Degraded') : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{healthStatus?.message || 'Checking...'}</p>
        </motion.div>

        {/* Logs Count */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-700">Recent Logs</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{recentLogs.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {recentLogs.filter(l => l.level === 'Error' || l.level === 'ERROR').length} errors in last {TIME_RANGES.find(t => t.minutes === timeRange)?.label || `${timeRange}m`}
          </p>
        </motion.div>

        {/* Metrics Count */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-700">Metrics</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{metrics.length}</p>
          <p className="text-xs text-gray-400 mt-1">Active metric streams</p>
        </motion.div>

        {/* Traces Count */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-teal-500" />
            <h3 className="text-sm font-semibold text-gray-700">Traces</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{traces.length}</p>
          <p className="text-xs text-gray-400 mt-1">
            {traces.filter(t => !t.success).length} failures detected
          </p>
        </motion.div>
      </div>

      {/* Three-Column Layout: Logs, Metrics, Traces */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent Logs */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-gray-800">Recent Logs</h3>
            </div>
            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500">{recentLogs.length}</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {recentLogs.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No logs in selected time range
                </div>
              ) : (
                recentLogs.map((log, i) => (
                  <motion.div key={log.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-2">
                      <LogLevelBadge level={log.level} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{log.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Metrics */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              <h3 className="font-semibold text-gray-800">Metrics</h3>
            </div>
            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500">{metrics.length}</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {metrics.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No metrics available
              </div>
            ) : (
              metrics.map((m, i) => (
                <div key={i} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{m.name}</span>
                    <span className="text-sm font-mono font-bold text-purple-600">
                      {typeof m.value === 'number' ? m.value.toFixed(2) : m.value} {m.unit}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(m.timestamp).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Traces */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-teal-500" />
              <h3 className="font-semibold text-gray-800">Distributed Traces</h3>
            </div>
            <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500">{traces.length}</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {traces.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                <GitBranch className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                No traces in selected time range
              </div>
            ) : (
              traces.map((t, i) => (
                <div key={t.operationId || i} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800 truncate mr-2">{t.name}</span>
                    <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', t.success ? 'bg-green-500' : 'bg-red-500')} />
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{new Date(t.timestamp).toLocaleString()}</span>
                    <span className="text-xs font-mono text-gray-500">{t.durationMs}ms</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickActionCard
          icon={Terminal} label="Query Explorer" description={`Write ${status.queryLanguage} queries`}
          onClick={() => navigate('/observability-query')} theme={theme}
        />
        <QuickActionCard
          icon={PanelTop} label="Dashboard Builder" description="Customize widget layout"
          onClick={() => navigate(status.isDashboardProvisioned ? `/p/${status.pageSlug}` : '/dashboard')} theme={theme}
        />
        <QuickActionCard
          icon={Shield} label="Health Check" description="Verify provider connectivity"
          onClick={loadMonitoringData} theme={theme}
        />
        <QuickActionCard
          icon={Settings2} label="Provider Settings" description="Configure adapter settings"
          onClick={() => navigate('/tenant-admin')} theme={theme}
        />
      </motion.div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function LogLevelBadge({ level }: { level: string }) {
  const normalized = level?.toUpperCase() || 'INFO'
  const config: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
    ERROR: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
    WARN: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
    WARNING: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
    INFO: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Activity },
    DEBUG: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Server },
  }
  const c = config[normalized] || config.INFO
  const Icon = c.icon
  return (
    <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0', c.bg, c.text)}>
      <Icon className="w-3 h-3" /> {normalized}
    </span>
  )
}

function QuickActionCard({ icon: Icon, label, description, onClick, theme }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  onClick: () => void
  theme: { gradient: string; accent: string }
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all text-left group">
      <div className={clsx('w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0', theme.gradient)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-500 transition-colors" />
    </button>
  )
}
