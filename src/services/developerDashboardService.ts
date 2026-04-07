import api from './api';

// =====================================================
// Types matching backend DeveloperDashboardController
// =====================================================

export interface DevOpsUserIdentity {
  id: string;
  displayName: string;
  uniqueName: string;
  imageUrl?: string;
}

export interface AzureDevOpsWorkItem {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  assignedTo?: string;
  createdDate: string;
  changedDate: string;
  priority?: number;
  iterationPath?: string;
  areaPath?: string;
  tags?: string;
  url?: string;
}

export interface AzureDevOpsPullRequest {
  id: number;
  title: string;
  status: string;
  createdBy: string;
  creationDate: string;
  sourceRefName: string;
  targetRefName: string;
  repositoryName: string;
  reviewers: PullRequestReviewer[];
  url?: string;
  isDraft?: boolean;
  mergeStatus?: string;
}

export interface PullRequestReviewer {
  displayName: string;
  uniqueName?: string;
  vote: number;
  isRequired?: boolean;
  imageUrl?: string;
}

export interface CommitInfo {
  commitId: string;
  author: string;
  authorEmail?: string;
  authorDate: string;
  comment: string;
  repositoryName: string;
  url?: string;
  changeCounts?: {
    add: number;
    edit: number;
    delete: number;
  };
}

export interface BuildInfo {
  id: number;
  buildNumber: string;
  definitionName: string;
  status: string;
  result?: string;
  queueTime?: string;
  startTime?: string;
  finishTime?: string;
  requestedBy?: string;
  sourceBranch?: string;
  url?: string;
}

export interface DeveloperDashboard {
  currentUser: DevOpsUserIdentity;
  myWorkItems: AzureDevOpsWorkItem[];
  myPullRequests: AzureDevOpsPullRequest[];
  pullRequestsToReview: AzureDevOpsPullRequest[];
  myCommits: CommitInfo[];
  recentBuilds: BuildInfo[];
  stats: DeveloperStats;
}

export interface DeveloperStats {
  openWorkItems: number;
  activePullRequests: number;
  pendingReviews: number;
  commitsThisWeek: number;
  buildsToday: number;
}

export interface DeveloperDashboardQuery {
  organizationUrl: string;
  projectName: string;
  daysBack?: number;
  includeWorkItems?: boolean;
  includePullRequests?: boolean;
  includeCommits?: boolean;
  includeBuilds?: boolean;
  maxItems?: number;
}

// =====================================================
// Developer Dashboard Service
// =====================================================

class DeveloperDashboardService {
  private baseUrl = '/developer-dashboard';

  /**
   * Get full developer dashboard
   */
  async getDashboard(query: DeveloperDashboardQuery): Promise<DeveloperDashboard> {
    const params = new URLSearchParams();
    params.append('organizationUrl', query.organizationUrl);
    params.append('projectName', query.projectName);
    if (query.daysBack) params.append('daysBack', query.daysBack.toString());
    if (query.includeWorkItems !== undefined) params.append('includeWorkItems', query.includeWorkItems.toString());
    if (query.includePullRequests !== undefined) params.append('includePullRequests', query.includePullRequests.toString());
    if (query.includeCommits !== undefined) params.append('includeCommits', query.includeCommits.toString());
    if (query.includeBuilds !== undefined) params.append('includeBuilds', query.includeBuilds.toString());
    if (query.maxItems) params.append('maxItems', query.maxItems.toString());

    const response = await api.get<DeveloperDashboard>(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  /**
   * Get current user identity
   */
  async getCurrentUser(organizationUrl: string): Promise<DevOpsUserIdentity> {
    const response = await api.get<DevOpsUserIdentity>(
      `${this.baseUrl}/me?organizationUrl=${encodeURIComponent(organizationUrl)}`
    );
    return response.data;
  }

  /**
   * Get work items assigned to current user
   */
  async getMyWorkItems(
    organizationUrl: string,
    projectName: string,
    states?: string[]
  ): Promise<AzureDevOpsWorkItem[]> {
    const params = new URLSearchParams();
    params.append('organizationUrl', organizationUrl);
    params.append('projectName', projectName);
    if (states?.length) params.append('states', states.join(','));

    const response = await api.get<AzureDevOpsWorkItem[]>(`${this.baseUrl}/work-items?${params.toString()}`);
    return response.data;
  }

  /**
   * Get pull requests created by current user
   */
  async getMyPullRequests(
    organizationUrl: string,
    projectName: string,
    status?: string
  ): Promise<AzureDevOpsPullRequest[]> {
    const params = new URLSearchParams();
    params.append('organizationUrl', organizationUrl);
    params.append('projectName', projectName);
    if (status) params.append('status', status);

    const response = await api.get<AzureDevOpsPullRequest[]>(`${this.baseUrl}/pull-requests/mine?${params.toString()}`);
    return response.data;
  }

  /**
   * Get pull requests where current user is a reviewer
   */
  async getPullRequestsToReview(
    organizationUrl: string,
    projectName: string
  ): Promise<AzureDevOpsPullRequest[]> {
    const params = new URLSearchParams();
    params.append('organizationUrl', organizationUrl);
    params.append('projectName', projectName);

    const response = await api.get<AzureDevOpsPullRequest[]>(`${this.baseUrl}/pull-requests/to-review?${params.toString()}`);
    return response.data;
  }

  /**
   * Get commits by current user
   */
  async getMyCommits(
    organizationUrl: string,
    projectName: string,
    daysBack: number = 30
  ): Promise<CommitInfo[]> {
    const params = new URLSearchParams();
    params.append('organizationUrl', organizationUrl);
    params.append('projectName', projectName);
    params.append('daysBack', daysBack.toString());

    const response = await api.get<CommitInfo[]>(`${this.baseUrl}/commits?${params.toString()}`);
    return response.data;
  }

  /**
   * Get recent builds
   */
  async getRecentBuilds(
    organizationUrl: string,
    projectName: string,
    top: number = 10
  ): Promise<BuildInfo[]> {
    const params = new URLSearchParams();
    params.append('organizationUrl', organizationUrl);
    params.append('projectName', projectName);
    params.append('top', top.toString());

    const response = await api.get<BuildInfo[]>(`${this.baseUrl}/builds?${params.toString()}`);
    return response.data;
  }
}

const developerDashboardService = new DeveloperDashboardService();
export default developerDashboardService;
