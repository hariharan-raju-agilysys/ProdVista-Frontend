import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitPullRequest, GitBranch, Users, Filter, RefreshCw, ExternalLink,
  X, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, AlertTriangle,
  Search, Settings, Loader2, ArrowUpDown, Eye, MessageSquare
} from 'lucide-react';
import engineeringService, {
  AzureDevOpsPullRequest, AzureDevOpsRepository, AzureDevOpsReviewer,
  EngineeringConfig
} from '../services/engineeringService';

type PRStatus = 'all' | 'active' | 'completed' | 'abandoned';
type SortField = 'creationDate' | 'title' | 'author' | 'repository';
type SortDir = 'asc' | 'desc';

// Vote display helper
function getVoteDisplay(vote: number) {
  if (vote === 10) return { icon: <CheckCircle size={14} className="text-green-500" />, text: 'Approved', color: 'text-green-600' };
  if (vote === 5) return { icon: <CheckCircle size={14} className="text-green-400" />, text: 'Approved with suggestions', color: 'text-green-500' };
  if (vote === -10) return { icon: <XCircle size={14} className="text-red-500" />, text: 'Rejected', color: 'text-red-600' };
  if (vote === -5) return { icon: <AlertTriangle size={14} className="text-orange-500" />, text: 'Waiting', color: 'text-orange-500' };
  return { icon: <Clock size={14} className="text-gray-400" />, text: 'No vote', color: 'text-gray-500' };
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Active</span>;
    case 'completed':
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Completed</span>;
    case 'abandoned':
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Abandoned</span>;
    default:
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{status}</span>;
  }
}

function getMergeStatusBadge(mergeStatus: string) {
  switch (mergeStatus) {
    case 'succeeded':
      return <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Merge OK</span>;
    case 'conflicts':
      return <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Conflicts</span>;
    default:
      return null;
  }
}

