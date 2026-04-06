import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MetricCard, StatusBadge } from '../components/MetricCard';
import { ChartCard } from '../components/Charts';
import { 
  GitPullRequest, GitCommit, Code2, Clock, Settings, RefreshCw, 
  X, Filter, ChevronDown, CheckCircle, XCircle, AlertCircle,
  GitBranch, Users, Building2, Loader2, ExternalLink, Maximize2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import engineeringService, { 
  EngineeringDashboardData, EngineeringConfig, 
  AzureDevOpsPullRequest, AzureDevOpsBuild 
} from '../services/engineeringService';
import { CommitsDetailModal, CommitDetail } from '../components/CommitsDetailModal';

export default function EngineeringDashboardV2() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  
  // Config state
  const [config, setConfig] = useState<EngineeringConfig | null>(null);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<EngineeringDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filters
  const [prStatusFilter, setPrStatusFilter] = useState<string>('all');
  const [prRepoFilter, setPrRepoFilter] = useState<string>('all');
  const [prAuthorFilter, setPrAuthorFilter] = useState<string>('all');
  const [buildResultFilter, setBuildResultFilter] = useState<string>('all');

  // PR Detail popup
  const [selectedPR, setSelectedPR] = useState<AzureDevOpsPullRequest | null>(null);
  const [showPRDetail, setShowPRDetail] = useState(false);

  // Commits Detail Modal
  const [showCommitsModal, setShowCommitsModal] = useState(false);

  // Load saved config on mount
  useEffect(() => {
    const savedConfig = engineeringService.getSavedConfig();
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, []);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!config) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await engineeringService.getDashboardData(
        config.organizationUrl, 
        config.projectName, 
        7
      );
      setDashboardData(data);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (config) {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [config, loadDashboardData]);

  // Get unique authors from PRs
  const getUniqueAuthors = () => {
    if (!dashboardData) return [];
    const authors = new Set<string>();
    dashboardData.openPullRequests.forEach(pr => authors.add(pr.createdByName));
    dashboardData.completedPullRequests.forEach(pr => authors.add(pr.createdByName));
    return Array.from(authors).sort();
  };

  // Filter PRs
  const getFilteredPRs = () => {
    if (!dashboardData) return [];
    
    let prs = [...dashboardData.openPullRequests];
    
    if (prStatusFilter === 'completed') {
      prs = [...dashboardData.completedPullRequests];
    } else if (prStatusFilter !== 'all') {
      prs = prs.filter(pr => pr.status.toLowerCase() === prStatusFilter);
    }
    
    if (prRepoFilter !== 'all') {
      prs = prs.filter(pr => pr.repositoryName === prRepoFilter);
    }
    
    if (prAuthorFilter !== 'all') {
      prs = prs.filter(pr => pr.createdByName === prAuthorFilter);
    }
    
    return prs;
  };

  // Filter builds
  const getFilteredBuilds = (): AzureDevOpsBuild[] => {
    if (!dashboardData) return [];
    
    let builds = [...dashboardData.builds];
    
    if (buildResultFilter !== 'all') {
      builds = builds.filter(b => b.result.toLowerCase() === buildResultFilter);
    }
    
    return builds.slice(0, 20);
  };

  // Prepare chart data
  const getPRStatusChartData = () => {
    if (!dashboardData) {
      return {
        labels: ['Active', 'Completed'],
        datasets: [{ data: [0, 0], backgroundColor: ['#3b82f6', '#10b981'] }]
      };
    }
    return {
      labels: ['Active', 'Completed (7d)'],
      datasets: [{
        data: [
          dashboardData.openPullRequests.length, 
          dashboardData.completedPullRequests.length
        ],
        backgroundColor: ['#3b82f6', '#10b981']
      }]
    };
  };

  const getCommitActivityChartData = () => {
    if (!dashboardData || !dashboardData.commits.length) {
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{ label: 'Commits', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: 'rgba(59, 130, 246, 0.8)' }]
      };
    }

    // Group commits by day of week
    const dayMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    dashboardData.commits.forEach(commit => {
      const day = new Date(commit.authorDate).getDay();
      dayMap[day]++;
    });

    return {
      labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      datasets: [{
        label: 'Commits',
        data: [dayMap[0], dayMap[1], dayMap[2], dayMap[3], dayMap[4], dayMap[5], dayMap[6]],
        backgroundColor: 'rgba(59, 130, 246, 0.8)'
      }]
    };
  };

  const getBuildTrendChartData = () => {
    if (!dashboardData || !dashboardData.builds.length) {
      return {
        labels: [],
        datasets: [
          { label: 'Successful', data: [], borderColor: 'rgb(34, 197, 94)', backgroundColor: 'rgba(34, 197, 94, 0.5)' },
          { label: 'Failed', data: [], borderColor: 'rgb(239, 68, 68)', backgroundColor: 'rgba(239, 68, 68, 0.5)' }
        ]
      };
    }

    // Group builds by date
    const dateMap: Record<string, { success: number; failed: number }> = {};
    dashboardData.builds.forEach(build => {
      if (!build.finishTime) return;
      const date = new Date(build.finishTime).toLocaleDateString();
      if (!dateMap[date]) {
        dateMap[date] = { success: 0, failed: 0 };
      }
      if (build.result.toLowerCase() === 'succeeded') {
        dateMap[date].success++;
      } else if (build.result.toLowerCase() === 'failed') {
        dateMap[date].failed++;
      }
    });

    const sortedDates = Object.keys(dateMap).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    ).slice(-7);

    return {
      labels: sortedDates,
      datasets: [
        {
          label: 'Successful',
          data: sortedDates.map(d => dateMap[d].success),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          fill: true
        },
        {
          label: 'Failed',
          data: sortedDates.map(d => dateMap[d].failed),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          fill: true
        }
      ]
    };
  };

  // Get PR vote display
  const getVoteDisplay = (vote: number) => {
    switch (vote) {
      case 10: return { icon: <CheckCircle className="text-green-500" size={16} />, text: 'Approved' };
      case 5: return { icon: <CheckCircle className="text-yellow-500" size={16} />, text: 'Approved with suggestions' };
      case 0: return { icon: <AlertCircle className="text-gray-400" size={16} />, text: 'No vote' };
      case -5: return { icon: <AlertCircle className="text-orange-500" size={16} />, text: 'Waiting' };
      case -10: return { icon: <XCircle className="text-red-500" size={16} />, text: 'Rejected' };
      default: return { icon: <AlertCircle className="text-gray-400" size={16} />, text: 'No vote' };
    }
  };

  // Format time ago
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return `${diffMins}m ago`;
  };

  // Render "not configured" state
  if (!config) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Engineering Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400">Developer & team engineering analytics</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-4">
            <GitBranch className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Azure DevOps Not Connected
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
            Connect your Azure DevOps organization in Settings to view pull requests, builds, commits, and engineering metrics.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 transition-colors"
          >
            <Settings size={16} />
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  // Render dashboard
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Engineering Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <Building2 size={16} />
            {config.organizationUrl.replace('https://dev.azure.com/', '')} / {config.projectName}
            {lastRefresh && (
              <span className="text-xs">• Last updated: {lastRefresh.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Refresh
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}

      {isLoading && !dashboardData ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-500" size={48} />
        </div>
      ) : dashboardData ? (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Open Pull Requests"
              value={dashboardData.stats.openPRs.toString()}
              change={dashboardData.stats.mergedPRsLast7Days}
              changeLabel="merged this week"
              trend="neutral"
              icon={<GitPullRequest size={20} />}
            />
            <MetricCard
              title="Commits (7 days)"
              value={dashboardData.stats.commitsLast7Days.toString()}
              change={dashboardData.stats.commitsToday}
              changeLabel="today"
              trend="up"
              icon={<GitCommit size={20} />}
            />
            <MetricCard
              title="Build Success Rate"
              value={`${dashboardData.stats.buildSuccessRate.toFixed(1)}%`}
              change={dashboardData.stats.successfulBuildsLast7Days}
              changeLabel="successful builds"
              trend={dashboardData.stats.buildSuccessRate >= 90 ? 'up' : 'down'}
              icon={<Code2 size={20} />}
            />
            {isManager && (
              <MetricCard
                title="Avg Build Time"
                value={`${dashboardData.stats.averageBuildTimeMinutes.toFixed(1)} min`}
                change={dashboardData.stats.failedBuildsLast7Days}
                changeLabel="failed builds"
                trend={dashboardData.stats.failedBuildsLast7Days === 0 ? 'up' : 'down'}
                icon={<Clock size={20} />}
              />
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="PR Status Overview" type="doughnut" data={getPRStatusChartData()} />
            <ChartCard title="Commit Activity (This Week)" type="bar" data={getCommitActivityChartData()} />
          </div>

          {isManager && (
            <div className="grid grid-cols-1 gap-6">
              <ChartCard title="Build Trend (Last 7 Days)" type="line" data={getBuildTrendChartData()} />
            </div>
          )}

          {/* Pull Requests Section */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <GitPullRequest size={20} />
                Pull Requests
              </h3>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <select
                  value={prStatusFilter}
                  onChange={(e) => setPrStatusFilter(e.target.value)}
                  className="px-3 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="all">All Active</option>
                  <option value="completed">Completed</option>
                </select>
                <select
                  value={prRepoFilter}
                  onChange={(e) => setPrRepoFilter(e.target.value)}
                  className="px-3 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="all">All Repos</option>
                  {dashboardData.repositories.map(repo => (
                    <option key={repo.id} value={repo.name}>{repo.name}</option>
                  ))}
                </select>
                <select
                  value={prAuthorFilter}
                  onChange={(e) => setPrAuthorFilter(e.target.value)}
                  className="px-3 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="all">All Authors</option>
                  {getUniqueAuthors().map(author => (
                    <option key={author} value={author}>{author}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {getFilteredPRs().map((pr) => (
                <div 
                  key={pr.pullRequestId} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => { setSelectedPR(pr); setShowPRDetail(true); }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <GitBranch size={14} className="text-gray-400" />
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{pr.title}</p>
                      {pr.isDraft && (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded">Draft</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>#{pr.pullRequestId}</span>
                      <span>by {pr.createdByName}</span>
                      <span>{pr.repositoryName}</span>
                      <span>{formatTimeAgo(pr.creationDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Users size={14} className="text-gray-400" />
                      <span className="text-xs text-gray-500">{pr.reviewers.length}</span>
                    </div>
                    <StatusBadge status={
                      pr.status === 'completed' ? 'success' :
                      pr.status === 'abandoned' ? 'error' :
                      pr.status === 'active' ? 'info' : 'neutral'
                    }>
                      {pr.status}
                    </StatusBadge>
                    <ChevronDown size={16} className="text-gray-400" />
                  </div>
                </div>
              ))}
              {getFilteredPRs().length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No pull requests match the current filters
                </div>
              )}
            </div>
          </div>

          {/* Builds & Pipelines Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Builds */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Recent Builds</h3>
                <select
                  value={buildResultFilter}
                  onChange={(e) => setBuildResultFilter(e.target.value)}
                  className="px-3 py-1 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="all">All Results</option>
                  <option value="succeeded">Succeeded</option>
                  <option value="failed">Failed</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {getFilteredBuilds().map((build) => (
                  <div key={build.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{build.definitionName}</p>
                      <p className="text-xs text-gray-500">
                        #{build.buildNumber} • {build.sourceBranch.replace('refs/heads/', '')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {build.durationMinutes.toFixed(1)}m
                      </span>
                      <StatusBadge status={
                        build.result === 'succeeded' ? 'success' :
                        build.result === 'failed' ? 'error' :
                        build.result === 'canceled' ? 'warning' : 'neutral'
                      }>
                        {build.result}
                      </StatusBadge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipelines */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Pipelines</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {dashboardData.pipelines.map((pipeline) => (
                  <div key={pipeline.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{pipeline.name}</p>
                      {pipeline.folder && (
                        <p className="text-xs text-gray-500">{pipeline.folder}</p>
                      )}
                    </div>
                    <a 
                      href={pipeline.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Commits */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <GitCommit size={20} />
                Recent Commits
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">
                  {dashboardData.commits.length}
                </span>
              </h3>
              <button
                onClick={() => setShowCommitsModal(true)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="View All Commits"
              >
                <Maximize2 className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {dashboardData.commits.slice(0, 20).map((commit) => (
                <div key={commit.commitId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer group">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {commit.comment.split('\n')[0]}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="font-mono">{commit.shortCommitId}</span>
                      <span>{commit.authorName}</span>
                      <span>{formatTimeAgo(commit.authorDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-500">+{commit.addedFiles}</span>
                    <span className="text-blue-500">~{commit.editedFiles}</span>
                    <span className="text-red-500">-{commit.deletedFiles}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* PR Detail Modal */}
      {showPRDetail && selectedPR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pull Request Details</h3>
              <button 
                onClick={() => setShowPRDetail(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{selectedPR.title}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  #{selectedPR.pullRequestId} • {selectedPR.repositoryName}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Author:</span>
                  <span className="ml-2 font-medium">{selectedPR.createdByName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2 font-medium">{new Date(selectedPR.creationDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Source:</span>
                  <span className="ml-2 font-mono text-xs">{selectedPR.sourceBranch}</span>
                </div>
                <div>
                  <span className="text-gray-500">Target:</span>
                  <span className="ml-2 font-mono text-xs">{selectedPR.targetBranch}</span>
                </div>
              </div>

              {selectedPR.description && (
                <div>
                  <h5 className="font-medium mb-2">Description</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {selectedPR.description}
                  </p>
                </div>
              )}

              <div>
                <h5 className="font-medium mb-2">Reviewers ({selectedPR.reviewers.length})</h5>
                <div className="space-y-2">
                  {selectedPR.reviewers.map((reviewer, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <div className="flex items-center gap-2">
                        {reviewer.imageUrl && (
                          <img src={reviewer.imageUrl} alt="" className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-sm">{reviewer.displayName}</span>
                        {reviewer.isRequired && (
                          <span className="text-xs text-orange-500">Required</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {getVoteDisplay(reviewer.vote).icon}
                        <span className="text-xs text-gray-500">{getVoteDisplay(reviewer.vote).text}</span>
                      </div>
                    </div>
                  ))}
                  {selectedPR.reviewers.length === 0 && (
                    <p className="text-sm text-gray-500">No reviewers assigned</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <a
                  href={selectedPR.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                >
                  <ExternalLink size={16} />
                  Open in Azure DevOps
                </a>
                <button
                  onClick={() => setShowPRDetail(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commits Detail Modal */}
      {dashboardData && (
        <CommitsDetailModal
          commits={dashboardData.commits.map(c => ({
            commitId: c.commitId,
            shortId: c.shortCommitId,
            comment: c.comment,
            authorName: c.authorName,
            authorEmail: '',
            authorDate: c.authorDate,
            repository: '',
            addedFiles: c.addedFiles,
            editedFiles: c.editedFiles,
            deletedFiles: c.deletedFiles,
            url: '',
          } as CommitDetail))}
          isOpen={showCommitsModal}
          onClose={() => setShowCommitsModal(false)}
          title="All Commits"
        />
      )}
    </div>
  );
}
