import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLazyWidget } from '../hooks/useLazyWidget';
import { useInternalDashboardHub } from '../hooks/useInternalDashboardHub';
import {
  getSummary, getBranches, getPRSummary, getCommitStats,
  getKnowledgeShares, getProductionSupport, getApiCatalog,
  getCustomersOverview, addKnowledgeShare, addApiCatalogEntry,
  uploadFile, downloadTemplate, removeKnowledgeShare, removeApiCatalogEntry,
  getDashboardConfig, updateDashboardConfig, resetDashboardConfig, parseWidgets, parseMetrics,
  getSeverityColor, getStatusColor, getJenkinsBuilds,
  type DashboardSummary, type BuildInfo, type BranchesResponse,
  type PRSummaryResponse, type CommitStatsResponse, type BirthdayInfo,
  type KnowledgeShareInfo, type ProductionSupportResponse, type ApiCatalogInfo,
  type CustomersOverviewResponse, type WidgetConfig, type MetricConfig,
  type JenkinsBuildsResponse,
} from '../services/internalDashboardService';

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

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────

export default function InternalDashboardPage() {
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
  const hubTriedRef = useRef(false);

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

  const toggleWidget = useCallback((key: string) => {
    setWidgets(prev => prev.map(w => w.key === key ? { ...w, enabled: !w.enabled } : w));
  }, []);

  const toggleMetric = useCallback((key: string) => {
    setMetrics(prev => prev.map(m => m.key === key ? { ...m, enabled: !m.enabled } : m));
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
    <div className="p-4 lg:p-6 max-w-[1800px] mx-auto space-y-5">
      {/* ── Overview Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Choose a dashboard or customize your view below
          </p>
        </div>
        <div className="flex items-center gap-2">
          {summary?.generatedAt && (
            <span className="text-[10px] text-gray-400">
              {new Date(summary.generatedAt).toLocaleTimeString()}
            </span>
          )}
          <button onClick={() => setEditMode(!editMode)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${editMode
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
              : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {editMode ? '✏️ Editing' : '⚙️ Customize'}
          </button>
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

      {/* ── Template Cards — quick-switch dashboards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
      </div>

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

      {/* ── Edit Mode: Widget/Metric Config Panel ── */}
      {editMode && (
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
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">Widgets</p>
            <div className="flex flex-wrap gap-2">
              {widgets.map(w => (
                <button key={w.key} onClick={() => toggleWidget(w.key)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${w.enabled
                    ? 'bg-white dark:bg-gray-800 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 font-medium shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 line-through'
                  }`}>
                  <span>{w.icon}</span> {w.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Row 1: Key Metrics (config-driven) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryLoading ? (
          Array.from({ length: 6 }).map((_, i) => <MetricSkeleton key={i} />)
        ) : (
          enabledMetrics.map(m => (
            <MetricFromConfig key={m.key} config={m} summary={summary} />
          ))
        )}
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
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// Config-driven Metric
// ─────────────────────────────────────────

function MetricFromConfig({ config, summary }: { config: MetricConfig; summary: DashboardSummary | null }) {
  const d = summary?.devops;
  const map: Record<string, { value: string | number; sub?: string; dynColor?: string }> = {
    openPRs:       { value: d?.openPRs ?? '—', sub: d?.connected ? `${d.prsWaitingApproval} waiting` : 'Not connected' },
    todayBuilds:   { value: d?.todayBuilds?.total ?? '—', sub: d?.todayBuilds ? `${d.todayBuilds.succeeded} ok / ${d.todayBuilds.failed} fail` : undefined, dynColor: d?.todayBuilds?.failed ? 'red' : undefined },
    commits7d:     { value: d?.totalCommits ?? '—', sub: d?.commitsToday ? `${d.commitsToday} today` : undefined },
    prWaiting:     { value: d?.prsWaitingApproval ?? '—' },
    customers:     { value: summary?.customers?.total ?? 0 },
    openIncidents: { value: summary?.support?.openIncidents ?? 0, dynColor: summary?.support?.openIncidents ? 'red' : undefined },
  };
  const entry = map[config.key] || { value: '—' };
  return <Metric label={config.label} value={entry.value} sub={entry.sub} color={entry.dynColor || config.color} />;
}

// ─────────────────────────────────────────
// Lazy Widget Renderer
// ─────────────────────────────────────────

function LazyWidgetRenderer({ config, summary, expandedWidget, setExpandedWidget, onRefresh }: {
  config: WidgetConfig;
  summary: DashboardSummary | null;
  expandedWidget: string | null;
  setExpandedWidget: (k: string | null) => void;
  onRefresh: () => void;
}) {
  switch (config.key) {
    case 'branches': return <LazyBranches expanded={expandedWidget === 'branches'} toggle={() => setExpandedWidget(expandedWidget === 'branches' ? null : 'branches')} />;
    case 'birthdays': return <BirthdaysWidget birthdays={summary?.birthdays || []} />;
    case 'recentActivity': return <RecentActivityWidget data={summary?.devops?.recentActivity} />;
    case 'knowledge': return <LazyKnowledge onRefresh={onRefresh} />;
    case 'builds':    return <TodayBuildsWidget builds={summary?.devops?.todayBuilds?.builds || []} />;
    case 'jenkinsBuilds': return <LazyJenkinsBuilds expanded={expandedWidget === 'jenkinsBuilds'} toggle={() => setExpandedWidget(expandedWidget === 'jenkinsBuilds' ? null : 'jenkinsBuilds')} />;
    case 'prs':       return <LazyPRs expanded={expandedWidget === 'prs'} toggle={() => setExpandedWidget(expandedWidget === 'prs' ? null : 'prs')} />;
    case 'commits':   return <LazyCommitStats />;
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

function LazyPRs({ expanded, toggle }: { expanded: boolean; toggle: () => void }) {
  const fetcher = useCallback(() => getPRSummary(), []);
  const { ref, data, loading } = useLazyWidget(fetcher);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="Pull Requests" icon="🔃" /> :
        <PRWidget data={data} expanded={expanded} toggle={toggle} />}
    </div>
  );
}

function LazyJenkinsBuilds({ expanded, toggle }: { expanded: boolean; toggle: () => void }) {
  const fetcher = useCallback(() => getJenkinsBuilds(), []);
  const { ref, data, loading, reload } = useLazyWidget(fetcher);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="Jenkins Builds" icon="🔧" /> :
        <JenkinsBuildsWidget data={data} expanded={expanded} toggle={toggle} onRefresh={reload} />}
    </div>
  );
}

function LazyCommitStats() {
  const fetcher = useCallback(() => getCommitStats(undefined, 30), []);
  const { ref, data, loading } = useLazyWidget(fetcher);
  return (
    <div ref={ref}>
      {loading ? <WidgetSkeleton title="Commits + LOC" icon="📊" /> :
        <CommitStatsWidget data={data} />}
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

function JenkinsBuildsWidget({ data, expanded, toggle, onRefresh }: {
  data: JenkinsBuildsResponse | null; expanded: boolean; toggle: () => void; onRefresh: () => void;
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
                    <div key={b.number} className="flex items-center justify-between text-[10px] px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-600/30">
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
// PR Widget
// ─────────────────────────────────────────

function PRWidget({ data, expanded, toggle }: { data: PRSummaryResponse | null; expanded: boolean; toggle: () => void }) {
  if (!data) return <Widget title="Pull Requests" icon="🔃" empty emptyText="No DevOps connection"><></></Widget>;

  const waiting = data.prs.filter(pr => !pr.isApproved && !pr.isDraft);
  const maxShow = expanded ? 50 : 5;

  return (
    <Widget title="Pull Requests" icon="🔃"
      actions={
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-purple-600 dark:text-purple-400 font-medium">{data.totalActive} active</span>
          <span className="text-red-600 dark:text-red-400 font-medium">{data.waitingApproval} waiting</span>
          <span className="text-green-600 dark:text-green-400 font-medium">{data.approved} approved</span>
          {waiting.length > 5 && (
            <button onClick={toggle} className="text-blue-500 hover:underline">{expanded ? 'Less' : 'More'}</button>
          )}
        </div>
      }>
      {waiting.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">No PRs waiting approval</p>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {waiting.slice(0, maxShow).map(pr => (
            <div key={pr.pullRequestId} className="flex items-start justify-between text-xs py-1.5 px-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className="min-w-0 flex-1">
                <a href={pr.url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline">
                  #{pr.pullRequestId}
                </a>
                <span className="text-gray-800 dark:text-gray-200 ml-1 truncate">{pr.title}</span>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {pr.createdBy} &bull; {pr.repositoryName} &bull;
                  <span className="font-mono"> {pr.sourceBranch?.replace('refs/heads/', '')}</span>
                  {' → '}
                  <span className="font-mono">{pr.targetBranch?.replace('refs/heads/', '')}</span>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                {new Date(pr.creationDate).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ─────────────────────────────────────────
// Commit Stats Widget
// ─────────────────────────────────────────

function CommitStatsWidget({ data }: { data: CommitStatsResponse | null }) {
  if (!data) return <Widget title="Commits + LOC" icon="📊" empty emptyText="No commit data"><></></Widget>;

  const periodLabel = data.isAllTime ? 'All Time' : `${data.daysBack}d`;
  const lastCommit = data.lastCommitDate ? new Date(data.lastCommitDate).toLocaleDateString() : null;

  return (
    <Widget title={`Commits (${periodLabel}) — ${data.totalCommits} total, ${data.totalChanges} changes`} icon="📊">
      {data.isAllTime && lastCommit && (
        <div className="mb-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[10px] text-amber-700 dark:text-amber-300">
          No commits in last {data.daysBack} days — showing all-time data. Last commit: {lastCommit}
        </div>
      )}
      {data.byAuthor.length > 0 ? (
        <div className="space-y-1.5">
          {data.byAuthor.slice(0, 8).map(a => (
            <div key={a.author} className="flex items-center gap-2">
              <span className="w-28 text-xs text-gray-800 dark:text-gray-200 truncate">{a.author}</span>
              <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.min((a.commits / (data.byAuthor[0]?.commits || 1)) * 100, 100)}%` }} />
              </div>
              <span className="text-[10px] font-mono text-gray-500 w-12 text-right">{a.commits}c</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-2">No commits in this period</p>
      )}
      {data.recentCommits.length > 0 && (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-2 space-y-0.5 max-h-32 overflow-y-auto">
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Recent</p>
          {data.recentCommits.slice(0, 5).map(c => (
            <div key={c.shortCommitId} className="flex items-start gap-1.5 text-[11px]">
              <span className="font-mono text-blue-600 dark:text-blue-400 shrink-0">{c.shortCommitId}</span>
              <span className="text-gray-800 dark:text-gray-200 truncate flex-1">{c.comment}</span>
              <span className="text-gray-400 shrink-0">{c.authorName?.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ─────────────────────────────────────────
// Birthdays Widget
// ─────────────────────────────────────────

function BirthdaysWidget({ birthdays }: { birthdays: BirthdayInfo[] }) {
  return (
    <Widget title="Birthdays" icon="🎂" empty={!birthdays.length}
      emptyText="No upcoming birthdays. Upload team members via Excel.">
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {birthdays.map(b => (
          <div key={b.id} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${
            b.isToday ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}>
            <div>
              <span className="font-medium text-gray-900 dark:text-white">{b.isToday && '🎉 '}{b.name}</span>
              {b.role && <span className="text-gray-400 ml-1.5 text-[10px]">{b.role}</span>}
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              b.isToday ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-bold' : 'text-gray-500'
            }`}>
              {b.isToday ? 'Today!' : `${b.daysUntil}d`}
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
              <div key={pr.pullRequestId} className="flex items-start justify-between text-xs py-1.5 px-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-2 border-transparent hover:border-purple-400">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      pr.status === 'completed' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    }`}>
                      {pr.status === 'completed' ? '✓ Merged' : '↻ Active'}
                    </span>
                    <a href={pr.url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline font-mono">
                      #{pr.pullRequestId}
                    </a>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 truncate mt-0.5">{pr.title}</p>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {pr.createdBy} • {pr.repositoryName} •
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
  return (
    <Widget title="Current Customers" icon="🏢"
      empty={!data || data.total === 0}
      emptyText="Upload customer Excel to populate."
      actions={
        <div className="flex items-center gap-1">
          <UploadBtn label="Upload" endpoint="customers/upload" onDone={onRefresh} />
          <TemplateBtn type="customers" />
        </div>
      }>
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
  return (
    <Widget title="Production Support" icon="🛟"
      empty={!data || data.summary.total === 0}
      emptyText="Upload production support Excel."
      actions={
        <div className="flex items-center gap-1">
          <UploadBtn label="Upload" endpoint="production-support/upload" onDone={onRefresh} />
          <TemplateBtn type="production-support" />
        </div>
      }>
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
      emptyText="Document your product APIs."
      actions={
        <button onClick={() => setShowAdd(!showAdd)}
          className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
          {showAdd ? 'Cancel' : '+ Add'}
        </button>
      }>
      {showAdd && (
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
                <button onClick={() => { removeApiCatalogEntry(a.id); onRefresh(); }}
                  className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ─────────────────────────────────────────
// Knowledge Sharing Widget
// ─────────────────────────────────────────

function KnowledgeWidget({ data, onRefresh }: { data: KnowledgeShareInfo[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', category: 'Article', description: '' });

  const handleAdd = async () => {
    if (!form.title) return;
    await addKnowledgeShare(form);
    setForm({ title: '', url: '', category: 'Article', description: '' });
    setShowAdd(false);
    onRefresh();
  };

  const catIcon: Record<string, string> = { Article: '📄', Video: '🎥', Tool: '🔧', 'Best Practice': '⭐', Tutorial: '📖' };

  return (
    <Widget title={`Knowledge Sharing (${data.length})`} icon="📚"
      empty={data.length === 0 && !showAdd}
      emptyText="Share articles, tools, and best practices."
      actions={
        <button onClick={() => setShowAdd(!showAdd)}
          className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
          {showAdd ? 'Cancel' : '+ Share'}
        </button>
      }>
      {showAdd && (
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
      {data.length > 0 && (
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
                <button onClick={() => { removeKnowledgeShare(k.id); onRefresh(); }}
                  className="text-[10px] text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}
