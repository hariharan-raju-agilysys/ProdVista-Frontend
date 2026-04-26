import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
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
  ExternalLink, ChevronDown, ChevronRight, Flame, Zap, Eye
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
};

// ============================================================================
// Quick Action Chips
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
  const [aging, setAging] = useState<BugAgingDistributionDto[]>([]);
  const [agingLoading, setAgingLoading] = useState(false);
  const [customerIssues, setCustomerIssues] = useState<CustomerIssueGroupDto[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [efficiency, setEfficiency] = useState<OwnerEfficiencyDto[]>([]);
  const [efficiencyLoading, setEfficiencyLoading] = useState(false);

  // Bug table view tab
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

  const promptRef = useRef<HTMLInputElement>(null);

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
      // Sort by severity then age
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

  const loadTrend = async () => {
    setTrendLoading(true);
    try { setTrend(await getTrend(30, selectedConnectionId)); } catch { /* skip */ }
    setTrendLoading(false);
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

  const displayBugs = bugView === 'mine' ? myBugsData : allBugs;

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Quality Command Center
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {isLeadership ? 'Full team view — all bugs & analytics' : `${user?.displayName || 'My'} view — your assigned items`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {connections.length > 0 && (
                <select
                  value={selectedConnectionId || ''}
                  onChange={e => setSelectedConnectionId(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

        {/* ==================== KPI STRIP ==================== */}
        {kpi && <KpiStrip kpi={kpi} loading={kpiLoading} criticalCount={criticalBugs.length} staleCount={staleCount} />}

        {/* ==================== PRIORITY ALERT BANNER ==================== */}
        {criticalBugs.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
              <Flame size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-red-800">
                {criticalBugs.length} Critical Bug{criticalBugs.length > 1 ? 's' : ''} Require Immediate Attention
              </h3>
              <p className="text-xs text-red-600 mt-0.5">
                Oldest: {Math.max(...criticalBugs.map(b => b.ageDays))} days open
                {' · '}Customer-reported: {criticalBugs.filter(b => b.customer).length}
                {' · '}Avg age: {Math.round(criticalBugs.reduce((s, b) => s + b.ageDays, 0) / criticalBugs.length)} days
              </p>
            </div>
            <button
              onClick={() => setBugView('priority')}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
            >
              <Eye size={12} /> View All
            </button>
          </div>
        )}

        {/* ==================== MAIN DASHBOARD GRID ==================== */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT COL: Priority Bug Table (2/3 width) */}
          <div className="xl:col-span-2 space-y-6">

            {/* Priority Bugs Table */}
            <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
                    <Bug size={16} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-800">Active Issues — Priority Queue</h2>
                    <p className="text-xs text-gray-500">{displayBugs.length} items sorted by severity &amp; age</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setBugView('priority')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${bugView === 'priority' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                    >
                      {isLeadership ? 'All Bugs' : 'Priority'}
                    </button>
                    <button
                      onClick={() => setBugView('mine')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${bugView === 'mine' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                    >
                      My Bugs
                    </button>
                  </div>
                  {bugsLoading && <Loader2 size={14} className="animate-spin text-gray-400" />}
                </div>
              </div>

              {bugsLoading && displayBugs.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={20} className="animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-gray-500">Loading bugs...</span>
                </div>
              ) : displayBugs.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  {bugView === 'mine' ? 'No bugs assigned to you — great work!' : 'No active bugs found'}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 w-8"></th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">ID</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Title</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Priority</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Severity</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Age</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Assigned</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Area</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Customer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {displayBugs.slice(0, 50).map(bug => {
                        const urgency = getUrgencyLevel(bug);
                        const badge = getUrgencyBadge(urgency);
                        const isExpanded = expandedBugId === bug.id;
                        return (
                          <React.Fragment key={bug.id}>
                            <tr
                              className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${urgency === 'critical' ? 'bg-red-50/30' : ''}`}
                              onClick={() => setExpandedBugId(isExpanded ? null : bug.id)}
                            >
                              <td className="px-4 py-2.5">
                                {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                              </td>
                              <td className="px-3 py-2.5">
                                <a
                                  href={bug.devOpsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {bug.id}
                                  <ExternalLink size={10} />
                                </a>
                              </td>
                              <td className="px-3 py-2.5 text-sm text-gray-800 max-w-[280px] truncate" title={bug.title}>
                                {bug.title}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${getSeverityColor(bug.severity)}`}>
                                  {bug.severity || 'N/A'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`text-sm font-mono ${getAgingColor(bug.ageDays)}`}>
                                  {bug.ageDays}d
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[120px] truncate" title={bug.assignedTo || ''}>
                                {bug.assignedTo ? bug.assignedTo.split(' <')[0] : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[100px] truncate" title={bug.areaPath || ''}>
                                {bug.areaPath?.split('\\').pop() || '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                {bug.customer ? (
                                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                    <Users size={10} /> {bug.customer}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                            {/* Expanded Bug Detail Row */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={9} className="bg-gray-50/80 px-6 py-4">
                                  <BugDetailExpanded bug={bug} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  {displayBugs.length > 50 && (
                    <div className="text-center py-2 text-xs text-gray-400 border-t border-gray-100">
                      Showing 50 of {displayBugs.length} — use Smart Query for full results
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Trend + Aging Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bug Trend Chart */}
              <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <TrendingUp size={14} className="text-purple-500" />
                  <h3 className="text-sm font-semibold text-gray-800">30-Day Bug Trend</h3>
                  {trendLoading && <Loader2 size={12} className="animate-spin text-gray-400 ml-auto" />}
                </div>
                <div className="p-4">
                  {trend.length > 0 ? (
                    <MiniTrendChart data={trend} />
                  ) : trendLoading ? (
                    <div className="h-32 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-xs text-gray-400">No trend data</div>
                  )}
                </div>
              </section>

              {/* Aging Distribution */}
              <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Clock size={14} className="text-orange-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Bug Aging Distribution</h3>
                  {agingLoading && <Loader2 size={12} className="animate-spin text-gray-400 ml-auto" />}
                </div>
                <div className="p-4">
                  {aging.length > 0 ? (
                    <AgingBarChart data={aging} />
                  ) : agingLoading ? (
                    <div className="h-32 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-xs text-gray-400">No aging data</div>
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* RIGHT COL: Side panels (1/3 width) */}
          <div className="space-y-6">

            {/* Severity Breakdown */}
            {kpi && (
              <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Zap size={14} className="text-red-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Severity Breakdown</h3>
                </div>
                <div className="p-4 space-y-3">
                  {Object.entries(kpi.bySeverity || {}).sort().map(([sev, count]) => {
                    const total = Object.values(kpi.bySeverity).reduce((s, v) => s + v, 0);
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={sev}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getSeverityColor(sev)}`}>{sev}</span>
                          <span className="text-xs font-bold text-gray-700">{count}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${sev.includes('Critical') ? 'bg-red-500' : sev.includes('High') ? 'bg-orange-500' : sev.includes('Medium') ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Customer Issues (Leadership only) */}
            {isLeadership && (
              <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Users size={14} className="text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Customer Issues</h3>
                  {customerLoading && <Loader2 size={12} className="animate-spin text-gray-400 ml-auto" />}
                </div>
                <div className="p-3 max-h-[280px] overflow-y-auto">
                  {customerIssues.length > 0 ? customerIssues.slice(0, 8).map(ci => (
                    <div key={ci.customerName} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 group">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {ci.customerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{ci.customerName}</div>
                        <div className="text-xs text-gray-500">
                          {ci.activeIssues} active · {ci.criticalIssues > 0 ? <span className="text-red-600 font-medium">{ci.criticalIssues} critical</span> : <span>{ci.resolvedIssues} resolved</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-gray-800">{ci.totalIssues}</div>
                        <div className="text-[10px] text-gray-400">{ci.avgResolutionDays.toFixed(0)}d avg</div>
                      </div>
                    </div>
                  )) : customerLoading ? (
                    <div className="py-8 text-center"><Loader2 size={16} className="animate-spin text-gray-400 mx-auto" /></div>
                  ) : (
                    <div className="py-8 text-center text-xs text-gray-400">No customer issues</div>
                  )}
                </div>
              </section>
            )}

            {/* Top Area Hotspots */}
            {kpi && kpi.topAreas && kpi.topAreas.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Shield size={14} className="text-pink-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Bug Hotspot Areas</h3>
                </div>
                <div className="p-3 space-y-1">
                  {kpi.topAreas.slice(0, 6).map((area, i) => (
                    <div key={area.area} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50">
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <span className="text-sm text-gray-800 flex-1 truncate">{area.area}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {area.critical > 0 && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">{area.critical}C</span>
                        )}
                        <span className="text-xs font-semibold text-gray-700">{area.total}</span>
                        <span className={`text-[10px] ${area.avgAge > 14 ? 'text-red-500' : 'text-gray-400'}`}>{area.avgAge.toFixed(0)}d</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Team Efficiency (Leadership only) */}
            {isLeadership && efficiency.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                  <BarChart3 size={14} className="text-emerald-500" />
                  <h3 className="text-sm font-semibold text-gray-800">Team Efficiency</h3>
                  {efficiencyLoading && <Loader2 size={12} className="animate-spin text-gray-400 ml-auto" />}
                </div>
                <div className="p-3 max-h-[250px] overflow-y-auto">
                  {efficiency.slice(0, 8).map(e => (
                    <div key={e.ownerName} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50">
                      <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-[10px] font-bold text-emerald-700 flex-shrink-0">
                        {e.ownerName.slice(0, 1)}
                      </div>
                      <span className="text-xs text-gray-800 flex-1 truncate">{e.ownerName.split(' <')[0]}</span>
                      <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        <span className="text-gray-500">{e.resolved}/{e.totalAssigned}</span>
                        <span className={`font-bold ${e.efficiencyScore >= 70 ? 'text-green-600' : e.efficiencyScore >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {e.efficiencyScore.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* ==================== SMART QUERY BAR ==================== */}
        <section className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="flex items-center gap-3 p-4">
            <div className="flex items-center gap-2 text-purple-500"><Sparkles size={20} /></div>
            <input
              ref={promptRef}
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ask anything... e.g. 'Show critical bugs in PMS module' or 'Bug trend last 30 days'"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
              disabled={queryLoading}
            />
            {prompt && (
              <button type="button" onClick={() => { setPrompt(''); setQueryResult(null); setInterpretation(null); setQueryError(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
            <button
              type="submit"
              disabled={queryLoading || !prompt.trim()}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {queryLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Query
            </button>
          </form>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(qa => (
              <button
                key={qa.label}
                onClick={() => { setPrompt(qa.prompt); executeSmartQuery(qa.prompt); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all hover:shadow-sm hover:-translate-y-0.5
                  border-${qa.color}-200 text-${qa.color}-700 bg-${qa.color}-50 hover:bg-${qa.color}-100`}
              >
                <qa.icon size={12} />
                {qa.label}
              </button>
            ))}
          </div>
        </section>

        {/* Query Result */}
        {(queryLoading || queryResult != null || queryError || interpretation) && (
          <section className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            {interpretation && (
              <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600">{interpretation.endpointKey}</span>
                  <span className="text-sm text-gray-600">{interpretation.explanation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{interpretation.visualizationType}</span>
                  <button onClick={handleSavePanel} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600" title="Save as panel">
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
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Bookmark size={18} className="text-purple-500" />
                Saved Panels
                <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{panels.length}</span>
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
      </main>
    </div>
  );
}

// ============================================================================
// KPI Strip
// ============================================================================
function KpiStrip({ kpi, loading, criticalCount, staleCount }: { kpi: KpiSummary; loading: boolean; criticalCount: number; staleCount: number }) {
  const cards = [
    { label: 'Active Bugs', value: kpi.activeBugs, icon: Bug, color: 'text-red-500', bg: 'bg-red-50', sub: `${criticalCount} critical` },
    { label: 'Resolution Rate', value: `${kpi.resolutionRate.toFixed(0)}%`, icon: Shield, color: 'text-green-500', bg: 'bg-green-50', sub: `${kpi.resolvedBugs} resolved` },
    { label: 'MTTR', value: `${kpi.mttr.toFixed(1)}d`, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', sub: 'Mean time to resolve' },
    { label: 'Stale (14d+)', value: staleCount, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', sub: 'Need attention' },
    { label: 'Weekly Velocity', value: `+${kpi.weeklyCreated}/-${kpi.weeklyResolved}`, icon: kpi.bugTrend <= 0 ? TrendingDown : TrendingUp, color: kpi.bugTrend <= 0 ? 'text-green-500' : 'text-red-500', bg: kpi.bugTrend <= 0 ? 'bg-green-50' : 'bg-red-50', sub: kpi.bugTrend <= 0 ? 'Trend improving' : 'Trend worsening' },
    { label: 'Total Items', value: kpi.totalWorkItems, icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50', sub: `${kpi.features} features · ${kpi.tasks} tasks` },
  ];

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 ${loading ? 'opacity-60' : ''}`}>
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{c.label}</span>
            <div className={`w-7 h-7 ${c.bg} rounded-lg flex items-center justify-center`}>
              <c.icon size={14} className={c.color} />
            </div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{typeof c.value === 'number' ? String(c.value.toLocaleString()) : String(c.value)}</div>
          <div className="text-[11px] text-gray-400 mt-1">{c.sub}</div>
        </div>
      ))}
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
    if (bug.ageDays > 14) steps.push(`⚠️ Open for ${bug.ageDays} days — escalate if blocked`);
    if (bug.reopenCount > 0) steps.push(`🔄 Reopened ${bug.reopenCount}x — ensure root cause fix`);
    steps.push('Write regression test before marking resolved');
    return steps;
  }, [bug, urgency]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Detail info */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Bug Details</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-gray-400">State:</span> <span className={`px-1.5 py-0.5 rounded font-medium ${getStateColor(bug.state)}`}>{bug.state}</span></div>
          <div><span className="text-gray-400">Created:</span> <span className="text-gray-700">{formatDate(bug.createdDate)}</span></div>
          <div><span className="text-gray-400">Area:</span> <span className="text-gray-700">{bug.areaPath || '—'}</span></div>
          <div><span className="text-gray-400">Iteration:</span> <span className="text-gray-700">{bug.iterationPath || '—'}</span></div>
          <div><span className="text-gray-400">Dev Owner:</span> <span className="text-gray-700">{bug.devOwner || '—'}</span></div>
          <div><span className="text-gray-400">BA Owner:</span> <span className="text-gray-700">{bug.baOwner || '—'}</span></div>
          {bug.tags.length > 0 && (
            <div className="col-span-2"><span className="text-gray-400">Tags:</span> {bug.tags.map(t => <span key={t} className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{t}</span>)}</div>
          )}
          {bug.parentTitle && (
            <div className="col-span-2"><span className="text-gray-400">Parent:</span> <span className="text-gray-700">{bug.parentType}: {bug.parentTitle}</span></div>
          )}
        </div>
        <a href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
          Open in Azure DevOps <ExternalLink size={10} />
        </a>
      </div>

      {/* Fix guidance */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Recommended Fix Steps</h4>
        <ol className="space-y-1.5">
          {fixSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="text-gray-700">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ============================================================================
// Mini Trend Chart (SVG)
// ============================================================================
function MiniTrendChart({ data }: { data: QualityTrendPointDto[] }) {
  const h = 120, w = 400;
  const padL = 30, padR = 10, padT = 10, padB = 20;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const maxVal = Math.max(...data.map(d => Math.max(d.opened, d.closed, d.cumulativeActive)), 1);
  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const buildPath = (getter: (d: QualityTrendPointDto) => number) => {
    return data.map((d, i) => {
      const x = padL + i * xStep;
      const y = padT + chartH - (getter(d) / maxVal) * chartH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = padT + chartH * (1 - f);
        return <line key={f} x1={padL} x2={w - padR} y1={y} y2={y} stroke="#f0f0f0" strokeWidth={1} />;
      })}
      <path d={buildPath(d => d.cumulativeActive)} fill="none" stroke="#a78bfa" strokeWidth={2} opacity={0.5} />
      <path d={buildPath(d => d.opened)} fill="none" stroke="#ef4444" strokeWidth={1.5} />
      <path d={buildPath(d => d.closed)} fill="none" stroke="#22c55e" strokeWidth={1.5} />
      <text x={padL - 4} y={padT + 4} fill="#9ca3af" fontSize={8} textAnchor="end">{maxVal}</text>
      <text x={padL - 4} y={padT + chartH + 4} fill="#9ca3af" fontSize={8} textAnchor="end">0</text>
      <circle cx={padL + 10} cy={h - 4} r={3} fill="#ef4444" />
      <text x={padL + 16} y={h - 1} fill="#6b7280" fontSize={7}>Opened</text>
      <circle cx={padL + 55} cy={h - 4} r={3} fill="#22c55e" />
      <text x={padL + 61} y={h - 1} fill="#6b7280" fontSize={7}>Closed</text>
      <circle cx={padL + 95} cy={h - 4} r={3} fill="#a78bfa" />
      <text x={padL + 101} y={h - 1} fill="#6b7280" fontSize={7}>Active</text>
    </svg>
  );
}

// ============================================================================
// Aging Bar Chart (SVG)
// ============================================================================
function AgingBarChart({ data }: { data: BugAgingDistributionDto[] }) {
  const h = 120, w = 400;
  const padL = 10, padR = 10, padT = 10, padB = 30;
  const chartH = h - padT - padB;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barW = Math.min(40, (w - padL - padR) / data.length - 8);
  const colors = ['#22c55e', '#86efac', '#fbbf24', '#f97316', '#ef4444', '#dc2626'];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32">
      {data.map((d, i) => {
        const barH = (d.count / maxCount) * chartH;
        const x = padL + i * ((w - padL - padR) / data.length) + ((w - padL - padR) / data.length - barW) / 2;
        const y = padT + chartH - barH;
        return (
          <g key={d.range}>
            <rect x={x} y={y} width={barW} height={barH} fill={colors[i % colors.length]} rx={3} />
            <text x={x + barW / 2} y={y - 4} fill="#374151" fontSize={8} textAnchor="middle" fontWeight="bold">{d.count}</text>
            <text x={x + barW / 2} y={h - padB + 12} fill="#6b7280" fontSize={7} textAnchor="middle">{d.range}</text>
            <text x={x + barW / 2} y={h - padB + 22} fill="#9ca3af" fontSize={6} textAnchor="middle">{d.percentage.toFixed(0)}%</text>
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================================
// Saved Panel Card
// ============================================================================
function SavedPanelCard({
  panel, result, loading, onRun, onTogglePin, onDelete, onLoadPrompt
}: {
  panel: QualityQueryPanelDto;
  result?: unknown;
  loading: boolean;
  onRun: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onLoadPrompt: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${panel.isPinned ? 'border-purple-300 ring-1 ring-purple-100' : 'border-gray-200/80'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800 truncate flex-1 mr-2">{panel.name}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onTogglePin} className="p-1 text-gray-400 hover:text-purple-500" title={panel.isPinned ? 'Unpin' : 'Pin'}>
              {panel.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
          </div>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{panel.prompt}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{panel.endpointKey}</span>
          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{panel.visualizationType}</span>
        </div>
      </div>
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 flex items-center justify-between">
        <button onClick={onRun} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? 'Running...' : 'Run'}
        </button>
        <button onClick={onLoadPrompt} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <Search size={12} /> Edit & Run
        </button>
      </div>
      {result != null && !loading && (
        <div className="border-t border-gray-100 p-3 max-h-48 overflow-auto">
          <DynamicResultRenderer data={result} visualizationType={panel.visualizationType as never} compact />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Dynamic Result Renderer
// ============================================================================
function DynamicResultRenderer({
  data, visualizationType, visualization, compact
}: {
  data: unknown;
  visualizationType: 'table' | 'chart' | 'kpi' | 'list';
  visualization?: SmartQueryInterpretation['visualization'];
  compact?: boolean;
}) {
  if (data == null) return <div className="text-sm text-gray-400">No data</div>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <div className="text-sm text-gray-400">No results found</div>;
    if (visualizationType === 'list' || compact) return <ListRenderer items={data} compact={compact} />;
    return <TableRenderer items={data} columns={visualization?.columns} compact={compact} />;
  }

  if (typeof data === 'object') return <ObjectRenderer data={data as Record<string, unknown>} compact={compact} />;
  return <div className="text-sm text-gray-700">{String(data)}</div>;
}

function TableRenderer({ items, columns, compact }: { items: Record<string, unknown>[]; columns?: string[]; compact?: boolean }) {
  const cols = columns?.length ? columns : Object.keys(items[0] || {}).filter(k => !k.toLowerCase().includes('url') && k !== 'devOpsUrl').slice(0, compact ? 4 : 10);
  const rows = compact ? items.slice(0, 5) : items;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200">
            {cols.map(col => (
              <th key={col} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{formatColumnName(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              {cols.map(col => (
                <td key={col} className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap max-w-[200px] truncate">
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

function ListRenderer({ items, compact }: { items: Record<string, unknown>[]; compact?: boolean }) {
  const rows = compact ? items.slice(0, 4) : items;
  const titleKey = findKey(items[0], ['title', 'name', 'label']) || Object.keys(items[0])[1] || Object.keys(items[0])[0];
  const idKey = findKey(items[0], ['id', 'workItemId']) || Object.keys(items[0])[0];

  return (
    <div className="space-y-2">
      {rows.map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
          {item.devOpsUrl ? (
            <a href={String(item.devOpsUrl)} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-600 hover:underline flex items-center gap-0.5">
              #{String(item[idKey] ?? i + 1)}<ExternalLink size={8} />
            </a>
          ) : (
            <span className="text-xs font-mono text-gray-400">#{String(item[idKey] ?? i + 1)}</span>
          )}
          <span className="text-sm text-gray-800 truncate flex-1">{String(item[titleKey] ?? '')}</span>
          {item.state != null && <StateChip state={String(item.state)} />}
          {item.severity != null && <SeverityChip severity={String(item.severity)} />}
          {item.ageDays != null && <span className={`text-xs font-mono ${getAgingColor(Number(item.ageDays))}`}>{String(item.ageDays)}d</span>}
          {item.assignedTo != null && <span className="text-xs text-gray-400 truncate max-w-[120px]">{String(item.assignedTo).split(' <')[0]}</span>}
        </div>
      ))}
      {compact && items.length > 4 && <div className="text-xs text-gray-400 text-center">+{items.length - 4} more</div>}
    </div>
  );
}

function ObjectRenderer({ data, compact }: { data: Record<string, unknown>; compact?: boolean }) {
  const entries = Object.entries(data).filter(([, v]) => typeof v !== 'object' || v === null);
  const shown = compact ? entries.slice(0, 6) : entries;

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
      {shown.map(([key, val]) => (
        <div key={key} className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">{formatColumnName(key)}</div>
          <div className="text-lg font-semibold text-gray-800">{typeof val === 'number' ? String(val.toLocaleString()) : String(val ?? '\u2014')}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function formatColumnName(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\s/, '').replace(/\b\w/g, c => c.toUpperCase());
}

function renderCell(key: string, value: unknown, row?: Record<string, unknown>): React.ReactNode {
  if (value == null) return <span className="text-gray-300">&mdash;</span>;
  if (typeof value === 'boolean') return value ? '\u2713' : '\u2717';
  if (key.toLowerCase().includes('date') && typeof value === 'string') return formatDate(value);
  if (key === 'state') return <StateChip state={String(value)} />;
  if (key === 'severity') return <SeverityChip severity={String(value)} />;
  if (key === 'id' && row?.devOpsUrl) {
    return (
      <a href={String(row.devOpsUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5">
        {String(value)}<ExternalLink size={8} />
      </a>
    );
  }
  if (typeof value === 'number') return String(value.toLocaleString());
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function StateChip({ state }: { state: string }) {
  const color = getStateColor(state);
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${color}`} style={{ fontSize: '0.65rem' }}>{state}</span>;
}

function SeverityChip({ severity }: { severity: string }) {
  const color = getSeverityColor(severity);
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${color}`} style={{ fontSize: '0.65rem' }}>{severity}</span>;
}

function findKey(obj: Record<string, unknown> | undefined, candidates: string[]): string | undefined {
  if (!obj) return undefined;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  return candidates.find(c => keys.includes(c.toLowerCase()));
}