function ReviewerAvatar({ reviewer }: { reviewer: AzureDevOpsReviewer }) {
  const vote = getVoteDisplay(reviewer.vote);
  return (
    <div className="relative group" title={`${reviewer.displayName}: ${vote.text}`}>
      <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-300 border-2 border-white dark:border-gray-800 overflow-hidden">
        {reviewer.imageUrl ? (
          <img src={reviewer.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          reviewer.displayName?.charAt(0)?.toUpperCase() || '?'
        )}
      </div>
      <div className="absolute -bottom-0.5 -right-0.5">
        {vote.icon}
      </div>
    </div>
  );
}

export default function PullRequestsPage() {
  // Config
  const [config, setConfig] = useState<EngineeringConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configOrgUrl, setConfigOrgUrl] = useState('');
  const [configProject, setConfigProject] = useState('');

  // Data
  const [pullRequests, setPullRequests] = useState<AzureDevOpsPullRequest[]>([]);
  const [repositories, setRepositories] = useState<AzureDevOpsRepository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PRStatus>('active');
  const [repoFilter, setRepoFilter] = useState<string>('all');
  const [authorFilter, setAuthorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('creationDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Detail
  const [selectedPR, setSelectedPR] = useState<AzureDevOpsPullRequest | null>(null);
  const [expandedPRId, setExpandedPRId] = useState<number | null>(null);

  // Load config on mount
  useEffect(() => {
    const saved = engineeringService.getSavedConfig();
    if (saved) {
      setConfig(saved);
      setConfigOrgUrl(saved.organizationUrl);
      setConfigProject(saved.projectName);
    } else {
      setShowConfig(true);
    }
  }, []);

  // Fetch data
  const loadData = useCallback(async () => {
    if (!config) return;
    setIsLoading(true);
    setError(null);

    try {
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const repoParam = repoFilter === 'all' ? undefined : repoFilter;

      const [prs, repos] = await Promise.all([
        engineeringService.getPullRequests(config.organizationUrl, config.projectName, repoParam, statusParam, 200),
        repositories.length > 0
          ? Promise.resolve(repositories)
          : engineeringService.getRepositories(config.organizationUrl, config.projectName)
      ]);

      setPullRequests(prs);
      if (repositories.length === 0) setRepositories(repos);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load pull requests');
    } finally {
      setIsLoading(false);
    }
  }, [config, statusFilter, repoFilter, repositories.length]);

  useEffect(() => {
    if (config) loadData();
  }, [config, statusFilter, repoFilter, loadData]);

  // Auto-refresh every 3 minutes
  useEffect(() => {
    if (!config) return;
    const interval = setInterval(loadData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [config, loadData]);

  // Derived: unique authors
  const uniqueAuthors = useMemo(() => {
    const authors = new Set<string>();
    pullRequests.forEach(pr => authors.add(pr.createdByName));
    return Array.from(authors).sort();
  }, [pullRequests]);

  // Derived: filtered + sorted PRs
  const filteredPRs = useMemo(() => {
    let result = [...pullRequests];

    if (authorFilter !== 'all') {
      result = result.filter(pr => pr.createdByName === authorFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(pr =>
        pr.title.toLowerCase().includes(q) ||
        pr.createdByName.toLowerCase().includes(q) ||
        pr.repositoryName.toLowerCase().includes(q) ||
        `#${pr.pullRequestId}`.includes(q) ||
        pr.sourceBranch.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'creationDate':
          cmp = new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime();
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'author':
          cmp = a.createdByName.localeCompare(b.createdByName);
          break;
        case 'repository':
          cmp = a.repositoryName.localeCompare(b.repositoryName);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [pullRequests, authorFilter, searchQuery, sortField, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const active = pullRequests.filter(pr => pr.status === 'active').length;
    const drafts = pullRequests.filter(pr => pr.isDraft).length;
    const withConflicts = pullRequests.filter(pr => pr.mergeStatus === 'conflicts').length;
    const avgReviewers = pullRequests.length > 0
      ? (pullRequests.reduce((sum, pr) => sum + pr.reviewers.length, 0) / pullRequests.length).toFixed(1)
      : '0';
    return { active, drafts, withConflicts, avgReviewers };
  }, [pullRequests]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const saveConfig = () => {
    if (!configOrgUrl.trim() || !configProject.trim()) return;
    const c = { organizationUrl: configOrgUrl.trim(), projectName: configProject.trim(), projectNames: [configProject.trim()] };
    engineeringService.saveConfig(c);
    setConfig(c);
    setShowConfig(false);
  };

  // ==============================
  // RENDER
  // ==============================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 dark:bg-purple-900/40 rounded-xl">
            <GitPullRequest size={24} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pull Requests</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {config ? `${config.projectName}` : 'Configure your DevOps connection'}
              {lastRefresh && <span className="ml-2">· Updated {formatTimeAgo(lastRefresh.toISOString())}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading || !config}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Config Dialog */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md m-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">DevOps Connection</h3>
              <button onClick={() => config && setShowConfig(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization URL</label>
                <input
                  type="text"
                  value={configOrgUrl}
                  onChange={e => setConfigOrgUrl(e.target.value)}
                  placeholder="https://dev.azure.com/your-org"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name</label>
                <input
                  type="text"
                  value={configProject}
                  onChange={e => setConfigProject(e.target.value)}
                  placeholder="MyProject"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              {config && (
                <button onClick={() => setShowConfig(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
              )}
              <button
                onClick={saveConfig}
                disabled={!configOrgUrl.trim() || !configProject.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Failed to load pull requests</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && pullRequests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 size={32} className="animate-spin text-purple-500" />
          <p className="text-sm text-gray-500">Loading pull requests...</p>
        </div>
      )}

      {/* No Config */}
      {!config && !showConfig && (
        <div className="text-center py-20">
          <GitPullRequest size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Configure your Azure DevOps connection to view pull requests.</p>
          <button onClick={() => setShowConfig(true)} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Configure Connection
          </button>
        </div>
      )}

      {/* Main Content */}
      {config && !isLoading && pullRequests.length === 0 && !error ? (
        <div className="text-center py-20">
          <GitPullRequest size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No pull requests found for the current filters.</p>
        </div>
      ) : config && pullRequests.length > 0 && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</p>
                <GitPullRequest size={16} className="text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{filteredPRs.length}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Active</p>
                <Clock size={16} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.active}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Drafts</p>
                <Eye size={16} className="text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.drafts}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Conflicts</p>
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.withConflicts}</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by title, author, repo, branch, or ID..."
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as PRStatus)}
                  className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="abandoned">Abandoned</option>
                </select>
                <select
                  value={repoFilter}
                  onChange={e => setRepoFilter(e.target.value)}
                  className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="all">All Repositories</option>
                  {repositories.map(repo => (
                    <option key={repo.id} value={repo.id}>{repo.name}</option>
                  ))}
                </select>
                <select
                  value={authorFilter}
                  onChange={e => setAuthorFilter(e.target.value)}
                  className="px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="all">All Authors</option>
                  {uniqueAuthors.map(author => (
                    <option key={author} value={author}>{author}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PR Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_140px_140px_120px_100px_80px] gap-2 px-5 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <button onClick={() => toggleSort('title')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors text-left">
                Pull Request
                {sortField === 'title' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                {sortField !== 'title' && <ArrowUpDown size={12} className="opacity-30" />}
              </button>
              <button onClick={() => toggleSort('author')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                Author
                {sortField === 'author' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </button>
              <button onClick={() => toggleSort('repository')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                Repository
                {sortField === 'repository' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </button>
              <span>Reviewers</span>
              <button onClick={() => toggleSort('creationDate')} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                Created
                {sortField === 'creationDate' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </button>
              <span className="text-center">Status</span>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-[calc(100vh-380px)] overflow-y-auto">
              {filteredPRs.map(pr => (
                <div key={pr.pullRequestId}>
                  <div
                    className="grid grid-cols-[1fr_140px_140px_120px_100px_80px] gap-2 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors items-center"
                    onClick={() => setExpandedPRId(expandedPRId === pr.pullRequestId ? null : pr.pullRequestId)}
                  >
                    {/* Title + Branch */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <GitPullRequest size={16} className={
                          pr.status === 'active' ? 'text-blue-500 shrink-0' :
                          pr.status === 'completed' ? 'text-green-500 shrink-0' :
                          'text-gray-400 shrink-0'
                        } />
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{pr.title}</span>
                        {pr.isDraft && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded shrink-0">
                            Draft
                          </span>
                        )}
                        {getMergeStatusBadge(pr.mergeStatus)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">#{pr.pullRequestId}</span>
                        <GitBranch size={11} className="shrink-0" />
                        <span className="truncate font-mono text-[11px]">{pr.sourceBranch.replace('refs/heads/', '')}</span>
                        <span className="text-gray-300 dark:text-gray-600">→</span>
                        <span className="truncate font-mono text-[11px]">{pr.targetBranch.replace('refs/heads/', '')}</span>
                      </div>
                    </div>

                    {/* Author */}
                    <div className="text-sm text-gray-700 dark:text-gray-300 truncate">{pr.createdByName}</div>

                    {/* Repository */}
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{pr.repositoryName}</div>

                    {/* Reviewers */}
                    <div className="flex items-center -space-x-1.5">
                      {pr.reviewers.slice(0, 4).map((reviewer, idx) => (
                        <ReviewerAvatar key={idx} reviewer={reviewer} />
                      ))}
                      {pr.reviewers.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-[10px] font-medium text-gray-500 dark:text-gray-300 border-2 border-white dark:border-gray-800">
                          +{pr.reviewers.length - 4}
                        </div>
                      )}
                      {pr.reviewers.length === 0 && (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </div>

                    {/* Created */}
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(pr.creationDate)}</div>

                    {/* Status */}
                    <div className="text-center">{getStatusBadge(pr.status)}</div>
                  </div>

                  {/* Expanded Detail */}
                  {expandedPRId === pr.pullRequestId && (
                    <div className="px-5 pb-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        {/* Left: Details */}
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 block">Source Branch</span>
                              <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{pr.sourceBranch.replace('refs/heads/', '')}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 block">Target Branch</span>
                              <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{pr.targetBranch.replace('refs/heads/', '')}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 block">Created</span>
                              <span className="text-xs text-gray-800 dark:text-gray-200">{new Date(pr.creationDate).toLocaleString()}</span>
                            </div>
                            {pr.closedDate && (
                              <div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 block">Closed</span>
                                <span className="text-xs text-gray-800 dark:text-gray-200">{new Date(pr.closedDate).toLocaleString()}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 block">Merge Status</span>
                              <span className="text-xs text-gray-800 dark:text-gray-200">{pr.mergeStatus || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 block">Author Email</span>
                              <span className="text-xs text-gray-800 dark:text-gray-200">{pr.createdByEmail || 'N/A'}</span>
                            </div>
                          </div>

                          {pr.description && (
                            <div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Description</span>
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 max-h-40 overflow-y-auto">
                                {pr.description}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Right: Reviewers */}
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 block mb-2">
                            <Users size={12} className="inline mr-1" />
                            Reviewers ({pr.reviewers.length})
                          </span>
                          <div className="space-y-2">
                            {pr.reviewers.map((reviewer, idx) => {
                              const vote = getVoteDisplay(reviewer.vote);
                              return (
                                <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] overflow-hidden">
                                      {reviewer.imageUrl ? (
                                        <img src={reviewer.imageUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        reviewer.displayName?.charAt(0)?.toUpperCase()
                                      )}
                                    </div>
                                    <span className="text-sm text-gray-800 dark:text-gray-200">{reviewer.displayName}</span>
                                    {reviewer.isRequired && (
                                      <span className="px-1.5 py-0.5 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded">Required</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {vote.icon}
                                    <span className={`text-xs ${vote.color}`}>{vote.text}</span>
                                  </div>
                                </div>
                              );
                            })}
                            {pr.reviewers.length === 0 && (
                              <p className="text-sm text-gray-500 py-2">No reviewers assigned</p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="mt-4 flex gap-2">
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1.5 transition-colors"
                            >
                              <ExternalLink size={14} />
                              Open in Azure DevOps
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filteredPRs.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">No pull requests match the current filters</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Showing {filteredPRs.length} of {pullRequests.length} pull requests</span>
            <span>Avg. {stats.avgReviewers} reviewers per PR</span>
          </div>
        </>
      )}

      {/* PR Detail Modal (for deep-dive) */}
      {selectedPR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedPR(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pull Request Details</h3>
              <button onClick={() => setSelectedPR(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{selectedPR.title}</h4>
              <p className="text-sm text-gray-500">#{selectedPR.pullRequestId} · {selectedPR.repositoryName}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Author:</span> <span className="ml-1 font-medium">{selectedPR.createdByName}</span></div>
                <div><span className="text-gray-500">Created:</span> <span className="ml-1">{new Date(selectedPR.creationDate).toLocaleDateString()}</span></div>
                <div><span className="text-gray-500">Source:</span> <span className="ml-1 font-mono text-xs">{selectedPR.sourceBranch}</span></div>
                <div><span className="text-gray-500">Target:</span> <span className="ml-1 font-mono text-xs">{selectedPR.targetBranch}</span></div>
              </div>
              <div className="pt-4 border-t flex justify-end gap-2">
                <a href={selectedPR.url} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                  <ExternalLink size={16} /> Open in Azure DevOps
                </a>
                <button onClick={() => setSelectedPR(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
