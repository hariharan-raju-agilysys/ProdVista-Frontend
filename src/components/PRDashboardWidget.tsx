import { useEffect, useState, useCallback } from 'react';
import { GitPullRequest, RefreshCw, ExternalLink, GitBranch, User, Clock, AlertCircle, Check, X, MessageSquare, Layers, Maximize2, Eye } from 'lucide-react';
import { getPullRequestsFromAllProjects, DevOpsPullRequestWithProject, DevOpsConnectionInfo } from '../services/azureDevOpsMcpService';
import PRDetailModal, { PullRequestDetail } from './PRDetailModal';

interface PRDashboardWidgetProps {
  currentUserEmail?: string;
  maxItems?: number;
  showAll?: boolean;
}

const getReviewerVoteIcon = (vote: number) => {
  switch (vote) {
    case 10: // Approved
      return <Check className="w-3 h-3 text-green-500" />;
    case 5: // Approved with suggestions
      return <Check className="w-3 h-3 text-blue-500" />;
    case -5: // Waiting for author
      return <Clock className="w-3 h-3 text-yellow-500" />;
    case -10: // Rejected
      return <X className="w-3 h-3 text-red-500" />;
    default: // No vote
      return <MessageSquare className="w-3 h-3 text-gray-400" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    case 'abandoned':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function PRDashboardWidget({ 
  currentUserEmail, 
  maxItems = 10,
  showAll = false 
}: PRDashboardWidgetProps) {
  const [pullRequests, setPullRequests] = useState<DevOpsPullRequestWithProject[]>([]);
  const [connections, setConnections] = useState<DevOpsConnectionInfo[]>([]);
  const [totalConnections, setTotalConnections] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'assigned' | 'created' | 'all'>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedPR, setSelectedPR] = useState<PullRequestDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchPRs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch PRs from ALL configured projects
      const result = await getPullRequestsFromAllProjects({ 
        status: 'active', 
        limitPerProject: maxItems,
        createdByEmail: filter === 'created' ? currentUserEmail : undefined
      });
      
      if (!result.success) {
        setError(result.message || 'Failed to fetch pull requests');
        return;
      }

      if (result.totalConnections === 0) {
        setError('No Azure DevOps connections configured. Please set up connections first.');
        return;
      }

      setConnections(result.connections || []);
      setTotalConnections(result.totalConnections);

      let filteredPRs = result.pullRequests || [];

      // Filter by selected project
      if (selectedProject !== 'all') {
        filteredPRs = filteredPRs.filter(pr => pr.project === selectedProject);
      }

      // Filter based on current user if email is provided
      if (currentUserEmail && !showAll) {
        const userEmail = currentUserEmail.toLowerCase();
        const namePrefix = userEmail.split('@')[0];
        
        if (filter === 'assigned') {
          // PRs where user is a reviewer
          filteredPRs = filteredPRs.filter(pr => 
            pr.reviewers?.some(r => r.name.toLowerCase().includes(namePrefix))
          );
        } else if (filter === 'created') {
          // PRs created by user (already filtered by API if createdByEmail was passed)
          filteredPRs = filteredPRs.filter(pr => 
            pr.createdBy.toLowerCase().includes(namePrefix) ||
            pr.createdByEmail?.toLowerCase().includes(userEmail)
          );
        }
      }

      // Sort by creation date (newest first)
      filteredPRs.sort((a, b) => 
        new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
      );

      // If filtered results are empty, show latest PRs from today
      if (filteredPRs.length === 0 && currentUserEmail && !showAll && filter !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        filteredPRs = (result.pullRequests || []).filter(pr => 
          new Date(pr.creationDate) >= today
        );
        
        // If still empty, show most recent ones
        if (filteredPRs.length === 0) {
          filteredPRs = result.pullRequests?.slice(0, 5) || [];
        }
      }

      setPullRequests(filteredPRs.slice(0, maxItems));
    } catch (err) {
      console.error('Error fetching PRs:', err);
      setError('Failed to connect to Azure DevOps');
    } finally {
      setLoading(false);
    }
  }, [currentUserEmail, maxItems, showAll, filter, selectedProject]);

  useEffect(() => {
    fetchPRs();
  }, [fetchPRs]);

  // Get unique projects for filter dropdown
  const projects = connections
    .filter(c => c.success)
    .map(c => c.project)
    .filter((v, i, a) => a.indexOf(v) === i);

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <GitPullRequest className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Pull Requests</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-gray-500">Loading PRs from {totalConnections || 'all'} projects...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <GitPullRequest className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Pull Requests</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-yellow-600 dark:text-yellow-400">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitPullRequest className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Pull Requests
          </h3>
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 rounded-full">
            {pullRequests.length}
          </span>
          {totalConnections > 1 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {totalConnections} projects
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Project filter dropdown */}
          {projects.length > 1 && (
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border-0 focus:ring-1 focus:ring-purple-500"
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          {/* Filter buttons */}
          {currentUserEmail && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-1 text-xs rounded ${
                  filter === 'all' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('assigned')}
                className={`px-2 py-1 text-xs rounded ${
                  filter === 'assigned' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                To Review
              </button>
              <button
                onClick={() => setFilter('created')}
                className={`px-2 py-1 text-xs rounded ${
                  filter === 'created' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                My PRs
              </button>
            </div>
          )}
          <button
            onClick={fetchPRs}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => {
              // TODO: Navigate to full view page
              // For now, show first PR in modal as example
              if (pullRequests.length > 0) {
                const pr = pullRequests[0];
                setSelectedPR({
                  ...pr,
                  reviews: pr.reviewers,
                } as PullRequestDetail);
                setShowDetailModal(true);
              }
            }}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="View All PRs"
          >
            <Maximize2 className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Connection summary */}
      {connections.length > 0 && (
        <div className="mb-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
          {connections.map(conn => (
            <span 
              key={conn.connectionId}
              className={`px-2 py-0.5 rounded ${
                conn.success 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {conn.project}: {conn.prCount} PRs
            </span>
          ))}
        </div>
      )}

      {/* PR List */}
      {pullRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <GitPullRequest className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No active pull requests</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {pullRequests.map((pr) => (
            <div
              key={pr.id}
              className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-800 transition-colors cursor-pointer group"
              onClick={() => {
                setSelectedPR({
                  ...pr,
                  reviews: pr.reviewers,
                } as PullRequestDetail);
                setShowDetailModal(true);
              }}
            >
              {/* PR Title & Link */}
              <div className="flex items-start justify-between gap-2">
                <span
                  className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 line-clamp-2 flex-1"
                >
                  {pr.title}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPR({
                        ...pr,
                        reviews: pr.reviewers,
                      } as PullRequestDetail);
                      setShowDetailModal(true);
                    }}
                    className="p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0"
                    title="Open in Azure DevOps"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  </a>
                </div>
              </div>

              {/* Branch info */}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                <GitBranch className="w-3 h-3" />
                <span className="truncate max-w-[120px]" title={pr.sourceBranch}>
                  {pr.sourceBranch}
                </span>
                <span>→</span>
                <span className="truncate max-w-[80px]" title={pr.targetBranch}>
                  {pr.targetBranch}
                </span>
              </div>

              {/* Meta info */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{pr.createdBy}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimeAgo(pr.creationDate)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Reviewers */}
                  {pr.reviewers && pr.reviewers.length > 0 && (
                    <div className="flex items-center gap-0.5">
                      {pr.reviewers.slice(0, 3).map((reviewer, idx) => (
                        <div
                          key={idx}
                          className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center"
                          title={`${reviewer.name}: ${getVoteLabel(reviewer.vote)}`}
                        >
                          {getReviewerVoteIcon(reviewer.vote)}
                        </div>
                      ))}
                      {pr.reviewers.length > 3 && (
                        <span className="text-xs text-gray-400">+{pr.reviewers.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Status badge */}
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getStatusColor(pr.status)}`}>
                    {pr.status}
                  </span>

                  {/* Draft indicator */}
                  {pr.isDraft && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 rounded">
                      Draft
                    </span>
                  )}
                </div>
              </div>

              {/* Repository and Project name */}
              <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-2">
                <span>{pr.repository}</span>
                {pr.project && totalConnections > 1 && (
                  <>
                    <span>•</span>
                    <span className="text-purple-500 dark:text-purple-400">{pr.project}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PR Detail Modal */}
      <PRDetailModal
        pr={selectedPR}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPR(null);
        }}
      />
    </div>
  );
}

function getVoteLabel(vote: number): string {
  switch (vote) {
    case 10: return 'Approved';
    case 5: return 'Approved with suggestions';
    case -5: return 'Waiting for author';
    case -10: return 'Rejected';
    default: return 'No vote';
  }
}
