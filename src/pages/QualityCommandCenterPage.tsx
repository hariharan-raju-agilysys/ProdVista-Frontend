import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  getConnections, getKpiSummary, getBugs, getMyBugs, getTrend,
  getAgingDistribution, getCustomerIssues, getOwnerEfficiency,
  QualityConnection, KpiSummary, QualityWorkItemDto, QualityTrendPointDto,
  BugAgingDistributionDto, CustomerIssueGroupDto, OwnerEfficiencyDto,
  getSeverityColor, getStateColor, formatDate
} from '../services/qualityService';
import {
  smartQuery, getPanels, savePanel, togglePin, deletePanel, markExecuted,
  SmartQueryInterpretation, QualityQueryPanelDto
} from '../services/qualityCommandService';
import {
  Search, Sparkles, Loader2, RefreshCw, X, Pin, PinOff, Trash2, Play,
  Bug, Target, Activity, TrendingUp, TrendingDown, Users, Calendar,
  BarChart3, AlertTriangle, Shield, Clock, Save, Bookmark,
  ExternalLink, ChevronDown, ChevronRight, Flame, Zap, Eye, Layout,
  ListChecks, LineChart, Terminal, Download, Image, Table2, FileText, ClipboardCopy
} from 'lucide-react';

// ============================================================================
// Endpoint → Service Function Map
// ============================================================================
const ENDPOINT_EXECUTOR: Record<string, (params: Record<string, unknown>, connectionId?: string) => Promise<unknown>> = {
  'summary': (p, c) => import('../services/qualityService').then(m => m.getQualitySummary(c, p.iterationPath as string)),
  'bugs': (p, c) => import('../services/qualityService').then(m => m.getBugs(p as never, c)),
  'my-bugs': (p, c) => import('../services/qualityService').then(m => m.getMyBugs(c, p.iterationPath as string, p.state as string)),
  'releases': (_, c) => import('../services/qualityService').then(m => m.getReleases(c)),
  'owner-efficiency': (p, c) => import('../services/qualityService').then(m => m.getOwnerEfficiency(c, p.iterationPath as string)),
  'trend': (p, c) => import('../services/qualityService').then(m => m.getTrend(p.days as number, c, p.iterationPath as string)),
  'aging': (p, c) => import('../services/qualityService').then(m => m.getAgingDistribution(c, p.iterationPath as string)),
  'kpi-summary': (p, c) => import('../services/qualityService').then(m => m.getKpiSummary(c, p.areaPath as string)),
  'features': (p) => import('../services/qualityService').then(m => m.getFeatureGroups(p.iterationPath as string)),
  'pull-requests': (p, c) => import('../services/qualityService').then(m => m.getPullRequests(c, p.status as string, p.top as number)),
  'pipelines': (_, c) => import('../services/qualityService').then(m => m.getPipelines(c)),
  'builds': (p, c) => import('../services/qualityService').then(m => m.getBuilds(c, p.top as number)),
  'board-summary': (p, c) => import('../services/qualityService').then(m => m.getBoardSummary(c, p.iterationPath as string)),
  'sprint-work-items': (p, c) => import('../services/qualityService').then(m => m.getSprintWorkItems(c, p.iterationPath as string)),
  'bug-analytics/by-area': (p) => import('../services/qualityService').then(m => m.getBugsByArea(p as never)),
  'bug-analytics/team-summary': (p) => import('../services/qualityService').then(m => m.getTeamSummary(p as never)),
  'bug-analytics/user-analysis': (p) => import('../services/qualityService').then(m => m.getUserBugAnalysis(p as never)),
  'bug-analytics/feature-children': (p) => import('../services/qualityService').then(m => m.getFeatureChildrenStatus(p as never)),
};

// ============================================================================
// Quick Actions & Tabs
// ============================================================================
const QUICK_ACTIONS = [
  { label: 'Critical Bugs', prompt: 'Show all critical active bugs', icon: AlertTriangle, color: 'red' },
  { label: 'My Items', prompt: 'Show my assigned bugs', icon: Users, color: 'blue' },
  { label: 'Sprint Health', prompt: 'Show current sprint summary', icon: Target, color: 'green' },
  { label: 'Bug Trend', prompt: 'Show bug creation vs resolution trend last 30 days', icon: TrendingUp, color: 'purple' },
  { label: 'Team Efficiency', prompt: 'Show team efficiency metrics', icon: BarChart3, color: 'amber' },
  { label: 'Release Status', prompt: 'Show release iteration status', icon: Calendar, color: 'teal' },
  { label: 'Aging Bugs', prompt: 'Show aging distribution of active bugs', icon: Clock, color: 'orange' },
  { label: 'Bug Hotspots', prompt: 'Show bugs by area to find hotspots', icon: Shield, color: 'pink' },
  { label: 'Employee Progress', prompt: 'Show employee wise bug resolution progress with efficiency', icon: Users, color: 'indigo' },
];

type TabId = 'overview' | 'triage' | 'mywork' | 'analytics' | 'query';

const TABS: { id: TabId; label: string; icon: React.ElementType; leadershipOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: Layout },
  { id: 'triage', label: 'Triage Queue', icon: ListChecks },
  { id: 'mywork', label: 'My Work', icon: Bug },
  { id: 'analytics', label: 'Analytics', icon: LineChart, leadershipOnly: true },
  { id: 'query', label: 'Smart Query', icon: Terminal },
];

// ============================================================================
// Priority urgency helpers
// ============================================================================
function getUrgencyLevel(bug: QualityWorkItemDto): 'critical' | 'high' | 'medium' | 'low' {
  if (bug.severity === '1 - Critical' || (bug.priority != null && bug.priority <= 1)) return 'critical';
  if (bug.severity === '2 - High' || (bug.priority != null && bug.priority === 2)) return 'high';
  if (bug.severity === '3 - Medium') return 'medium';
  return 'low';
}

function getUrgencyBadge(level: string) {
  switch (level) {
    case 'critical': return { bg: 'bg-red-500', text: 'text-white', label: 'P0 — Fix Now' };
    case 'high': return { bg: 'bg-orange-500', text: 'text-white', label: 'P1 — Next' };
    case 'medium': return { bg: 'bg-yellow-400', text: 'text-yellow-900', label: 'P2 — Soon' };
    default: return { bg: 'bg-gray-200', text: 'text-gray-700', label: 'P3 — Backlog' };
  }
}

function getAgingColor(days: number): string {
  if (days > 30) return 'text-red-600 font-bold';
  if (days > 14) return 'text-orange-600 font-semibold';
  if (days > 7) return 'text-yellow-600';
  return 'text-gray-500';
}

