import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Bug, GitPullRequest, CheckCircle, Clock, AlertTriangle, RefreshCw, Settings, 
  ChevronDown, ChevronRight, ExternalLink, Filter, Search, Calendar, 
  GitCommit, Eye, MessageSquare, XCircle, User, Tag, ArrowUpDown
} from 'lucide-react';
import clsx from 'clsx';
import engineeringService, { 
  type DevOpsOverviewData, type AzureDevOpsWorkItem, type AzureDevOpsPullRequest,
  type AzureDevOpsIterationPath, type EngineeringConfig,
} from '../services/engineeringService';

// --- Helper functions ---

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function priorityLabel(p?: number): { text: string; color: string } {
  switch (p) {
    case 1: return { text: 'Critical', color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/40' };
    case 2: return { text: 'High', color: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/40' };
    case 3: return { text: 'Medium', color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/40' };
    case 4: return { text: 'Low', color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/40' };
    default: return { text: 'None', color: 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-700' };
  }
}

function stateColor(state: string): string {
  switch (state) {
    case 'New': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'Active': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'Resolved': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'Closed': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
}

function typeIcon(t: string): string {
  switch (t) {
    case 'Bug': return '🐛';
    case 'Task': return '📋';
    case 'User Story': return '📖';
    case 'Feature': return '🚀';
    case 'Epic': return '🏔️';
    default: return '📄';
  }
}

function voteDisplay(vote: number): { icon: React.ReactNode; label: string; color: string } {
  if (vote === 10) return { icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Approved', color: 'text-green-600 dark:text-green-400' };
  if (vote === 5) return { icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Approved w/ suggestions', color: 'text-yellow-600 dark:text-yellow-400' };
  if (vote === -10) return { icon: <XCircle className="w-3.5 h-3.5" />, label: 'Rejected', color: 'text-red-600 dark:text-red-400' };
  if (vote === -5) return { icon: <Clock className="w-3.5 h-3.5" />, label: 'Waiting', color: 'text-orange-500 dark:text-orange-400' };
  return { icon: <Eye className="w-3.5 h-3.5" />, label: 'No vote', color: 'text-gray-400 dark:text-gray-500' };
}

// --- Config Dialog ---

function ConfigDialog({ config, onSave, onClose }: { 
  config: EngineeringConfig | null; 
  onSave: (c: EngineeringConfig) => void; 
  onClose: () => void;
}) {
  const [orgUrl, setOrgUrl] = useState(config?.organizationUrl || 'https://dev.azure.com/AGYS-VisualOne');
  const [project, setProject] = useState(config?.projectName || 'PMS');
  const [useSprint, setUseSprint] = useState(config?.useSprintTracking ?? false);
  const [iterPath, setIterPath] = useState(config?.defaultIterationPath || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Azure DevOps Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Organization URL</label>
            <input value={orgUrl} onChange={e => setOrgUrl(e.target.value)} placeholder="https://dev.azure.com/org"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Project Name</label>
            <input value={project} onChange={e => setProject(e.target.value)} placeholder="PMS"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Default Iteration Path (optional)</label>
            <input value={iterPath} onChange={e => setIterPath(e.target.value)} placeholder="PMS\Sprint 1"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useSprint} onChange={e => setUseSprint(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-gray-700 dark:text-slate-300">Enable Sprint Tracking</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
          <button onClick={() => { onSave({ organizationUrl: orgUrl.trim(), projectName: project.trim(), projectNames: [project.trim()], useSprintTracking: useSprint, defaultIterationPath: iterPath.trim() || undefined }); onClose(); }}
            disabled={!orgUrl.trim() || !project.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}

// --- Stats Card ---

function StatCard({ label, value, icon, color, subtext }: { label: string; value: number; icon: React.ReactNode; color: string; subtext?: string }) {
  return (
    <div className={clsx('rounded-xl border p-4 flex items-center gap-4 transition-all hover:shadow-md', color)}>
      <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-white/60 dark:bg-black/20 shadow-sm">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs font-medium opacity-80">{label}</div>
        {subtext && <div className="text-xs opacity-60 mt-0.5">{subtext}</div>}
      </div>
    </div>
  );
}

// --- Main Page Component ---

export default function DevOpsOverviewPage() {
  const [data, setData] = useState<DevOpsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<EngineeringConfig | null>(() => engineeringService.getSavedConfig());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Work items state
  const [wiFilter, setWiFilter] = useState<string>('all'); // all | Bug | Task | User Story
  const [wiState, setWiState] = useState<string>('all');
  const [wiSearch, setWiSearch] = useState('');
  const [wiSort, setWiSort] = useState<'priority' | 'date' | 'state'>('priority');
  const [expandedWi, setExpandedWi] = useState<number | null>(null);

  // PR state
  const [prTab, setPrTab] = useState<'waiting' | 'approved' | 'completed' | 'all'>('waiting');
  const [prSearch, setPrSearch] = useState('');
  const [expandedPr, setExpandedPr] = useState<number | null>(null);

  // Iteration state
  const [selectedIteration, setSelectedIteration] = useState<string | null>(null);
  const [iterWorkItems, setIterWorkItems] = useState<AzureDevOpsWorkItem[]>([]);
  const [iterLoading, setIterLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!config) { setLoading(false); setShowConfig(true); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await engineeringService.getOverview(
        config.organizationUrl, config.projectName,
        config.defaultIterationPath, config.useSprintTracking ?? false
      );
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DevOps data');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 3 min
  useEffect(() => {
    if (!config) return;
    const timer = setInterval(fetchData, 3 * 60 * 1000);
    return () => clearInterval(timer);
  }, [config, fetchData]);

  const handleSaveConfig = useCallback((c: EngineeringConfig) => {
    engineeringService.saveConfig(c);
    setConfig(c);
  }, []);

  // Load work items for a selected iteration
  const loadIterationWorkItems = useCallback(async (iterPath: string) => {
    if (!config) return;
    setIterLoading(true);
    try {
      const items = await engineeringService.getWorkItemsByIteration(config.organizationUrl, config.projectName, iterPath);
      setIterWorkItems(items);
    } catch { setIterWorkItems([]); }
    finally { setIterLoading(false); }
  }, [config]);

  const handleSelectIteration = useCallback((iter: AzureDevOpsIterationPath) => {
    if (selectedIteration === iter.path) {
      setSelectedIteration(null);
      setIterWorkItems([]);
    } else {
      setSelectedIteration(iter.path);
      loadIterationWorkItems(iter.path);
    }
  }, [selectedIteration, loadIterationWorkItems]);

  // --- Computed values ---

  const filteredWorkItems = useMemo(() => {
    if (!data) return [];
    let items = data.todayWorkItems;
    if (wiFilter !== 'all') items = items.filter(w => w.workItemType === wiFilter);
    if (wiState !== 'all') items = items.filter(w => w.state === wiState);
    if (wiSearch) {
      const q = wiSearch.toLowerCase();
      items = items.filter(w => w.title.toLowerCase().includes(q) || w.id.toString().includes(q) || (w.assignedTo || '').toLowerCase().includes(q));
    }
    return [...items].sort((a, b) => {
      if (wiSort === 'priority') return (a.priority ?? 4) - (b.priority ?? 4);
      if (wiSort === 'date') return new Date(b.changedDate || b.createdDate || 0).getTime() - new Date(a.changedDate || a.createdDate || 0).getTime();
      return a.state.localeCompare(b.state);
    });
  }, [data, wiFilter, wiState, wiSearch, wiSort]);

  const filteredPRs = useMemo(() => {
    if (!data) return [];
    let prs: AzureDevOpsPullRequest[] = [];
    if (prTab === 'waiting') prs = data.activePullRequests.filter(pr => !pr.isDraft && pr.reviewers.every(r => r.vote === 0));
    else if (prTab === 'approved') prs = data.activePullRequests.filter(pr => pr.reviewers.some(r => r.vote === 10));
    else if (prTab === 'completed') prs = data.completedPullRequests;
    else prs = data.activePullRequests;

    if (prSearch) {
      const q = prSearch.toLowerCase();
      prs = prs.filter(pr => pr.title.toLowerCase().includes(q) || pr.createdByName?.toLowerCase().includes(q) || pr.repositoryName.toLowerCase().includes(q));
    }
    return prs;
  }, [data, prTab, prSearch]);

  const workItemTypeCounts = useMemo(() => {
    if (!data) return { Bug: 0, Task: 0, 'User Story': 0, Feature: 0 };
    const counts: Record<string, number> = {};
    data.todayWorkItems.forEach(w => { counts[w.workItemType] = (counts[w.workItemType] || 0) + 1; });
    return counts;
  }, [data]);

  const workItemStateCounts = useMemo(() => {
    if (!data) return {};
    const counts: Record<string, number> = {};
    data.todayWorkItems.forEach(w => { counts[w.state] = (counts[w.state] || 0) + 1; });
    return counts;
  }, [data]);

  // Current iteration detection
  const currentIteration = useMemo(() => {
    if (!data?.iterations) return null;
    const now = new Date();
    return data.iterations.find(i => i.startDate && i.finishDate && new Date(i.startDate) <= now && new Date(i.finishDate) >= now) || null;
  }, [data]);

  // --- Render ---

  if (showConfig) {
    return <ConfigDialog config={config} onSave={handleSaveConfig} onClose={() => { if (config) setShowConfig(false); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6">
      {/* Header */}
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <GitPullRequest className="w-5 h-5 text-white" />
              </div>
              DevOps Overview
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              {config?.projectName} &middot; {currentIteration ? `Current: ${currentIteration.name}` : 'Board view'} 
              {lastRefresh && <span className="ml-2">&middot; Updated {timeAgo(lastRefresh.toISOString())}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} disabled={loading}
              className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
              <RefreshCw className={clsx('w-4.5 h-4.5', loading && 'animate-spin')} />
            </button>
            <button onClick={() => setShowConfig(true)}
              className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4 inline mr-2" />{error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400">Loading DevOps data...</p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <StatCard label="Today's Work Items" value={data.todayWorkItems.length} 
                icon={<GitCommit className="w-5 h-5 text-blue-600" />} 
                color="border-blue-200 dark:border-blue-800/50 bg-blue-50/80 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100" />
              <StatCard label="Today's Bugs" value={data.todayBugs.length} 
                icon={<Bug className="w-5 h-5 text-red-600" />} 
                color="border-red-200 dark:border-red-800/50 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-100" />
              <StatCard label="PRs Waiting Review" value={data.pullRequestStats.waitingReview} 
                icon={<Eye className="w-5 h-5 text-amber-600" />} 
                color="border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100" />
              <StatCard label="PRs Approved" value={data.pullRequestStats.approved} 
                icon={<CheckCircle className="w-5 h-5 text-green-600" />} 
                color="border-green-200 dark:border-green-800/50 bg-green-50/80 dark:bg-green-950/30 text-green-900 dark:text-green-100" />
              <StatCard label="Completed Today" value={data.pullRequestStats.completedToday} 
                icon={<GitPullRequest className="w-5 h-5 text-purple-600" />} 
                color="border-purple-200 dark:border-purple-800/50 bg-purple-50/80 dark:bg-purple-950/30 text-purple-900 dark:text-purple-100" />
              <StatCard label="Active PRs" value={data.pullRequestStats.totalActive}
                icon={<MessageSquare className="w-5 h-5 text-indigo-600" />}
                color="border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-100"
                subtext={data.pullRequestStats.conflicts > 0 ? `${data.pullRequestStats.conflicts} with conflicts` : undefined} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* LEFT COLUMN — Work Items */}
              <div className="xl:col-span-2 space-y-6">
                {/* Today's Work Items */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Calendar className="w-4.5 h-4.5 text-blue-500" />
                        Today's Work Items
                        <span className="text-xs font-normal text-gray-500 dark:text-slate-400">({data.todayWorkItems.length})</span>
                      </h2>
                      <button onClick={() => setWiSort(s => s === 'priority' ? 'date' : s === 'date' ? 'state' : 'priority')}
                        className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 hover:text-blue-500 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                        <ArrowUpDown className="w-3 h-3" />Sort by {wiSort}
                      </button>
                    </div>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input value={wiSearch} onChange={e => setWiSearch(e.target.value)} placeholder="Search work items..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex gap-1">
                        {['all', 'Bug', 'Task', 'User Story'].map(t => (
                          <button key={t} onClick={() => setWiFilter(t)}
                            className={clsx('px-2.5 py-1.5 text-xs rounded-lg transition-colors border',
                              wiFilter === t 
                                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' 
                                : 'text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700')}>
                            {t === 'all' ? `All (${data.todayWorkItems.length})` : `${typeIcon(t)} ${t} (${workItemTypeCounts[t] || 0})`}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {['all', 'New', 'Active', 'Resolved', 'Closed'].map(s => (
                          <button key={s} onClick={() => setWiState(s)}
                            className={clsx('px-2 py-1.5 text-xs rounded-lg transition-colors',
                              wiState === s ? 'bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                            )}>
                            {s === 'all' ? 'All' : `${s} (${workItemStateCounts[s] || 0})`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Work Items List */}
                  <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[520px] overflow-y-auto">
                    {filteredWorkItems.length === 0 ? (
                      <div className="px-5 py-12 text-center text-gray-400 dark:text-slate-500 text-sm">No work items match filters</div>
                    ) : filteredWorkItems.map(wi => (
                      <div key={wi.id} className="hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors">
                        <button onClick={() => setExpandedWi(expandedWi === wi.id ? null : wi.id)}
                          className="w-full px-5 py-3 flex items-center gap-3 text-left">
                          <span className="text-base flex-shrink-0">{typeIcon(wi.workItemType)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">#{wi.id}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{wi.title}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={clsx('px-1.5 py-0.5 text-[10px] rounded-md font-medium', stateColor(wi.state))}>{wi.state}</span>
                              <span className={clsx('px-1.5 py-0.5 text-[10px] rounded-md font-medium', priorityLabel(wi.priority).color)}>{priorityLabel(wi.priority).text}</span>
                              {wi.assignedTo && (
                                <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-slate-400">
                                  <User className="w-3 h-3" />{wi.assignedTo.split('<')[0].trim()}
                                </span>
                              )}
                              {wi.iterationPath && (
                                <span className="text-[11px] text-gray-400 dark:text-slate-500 truncate max-w-[120px]">{wi.iterationPath.split('\\').pop()}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-gray-400 dark:text-slate-500 flex-shrink-0">
                            {wi.changedDate ? timeAgo(wi.changedDate) : wi.createdDate ? timeAgo(wi.createdDate) : ''}
                          </span>
                          {expandedWi === wi.id ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        </button>
                        {expandedWi === wi.id && (
                          <div className="px-5 pb-4 pl-14 space-y-2 animate-in slide-in-from-top-1">
                            {wi.description && <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-3">{wi.description.replace(/<[^>]+>/g, '')}</p>}
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-slate-400">
                              {wi.areaPath && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />Area: {wi.areaPath}</span>}
                              {wi.iterationPath && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Iteration: {wi.iterationPath}</span>}
                              {wi.tags && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{wi.tags}</span>}
                              {wi.severity && <span>Severity: {wi.severity}</span>}
                            </div>
                            <a href={`${config?.organizationUrl}/${config?.projectName}/_workitems/edit/${wi.id}`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                              Open in Azure DevOps <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pull Requests Section */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <GitPullRequest className="w-4.5 h-4.5 text-purple-500" />
                        Pull Requests
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input value={prSearch} onChange={e => setPrSearch(e.target.value)} placeholder="Search PRs..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex gap-1">
                        {(['waiting', 'approved', 'completed', 'all'] as const).map(tab => (
                          <button key={tab} onClick={() => setPrTab(tab)}
                            className={clsx('px-3 py-1.5 text-xs rounded-lg transition-colors capitalize border',
                              prTab === tab
                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                                : 'text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700')}>
                            {tab === 'waiting' ? `⏳ Waiting (${data.pullRequestStats.waitingReview})` 
                              : tab === 'approved' ? `✅ Approved (${data.pullRequestStats.approved})`
                              : tab === 'completed' ? `🎉 Completed (${data.pullRequestStats.completedToday})`
                              : `All (${data.pullRequestStats.totalActive})`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-[420px] overflow-y-auto">
                    {filteredPRs.length === 0 ? (
                      <div className="px-5 py-12 text-center text-gray-400 dark:text-slate-500 text-sm">No pull requests</div>
                    ) : filteredPRs.map(pr => (
                      <div key={pr.pullRequestId} className="hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors">
                        <button onClick={() => setExpandedPr(expandedPr === pr.pullRequestId ? null : pr.pullRequestId)}
                          className="w-full px-5 py-3 flex items-center gap-3 text-left">
                          <GitPullRequest className={clsx('w-4 h-4 flex-shrink-0', 
                            pr.status === 'completed' ? 'text-purple-500' : pr.isDraft ? 'text-gray-400' : 'text-green-500')} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">!{pr.pullRequestId}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{pr.title}</span>
                              {pr.isDraft && <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Draft</span>}
                              {pr.mergeStatus === 'conflicts' && <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">Conflicts</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-gray-500 dark:text-slate-400">{pr.createdByName?.split('<')[0].trim() || 'Unknown'}</span>
                              <span className="text-[11px] text-gray-400 dark:text-slate-500">{pr.repositoryName}</span>
                              <span className="text-[11px] text-gray-400 dark:text-slate-500">{pr.sourceBranch?.replace('refs/heads/', '')} → {pr.targetBranch?.replace('refs/heads/', '')}</span>
                            </div>
                          </div>
                          {/* Reviewer votes */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {pr.reviewers?.slice(0, 3).map((r, i) => {
                              const v = voteDisplay(r.vote);
                              return <span key={i} className={clsx('p-0.5', v.color)} title={`${r.displayName}: ${v.label}`}>{v.icon}</span>;
                            })}
                            {(pr.reviewers?.length || 0) > 3 && <span className="text-[10px] text-gray-400">+{(pr.reviewers?.length || 0) - 3}</span>}
                          </div>
                          <span className="text-[11px] text-gray-400 dark:text-slate-500 flex-shrink-0">{timeAgo(pr.creationDate)}</span>
                          {expandedPr === pr.pullRequestId ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        </button>
                        {expandedPr === pr.pullRequestId && (
                          <div className="px-5 pb-4 pl-12 space-y-2 animate-in slide-in-from-top-1">
                            {pr.description && <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-3">{pr.description}</p>}
                            <div className="flex flex-wrap gap-2">
                              {pr.reviewers?.map((r, i) => {
                                const v = voteDisplay(r.vote);
                                return (
                                  <span key={i} className={clsx('inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600', v.color)}>
                                    {v.icon} {r.displayName} {r.isRequired && <span className="text-[9px]">(required)</span>}
                                  </span>
                                );
                              })}
                            </div>
                            <a href={pr.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                              Open in Azure DevOps <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN — Iterations + Quick Stats */}
              <div className="space-y-6">
                {/* Bug Summary */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <Bug className="w-4.5 h-4.5 text-red-500" />
                    Today's Bugs ({data.todayBugs.length})
                  </h3>
                  {data.todayBugs.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">No bugs today 🎉</p>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto">
                      {data.todayBugs.slice(0, 15).map(bug => (
                        <a key={bug.id} href={`${config?.organizationUrl}/${config?.projectName}/_workitems/edit/${bug.id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="block p-2.5 rounded-lg border border-gray-100 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all">
                          <div className="flex items-start gap-2">
                            <span className={clsx('px-1.5 py-0.5 text-[10px] rounded font-medium flex-shrink-0 mt-0.5', priorityLabel(bug.priority).color)}>P{bug.priority}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2">{bug.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={clsx('px-1.5 py-0.5 text-[10px] rounded', stateColor(bug.state))}>{bug.state}</span>
                                {bug.assignedTo && <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{bug.assignedTo.split('<')[0].trim()}</span>}
                              </div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Iterations */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <Filter className="w-4.5 h-4.5 text-indigo-500" />
                    Iterations
                  </h3>
                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                    {data.iterations.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">No iterations found</p>
                    ) : data.iterations.map(iter => {
                      const isCurrent = currentIteration?.path === iter.path;
                      const isSelected = selectedIteration === iter.path;
                      return (
                        <div key={iter.id}>
                          <button onClick={() => handleSelectIteration(iter)}
                            className={clsx('w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2',
                              isSelected ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                              : isCurrent ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent')}>
                            {isSelected ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <span className="font-medium truncate block">{iter.name}</span>
                              {iter.startDate && iter.finishDate && (
                                <span className="text-[10px] opacity-60">{new Date(iter.startDate).toLocaleDateString()} - {new Date(iter.finishDate).toLocaleDateString()}</span>
                              )}
                            </div>
                            {isCurrent && <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 font-semibold flex-shrink-0">CURRENT</span>}
                          </button>
                          {isSelected && (
                            <div className="ml-5 mt-1 mb-2 pl-3 border-l-2 border-indigo-200 dark:border-indigo-700">
                              {iterLoading ? (
                                <p className="text-xs text-gray-400 py-2">Loading work items...</p>
                              ) : iterWorkItems.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">No work items in this iteration</p>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-1">{iterWorkItems.length} items</p>
                                  {iterWorkItems.slice(0, 10).map(wi => (
                                    <a key={wi.id} href={`${config?.organizationUrl}/${config?.projectName}/_workitems/edit/${wi.id}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-2 py-1 text-[11px] text-gray-600 dark:text-slate-400 hover:text-blue-500 transition-colors">
                                      <span>{typeIcon(wi.workItemType)}</span>
                                      <span className="font-mono text-gray-400">#{wi.id}</span>
                                      <span className="truncate">{wi.title}</span>
                                      <span className={clsx('px-1 py-0.5 text-[9px] rounded ml-auto flex-shrink-0', stateColor(wi.state))}>{wi.state}</span>
                                    </a>
                                  ))}
                                  {iterWorkItems.length > 10 && <p className="text-[10px] text-gray-400">+{iterWorkItems.length - 10} more</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PR Stats Fill Bars */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <GitPullRequest className="w-4.5 h-4.5 text-purple-500" />
                    PR Distribution
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Waiting Review', value: data.pullRequestStats.waitingReview, total: data.pullRequestStats.totalActive, color: 'bg-amber-500' },
                      { label: 'Approved', value: data.pullRequestStats.approved, total: data.pullRequestStats.totalActive, color: 'bg-green-500' },
                      { label: 'Drafts', value: data.pullRequestStats.drafts, total: data.pullRequestStats.totalActive, color: 'bg-gray-400' },
                      { label: 'Conflicts', value: data.pullRequestStats.conflicts, total: data.pullRequestStats.totalActive, color: 'bg-red-500' },
                      { label: 'Completed Today', value: data.pullRequestStats.completedToday, total: Math.max(data.pullRequestStats.completedToday, data.pullRequestStats.totalActive), color: 'bg-purple-500' },
                    ].map(bar => (
                      <div key={bar.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 dark:text-slate-400">{bar.label}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{bar.value}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                          <div className={clsx('h-full rounded-full transition-all duration-500', bar.color)}
                            style={{ width: `${bar.total > 0 ? (bar.value / bar.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
