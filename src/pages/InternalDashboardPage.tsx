import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLazyWidget } from '../hooks/useLazyWidget';
import { usePersistentChat } from '../context/PersistentChatContext';
import { useInternalDashboardHub } from '../hooks/useInternalDashboardHub';
import {
  getSummary, getBranches, getPRSummary, getCommitStats, getTodayBuilds,
  getKnowledgeShares, getProductionSupport, getApiCatalog,
  getCustomersOverview, addKnowledgeShare, addApiCatalogEntry,
  uploadFile, downloadTemplate, removeKnowledgeShare, removeApiCatalogEntry,
  getDashboardConfig, updateDashboardConfig, resetDashboardConfig, parseWidgets, parseMetrics,
  getSeverityColor, getStatusColor, getJenkinsBuilds, getJenkinsBuildDetail,
  type DashboardSummary, type BuildInfo, type BranchesResponse,
  type PRSummaryResponse, type CommitStatsResponse, type BirthdayInfo,
  type KnowledgeShareInfo, type ProductionSupportResponse, type ApiCatalogInfo,
  type CustomersOverviewResponse, type WidgetConfig, type MetricConfig,
  type JenkinsBuildsResponse, type JenkinsBuildDetailResponse, type PRInfo, type CommitInfo,
  type TodayBuildsResponse,
} from '../services/internalDashboardService';
import { AdvancedPRListModal } from '../components/AdvancedPRListModal';
import { WidgetConfigModal } from '../components/WidgetConfigModal';

// ── Admin View Context - Controls visibility of admin features ───────────────
const AdminViewContext = createContext<boolean>(true);
const useAdminView = () => useContext(AdminViewContext);

// ── Template card definitions ────────────────────────────────────────────────
interface DashboardTemplate {
  key: string;
  label: string;
  sub: string;
  icon: string;
  gradient: string;
  border: string;
  route?: string; // external route — navigates away
}

const TEMPLATES: DashboardTemplate[] = [
  { key: 'internal', label: 'Internal Dashboard', sub: 'Team hub — DevOps · Jenkins · Excel', icon: '🚀', gradient: 'from-indigo-500 to-blue-600', border: 'border-indigo-200 dark:border-indigo-800' },
  { key: 'customers', label: 'Customer Intelligence', sub: 'Customer portfolio & deployment overview', icon: '🏢', gradient: 'from-emerald-500 to-teal-600', border: 'border-emerald-200 dark:border-emerald-800', route: '/' },
  { key: 'quality', label: 'Quality Dashboard', sub: 'Bugs, releases & sprint metrics', icon: '🐛', gradient: 'from-red-500 to-orange-600', border: 'border-red-200 dark:border-red-800', route: '/quality' },
  { key: 'bug-analytics', label: 'Bug Analytics', sub: 'Deep drill-down by area & user', icon: '🔬', gradient: 'from-orange-500 to-red-500', border: 'border-orange-200 dark:border-orange-800', route: '/bug-analytics' },
  { key: 'engineering', label: 'Engineering', sub: 'Velocity, pipelines & health', icon: '⚙️', gradient: 'from-violet-500 to-purple-600', border: 'border-violet-200 dark:border-violet-800', route: '/engineering' },
  { key: 'observability', label: 'Observability', sub: 'App Insights & log explorer', icon: '📡', gradient: 'from-cyan-500 to-blue-600', border: 'border-cyan-200 dark:border-cyan-800', route: '/observability' },
];

// ── Helper: Get first name from display names like "N.J, Deepika Shree" ────────
function getFirstName(fullName: string | undefined): string {
  if (!fullName) return 'Unknown';
  // Format like "N.J, Deepika Shree" - take first word after comma
  const parts = fullName.split(',');
  if (parts.length > 1) {
    const namePart = parts[1].trim().split(' ')[0];
    return namePart || parts[0].trim();
  }
  // Otherwise take first word
  return fullName.split(' ')[0] || fullName;
}

// ── Helper: Get PR URL (prefer webUrl for browser-friendly link) ─────────────
function getPrUrl(pr: { url?: string; webUrl?: string }): string {
  return pr.webUrl || pr.url || '#';
}

// ─────────────────────────────────────────
// Main Page Props
// ─────────────────────────────────────────
interface InternalDashboardProps {
  /** When false, hides admin features (upload, templates, edit config, remove buttons). Default: true */
  isAdminView?: boolean;
}

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────

