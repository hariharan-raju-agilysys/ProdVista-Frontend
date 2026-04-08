import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  getConnections, getBugs, getMyBugs,
  getReleases, getReleaseWorkItems, getOwnerEfficiency, getFilterOptions,
  getTrend, getAgingDistribution,
  getAreaPaths, getRepositories, getKpiSummary, getBugDetailWithContext, getTodayActivity,
  QualityWorkItemDto, QualityReleaseDto,
  OwnerEfficiencyDto, QualityFilterOptionsDto, QualityTrendPointDto,
  BugAgingDistributionDto, QualityConnection, QualityAreaPath, QualityRepository,
  KpiSummary, BugDetailContext, TodayActivity,
  getSeverityColor, getStateColor, getReleaseStateColor,
  formatDate, formatRelativeTime, getEfficiencyColor, getCompletionColor
} from '../services/qualityService';
import {
  getDepartments as getHrDepartments,
  getBirthdays as getHrBirthdays,
  HrDepartment, HrBirthday
} from '../services/hrPortalService';
import { useAuth } from '../context/AuthContext';
import {
  Bug, Calendar, ChevronDown, ChevronRight, Clock, ExternalLink, Filter,
  Loader2, RefreshCw, Search, User, Users, X,
  AlertTriangle, BarChart3, Target, ArrowUpDown,
  TrendingUp, TrendingDown, Activity, Shield, GitBranch, Layers,
  FileText, Link2, CheckCircle2, Minus, Cake, GitPullRequest, GitCommitHorizontal, FolderGit2
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================
type TabType = 'overview' | 'my-bugs' | 'sprints' | 'team' | 'query';

// ============================================================================
// Main Component
// ============================================================================
const QualityDashboardV2: React.FC = () => {
  const { user } = useAuth();

  // Connection & area state
  const [connections, setConnections] = useState<QualityConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | undefined>();
  const [areaPaths, setAreaPaths] = useState<QualityAreaPath[]>([]);
  const [selectedAreaPath, setSelectedAreaPath] = useState<string | undefined>();

  // Repository multi-select
  const [repositories, setRepositories] = useState<QualityRepository[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('quality_selected_repos') || '[]'); } catch { return []; }
  });

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Data state
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [bugs, setBugs] = useState<QualityWorkItemDto[]>([]);
  const [myBugs, setMyBugs] = useState<QualityWorkItemDto[]>([]);
  const [releases, setReleases] = useState<QualityReleaseDto[]>([]);
  const [ownerEfficiency, setOwnerEfficiency] = useState<OwnerEfficiencyDto[]>([]);
  const [filterOptions, setFilterOptions] = useState<QualityFilterOptionsDto | null>(null);
  const [trendData, setTrendData] = useState<QualityTrendPointDto[]>([]);
  const [agingData, setAgingData] = useState<BugAgingDistributionDto[]>([]);

  // Today Activity (PRs + Commits grouped by Repo)
  const [todayActivity, setTodayActivity] = useState<TodayActivity | null>(null);
  const [userScope, setUserScope] = useState<'mine' | 'all'>('mine');

  // HR Portal - Department & Birthdays
  const [hrDepartments, setHrDepartments] = useState<HrDepartment[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(() =>
    localStorage.getItem('quality_hr_dept') || ''
  );
  const [birthdays, setBirthdays] = useState<HrBirthday[]>([]);

  // Bug detail side panel
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [bugDetail, setBugDetail] = useState<BugDetailContext | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRelease, setExpandedRelease] = useState<string | null>(null);
  const [releaseWorkItems, setReleaseWorkItems] = useState<QualityWorkItemDto[]>([]);
  const [bugFilter, setBugFilter] = useState({ state: '', severity: '', search: '' });
  const [sortField, setSortField] = useState<string>('changedDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conns = await getConnections();
      setConnections(conns);
      const connId = conns.length > 0 ? conns[0].id : undefined;
      setSelectedConnectionId(connId);

      if (!connId) {
        setError('No Azure DevOps connection configured. Go to Release Notes → Connections to set one up.');
        return;
      }

      const [areas, repos] = await Promise.all([
        getAreaPaths(connId),
        getRepositories(connId),
      ]);
      setAreaPaths(areas);
      setRepositories(repos);

      // Load HR departments (non-blocking)
      getHrDepartments().then(setHrDepartments).catch(() => {});
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!selectedConnectionId) return;
    setLoading(true);
    setError(null);
    try {
      const [kpiData, bugsData, trendResult, agingResult, activityData] = await Promise.all([
        getKpiSummary(selectedConnectionId, selectedAreaPath),
        getBugs({ areaPath: selectedAreaPath }, selectedConnectionId),
        getTrend(90, selectedConnectionId),
        getAgingDistribution(selectedConnectionId),
        getTodayActivity(selectedConnectionId, selectedRepoIds.length > 0 ? selectedRepoIds : undefined, userScope).catch(() => null as TodayActivity | null),
      ]);
      setKpi(kpiData);
      setBugs(bugsData);
      setTrendData(trendResult);
      setAgingData(agingResult);
      setTodayActivity(activityData);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to load quality data');
    } finally {
      setLoading(false);
    }
  }, [selectedConnectionId, selectedAreaPath, selectedRepoIds, userScope]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  useEffect(() => {
    if (selectedConnectionId) {
      loadDashboardData();
      loadTabData(activeTab);
    }
  }, [selectedConnectionId, selectedAreaPath, selectedRepoIds, loadDashboardData]);

  // Reload repos when connection changes
  useEffect(() => {
    if (selectedConnectionId) {
      getRepositories(selectedConnectionId).then(setRepositories).catch(() => setRepositories([]));
    }
  }, [selectedConnectionId]);

  // Persist repo selection
  const toggleRepoSelection = (repoId: string) => {
    setSelectedRepoIds(prev => {
      const next = prev.includes(repoId) ? prev.filter(id => id !== repoId) : [...prev, repoId];
      localStorage.setItem('quality_selected_repos', JSON.stringify(next));
      return next;
    });
  };
  const clearRepoSelection = () => {
    setSelectedRepoIds([]);
    localStorage.removeItem('quality_selected_repos');
  };

  // Birthday loader — reload when department changes
  useEffect(() => {
    getHrBirthdays({ departmentCode: selectedDepartment || undefined, daysAhead: 30 })
      .then(r => setBirthdays(r.birthdays))
      .catch(() => setBirthdays([]));
  }, [selectedDepartment]);

  const handleDepartmentChange = (code: string) => {
    setSelectedDepartment(code);
    localStorage.setItem('quality_hr_dept', code);
  };

  // Bug detail loader
  useEffect(() => {
    if (selectedBugId && selectedConnectionId) {
      setDetailLoading(true);
      getBugDetailWithContext(selectedBugId, selectedConnectionId)
        .then(setBugDetail)
        .catch(() => setBugDetail(null))
        .finally(() => setDetailLoading(false));
    } else {
      setBugDetail(null);
    }
  }, [selectedBugId, selectedConnectionId]);

  // Lazy tab loading
  const loadTabData = useCallback(async (tab: TabType) => {
    if (!selectedConnectionId) return;
    try {
      if (tab === 'my-bugs') {
        const data = await getMyBugs(selectedConnectionId);
        setMyBugs(data);
      }
      if (tab === 'team') {
        const data = await getOwnerEfficiency(selectedConnectionId);
        setOwnerEfficiency(data);
      }
      if (tab === 'sprints' && releases.length === 0) {
        const data = await getReleases(selectedConnectionId);
        setReleases(data);
      }
      if (tab === 'query' && !filterOptions) {
        const data = await getFilterOptions(selectedConnectionId);
        setFilterOptions(data);
      }
    } catch (err) {
      console.error('Failed to load tab data:', err);
    }
  }, [selectedConnectionId, releases, filterOptions]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    loadTabData(tab);
  };

  const handleRefresh = () => {
    setMyBugs([]);
    setOwnerEfficiency([]);
    loadDashboardData();
    loadTabData(activeTab);
  };

  const handleExpandRelease = async (release: QualityReleaseDto) => {
    if (expandedRelease === release.id) {
      setExpandedRelease(null);
      return;
    }
    try {
      const items = await getReleaseWorkItems(release.iterationPath, selectedConnectionId);
      setReleaseWorkItems(items);
      setExpandedRelease(release.id);
    } catch (err) {
      console.error('Failed to load release items:', err);
    }
  };

  const handleBugClick = (bugId: number) => {
    setSelectedBugId(prev => prev === bugId ? null : bugId);
  };

  // Sort helper
  const sortedBugs = (list: QualityWorkItemDto[]) => {
    return [...list].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'priority': aVal = a.priority ?? 99; bVal = b.priority ?? 99; break;
        case 'severity': aVal = a.severity ?? 'z'; bVal = b.severity ?? 'z'; break;
        case 'ageDays': aVal = a.ageDays; bVal = b.ageDays; break;
        case 'state': aVal = a.state; bVal = b.state; break;
        case 'changedDate': aVal = a.changedDate ?? ''; bVal = b.changedDate ?? ''; break;
        default: aVal = a.createdDate ?? ''; bVal = b.createdDate ?? '';
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  };

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Filtered bugs for overview
  const filteredBugs = sortedBugs(bugs.filter(b => {
    if (bugFilter.state && b.state !== bugFilter.state) return false;
    if (bugFilter.severity && b.severity !== bugFilter.severity) return false;
    if (bugFilter.search && !b.title.toLowerCase().includes(bugFilter.search.toLowerCase()) && !b.id.toString().includes(bugFilter.search)) return false;
    return true;
  }));

  // ============================================================================
  // Render
  // ============================================================================

  if (loading && !kpi) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#1b1b1f] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-blue-200 dark:border-blue-900" />
            <div className="absolute inset-0 rounded-full border-2 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading Quality Dashboard...</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Connecting to Azure DevOps</p>
        </div>
      </div>
    );
  }

  if (error && !kpi) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#1b1b1f] flex items-center justify-center p-6">
        <div className="bg-white dark:bg-[#292929] border border-red-200 dark:border-red-800/50 rounded-xl p-8 max-w-lg w-full shadow-lg text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Connection Required</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">{error}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
            Set up an Azure DevOps connection in <span className="font-medium text-blue-600 dark:text-blue-400">Release Notes → Connections</span> first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#1b1b1f]">
      <div className="flex">
        {/* Main Content */}
        <div className={`flex-1 transition-all duration-300 ${selectedBugId ? 'mr-[500px]' : ''}`}>
          {/* Azure-style top command bar */}
          <div className="sticky top-0 z-30 bg-white dark:bg-[#1f1f23] border-b border-slate-200 dark:border-slate-700/50 shadow-sm">
            <div className="max-w-[1440px] mx-auto px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm">
                      <Bug className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">Quality Command Center</h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {connections.find(c => c.id === selectedConnectionId)?.projectName ?? 'Azure DevOps'}
                      </p>
                    </div>
                  </div>
                  {/* Breadcrumb divider */}
                  <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-slate-200 dark:border-slate-700">
                    {connections.length > 1 && (
                      <select
                        value={selectedConnectionId ?? ''}
                        onChange={e => { setSelectedConnectionId(e.target.value); setMyBugs([]); setOwnerEfficiency([]); }}
                        className="bg-transparent text-sm text-slate-700 dark:text-slate-300 border-0 focus:outline-none focus:ring-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 pr-6"
                      >
                        {connections.map(c => <option key={c.id} value={c.id}>{c.connectionName}</option>)}
                      </select>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={selectedAreaPath ?? ''}
                        onChange={e => { setSelectedAreaPath(e.target.value || undefined); setMyBugs([]); setOwnerEfficiency([]); }}
                        className="bg-transparent text-sm text-slate-700 dark:text-slate-300 border-0 focus:outline-none focus:ring-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 min-w-[180px] pr-6"
                      >
                        <option value="">All Areas</option>
                        {areaPaths.map(a => (
                          <option key={a.id} value={a.path}>{a.shortName}</option>
                        ))}
                      </select>
                    </div>
                    {selectedAreaPath && (
                      <button
                        onClick={() => setSelectedAreaPath(undefined)}
                        className="text-xs text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Clear area filter"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {hrDepartments.length > 0 && (
                      <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <select
                          value={selectedDepartment}
                          onChange={e => handleDepartmentChange(e.target.value)}
                          className="bg-transparent text-sm text-slate-700 dark:text-slate-300 border-0 focus:outline-none focus:ring-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 pr-6"
                        >
                          <option value="">All Departments</option>
                          {hrDepartments.map(d => (
                            <option key={d.departmentCode} value={d.departmentCode}>
                              {d.departmentName} ({d.actualCount})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => setUserScope('mine')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                        userScope === 'mine'
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <User className="w-3 h-3" /> My
                    </button>
                    <button
                      onClick={() => setUserScope('all')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                        userScope === 'all'
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      <Users className="w-3 h-3" /> All
                    </button>
                  </div>
                  {loading && (
                    <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full">
                      <Loader2 className="w-3 h-3 animate-spin" /> Syncing
                    </span>
                  )}
                  <button
                    onClick={handleRefresh}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Repository selector strip */}
          {repositories.length > 0 && (
            <div className="sticky top-[57px] z-20 bg-white/80 dark:bg-[#1f1f23]/80 backdrop-blur-sm border-b border-slate-200/60 dark:border-slate-700/30">
              <div className="max-w-[1440px] mx-auto px-6 py-2">
                <div className="flex items-center gap-2 overflow-x-auto">
                  <FolderGit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">Repos:</span>
                  <button
                    onClick={clearRepoSelection}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors shrink-0 ${
                      selectedRepoIds.length === 0
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    All ({repositories.length})
                  </button>
                  {repositories.map(repo => {
                    const isSelected = selectedRepoIds.includes(repo.id);
                    return (
                      <button
                        key={repo.id}
                        onClick={() => toggleRepoSelection(repo.id)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors shrink-0 flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <GitBranch className="w-3 h-3" />
                        {repo.name}
                        {isSelected && <X className="w-3 h-3 ml-0.5" />}
                      </button>
                    );
                  })}
                  {selectedRepoIds.length > 0 && (
                    <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                      {selectedRepoIds.length} of {repositories.length} selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="max-w-[1440px] mx-auto px-6 py-5">
            {/* ================================================================
                KPI Summary Strip — Azure Portal style 
                ================================================================ */}
            {kpi && (
              <div className="mb-5 space-y-3">
                {/* Primary KPIs — large cards with trend indicators */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard
                    label="Resolution Rate"
                    value={`${kpi.resolutionRate}%`}
                    sub={`${kpi.resolvedBugs} of ${kpi.totalBugs} resolved`}
                    trend={kpi.resolutionRate >= 70 ? 'up' : kpi.resolutionRate >= 40 ? 'flat' : 'down'}
                    accent={kpi.resolutionRate >= 70 ? 'green' : kpi.resolutionRate >= 40 ? 'amber' : 'red'}
                    icon={<Target className="w-4 h-4" />}
                  />
                  <KpiCard
                    label="MTTR"
                    value={`${kpi.mttr}d`}
                    sub="Mean Time to Resolve"
                    trend={kpi.mttr <= 7 ? 'up' : kpi.mttr <= 14 ? 'flat' : 'down'}
                    accent={kpi.mttr <= 7 ? 'green' : kpi.mttr <= 14 ? 'amber' : 'red'}
                    icon={<Clock className="w-4 h-4" />}
                  />
                  <KpiCard
                    label="Critical Active"
                    value={kpi.criticalActive}
                    sub={`of ${kpi.activeBugs} active bugs`}
                    trend={kpi.criticalActive === 0 ? 'up' : 'down'}
                    accent={kpi.criticalActive === 0 ? 'green' : 'red'}
                    icon={<AlertTriangle className="w-4 h-4" />}
                    pulse={kpi.criticalActive > 0}
                  />
                  <KpiCard
                    label="Weekly Velocity"
                    value={`+${kpi.weeklyCreated} / -${kpi.weeklyResolved}`}
                    sub={kpi.weeklyResolved >= kpi.weeklyCreated ? 'Bugs decreasing' : 'Bugs increasing'}
                    trend={kpi.weeklyResolved >= kpi.weeklyCreated ? 'up' : 'down'}
                    accent={kpi.weeklyResolved >= kpi.weeklyCreated ? 'green' : 'amber'}
                    icon={<Activity className="w-4 h-4" />}
                  />
                  <KpiCard
                    label="Bug Density"
                    value={kpi.bugDensity.toFixed(1)}
                    sub="Bugs per Feature"
                    trend={kpi.bugDensity <= 3 ? 'up' : kpi.bugDensity <= 6 ? 'flat' : 'down'}
                    accent={kpi.bugDensity <= 3 ? 'green' : kpi.bugDensity <= 6 ? 'amber' : 'red'}
                    icon={<GitBranch className="w-4 h-4" />}
                  />
                  <KpiCard
                    label="30-Day Trend"
                    value={`${kpi.bugTrend > 0 ? '+' : ''}${kpi.bugTrend}%`}
                    sub="vs previous period"
                    trend={kpi.bugTrend <= 0 ? 'up' : 'down'}
                    accent={kpi.bugTrend <= 0 ? 'green' : 'red'}
                    icon={kpi.bugTrend <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  />
                </div>

                {/* Secondary metrics — compact strip */}
                <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2">
                  <MiniStat label="Total Items" value={kpi.totalWorkItems} icon={<BarChart3 className="w-3 h-3" />} />
                  <MiniStat label="Total Bugs" value={kpi.totalBugs} color="text-red-600 dark:text-red-400" icon={<Bug className="w-3 h-3" />} />
                  <MiniStat label="Active Bugs" value={kpi.activeBugs} color="text-amber-600 dark:text-amber-400" />
                  <MiniStat label="Resolved" value={kpi.resolvedBugs} color="text-emerald-600 dark:text-emerald-400" />
                  <MiniStat label="Features" value={kpi.features} color="text-purple-600 dark:text-purple-400" />
                  <MiniStat label="Stories" value={kpi.userStories} color="text-blue-600 dark:text-blue-400" />
                  <MiniStat label="Tasks" value={kpi.tasks} color="text-cyan-600 dark:text-cyan-400" />
                  <MiniStat label="Critical" value={kpi.criticalActive} color="text-red-600 dark:text-red-400" icon={<Shield className="w-3 h-3" />} />
                </div>
              </div>
            )}

            {/* ================================================================
                Tab Navigation — Azure Portal style pill tabs
                ================================================================ */}
            <div className="flex gap-1 mb-5 bg-white dark:bg-[#292929] rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-700/50">
              {([
                { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
                { id: 'my-bugs' as TabType, label: 'My Items', icon: User },
                { id: 'sprints' as TabType, label: 'Sprints', icon: Target },
                { id: 'team' as TabType, label: 'Team', icon: Users },
                { id: 'query' as TabType, label: 'Search', icon: Search },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && <OverviewTab
              kpi={kpi} bugs={filteredBugs} trendData={trendData} agingData={agingData}
              todayActivity={todayActivity} birthdays={birthdays}
              bugFilter={bugFilter} setBugFilter={setBugFilter}
              sortField={sortField} sortDir={sortDir} toggleSort={toggleSort}
              onBugClick={handleBugClick} selectedBugId={selectedBugId}
            />}
            {activeTab === 'my-bugs' && <MyBugsTab bugs={sortedBugs(myBugs)} userEmail={user?.email ?? ''} sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} onBugClick={handleBugClick} selectedBugId={selectedBugId} />}
            {activeTab === 'sprints' && <SprintsTab
              releases={releases} expandedRelease={expandedRelease}
              releaseWorkItems={releaseWorkItems} onExpand={handleExpandRelease}
            />}
            {activeTab === 'team' && <TeamTab owners={ownerEfficiency} />}
            {activeTab === 'query' && <SearchTab
              filterOptions={filterOptions} connectionId={selectedConnectionId}
              onBugClick={handleBugClick} selectedBugId={selectedBugId}
            />}
          </div>
        </div>

        {/* Bug Detail Side Panel */}
        {selectedBugId && (
          <BugDetailPanel
            bugDetail={bugDetail}
            loading={detailLoading}
            onClose={() => setSelectedBugId(null)}
            onBugClick={handleBugClick}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// KPI Card — Azure Portal inspired with trend indicator
// ============================================================================
const accentStyles = {
  green: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-400', icon: 'text-emerald-500' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/40', text: 'text-amber-700 dark:text-amber-400', icon: 'text-amber-500' },
  red: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800/40', text: 'text-red-700 dark:text-red-400', icon: 'text-red-500' },
};

const KpiCard: React.FC<{
  label: string; value: string | number; sub: string;
  accent: 'green' | 'amber' | 'red'; trend: 'up' | 'down' | 'flat';
  icon?: React.ReactNode; pulse?: boolean;
}> = memo(({ label, value, sub, accent, trend, icon, pulse }) => {
  const style = accentStyles[accent];
  return (
    <div className={`bg-white dark:bg-[#292929] rounded-xl p-4 border ${style.border} shadow-sm hover:shadow-md transition-shadow duration-200 ${pulse ? 'ring-2 ring-red-400/40 dark:ring-red-500/30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <span className={style.icon}>{icon}</span>
          {label}
        </span>
        <span className={`flex items-center gap-0.5 text-xs font-medium ${style.text}`}>
          {trend === 'up' && <TrendingUp className="w-3 h-3" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3" />}
          {trend === 'flat' && <Minus className="w-3 h-3" />}
        </span>
      </div>
      <p className={`text-2xl font-bold text-slate-900 dark:text-white ${pulse ? 'animate-pulse' : ''}`}>{value}</p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{sub}</p>
      {/* Accent bar */}
      <div className={`mt-3 h-1 rounded-full ${style.bg}`}>
        <div className={`h-1 rounded-full ${accent === 'green' ? 'bg-emerald-500' : accent === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: accent === 'green' ? '100%' : accent === 'amber' ? '60%' : '30%' }} />
      </div>
    </div>
  );
});

// ============================================================================
// Mini Stat — compact secondary metric
// ============================================================================
const MiniStat: React.FC<{ label: string; value: string | number; color?: string; icon?: React.ReactNode }> = memo(({ label, value, color, icon }) => (
  <div className="bg-white dark:bg-[#292929] rounded-lg px-3 py-2.5 border border-slate-200 dark:border-slate-700/50 shadow-sm">
    <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 flex items-center gap-1 uppercase tracking-wider">{icon}{label}</p>
    <p className={`text-lg font-bold ${color || 'text-slate-900 dark:text-white'}`}>{value}</p>
  </div>
));

// ============================================================================
// Bug Detail Side Panel — Azure Portal Blade style
// ============================================================================
const BugDetailPanel: React.FC<{
  bugDetail: BugDetailContext | null; loading: boolean;
  onClose: () => void; onBugClick: (id: number) => void;
}> = ({ bugDetail, loading, onClose, onBugClick }) => (
  <div className="fixed right-0 top-0 h-screen w-[500px] bg-white dark:bg-[#1f1f23] border-l border-slate-200 dark:border-slate-700/50 shadow-2xl overflow-y-auto z-50">
    {/* Panel Header */}
    <div className="sticky top-0 bg-white/95 dark:bg-[#1f1f23]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700/50 px-5 py-4 flex items-center justify-between z-10">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        Work Item Details
      </h2>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>

    {loading ? (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Loading details...</p>
        </div>
      </div>
    ) : !bugDetail ? (
      <div className="p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Failed to load details</p>
      </div>
    ) : (
      <div className="p-5 space-y-5">
        {/* Bug Header */}
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-blue-600 dark:text-blue-400 font-mono text-sm font-semibold">#{bugDetail.bug.id}</span>
            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getStateColor(bugDetail.bug.state)}`}>{bugDetail.bug.state}</span>
            {bugDetail.bug.severity && (
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getSeverityColor(bugDetail.bug.severity)}`}>{bugDetail.bug.severity}</span>
            )}
            {bugDetail.bug.priority && (
              <span className="px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                P{bugDetail.bug.priority}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">{bugDetail.bug.title}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-500 dark:text-slate-400">
            {bugDetail.bug.assignedTo && (
              <span className="flex items-center gap-1.5"><User className="w-3 h-3" />{bugDetail.bug.assignedTo}</span>
            )}
            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{bugDetail.bug.ageDays}d old</span>
            {bugDetail.bug.areaPath && (
              <span className="flex items-center gap-1.5"><Layers className="w-3 h-3" />{bugDetail.bug.areaPath.split('\\').pop()}</span>
            )}
          </div>
          {bugDetail.bug.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {bugDetail.bug.tags.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800/40 font-medium">{tag}</span>
              ))}
            </div>
          )}
          {bugDetail.bug.devOpsUrl && (
            <a href={bugDetail.bug.devOpsUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              <ExternalLink className="w-3 h-3" /> Open in Azure DevOps
            </a>
          )}
        </div>

        {/* Description */}
        {bugDetail.description && (
          <DetailSection title="Description">
            <div className="text-sm text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: bugDetail.description }} />
          </DetailSection>
        )}

        {/* Repro Steps */}
        {bugDetail.reproSteps && (
          <DetailSection title="Repro Steps">
            <div className="text-sm text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: bugDetail.reproSteps }} />
          </DetailSection>
        )}

        {/* Acceptance Criteria */}
        {bugDetail.acceptanceCriteria && (
          <DetailSection title="Acceptance Criteria">
            <div className="text-sm text-slate-600 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: bugDetail.acceptanceCriteria }} />
          </DetailSection>
        )}

        {/* Area Context */}
        {bugDetail.areaContext && bugDetail.areaContext.totalRelatedBugs > 0 && (
          <DetailSection title={`Area Context — ${bugDetail.areaContext.shortName}`} icon={<Link2 className="w-3 h-3" />}>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center border border-slate-200 dark:border-slate-700/50">
                <p className="text-lg font-bold text-slate-900 dark:text-white">{bugDetail.areaContext.totalRelatedBugs}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Related</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center border border-slate-200 dark:border-slate-700/50">
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{bugDetail.areaContext.activeRelated}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center border border-slate-200 dark:border-slate-700/50">
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{bugDetail.areaContext.criticalRelated}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Critical</p>
              </div>
            </div>
          </DetailSection>
        )}

        {/* Related Bugs */}
        {bugDetail.relatedBugsInArea && bugDetail.relatedBugsInArea.length > 0 && (
          <DetailSection title={`Related Bugs (${bugDetail.relatedBugsInArea.length})`}>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {bugDetail.relatedBugsInArea.map(rb => (
                <button key={rb.id} onClick={() => onBugClick(rb.id)}
                  className="w-full text-left bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-700/40 rounded-lg p-2.5 border border-slate-200 dark:border-slate-700/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-mono text-xs font-semibold">#{rb.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getStateColor(rb.state)}`}>{rb.state}</span>
                    {rb.severity && <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getSeverityColor(rb.severity)}`}>{rb.severity?.split(' - ')[1] || rb.severity}</span>}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 truncate mt-1">{rb.title}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{rb.assignedTo || 'Unassigned'} · {rb.ageDays}d old</p>
                </button>
              ))}
            </div>
          </DetailSection>
        )}

        {/* Sibling Work Items */}
        {bugDetail.siblingWorkItems && bugDetail.siblingWorkItems.length > 0 && (
          <DetailSection title={`Sibling Items — Same Sprint (${bugDetail.siblingWorkItems.length})`}>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {bugDetail.siblingWorkItems.map(si => (
                <button key={si.id} onClick={() => onBugClick(si.id)}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg text-xs transition-colors">
                  <span className="text-blue-600 dark:text-blue-400 font-mono font-semibold">#{si.id}</span>
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${getTypeBadge(si.workItemType)}`}>{si.workItemType}</span>
                  <span className="text-slate-700 dark:text-slate-200 truncate flex-1">{si.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStateColor(si.state)}`}>{si.state}</span>
                </button>
              ))}
            </div>
          </DetailSection>
        )}
      </div>
    )}
  </div>
);

// Detail panel section wrapper
const DetailSection: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div>
    <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
      {icon}{title}
    </h4>
    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3.5 border border-slate-200 dark:border-slate-700/30">
      {children}
    </div>
  </div>
);

// ============================================================================
// Sort Header
// ============================================================================
const SortHeader: React.FC<{ label: string; field: string; sortField: string; sortDir: string; onToggle: (f: string) => void }> = ({ label, field, sortField, sortDir, onToggle }) => (
  <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition-colors group" onClick={() => onToggle(field)}>
    <span className="flex items-center gap-1">
      {label}
      <ArrowUpDown className={`w-3 h-3 transition-opacity ${sortField === field ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />
      {sortField === field && <span className="text-blue-500 text-[9px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </span>
  </th>
);

const getTypeBadge = (type?: string) => {
  switch (type) {
    case 'Bug': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40';
    case 'Task': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40';
    case 'User Story': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40';
    case 'Feature': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/40';
    default: return 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-600/50';
  }
};

const getPriorityIndicator = (priority?: number) => {
  if (!priority) return null;
  const colors = {
    1: 'bg-red-500',
    2: 'bg-orange-500',
    3: 'bg-amber-400',
    4: 'bg-slate-300 dark:bg-slate-600',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${colors[priority as keyof typeof colors] || colors[4]}`} />
      <span className="text-slate-600 dark:text-slate-300">P{priority}</span>
    </div>
  );
};

// ============================================================================
// Bug Table — Enterprise-grade data grid
// ============================================================================
const BugTable: React.FC<{
  bugs: QualityWorkItemDto[]; sortField: string; sortDir: string;
  toggleSort: (f: string) => void; compact?: boolean;
  onBugClick?: (id: number) => void; selectedBugId?: number | null;
}> = ({ bugs, sortField, sortDir, toggleSort, compact, onBugClick, selectedBugId }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/30">
          <SortHeader label="ID" field="id" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
          <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
          <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Title</th>
          <SortHeader label="State" field="state" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
          <SortHeader label="Severity" field="severity" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
          <SortHeader label="Priority" field="priority" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
          {!compact && <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assigned To</th>}
          {!compact && <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Area</th>}
          <SortHeader label="Age" field="ageDays" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
          <SortHeader label="Updated" field="changedDate" sortField={sortField} sortDir={sortDir} onToggle={toggleSort} />
          <th className="px-3 py-3 w-10" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
        {bugs.length === 0 ? (
          <tr>
            <td colSpan={compact ? 9 : 11} className="px-3 py-12 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">No work items found</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting your filters</p>
              </div>
            </td>
          </tr>
        ) : bugs.map(bug => (
          <tr
            key={bug.id}
            onClick={() => onBugClick?.(bug.id)}
            className={`transition-all duration-150 cursor-pointer group ${
              selectedBugId === bug.id
                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-[3px] border-l-blue-600'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/30 border-l-[3px] border-l-transparent'
            } ${bug.priority === 1 ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}
          >
            <td className="px-3 py-2.5 text-blue-600 dark:text-blue-400 font-mono text-xs font-semibold">{bug.id}</td>
            <td className="px-3 py-2.5">
              <span className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${getTypeBadge(bug.workItemType)}`}>
                {bug.workItemType || '—'}
              </span>
            </td>
            <td className="px-3 py-2.5 max-w-xs">
              <span className="text-slate-900 dark:text-white text-sm truncate block group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors" title={bug.title}>
                {bug.title}
              </span>
            </td>
            <td className="px-3 py-2.5">
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getStateColor(bug.state)}`}>{bug.state}</span>
            </td>
            <td className="px-3 py-2.5">
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getSeverityColor(bug.severity)}`}>{bug.severity || '—'}</span>
            </td>
            <td className="px-3 py-2.5">{getPriorityIndicator(bug.priority) || <span className="text-slate-400">—</span>}</td>
            {!compact && <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 text-xs truncate max-w-[120px]" title={bug.assignedTo ?? ''}>{bug.assignedTo || <span className="text-slate-400 italic">Unassigned</span>}</td>}
            {!compact && <td className="px-3 py-2.5 text-slate-400 dark:text-slate-500 text-xs truncate max-w-[100px]" title={bug.areaPath ?? ''}>{bug.areaPath?.split('\\').pop() || '—'}</td>}
            <td className="px-3 py-2.5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                bug.ageDays > 30 ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                bug.ageDays > 14 ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                'text-slate-500 dark:text-slate-400'
              }`}>
                {bug.ageDays}d
              </span>
            </td>
            <td className="px-3 py-2.5 text-slate-400 dark:text-slate-500 text-xs">{bug.changedDate ? formatRelativeTime(bug.changedDate) : formatRelativeTime(bug.createdDate)}</td>
            <td className="px-3 py-2.5">
              {bug.devOpsUrl && (
                <a href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer"
                  className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  onClick={e => e.stopPropagation()}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ============================================================================
// Card wrapper — consistent Azure Portal card styling
// ============================================================================
const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string; titleIcon?: React.ReactNode; action?: React.ReactNode }> = memo(({ children, className, title, titleIcon, action }) => (
  <div className={`bg-white dark:bg-[#292929] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-shadow duration-200 ${className || ''}`}>
    {title && (
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/40">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          {titleIcon}
          {title}
        </h3>
        {action}
      </div>
    )}
    {children}
  </div>
));

// ============================================================================
// Overview Tab — insights + charts + table
// ============================================================================
const OverviewTab: React.FC<{
  kpi: KpiSummary | null; bugs: QualityWorkItemDto[];
  trendData: QualityTrendPointDto[]; agingData: BugAgingDistributionDto[];
  todayActivity: TodayActivity | null; birthdays: HrBirthday[];
  bugFilter: { state: string; severity: string; search: string };
  setBugFilter: React.Dispatch<React.SetStateAction<{ state: string; severity: string; search: string }>>;
  sortField: string; sortDir: string; toggleSort: (f: string) => void;
  onBugClick: (id: number) => void; selectedBugId: number | null;
}> = ({ kpi, bugs, trendData, agingData, todayActivity, birthdays, bugFilter, setBugFilter, sortField, sortDir, toggleSort, onBugClick, selectedBugId }) => {
  const [expandedPrRepo, setExpandedPrRepo] = useState<string | null>(null);
  const [expandedCommitRepo, setExpandedCommitRepo] = useState<string | null>(null);
  
  if (!kpi) return null;

  const upcomingBirthdays = birthdays.filter(b => b.daysUntil <= 30);

  const pr = todayActivity?.pullRequests;
  const cm = todayActivity?.commits;

  return (
    <div className="space-y-5">
      {/* Row 0: Pull Requests + Commits — grouped by Repo/Branch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* === Pull Requests grouped by Repo → Branch === */}
        <Card title="Pull Requests" titleIcon={<GitPullRequest className="w-3.5 h-3.5 text-purple-500" />}
          action={pr ? <span className="text-xs text-slate-500 dark:text-slate-400">{pr.activeTotal} active · {pr.completedToday} merged today</span> : undefined}>
          <div className="px-5 py-4">
            {!pr || pr.byRepo.length === 0 ? (
              <div className="py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-2">
                  <GitPullRequest className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No pull request activity</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">PRs will appear once created in this project</p>
              </div>
            ) : (
              <>
                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/40">
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{pr.completedToday}</p>
                    <p className="text-[10px] text-green-600 dark:text-green-500 font-medium">Merged Today</p>
                  </div>
                  <div className="text-center p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/40">
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{pr.activeTotal}</p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-500 font-medium">Active</p>
                  </div>
                  <div className="text-center p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{pr.byRepo.length}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Repos</p>
                  </div>
                </div>
                {/* Repo accordion */}
                <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
                  {pr.byRepo.map(repo => (
                    <div key={repo.repo} className="border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
                      <button onClick={() => setExpandedPrRepo(expandedPrRepo === repo.repo ? null : repo.repo)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left">
                        {expandedPrRepo === repo.repo ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <FolderGit2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">{repo.repo}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{repo.branches.reduce((s, b) => s + b.prs.length, 0)} PRs</span>
                      </button>
                      {expandedPrRepo === repo.repo && (
                        <div className="px-3 py-2 space-y-2">
                          {repo.branches.map(branch => (
                            <div key={branch.branch}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <GitBranch className="w-3 h-3 text-blue-500" />
                                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{branch.branch}</span>
                                <span className="text-[10px] text-slate-400">({branch.prs.length})</span>
                              </div>
                              {branch.prs.map(p => (
                                <div key={p.pullRequestId} className="flex items-center gap-2 pl-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded transition-colors">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.status === 'active' ? 'bg-blue-500' : p.status === 'completed' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                  <span className="text-[10px] font-mono text-slate-400">!{p.pullRequestId}</span>
                                  <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">{p.title}</span>
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{p.createdBy.split(' ')[0]}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${p.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : p.isDraft ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                                    {p.status === 'completed' ? 'merged' : p.isDraft ? 'draft' : 'active'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* === Commits grouped by Repo → Author === */}
        <Card title="Today's Commits" titleIcon={<GitCommitHorizontal className="w-3.5 h-3.5 text-cyan-500" />}
          action={cm ? <span className="text-xs text-slate-500 dark:text-slate-400">{cm.totalToday} commits · {cm.totalChanges} changes</span> : undefined}>
          <div className="px-5 py-4">
            {!cm || cm.byRepo.length === 0 ? (
              <div className="py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center mx-auto mb-2">
                  <GitCommitHorizontal className="w-5 h-5 text-cyan-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No commits today</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Commits will appear as they're pushed</p>
              </div>
            ) : (
              <>
                {/* Stats strip */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2.5 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800/40">
                    <p className="text-xl font-bold text-cyan-700 dark:text-cyan-400">{cm.totalToday}</p>
                    <p className="text-[10px] text-cyan-600 dark:text-cyan-500 font-medium">Commits</p>
                  </div>
                  <div className="text-center p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800/40">
                    <p className="text-xl font-bold text-indigo-700 dark:text-indigo-400">{cm.totalChanges}</p>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-500 font-medium">Changes</p>
                  </div>
                  <div className="text-center p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{cm.byRepo.length}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Repos</p>
                  </div>
                </div>
                {/* Repo accordion */}
                <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
                  {cm.byRepo.map(repo => (
                    <div key={repo.repo} className="border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
                      <button onClick={() => setExpandedCommitRepo(expandedCommitRepo === repo.repo ? null : repo.repo)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left">
                        {expandedCommitRepo === repo.repo ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <FolderGit2 className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">{repo.repo}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{repo.totalCommits} commits</span>
                      </button>
                      {expandedCommitRepo === repo.repo && (
                        <div className="px-3 py-2 space-y-2">
                          {repo.authors.map(author => (
                            <div key={author.author}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <User className="w-3 h-3 text-indigo-500" />
                                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{author.author}</span>
                                <span className="text-[10px] text-slate-400">({author.commits.length})</span>
                              </div>
                              {author.commits.map(c => (
                                <div key={c.shortCommitId} className="flex items-center gap-2 pl-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded transition-colors">
                                  <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 shrink-0">{c.shortCommitId}</span>
                                  <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">{c.comment}</span>
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap">+{c.changeCounts}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Row 0.5: Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <Card title="Upcoming Birthdays" titleIcon={<Cake className="w-3.5 h-3.5 text-pink-500" />}>
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {upcomingBirthdays.slice(0, 12).map(b => (
                <div key={b.employeeId} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  b.isToday ? 'bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/40' :
                  b.daysUntil <= 2 ? 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30' :
                  'bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/30'
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                    b.isToday ? 'bg-pink-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
                  }`}>{b.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{b.name}</p>
                    <p className="text-[9px] text-slate-400">{b.isToday ? '🎂 Today!' : b.daysUntil <= 2 ? `In ${b.daysUntil}d` : `${b.daysUntil}d · ${b.birthday}`}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Row 1: Distribution cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* By Work Item Type */}
        {kpi.byType && Object.keys(kpi.byType).length > 0 && (
          <Card title="By Type">
            <div className="px-5 py-4 space-y-3">
              {Object.entries(kpi.byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${getTypeBadge(type)}`}>{type}</span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${kpi.totalWorkItems > 0 ? (count / kpi.totalWorkItems) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* By State */}
        <Card title="By State">
          <div className="px-5 py-4 space-y-3">
            {Object.entries(kpi.byState).map(([state, count]) => (
              <div key={state} className="flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getStateColor(state)}`}>{state}</span>
                <div className="flex items-center gap-2.5">
                  <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${kpi.totalBugs > 0 ? (count / kpi.totalBugs) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* By Severity */}
        <Card title="By Severity">
          <div className="px-5 py-4 space-y-3">
            {Object.entries(kpi.bySeverity).map(([sev, count]) => (
              <div key={sev} className="flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getSeverityColor(sev)}`}>{sev}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Areas */}
        <Card title="Top Areas" titleIcon={<Layers className="w-3.5 h-3.5 text-slate-400" />}>
          <div className="px-5 py-4 space-y-3">
            {kpi.topAreas.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">No area data available</p>
            ) : kpi.topAreas.slice(0, 6).map(area => (
              <div key={area.area} className="flex items-center justify-between">
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[110px]" title={area.area}>{area.area}</span>
                <div className="flex items-center gap-2">
                  {area.critical > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-semibold">{area.critical}C</span>
                  )}
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">{area.active}A</span>
                  <span className="text-xs text-slate-900 dark:text-white font-bold w-6 text-right">{area.total}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 2: Trend + Aging — charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bug Trend */}
        {trendData.length > 0 && (
          <Card title={`Bug Trend (${trendData.length} Days)`} titleIcon={<Activity className="w-3.5 h-3.5 text-blue-500" />}>
            <div className="px-5 py-4">
              {trendData.every(p => p.opened === 0 && p.closed === 0) ? (
                <div className="py-10 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No bug activity</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No bugs opened or closed in the last {trendData.length} days</p>
                </div>
              ) : (
              <><div className="h-36 flex items-end gap-[2px] overflow-hidden">
                {(() => {
                  const maxVal = Math.max(...trendData.map(d => d.opened + d.closed), 1);
                  const chartH = 132; // px available for bars
                  return trendData.map((p, i) => {
                    const openedH = (p.opened / maxVal) * chartH;
                    const closedH = (p.closed / maxVal) * chartH;
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end items-stretch group cursor-pointer h-full" title={`${formatDate(p.date)}: +${p.opened} opened / -${p.closed} closed`}>
                        {p.opened > 0 && (
                          <div className={`bg-red-400 dark:bg-red-500 group-hover:bg-red-500 dark:group-hover:bg-red-400 transition-colors ${p.closed === 0 ? 'rounded-b-sm' : ''} rounded-t-sm`} style={{ height: `${openedH}px` }} />
                        )}
                        {p.closed > 0 && (
                          <div className={`bg-emerald-400 dark:bg-emerald-500 group-hover:bg-emerald-500 dark:group-hover:bg-emerald-400 transition-colors rounded-b-sm ${p.opened === 0 ? 'rounded-t-sm' : ''}`} style={{ height: `${closedH}px` }} />
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex items-center gap-5 mt-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-400 dark:bg-red-500 rounded-sm" /> Opened</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-400 dark:bg-emerald-500 rounded-sm" /> Closed</span>
              </div>
              </>
              )}
            </div>
          </Card>
        )}

        {/* Bug Aging */}
        <Card title="Bug Aging Distribution" titleIcon={<Clock className="w-3.5 h-3.5 text-amber-500" />}>
          <div className="px-5 py-4">
            {agingData.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">No aging data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agingData.map(a => (
                  <div key={a.range} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 dark:text-slate-400 w-24 shrink-0 font-medium">{a.range}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all duration-500 ${
                        a.range.includes('60+') || a.range.includes('31') ? 'bg-red-500' :
                        a.range.includes('15') || a.range.includes('14') ? 'bg-amber-500' : 'bg-blue-500'
                      }`} style={{ width: `${Math.min(a.percentage, 100)}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white w-8 text-right">{a.count}</span>
                    <span className="text-[10px] text-slate-400 w-10 text-right">{a.percentage}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Critical Alert Banner */}
      {kpi.recentCritical.length > 0 && (
        <Card className="!border-red-200 dark:!border-red-800/40 !bg-red-50/50 dark:!bg-red-900/10">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Critical Active Bugs ({kpi.criticalActive})
            </h3>
            <div className="space-y-1.5">
              {kpi.recentCritical.map(b => (
                <button key={b.id} onClick={() => onBugClick(b.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-red-100/50 dark:hover:bg-red-900/20 rounded-lg transition-colors group">
                  <span className="text-blue-600 dark:text-blue-400 font-mono text-xs font-semibold">#{b.id}</span>
                  <span className="text-slate-900 dark:text-white text-sm truncate flex-1 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">{b.title}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{b.assignedTo || 'Unassigned'}</span>
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full whitespace-nowrap">{b.ageDays}d</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Bug List with Filters */}
      <Card
        title={`Work Items (${bugs.length})`}
        titleIcon={<Bug className="w-3.5 h-3.5 text-red-500" />}
        action={
          <div className="flex items-center gap-2">
            <select value={bugFilter.state} onChange={e => setBugFilter(f => ({ ...f, state: e.target.value }))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">All States</option>
              <option value="New">New</option><option value="Active">Active</option>
              <option value="Resolved">Resolved</option><option value="Closed">Closed</option>
            </select>
            <select value={bugFilter.severity} onChange={e => setBugFilter(f => ({ ...f, severity: e.target.value }))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">All Severities</option>
              <option value="1 - Critical">Critical</option><option value="2 - High">High</option>
              <option value="3 - Medium">Medium</option><option value="4 - Low">Low</option>
            </select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={bugFilter.search} onChange={e => setBugFilter(f => ({ ...f, search: e.target.value }))}
                placeholder="Search..."
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg pl-8 pr-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
          </div>
        }
      >
        <BugTable bugs={bugs.slice(0, 50)} sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} onBugClick={onBugClick} selectedBugId={selectedBugId} />
        {bugs.length > 50 && (
          <div className="px-5 py-3 text-center border-t border-slate-100 dark:border-slate-700/40">
            <p className="text-xs text-slate-500 dark:text-slate-400">Showing 50 of {bugs.length} items</p>
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================================
// My Bugs Tab — personal work item tracker
// ============================================================================
const MyBugsTab: React.FC<{
  bugs: QualityWorkItemDto[]; userEmail: string;
  sortField: string; sortDir: string; toggleSort: (f: string) => void;
  onBugClick: (id: number) => void; selectedBugId: number | null;
}> = ({ bugs, userEmail, sortField, sortDir, toggleSort, onBugClick, selectedBugId }) => {
  const activeBugs = bugs.filter(b => b.state === 'Active' || b.state === 'New' || b.state === 'In Progress');
  const resolvedBugs = bugs.filter(b => b.state === 'Resolved' || b.state === 'Done' || b.state === 'Closed');
  const oldBugs = activeBugs.filter(b => b.ageDays > 14);
  const bugCount = bugs.filter(b => b.workItemType === 'Bug').length;
  const taskCount = bugs.filter(b => b.workItemType === 'Task').length;
  const storyCount = bugs.filter(b => b.workItemType === 'User Story').length;
  const featureCount = bugs.filter(b => b.workItemType === 'Feature').length;

  return (
    <div className="space-y-5">
      {/* Personal stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <MiniStat label="Assigned" value={bugs.length} icon={<User className="w-3 h-3" />} />
        <MiniStat label="Active" value={activeBugs.length} color="text-amber-600 dark:text-amber-400" />
        <MiniStat label="Completed" value={resolvedBugs.length} color="text-emerald-600 dark:text-emerald-400" />
        <MiniStat label="Aging (>14d)" value={oldBugs.length} color={oldBugs.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'} icon={<Clock className="w-3 h-3" />} />
        <MiniStat label="Bugs" value={bugCount} color="text-red-600 dark:text-red-400" />
        <MiniStat label="Tasks" value={taskCount} color="text-blue-600 dark:text-blue-400" />
        <MiniStat label="Stories" value={storyCount} color="text-emerald-600 dark:text-emerald-400" />
        <MiniStat label="Features" value={featureCount} color="text-purple-600 dark:text-purple-400" />
      </div>

      {bugs.length === 0 ? (
        <Card className="!py-0">
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white mb-1">All clear!</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">No work items assigned to {userEmail}</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Priority alert for aging items */}
          {oldBugs.length > 0 && (
            <Card className="!border-amber-200 dark:!border-amber-800/40 !bg-amber-50/50 dark:!bg-amber-900/10">
              <div className="px-5 py-4">
                <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2.5 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Needs Attention ({oldBugs.length} items older than 14 days)
                </h3>
                <div className="space-y-1">
                  {oldBugs.slice(0, 5).map(b => (
                    <button key={b.id} onClick={() => onBugClick(b.id)}
                      className="w-full flex items-center justify-between text-xs hover:bg-amber-100/50 dark:hover:bg-amber-900/20 rounded-lg px-2 py-1.5 transition-colors">
                      <span className="text-slate-900 dark:text-white truncate max-w-md flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400 font-mono font-semibold">{b.id}</span>
                        <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${getTypeBadge(b.workItemType)}`}>{b.workItemType}</span>
                        {b.title}
                      </span>
                      <span className="text-red-600 dark:text-red-400 ml-2 whitespace-nowrap font-semibold">{b.ageDays} days</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Card title={`My Work Items (${bugs.length})`} titleIcon={<User className="w-3.5 h-3.5 text-blue-500" />}>
            <BugTable bugs={bugs} sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} compact onBugClick={onBugClick} selectedBugId={selectedBugId} />
          </Card>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Sprints Tab — iteration tracking with expansion
// ============================================================================
const SprintsTab: React.FC<{
  releases: QualityReleaseDto[]; expandedRelease: string | null;
  releaseWorkItems: QualityWorkItemDto[]; onExpand: (r: QualityReleaseDto) => void;
}> = ({ releases, expandedRelease, releaseWorkItems, onExpand }) => (
  <div className="space-y-3">
    {releases.length === 0 ? (
      <Card className="!py-0">
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No iterations found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">No scheduled iterations available for this selection</p>
        </div>
      </Card>
    ) : releases.map(r => (
      <Card key={r.id} className="overflow-hidden">
        <button onClick={() => onExpand(r)} className="w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-left">
          <span className="text-slate-400">
            {expandedRelease === r.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <div className={`w-2.5 h-2.5 rounded-full ${getReleaseStateColor(r.state)}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-slate-900 dark:text-white font-semibold text-sm">{r.name}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{r.state}</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {r.startDate && r.endDate ? `${formatDate(r.startDate)} → ${formatDate(r.endDate)}` : 'No dates scheduled'}
            </div>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <div className="text-center">
              <p className="text-slate-400 dark:text-slate-500">Items</p>
              <p className="text-slate-900 dark:text-white font-bold">{r.totalWorkItems ?? r.totalBugs}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 dark:text-slate-500">Bugs</p>
              <p className="text-red-600 dark:text-red-400 font-bold">{r.totalBugs}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 dark:text-slate-500">Active</p>
              <p className="text-amber-600 dark:text-amber-400 font-bold">{r.activeBugs}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 dark:text-slate-500">Resolved</p>
              <p className="text-emerald-600 dark:text-emerald-400 font-bold">{r.resolvedBugs}</p>
            </div>
            <div className="w-20">
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all duration-500 ${getCompletionColor(r.completionRate)}`} style={{ width: `${r.completionRate}%` }} />
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-center mt-1 font-medium">{r.completionRate}%</p>
            </div>
          </div>
        </button>
        {expandedRelease === r.id && (
          <div className="border-t border-slate-200 dark:border-slate-700/40">
            {releaseWorkItems.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">No work items in this iteration</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {releaseWorkItems.map(wi => (
                      <tr key={wi.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-2.5 text-blue-600 dark:text-blue-400 font-mono font-semibold">{wi.id}</td>
                        <td className="px-2 py-2.5"><span className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${getTypeBadge(wi.workItemType)}`}>{wi.workItemType || '—'}</span></td>
                        <td className="px-2 py-2.5"><span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${getStateColor(wi.state)}`}>{wi.state}</span></td>
                        <td className="px-2 py-2.5 text-slate-900 dark:text-white truncate max-w-xs">{wi.title}</td>
                        <td className="px-2 py-2.5 text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{wi.assignedTo || <span className="italic text-slate-400">Unassigned</span>}</td>
                        <td className="px-2 py-2.5 text-slate-400 dark:text-slate-500">{wi.changedDate ? formatRelativeTime(wi.changedDate) : '—'}</td>
                        <td className="px-2 py-2.5">
                          {wi.devOpsUrl && <a href={wi.devOpsUrl} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"><ExternalLink className="w-3 h-3" /></a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    ))}
  </div>
);

// ============================================================================
// Team Tab — developer efficiency leaderboard
// ============================================================================
const TeamTab: React.FC<{ owners: OwnerEfficiencyDto[] }> = ({ owners }) => (
  <div className="space-y-4">
    {owners.length === 0 ? (
      <Card className="!py-0">
        <div className="py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No developer data</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">No developer metrics available for this selection</p>
        </div>
      </Card>
    ) : (
      <Card title="Team Efficiency" titleIcon={<Users className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/50">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Developer</th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active</th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Resolved</th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Days</th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {owners.map((o, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-slate-900 dark:text-white font-semibold flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">{o.ownerName?.charAt(0) || '?'}</div>
                    {o.ownerName}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300 font-medium">{o.totalAssigned}</td>
                  <td className="px-3 py-3 text-center text-amber-600 dark:text-amber-400 font-semibold">{o.active}</td>
                  <td className="px-3 py-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{o.resolved}</td>
                  <td className="px-3 py-3 text-center text-blue-600 dark:text-blue-400 font-medium">{o.avgResolutionDays}d</td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${getEfficiencyColor(o.efficiencyScore)}`} style={{ width: `${Math.min(o.efficiencyScore, 100)}%` }} />
                      </div>
                      <span className={`font-bold text-xs ${getEfficiencyColor(o.efficiencyScore)}`}>{o.efficiencyScore}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    )}
  </div>
);

// ============================================================================
// Search / Query Tab — filter-driven bug exploration
// ============================================================================
const SearchTab: React.FC<{
  filterOptions: QualityFilterOptionsDto | null;
  connectionId?: string;
  onBugClick: (id: number) => void; selectedBugId: number | null;
}> = ({ filterOptions, connectionId, onBugClick, selectedBugId }) => {
  const [filter, setFilter] = useState({ state: '', severity: '', assignedTo: '', areaPath: '', search: '' });
  const [results, setResults] = useState<QualityWorkItemDto[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const data = await getBugs({
        state: filter.state || undefined,
        severity: filter.severity || undefined,
        assignedTo: filter.assignedTo || undefined,
        areaPath: filter.areaPath || undefined,
        searchTerm: filter.search || undefined,
      }, connectionId);
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const selectCls = "bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors";

  return (
    <div className="space-y-4">
      <Card title="Search Bugs" titleIcon={<Filter className="w-4 h-4" />}>
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <select value={filter.state} onChange={e => setFilter(f => ({ ...f, state: e.target.value }))} className={selectCls}>
              <option value="">All States</option>
              {filterOptions?.states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))} className={selectCls}>
              <option value="">All Severities</option>
              {filterOptions?.severities.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filter.assignedTo} onChange={e => setFilter(f => ({ ...f, assignedTo: e.target.value }))} className={selectCls}>
              <option value="">All Users</option>
              {filterOptions?.assignedToUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={filter.areaPath} onChange={e => setFilter(f => ({ ...f, areaPath: e.target.value }))} className={selectCls}>
              <option value="">All Areas</option>
              {filterOptions?.areaPaths.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
              placeholder="Search title or ID..."
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className={selectCls} />
          </div>
          <button onClick={handleSearch} disabled={searching}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shadow-sm">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
      </Card>

      {results.length > 0 && (
        <Card title={`Results (${results.length})`} titleIcon={<Search className="w-4 h-4" />}>
          <BugTable bugs={results} sortField="createdDate" sortDir="desc" toggleSort={() => {}} onBugClick={onBugClick} selectedBugId={selectedBugId} />
        </Card>
      )}
    </div>
  );
};

export default QualityDashboardV2;
