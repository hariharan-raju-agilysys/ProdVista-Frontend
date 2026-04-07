import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User, GitPullRequest, GitCommit, Package, RefreshCw, Settings,
  CheckCircle, XCircle, Clock, Eye, AlertTriangle, ExternalLink,
  ChevronRight, Search, Activity, Code2, FileText
} from 'lucide-react';
import clsx from 'clsx';
import developerDashboardService, {
  type DeveloperDashboard, type AzureDevOpsWorkItem, type AzureDevOpsPullRequest,
  type CommitInfo, type BuildInfo
} from '../services/developerDashboardService';
import engineeringService, { type EngineeringConfig } from '../services/engineeringService';
// Import shared utilities - centralized helper functions
import {
  timeAgo,
  priorityColor,
  stateColor,
  workItemTypeIcon,
  buildStatusColor,
} from '@/utils';
// Import shared UI components
import {
  InteractiveStatCard,
  TabPanel,
  type Tab,
  EmptyState,
  LoadingSpinner,
} from '@components/shared/ui';

// =====================================================
// Tab Type
// =====================================================

type TabId = 'overview' | 'work' | 'prs' | 'commits' | 'builds';

interface DeveloperTab extends Tab {
  id: TabId;
}

// =====================================================
// Work Item Card - Uses shared utilities
// =====================================================

