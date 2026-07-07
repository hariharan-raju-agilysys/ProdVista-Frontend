import React, { useState, useEffect, useCallback, memo } from 'react';
import clsx from 'clsx';
import { DataFreshnessBadge } from '../components/DataFreshnessBadge';
import {
  getConnections, getBugs, getMyBugs,
  getReleases, getReleaseWorkItems, getOwnerEfficiency, getFilterOptions,
  getTrend, getAgingDistribution,
  getAreaPaths, getRepositories, getKpiSummary, getBugDetailWithContext, getTodayActivity,
  getWorkItemCommits, getTeamWorkload,
  QualityWorkItemDto, QualityReleaseDto,
  OwnerEfficiencyDto, QualityFilterOptionsDto, QualityTrendPointDto,
  BugAgingDistributionDto, QualityConnection, QualityAreaPath, QualityRepository,
  KpiSummary, BugDetailContext, TodayActivity,
  WorkItemRelations, TeamWorkloadResponse, TeamWorkloadPersonDto,
  getSeverityColor, getStateColor, getReleaseStateColor,
  formatDate, formatRelativeTime, getCompletionColor
} from '../services/qualityService';
import {
  getDepartments as getHrDepartments,
  getBirthdays as getHrBirthdays,
  HrDepartment, HrBirthday
} from '../services/hrPortalService';
import { useAuth } from '../context/AuthContext';
import { useDevHierarchy } from '../hooks/useDevHierarchy';
import { DirectorSummaryInfo } from '../stores/devHierarchyStore';
import {
  Bug, Calendar, ChevronDown, ChevronRight, Clock, ExternalLink, Filter,
  Loader2, RefreshCw, Search, User, Users, X,
  AlertTriangle, BarChart3, Target, ArrowUpDown,
  TrendingUp, TrendingDown, Activity, Shield, GitBranch, Layers,
  FileText, Link2, CheckCircle2, Minus, Cake, GitPullRequest, GitCommitHorizontal, FolderGit2,
  Image, Copy, ClipboardList, UserCircle, UsersRound, ListChecks, Star, Workflow
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
  const { hierarchyEmails, selectedDirector, directors, isAdmin, selectDirector, clearSelection } = useDevHierarchy();

  // Team workload (hierarchy-scoped manager view)
  const [teamWorkload, setTeamWorkload] = useState<TeamWorkloadResponse | null>(null);
  const [teamWorkloadLoading, setTeamWorkloadLoading] = useState(false);

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
  const [_bugs, setBugs] = useState<QualityWorkItemDto[]>([]);
  const [myBugs, setMyBugs] = useState<QualityWorkItemDto[]>([]);
  const [releases, setReleases] = useState<QualityReleaseDto[]>([]);
  const [ownerEfficiency, setOwnerEfficiency] = useState<OwnerEfficiencyDto[]>([]);
  const [filterOptions, setFilterOptions] = useState<QualityFilterOptionsDto | null>(null);
  const [_trendData, setTrendData] = useState<QualityTrendPointDto[]>([]);
  const [_agingData, setAgingData] = useState<BugAgingDistributionDto[]>([]);

  // Data freshness
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Today Activity (PRs + Commits grouped by Repo)
  const [_todayActivity, setTodayActivity] = useState<TodayActivity | null>(null);
  const [userScope, setUserScope] = useState<'mine' | 'all'>('mine');

  // User tracker — select any team member to view their work items
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [userWorkItems, setUserWorkItems] = useState<QualityWorkItemDto[]>([]);
  const [userWorkItemsLoading, setUserWorkItemsLoading] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // HR Portal - Department & Birthdays
  const [hrDepartments, setHrDepartments] = useState<HrDepartment[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(() =>
    localStorage.getItem('quality_hr_dept') || ''
  );
  const [_birthdays, setBirthdays] = useState<HrBirthday[]>([]);

  // Bug detail modal (replaces side panel)
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [bugDetail, setBugDetail] = useState<BugDetailContext | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'details' | 'commits' | 'images' | 'related'>('details');
  const [commitRelations, setCommitRelations] = useState<WorkItemRelations | null>(null);
  const [commitsLoading, setCommitsLoading] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; bug: QualityWorkItemDto } | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRelease, setExpandedRelease] = useState<string | null>(null);
  const [releaseWorkItems, setReleaseWorkItems] = useState<QualityWorkItemDto[]>([]);
  const [_bugFilter, _setBugFilter] = useState({ state: '', severity: '', search: '' });
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
        setError('No Azure DevOps connection configured. Go to Settings → DevOps Connections to set one up.');
        return;
      }

      const [areas, repos, filterOpts] = await Promise.all([
        getAreaPaths(connId),
        getRepositories(connId),
        getFilterOptions(connId).catch(() => null),
      ]);
      setAreaPaths(areas);
      setRepositories(repos);
      if (filterOpts) setFilterOptions(filterOpts);

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
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to load quality data');
    } finally {
      setLoading(false);
    }
  }, [selectedConnectionId, selectedAreaPath, selectedRepoIds, userScope]);

  const loadTeamWorkload = useCallback(async () => {
    if (!selectedConnectionId) return;
    setTeamWorkloadLoading(true);
    try {
      const data = await getTeamWorkload(
        selectedConnectionId,
        selectedAreaPath,
        hierarchyEmails.length > 0 ? hierarchyEmails : undefined
      );
      setTeamWorkload(data);
    } catch (err) {
      console.error('Failed to load team workload:', err);
    } finally {
      setTeamWorkloadLoading(false);
    }
  }, [selectedConnectionId, selectedAreaPath, hierarchyEmails]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  useEffect(() => {
    if (selectedConnectionId) {
      loadDashboardData();
      loadTeamWorkload();
      loadTabData(activeTab);
    }
  }, [selectedConnectionId, selectedAreaPath, selectedRepoIds, loadDashboardData]);

  // Reload team workload when hierarchy changes (director selection or user hierarchy loads)
  useEffect(() => {
    if (selectedConnectionId) {
      loadTeamWorkload();
      // Also reload team efficiency if team tab is active
      if (activeTab === 'team') {
        getOwnerEfficiency(selectedConnectionId, undefined, hierarchyEmails)
          .then(setOwnerEfficiency)
          .catch(err => console.error('Failed to reload team efficiency:', err));
      }
    }
  }, [hierarchyEmails, loadTeamWorkload, activeTab, selectedConnectionId]);

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
      setDetailTab('details');
      setCommitRelations(null);
      setBugDetail(null);
      getBugDetailWithContext(selectedBugId, selectedConnectionId)
        .then(setBugDetail)
        .catch(() => setBugDetail(null))
        .finally(() => setDetailLoading(false));
      // Load commits in parallel
      setCommitsLoading(true);
      getWorkItemCommits(selectedBugId, selectedConnectionId)
        .then(setCommitRelations)
        .catch(() => setCommitRelations(null))
        .finally(() => setCommitsLoading(false));
    } else {
      setBugDetail(null);
      setCommitRelations(null);
    }
  }, [selectedBugId, selectedConnectionId]);

  // User tracker — load work items when a user is selected
  useEffect(() => {
    if (selectedUser && selectedConnectionId) {
      setUserWorkItemsLoading(true);
      getBugs({ assignedTo: selectedUser }, selectedConnectionId)
        .then(setUserWorkItems)
        .catch(() => setUserWorkItems([]))
        .finally(() => setUserWorkItemsLoading(false));
    } else {
      setUserWorkItems([]);
    }
  }, [selectedUser, selectedConnectionId]);

  // Lazy tab loading
  const loadTabData = useCallback(async (tab: TabType) => {
    if (!selectedConnectionId) return;
    try {
      if (tab === 'my-bugs' && !selectedUser) {
        const data = await getMyBugs(selectedConnectionId);
        setMyBugs(data);
      }
      if (tab === 'team') {
        const data = await getOwnerEfficiency(selectedConnectionId, undefined, hierarchyEmails);
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
  }, [selectedConnectionId, releases, filterOptions, selectedUser, hierarchyEmails]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    loadTabData(tab);
  };

  const handleRefresh = () => {
    setMyBugs([]);
    setOwnerEfficiency([]);
    loadDashboardData();
    loadTeamWorkload();
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

  const handleContextMenu = (e: React.MouseEvent, bug: QualityWorkItemDto) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, bug });
  };

  const copyAsHtml = (bug: QualityWorkItemDto) => {
    const html = `<tr><td>${bug.id}</td><td>${bug.workItemType}</td><td>${bug.title}</td><td>${bug.state}</td><td>${bug.severity || ''}</td><td>${bug.assignedTo || ''}</td><td>${bug.ageDays}d</td></tr>`;
    navigator.clipboard.writeText(html);
    setContextMenu(null);
  };

  const copyAsCsv = (bug: QualityWorkItemDto) => {
    const csv = `${bug.id},${bug.workItemType},"${bug.title}",${bug.state},${bug.severity || ''},${bug.assignedTo || ''},${bug.ageDays}`;
    navigator.clipboard.writeText(csv);
    setContextMenu(null);
  };

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // Close user picker on click outside
  useEffect(() => {
    if (!userPickerOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-user-picker]')) {
        setUserPickerOpen(false);
        setUserSearch('');
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [userPickerOpen]);

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
            Set up an Azure DevOps connection in <span className="font-medium text-blue-600 dark:text-blue-400">Settings → DevOps Connections</span> first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-[#1b1b1f]">
      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 transition-all duration-300">
          {/* Redesigned Command Bar */}
          <div className="sticky top-0 z-30 bg-white dark:bg-[#1f1f23] border-b border-slate-200 dark:border-slate-700/50 shadow-sm">
            <div className="max-w-[1440px] mx-auto px-6">
              {/* Row 1: Title + Primary Controls */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md shadow-rose-200 dark:shadow-rose-900/30">
                    <Bug className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight tracking-tight">Quality Command Center</h1>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      {connections.find(c => c.id === selectedConnectionId)?.projectName ?? 'Azure DevOps'}
                      {selectedAreaPath && <span className="ml-1 text-blue-500">· {areaPaths.find(a => a.path === selectedAreaPath)?.shortName}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DataFreshnessBadge
                    lastRefreshed={lastRefreshed}
                    onRefresh={handleRefresh}
                    isRefreshing={loading}
                  />
                  {loading && (
                    <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" /> Syncing
                    </span>
                  )}
                  <button
                    onClick={handleRefresh}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: Filters + User Picker */}
              <div className="flex items-center gap-2 pb-3 -mt-1 overflow-x-auto">
                {/* Connection selector (only if multiple) */}
                {connections.length > 1 && (
                  <select
                    value={selectedConnectionId ?? ''}
                    onChange={e => { setSelectedConnectionId(e.target.value); setMyBugs([]); setOwnerEfficiency([]); }}
                    className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
                  >
                    {connections.map(c => <option key={c.id} value={c.id}>{c.connectionName}</option>)}
                  </select>
                )}

                {/* Area path filter */}
                <div className="flex items-center gap-1">
                  <select
                    value={selectedAreaPath ?? ''}
                    onChange={e => { setSelectedAreaPath(e.target.value || undefined); setMyBugs([]); setOwnerEfficiency([]); }}
                    className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer min-w-[140px]"
                  >
                    <option value="">All Areas</option>
                    {areaPaths.map(a => <option key={a.id} value={a.path}>{a.shortName}</option>)}
                  </select>
                  {selectedAreaPath && (
                    <button onClick={() => setSelectedAreaPath(undefined)} className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors" title="Clear area">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* HR Department filter */}
                {hrDepartments.length > 0 && (
                  <select
                    value={selectedDepartment}
                    onChange={e => handleDepartmentChange(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
                  >
                    <option value="">All Departments</option>
                    {hrDepartments.map(d => <option key={d.departmentCode} value={d.departmentCode}>{d.departmentName} ({d.actualCount})</option>)}
                  </select>
                )}

                {/* Scope toggle */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 ml-auto shrink-0">
                  <button
                    onClick={() => setUserScope('mine')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      userScope === 'mine' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <User className="w-3 h-3" /> My
                  </button>
                  <button
                    onClick={() => setUserScope('all')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      userScope === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <Users className="w-3 h-3" /> All
                  </button>
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0" />

                {/* User Tracker Picker */}
                <div className="relative shrink-0" data-user-picker>
                  <button
                    onClick={() => setUserPickerOpen(!userPickerOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      selectedUser
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    {selectedUser ? (
                      <>
                        <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
                          {selectedUser.charAt(0).toUpperCase()}
                        </div>
                        <span className="max-w-[120px] truncate">{selectedUser.split(' <')[0]}</span>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedUser(''); setUserPickerOpen(false); }}
                          className="ml-0.5 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <UserCircle className="w-4 h-4" />
                        Track User
                        <ChevronDown className="w-3 h-3" />
                      </>
                    )}
                  </button>

                  {/* User Picker Dropdown */}
                  {userPickerOpen && (
                    <div className="absolute top-full right-0 mt-1.5 w-72 bg-white dark:bg-[#292929] border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
                          <Search className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            placeholder="Search team members..."
                            className="bg-transparent text-sm text-slate-900 dark:text-white border-0 focus:outline-none w-full placeholder-slate-400"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-1">
                        {filterOptions?.assignedToUsers
                          ?.filter(u => u.toLowerCase().includes(userSearch.toLowerCase()))
                          .map(u => {
                            const displayName = u.split(' <')[0];
                            const isActive = selectedUser === u;
                            return (
                              <button
                                key={u}
                                onClick={() => { setSelectedUser(u); setUserPickerOpen(false); setUserSearch(''); setActiveTab('my-bugs'); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                                  isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                  isActive ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}>
                                  {displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{displayName}</p>
                                </div>
                                {isActive && <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />}
                              </button>
                            );
                          })}
                        {filterOptions?.assignedToUsers?.filter(u => u.toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-4">No matching users</p>
                        )}
                        {!filterOptions?.assignedToUsers && (
                          <p className="text-xs text-slate-400 text-center py-4">Loading users...</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Repo chips (compact) */}
              {repositories.length > 0 && (
                <div className="flex items-center gap-1.5 pb-2.5 overflow-x-auto border-t border-slate-100 dark:border-slate-800/50 pt-2">
                  <FolderGit2 className="w-3 h-3 text-slate-400 shrink-0" />
                  <button
                    onClick={clearRepoSelection}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
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
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors shrink-0 flex items-center gap-1 ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <GitBranch className="w-2.5 h-2.5" />
                        {repo.name}
                        {isSelected && <X className="w-2.5 h-2.5 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* User Tracker Banner — shows when tracking a specific user */}
          {selectedUser && (
            <div className="max-w-[1440px] mx-auto px-6 pt-4">
              <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                  {selectedUser.split(' <')[0].charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                    Tracking: {selectedUser.split(' <')[0]}
                  </p>
                  <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">
                    {userWorkItemsLoading ? 'Loading work items...' : `${userWorkItems.length} work items assigned`}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs shrink-0">
                  <div className="text-center">
                    <p className="text-indigo-900 dark:text-indigo-200 font-bold text-base">{userWorkItems.filter(w => w.state === 'Active' || w.state === 'New').length}</p>
                    <p className="text-indigo-600/60 dark:text-indigo-400/60">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold text-base">{userWorkItems.filter(w => w.state === 'Resolved' || w.state === 'Closed').length}</p>
                    <p className="text-indigo-600/60 dark:text-indigo-400/60">Resolved</p>
                  </div>
                  <div className="text-center">
                    <p className="text-amber-600 dark:text-amber-400 font-bold text-base">{userWorkItems.filter(w => w.ageDays > 14).length}</p>
                    <p className="text-indigo-600/60 dark:text-indigo-400/60">Aging</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser('')}
                  className="text-indigo-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors ml-2"
                  title="Stop tracking"
                >
                  <X className="w-4 h-4" />
                </button>
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
                { id: 'my-bugs' as TabType, label: selectedUser ? `${selectedUser.split(' <')[0].split(' ')[0]}'s Items` : 'My Items', icon: selectedUser ? UserCircle : User, badge: selectedUser ? userWorkItems.length : 0 },
                { id: 'sprints' as TabType, label: 'Sprints', icon: Target },
                { id: 'team' as TabType, label: 'Team', icon: Users },
                { id: 'query' as TabType, label: 'Search', icon: Search },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    activeTab === tab.id
                      ? selectedUser && tab.id === 'my-bugs' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' : 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {'badge' in tab && (tab as any).badge > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {(tab as any).badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && <ManagerOverviewTab
              teamWorkload={teamWorkload}
              isLoading={teamWorkloadLoading}
              onBugClick={handleBugClick}
              selectedBugId={selectedBugId}
              isAdmin={isAdmin}
              directors={directors}
              selectedDirector={selectedDirector}
              onSelectDirector={selectDirector}
              onClearDirector={clearSelection}
            />}            {activeTab === 'my-bugs' && (
              selectedUser ? (
                <MyBugsTab
                  bugs={sortedBugs(userWorkItemsLoading ? [] : userWorkItems)}
                  userEmail={selectedUser.split(' <')[0]}
                  sortField={sortField} sortDir={sortDir} toggleSort={toggleSort}
                  onBugClick={handleBugClick} selectedBugId={selectedBugId}
                  onContextMenu={handleContextMenu}
                  isLoading={userWorkItemsLoading}
                />
              ) : (
                <MyBugsTab bugs={sortedBugs(myBugs)} userEmail={user?.email ?? ''} sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} onBugClick={handleBugClick} selectedBugId={selectedBugId} onContextMenu={handleContextMenu} />
              )
            )}
            {activeTab === 'sprints' && <SprintsTab
              releases={releases} expandedRelease={expandedRelease}
              releaseWorkItems={releaseWorkItems} onExpand={handleExpandRelease}
            />}
            {activeTab === 'team' && <TeamTab owners={ownerEfficiency} onBugClick={handleBugClick} />}
            {activeTab === 'query' && <SearchTab
              filterOptions={filterOptions} connectionId={selectedConnectionId}
              onBugClick={handleBugClick} selectedBugId={selectedBugId}
              onContextMenu={handleContextMenu}
            />}
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div className="fixed z-[100] bg-white dark:bg-[#292929] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button onClick={() => copyAsHtml(contextMenu.bug)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <Copy className="w-3.5 h-3.5" /> Copy as HTML
            </button>
            <button onClick={() => copyAsCsv(contextMenu.bug)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ClipboardList className="w-3.5 h-3.5" /> Copy as CSV
            </button>
            {contextMenu.bug.devOpsUrl && (
              <a href={contextMenu.bug.devOpsUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => setContextMenu(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Open in Azure DevOps
              </a>
            )}
          </div>
        )}

        {/* Work Item Modal */}
        {selectedBugId && (
          <WorkItemModal
            bugDetail={bugDetail}
            loading={detailLoading}
            commitRelations={commitRelations}
            commitsLoading={commitsLoading}
            detailTab={detailTab}
            onTabChange={setDetailTab}
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
// Work Item Modal — Full overlay with tabs (Details, Commits, Images, Related)
// ============================================================================
const extractImages = (html?: string | null): string[] => {
  if (!html) return [];
  const matches = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
  return matches.map(tag => {
    const m = tag.match(/src=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }).filter(Boolean);
};

const WorkItemModal: React.FC<{
  bugDetail: BugDetailContext | null; loading: boolean;
  commitRelations: WorkItemRelations | null; commitsLoading: boolean;
  detailTab: 'details' | 'commits' | 'images' | 'related';
  onTabChange: (tab: 'details' | 'commits' | 'images' | 'related') => void;
  onClose: () => void; onBugClick: (id: number) => void;
}> = ({ bugDetail, loading, commitRelations, commitsLoading, detailTab, onTabChange, onClose, onBugClick }) => {
  const allImages = bugDetail ? [
    ...extractImages(bugDetail.description),
    ...extractImages(bugDetail.reproSteps),
    ...extractImages(bugDetail.acceptanceCriteria),
  ] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1f1f23] rounded-2xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50"
        onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            {bugDetail ? (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-blue-600 dark:text-blue-400 font-mono text-sm font-bold">#{bugDetail.bug.id}</span>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getStateColor(bugDetail.bug.state)}`}>{bugDetail.bug.state}</span>
                  {bugDetail.bug.severity && <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getSeverityColor(bugDetail.bug.severity)}`}>{bugDetail.bug.severity}</span>}
                  {bugDetail.bug.priority && <span className="px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">P{bugDetail.bug.priority}</span>}
                  <span className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${getTypeBadge(bugDetail.bug.workItemType)}`}>{bugDetail.bug.workItemType}</span>
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white mt-1 truncate">{bugDetail.bug.title}</h2>
              </div>
            ) : (
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Work Item Details</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {bugDetail?.bug.devOpsUrl && (
              <a href={bugDetail.bug.devOpsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors font-medium">
                <ExternalLink className="w-3.5 h-3.5" /> DevOps
              </a>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        {bugDetail && (
          <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700/50 px-6 shrink-0">
            {([
              { id: 'details' as const, label: 'Details', icon: FileText },
              { id: 'commits' as const, label: `Commits${commitRelations ? ` (${commitRelations.totalCommits})` : ''}`, icon: GitCommitHorizontal },
              { id: 'images' as const, label: `Images${allImages.length > 0 ? ` (${allImages.length})` : ''}`, icon: Image },
              { id: 'related' as const, label: 'Related', icon: Link2 },
            ]).map(tab => (
              <button key={tab.id} onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  detailTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}>
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto">
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
            <>
              {/* Details Tab */}
              {detailTab === 'details' && (
                <div className="p-6 space-y-5">
                  {/* Meta info */}
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                    {bugDetail.bug.assignedTo && <span className="flex items-center gap-1.5"><User className="w-3 h-3" />{bugDetail.bug.assignedTo}</span>}
                    <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{bugDetail.bug.ageDays}d old</span>
                    {bugDetail.bug.areaPath && <span className="flex items-center gap-1.5"><Layers className="w-3 h-3" />{bugDetail.bug.areaPath.split('\\').pop()}</span>}
                    {bugDetail.bug.iterationPath && <span className="flex items-center gap-1.5"><Target className="w-3 h-3" />{bugDetail.bug.iterationPath.split('\\').pop()}</span>}
                  </div>
                  {bugDetail.bug.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {bugDetail.bug.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800/40 font-medium">{tag}</span>
                      ))}
                    </div>
                  )}

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
                </div>
              )}

              {/* Commits Tab */}
              {detailTab === 'commits' && (
                <div className="p-6 space-y-4">
                  {commitsLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400 mr-2" />
                      <span className="text-sm text-slate-400">Loading commits...</span>
                    </div>
                  ) : !commitRelations || commitRelations.commits.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                        <GitCommitHorizontal className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">No linked commits found</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Commits linked via Azure DevOps will appear here</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800/40">
                          <p className="text-xl font-bold text-cyan-700 dark:text-cyan-400">{commitRelations.totalCommits}</p>
                          <p className="text-[10px] text-cyan-600 dark:text-cyan-500 font-medium uppercase">Total Commits</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/40">
                          <p className="text-xl font-bold text-green-700 dark:text-green-400">{commitRelations.commits.reduce((s, c) => s + (c.additions || 0), 0)}</p>
                          <p className="text-[10px] text-green-600 dark:text-green-500 font-medium uppercase">Additions</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/40">
                          <p className="text-xl font-bold text-red-700 dark:text-red-400">{commitRelations.commits.reduce((s, c) => s + (c.deletions || 0), 0)}</p>
                          <p className="text-[10px] text-red-600 dark:text-red-500 font-medium uppercase">Deletions</p>
                        </div>
                      </div>

                      {/* PR Links */}
                      {commitRelations.pullRequestLinks.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <GitPullRequest className="w-3 h-3" /> Pull Request Links ({commitRelations.pullRequestLinks.length})
                          </h4>
                          <div className="space-y-1">
                            {commitRelations.pullRequestLinks.map((pr, i) => (
                              <a key={i} href={pr.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-xs text-purple-700 dark:text-purple-300 font-medium">
                                <GitPullRequest className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{pr.name || pr.url}</span>
                                <ExternalLink className="w-3 h-3 text-purple-400 shrink-0 ml-auto" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Commit List */}
                      <div className="space-y-2">
                        {commitRelations.commits.map(c => (
                          <div key={c.commitId} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-lg p-3.5 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                {c.authorName?.charAt(0) || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-900 dark:text-white font-medium leading-snug">{c.comment}</p>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">{c.shortCommitId}</span>
                                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.authorName}</span>
                                  {c.authorDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRelativeTime(c.authorDate)}</span>}
                                  <span className="flex items-center gap-1.5">
                                    <span className="text-green-600 dark:text-green-400">+{c.additions || 0}</span>
                                    <span className="text-slate-400">/</span>
                                    <span className="text-amber-600 dark:text-amber-400">~{c.edits || 0}</span>
                                    <span className="text-slate-400">/</span>
                                    <span className="text-red-600 dark:text-red-400">-{c.deletions || 0}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Images Tab */}
              {detailTab === 'images' && (
                <div className="p-6">
                  {allImages.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                        <Image className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">No images found</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Images embedded in description, repro steps, or acceptance criteria will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{allImages.length} image{allImages.length !== 1 ? 's' : ''} found in work item content</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {allImages.map((src, i) => (
                          <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                            className="block border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden hover:border-blue-400 dark:hover:border-blue-600 transition-colors group">
                            <img src={src} alt={`Attachment ${i + 1}`} className="w-full h-auto max-h-80 object-contain bg-slate-50 dark:bg-slate-800" loading="lazy" />
                            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-[10px] text-slate-400 truncate flex items-center gap-1.5 group-hover:text-blue-500 transition-colors">
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              Image {i + 1}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Related Tab */}
              {detailTab === 'related' && (
                <div className="p-6 space-y-5">
                  {/* Related Bugs */}
                  {bugDetail.relatedBugsInArea && bugDetail.relatedBugsInArea.length > 0 && (
                    <DetailSection title={`Related Bugs in Area (${bugDetail.relatedBugsInArea.length})`}>
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
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
                      <div className="space-y-1 max-h-52 overflow-y-auto">
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

                  {(!bugDetail.relatedBugsInArea || bugDetail.relatedBugsInArea.length === 0) &&
                   (!bugDetail.siblingWorkItems || bugDetail.siblingWorkItems.length === 0) && (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                        <Link2 className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">No related items found</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

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
  onContextMenu?: (e: React.MouseEvent, bug: QualityWorkItemDto) => void;
}> = ({ bugs, sortField, sortDir, toggleSort, compact, onBugClick, selectedBugId, onContextMenu }) => (
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
            onContextMenu={e => onContextMenu?.(e, bug)}
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
// ============================================================
// Manager Overview Tab — Hierarchy-Scoped Command Center
// ============================================================
interface ManagerOverviewProps {
  teamWorkload: TeamWorkloadResponse | null;
  isLoading: boolean;
  onBugClick: (id: number) => void;
  selectedBugId: number | null;
  isAdmin: boolean;
  directors: DirectorSummaryInfo[];
  selectedDirector: DirectorSummaryInfo | null;
  onSelectDirector: (d: DirectorSummaryInfo) => void;
  onClearDirector: () => void;
}

const ManagerOverviewTab: React.FC<ManagerOverviewProps> = ({
  teamWorkload, isLoading, onBugClick, selectedBugId,
  isAdmin, directors, selectedDirector, onSelectDirector, onClearDirector,
}) => {
  const tw = teamWorkload;

  const typeBuckets = tw ? [
    {
      label: 'Bugs',
      icon: <Bug className="w-4 h-4 text-red-500" />,
      total: tw.typeSummary.bugs.total,
      a: { label: 'Open', val: tw.typeSummary.bugs.open ?? 0 },
      b: { label: 'Closed', val: tw.typeSummary.bugs.closed ?? 0 },
      accent: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      barColor: 'bg-red-500',
      badge: tw.typeSummary.bugs.critical! > 0
        ? <span className="ml-1 text-[10px] font-bold bg-red-600 text-white rounded px-1.5 py-0.5">{tw.typeSummary.bugs.critical} CRIT</span>
        : null,
    },
    {
      label: 'Features',
      icon: <Star className="w-4 h-4 text-purple-500" />,
      total: tw.typeSummary.features.total,
      a: { label: 'Active', val: tw.typeSummary.features.active ?? 0 },
      b: { label: 'Done', val: tw.typeSummary.features.completed ?? 0 },
      accent: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
      barColor: 'bg-purple-500',
      badge: null,
    },
    {
      label: 'User Stories',
      icon: <FileText className="w-4 h-4 text-blue-500" />,
      total: tw.typeSummary.userStories.total,
      a: { label: 'Active', val: tw.typeSummary.userStories.active ?? 0 },
      b: { label: 'Done', val: tw.typeSummary.userStories.completed ?? 0 },
      accent: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      barColor: 'bg-blue-500',
      badge: null,
    },
    {
      label: 'Tasks',
      icon: <ListChecks className="w-4 h-4 text-green-500" />,
      total: tw.typeSummary.tasks.total,
      a: { label: 'Active', val: tw.typeSummary.tasks.active ?? 0 },
      b: { label: 'Done', val: tw.typeSummary.tasks.completed ?? 0 },
      accent: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      barColor: 'bg-green-500',
      badge: null,
    },
    {
      label: 'Change Requests',
      icon: <Workflow className="w-4 h-4 text-amber-500" />,
      total: tw.typeSummary.changeRequests.total,
      a: { label: 'Active', val: tw.typeSummary.changeRequests.active ?? 0 },
      b: { label: 'Done', val: tw.typeSummary.changeRequests.completed ?? 0 },
      accent: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      barColor: 'bg-amber-500',
      badge: null,
    },
  ] : [];

  return (
    <div className="space-y-5">
      {/* ── Hierarchy Director Picker (admin only) ── */}
      {isAdmin && directors.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <UsersRound className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Scope to Director's Team</span>
            {selectedDirector && (
              <button onClick={onClearDirector}
                className="ml-auto text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {directors.map(d => (
              <button key={d.employeeId}
                onClick={() => onSelectDirector(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                  ${selectedDirector?.employeeId === d.employeeId
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-400'}`}>
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading team workload...</span>
        </div>
      )}

      {/* ── No connection ── */}
      {!isLoading && !tw && (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a DevOps connection to view team workload</p>
        </div>
      )}

      {!isLoading && tw && (
        <>
          {/* ── Scope banner ── */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium
            ${tw.isScoped
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}>
            {tw.isScoped
              ? <><UsersRound className="w-3.5 h-3.5" /> Scoped to {tw.teamSize} team member{tw.teamSize !== 1 ? 's' : ''} — {tw.totalWorkItems} work items</>
              : <><Users className="w-3.5 h-3.5" /> All contributors — {tw.totalWorkItems} work items across {tw.teamSize} assignees</>}
          </div>

          {/* ── Type Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {typeBuckets.map(b => {
              const closedVal = b.b.val;
              const pct = b.total > 0 ? Math.round((closedVal / b.total) * 100) : 0;
              return (
                <div key={b.label} className={`rounded-xl border p-4 ${b.accent}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {b.icon}
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{b.label}</span>
                    </div>
                    {b.badge}
                  </div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{b.total}</div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>{b.a.label}: <strong className="text-slate-700 dark:text-slate-200">{b.a.val}</strong></span>
                    <span>{b.b.label}: <strong className="text-slate-700 dark:text-slate-200">{b.b.val}</strong></span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full ${b.barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 text-right">{pct}% done</div>
                </div>
              );
            })}
          </div>

          {/* ── Per-Person Workload Table ── */}
          {tw.perPerson.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Team Member Workload</h3>
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{tw.perPerson.length} assignees</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5 font-semibold">Member</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Total</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Active</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Done</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Completion</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Open Bugs</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Features</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Tasks</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {tw.perPerson.map((p: TeamWorkloadPersonDto, i: number) => (
                      <tr key={p.name + i}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800 dark:text-slate-200">{p.name}</div>
                              {p.email && <div className="text-[10px] text-slate-400 dark:text-slate-500">{p.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="text-center px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200">{p.total}</td>
                        <td className="text-center px-3 py-2.5">
                          <span className="inline-block min-w-[1.5rem] px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 font-semibold">{p.active}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className="inline-block min-w-[1.5rem] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-semibold">{p.completed}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div className={`h-full rounded-full ${p.completionRate >= 70 ? 'bg-green-500' : p.completionRate >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                style={{ width: `${p.completionRate}%` }} />
                            </div>
                            <span className={`text-[11px] font-semibold ${p.completionRate >= 70 ? 'text-green-600 dark:text-green-400' : p.completionRate >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'}`}>
                              {p.completionRate}%
                            </span>
                          </div>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          {p.openBugs > 0 ? (
                            <span className={`inline-block px-1.5 py-0.5 rounded font-semibold text-[11px] ${p.criticalBugs > 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'}`}>
                              {p.openBugs}{p.criticalBugs > 0 ? ` (${p.criticalBugs}🔴)` : ''}
                            </span>
                          ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="text-center px-3 py-2.5 text-slate-600 dark:text-slate-300">{p.features || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                        <td className="text-center px-3 py-2.5 text-slate-600 dark:text-slate-300">{p.tasks || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                        <td className="text-right px-4 py-2.5 text-slate-400 dark:text-slate-500">
                          {p.lastActivity ? formatRelativeTime(p.lastActivity) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Active Bugs Attention List ── */}
          {tw.activeBugs.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Open Bugs — Needs Attention</h3>
                <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{tw.activeBugs.length} open</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {tw.activeBugs.slice(0, 50).map(bug => (
                  <div key={bug.id}
                    onClick={() => onBugClick(bug.id)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors
                      ${selectedBugId === bug.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500' : ''}`}>
                    {/* Priority badge */}
                    <div className={`shrink-0 mt-0.5 w-5 h-5 rounded text-center text-[10px] font-bold leading-5
                      ${bug.priority === 1 ? 'bg-red-600 text-white'
                        : bug.priority === 2 ? 'bg-orange-500 text-white'
                        : bug.priority === 3 ? 'bg-yellow-400 text-slate-800'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>
                      {bug.priority ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono shrink-0">#{bug.id}</span>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{bug.title}</span>
                        {bug.severity && (
                          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${getSeverityColor(bug.severity)}`}>{bug.severity}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 flex-wrap">
                        {bug.assignedTo && <span className="flex items-center gap-1"><User className="w-3 h-3" />{bug.assignedTo}</span>}
                        {bug.areaPath && <span className="truncate max-w-[200px]">{bug.areaPath.split('\\').pop()}</span>}
                        <span>{bug.ageDays}d old</span>
                        <span className={`px-1.5 py-0.5 rounded ${getStateColor(bug.state)}`}>{bug.state}</span>
                      </div>
                    </div>
                    {bug.devOpsUrl && (
                      <a href={bug.devOpsUrl} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="shrink-0 text-slate-300 hover:text-indigo-500 dark:text-slate-600 dark:hover:text-indigo-400 transition-colors mt-0.5">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
                {tw.activeBugs.length > 50 && (
                  <div className="px-4 py-3 text-xs text-center text-slate-400 dark:text-slate-500">
                    + {tw.activeBugs.length - 50} more — use Filters tab for full list
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// My Bugs Tab — personal work item tracker
// ============================================================================
const _OverviewTabLegacy: React.FC<any> = ({ kpi, bugs, trendData, agingData, todayActivity, birthdays, bugFilter, setBugFilter, sortField, sortDir, toggleSort, onBugClick, selectedBugId, onContextMenu }) => {
  const [expandedPrRepo, setExpandedPrRepo] = useState<string | null>(null);
  const [expandedCommitRepo, setExpandedCommitRepo] = useState<string | null>(null);
  
  if (!kpi) return null;

  const upcomingBirthdays = birthdays.filter((b: any) => b.daysUntil <= 30);

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
                  {pr.byRepo.map((repo: any) => (
                    <div key={repo.repo} className="border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden">
                      <button onClick={() => setExpandedPrRepo(expandedPrRepo === repo.repo ? null : repo.repo)}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left">
                        {expandedPrRepo === repo.repo ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <FolderGit2 className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex-1">{repo.repo}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{repo.branches.reduce((s: any, b: any) => s + b.prs.length, 0)} PRs</span>
                      </button>
                      {expandedPrRepo === repo.repo && (
                        <div className="px-3 py-2 space-y-2">
                          {repo.branches.map((branch: any) => (
                            <div key={branch.branch}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <GitBranch className="w-3 h-3 text-blue-500" />
                                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{branch.branch}</span>
                                <span className="text-[10px] text-slate-400">({branch.prs.length})</span>
                              </div>
                              {branch.prs.map((p: any) => (
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
                  {cm.byRepo.map((repo: any) => (
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
                          {repo.authors.map((author: any) => (
                            <div key={author.author}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <User className="w-3 h-3 text-indigo-500" />
                                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{author.author}</span>
                                <span className="text-[10px] text-slate-400">({author.commits.length})</span>
                              </div>
                              {author.commits.map((c: any) => (
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
              {upcomingBirthdays.slice(0, 12).map((b: any) => (
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
              {Object.entries(kpi.byType).map(([type, count]: [string, any]) => (
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
            {Object.entries(kpi.byState).map(([state, count]: [string, any]) => (
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
            {Object.entries(kpi.bySeverity).map(([sev, count]: [string, any]) => (
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
            ) : kpi.topAreas.slice(0, 6).map((area: any) => (
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
              {trendData.every((p: any) => p.opened === 0 && p.closed === 0) ? (
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
                  const maxVal = Math.max(...trendData.map((d: any) => d.opened + d.closed), 1);
                  const chartH = 132; // px available for bars
                  return trendData.map((p: any, i: any) => {
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
                {agingData.map((a: any) => (
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
              {kpi.recentCritical.map((b: any) => (
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
            <select value={bugFilter.state} onChange={e => setBugFilter((f: any) => ({ ...f, state: e.target.value }))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">All States</option>
              <option value="New">New</option><option value="Active">Active</option>
              <option value="Resolved">Resolved</option><option value="Closed">Closed</option>
            </select>
            <select value={bugFilter.severity} onChange={e => setBugFilter((f: any) => ({ ...f, severity: e.target.value }))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
              <option value="">All Severities</option>
              <option value="1 - Critical">Critical</option><option value="2 - High">High</option>
              <option value="3 - Medium">Medium</option><option value="4 - Low">Low</option>
            </select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={bugFilter.search} onChange={e => setBugFilter((f: any) => ({ ...f, search: e.target.value }))}
                placeholder="Search..."
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg pl-8 pr-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
          </div>
        }
      >
        <BugTable bugs={bugs.slice(0, 50)} sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} onBugClick={onBugClick} selectedBugId={selectedBugId} onContextMenu={onContextMenu} />
        {bugs.length > 50 && (
          <div className="px-5 py-3 text-center border-t border-slate-100 dark:border-slate-700/40">
            <p className="text-xs text-slate-500 dark:text-slate-400">Showing 50 of {bugs.length} items</p>
          </div>
        )}
      </Card>
    </div>
  );
};
void _OverviewTabLegacy;

// ============================================================================
// My Bugs Tab — personal work item tracker
// ============================================================================
const MyBugsTab: React.FC<{
  bugs: QualityWorkItemDto[]; userEmail: string;
  sortField: string; sortDir: string; toggleSort: (f: string) => void;
  onBugClick: (id: number) => void; selectedBugId: number | null;
  onContextMenu?: (e: React.MouseEvent, bug: QualityWorkItemDto) => void;
  isLoading?: boolean;
}> = ({ bugs, userEmail, sortField, sortDir, toggleSort, onBugClick, selectedBugId, onContextMenu, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading work items for {userEmail}...</span>
        </div>
      </div>
    );
  }

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
            <BugTable bugs={bugs} sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} compact onBugClick={onBugClick} selectedBugId={selectedBugId} onContextMenu={onContextMenu} />
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
// Team Tab — developer efficiency with expandable work item rows
// ============================================================================
const TeamTab: React.FC<{ owners: OwnerEfficiencyDto[]; onBugClick: (id: number) => void }> = ({ owners, onBugClick }) => {
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);

  // Team aggregate stats
  const totalAssigned = owners.reduce((s, o) => s + o.totalAssigned, 0);
  const totalActive = owners.reduce((s, o) => s + o.active, 0);
  const totalResolved = owners.reduce((s, o) => s + o.resolved, 0);
  const avgEfficiency = owners.length > 0 ? Math.round(owners.reduce((s, o) => s + o.efficiencyScore, 0) / owners.length) : 0;
  const avgResolutionQuality = owners.length > 0 ? Math.round(owners.reduce((s, o) => s + o.resolutionQuality, 0) / owners.length) : 0;

  return (
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
        <>
          {/* Team Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <MiniStat label="Team Members" value={owners.length} icon={<Users className="w-3 h-3" />} />
            <MiniStat label="Total Assigned" value={totalAssigned} icon={<BarChart3 className="w-3 h-3" />} />
            <MiniStat label="Active" value={totalActive} color="text-amber-600 dark:text-amber-400" />
            <MiniStat label="Resolved" value={totalResolved} color="text-emerald-600 dark:text-emerald-400" />
            <MiniStat label="Avg Efficiency" value={`${avgEfficiency}%`} color={avgEfficiency >= 70 ? 'text-emerald-600 dark:text-emerald-400' : avgEfficiency >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
            <MiniStat label="Avg Quality" value={`${avgResolutionQuality}%`} color={avgResolutionQuality >= 95 ? 'text-emerald-600 dark:text-emerald-400' : avgResolutionQuality >= 85 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
          </div>

          {/* Developer Cards with Expandable Work Items */}
          <Card title="Team Efficiency" titleIcon={<Users className="w-4 h-4" />}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {owners.map((o, i) => {
                const isExpanded = expandedOwner === o.ownerName;
                return (
                  <div key={i}>
                    <button onClick={() => setExpandedOwner(isExpanded ? null : o.ownerName)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-left">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">
                        {o.ownerName?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{o.ownerName}</span>
                        {o.reopenedCount > 0 && (
                          <span className={clsx("ml-2 text-[10px] font-medium",
                            o.reopenRate > 15 ? "text-red-600 dark:text-red-400" :
                            o.reopenRate > 5 ? "text-amber-600 dark:text-amber-400" :
                            "text-green-600 dark:text-green-400")}>
                            {o.reopenedCount} reopened ({o.reopenRate}%)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs shrink-0">
                        <div className="text-center">
                          <p className="text-slate-900 dark:text-white font-bold">{o.totalAssigned}</p>
                          <p className="text-[10px] text-slate-400">Assigned</p>
                        </div>
                        <div className="text-center">
                          <p className="text-blue-600 dark:text-blue-400 font-bold">{o.totalResolvedByUser}</p>
                          <p className="text-[10px] text-slate-400">Resolved By</p>
                        </div>
                        <div className="text-center">
                          <p className="text-amber-600 dark:text-amber-400 font-bold">{o.active}</p>
                          <p className="text-[10px] text-slate-400">Active</p>
                        </div>
                        <div className="text-center">
                          <p className="text-emerald-600 dark:text-emerald-400 font-bold">{o.resolved}</p>
                          <p className="text-[10px] text-slate-400">Closed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-blue-600 dark:text-blue-400 font-medium">{o.avgResolutionDays}d</p>
                          <p className="text-[10px] text-slate-400">Avg</p>
                        </div>
                        <div className="flex items-center gap-2 w-28">
                          <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                            <div className={clsx("h-1.5 rounded-full",
                              o.resolutionQuality >= 95 ? "bg-green-500" :
                              o.resolutionQuality >= 85 ? "bg-yellow-500" : "bg-red-500")}
                              style={{ width: `${Math.min(o.resolutionQuality, 100)}%` }} />
                          </div>
                          <span className={clsx("font-bold text-xs",
                            o.resolutionQuality >= 95 ? "text-green-600 dark:text-green-400" :
                            o.resolutionQuality >= 85 ? "text-yellow-600 dark:text-yellow-400" :
                            "text-red-600 dark:text-red-400")}>
                            {Math.round(o.resolutionQuality)}%
                          </span>
                        </div>
                      </div>
                    </button>
                    {isExpanded && o.workItems && o.workItems.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="px-5 py-2 max-h-60 overflow-y-auto">
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30">
                              {o.workItems.map(wi => (
                                <tr key={wi.id} onClick={() => onBugClick(wi.id)} className="hover:bg-slate-100 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
                                  <td className="px-2 py-1.5 text-blue-600 dark:text-blue-400 font-mono font-semibold w-16">{wi.id}</td>
                                  <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${getTypeBadge(wi.workItemType)}`}>{wi.workItemType}</span></td>
                                  <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getStateColor(wi.state)}`}>{wi.state}</span></td>
                                  <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-xs">{wi.title}</td>
                                  <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{wi.ageDays}d</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {isExpanded && (!o.workItems || o.workItems.length === 0) && (
                      <div className="border-t border-slate-100 dark:border-slate-800/50 px-5 py-4 bg-slate-50/50 dark:bg-slate-800/20">
                        <p className="text-xs text-slate-400 text-center">No work items detail available for this developer</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Search / Query Tab — filter-driven bug exploration
// ============================================================================
const SearchTab: React.FC<{
  filterOptions: QualityFilterOptionsDto | null;
  connectionId?: string;
  onBugClick: (id: number) => void; selectedBugId: number | null;
  onContextMenu?: (e: React.MouseEvent, bug: QualityWorkItemDto) => void;
}> = ({ filterOptions, connectionId, onBugClick, selectedBugId, onContextMenu }) => {
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
          <BugTable bugs={results} sortField="createdDate" sortDir="desc" toggleSort={() => {}} onBugClick={onBugClick} selectedBugId={selectedBugId} onContextMenu={onContextMenu} />
        </Card>
      )}
    </div>
  );
};

export default QualityDashboardV2;