export default function InternalDashboardPage({ isAdminView = true }: InternalDashboardProps) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [metrics, setMetrics] = useState<MetricConfig[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvancedPRModal, setShowAdvancedPRModal] = useState(false);
  const [prModalData, setPrModalData] = useState<PRSummaryResponse | null>(null);
  const [prModalLoading, setPrModalLoading] = useState(false);
  const hubTriedRef = useRef(false);

  // ── Real-time PR & Commit Stats (fetched directly from dedicated endpoints) ──
  const [realTimePRData, setRealTimePRData] = useState<PRSummaryResponse | null>(null);
  const [realTimeCommitData, setRealTimeCommitData] = useState<CommitStatsResponse | null>(null);
  const [realTimeBuildsData, setRealTimeBuildsData] = useState<TodayBuildsResponse | null>(null);
  const [daysFilter, setDaysFilter] = useState(7);
  
  // ── Metric Detail Modal State ──
  const [metricDetailModal, setMetricDetailModal] = useState<{
    type: 'prs' | 'commits' | 'builds' | 'tickets' | null;
    title: string;
  }>({ type: null, title: '' });
  
  // ── Commit Detail Modal State ──
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [showCommitDetailModal, setShowCommitDetailModal] = useState(false);
  
  // ── PR Detail Popup State ──
  const [selectedPRForDetail, setSelectedPRForDetail] = useState<PRInfo | null>(null);

  // ── Jenkins Build Detail Modal State ──
  const [selectedJenkinsBuild, setSelectedJenkinsBuild] = useState<{ jobPath: string; buildNumber: number } | null>(null);
  const [jenkinsBuildDetail, setJenkinsBuildDetail] = useState<JenkinsBuildDetailResponse | null>(null);
  const [jenkinsBuildLoading, setJenkinsBuildLoading] = useState(false);

  // ── Widget Config Modal State ──
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);

  // SignalR streaming hub — sends data section by section (db → devops → jenkins)
  const hub = useInternalDashboardHub({
    onSectionLoaded: () => {
      // Each section arriving clears the loading state so UI renders progressively
      setSummaryLoading(false);
    },
  });

  // Keep summary in sync with hub data
  useEffect(() => {
    if (hub.summary) setSummary(hub.summary);
  }, [hub.summary]);

  // Load config + summary on mount (SignalR primary, HTTP fallback)
  const loadInitial = useCallback(async () => {
    setSummaryLoading(true);
    setError('');
    try {
      // Load dashboard config via REST (always fast)
      const cfgRes = await getDashboardConfig().catch(() => null);
      if (cfgRes) {
        setWidgets(parseWidgets(cfgRes.widgets));
        setMetrics(parseMetrics(cfgRes.metrics));
      }
      setConfigLoaded(true);
    } catch { /* ignore */ }

    // Try SignalR streaming first — if connected, stream; else HTTP fallback
    if (hub.isConnected && !hubTriedRef.current) {
      hubTriedRef.current = true;
      hub.streamSummary();
    } else if (!hub.isConnected) {
      // HTTP fallback with timeout
      try {
        const s = await getSummary();
        setSummary(s);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load dashboard';
        setError(msg);
      } finally {
        setSummaryLoading(false);
      }
    }
  }, [hub.isConnected]);

  // Once hub connects, start streaming if we haven't loaded yet
  useEffect(() => {
    if (hub.isConnected && !hubTriedRef.current && !summary) {
      hubTriedRef.current = true;
      hub.streamSummary();
    }
  }, [hub.isConnected, summary]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // ── Load real-time PR, Commit, and Builds stats from dedicated endpoints ──
  const loadRealTimeStats = useCallback(async () => {
    try {
      const [prData, commitData, buildsData] = await Promise.all([
        getPRSummary().catch(() => null),
        getCommitStats(undefined, daysFilter).catch(() => null),
        getTodayBuilds().catch(() => null)
      ]);
      if (prData) setRealTimePRData(prData);
      if (commitData) setRealTimeCommitData(commitData);
      if (buildsData) setRealTimeBuildsData(buildsData);
    } catch (err) {
      console.error('[loadRealTimeStats] Failed:', err);
    }
  }, [daysFilter]);

  useEffect(() => {
    loadRealTimeStats();
  }, [loadRealTimeStats]);

  // ── Refresh stats when days filter changes ──
  useEffect(() => {
    if (daysFilter) {
      getCommitStats(undefined, daysFilter)
        .then(data => setRealTimeCommitData(data))
        .catch(() => {});
    }
  }, [daysFilter]);

  // ── Fetch Jenkins build details when selected ──
  useEffect(() => {
    if (selectedJenkinsBuild) {
      setJenkinsBuildLoading(true);
      setJenkinsBuildDetail(null);
      getJenkinsBuildDetail(selectedJenkinsBuild.jobPath, selectedJenkinsBuild.buildNumber)
        .then(data => {
          setJenkinsBuildDetail(data);
        })
        .catch(err => {
          console.error('[JenkinsBuildDetail] Failed:', err);
          setJenkinsBuildDetail({ error: 'Failed to load build details' } as JenkinsBuildDetailResponse);
        })
        .finally(() => setJenkinsBuildLoading(false));
    }
  }, [selectedJenkinsBuild]);

  const refreshSummary = useCallback(async () => {
    setSummaryLoading(true);
    setError('');
    if (hub.isConnected) {
      hub.streamSummary();
    } else {
      try {
        const s = await getSummary();
        setSummary(s);
      } catch { /* ignore */ }
      finally { setSummaryLoading(false); }
    }
  }, [hub.isConnected, hub.streamSummary]);

  const handleReset = useCallback(async () => {
    try {
      const cfg = await resetDashboardConfig();
      setWidgets(parseWidgets(cfg.widgets));
      setMetrics(parseMetrics(cfg.metrics));
      setEditMode(false);
    } catch { /* ignore */ }
  }, []);

  const handleSaveConfig = useCallback(async () => {
    setSaving(true);
    try {
      await updateDashboardConfig({
        widgets: JSON.stringify(widgets),
        metrics: JSON.stringify(metrics),
      });
      setEditMode(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [widgets, metrics]);

  // Fetch PRs when modal opens
  const openPRModal = useCallback(async () => {
    setShowAdvancedPRModal(true);
    if (!prModalData) {
      setPrModalLoading(true);
      try {
        const data = await getPRSummary();
        setPrModalData(data);
      } catch (err) {
        console.error('[openPRModal] Failed to fetch PRs:', err);
      } finally {
        setPrModalLoading(false);
      }
    }
  }, [prModalData]);

  const refreshPRModal = useCallback(async () => {
    setPrModalLoading(true);
    try {
      const data = await getPRSummary();
      setPrModalData(data);
    } catch (err) {
      console.error('[refreshPRModal] Failed to refresh PRs:', err);
    } finally {
      setPrModalLoading(false);
    }
  }, []);

  const toggleWidget = useCallback((key: string) => {
    setWidgets(prev => prev.map(w => w.key === key ? { ...w, enabled: !w.enabled } : w));
  }, []);

  const toggleMetric = useCallback((key: string) => {
    setMetrics(prev => prev.map(m => m.key === key ? { ...m, enabled: !m.enabled } : m));
  }, []);

  // Save individual widget configuration updates
  const handleSaveWidgetConfig = useCallback((updatedWidget: WidgetConfig) => {
    setWidgets(prev => prev.map(w => w.key === updatedWidget.key ? updatedWidget : w));
    setEditingWidget(null);
  }, []);

  // Group widgets by column
  const columns = useMemo(() => {
    const enabled = widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order);
    const cols: WidgetConfig[][] = [[], [], []];
    enabled.forEach(w => {
      const col = Math.min(w.column, 2);
      cols[col].push(w);
    });
    return cols;
  }, [widgets]);

  const enabledMetrics = useMemo(
    () => metrics.filter(m => m.enabled).sort((a, b) => a.order - b.order),
    [metrics]
  );

  const d = summary?.devops;
  const j = summary?.jenkins;

  return (
    <AdminViewContext.Provider value={isAdminView}>
    <div className="p-4 lg:p-6 max-w-[1800px] mx-auto space-y-5">
      {/* ── Overview Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {isAdminView ? 'Choose a dashboard or customize your view below' : 'Your unified dashboard overview'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary?.generatedAt && (
            <span className="text-[10px] text-gray-400">
              {new Date(summary.generatedAt).toLocaleTimeString()}
            </span>
          )}
          {/* Customize button - admin only */}
          {isAdminView && (
            <button onClick={() => setEditMode(!editMode)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${editMode
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              {editMode ? '✏️ Editing' : '⚙️ Customize'}
            </button>
          )}
          <button onClick={loadInitial} disabled={summaryLoading}
            className="text-xs px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {summaryLoading ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* ── Template Cards — quick-switch dashboards (admin only) ── */}
      {isAdminView && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {TEMPLATES.map(t => (
          <button key={t.key}
            onClick={() => t.route ? navigate(t.route) : undefined}
            className={`relative group text-left rounded-xl border p-3 transition-all hover:shadow-md hover:-translate-y-0.5 ${
              !t.route
                ? `ring-2 ring-indigo-500 ${t.border} bg-white dark:bg-gray-800`
                : `${t.border} bg-white dark:bg-gray-800 hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600`
            }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{t.icon}</span>
              {!t.route && (
                <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">Active</span>
              )}
            </div>
            <div className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{t.label}</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{t.sub}</div>
            {/* Gradient accent bar */}
            <div className={`absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r ${t.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
          </button>
        ))}
      </div>}

      {/* ── Data Source Status Bar ── */}
      <div className="flex items-center gap-3 text-[10px]">
        <span className="font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data Sources:</span>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full ${d?.connected ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${d?.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
          Azure DevOps {d?.connected ? '✓' : '—'}
        </span>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full ${j?.connected ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${j?.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
          Jenkins {j?.connected ? '✓' : '—'}
        </span>
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Excel Data
        </span>
      </div>

      {/* ── Edit Mode: Widget/Metric Config Panel (admin only) ── */}
      {isAdminView && editMode && (
        <div className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">Customize Dashboard</h3>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">Toggle widgets and metrics on/off. Changes save per-tenant.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleReset}
                className="text-[10px] px-2.5 py-1.5 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-800">
                Reset to Default
              </button>
              <button onClick={handleSaveConfig} disabled={saving}
                className="text-[10px] px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Metrics toggles */}
          <div>
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Top Metrics</p>
            <div className="flex flex-wrap gap-2">
              {metrics.map(m => (
                <button key={m.key} onClick={() => toggleMetric(m.key)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${m.enabled
                    ? 'bg-white dark:bg-gray-800 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 font-medium shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 line-through'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Widget toggles */}
          <div>
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Widgets (click to toggle, ⚙️ to configure)</p>
            <div className="flex flex-wrap gap-2">
              {widgets.map(w => (
                <div key={w.key} className="flex items-center">
                  <button onClick={() => toggleWidget(w.key)}
                    className={`text-[10px] px-2.5 py-1.5 rounded-l-lg border-y border-l transition-all flex items-center gap-1 ${w.enabled
                      ? 'bg-white dark:bg-gray-800 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 font-medium shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 line-through'
                    }`}>
                    <span>{w.icon}</span> {w.title}
                  </button>
                  <button 
                    onClick={() => setEditingWidget(w)}
                    className="text-[10px] px-1.5 py-1.5 rounded-r-lg border border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/50"
                    title="Configure widget"
                  >
                    ⚙️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Row 1: Key Metrics (config-driven) with Real-time Data ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryLoading && !realTimePRData && !realTimeCommitData && !realTimeBuildsData ? (
          Array.from({ length: 6 }).map((_, i) => <MetricSkeleton key={i} />)
        ) : (
          enabledMetrics.map(m => (
            <ClickableMetric
              key={m.key}
              config={m}
              summary={summary}
              prData={realTimePRData}
              commitData={realTimeCommitData}
              buildsData={realTimeBuildsData}
              daysFilter={daysFilter}
              onClick={(type) => setMetricDetailModal({ type, title: m.label })}
            />
          ))
        )}
      </div>

      {/* ── Days Filter Control ── */}
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 w-fit">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Time Range:</span>
        {[7, 14, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setDaysFilter(d)}
            className={`text-[10px] px-2 py-1 rounded ${daysFilter === d
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {d}d
          </button>
        ))}
        <button
          onClick={loadRealTimeStats}
          className="text-[10px] px-2 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Refresh stats"
        >
          🔄
        </button>
      </div>

      {/* ── Row 2: Jenkins + Build Success ── */}
      {(j?.connected || d?.connected) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {d?.connected && <>
            <Metric label="Repositories" value={d.totalRepositories ?? 0} color="slate" />
            <Metric label="Pipelines" value={d.activePipelines ?? 0} color="indigo" />
            <Metric label="Build Success" value={`${(d.buildSuccessRate ?? 0).toFixed(0)}%`} sub={`Avg ${(d.avgBuildTimeMinutes ?? 0).toFixed(1)} min`} color="green" />
          </>}
          {j?.connected && <>
            <Metric label="Jenkins Jobs" value={j.totalJobs ?? 0} sub={`${j.failedJobs ?? 0} failed`} color={j.failedJobs ? 'red' : 'green'} />
            <Metric label="Jenkins 24h" value={j.buildsLast24h ?? 0} sub={`${j.buildingJobs ?? 0} building`} color="blue" />
            <Metric label="Jenkins Nodes" value={`${j.onlineNodes ?? 0}/${j.totalNodes ?? 0}`} sub={`Health: ${j.healthScore ?? 0}%`} color="teal" />
          </>}
        </div>
      )}

      {/* ── Row 3: Config-driven Widget Grid with Lazy Loading ── */}
      {configLoaded && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {columns.map((col, ci) => (
            <div key={ci} className="space-y-4">
              {col.map(w => (
                <LazyWidgetRenderer
                  key={w.key}
                  config={w}
                  summary={summary}
                  expandedWidget={expandedWidget}
                  setExpandedWidget={setExpandedWidget}
                  onRefresh={refreshSummary}
                  onViewAllPRs={openPRModal}
                  onViewAllCommits={() => setShowCommitDetailModal(true)}
                  onBuildClick={(jobPath, buildNumber) => setSelectedJenkinsBuild({ jobPath, buildNumber })}
                  commitData={realTimeCommitData}
                  buildsData={realTimeBuildsData}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Advanced PR List Modal */}
      <AdvancedPRListModal
        prs={prModalData?.prs?.map(pr => ({
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
        isOpen={showAdvancedPRModal}
        onClose={() => setShowAdvancedPRModal(false)}
        onRefresh={refreshPRModal}
        isLoading={prModalLoading}
        title="All Pull Requests"
      />

      {/* Advanced Commit List Modal */}
      {showCommitDetailModal && (
        <CommitListModal
          data={realTimeCommitData}
          isOpen={showCommitDetailModal}
          onClose={() => setShowCommitDetailModal(false)}
          onViewCommitDetail={setSelectedCommit}
        />
      )}

      {/* ── Metric Detail Modal ── */}
      {metricDetailModal.type && (
        <MetricDetailModal
          type={metricDetailModal.type}
          title={metricDetailModal.title}
          prData={realTimePRData}
          commitData={realTimeCommitData}
          buildsData={realTimeBuildsData}
          summary={summary}
          onClose={() => setMetricDetailModal({ type: null, title: '' })}
          onViewPRDetail={(pr) => {
            setMetricDetailModal({ type: null, title: '' });
            setSelectedPRForDetail(pr);
          }}
          onViewCommitDetail={(commit) => {
            setMetricDetailModal({ type: null, title: '' });
            setSelectedCommit(commit);
          }}
        />
      )}

      {/* ── PR Detail Popup ── */}
      {selectedPRForDetail && (
        <PRDetailPopup
          pr={selectedPRForDetail}
          onClose={() => setSelectedPRForDetail(null)}
        />
      )}

      {/* ── Commit Detail Popup ── */}
      {selectedCommit && (
        <CommitDetailPopup
          commit={selectedCommit}
          onClose={() => setSelectedCommit(null)}
        />
      )}

      {/* ── Jenkins Build Detail Modal ── */}
      {selectedJenkinsBuild && (
        <JenkinsBuildDetailModal
          detail={jenkinsBuildDetail}
          loading={jenkinsBuildLoading}
          onClose={() => {
            setSelectedJenkinsBuild(null);
            setJenkinsBuildDetail(null);
          }}
        />
      )}

      {/* ── Widget Config Modal ── */}
      <WidgetConfigModal
        isOpen={!!editingWidget}
        widget={editingWidget}
        onClose={() => setEditingWidget(null)}
        onSave={handleSaveWidgetConfig}
      />
    </div>
    </AdminViewContext.Provider>
  );
}

// ─────────────────────────────────────────
// Clickable Metric with Real-time Data (Enhanced)
// ─────────────────────────────────────────

function ClickableMetric({ 
  config, 
  summary, 
  prData, 
  commitData,
  buildsData,
  daysFilter,
  onClick 
}: { 
  config: MetricConfig; 
  summary: DashboardSummary | null;
  prData: PRSummaryResponse | null;
  commitData: CommitStatsResponse | null;
  buildsData: TodayBuildsResponse | null;
  daysFilter: number;
  onClick: (type: 'prs' | 'commits' | 'builds' | 'tickets') => void;
}) {
  const d = summary?.devops;
  
  // Metric icons for better visual
  const icons: Record<string, string> = {
    openPRs: '🔃',
    todayBuilds: '🏗️',
    commits7d: '📊',
    prWaiting: '⏳',
    customers: '🏢',
    openIncidents: '🚨',
  };
  
  // Use real-time data for PRs and commits
  const map: Record<string, { value: string | number; sub?: string; dynColor?: string; clickType?: 'prs' | 'commits' | 'builds' | 'tickets'; trend?: 'up' | 'down' | 'neutral' }> = {
    openPRs:       { 
      value: prData?.totalActive ?? d?.openPRs ?? '—', 
      sub: prData ? `${prData.waitingApproval} waiting · ${prData.approved} approved` : (d?.connected ? `${d.prsWaitingApproval} waiting` : 'Not connected'),
      clickType: 'prs',
      dynColor: (prData?.waitingApproval || 0) > 5 ? 'orange' : 'purple'
    },
    todayBuilds:   { 
      value: buildsData?.total ?? d?.todayBuilds?.total ?? '—', 
      sub: buildsData ? `✅ ${buildsData.succeeded} · ❌ ${buildsData.failed} · ⏳ ${buildsData.inProgress}` : (d?.todayBuilds ? `✅ ${d.todayBuilds.succeeded} · ❌ ${d.todayBuilds.failed}` : undefined), 
      dynColor: (buildsData?.failed || d?.todayBuilds?.failed) ? 'red' : 'green',
      clickType: 'builds'
    },
    commits7d:     { 
      value: commitData?.totalCommits ?? d?.totalCommits ?? '—', 
      sub: commitData ? `👥 ${commitData.byAuthor?.length || 0} authors · ${daysFilter}d` : (d?.commitsToday ? `${d.commitsToday} today` : undefined),
      clickType: 'commits'
    },
    prWaiting:     { 
      value: prData?.waitingApproval ?? d?.prsWaitingApproval ?? '—',
      sub: prData ? `📝 ${prData.drafts} drafts · 🔃 ${prData.totalActive} open` : undefined,
      clickType: 'prs',
      dynColor: (prData?.waitingApproval || 0) > 3 ? 'red' : 'orange'
    },
    customers:     { value: summary?.customers?.total ?? 0, sub: 'Total active customers' },
    openIncidents: { 
      value: summary?.support?.openIncidents ?? 0, 
      dynColor: (summary?.support?.openIncidents || 0) > 0 ? 'red' : 'green',
      clickType: 'tickets',
      sub: (summary?.support?.openIncidents || 0) > 0 ? 'Click to view details' : 'All clear!'
    },
  };
  const entry = map[config.key] || { value: '—' };
  const icon = icons[config.key] || '📊';
  
  return (
    <div 
      onClick={() => entry.clickType && onClick(entry.clickType)}
      className={`relative p-3 rounded-xl border-2 transition-all duration-200 ${entry.clickType ? 'cursor-pointer hover:shadow-lg hover:scale-[1.03] hover:-translate-y-0.5' : ''} ${getMetricBg(entry.dynColor || config.color)}`}
    >
      {/* Icon Badge */}
      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white dark:bg-gray-800 border-2 border-current flex items-center justify-center text-sm shadow-sm">
        {icon}
      </div>
      
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{config.label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{entry.value}</p>
      {entry.sub && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{entry.sub}</p>}
      
      {/* Click Indicator */}
      {entry.clickType && (
        <div className="absolute bottom-1.5 right-2 text-[8px] text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          <span>Details</span>
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}

function getMetricBg(color: string): string {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-600',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-600',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-600',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-600',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 text-indigo-600',
    teal: 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 text-teal-600',
    slate: 'bg-slate-50 dark:bg-slate-900/20 border-slate-300 dark:border-slate-600 text-slate-600',
  };
  return bg[color] || bg.blue;
}

// ─────────────────────────────────────────
// Metric Detail Modal
// ─────────────────────────────────────────

function MetricDetailModal({
  type,
  title,
  prData,
  commitData,
  buildsData,
  summary,
  onClose,
  onViewPRDetail,
  onViewCommitDetail
}: {
  type: 'prs' | 'commits' | 'builds' | 'tickets';
  title: string;
  prData: PRSummaryResponse | null;
  commitData: CommitStatsResponse | null;
  buildsData: TodayBuildsResponse | null;
  summary: DashboardSummary | null;
  onClose: () => void;
  onViewPRDetail: (pr: PRInfo) => void;
  onViewCommitDetail: (commit: CommitInfo) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title} - Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">×</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {type === 'prs' && prData && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{prData.totalActive}</p>
                  <p className="text-[10px] text-gray-500">Active PRs</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{prData.waitingApproval}</p>
                  <p className="text-[10px] text-gray-500">Waiting Approval</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{prData.approved}</p>
                  <p className="text-[10px] text-gray-500">Approved</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{prData.drafts}</p>
                  <p className="text-[10px] text-gray-500">Drafts</p>
                </div>
              </div>
              
              {/* PR List */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Pull Requests ({prData.prs.length})</h3>
                <div className="max-h-96 overflow-y-auto space-y-1">
                  {prData.prs.slice(0, 50).map(pr => (
                    <div 
                      key={pr.pullRequestId} 
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => onViewPRDetail(pr)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${pr.isApproved ? 'bg-green-100 text-green-700' : pr.isDraft ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'}`}>
                            {pr.isApproved ? '✓ Approved' : pr.isDraft ? 'Draft' : 'Pending'}
                          </span>
                          <span className="text-[10px] text-gray-400">#{pr.pullRequestId}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{pr.title}</p>
                        <p className="text-[10px] text-gray-500">{pr.sourceBranch.replace('refs/heads/', '')} → {pr.targetBranch.replace('refs/heads/', '')}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-[10px] text-gray-500">{pr.createdBy}</p>
                        <p className="text-[10px] text-gray-400">{new Date(pr.creationDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {type === 'commits' && commitData && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{commitData.totalCommits}</p>
                  <p className="text-[10px] text-gray-500">Total Commits</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{commitData.byAuthor?.length || 0}</p>
                  <p className="text-[10px] text-gray-500">Authors</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{commitData.totalChanges?.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500">Lines Changed</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{commitData.repoCount}</p>
                  <p className="text-[10px] text-gray-500">Repositories</p>
                </div>
              </div>
              
              {/* By Author */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Commits by Author</h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {commitData.byAuthor?.slice(0, 15).map(a => (
                    <div key={a.author} className="flex items-center gap-2">
                      <span className={`w-32 text-xs truncate ${a.isCurrentUser ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {a.author} {a.isCurrentUser && '(You)'}
                      </span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min((a.commits / (commitData.byAuthor[0]?.commits || 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-gray-500 w-16 text-right">{a.commits} commits</span>
                      <span className="text-[10px] text-gray-400 w-16 text-right">{a.changes?.toLocaleString()} Δ</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Recent Commits */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Commits</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {commitData.recentCommits?.slice(0, 20).map(c => (
                    <div 
                      key={c.shortCommitId} 
                      className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      onClick={() => onViewCommitDetail(c)}
                    >
                      <span className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0">{c.shortCommitId}</span>
                      <span className="text-xs text-gray-800 dark:text-gray-200 flex-1 truncate">{c.comment}</span>
                      <span className="text-[10px] text-gray-500 shrink-0">{c.authorName?.split(' ')[0]}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{new Date(c.authorDate).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {type === 'builds' && (buildsData || summary?.devops?.todayBuilds) && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{buildsData?.total ?? summary?.devops?.todayBuilds?.total ?? 0}</p>
                  <p className="text-[10px] text-gray-500">Total Builds</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{buildsData?.succeeded ?? summary?.devops?.todayBuilds?.succeeded ?? 0}</p>
                  <p className="text-[10px] text-gray-500">Succeeded</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{buildsData?.failed ?? summary?.devops?.todayBuilds?.failed ?? 0}</p>
                  <p className="text-[10px] text-gray-500">Failed</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{buildsData?.inProgress ?? summary?.devops?.todayBuilds?.inProgress ?? 0}</p>
                  <p className="text-[10px] text-gray-500">In Progress</p>
                </div>
              </div>
              
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {(buildsData?.builds ?? summary?.devops?.todayBuilds?.builds ?? []).map(b => (
                  <div key={b.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${b.result === 'succeeded' ? 'bg-green-500' : b.result === 'failed' ? 'bg-red-500' : 'bg-orange-500'}`} />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{b.definitionName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500">{b.requestedBy}</span>
                      <span className="text-[10px] text-gray-400">{b.durationMinutes?.toFixed(1)}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {type === 'tickets' && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Open incidents: {summary?.support?.openIncidents ?? 0}</p>
              <p className="text-xs mt-2">Work item integration coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Commit List Modal (Full View)
// ─────────────────────────────────────────

function CommitListModal({ data, isOpen, onClose, onViewCommitDetail }: { 
  data: CommitStatsResponse | null; 
  isOpen: boolean; 
  onClose: () => void;
  onViewCommitDetail: (commit: CommitInfo) => void;
}) {
  const [filter, setFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  if (!isOpen) return null;

  const filteredCommits = data?.recentCommits.filter(c => {
    const matchesSearch = !filter || 
      c.comment.toLowerCase().includes(filter.toLowerCase()) ||
      c.authorName?.toLowerCase().includes(filter.toLowerCase()) ||
      c.shortCommitId.toLowerCase().includes(filter.toLowerCase());
    const matchesAuthor = !authorFilter || c.authorName === authorFilter;
    return matchesSearch && matchesAuthor;
  }) || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className={`bg-white dark:bg-gray-800 shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isFullscreen 
            ? 'fixed inset-0 rounded-none max-w-none max-h-none' 
            : 'rounded-xl max-w-5xl w-full mx-4 max-h-[85vh]'
        }`} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📊 All Commits
              {data && <span className="text-sm font-normal text-gray-500">({data.totalCommits} total)</span>}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {data?.daysBack}d range • {data?.byAuthor?.length || 0} contributors • {data?.totalChanges || 0} changes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? '⬜' : '⬛'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">×</button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search commits..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="flex-1 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {authorFilter && (
              <button 
                onClick={() => setAuthorFilter(null)}
                className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full flex items-center gap-1"
              >
                {authorFilter} <span className="text-blue-500">×</span>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Authors Sidebar */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto shrink-0 bg-gray-50 dark:bg-gray-800/30">
            <div className="p-3">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Top Contributors</h3>
              <div className="space-y-1">
                {data?.byAuthor.slice(0, 20).map(a => (
                  <button
                    key={a.author}
                    onClick={() => setAuthorFilter(authorFilter === a.author ? null : a.author)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                      authorFilter === a.author 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{a.author}</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">{a.commits}</span>
                    </div>
                    <div className="mt-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1 overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min((a.commits / (data.byAuthor[0]?.commits || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Commits List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {filteredCommits.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-2">🔍</p>
                  <p>No commits match your filters</p>
                </div>
              ) : (
                filteredCommits.map(c => (
                  <div 
                    key={c.shortCommitId}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {c.url ? (
                            <a 
                              href={c.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded hover:underline"
                            >
                              {c.shortCommitId}
                            </a>
                          ) : (
                            <span className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">{c.shortCommitId}</span>
                          )}
                          {c.authorName && (
                            <span className="text-[10px] text-purple-600 dark:text-purple-400">{c.authorName}</span>
                          )}
                          {c.repositoryName && (
                            <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{c.repositoryName}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{c.comment}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                          {c.authorDate && (
                            <span>{new Date(c.authorDate).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Open in Azure DevOps"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                        <button 
                          onClick={() => onViewCommitDetail(c)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          title="View details"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500">
            Showing {filteredCommits.length} of {data?.recentCommits.length || 0} commits
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// PR Detail Popup
// ─────────────────────────────────────────

function PRDetailPopup({ pr, onClose }: { pr: PRInfo; onClose: () => void }) {
  const { openChat, sendMessage } = usePersistentChat();
  
  const handleAskAI = () => {
    const prompt = `Tell me about this Azure DevOps Pull Request:
- PR #${pr.pullRequestId}: "${pr.title}"
- Repository: ${pr.repositoryName}
- Source: ${pr.sourceBranch.replace('refs/heads/', '')} → Target: ${pr.targetBranch.replace('refs/heads/', '')}
- Status: ${pr.isApproved ? 'Approved' : pr.isDraft ? 'Draft' : 'Pending Review'}
- Created by: ${pr.createdBy}
- Commits: ${pr.commitCount}, Comments: ${pr.commentCount}, Reviewers: ${pr.reviewerCount}

What can you tell me about this PR? Any suggestions for the review?`;
    openChat();
    setTimeout(() => sendMessage(prompt), 100);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">PR #{pr.pullRequestId}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded ${pr.isApproved ? 'bg-green-100 text-green-700' : pr.isDraft ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'}`}>
                {pr.isApproved ? '✓ Approved' : pr.isDraft ? 'Draft' : 'Pending Review'}
              </span>
              <span className="text-[10px] text-gray-400">{pr.repositoryName}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{pr.title}</h3>
          
          {/* Branch Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-[10px] text-gray-500 uppercase">Source</p>
                <p className="text-sm font-mono text-blue-600 dark:text-blue-400">{pr.sourceBranch.replace('refs/heads/', '')}</p>
              </div>
              <div className="px-4">
                <span className="text-2xl text-gray-300">→</span>
              </div>
              <div className="text-center flex-1">
                <p className="text-[10px] text-gray-500 uppercase">Target</p>
                <p className="text-sm font-mono text-green-600 dark:text-green-400">{pr.targetBranch.replace('refs/heads/', '')}</p>
              </div>
            </div>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{pr.commitCount}</p>
              <p className="text-[10px] text-gray-500">Commits</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-purple-600">{pr.commentCount}</p>
              <p className="text-[10px] text-gray-500">Comments</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-600">{pr.reviewerCount}</p>
              <p className="text-[10px] text-gray-500">Reviewers</p>
            </div>
          </div>

          {/* Reviewers */}
          {pr.reviewers && pr.reviewers.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase mb-2">Reviewers</p>
              <div className="flex flex-wrap gap-2">
                {pr.reviewers.map((reviewer, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                      reviewer.vote >= 5 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      reviewer.vote < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <span className="font-medium">{reviewer.displayName}</span>
                    <span>
                      {reviewer.vote >= 5 ? '✓' : reviewer.vote < 0 ? '✗' : '⏳'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Meta */}
          <div className="text-xs text-gray-500 space-y-1">
            <p><span className="font-medium">Created by:</span> {pr.createdBy}</p>
            <p><span className="font-medium">Created:</span> {new Date(pr.creationDate).toLocaleString()}</p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <a 
              href={getPrUrl(pr)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 text-center text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Open in Azure DevOps
            </a>
            <button 
              onClick={handleAskAI}
              className="text-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              🤖 Ask AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Commit Detail Popup
// ─────────────────────────────────────────

function CommitDetailPopup({ commit, onClose }: { commit: CommitInfo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-xl w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white font-mono">{commit.shortCommitId}</h2>
            <span className="text-[10px] text-gray-400">{commit.repositoryName}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-900 dark:text-white">{commit.comment}</p>
          
          {/* Author Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Committed by</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{commit.authorName}</p>
            {commit.authorEmail && <p className="text-xs text-gray-400">{commit.authorEmail}</p>}
            <p className="text-xs text-gray-400 mt-1">{new Date(commit.authorDate).toLocaleString()}</p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {commit.url && (
              <a 
                href={commit.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 text-center text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Open in Azure DevOps
              </a>
            )}
            <button className="flex-1 text-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
              🤖 Analyze with AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Jenkins Build Detail Modal
// ─────────────────────────────────────────

function JenkinsBuildDetailModal({ detail, loading, onClose }: { 
  detail: JenkinsBuildDetailResponse | null; 
  loading: boolean;
  onClose: () => void;
}) {
  const formatTimestamp = (ts: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes < 1) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const getResultBadge = (result: string | null, building: boolean) => {
    if (building) return { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', label: '🔄 Building' };
    switch (result) {
      case 'SUCCESS': return { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', label: '✅ Success' };
      case 'FAILURE': return { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', label: '❌ Failed' };
      case 'UNSTABLE': return { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', label: '⚠️ Unstable' };
      case 'ABORTED': return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: '⛔ Aborted' };
      default: return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: '⚪ Unknown' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🔧 {detail?.displayName || 'Build Details'}
              {detail && !loading && (
                <span className={`text-xs px-2 py-0.5 rounded ${getResultBadge(detail.result, detail.building).bg} ${getResultBadge(detail.result, detail.building).text}`}>
                  {getResultBadge(detail.result, detail.building).label}
                </span>
              )}
            </h2>
            {detail?.fullDisplayName && (
              <p className="text-xs text-gray-400 mt-1">{detail.fullDisplayName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-500">Loading build details...</span>
            </div>
          )}

          {!loading && detail?.error && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-red-600 dark:text-red-400 text-sm">
              {detail.error}
            </div>
          )}

          {!loading && detail && !detail.error && (
            <>
              {/* Version & Branch */}
              {(detail.version || detail.branch) && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    {detail.version && (
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-medium">Version</p>
                        <p className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">{detail.version}</p>
                      </div>
                    )}
                    {detail.branch && (
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase font-medium">Branch</p>
                        <p className="text-sm font-mono text-purple-600 dark:text-purple-400">{detail.branch}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Build Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">#{detail.buildNumber}</p>
                  <p className="text-[10px] text-gray-500">Build</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{formatDuration(detail.duration)}</p>
                  <p className="text-[10px] text-gray-500">Duration</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-600">{detail.changesCount}</p>
                  <p className="text-[10px] text-gray-500">Changes</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-purple-600">{detail.artifactsCount}</p>
                  <p className="text-[10px] text-gray-500">Artifacts</p>
                </div>
              </div>

              {/* Build Time & Trigger */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Started</span>
                  <span className="text-xs font-medium text-gray-900 dark:text-white">{formatTimestamp(detail.timestamp)}</span>
                </div>
                {detail.causes.length > 0 && (
                  <div className="flex items-start justify-between">
                    <span className="text-xs text-gray-500">Triggered by</span>
                    <span className="text-xs text-gray-900 dark:text-white text-right">
                      {detail.causes.map((c, i) => (
                        <span key={i}>{c.shortDescription || c.userName || 'Unknown'}{i < detail.causes.length - 1 ? ', ' : ''}</span>
                      ))}
                    </span>
                  </div>
                )}
              </div>

              {/* Changes/Commits */}
              {detail.changes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    📝 Changes <span className="text-xs font-normal text-gray-400">({detail.changes.length})</span>
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg divide-y divide-gray-200 dark:divide-gray-600 max-h-48 overflow-y-auto">
                    {detail.changes.map((change, i) => (
                      <div key={i} className="px-3 py-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-mono text-blue-600 dark:text-blue-400 flex-shrink-0">{change.commitId || '...'}</span>
                          <span className="text-xs text-gray-900 dark:text-white flex-1 truncate">{change.message}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                          <span>{change.author}</span>
                          <span>{formatTimestamp(change.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Artifacts */}
              {detail.artifacts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    📦 Artifacts <span className="text-xs font-normal text-gray-400">({detail.artifacts.length})</span>
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg divide-y divide-gray-200 dark:divide-gray-600">
                    {detail.artifacts.map((artifact, i) => (
                      <a 
                        key={i}
                        href={artifact.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600/50"
                      >
                        <span className="text-xs text-gray-900 dark:text-white">{artifact.fileName || artifact.displayPath || artifact.relativePath}</span>
                        <span className="text-xs text-blue-500">Download ↓</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex gap-2">
          <a 
            href={detail?.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Open in Jenkins
          </a>
          <a 
            href={detail?.consoleUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Console Output
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Lazy Widget Renderer
// ─────────────────────────────────────────

function LazyWidgetRenderer({ config, summary, expandedWidget, setExpandedWidget, onRefresh, onViewAllPRs, onViewAllCommits, onBuildClick, commitData, buildsData }: {
  config: WidgetConfig;
  summary: DashboardSummary | null;
  expandedWidget: string | null;
  setExpandedWidget: (k: string | null) => void;
  onRefresh: () => void;
  onViewAllPRs?: () => void;
  onViewAllCommits?: () => void;
  onBuildClick?: (jobPath: string, buildNumber: number) => void;
  commitData?: CommitStatsResponse | null;
  buildsData?: TodayBuildsResponse | null;
}) {
  switch (config.key) {
    case 'branches': return <LazyBranches expanded={expandedWidget === 'branches'} toggle={() => setExpandedWidget(expandedWidget === 'branches' ? null : 'branches')} />;
    case 'birthdays': return <BirthdaysWidget birthdays={summary?.birthdays || []} />;
    case 'recentActivity': return <RecentActivityWidget data={summary?.devops?.recentActivity} />;
    case 'knowledge': return <LazyKnowledge onRefresh={onRefresh} />;
    case 'builds':    return <TodayBuildsWidget builds={buildsData?.builds ?? summary?.devops?.todayBuilds?.builds ?? []} />;
    case 'jenkinsBuilds': return <LazyJenkinsBuilds expanded={expandedWidget === 'jenkinsBuilds'} toggle={() => setExpandedWidget(expandedWidget === 'jenkinsBuilds' ? null : 'jenkinsBuilds')} onBuildClick={onBuildClick} />;
    case 'prs':       return <LazyPRs expanded={expandedWidget === 'prs'} toggle={() => setExpandedWidget(expandedWidget === 'prs' ? null : 'prs')} onViewAll={onViewAllPRs} />;
    case 'commits':   return <LazyCommitStats onViewAll={onViewAllCommits} preloadedData={commitData} />;
    case 'customers': return <LazyCustomers onRefresh={onRefresh} />;
    case 'support':   return <LazySupportWidget onRefresh={onRefresh} />;
    case 'apiCatalog': return <LazyApiCatalog onRefresh={onRefresh} />;
    default: return null;
  }
}

// ─────────────────────────────────────────
// Lazy-loaded Widgets (IntersectionObserver)
// ─────────────────────────────────────────

function LazyBranches({ expanded, toggle }: { expanded: boolean; toggle: () => void }) {
  const fetcher = useCallback(() => getBranches(), []);
  const { ref, data, loading } = useLazyWidget(fetcher);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="Current Branches" icon="🔀" /> :
        <BranchesWidget data={data} expanded={expanded} toggle={toggle} />}
    </div>
  );
}

function LazyPRs({ expanded, toggle, onViewAll }: { expanded: boolean; toggle: () => void; onViewAll?: () => void }) {
  const fetcher = useCallback(() => getPRSummary(), []);
  const { ref, data, loading } = useLazyWidget(fetcher);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="Pull Requests" icon="🔃" /> :
        <PRWidget data={data} expanded={expanded} toggle={toggle} onViewAll={onViewAll} />}
    </div>
  );
}

function LazyJenkinsBuilds({ expanded, toggle, onBuildClick }: { expanded: boolean; toggle: () => void; onBuildClick?: (jobPath: string, buildNumber: number) => void }) {
  const fetcher = useCallback(() => getJenkinsBuilds(), []);
  const { ref, data, loading, reload } = useLazyWidget(fetcher);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="Jenkins Builds" icon="🔧" /> :
        <JenkinsBuildsWidget data={data} expanded={expanded} toggle={toggle} onRefresh={reload} onBuildClick={onBuildClick} />}
    </div>
  );
}

function LazyCommitStats({ onViewAll, preloadedData }: { onViewAll?: () => void; preloadedData?: CommitStatsResponse | null }) {
  const fetcher = useCallback(() => getCommitStats(undefined, 30), []);
  const { ref, data: fetchedData, loading, error } = useLazyWidget(fetcher);
  
  // Use preloaded data if available, otherwise use fetched data
  const data = preloadedData || fetchedData;
  
  return (
    <div ref={ref} style={{ minHeight: '100px' }}>
      {loading && !data ? <WidgetSkeleton title="Commits + LOC" icon="📊" /> :
        error && !data ? (
          <Widget title="Commits + LOC" icon="📊" empty emptyText={`Error: ${error}`}><></></Widget>
        ) : <CommitStatsWidget data={data || null} onViewAll={onViewAll} />}
    </div>
  );
}

function LazyKnowledge({ onRefresh }: { onRefresh: () => void }) {
  const fetcher = useCallback(() => getKnowledgeShares(), []);
  const { ref, data, loading, reload } = useLazyWidget(fetcher);
  const handleRefresh = useCallback(() => { reload(); onRefresh(); }, [reload, onRefresh]);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="Knowledge Sharing" icon="📚" /> :
        <KnowledgeWidget data={data || []} onRefresh={handleRefresh} />}
    </div>
  );
}

function LazyCustomers({ onRefresh }: { onRefresh: () => void }) {
  const fetcher = useCallback(() => getCustomersOverview(), []);
  const { ref, data, loading, reload } = useLazyWidget(fetcher);
  const handleRefresh = useCallback(() => { reload(); onRefresh(); }, [reload, onRefresh]);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="Current Customers" icon="🏢" /> :
        <CustomersWidget data={data} onRefresh={handleRefresh} />}
    </div>
  );
}

function LazySupportWidget({ onRefresh }: { onRefresh: () => void }) {
  const fetcher = useCallback(() => getProductionSupport(), []);
  const { ref, data, loading, reload } = useLazyWidget(fetcher);
  const handleRefresh = useCallback(() => { reload(); onRefresh(); }, [reload, onRefresh]);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="Production Support" icon="🛟" /> :
        <SupportWidget data={data} onRefresh={handleRefresh} />}
    </div>
  );
}

function LazyApiCatalog({ onRefresh }: { onRefresh: () => void }) {
  const fetcher = useCallback(() => getApiCatalog(), []);
  const { ref, data, loading, reload } = useLazyWidget(fetcher);
  const handleRefresh = useCallback(() => { reload(); onRefresh(); }, [reload, onRefresh]);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="API Details" icon="🔌" /> :
        <ApiCatalogWidget data={data || []} onRefresh={handleRefresh} />}
    </div>
  );
}

// ─────────────────────────────────────────
// Skeleton Components
// ─────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 animate-pulse">
      <div className="h-2.5 w-16 bg-gray-200 dark:bg-gray-600 rounded mb-2" />
      <div className="h-6 w-10 bg-gray-200 dark:bg-gray-600 rounded mb-1" />
      <div className="h-2 w-20 bg-gray-100 dark:bg-gray-700 rounded" />
    </div>
  );
}

function WidgetSkeleton({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>{icon}</span> {title}
        </h3>
      </div>
      <div className="p-3 space-y-2 animate-pulse">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded w-5/6" />
        <div className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded w-2/3" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────

function Metric({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
    teal: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
    slate: 'bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700',
  };
  return (
    <div className={`p-3 rounded-lg border ${bg[color] || bg.blue}`}>
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Widget({ title, icon, children, actions, empty, emptyText }: {
  title: string; icon: string; children: React.ReactNode;
  actions?: React.ReactNode; empty?: boolean; emptyText?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>{icon}</span> {title}
        </h3>
        {actions}
      </div>
      <div className="p-3">
        {empty ? (
          <p className="text-xs text-gray-400 text-center py-4">{emptyText || 'No data yet'}</p>
        ) : children}
      </div>
    </div>
  );
}

function UploadBtn({ label, endpoint, onDone }: { label: string; endpoint: string; onDone: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const res = await uploadFile(endpoint, file);
      setMsg(`+${res.created}${res.errors ? ` (${res.errors} err)` : ''}`);
      onDone();
    } catch { setMsg('Failed'); }
    finally { setUploading(false); }
  };
  return (
    <label className="text-[10px] px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1">
      {uploading ? '...' : label}
      <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" disabled={uploading} />
      {msg && <span className="text-green-600 dark:text-green-400 ml-1">{msg}</span>}
    </label>
  );
}

function TemplateBtn({ type }: { type: 'production-support' | 'team-members' | 'customers' }) {
  return (
    <button onClick={() => downloadTemplate(type)}
      className="text-[10px] px-2 py-1 text-blue-600 dark:text-blue-400 hover:underline">
      Template
    </button>
  );
}

// ─────────────────────────────────────────
// Branches Widget
// ─────────────────────────────────────────

function BranchesWidget({ data, expanded, toggle }: { data: BranchesResponse | null; expanded: boolean; toggle: () => void }) {
  if (!data) return (
    <Widget title="Current Branches" icon="🔀" empty emptyText="No Azure DevOps connection"><></></Widget>
  );
  const maxShow = expanded ? 100 : 8;
  return (
    <Widget title={`Branches — ${data.repository}`} icon="🔀"
      actions={data.branches.length > 8 && (
        <button onClick={toggle} className="text-[10px] text-blue-500 hover:underline">
          {expanded ? 'Less' : `+${data.branches.length - 8} more`}
        </button>
      )}>
      <div className="space-y-0.5 max-h-64 overflow-y-auto">
        {data.branches.slice(0, maxShow).map(b => (
          <div key={b.name} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className={`font-mono ${b.name === data.defaultBranch ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
              {b.name === data.defaultBranch && '★ '}{b.name}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">{b.objectId}</span>
          </div>
        ))}
      </div>
      {data.repositories.length > 1 && (
        <p className="text-[10px] text-gray-400 mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
          {data.repositories.length} repositories: {data.repositories.map(r => r.name).join(', ')}
        </p>
      )}
    </Widget>
  );
}

// ─────────────────────────────────────────
// Today Builds Widget
// ─────────────────────────────────────────

function TodayBuildsWidget({ builds }: { builds: BuildInfo[] }) {
  return (
    <Widget title="Today Builds (Azure DevOps)" icon="🏗" empty={!builds?.length} emptyText="No builds today">
      <div className="space-y-1 max-h-52 overflow-y-auto">
        {builds?.map((b) => (
          <div key={b.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <div className="flex items-center gap-1.5 min-w-0">
              <span>{b.result === 'succeeded' ? '✅' : b.result === 'failed' ? '❌' : '⏳'}</span>
              <a href={b.url} target="_blank" rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline truncate font-medium">
                {b.buildNumber}
              </a>
              <span className="text-gray-400 truncate">{b.definitionName}</span>
            </div>
            <div className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
              {b.requestedBy?.split(' ')[0]} &bull; {b.durationMinutes ? `${b.durationMinutes.toFixed(1)}m` : '...'}
            </div>
          </div>
        ))}
      </div>
    </Widget>
  );
}

// ─────────────────────────────────────────
// Jenkins Builds Widget
// ─────────────────────────────────────────

function JenkinsBuildsWidget({ data, expanded, toggle, onRefresh, onBuildClick }: {
  data: JenkinsBuildsResponse | null; expanded: boolean; toggle: () => void; onRefresh: () => void;
  onBuildClick?: (jobPath: string, buildNumber: number) => void;
}) {
  const [filter, setFilter] = useState('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  if (!data || !data.connected) {
    return <Widget title="Jenkins Builds" icon="🔧" empty emptyText={data?.error || 'No Jenkins connection'}><></></Widget>;
  }

  const jobs = (data.jobs || []).filter(j =>
    !filter || j.name.toLowerCase().includes(filter.toLowerCase()) || j.fullName.toLowerCase().includes(filter.toLowerCase())
  );

  const maxShow = expanded ? 50 : 12;

  const getStatusIcon = (status: string, building: boolean) => {
    if (building) return '🔄';
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'unstable': return '⚠️';
      case 'aborted': return '⛔';
      case 'disabled': return '🚫';
      default: return '⚪';
    }
  };

  const getBuildResultColor = (result: string | null, building: boolean) => {
    if (building) return 'text-blue-500 dark:text-blue-400';
    switch (result) {
      case 'SUCCESS': return 'text-green-600 dark:text-green-400';
      case 'FAILURE': return 'text-red-600 dark:text-red-400';
      case 'UNSTABLE': return 'text-yellow-600 dark:text-yellow-400';
      case 'ABORTED': return 'text-gray-500 dark:text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const formatTimestamp = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  return (
    <Widget title="Jenkins Builds" icon="🔧"
      actions={
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-gray-500 dark:text-gray-400">{data.totalJobs} jobs</span>
          {(data.buildingCount ?? 0) > 0 && (
            <span className="text-blue-600 dark:text-blue-400 font-medium animate-pulse">{data.buildingCount} building</span>
          )}
          <button onClick={onRefresh} className="text-blue-500 hover:underline" title="Refresh">↻</button>
          {jobs.length > 12 && (
            <button onClick={toggle} className="text-blue-500 hover:underline">{expanded ? 'Less' : 'More'}</button>
          )}
        </div>
      }>
      {/* Search filter */}
      <div className="mb-2">
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter jobs..."
          className="w-full text-xs px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      {jobs.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">{filter ? 'No matching jobs' : 'No jobs found'}</p>
      ) : (
        <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
          {jobs.slice(0, maxShow).map(job => (
            <div key={job.fullName} className="rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
              {/* Job row */}
              <button
                onClick={() => setExpandedJob(expandedJob === job.fullName ? null : job.fullName)}
                className="w-full flex items-center justify-between text-xs py-1.5 px-1.5 text-left"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span title={job.status}>{getStatusIcon(job.status, job.isBuilding)}</span>
                  <span className="text-gray-900 dark:text-white font-medium truncate">{job.displayName}</span>
                  {job.lastBuild && (
                    <span className={`font-mono ${getBuildResultColor(job.lastBuild.result, job.lastBuild.building)}`}>
                      {job.lastBuild.displayName}
                    </span>
                  )}
                  {job.isBuilding && (
                    <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1 rounded animate-pulse">
                      BUILDING
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 whitespace-nowrap ml-2">
                  {job.lastBuild && (
                    <>
                      <span>{formatTimestamp(job.lastBuild.timestamp)}</span>
                      <span>{job.lastBuild.durationMinutes}m</span>
                    </>
                  )}
                  {job.healthScore != null && (
                    <span title={job.healthDescription || ''} className={job.healthScore >= 80 ? 'text-green-500' : job.healthScore >= 50 ? 'text-yellow-500' : 'text-red-500'}>
                      {job.healthScore}%
                    </span>
                  )}
                  <span className="text-gray-300 dark:text-gray-600">{expandedJob === job.fullName ? '▾' : '▸'}</span>
                </div>
              </button>

              {/* Expanded builds */}
              {expandedJob === job.fullName && job.builds.length > 0 && (
                <div className="ml-5 mb-1.5 border-l-2 border-gray-200 dark:border-gray-600 pl-2 space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 px-1 py-0.5">
                    <span className="font-medium">Build History</span>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        Open in Jenkins ↗
                      </a>
                    )}
                  </div>
                  {job.builds.map(b => (
                    <div 
                      key={b.number} 
                      onClick={() => onBuildClick?.(job.fullName, b.number)}
                      className="flex items-center justify-between text-[10px] px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600/30 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={getBuildResultColor(b.result, b.building)}>
                          {b.building ? '🔄' : b.result === 'SUCCESS' ? '✅' : b.result === 'FAILURE' ? '❌' : b.result === 'UNSTABLE' ? '⚠️' : '⚪'}
                        </span>
                        <span className={`font-mono font-medium ${getBuildResultColor(b.result, b.building)}`}>
                          {b.displayName}
                        </span>
                        {b.building && <span className="text-blue-500 animate-pulse">in progress</span>}
                        {b.result && !b.building && <span className="text-gray-400">{b.result.toLowerCase()}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span>{formatTimestamp(b.timestamp)}</span>
                        {!b.building && <span>{b.durationMinutes}m</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {jobs.length > maxShow && (
            <p className="text-[10px] text-gray-400 text-center py-1">
              Showing {maxShow} of {jobs.length} jobs — <button onClick={toggle} className="text-blue-500 hover:underline">show all</button>
            </p>
          )}
        </div>
      )}
    </Widget>
  );
}

// ─────────────────────────────────────────
// PR Widget (Enhanced with Stats & Full View)
// ─────────────────────────────────────────

function PRWidget({ data, expanded, toggle, onViewAll }: { data: PRSummaryResponse | null; expanded: boolean; toggle: () => void; onViewAll?: () => void }) {
  const FullViewButton = () => (
    <button 
      onClick={() => onViewAll?.()} 
      className="text-[10px] px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
      Full View
    </button>
  );
  
  if (!data) return (
    <Widget title="Pull Requests" icon="🔃" 
      actions={<FullViewButton />}
      empty emptyText="No DevOps connection"><></></Widget>
  );

  const waiting = data.prs.filter(pr => !pr.isApproved && !pr.isDraft);
  const maxShow = expanded ? 50 : 5;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header with Stats */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🔃</span> Pull Requests
          </h3>
          <FullViewButton />
        </div>
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{data.totalActive}</p>
            <p className="text-[9px] text-gray-500 uppercase font-medium">Open PRs</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{data.waitingApproval}</p>
            <p className="text-[9px] text-gray-500 uppercase font-medium">Waiting</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{data.approved}</p>
            <p className="text-[9px] text-gray-500 uppercase font-medium">Approved</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-gray-500 dark:text-gray-400">{data.drafts}</p>
            <p className="text-[9px] text-gray-500 uppercase font-medium">Drafts</p>
          </div>
        </div>
      </div>
      
      {/* PR List */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-medium text-gray-500 uppercase">Waiting Approval ({waiting.length})</p>
          {waiting.length > 5 && (
            <button onClick={toggle} className="text-[10px] text-purple-500 hover:underline">
              {expanded ? 'Show Less' : `+${waiting.length - 5} more`}
            </button>
          )}
        </div>
        {waiting.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">✨ All PRs are reviewed!</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {waiting.slice(0, maxShow).map(pr => (
              <div key={pr.pullRequestId} className="flex items-start justify-between text-xs py-2 px-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-transparent hover:border-purple-200 dark:hover:border-purple-800 transition-all cursor-pointer group" title={`${pr.createdBy || 'Unknown'}\n${pr.title}\n${pr.sourceBranch} → ${pr.targetBranch}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <a href={getPrUrl(pr)} target="_blank" rel="noopener noreferrer"
                      className="text-purple-600 dark:text-purple-400 hover:underline font-mono font-medium">
                      #{pr.pullRequestId}
                    </a>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{pr.repositoryName}</span>
                    {/* Reviewer badges */}
                    {pr.reviewers && pr.reviewers.length > 0 && (
                      <div className="flex -space-x-1">
                        {pr.reviewers.slice(0, 3).map((r, i) => (
                          <div
                            key={i}
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold border border-white dark:border-gray-800 ${
                              r.vote >= 5 ? 'bg-green-500 text-white' :
                              r.vote < 0 ? 'bg-red-500 text-white' :
                              'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                            }`}
                            title={`${r.displayName}: ${r.vote >= 5 ? 'Approved' : r.vote < 0 ? 'Rejected' : 'Pending'}`}
                          >
                            {r.displayName.charAt(0)}
                          </div>
                        ))}
                        {pr.reviewers.length > 3 && (
                          <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[7px] font-bold border border-white dark:border-gray-800">
                            +{pr.reviewers.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 truncate font-medium">{pr.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    <span className="text-purple-500" title={pr.createdBy}>{getFirstName(pr.createdBy)}</span>
                    <span>•</span>
                    <span className="font-mono">{pr.sourceBranch?.replace('refs/heads/', '')}</span>
                    <span>→</span>
                    <span className="font-mono text-green-500">{pr.targetBranch?.replace('refs/heads/', '')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {new Date(pr.creationDate).toLocaleDateString()}
                  </span>
                  <a 
                    href={getPrUrl(pr)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-lg"
                    title="Open in Azure DevOps"
                  >
                    <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer with Full View Button */}
      {onViewAll && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button 
            onClick={onViewAll}
            className="w-full text-xs py-2 text-center text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>📊</span> View All PRs with Full Details & Stats
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Commit Stats Widget (Enhanced with Stats & Full View)
// ─────────────────────────────────────────

function CommitStatsWidget({ data, onViewAll }: { data: CommitStatsResponse | null; onViewAll?: () => void }) {
  const FullViewButton = () => (
    <button 
      onClick={() => onViewAll?.()} 
      className="text-[10px] px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
      Full View
    </button>
  );
  
  if (!data) return (
    <Widget title="Commits + LOC" icon="📊" 
      actions={<FullViewButton />}
      empty emptyText="No commit data"><></></Widget>
  );

  const periodLabel = data.isAllTime ? 'All Time' : `${data.daysBack}d`;
  const lastCommit = data.lastCommitDate ? new Date(data.lastCommitDate).toLocaleDateString() : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header with Stats */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>📊</span> Commits ({periodLabel})
          </h3>
          <FullViewButton />
        </div>
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{data.totalCommits}</p>
            <p className="text-[9px] text-gray-500 uppercase font-medium">Commits</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{data.byAuthor?.length || 0}</p>
            <p className="text-[9px] text-gray-500 uppercase font-medium">Authors</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{(data.totalChanges || 0).toLocaleString()}</p>
            <p className="text-[9px] text-gray-500 uppercase font-medium">Changes</p>
          </div>
          <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{data.repoCount || 0}</p>
            <p className="text-[9px] text-gray-500 uppercase font-medium">Repos</p>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3">
        {data.isAllTime && lastCommit && (
          <div className="mb-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[10px] text-amber-700 dark:text-amber-300">
            No commits in last {data.daysBack} days — showing all-time data. Last commit: {lastCommit}
          </div>
        )}
        
        {/* Top Contributors */}
        {data.byAuthor.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-medium text-gray-500 uppercase mb-2">Top Contributors</p>
            <div className="space-y-1.5">
              {data.byAuthor.slice(0, 6).map((a, i) => (
                <div key={a.author} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <span className="text-[10px] text-gray-400 w-4">{i + 1}.</span>
                  <span className={`w-24 text-xs truncate ${a.isCurrentUser ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    {a.author?.split(' ')[0]} {a.isCurrentUser && '(You)'}
                  </span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${a.isCurrentUser ? 'bg-blue-600' : 'bg-blue-400'}`}
                      style={{ width: `${Math.min((a.commits / (data.byAuthor[0]?.commits || 1)) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 w-16 text-right">{a.commits} commits</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Recent Commits */}
        {data.recentCommits.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
            <p className="text-[10px] font-medium text-gray-500 uppercase mb-2">Recent Commits</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {data.recentCommits.slice(0, 4).map(c => (
                <a 
                  key={c.shortCommitId} 
                  href={c.url || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 p-1.5 text-[11px] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors cursor-pointer group"
                >
                  <span className="font-mono text-blue-600 dark:text-blue-400 shrink-0 group-hover:underline bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">{c.shortCommitId}</span>
                  <span className="text-gray-800 dark:text-gray-200 truncate flex-1">{c.comment}</span>
                  <span className="text-gray-400 shrink-0">{c.authorName?.split(' ')[0]}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Footer with Full View Button */}
      {onViewAll && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button 
            onClick={onViewAll}
            className="w-full text-xs py-2 text-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>📊</span> View All Commits with Full Details & Stats
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Birthdays Widget
// ─────────────────────────────────────────

function BirthdaysWidget({ birthdays }: { birthdays: BirthdayInfo[] }) {
  return (
    <Widget title="Birthdays" icon="🎂" empty={!birthdays.length}
      emptyText="No upcoming birthdays. Sync employees via HR Portal.">
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {birthdays.map(b => (
          <div key={b.id} className={`flex items-center justify-between text-xs py-2 px-2.5 rounded-lg ${
            b.isToday 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border border-green-200 dark:border-green-800' 
              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent'
          }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {b.isToday && '🎉 '}{b.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {b.department && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={b.department}>
                    {b.department}
                  </span>
                )}
                {b.role && (
                  <span className="text-[10px] text-gray-400 truncate">{b.role}</span>
                )}
              </div>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full flex-shrink-0 ml-2 ${
              b.isToday 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 font-bold animate-pulse' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {b.isToday ? '🎂 Today!' : `${b.daysUntil}d`}
            </span>
          </div>
        ))}
      </div>
    </Widget>
  );
}

// ─────────────────────────────────────────
// Recent Activity Widget (Last 48 hours)
// ─────────────────────────────────────────

interface RecentActivityData {
  prsCreated: number;
  prsCompleted: number;
  recentPRs: Array<{
    pullRequestId: number;
    title: string;
    status: string;
    createdBy: string;
    creationDate: string;
    closedDate?: string;
    sourceBranch: string;
    targetBranch: string;
    repositoryName: string;
    url: string;
  }>;
}

function RecentActivityWidget({ data }: { data: RecentActivityData | undefined }) {
  const formatTimeAgo = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  return (
    <Widget title="Recent Activity (48h)" icon="⚡"
      empty={!data || data.recentPRs.length === 0}
      emptyText="No recent PR activity in the last 48 hours.">
      {data && data.recentPRs.length > 0 && (
        <>
          <div className="flex gap-2 mb-2 text-[10px]">
            <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
              {data.prsCreated} PRs created
            </span>
            <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
              {data.prsCompleted} PRs completed
            </span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data.recentPRs.map(pr => (
              <div key={pr.pullRequestId} className="flex items-start justify-between text-xs py-1.5 px-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-2 border-transparent hover:border-purple-400" title={`${pr.createdBy || 'Unknown'}\n${pr.title}\n${pr.sourceBranch} → ${pr.targetBranch}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      pr.status === 'completed' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    }`}>
                      {pr.status === 'completed' ? '✓ Merged' : '↻ Active'}
                    </span>
                    <a href={getPrUrl(pr)} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline font-mono">
                      #{pr.pullRequestId}
                    </a>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 truncate mt-0.5">{pr.title}</p>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    <span title={pr.createdBy}>{getFirstName(pr.createdBy)}</span> • {pr.repositoryName} •
                    <span className="font-mono"> {pr.sourceBranch?.replace('refs/heads/', '')}</span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                  {formatTimeAgo(pr.closedDate || pr.creationDate)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Widget>
  );
}

// ─────────────────────────────────────────
// Customers Widget
// ─────────────────────────────────────────

function CustomersWidget({ data, onRefresh }: { data: CustomersOverviewResponse | null; onRefresh: () => void }) {
  const isAdmin = useAdminView();
  return (
    <Widget title="Current Customers" icon="🏢"
      empty={!data || data.total === 0}
      emptyText={isAdmin ? "Upload customer Excel to populate." : "No customer data available."}
      actions={isAdmin ? (
        <div className="flex items-center gap-1">
          <UploadBtn label="Upload" endpoint="customers/upload" onDone={onRefresh} />
          <TemplateBtn type="customers" />
        </div>
      ) : undefined}>
      {data && data.total > 0 && (
        <div>
          <div className="flex gap-2 mb-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              SaaS: {data.saas.count} ({data.saas.active} active)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              On-Prem: {data.onPremise.count} ({data.onPremise.active} active)
            </span>
            {data.hybrid.count > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                Hybrid: {data.hybrid.count}
              </span>
            )}
          </div>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[10px] text-gray-500 dark:text-gray-400 uppercase">
                  <th className="pb-1.5">Customer</th>
                  <th className="pb-1.5">Type</th>
                  <th className="pb-1.5">Tenant ID</th>
                  <th className="pb-1.5">Project ID</th>
                  <th className="pb-1.5">Version</th>
                  <th className="pb-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...data.saas.customers, ...data.onPremise.customers, ...data.hybrid.customers].map(c => (
                  <tr key={c.id} className="border-t border-gray-50 dark:border-gray-700/50">
                    <td className="py-1 font-medium text-gray-900 dark:text-white">{c.customerName}</td>
                    <td className="py-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        data.saas.customers.includes(c) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        data.onPremise.customers.includes(c) ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                        'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {data.saas.customers.includes(c) ? 'SaaS' : data.onPremise.customers.includes(c) ? 'On-Prem' : 'Hybrid'}
                      </span>
                    </td>
                    <td className="py-1 font-mono text-[10px] text-gray-600 dark:text-gray-300">{c.customerTenantId || '—'}</td>
                    <td className="py-1 font-mono text-[10px] text-gray-600 dark:text-gray-300">{c.propertyId || '—'}</td>
                    <td className="py-1 text-gray-600 dark:text-gray-300">{c.currentVersion || '—'}</td>
                    <td className="py-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        c.status === 'Active' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Widget>
  );
}

// ─────────────────────────────────────────
// Production Support Widget
// ─────────────────────────────────────────

function SupportWidget({ data, onRefresh }: { data: ProductionSupportResponse | null; onRefresh: () => void }) {
  const isAdmin = useAdminView();
  return (
    <Widget title="Production Support" icon="🛟"
      empty={!data || data.summary.total === 0}
      emptyText={isAdmin ? "Upload production support Excel." : "No support data available."}
      actions={isAdmin ? (
        <div className="flex items-center gap-1">
          <UploadBtn label="Upload" endpoint="production-support/upload" onDone={onRefresh} />
          <TemplateBtn type="production-support" />
        </div>
      ) : undefined}>
      {data && data.summary.total > 0 && (
        <div>
          <div className="flex gap-2 mb-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
              Open: {data.summary.open}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
              In Progress: {data.summary.inProgress}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Resolved: {data.summary.resolved}
            </span>
            {data.summary.critical > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-200 text-red-900 dark:bg-red-800/40 dark:text-red-200 font-bold">
                Critical: {data.summary.critical}
              </span>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {data.entries.slice(0, 10).map(e => (
              <div key={e.id} className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="min-w-0 flex-1">
                  <span className={`inline-block px-1 py-0 rounded text-[9px] mr-1 ${getSeverityColor(e.severity)}`}>{e.severity}</span>
                  <span className="text-gray-900 dark:text-white">{e.title}</span>
                </div>
                <div className="text-[10px] text-gray-400 whitespace-nowrap ml-2 flex items-center gap-1.5">
                  <span className={`px-1 py-0 rounded text-[9px] ${getStatusColor(e.status)}`}>{e.status}</span>
                  <span>{e.incidentDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Widget>
  );
}

// ─────────────────────────────────────────
// API Catalog Widget
// ─────────────────────────────────────────

function ApiCatalogWidget({ data, onRefresh }: { data: ApiCatalogInfo[]; onRefresh: () => void }) {
  const isAdmin = useAdminView();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ serviceName: '', endpoint: '', httpMethod: 'GET', description: '', category: '', version: '' });

  const handleAdd = async () => {
    if (!form.serviceName) return;
    await addApiCatalogEntry(form as any);
    setForm({ serviceName: '', endpoint: '', httpMethod: 'GET', description: '', category: '', version: '' });
    setShowAdd(false);
    onRefresh();
  };

  const methodColor: Record<string, string> = {
    GET: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <Widget title={`API Details (${data.length})`} icon="🔌"
      empty={data.length === 0 && !showAdd}
      emptyText={isAdmin ? "Document your product APIs." : "No API catalog data."}
      actions={isAdmin ? (
        <button onClick={() => setShowAdd(!showAdd)}
          className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      ) : undefined}>
      {isAdmin && showAdd && (
        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded space-y-1.5">
          <div className="grid grid-cols-3 gap-1.5">
            <input placeholder="Service *" value={form.serviceName} onChange={e => setForm(p => ({ ...p, serviceName: e.target.value }))}
              className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            <input placeholder="Endpoint" value={form.endpoint} onChange={e => setForm(p => ({ ...p, endpoint: e.target.value }))}
              className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            <select value={form.httpMethod} onChange={e => setForm(p => ({ ...p, httpMethod: e.target.value }))}
              className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5">
            <input placeholder="Category" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="flex-1 text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            <input placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="flex-1 text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            <button onClick={handleAdd} className="text-[10px] px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Save</button>
          </div>
        </div>
      )}
      {data.length > 0 && (
        <div className="max-h-44 overflow-y-auto space-y-0.5">
          {data.map(a => (
            <div key={a.id} className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${methodColor[a.httpMethod || 'GET'] || ''}`}>{a.httpMethod}</span>
                <span className="font-medium text-gray-900 dark:text-white">{a.serviceName}</span>
                <span className="font-mono text-gray-400 truncate">{a.endpoint}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {a.category && <span className="text-[9px] text-gray-400">{a.category}</span>}
                {isAdmin && <button onClick={() => { removeApiCatalogEntry(a.id); onRefresh(); }}
                  className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">✕</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ─────────────────────────────────────────
// Advanced Knowledge Sharing Widget with AI Feed & Image Slider
// ─────────────────────────────────────────

interface TechNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  category: 'AI' | '.NET' | 'Angular' | 'TypeScript' | 'Azure' | 'General';
  summary?: string;
}

interface SharedImage {
  id: string;
  url: string;
  title: string;
  uploadedBy: string;
  uploadedAt: string;
}

function KnowledgeWidget({ data, onRefresh }: { data: KnowledgeShareInfo[]; onRefresh: () => void }) {
  const isAdmin = useAdminView();
  const [activeTab, setActiveTab] = useState<'shared' | 'ai-feed' | 'gallery'>('shared');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', category: 'Article', description: '' });
  
  // AI Feed State
  const [aiNews, setAiNews] = useState<TechNewsItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  
  // Image Gallery State
  const [images, setImages] = useState<SharedImage[]>([
    // Mock data - in real app, fetch from backend
    { id: '1', url: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800', title: 'AI Development', uploadedBy: 'Team', uploadedAt: new Date().toISOString() },
    { id: '2', url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800', title: 'Coding Session', uploadedBy: 'Dev Team', uploadedAt: new Date().toISOString() },
    { id: '3', url: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800', title: 'Sprint Review', uploadedBy: 'PM', uploadedAt: new Date().toISOString() },
  ]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [imageForm, setImageForm] = useState({ url: '', title: '' });

  // Auto-slide effect
  useEffect(() => {
    if (!isAutoPlay || images.length <= 1 || activeTab !== 'gallery') return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isAutoPlay, images.length, activeTab]);

  // Fetch AI tech news
  const fetchAiNews = useCallback(async () => {
    setAiLoading(true);
    try {
      // Mock AI-generated tech news - replace with actual API call
      const mockNews: TechNewsItem[] = [
        { id: '1', title: 'GPT-5 Introduces Revolutionary Code Generation', url: 'https://openai.com', source: 'OpenAI Blog', publishedAt: new Date().toISOString(), category: 'AI', summary: 'New capabilities in automated programming assistance.' },
        { id: '2', title: '.NET 9 Performance Improvements for Cloud-Native Apps', url: 'https://devblogs.microsoft.com', source: 'Microsoft DevBlogs', publishedAt: new Date(Date.now() - 86400000).toISOString(), category: '.NET', summary: 'Significant improvements in AOT compilation and startup time.' },
        { id: '3', title: 'Angular 18 Signals: Complete Migration Guide', url: 'https://angular.io', source: 'Angular Blog', publishedAt: new Date(Date.now() - 172800000).toISOString(), category: 'Angular', summary: 'Step-by-step guide to migrate from RxJS to Signals.' },
        { id: '4', title: 'Azure AI Services: New Multimodal Capabilities', url: 'https://azure.microsoft.com', source: 'Azure Updates', publishedAt: new Date(Date.now() - 259200000).toISOString(), category: 'Azure', summary: 'Vision, speech, and language models unified API.' },
        { id: '5', title: 'TypeScript 5.5: Inferred Type Predicates', url: 'https://devblogs.microsoft.com', source: 'TypeScript Blog', publishedAt: new Date(Date.now() - 345600000).toISOString(), category: 'TypeScript', summary: 'Automatic narrowing without explicit type guards.' },
        { id: '6', title: 'Copilot Workspace: AI-Powered Development Environment', url: 'https://github.com', source: 'GitHub Blog', publishedAt: new Date(Date.now() - 432000000).toISOString(), category: 'AI', summary: 'Full development workflow with AI assistance.' },
        { id: '7', title: 'Entity Framework Core 9: Bulk Operations', url: 'https://devblogs.microsoft.com', source: 'Microsoft DevBlogs', publishedAt: new Date(Date.now() - 518400000).toISOString(), category: '.NET', summary: 'Native support for bulk insert, update, delete.' },
        { id: '8', title: 'Claude 4 Opus: Advanced Reasoning for Enterprise', url: 'https://anthropic.com', source: 'Anthropic', publishedAt: new Date(Date.now() - 604800000).toISOString(), category: 'AI', summary: 'Extended context window and improved code analysis.' },
      ];
      setAiNews(mockNews);
    } catch (err) {
      console.error('Failed to fetch AI news:', err);
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ai-feed' && aiNews.length === 0) {
      fetchAiNews();
    }
  }, [activeTab, aiNews.length, fetchAiNews]);

  const handleAdd = async () => {
    if (!form.title) return;
    await addKnowledgeShare(form);
    setForm({ title: '', url: '', category: 'Article', description: '' });
    setShowAdd(false);
    onRefresh();
  };

  const handleAddImage = () => {
    if (!imageForm.url || !imageForm.title) return;
    setImages(prev => [...prev, {
      id: Date.now().toString(),
      url: imageForm.url,
      title: imageForm.title,
      uploadedBy: 'You',
      uploadedAt: new Date().toISOString()
    }]);
    setImageForm({ url: '', title: '' });
    setShowImageUpload(false);
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    if (currentSlide >= images.length - 1) setCurrentSlide(0);
  };

  const catIcon: Record<string, string> = { Article: '📄', Video: '🎥', Tool: '🔧', 'Best Practice': '⭐', Tutorial: '📖' };
  const techIcon: Record<string, string> = { AI: '🤖', '.NET': '🟣', Angular: '🅰️', TypeScript: '💙', Azure: '☁️', General: '📰' };
  const techColor: Record<string, string> = {
    AI: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    '.NET': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    Angular: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    TypeScript: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    Azure: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    General: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  };

  const filteredNews = selectedTechFilter === 'all' 
    ? aiNews 
    : aiNews.filter(n => n.category === selectedTechFilter);

  const tabs = [
    { key: 'shared', label: 'Shared', icon: '📚', count: data.length },
    { key: 'ai-feed', label: 'AI Feed', icon: '🤖', count: aiNews.length },
    { key: 'gallery', label: 'Gallery', icon: '🖼️', count: images.length },
  ] as const;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header with Tabs */}
      <div className="border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                  activeTab === tab.key
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* Tab-specific actions */}
          <div className="flex items-center gap-1">
            {activeTab === 'shared' && isAdmin && (
              <button onClick={() => setShowAdd(!showAdd)}
                className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                {showAdd ? 'Cancel' : '+ Share'}
              </button>
            )}
            {activeTab === 'ai-feed' && (
              <button onClick={fetchAiNews} disabled={aiLoading}
                className="text-[10px] px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                {aiLoading ? '⏳' : '🔄'} Refresh
              </button>
            )}
            {activeTab === 'gallery' && isAdmin && (
              <button onClick={() => setShowImageUpload(!showImageUpload)}
                className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                {showImageUpload ? 'Cancel' : '+ Image'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-3">
        {/* ── Shared Tab ── */}
        {activeTab === 'shared' && (
          <>
            {isAdmin && showAdd && (
              <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded space-y-1.5">
                <div className="grid grid-cols-3 gap-1.5">
                  <input placeholder="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  <input placeholder="URL" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                    className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    {['Article', 'Video', 'Tool', 'Best Practice', 'Tutorial', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <input placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="flex-1 text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  <button onClick={handleAdd} className="text-[10px] px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Share</button>
                </div>
              </div>
            )}
            {data.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center py-4">
                {isAdmin ? "Share articles, tools, and best practices." : "No shared knowledge yet."}
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-1">
                {data.map(k => (
                  <div key={k.id} className="flex items-start justify-between text-[11px] py-1.5 px-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
                    <div className="min-w-0 flex-1">
                      <span className="mr-1">{catIcon[k.category || ''] || '📌'}</span>
                      {k.url ? (
                        <a href={k.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">{k.title}</a>
                      ) : (
                        <span className="font-medium text-gray-900 dark:text-white">{k.title}</span>
                      )}
                      {k.description && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{k.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[9px] text-gray-400">{k.sharedBy}</span>
                      {isAdmin && <button onClick={() => { removeKnowledgeShare(k.id); onRefresh(); }}
                        className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">✕</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── AI Feed Tab ── */}
        {activeTab === 'ai-feed' && (
          <>
            {/* Tech Filter Pills */}
            <div className="flex flex-wrap gap-1 mb-3">
              <button
                onClick={() => setSelectedTechFilter('all')}
                className={`text-[9px] px-2 py-1 rounded-full transition-all ${
                  selectedTechFilter === 'all'
                    ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
              {['AI', '.NET', 'Angular', 'TypeScript', 'Azure'].map(tech => (
                <button
                  key={tech}
                  onClick={() => setSelectedTechFilter(tech)}
                  className={`text-[9px] px-2 py-1 rounded-full transition-all flex items-center gap-1 ${
                    selectedTechFilter === tech
                      ? techColor[tech]
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {techIcon[tech]} {tech}
                </button>
              ))}
            </div>

            {aiLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                <span className="ml-2 text-[11px] text-gray-500">Fetching latest tech news...</span>
              </div>
            ) : filteredNews.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center py-4">No news found. Click refresh to fetch.</p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-2">
                {filteredNews.map(news => (
                  <a
                    key={news.id}
                    href={news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all group"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{techIcon[news.category]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${techColor[news.category]}`}>
                            {news.category}
                          </span>
                          <span className="text-[9px] text-gray-400">{news.source}</span>
                        </div>
                        <h4 className="text-[11px] font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 leading-tight">
                          {news.title}
                        </h4>
                        {news.summary && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{news.summary}</p>
                        )}
                        <span className="text-[9px] text-gray-400 mt-1 block">
                          {new Date(news.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Gallery Tab ── */}
        {activeTab === 'gallery' && (
          <>
            {isAdmin && showImageUpload && (
              <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded space-y-1.5">
                <input placeholder="Image URL *" value={imageForm.url} onChange={e => setImageForm(p => ({ ...p, url: e.target.value }))}
                  className="w-full text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                <div className="flex gap-1.5">
                  <input placeholder="Title *" value={imageForm.title} onChange={e => setImageForm(p => ({ ...p, title: e.target.value }))}
                    className="flex-1 text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  <button onClick={handleAddImage} className="text-[10px] px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Add</button>
                </div>
              </div>
            )}

            {images.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center py-4">No images shared yet.</p>
            ) : (
              <div className="space-y-2">
                {/* Main Slider */}
                <div className="relative rounded-lg overflow-hidden bg-gray-900 aspect-video">
                  <img
                    src={images[currentSlide]?.url}
                    alt={images[currentSlide]?.title}
                    className="w-full h-full object-cover transition-opacity duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x450?text=Image+Not+Found'; }}
                  />
                  {/* Overlay Info */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <h4 className="text-white text-sm font-medium">{images[currentSlide]?.title}</h4>
                    <p className="text-gray-300 text-[10px]">
                      by {images[currentSlide]?.uploadedBy} • {new Date(images[currentSlide]?.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {/* Navigation Arrows */}
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentSlide(p => (p - 1 + images.length) % images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center"
                      >
                        ‹
                      </button>
                      <button
                        onClick={() => setCurrentSlide(p => (p + 1) % images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center"
                      >
                        ›
                      </button>
                    </>
                  )}
                  {/* Auto-play Toggle */}
                  <button
                    onClick={() => setIsAutoPlay(!isAutoPlay)}
                    className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                      isAutoPlay ? 'bg-green-500 text-white' : 'bg-gray-600 text-white'
                    }`}
                    title={isAutoPlay ? 'Pause auto-slide' : 'Start auto-slide'}
                  >
                    {isAutoPlay ? '⏸' : '▶'}
                  </button>
                  {/* Delete Button (admin only) */}
                  {isAdmin && (
                    <button
                      onClick={() => removeImage(images[currentSlide]?.id)}
                      className="absolute top-2 left-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] hover:bg-red-600"
                      title="Remove image"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Thumbnail Strip */}
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentSlide(idx)}
                      className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                        idx === currentSlide
                          ? 'border-blue-500 ring-2 ring-blue-300'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={img.url} alt={img.title} className="w-full h-full object-cover" 
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/100?text=?'; }} />
                    </button>
                  ))}
                </div>

                {/* Slide Indicators */}
                <div className="flex justify-center gap-1">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        idx === currentSlide ? 'bg-blue-500 w-4' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