function WorkItemCard({ item, onOpenExternal }: { item: AzureDevOpsWorkItem; onOpenExternal?: () => void }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-xl" title={item.workItemType}>{workItemTypeIcon(item.workItemType)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">#{item.id}</span>
              <span className={clsx('px-1.5 py-0.5 text-xs rounded font-medium', stateColor(item.state))}>{item.state}</span>
              {item.priority && (
                <span className={clsx('px-1.5 py-0.5 text-xs rounded font-medium', priorityColor(item.priority))}>P{item.priority}</span>
              )}
            </div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mt-1 line-clamp-2">{item.title}</h4>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {item.assignedTo && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {item.assignedTo.split(' ')[0]}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(item.changedDate)}
              </span>
            </div>
          </div>
        </div>
        {item.url && (
          <button
            onClick={onOpenExternal || (() => window.open(item.url, '_blank'))}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
      {item.tags && (
        <div className="flex flex-wrap gap-1 mt-3">
          {item.tags.split(';').filter(Boolean).map((tag, i) => (
            <span key={i} className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded">
              {tag.trim()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// PR Card
// =====================================================

function PullRequestCard({ pr, isReview }: { pr: AzureDevOpsPullRequest; isReview?: boolean }) {
  const approvedCount = pr.reviewers?.filter(r => r.vote >= 5).length || 0;
  const rejectedCount = pr.reviewers?.filter(r => r.vote === -10).length || 0;
  const waitingCount = pr.reviewers?.filter(r => r.vote === 0 || r.vote === -5).length || 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <GitPullRequest className={clsx(
            'w-5 h-5 shrink-0 mt-0.5',
            pr.status === 'completed' ? 'text-purple-500' :
            pr.isDraft ? 'text-gray-400' :
            'text-green-500'
          )} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">!{pr.id}</span>
              {pr.isDraft && (
                <span className="px-1.5 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded font-medium">DRAFT</span>
              )}
              {isReview && (
                <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded font-medium">REVIEW</span>
              )}
            </div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mt-1 line-clamp-2">{pr.title}</h4>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {pr.createdBy.split(' ')[0]}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(pr.creationDate)}
              </span>
              <span className="text-gray-400 dark:text-gray-500">{pr.repositoryName}</span>
            </div>
          </div>
        </div>
        {pr.url && (
          <button
            onClick={() => window.open(pr.url, '_blank')}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Reviewers */}
      {pr.reviewers && pr.reviewers.length > 0 && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Reviewers:</span>
          <div className="flex items-center gap-2">
            {approvedCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded">
                <CheckCircle className="w-3 h-3" /> {approvedCount}
              </span>
            )}
            {waitingCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                <Clock className="w-3 h-3" /> {waitingCount}
              </span>
            )}
            {rejectedCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded">
                <XCircle className="w-3 h-3" /> {rejectedCount}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Commit Card
// =====================================================

function CommitCard({ commit }: { commit: CommitInfo }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <GitCommit className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                {commit.commitId.substring(0, 7)}
              </code>
              <span className="text-xs text-gray-400 dark:text-gray-500">{commit.repositoryName}</span>
            </div>
            <p className="text-sm text-gray-900 dark:text-white mt-1 line-clamp-2">{commit.comment}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {commit.author}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(commit.authorDate)}
              </span>
              {commit.changeCounts && (
                <span className="flex items-center gap-2">
                  {commit.changeCounts.add > 0 && <span className="text-green-600">+{commit.changeCounts.add}</span>}
                  {commit.changeCounts.edit > 0 && <span className="text-yellow-600">~{commit.changeCounts.edit}</span>}
                  {commit.changeCounts.delete > 0 && <span className="text-red-600">-{commit.changeCounts.delete}</span>}
                </span>
              )}
            </div>
          </div>
        </div>
        {commit.url && (
          <button
            onClick={() => window.open(commit.url, '_blank')}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Build Card
// =====================================================

function BuildCard({ build }: { build: BuildInfo }) {
  const statusBadge = buildStatusColor(build.status, build.result);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Package className={clsx(
            'w-5 h-5 shrink-0 mt-0.5',
            build.result === 'succeeded' ? 'text-green-500' :
            build.result === 'failed' ? 'text-red-500' :
            build.status === 'inProgress' ? 'text-blue-500' :
            'text-gray-400'
          )} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">#{build.buildNumber}</span>
              <span className={clsx('px-1.5 py-0.5 text-xs rounded font-medium capitalize', statusBadge)}>
                {build.result || build.status}
              </span>
            </div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mt-1">{build.definitionName}</h4>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
              {build.requestedBy && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {build.requestedBy.split(' ')[0]}
                </span>
              )}
              {build.startTime && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(build.startTime)}
                </span>
              )}
              {build.sourceBranch && (
                <span className="text-gray-400 dark:text-gray-500 truncate">
                  {build.sourceBranch.replace('refs/heads/', '')}
                </span>
              )}
            </div>
          </div>
        </div>
        {build.url && (
          <button
            onClick={() => window.open(build.url, '_blank')}
            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Config Dialog
// =====================================================

function ConfigDialog({ config, onSave, onClose }: {
  config: EngineeringConfig | null;
  onSave: (c: EngineeringConfig) => void;
  onClose: () => void;
}) {
  const [orgUrl, setOrgUrl] = useState(config?.organizationUrl || 'https://dev.azure.com/AGYS-VisualOne');
  const [project, setProject] = useState(config?.projectName || 'PMS');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Azure DevOps Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Organization URL</label>
            <input value={orgUrl} onChange={e => setOrgUrl(e.target.value)}
              placeholder="https://dev.azure.com/org"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Project Name</label>
            <input value={project} onChange={e => setProject(e.target.value)}
              placeholder="PMS"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancel</button>
          <button onClick={() => { onSave({ organizationUrl: orgUrl.trim(), projectName: project.trim(), projectNames: [project.trim()] }); onClose(); }}
            disabled={!orgUrl.trim() || !project.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Main Page Component
// =====================================================

export default function DeveloperToolkitPage() {
  // State
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [dashboard, setDashboard] = useState<DeveloperDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<EngineeringConfig | null>(() => engineeringService.getSavedConfig());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filters
  const [workItemFilter, setWorkItemFilter] = useState<string>('all');
  const [workItemSearch, setWorkItemSearch] = useState('');
  const [prFilter, setPrFilter] = useState<'mine' | 'review' | 'all'>('all');
  const [prSearch, setPrSearch] = useState('');

  // Fetch Dashboard
  const fetchDashboard = useCallback(async () => {
    if (!config) {
      setLoading(false);
      setShowConfig(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await developerDashboardService.getDashboard({
        organizationUrl: config.organizationUrl,
        projectName: config.projectName,
        daysBack: 30,
        includeWorkItems: true,
        includePullRequests: true,
        includeCommits: true,
        includeBuilds: true,
        maxItems: 50
      });
      setDashboard(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Auto-refresh every 3 min
  useEffect(() => {
    if (!config) return;
    const timer = setInterval(fetchDashboard, 3 * 60 * 1000);
    return () => clearInterval(timer);
  }, [config, fetchDashboard]);

  const handleSaveConfig = useCallback((c: EngineeringConfig) => {
    engineeringService.saveConfig(c);
    setConfig(c);
  }, []);

  // Filtered work items
  const filteredWorkItems = useMemo(() => {
    if (!dashboard?.myWorkItems) return [];
    return dashboard.myWorkItems.filter(item => {
      if (workItemFilter !== 'all' && item.workItemType !== workItemFilter) return false;
      if (workItemSearch && !item.title.toLowerCase().includes(workItemSearch.toLowerCase())) return false;
      return true;
    });
  }, [dashboard?.myWorkItems, workItemFilter, workItemSearch]);

  // Filtered PRs
  const filteredPRs = useMemo(() => {
    if (!dashboard) return { mine: [], review: [] };
    const mine = dashboard.myPullRequests?.filter(pr =>
      !prSearch || pr.title.toLowerCase().includes(prSearch.toLowerCase())
    ) || [];
    const review = dashboard.pullRequestsToReview?.filter(pr =>
      !prSearch || pr.title.toLowerCase().includes(prSearch.toLowerCase())
    ) || [];
    return { mine, review };
  }, [dashboard, prSearch]);

  // Tabs
  const tabs: Tab[] = useMemo(() => [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'work', label: 'My Work', icon: <FileText className="w-4 h-4" />, badge: dashboard?.stats?.openWorkItems },
    { id: 'prs', label: 'Pull Requests', icon: <GitPullRequest className="w-4 h-4" />, badge: (dashboard?.stats?.activePullRequests || 0) + (dashboard?.stats?.pendingReviews || 0) },
    { id: 'commits', label: 'Commits', icon: <GitCommit className="w-4 h-4" />, badge: dashboard?.stats?.commitsThisWeek },
    { id: 'builds', label: 'Builds', icon: <Package className="w-4 h-4" />, badge: dashboard?.stats?.buildsToday },
  ], [dashboard?.stats]);

  // Render
  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading developer dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Developer Toolkit</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {dashboard?.currentUser ? `Welcome, ${dashboard.currentUser.displayName}` : 'Your personal development dashboard'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {timeAgo(lastRefresh.toISOString())}
            </span>
          )}
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={fetchDashboard} className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline">Retry</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={clsx(
                'px-1.5 py-0.5 text-xs rounded-full font-medium',
                activeTab === tab.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Open Work Items" value={dashboard.stats?.openWorkItems || 0} icon={<FileText className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100"
              onClick={() => setActiveTab('work')} />
            <StatCard label="Active PRs" value={dashboard.stats?.activePullRequests || 0} icon={<GitPullRequest className="w-5 h-5 text-green-600" />}
              color="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100"
              onClick={() => { setActiveTab('prs'); setPrFilter('mine'); }} />
            <StatCard label="Pending Reviews" value={dashboard.stats?.pendingReviews || 0} icon={<Eye className="w-5 h-5 text-orange-600" />}
              color="bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100"
              onClick={() => { setActiveTab('prs'); setPrFilter('review'); }} />
            <StatCard label="Commits (Week)" value={dashboard.stats?.commitsThisWeek || 0} icon={<GitCommit className="w-5 h-5 text-purple-600" />}
              color="bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-100"
              onClick={() => setActiveTab('commits')} />
            <StatCard label="Builds Today" value={dashboard.stats?.buildsToday || 0} icon={<Package className="w-5 h-5 text-pink-600" />}
              color="bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800 text-pink-900 dark:text-pink-100"
              onClick={() => setActiveTab('builds')} />
          </div>

          {/* Quick Lists */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Work Items */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Recent Work Items</h3>
                <button onClick={() => setActiveTab('work')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                {dashboard.myWorkItems?.slice(0, 3).map(item => (
                  <WorkItemCard key={item.id} item={item} />
                ))}
                {(!dashboard.myWorkItems || dashboard.myWorkItems.length === 0) && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No work items assigned</p>
                )}
              </div>
            </div>

            {/* Pending Reviews */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Pending Reviews</h3>
                <button onClick={() => { setActiveTab('prs'); setPrFilter('review'); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                {dashboard.pullRequestsToReview?.slice(0, 3).map(pr => (
                  <PullRequestCard key={pr.id} pr={pr} isReview />
                ))}
                {(!dashboard.pullRequestsToReview || dashboard.pullRequestsToReview.length === 0) && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No pending reviews</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'work' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={workItemSearch}
                onChange={e => setWorkItemSearch(e.target.value)}
                placeholder="Search work items..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <select
              value={workItemFilter}
              onChange={e => setWorkItemFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Types</option>
              <option value="Bug">Bugs</option>
              <option value="Task">Tasks</option>
              <option value="User Story">User Stories</option>
              <option value="Feature">Features</option>
            </select>
          </div>

          {/* Work Items Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkItems.map(item => (
              <WorkItemCard key={item.id} item={item} />
            ))}
          </div>
          {filteredWorkItems.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No work items found</p>
          )}
        </div>
      )}

      {activeTab === 'prs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={prSearch}
                onChange={e => setPrSearch(e.target.value)}
                placeholder="Search pull requests..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
              {(['all', 'mine', 'review'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setPrFilter(f)}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    prFilter === f ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'
                  )}
                >
                  {f === 'all' ? 'All' : f === 'mine' ? 'My PRs' : 'To Review'}
                </button>
              ))}
            </div>
          </div>

          {/* PRs Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {(prFilter === 'all' || prFilter === 'mine') && filteredPRs.mine.map(pr => (
              <PullRequestCard key={`mine-${pr.id}`} pr={pr} />
            ))}
            {(prFilter === 'all' || prFilter === 'review') && filteredPRs.review.map(pr => (
              <PullRequestCard key={`review-${pr.id}`} pr={pr} isReview />
            ))}
          </div>
          {filteredPRs.mine.length === 0 && filteredPRs.review.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No pull requests found</p>
          )}
        </div>
      )}

      {activeTab === 'commits' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard?.myCommits?.map(commit => (
              <CommitCard key={commit.commitId} commit={commit} />
            ))}
          </div>
          {(!dashboard?.myCommits || dashboard.myCommits.length === 0) && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No commits found</p>
          )}
        </div>
      )}

      {activeTab === 'builds' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard?.recentBuilds?.map(build => (
              <BuildCard key={build.id} build={build} />
            ))}
          </div>
          {(!dashboard?.recentBuilds || dashboard.recentBuilds.length === 0) && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No builds found</p>
          )}
        </div>
      )}

      {/* Config Dialog */}
      {showConfig && (
        <ConfigDialog config={config} onSave={handleSaveConfig} onClose={() => setShowConfig(false)} />
      )}
    </div>
  );
}