// ============================================================================
// Main Component
// ============================================================================
export default function QualityCommandCenterPage() {
  const { user, isManager, isAdmin } = useAuth();
  const isLeadership = isManager || isAdmin;
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // URL-driven customer filter
  const customerFilter = searchParams.get('customer') || '';
  const filterType = searchParams.get('filter') || '';

  const clearCustomerFilter = () => {
    searchParams.delete('customer');
    searchParams.delete('filter');
    setSearchParams(searchParams, { replace: true });
  };

  // Connection state
  const [connections, setConnections] = useState<QualityConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | undefined>();

  // Dashboard data
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [allBugs, setAllBugs] = useState<QualityWorkItemDto[]>([]);
  const [myBugsData, setMyBugsData] = useState<QualityWorkItemDto[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [trend, setTrend] = useState<QualityTrendPointDto[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendDays, setTrendDays] = useState(90);
  const [aging, setAging] = useState<BugAgingDistributionDto[]>([]);
  const [agingLoading, setAgingLoading] = useState(false);
  const [customerIssues, setCustomerIssues] = useState<CustomerIssueGroupDto[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [efficiency, setEfficiency] = useState<OwnerEfficiencyDto[]>([]);
  const [efficiencyLoading, setEfficiencyLoading] = useState(false);

  // Bug table view
  const [bugView, setBugView] = useState<'priority' | 'mine'>(isLeadership ? 'priority' : 'mine');

  // Smart query
  const [prompt, setPrompt] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [interpretation, setInterpretation] = useState<SmartQueryInterpretation | null>(null);
  const [queryResult, setQueryResult] = useState<unknown>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Saved panels
  const [panels, setPanels] = useState<QualityQueryPanelDto[]>([]);
  const [panelsLoading, setPanelsLoading] = useState(false);
  const [panelResults, setPanelResults] = useState<Record<string, unknown>>({});
  const [panelLoadingIds, setPanelLoadingIds] = useState<Set<string>>(new Set());

  // Expanded bug detail
  const [expandedBugId, setExpandedBugId] = useState<number | null>(null);

  // Triage grouping
  const [triageGroupBy, setTriageGroupBy] = useState<'severity' | 'area' | 'assignee'>('severity');

  const promptRef = useRef<HTMLInputElement | null>(null);

  // ---- Init ----
  useEffect(() => {
    loadConnections();
    loadPanels();
  }, []);

  useEffect(() => {
    if (selectedConnectionId) loadAllDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnectionId]);

  const loadConnections = async () => {
    try {
      const conns = await getConnections();
      setConnections(conns);
      if (conns.length > 0) setSelectedConnectionId(conns[0].id);
    } catch { /* skip */ }
  };

  const loadAllDashboardData = async () => {
    loadKpi();
    loadBugs();
    loadTrend();
    loadAging();
    if (isLeadership) {
      loadCustomerIssues();
      loadEfficiency();
    }
  };

  const loadKpi = async () => {
    setKpiLoading(true);
    try { setKpi(await getKpiSummary(selectedConnectionId)); } catch { /* skip */ }
    setKpiLoading(false);
  };

  const loadBugs = async () => {
    setBugsLoading(true);
    try {
      const [bugs, mine] = await Promise.all([
        getBugs({ state: 'Active' }, selectedConnectionId),
        getMyBugs(selectedConnectionId)
      ]);
      const sortBugs = (arr: QualityWorkItemDto[]) => [...arr].sort((a, b) => {
        const sevA = a.severity === '1 - Critical' ? 0 : a.severity === '2 - High' ? 1 : a.severity === '3 - Medium' ? 2 : 3;
        const sevB = b.severity === '1 - Critical' ? 0 : b.severity === '2 - High' ? 1 : b.severity === '3 - Medium' ? 2 : 3;
        if (sevA !== sevB) return sevA - sevB;
        return (b.ageDays ?? 0) - (a.ageDays ?? 0);
      });
      setAllBugs(sortBugs(bugs));
      setMyBugsData(sortBugs(mine));
    } catch { /* skip */ }
    setBugsLoading(false);
  };

  const loadTrend = async (days?: number) => {
    setTrendLoading(true);
    try { setTrend(await getTrend(days ?? trendDays, selectedConnectionId)); } catch { /* skip */ }
    setTrendLoading(false);
  };

  const handleTrendDaysChange = (days: number) => {
    setTrendDays(days);
    loadTrend(days);
  };

  const loadAging = async () => {
    setAgingLoading(true);
    try { setAging(await getAgingDistribution(selectedConnectionId)); } catch { /* skip */ }
    setAgingLoading(false);
  };

  const loadCustomerIssues = async () => {
    setCustomerLoading(true);
    try { setCustomerIssues(await getCustomerIssues()); } catch { /* skip */ }
    setCustomerLoading(false);
  };

  const loadEfficiency = async () => {
    setEfficiencyLoading(true);
    try { setEfficiency(await getOwnerEfficiency(selectedConnectionId)); } catch { /* skip */ }
    setEfficiencyLoading(false);
  };

  const loadPanels = async () => {
    setPanelsLoading(true);
    try { setPanels(await getPanels()); } catch { /* skip */ }
    setPanelsLoading(false);
  };

  // ---- Smart Query ----
  const executeSmartQuery = useCallback(async (queryPrompt: string) => {
    if (!queryPrompt.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setInterpretation(null);
    try {
      const res = await smartQuery(queryPrompt, selectedConnectionId);
      if (!res.success) { setQueryError(res.error || 'Query interpretation failed'); return; }
      setInterpretation(res.interpretation);
      const executor = ENDPOINT_EXECUTOR[res.interpretation.endpointKey];
      if (executor) {
        const data = await executor(res.interpretation.parameters, selectedConnectionId);
        setQueryResult(data);
      } else {
        setQueryError(`Endpoint "${res.interpretation.endpointKey}" not yet mapped`);
      }
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : 'Unexpected error');
    } finally { setQueryLoading(false); }
  }, [selectedConnectionId]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); executeSmartQuery(prompt); };

  // ---- Panel actions ----
  const handleSavePanel = async () => {
    if (!interpretation) return;
    try {
      await savePanel({
        name: interpretation.suggestedName || prompt.slice(0, 60),
        prompt,
        endpointKey: interpretation.endpointKey,
        parameters: JSON.stringify(interpretation.parameters),
        visualizationType: interpretation.visualizationType,
        visualizationConfig: JSON.stringify(interpretation.visualization),
        isPinned: false,
      });
      await loadPanels();
    } catch { /* skip */ }
  };

  const handleRunPanel = async (panel: QualityQueryPanelDto) => {
    setPanelLoadingIds(prev => new Set(prev).add(panel.id));
    try {
      const executor = ENDPOINT_EXECUTOR[panel.endpointKey];
      if (executor) {
        const params = JSON.parse(panel.parameters || '{}');
        const data = await executor(params, selectedConnectionId);
        setPanelResults(prev => ({ ...prev, [panel.id]: data }));
        await markExecuted(panel.id);
      }
    } catch { /* skip */ }
    setPanelLoadingIds(prev => { const n = new Set(prev); n.delete(panel.id); return n; });
  };

  const handleTogglePin = async (panel: QualityQueryPanelDto) => {
    await togglePin(panel.id);
    setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, isPinned: !p.isPinned } : p));
  };

  const handleDeletePanel = async (id: string) => {
    await deletePanel(id);
    setPanels(prev => prev.filter(p => p.id !== id));
    setPanelResults(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // ---- Derived data ----
  const criticalBugs = useMemo(() => allBugs.filter(b => b.severity === '1 - Critical' && (b.state === 'Active' || b.state === 'New')), [allBugs]);
  const staleCount = useMemo(() => allBugs.filter(b => b.ageDays > 14 && (b.state === 'Active' || b.state === 'New')).length, [allBugs]);

  const displayBugs = useMemo(() => {
    let bugs = bugView === 'mine' ? myBugsData : allBugs;
    if (customerFilter) {
      bugs = bugs.filter(b =>
        b.customer?.toLowerCase() === customerFilter.toLowerCase() ||
        b.title?.toLowerCase().includes(customerFilter.toLowerCase())
      );
      if (filterType === 'open') bugs = bugs.filter(b => b.state === 'Active' || b.state === 'New');
      else if (filterType === 'closed') bugs = bugs.filter(b => b.state === 'Closed' || b.state === 'Resolved');
      else if (filterType === 'critical') bugs = bugs.filter(b => b.severity === '1 - Critical');
      else if (filterType === 'aging') bugs = bugs.filter(b => b.ageDays > 7 && (b.state === 'Active' || b.state === 'New'));
    }
    return bugs;
  }, [bugView, myBugsData, allBugs, customerFilter, filterType]);

  // Triage grouped data
  const triageGroups = useMemo(() => {
    const activeBugs = allBugs.filter(b => b.state === 'Active' || b.state === 'New');
    const groups: Record<string, QualityWorkItemDto[]> = {};
    for (const bug of activeBugs) {
      let key: string;
      if (triageGroupBy === 'severity') key = bug.severity || 'Unspecified';
      else if (triageGroupBy === 'area') key = bug.areaPath?.split('\\').pop() || 'Unspecified';
      else key = bug.assignedTo ? bug.assignedTo.split(' <')[0] : 'Unassigned';
      if (!groups[key]) groups[key] = [];
      groups[key].push(bug);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [allBugs, triageGroupBy]);

  // Available tabs
  const availableTabs = useMemo(() => TABS.filter(t => !t.leadershipOnly || isLeadership), [isLeadership]);

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-700/60 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Quality Command Center
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {isLeadership ? 'Full team view — all bugs & analytics' : `${user?.displayName || 'My'} view — your assigned items`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {connections.length > 0 && (
                <select
                  value={selectedConnectionId || ''}
                  onChange={e => setSelectedConnectionId(e.target.value)}
                  className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500"
                >
                  {connections.map(c => (
                    <option key={c.id} value={c.id}>{c.connectionName || c.organizationUrl}</option>
                  ))}
                </select>
              )}
              <button onClick={loadAllDashboardData} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Refresh all">
                <RefreshCw size={16} className={kpiLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex items-center gap-1 mt-4 -mb-4 border-b-0">
            {availableTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 text-base font-medium rounded-t-lg transition-colors ${
                    isActive
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-b-0 border-gray-200 dark:border-gray-700 shadow-sm -mb-px'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

        {/* Customer Filter Banner */}
        {customerFilter && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {customerFilter.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-blue-800 dark:text-blue-200">
                Filtered by Customer: {customerFilter}
                {filterType && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full text-xs font-medium">
                    {filterType === 'open' ? 'Open Bugs' : filterType === 'closed' ? 'Resolved' : filterType === 'critical' ? 'Critical' : filterType === 'aging' ? '>7 Days Old' : filterType}
                  </span>
                )}
              </h3>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
                Showing {displayBugs.length} matching bug{displayBugs.length !== 1 ? 's' : ''} for this customer
              </p>
            </div>
            <button
              onClick={clearCustomerFilter}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 text-blue-600 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              <X size={12} /> Clear Filter
            </button>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab
            kpi={kpi} kpiLoading={kpiLoading} criticalBugs={criticalBugs} staleCount={staleCount}
            trend={trend} trendLoading={trendLoading} trendDays={trendDays} onChangeDays={handleTrendDaysChange}
            aging={aging} agingLoading={agingLoading}
            customerIssues={customerIssues} customerLoading={customerLoading}
            efficiency={efficiency} efficiencyLoading={efficiencyLoading}
            isLeadership={isLeadership} onViewCritical={() => { setBugView('priority'); setActiveTab('triage'); }}
          />
        )}

        {activeTab === 'triage' && (
          <TriageTab
            bugs={displayBugs} bugsLoading={bugsLoading} bugView={bugView}
            setBugView={setBugView} isLeadership={isLeadership}
            expandedBugId={expandedBugId} setExpandedBugId={setExpandedBugId}
            triageGroupBy={triageGroupBy} setTriageGroupBy={setTriageGroupBy}
            triageGroups={triageGroups}
          />
        )}

        {activeTab === 'mywork' && (
          <MyWorkTab
            myBugs={myBugsData} bugsLoading={bugsLoading}
            expandedBugId={expandedBugId} setExpandedBugId={setExpandedBugId}
            userName={user?.displayName || ''}
          />
        )}

        {activeTab === 'analytics' && isLeadership && (
          <AnalyticsTab
            kpi={kpi} trend={trend} trendLoading={trendLoading}
            trendDays={trendDays} onChangeDays={handleTrendDaysChange}
            aging={aging} agingLoading={agingLoading}
            efficiency={efficiency} efficiencyLoading={efficiencyLoading}
            customerIssues={customerIssues} customerLoading={customerLoading}
            criticalCount={criticalBugs.length} staleCount={staleCount}
          />
        )}

        {activeTab === 'query' && (
          <QueryTab
            prompt={prompt} setPrompt={setPrompt} queryLoading={queryLoading}
            interpretation={interpretation} queryResult={queryResult} queryError={queryError}
            handleSubmit={handleSubmit} executeSmartQuery={executeSmartQuery}
            handleSavePanel={handleSavePanel} promptRef={promptRef}
            panels={panels} panelsLoading={panelsLoading} panelResults={panelResults}
            panelLoadingIds={panelLoadingIds}
            handleRunPanel={handleRunPanel} handleTogglePin={handleTogglePin}
            handleDeletePanel={handleDeletePanel}
            setQueryResult={setQueryResult} setInterpretation={setInterpretation}
            setQueryError={setQueryError}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================
function OverviewTab({ kpi, kpiLoading, criticalBugs, staleCount, trend, trendLoading, trendDays, onChangeDays, aging, agingLoading,
  customerIssues, customerLoading, efficiency: _efficiency, efficiencyLoading: _efficiencyLoading, isLeadership, onViewCritical
}: {
  kpi: KpiSummary | null; kpiLoading: boolean; criticalBugs: QualityWorkItemDto[]; staleCount: number;
  trend: QualityTrendPointDto[]; trendLoading: boolean; trendDays: number; onChangeDays: (d: number) => void;
  aging: BugAgingDistributionDto[]; agingLoading: boolean;
  customerIssues: CustomerIssueGroupDto[]; customerLoading: boolean;
  efficiency: OwnerEfficiencyDto[]; efficiencyLoading: boolean;
  isLeadership: boolean; onViewCritical: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      {kpi && <KpiStrip kpi={kpi} loading={kpiLoading} criticalCount={criticalBugs.length} staleCount={staleCount} />}

      {/* Critical Alert */}
      {criticalBugs.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-center gap-4">
          <div className="flex-shrink-0 w-14 h-14 bg-red-500 rounded-full flex items-center justify-center">
            <Flame size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-red-800 dark:text-red-200">
              {criticalBugs.length} Critical Bug{criticalBugs.length > 1 ? 's' : ''} Require Immediate Attention
            </h3>
            <p className="text-base text-red-600 dark:text-red-300 mt-1">
              Oldest: {Math.max(...criticalBugs.map(b => b.ageDays))} days open
              {' · '}Customer-reported: {criticalBugs.filter(b => b.customer).length}
              {' · '}Avg age: {Math.round(criticalBugs.reduce((s, b) => s + b.ageDays, 0) / criticalBugs.length)} days
            </p>
          </div>
          <button onClick={onViewCritical} className="px-5 py-2.5 bg-red-600 text-white text-base font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
            <Eye size={16} /> View All
          </button>
        </div>
      )}

      {/* Charts + Side Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Trend + Aging */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Bug Trend" icon={TrendingUp} iconColor="text-purple-500" loading={trendLoading}
              headerRight={<DayRangeSelector value={trendDays} onChange={onChangeDays} />}>
              {trend.length > 0 ? <InteractiveBugTrendChart data={trend} /> : <EmptyState text="No trend data" />}
            </Card>
            <Card title="Bug Aging Distribution" icon={Clock} iconColor="text-orange-500" loading={agingLoading}>
              {aging.length > 0 ? <InteractiveAgingChart data={aging} /> : <EmptyState text="No aging data" />}
            </Card>
          </div>

          {/* Quality Health Score */}
          {kpi && (
            <Card title="Quality Health Score" icon={Shield} iconColor="text-emerald-500">
              <QualityHealthScore kpi={kpi} criticalCount={criticalBugs.length} staleCount={staleCount} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Severity Breakdown */}
          {kpi && (
            <Card title="Severity Breakdown" icon={Zap} iconColor="text-red-500">
              <SeverityBreakdown kpi={kpi} />
            </Card>
          )}

          {/* Customer Issues */}
          {isLeadership && (
            <Card title="Customer Issues" icon={Users} iconColor="text-blue-500" loading={customerLoading}>
              {customerIssues.length > 0 ? (
                <div className="max-h-[360px] overflow-y-auto space-y-1.5">
                  {customerIssues.slice(0, 8).map(ci => (
                    <div key={ci.customerName} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                        {ci.customerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-medium text-gray-800 dark:text-gray-200 truncate">{ci.customerName}</div>
                        <div className="text-sm text-gray-500">
                          {ci.activeIssues} active · {ci.criticalIssues > 0 ? <span className="text-red-600 font-medium">{ci.criticalIssues} critical</span> : <span>{ci.resolvedIssues} resolved</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-bold text-gray-800 dark:text-gray-200">{ci.totalIssues}</div>
                        <div className="text-sm text-gray-400">{ci.avgResolutionDays.toFixed(0)}d avg</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState text="No customer issues" />}
            </Card>
          )}

          {/* Top Area Hotspots */}
          {kpi && kpi.topAreas && kpi.topAreas.length > 0 && (
            <Card title="Bug Hotspot Areas" icon={Shield} iconColor="text-pink-500">
              <div className="space-y-1.5">
                {kpi.topAreas.slice(0, 6).map((area, i) => (
                  <div key={area.area} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span className="text-base font-bold text-gray-400 w-5">{i + 1}</span>
                    <span className="text-base text-gray-800 dark:text-gray-200 flex-1 truncate">{area.area}</span>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {area.critical > 0 && (
                        <span className="text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2.5 py-0.5 rounded font-medium">{area.critical}C</span>
                      )}
                      <span className="text-base font-semibold text-gray-700 dark:text-gray-300">{area.total}</span>
                      <span className={`text-sm ${area.avgAge > 14 ? 'text-red-500' : 'text-gray-400'}`}>{area.avgAge.toFixed(0)}d</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Triage Tab
// ============================================================================
function TriageTab({ bugs, bugsLoading, bugView, setBugView, isLeadership, expandedBugId, setExpandedBugId,
  triageGroupBy, setTriageGroupBy, triageGroups
}: {
  bugs: QualityWorkItemDto[]; bugsLoading: boolean; bugView: 'priority' | 'mine';
  setBugView: (v: 'priority' | 'mine') => void; isLeadership: boolean;
  expandedBugId: number | null; setExpandedBugId: (id: number | null) => void;
  triageGroupBy: 'severity' | 'area' | 'assignee'; setTriageGroupBy: (g: 'severity' | 'area' | 'assignee') => void;
  triageGroups: [string, QualityWorkItemDto[]][];
}) {
  return (
    <div className="space-y-6">
      {/* Triage Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button onClick={() => setBugView('priority')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${bugView === 'priority' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm' : 'text-gray-500'}`}>
              {isLeadership ? 'All Bugs' : 'Priority'}
            </button>
            <button onClick={() => setBugView('mine')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${bugView === 'mine' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm' : 'text-gray-500'}`}>
              My Bugs
            </button>
          </div>
          <span className="text-base text-gray-500 dark:text-gray-400">{bugs.length} items</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Group by:</span>
          {(['severity', 'area', 'assignee'] as const).map(g => (
            <button key={g} onClick={() => setTriageGroupBy(g)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${triageGroupBy === g ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
          {bugsLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
      </div>

      {/* Grouped Triage View */}
      {triageGroups.map(([groupName, groupBugs]) => (
        <section key={groupName} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/30">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium px-2.5 py-1 rounded ${triageGroupBy === 'severity' ? getSeverityColor(groupName) : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                {groupName}
              </span>
              <span className="text-sm text-gray-500">{groupBugs.length} bug{groupBugs.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <BugTable bugs={groupBugs} expandedBugId={expandedBugId} setExpandedBugId={setExpandedBugId} />
        </section>
      ))}

      {/* Flat view fallback */}
      {triageGroups.length === 0 && !bugsLoading && (
        <div className="text-center py-12 text-gray-400 text-sm">No active bugs found</div>
      )}
    </div>
  );
}

// ============================================================================
// My Work Tab
// ============================================================================
function MyWorkTab({ myBugs, bugsLoading, expandedBugId, setExpandedBugId, userName }: {
  myBugs: QualityWorkItemDto[]; bugsLoading: boolean;
  expandedBugId: number | null; setExpandedBugId: (id: number | null) => void;
  userName: string;
}) {
  const activeBugs = useMemo(() => myBugs.filter(b => b.state === 'Active' || b.state === 'New'), [myBugs]);
  const resolvedBugs = useMemo(() => myBugs.filter(b => b.state === 'Resolved' || b.state === 'Closed'), [myBugs]);

  return (
    <div className="space-y-6">
      {/* My Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStatCard label="Total Assigned" value={myBugs.length} icon={Bug} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-900/30" />
        <MiniStatCard label="Active" value={activeBugs.length} icon={AlertTriangle} color="text-red-500" bg="bg-red-50 dark:bg-red-900/30" />
        <MiniStatCard label="Resolved" value={resolvedBugs.length} icon={Shield} color="text-green-500" bg="bg-green-50 dark:bg-green-900/30" />
        <MiniStatCard label="Avg Age" value={`${activeBugs.length > 0 ? Math.round(activeBugs.reduce((s, b) => s + b.ageDays, 0) / activeBugs.length) : 0}d`} icon={Clock} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-900/30" />
      </div>

      {/* Active Items */}
      <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Bug size={16} className="text-red-500" />
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">{userName ? `${userName}'s` : 'My'} Active Bugs</h3>
          <span className="text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full px-2.5 py-0.5">{activeBugs.length}</span>
          {bugsLoading && <Loader2 size={14} className="animate-spin text-gray-400 ml-auto" />}
        </div>
        {activeBugs.length > 0 ? (
          <BugTable bugs={activeBugs} expandedBugId={expandedBugId} setExpandedBugId={setExpandedBugId} />
        ) : (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
            {bugsLoading ? 'Loading...' : 'No active bugs assigned — great work! 🎉'}
          </div>
        )}
      </section>

      {/* Recently Resolved */}
      {resolvedBugs.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <Shield size={16} className="text-green-500" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">Recently Resolved</h3>
            <span className="text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full px-2.5 py-0.5">{resolvedBugs.length}</span>
          </div>
          <BugTable bugs={resolvedBugs.slice(0, 10)} expandedBugId={expandedBugId} setExpandedBugId={setExpandedBugId} />
        </section>
      )}
    </div>
  );
}

// ============================================================================
// Analytics Tab (Leadership Only)
// ============================================================================
function AnalyticsTab({ kpi, trend, trendLoading, trendDays, onChangeDays, aging, agingLoading, efficiency, efficiencyLoading,
  customerIssues, customerLoading, criticalCount, staleCount
}: {
  kpi: KpiSummary | null; trend: QualityTrendPointDto[]; trendLoading: boolean;
  trendDays: number; onChangeDays: (d: number) => void;
  aging: BugAgingDistributionDto[]; agingLoading: boolean;
  efficiency: OwnerEfficiencyDto[]; efficiencyLoading: boolean;
  customerIssues: CustomerIssueGroupDto[]; customerLoading: boolean;
  criticalCount: number; staleCount: number;
}) {
  return (
    <div className="space-y-6">
      {/* Health + Severity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {kpi && (
          <Card title="Quality Health Score" icon={Shield} iconColor="text-emerald-500">
            <QualityHealthScore kpi={kpi} criticalCount={criticalCount} staleCount={staleCount} />
          </Card>
        )}
        {kpi && (
          <Card title="Severity Distribution" icon={Zap} iconColor="text-red-500">
            <SeverityBreakdown kpi={kpi} />
          </Card>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Bug Trend" icon={TrendingUp} iconColor="text-purple-500" loading={trendLoading}
          headerRight={<DayRangeSelector value={trendDays} onChange={onChangeDays} />}>
          {trend.length > 0 ? <InteractiveBugTrendChart data={trend} /> : <EmptyState text="No trend data" />}
        </Card>
        <Card title="Aging Distribution" icon={Clock} iconColor="text-orange-500" loading={agingLoading}>
          {aging.length > 0 ? <InteractiveAgingChart data={aging} /> : <EmptyState text="No aging data" />}
        </Card>
      </div>

      {/* Team + Customer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Team Efficiency" icon={BarChart3} iconColor="text-emerald-500" loading={efficiencyLoading}>
          {efficiency.length > 0 ? (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {efficiency.map(e => (
                <div key={e.ownerName} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center text-sm font-bold text-emerald-700 dark:text-emerald-300 flex-shrink-0">
                    {e.ownerName.slice(0, 1)}
                  </div>
                  <span className="text-base text-gray-800 dark:text-gray-200 flex-1 truncate">{e.ownerName.split(' <')[0]}</span>
                  <div className="flex items-center gap-3 text-base flex-shrink-0">
                    <span className="text-gray-500">{e.resolved}/{e.totalAssigned}</span>
                    <div className="w-20 h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${e.efficiencyScore >= 70 ? 'bg-green-500' : e.efficiencyScore >= 40 ? 'bg-yellow-400' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, e.efficiencyScore)}%` }} />
                    </div>
                    <span className={`font-bold w-10 text-right ${e.efficiencyScore >= 70 ? 'text-green-600' : e.efficiencyScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {e.efficiencyScore.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState text="No efficiency data" />}
        </Card>
        <Card title="Customer Impact" icon={Users} iconColor="text-blue-500" loading={customerLoading}>
          {customerIssues.length > 0 ? (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {customerIssues.slice(0, 10).map(ci => (
                <div key={ci.customerName} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                    {ci.customerName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-medium text-gray-800 dark:text-gray-200 truncate">{ci.customerName}</div>
                    <div className="text-sm text-gray-500">{ci.activeIssues} active · {ci.resolvedIssues} resolved</div>
                  </div>
                  <div className="text-base font-bold text-gray-800 dark:text-gray-200">{ci.totalIssues}</div>
                </div>
              ))}
            </div>
          ) : <EmptyState text="No customer data" />}
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Query Tab
// ============================================================================
function QueryTab({ prompt, setPrompt, queryLoading, interpretation, queryResult, queryError,
  handleSubmit, executeSmartQuery, handleSavePanel, promptRef,
  panels, panelsLoading, panelResults, panelLoadingIds,
  handleRunPanel, handleTogglePin, handleDeletePanel,
  setQueryResult, setInterpretation, setQueryError
}: {
  prompt: string; setPrompt: (s: string) => void; queryLoading: boolean;
  interpretation: SmartQueryInterpretation | null; queryResult: unknown; queryError: string | null;
  handleSubmit: (e: React.FormEvent) => void; executeSmartQuery: (s: string) => void;
  handleSavePanel: () => void; promptRef: React.MutableRefObject<HTMLInputElement | null>;
  panels: QualityQueryPanelDto[]; panelsLoading: boolean;
  panelResults: Record<string, unknown>; panelLoadingIds: Set<string>;
  handleRunPanel: (p: QualityQueryPanelDto) => void;
  handleTogglePin: (p: QualityQueryPanelDto) => void;
  handleDeletePanel: (id: string) => void;
  setQueryResult: (v: unknown) => void;
  setInterpretation: (v: SmartQueryInterpretation | null) => void;
  setQueryError: (v: string | null) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Query Bar */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="flex items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-purple-500"><Sparkles size={20} /></div>
          <input
            ref={promptRef}
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Ask anything... e.g. 'Show critical bugs in PMS module' or 'Bug trend last 30 days'"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400 dark:text-white"
            disabled={queryLoading}
          />
          {prompt && (
            <button type="button" onClick={() => { setPrompt(''); setQueryResult(null); setInterpretation(null); setQueryError(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
          <button type="submit" disabled={queryLoading || !prompt.trim()}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-2">
            {queryLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Query
          </button>
        </form>
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(qa => (
            <button key={qa.label} onClick={() => { setPrompt(qa.prompt); executeSmartQuery(qa.prompt); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all hover:shadow-sm hover:-translate-y-0.5">
              <qa.icon size={12} />
              {qa.label}
            </button>
          ))}
        </div>
      </section>

      {/* Query Result */}
      {(queryLoading || queryResult != null || queryError || interpretation) && (
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
          {interpretation && (
            <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-600 dark:text-gray-400">{interpretation.endpointKey}</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">{interpretation.explanation}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">{interpretation.visualizationType}</span>
                <button onClick={handleSavePanel} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title="Save as panel">
                  <Save size={12} /> Save
                </button>
              </div>
            </div>
          )}
          {queryLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <span className="ml-3 text-sm text-gray-500">Interpreting and executing...</span>
            </div>
          )}
          {queryError && (
            <div className="p-5">
              <div className="flex items-center gap-2 text-red-600"><AlertTriangle size={16} /><span className="text-sm">{queryError}</span></div>
            </div>
          )}
          {queryResult != null && !queryLoading && (
            <div className="p-5">
              <DynamicResultRenderer data={queryResult} visualizationType={interpretation?.visualizationType || 'table'} visualization={interpretation?.visualization} />
            </div>
          )}
        </section>
      )}

      {/* Saved Panels */}
      {panels.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Bookmark size={18} className="text-purple-500" />
              Saved Panels
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full px-2 py-0.5">{panels.length}</span>
            </h2>
            {panelsLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {panels.map(panel => (
              <SavedPanelCard
                key={panel.id}
                panel={panel}
                result={panelResults[panel.id]}
                loading={panelLoadingIds.has(panel.id)}
                onRun={() => handleRunPanel(panel)}
                onTogglePin={() => handleTogglePin(panel)}
                onDelete={() => handleDeletePanel(panel.id)}
                onLoadPrompt={() => { setPrompt(panel.prompt); promptRef.current?.focus(); }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// Reusable Card Component
// ============================================================================
function Card({ title, icon: Icon, iconColor, loading, headerRight, children }: {
  title: string; icon: React.ElementType; iconColor: string; loading?: boolean; headerRight?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2.5">
        <Icon size={20} className={iconColor} />
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        {loading && <Loader2 size={14} className="animate-spin text-gray-400 ml-auto" />}
        {headerRight && <div className="ml-auto flex items-center">{headerRight}</div>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function MiniStatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: string | number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-6 border border-gray-100 dark:border-gray-700`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <Icon size={20} className={color} />
      </div>
      <div className="text-4xl font-bold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="h-40 flex items-center justify-center text-sm text-gray-400">{text}</div>;
}

// ============================================================================
// Bug Table
// ============================================================================
function BugTable({ bugs, expandedBugId, setExpandedBugId }: {
  bugs: QualityWorkItemDto[];
  expandedBugId: number | null;
  setExpandedBugId: (id: number | null) => void;
}) {
  return (
    <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm z-10">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-2.5 text-sm font-semibold text-gray-500 w-8"></th>
            <th className="px-3 py-2.5 text-sm font-semibold text-gray-500">ID</th>
            <th className="px-3 py-2.5 text-sm font-semibold text-gray-500">Title</th>
            <th className="px-3 py-2.5 text-sm font-semibold text-gray-500">Priority</th>
            <th className="px-3 py-2.5 text-sm font-semibold text-gray-500">Severity</th>
            <th className="px-3 py-2.5 text-sm font-semibold text-gray-500">Age</th>
            <th className="px-3 py-2.5 text-sm font-semibold text-gray-500">Assigned</th>
            <th className="px-3 py-2.5 text-sm font-semibold text-gray-500">Area</th>
            <th className="px-3 py-2.5 text-sm font-semibold text-gray-500">Customer</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
          {bugs.slice(0, 50).map(bug => {
            const urgency = getUrgencyLevel(bug);
            const badge = getUrgencyBadge(urgency);
            const isExpanded = expandedBugId === bug.id;
            return (
              <React.Fragment key={bug.id}>
                <tr className={`hover:bg-blue-50/40 dark:hover:bg-blue-900/20 cursor-pointer transition-colors ${urgency === 'critical' ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}
                  onClick={() => setExpandedBugId(isExpanded ? null : bug.id)}>
                  <td className="px-4 py-2.5">
                    {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  </td>
                  <td className="px-3 py-2.5">
                    <a href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline">
                      {bug.id} <ExternalLink size={10} />
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 max-w-[280px] truncate" title={bug.title}>{bug.title}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(bug.severity)}`}>{bug.severity || 'N/A'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-sm font-mono ${getAgingColor(bug.ageDays)}`}>{bug.ageDays}d</span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 max-w-[120px] truncate" title={bug.assignedTo || ''}>
                    {bug.assignedTo ? bug.assignedTo.split(' <')[0] : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500 max-w-[100px] truncate" title={bug.areaPath || ''}>
                    {bug.areaPath?.split('\\').pop() || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {bug.customer ? (
                      <span className="inline-flex items-center gap-1 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                        <Users size={12} /> {bug.customer}
                      </span>
                    ) : <span className="text-sm text-gray-300">—</span>}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={9} className="bg-gray-50/80 dark:bg-gray-900/50 px-6 py-4">
                      <BugDetailExpanded bug={bug} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {bugs.length > 50 && (
        <div className="text-center py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
          Showing 50 of {bugs.length} — use Smart Query for full results
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Bug Detail Expanded Row
// ============================================================================
function BugDetailExpanded({ bug }: { bug: QualityWorkItemDto }) {
  const urgency = getUrgencyLevel(bug);

  const fixSteps = useMemo(() => {
    const steps: string[] = [];
    if (urgency === 'critical') {
      steps.push('Assign immediately to a senior developer');
      steps.push('Set up a war room or dedicated Slack channel');
      if (bug.customer) steps.push(`Notify customer "${bug.customer}" with ETA`);
      steps.push('Create a hotfix branch for isolated fix');
    } else if (urgency === 'high') {
      steps.push('Schedule for current sprint if not assigned');
      if (bug.customer) steps.push(`Update customer "${bug.customer}" on progress`);
      steps.push('Pair with domain expert in the area');
    } else {
      steps.push('Prioritize in next sprint planning');
      steps.push('Review if related to other active bugs in same area');
    }
    if (bug.ageDays > 14) steps.push(`Open for ${bug.ageDays} days — escalate if blocked`);
    if (bug.reopenCount > 0) steps.push(`Reopened ${bug.reopenCount}x — ensure root cause fix`);
    steps.push('Write regression test before marking resolved');
    return steps;
  }, [bug, urgency]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Bug Details</h4>
        <div className="grid grid-cols-2 gap-2.5 text-sm">
          <div><span className="text-gray-400">State:</span> <span className={`px-2 py-0.5 rounded font-medium ${getStateColor(bug.state)}`}>{bug.state}</span></div>
          <div><span className="text-gray-400">Created:</span> <span className="text-gray-700 dark:text-gray-300">{formatDate(bug.createdDate)}</span></div>
          <div><span className="text-gray-400">Area:</span> <span className="text-gray-700 dark:text-gray-300">{bug.areaPath || '—'}</span></div>
          <div><span className="text-gray-400">Iteration:</span> <span className="text-gray-700 dark:text-gray-300">{bug.iterationPath || '—'}</span></div>
          <div><span className="text-gray-400">Dev Owner:</span> <span className="text-gray-700 dark:text-gray-300">{bug.devOwner || '—'}</span></div>
          <div><span className="text-gray-400">BA Owner:</span> <span className="text-gray-700 dark:text-gray-300">{bug.baOwner || '—'}</span></div>
          {bug.tags.length > 0 && (
            <div className="col-span-2"><span className="text-gray-400">Tags:</span> {bug.tags.map(t => <span key={t} className="ml-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">{t}</span>)}</div>
          )}
          {bug.parentTitle && (
            <div className="col-span-2"><span className="text-gray-400">Parent:</span> <span className="text-gray-700 dark:text-gray-300">{bug.parentType}: {bug.parentTitle}</span></div>
          )}
        </div>
        <a href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-1">
          Open in Azure DevOps <ExternalLink size={12} />
        </a>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recommended Fix Steps</h4>
        <ol className="space-y-2">
          {fixSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="text-gray-700 dark:text-gray-300">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ============================================================================
// KPI Strip
// ============================================================================
function KpiStrip({ kpi, loading, criticalCount, staleCount }: { kpi: KpiSummary; loading: boolean; criticalCount: number; staleCount: number }) {
  const cards = [
    { label: 'Active Bugs', value: kpi.activeBugs, icon: Bug, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', sub: `${criticalCount} critical` },
    { label: 'Resolution Rate', value: `${kpi.resolutionRate.toFixed(0)}%`, icon: Shield, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', sub: `${kpi.resolvedBugs} resolved` },
    { label: 'MTTR', value: `${kpi.mttr.toFixed(1)}d`, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', sub: 'Mean time to resolve' },
    { label: 'Stale (14d+)', value: staleCount, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', sub: 'Need attention' },
    { label: 'Weekly Velocity', value: `+${kpi.weeklyCreated}/-${kpi.weeklyResolved}`, icon: kpi.bugTrend <= 0 ? TrendingDown : TrendingUp, color: kpi.bugTrend <= 0 ? 'text-green-500' : 'text-red-500', bg: kpi.bugTrend <= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20', sub: kpi.bugTrend <= 0 ? 'Trend improving' : 'Trend worsening' },
    { label: 'Total Items', value: kpi.totalWorkItems, icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', sub: `${kpi.features} features · ${kpi.tasks} tasks` },
  ];

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 ${loading ? 'opacity-60' : ''}`}>
      {cards.map(c => (
        <div key={c.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{c.label}</span>
            <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
              <c.icon size={20} className={c.color} />
            </div>
          </div>
          <div className="text-4xl font-bold text-gray-900 dark:text-white">{typeof c.value === 'number' ? c.value.toLocaleString() : String(c.value)}</div>
          <div className="text-sm text-gray-400 mt-2">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Severity Breakdown
// ============================================================================
function SeverityBreakdown({ kpi }: { kpi: KpiSummary }) {
  return (
    <div className="space-y-5">
      {Object.entries(kpi.bySeverity || {}).sort().map(([sev, count]) => {
        const total = Object.values(kpi.bySeverity).reduce((s, v) => s + v, 0);
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={sev}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium px-2.5 py-1 rounded ${getSeverityColor(sev)}`}>{sev}</span>
              <span className="text-base font-bold text-gray-700 dark:text-gray-300">{count}</span>
            </div>
            <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${sev.includes('Critical') ? 'bg-red-500' : sev.includes('High') ? 'bg-orange-500' : sev.includes('Medium') ? 'bg-yellow-400' : 'bg-green-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Charts — Interactive ECharts
// ============================================================================
function DayRangeSelector({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  const options = [30, 60, 90, 120];
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
      {options.map(d => (
        <button key={d} onClick={() => onChange(d)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${value === d
            ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          {d}d
        </button>
      ))}
    </div>
  );
}

function InteractiveBugTrendChart({ data }: { data: QualityTrendPointDto[] }) {
  const dates = data.map(d => {
    const dt = new Date(d.date);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  });
  const opened = data.map(d => d.opened);
  const closed = data.map(d => d.closed);
  const active = data.map(d => d.cumulativeActive);

  // Compute summary stats
  const totalOpened = opened.reduce((a, b) => a + b, 0);
  const totalClosed = closed.reduce((a, b) => a + b, 0);
  const netChange = totalOpened - totalClosed;
  const latestActive = active.length > 0 ? active[active.length - 1] : 0;

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(30, 30, 46, 0.95)',
      borderColor: 'rgba(139, 92, 246, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#e5e7eb', fontSize: 13 },
      axisPointer: { type: 'cross' as const, crossStyle: { color: '#6b7280' } },
      formatter: (params: Array<{ seriesName: string; value: number; marker: string; axisValueLabel: string }>) => {
        if (!params?.length) return '';
        let html = `<div style="font-weight:600;margin-bottom:6px;font-size:13px">${params[0].axisValueLabel}</div>`;
        params.forEach(p => {
          html += `<div style="display:flex;align-items:center;gap:8px;padding:2px 0">
            ${p.marker}<span style="flex:1">${p.seriesName}</span>
            <span style="font-weight:700;font-size:14px">${p.value}</span></div>`;
        });
        // Net change for that day
        const dayOpened = params.find(p => p.seriesName === 'Opened')?.value ?? 0;
        const dayClosed = params.find(p => p.seriesName === 'Closed')?.value ?? 0;
        const dayNet = dayOpened - dayClosed;
        const netColor = dayNet <= 0 ? '#22c55e' : '#ef4444';
        html += `<div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:6px;padding-top:6px;font-size:12px;color:${netColor}">
          Net: ${dayNet > 0 ? '+' : ''}${dayNet} bug${Math.abs(dayNet) !== 1 ? 's' : ''}</div>`;
        return html;
      }
    },
    legend: {
      data: ['Opened', 'Closed', 'Active Backlog'],
      bottom: 0,
      textStyle: { fontSize: 12, color: '#9ca3af' },
      itemWidth: 16,
      itemHeight: 10,
      itemGap: 20
    },
    grid: { left: 48, right: 16, top: 16, bottom: 60 },
    dataZoom: data.length > 30 ? [
      { type: 'slider' as const, start: Math.max(0, 100 - (30 / data.length) * 100), end: 100, bottom: 28, height: 20,
        borderColor: 'rgba(139, 92, 246, 0.3)', fillerColor: 'rgba(139, 92, 246, 0.08)',
        handleStyle: { color: '#8b5cf6', borderColor: '#8b5cf6' },
        textStyle: { fontSize: 10, color: '#9ca3af' },
        dataBackground: { lineStyle: { color: '#a78bfa', opacity: 0.3 }, areaStyle: { color: '#a78bfa', opacity: 0.05 } }
      },
      { type: 'inside' as const, start: Math.max(0, 100 - (30 / data.length) * 100), end: 100 }
    ] : [],
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { fontSize: 11, color: '#9ca3af', rotate: data.length > 45 ? 45 : 0 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' as const } },
      axisLabel: { fontSize: 11, color: '#9ca3af' },
      axisLine: { show: false }
    },
    series: [
      {
        name: 'Opened',
        type: 'line' as const,
        data: opened,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: data.length <= 40,
        lineStyle: { width: 2.5, color: '#ef4444' },
        itemStyle: { color: '#ef4444', borderWidth: 2, borderColor: '#fff' },
        areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: 'rgba(239, 68, 68, 0.2)' },
          { offset: 1, color: 'rgba(239, 68, 68, 0.01)' }
        ] } },
        emphasis: { focus: 'series' as const, itemStyle: { shadowBlur: 10, shadowColor: 'rgba(239,68,68,0.3)' } }
      },
      {
        name: 'Closed',
        type: 'line' as const,
        data: closed,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: data.length <= 40,
        lineStyle: { width: 2.5, color: '#22c55e' },
        itemStyle: { color: '#22c55e', borderWidth: 2, borderColor: '#fff' },
        areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: 'rgba(34, 197, 94, 0.2)' },
          { offset: 1, color: 'rgba(34, 197, 94, 0.01)' }
        ] } },
        emphasis: { focus: 'series' as const, itemStyle: { shadowBlur: 10, shadowColor: 'rgba(34,197,94,0.3)' } }
      },
      {
        name: 'Active Backlog',
        type: 'line' as const,
        data: active,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#a78bfa', type: 'dashed' as const },
        itemStyle: { color: '#a78bfa' },
        areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: 'rgba(167, 139, 250, 0.08)' },
          { offset: 1, color: 'rgba(167, 139, 250, 0.01)' }
        ] } },
        emphasis: { focus: 'series' as const }
      }
    ],
    animationDuration: 800,
    animationEasing: 'cubicInOut' as const,
  }), [data, dates, opened, closed, active]);

  return (
    <div>
      {/* Summary stats bar */}
      <div className="flex items-center gap-4 mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-gray-500">Opened: <span className="font-bold text-gray-800 dark:text-gray-200">{totalOpened}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500">Closed: <span className="font-bold text-gray-800 dark:text-gray-200">{totalClosed}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          {netChange <= 0 ? <TrendingDown size={14} className="text-green-500" /> : <TrendingUp size={14} className="text-red-500" />}
          <span className={`text-xs font-bold ${netChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Net: {netChange > 0 ? '+' : ''}{netChange}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
          <span className="text-xs text-gray-500">Backlog: <span className="font-bold text-gray-800 dark:text-gray-200">{latestActive}</span></span>
        </div>
      </div>
      <ReactECharts option={option} style={{ height: 320 }} notMerge lazyUpdate />
    </div>
  );
}

function InteractiveAgingChart({ data }: { data: BugAgingDistributionDto[] }) {
  const colors = ['#22c55e', '#86efac', '#fbbf24', '#f97316', '#ef4444', '#dc2626'];
  const totalBugs = data.reduce((s, d) => s + d.count, 0);

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(30, 30, 46, 0.95)',
      borderColor: 'rgba(249, 115, 22, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#e5e7eb', fontSize: 13 },
      formatter: (params: Array<{ name: string; value: number; marker: string; dataIndex: number }>) => {
        if (!params?.length) return '';
        const p = params[0];
        const pct = data[p.dataIndex]?.percentage ?? 0;
        return `<div style="font-weight:600;margin-bottom:4px">${p.name}</div>
          <div style="font-size:20px;font-weight:700">${p.value} bugs</div>
          <div style="color:#9ca3af;margin-top:2px">${pct.toFixed(1)}% of total (${totalBugs})</div>`;
      }
    },
    grid: { left: 12, right: 12, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: data.map(d => d.range),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { fontSize: 12, color: '#6b7280', fontWeight: 500 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' as const } },
      axisLabel: { fontSize: 11, color: '#9ca3af' },
      axisLine: { show: false }
    },
    series: [{
      type: 'bar' as const,
      data: data.map((d, i) => ({
        value: d.count,
        itemStyle: {
          color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: colors[i % colors.length] },
            { offset: 1, color: colors[i % colors.length] + '80' }
          ] },
          borderRadius: [6, 6, 0, 0]
        },
        label: {
          show: true,
          position: 'top' as const,
          formatter: `{bold|${d.count}}\n{pct|${d.percentage.toFixed(0)}%}`,
          rich: {
            bold: { fontSize: 14, fontWeight: 'bold' as const, color: '#374151', lineHeight: 18 },
            pct: { fontSize: 11, color: '#9ca3af', lineHeight: 16 }
          }
        }
      })),
      barWidth: '55%',
      emphasis: {
        itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.15)' }
      }
    }],
    animationDuration: 600,
    animationEasing: 'cubicOut' as const,
  }), [data, totalBugs]);

  return <ReactECharts option={option} style={{ height: 300 }} notMerge lazyUpdate />;
}

function QualityHealthScore({ kpi, criticalCount, staleCount }: { kpi: KpiSummary; criticalCount: number; staleCount: number }) {
  let score = 100;
  score -= criticalCount * 15;
  score -= staleCount * 3;
  const kpiAny = kpi as unknown as Record<string, number>;
  score -= Math.max(0, (kpiAny.avgAgeDays || 0) - 7) * 2;
  if ((kpiAny.newThisWeek || 0) > (kpiAny.resolvedThisWeek || 0)) score -= 10;
  score = Math.max(0, Math.min(100, score));
  const color = score >= 80 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500';
  const label = score >= 80 ? 'Healthy' : score >= 50 ? 'Needs Attention' : 'Critical';
  const ringColor = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const circumference = 2 * Math.PI * 60;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex items-center gap-10">
      <div className="relative">
        <svg width={160} height={160} viewBox="0 0 160 160">
          <circle cx={80} cy={80} r={60} fill="none" stroke="#e5e7eb" strokeWidth={10} />
          <circle cx={80} cy={80} r={60} fill="none" stroke={ringColor} strokeWidth={10}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 80 80)" className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${color}`}>{score}</span>
          <span className="text-sm text-gray-400">/ 100</span>
        </div>
      </div>
      <div className="space-y-3">
        <div className={`text-2xl font-bold ${color}`}>{label}</div>
        <div className="text-base text-gray-500 dark:text-gray-400 space-y-1.5">
          <div>Critical bugs: <span className="font-medium text-gray-700 dark:text-gray-300">-{criticalCount * 15}pts</span></div>
          <div>Stale items: <span className="font-medium text-gray-700 dark:text-gray-300">-{staleCount * 3}pts</span></div>
          <div className="text-sm text-gray-400 mt-2">Based on critical bugs, staleness, and resolution rate</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Saved Panel Card
// ============================================================================
function SavedPanelCard({ panel, result, loading, onRun, onTogglePin, onDelete, onLoadPrompt }: {
  panel: QualityQueryPanelDto; result?: unknown; loading: boolean;
  onRun: () => void; onTogglePin: () => void; onDelete: () => void; onLoadPrompt: () => void;
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${panel.isPinned ? 'border-purple-300 dark:border-purple-700 ring-1 ring-purple-100 dark:ring-purple-900' : 'border-gray-200/80 dark:border-gray-700'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1 mr-2">{panel.name}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onTogglePin} className="p-1 text-gray-400 hover:text-purple-500" title={panel.isPinned ? 'Unpin' : 'Pin'}>
              {panel.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{panel.prompt}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">{panel.endpointKey}</span>
          <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded">{panel.visualizationType}</span>
        </div>
      </div>
      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between">
        <button onClick={onRun} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? 'Running...' : 'Run'}
        </button>
        <button onClick={onLoadPrompt} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <Search size={12} /> Edit & Run
        </button>
      </div>
      {result != null && !loading && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-3 max-h-48 overflow-auto">
          <DynamicResultRenderer data={result} visualizationType={panel.visualizationType as never} compact />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Dynamic Result Renderer — Auto-chart, Table, Summary with Export
// ============================================================================
type ViewMode = 'auto' | 'chart' | 'table' | 'summary';

function DynamicResultRenderer({ data, visualizationType, visualization, compact }: {
  data: unknown; visualizationType: string;
  visualization?: SmartQueryInterpretation['visualization'];
  compact?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('auto');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const chartRef = useRef<ReactECharts | null>(null);

  if (data == null) return <div className="text-sm text-gray-400">No data</div>;

  // Normalize data for rendering
  const items: Record<string, unknown>[] | null = Array.isArray(data) ? data
    : (typeof data === 'object' && data !== null) ? flattenNestedData(data as Record<string, unknown>) : null;

  if (items !== null && items.length === 0) return <div className="text-sm text-gray-400">No results found</div>;

  // Detect if data is chart-friendly
  const chartInfo = items ? detectChartType(items, visualizationType, visualization) : null;
  const canChart = chartInfo !== null;
  const isObject = !Array.isArray(data) && typeof data === 'object';

  // Resolve effective view
  const effectiveView: ViewMode = viewMode === 'auto'
    ? (compact ? 'table'
      : visualizationType === 'chart' && canChart ? 'chart'
      : visualizationType === 'kpi' || isObject ? 'summary'
      : canChart && items && items.length <= 30 ? 'chart' : 'table')
    : viewMode;

  // Show feedback toast
  const showFeedback = (msg: string) => { setCopyFeedback(msg); setTimeout(() => setCopyFeedback(null), 2000); };

  // Copy as tab-delimited data (pasteable to Excel)
  const handleCopyData = () => {
    if (!items?.length) return;
    const cols = getColumns(items, visualization?.columns, 20);
    const header = cols.map(formatColumnName).join('\t');
    const rows = items.map(row => cols.map(c => {
      const v = row[c];
      if (v == null) return '';
      if (typeof v === 'number') return String(v);
      return String(v).replace(/\t/g, ' ').replace(/\n/g, ' ');
    }).join('\t'));
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    showFeedback('Copied as data — paste into Excel');
  };

  // Copy chart as image
  const handleCopyImage = async () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) { showFeedback('No chart to copy'); return; }
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showFeedback('Chart copied as image');
    } catch {
      // Fallback: open in new tab
      const w = window.open();
      if (w) { w.document.write(`<img src="${url}" />`); w.document.title = 'Chart Export'; }
      showFeedback('Opened chart in new tab');
    }
  };

  // Download CSV
  const handleDownloadCsv = () => {
    if (!items?.length) return;
    const cols = getColumns(items, visualization?.columns, 30);
    const csvHeader = cols.map(c => `"${formatColumnName(c)}"`).join(',');
    const csvRows = items.map(row => cols.map(c => {
      const v = row[c];
      if (v == null) return '';
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(','));
    const blob = new Blob([csvHeader + '\n' + csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `query-result-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showFeedback('Downloaded CSV');
  };

  // Compact mode — no toolbar
  if (compact) {
    if (items) return <CompactListRenderer items={items} />;
    if (isObject) return <ObjectRenderer data={data as Record<string, unknown>} compact />;
    return <div className="text-sm text-gray-700 dark:text-gray-300">{String(data)}</div>;
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: View modes + Export */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {canChart && (
            <button onClick={() => setViewMode('chart')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                effectiveView === 'chart' ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <BarChart3 size={13} /> Chart
            </button>
          )}
          {items && (
            <button onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
                effectiveView === 'table' ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Table2 size={13} /> Table
            </button>
          )}
          <button onClick={() => setViewMode('summary')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all ${
              effectiveView === 'summary' ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <FileText size={13} /> Summary
          </button>
        </div>

        <div className="flex items-center gap-1 relative">
          {items && items.length > 0 && (
            <>
              <button onClick={handleCopyData} title="Copy as data (paste to Excel)"
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors">
                <ClipboardCopy size={15} />
              </button>
              <button onClick={handleDownloadCsv} title="Download CSV"
                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors">
                <Download size={15} />
              </button>
            </>
          )}
          {canChart && effectiveView === 'chart' && (
            <button onClick={handleCopyImage} title="Copy chart as image"
              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors">
              <Image size={15} />
            </button>
          )}
          {copyFeedback && (
            <div className="absolute -top-8 right-0 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-md shadow-lg whitespace-nowrap animate-pulse">
              {copyFeedback}
            </div>
          )}
        </div>
      </div>

      {/* Count badge */}
      {items && (
        <div className="text-xs text-gray-400">
          {items.length} result{items.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Render based on effective view */}
      {effectiveView === 'chart' && canChart && items ? (
        <AutoChart ref={chartRef} items={items} chartInfo={chartInfo} />
      ) : effectiveView === 'table' && items ? (
        <TableRenderer items={items} columns={visualization?.columns} />
      ) : effectiveView === 'summary' ? (
        <SummaryView data={data} items={items} />
      ) : items ? (
        <TableRenderer items={items} columns={visualization?.columns} />
      ) : isObject ? (
        <ObjectRenderer data={data as Record<string, unknown>} />
      ) : (
        <div className="text-sm text-gray-700 dark:text-gray-300">{String(data)}</div>
      )}
    </div>
  );
}

// ---- Chart type auto-detection ----
interface ChartDetection {
  type: 'bar' | 'line' | 'pie' | 'horizontal-bar';
  categoryKey: string;
  valueKeys: string[];
  title?: string;
}

function detectChartType(
  items: Record<string, unknown>[],
  visType: string,
  vis?: SmartQueryInterpretation['visualization']
): ChartDetection | null {
  if (!items.length) return null;
  const sample = items[0];
  const keys = Object.keys(sample);

  // Find string keys (categories) and number keys (values)
  const strKeys = keys.filter(k => typeof sample[k] === 'string' && !k.toLowerCase().includes('url') && !k.toLowerCase().includes('id'));
  const numKeys = keys.filter(k => typeof sample[k] === 'number');

  if (strKeys.length === 0 || numKeys.length === 0) return null;
  if (items.length > 100) return null; // too many items for chart

  // Use visualization hint if available
  const hintType = vis?.chartType;
  // Prefer userName/name/ownerName as category for people-oriented data
  const personKey = strKeys.find(k => /^(userName|name|ownerName|assignedTo|user)$/i.test(k));
  const categoryKey = personKey || strKeys[0];
  const valueKeys = numKeys.slice(0, 4);

  if (hintType === 'pie' && valueKeys.length >= 1)
    return { type: 'pie', categoryKey, valueKeys: [valueKeys[0]] };
  if (hintType === 'line' || visType === 'chart' && keys.some(k => k.toLowerCase().includes('date')))
    return { type: 'line', categoryKey, valueKeys };
  // Multi-metric per person → grouped bar (horizontal for readability)
  if (personKey && numKeys.length >= 2)
    return { type: 'horizontal-bar', categoryKey, valueKeys: numKeys.filter(k => !/^(topAreas|recentBugs)$/i.test(k)).slice(0, 5) };
  if (items.length <= 8 && valueKeys.length === 1)
    return { type: 'bar', categoryKey, valueKeys };
  if (items.length > 8 && items.length <= 30 && valueKeys.length === 1)
    return { type: 'horizontal-bar', categoryKey, valueKeys };

  return { type: 'bar', categoryKey, valueKeys };
}

// ---- Auto Chart component ----
const AutoChart = React.forwardRef<ReactECharts, { items: Record<string, unknown>[]; chartInfo: ChartDetection }>(({ items, chartInfo }, ref) => {
  const palette = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];
  const categories = items.map(r => String(r[chartInfo.categoryKey] ?? ''));

  const option = useMemo(() => {
    if (chartInfo.type === 'pie') {
      return {
        tooltip: { trigger: 'item' as const, backgroundColor: 'rgba(30,30,46,0.95)', textStyle: { color: '#e5e7eb' }, borderColor: 'rgba(139,92,246,0.3)', borderWidth: 1 },
        legend: { bottom: 0, textStyle: { color: '#9ca3af', fontSize: 12 } },
        series: [{
          type: 'pie' as const,
          radius: ['35%', '65%'],
          center: ['50%', '45%'],
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: true, formatter: '{b}: {c} ({d}%)' },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } },
          data: items.map((r, i) => ({
            name: String(r[chartInfo.categoryKey] ?? ''),
            value: r[chartInfo.valueKeys[0]] as number,
            itemStyle: { color: palette[i % palette.length] }
          }))
        }],
        animationDuration: 600
      };
    }

    const isHorizontal = chartInfo.type === 'horizontal-bar';
    const isLine = chartInfo.type === 'line';

    const categoryAxis = {
      type: 'category' as const,
      data: categories,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { fontSize: 11, color: '#6b7280', rotate: !isHorizontal && categories.length > 8 ? 30 : 0 },
      axisTick: { show: false }
    };
    const valueAxis = {
      type: 'value' as const,
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' as const } },
      axisLabel: { fontSize: 11, color: '#9ca3af' },
      axisLine: { show: false }
    };

    return {
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: 'rgba(30,30,46,0.95)',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        borderColor: 'rgba(139,92,246,0.3)', borderWidth: 1
      },
      legend: chartInfo.valueKeys.length > 1 ? { bottom: 0, textStyle: { color: '#9ca3af', fontSize: 12 } } : undefined,
      grid: { left: isHorizontal ? 120 : 48, right: 16, top: 16, bottom: chartInfo.valueKeys.length > 1 ? 40 : 8, containLabel: !isHorizontal },
      xAxis: isHorizontal ? valueAxis : categoryAxis,
      yAxis: isHorizontal ? categoryAxis : valueAxis,
      series: chartInfo.valueKeys.map((vk, si) => ({
        name: formatColumnName(vk),
        type: (isLine ? 'line' : 'bar') as 'line' | 'bar',
        data: items.map(r => r[vk] as number),
        smooth: isLine,
        symbol: isLine ? 'circle' : undefined,
        symbolSize: isLine ? 6 : undefined,
        showSymbol: isLine && items.length <= 30,
        barWidth: chartInfo.valueKeys.length === 1 ? '50%' : undefined,
        itemStyle: {
          color: palette[si % palette.length],
          borderRadius: isLine ? undefined : isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]
        },
        ...(isLine && si === 0 ? { areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: palette[si % palette.length] + '30' },
          { offset: 1, color: palette[si % palette.length] + '05' }
        ] } } } : {}),
        emphasis: { focus: 'series' as const }
      })),
      animationDuration: 600,
      animationEasing: 'cubicOut' as const
    };
  }, [items, chartInfo, categories]);

  return <ReactECharts ref={ref} option={option} style={{ height: 340 }} notMerge lazyUpdate />;
});
AutoChart.displayName = 'AutoChart';

// ---- Summary View ----
function SummaryView({ data, items }: { data: unknown; items: Record<string, unknown>[] | null }) {
  // Generate auto-summary stats
  if (items && items.length > 0) {
    const sample = items[0];
    const numKeys = Object.keys(sample).filter(k => typeof sample[k] === 'number');
    const strKeys = Object.keys(sample).filter(k => typeof sample[k] === 'string' && !k.toLowerCase().includes('url'));

    // Compute summary stats for numeric fields
    const stats = numKeys.slice(0, 6).map(k => {
      const vals = items.map(r => (r[k] as number) ?? 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = vals.length > 0 ? sum / vals.length : 0;
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      return { key: k, sum, avg, max, min, count: vals.length };
    });

    // Compute distribution for first string field
    const distKey = strKeys[0];
    const distribution = distKey ? items.reduce<Record<string, number>>((acc, r) => {
      const v = String(r[distKey] ?? 'Unknown');
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    }, {}) : {};

    return (
      <div className="space-y-4">
        {/* Quick stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Total Records</div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{items.length}</div>
          </div>
          {stats.slice(0, 5).map(s => (
            <div key={s.key} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">{formatColumnName(s.key)}</div>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                Σ {s.sum.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </div>
              <div className="text-xs text-gray-500">avg {s.avg.toFixed(1)} · max {s.max.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Distribution */}
        {distKey && Object.keys(distribution).length > 0 && Object.keys(distribution).length <= 20 && (
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Distribution by {formatColumnName(distKey)}</div>
            <div className="space-y-2">
              {Object.entries(distribution).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, count]) => {
                const pct = (count / items.length) * 100;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-36 truncate" title={label}>{label}</span>
                    <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-gray-500 w-16 text-right">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Object summary
  if (typeof data === 'object' && data !== null) {
    return <ObjectRenderer data={data as Record<string, unknown>} />;
  }

  return <div className="text-sm text-gray-700 dark:text-gray-300">{String(data)}</div>;
}

// ---- Table Renderer ----
function TableRenderer({ items, columns, compact }: { items: Record<string, unknown>[]; columns?: string[]; compact?: boolean }) {
  const cols = getColumns(items, columns, compact ? 4 : 10);
  const rows = compact ? items.slice(0, 5) : items;

  return (
    <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm z-10">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {cols.map(col => (
              <th key={col} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{formatColumnName(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
              {cols.map(col => (
                <td key={col} className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[200px] truncate">
                  {renderCell(col, row[col], row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {compact && items.length > 5 && <div className="text-xs text-gray-400 text-center py-1">+{items.length - 5} more</div>}
    </div>
  );
}

function CompactListRenderer({ items }: { items: Record<string, unknown>[] }) {
  const titleKey = findKey(items[0], ['title', 'name', 'label']) || Object.keys(items[0])[1] || Object.keys(items[0])[0];
  const idKey = findKey(items[0], ['id', 'workItemId']) || Object.keys(items[0])[0];
  const rows = items.slice(0, 4);

  return (
    <div className="space-y-1">
      {rows.map((item, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
          <span className="text-xs font-mono text-blue-600">{String(item[idKey] ?? i + 1)}</span>
          <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{String(item[titleKey] ?? '')}</span>
        </div>
      ))}
      {items.length > 4 && <div className="text-xs text-gray-400 text-center">+{items.length - 4} more</div>}
    </div>
  );
}

function ObjectRenderer({ data, compact }: { data: Record<string, unknown>; compact?: boolean }) {
  const entries = Object.entries(data).filter(([, v]) => v != null && typeof v !== 'object');
  const rows = compact ? entries.slice(0, 6) : entries;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between p-1.5 bg-gray-50 dark:bg-gray-900/30 rounded">
          <span className="text-gray-500 dark:text-gray-400">{formatColumnName(k)}</span>
          <span className="text-gray-900 dark:text-white font-medium">{formatCellValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Helper: Flatten nested API responses ----
function flattenNestedData(obj: Record<string, unknown>): Record<string, unknown>[] | null {
  // Look for arrays nested inside the object (e.g. { totalUsers: 3, users: [...] })
  // Prefer the largest array of objects (e.g. "users" over "topAreas")
  let bestArr: Record<string, unknown>[] | null = null;
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
      if (!bestArr || v.length > bestArr.length) bestArr = v as Record<string, unknown>[];
    }
  }
  if (bestArr) {
    // Strip nested arrays/objects from each row to keep tables clean
    return bestArr.map(row => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (v == null || typeof v !== 'object' || v instanceof Date) clean[k] = v;
        else if (Array.isArray(v)) clean[k] = v.length; // show count instead of nested array
        else clean[k] = JSON.stringify(v); // rare: nested object → string
      }
      return clean;
    });
  }
  // Check for Record<string,number> patterns (e.g. byArea, bySeverity, byState)
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const entries = Object.entries(val as Record<string, unknown>);
      if (entries.length > 0 && entries.every(([, v]) => typeof v === 'number')) {
        return entries.map(([name, count]) => ({ name, count: count as number, category: formatColumnName(key) }));
      }
    }
  }
  // If it's a flat KV object, return null to render as ObjectRenderer
  const flatEntries = Object.entries(obj).filter(([, v]) => v != null && typeof v !== 'object');
  if (flatEntries.length > 0) return null;
  return null;
}

function getColumns(items: Record<string, unknown>[], hints?: string[], max = 10): string[] {
  if (hints?.length) return hints;
  return Object.keys(items[0] || {}).filter(k => !k.toLowerCase().includes('url') && k !== 'devOpsUrl').slice(0, max);
}

// ============================================================================
// Helpers
// ============================================================================
function findKey(obj: Record<string, unknown> | undefined, candidates: string[]): string | undefined {
  if (!obj) return undefined;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  for (const c of candidates) {
    const idx = keys.indexOf(c.toLowerCase());
    if (idx >= 0) return Object.keys(obj)[idx];
  }
  return undefined;
}

function formatColumnName(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

function renderCell(col: string, value: unknown, row: Record<string, unknown>): React.ReactNode {
  if (value == null) return <span className="text-gray-300">—</span>;
  if (col === 'id' || col === 'workItemId') {
    const url = row.devOpsUrl || row.url;
    if (url) {
      return (
        <a href={String(url)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          className="text-blue-600 hover:underline font-mono inline-flex items-center gap-1">
          {String(value)} <ExternalLink size={10} />
        </a>
      );
    }
    return <span className="font-mono text-blue-600">{String(value)}</span>;
  }
  if (col.toLowerCase().includes('severity')) {
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(String(value))}`}>{String(value)}</span>;
  }
  if (col.toLowerCase().includes('state')) {
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStateColor(String(value))}`}>{String(value)}</span>;
  }
  return formatCellValue(value);
}

function formatCellValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString();
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDate(s);
  return s.length > 80 ? s.slice(0, 80) + '...' : s;
}
