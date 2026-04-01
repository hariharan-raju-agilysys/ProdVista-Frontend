import api from './api';

// DTOs matching backend
export interface AzureDevOpsRepository {
  id: string;
  name: string;
  webUrl: string;
  defaultBranch: string;
  projectName: string;
  size: number;
}

export interface AzureDevOpsReviewer {
  displayName: string;
  uniqueName: string;
  imageUrl: string;
  vote: number; // -10 = rejected, 0 = no vote, 5 = approved with suggestions, 10 = approved
  isRequired: boolean;
}

export interface AzureDevOpsPullRequest {
  pullRequestId: number;
  title: string;
  description: string;
  status: string;
  createdByName: string;
  createdByEmail: string;
  createdByAvatar: string;
  creationDate: string;
  closedDate?: string;
  sourceBranch: string;
  targetBranch: string;
  repositoryId: string;
  repositoryName: string;
  url: string;
  isDraft: boolean;
  mergeStatus: string;
  reviewers: AzureDevOpsReviewer[];
}

export interface AzureDevOpsBuild {
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  definitionId: number;
  definitionName: string;
  sourceBranch: string;
  sourceVersion: string;
  requestedByName: string;
  requestedByEmail: string;
  queueTime?: string;
  startTime?: string;
  finishTime?: string;
  durationMinutes: number;
  url: string;
  repositoryId: string;
  repositoryName: string;
  reason: string;
}

export interface AzureDevOpsPipeline {
  id: number;
  name: string;
  folder: string;
  url: string;
  revision: number;
}

export interface AzureDevOpsCommit {
  commitId: string;
  shortCommitId: string;
  comment: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  committerName: string;
  committerEmail: string;
  comitterDate: string;
  url: string;
  addedFiles: number;
  editedFiles: number;
  deletedFiles: number;
}

export interface EngineeringDashboardStats {
  openPRs: number;
  mergedPRsLast7Days: number;
  commitsToday: number;
  commitsLast7Days: number;
  successfulBuildsLast7Days: number;
  failedBuildsLast7Days: number;
  averageBuildTimeMinutes: number;
  buildSuccessRate: number;
  activePipelines: number;
  totalRepositories: number;
}

export interface EngineeringDashboardData {
  repositories: AzureDevOpsRepository[];
  openPullRequests: AzureDevOpsPullRequest[];
  completedPullRequests: AzureDevOpsPullRequest[];
  builds: AzureDevOpsBuild[];
  pipelines: AzureDevOpsPipeline[];
  commits: AzureDevOpsCommit[];
  stats: EngineeringDashboardStats;
  generatedAt: string;
}

export interface EngineeringConfig {
  organizationUrl: string;
  projectName: string;
  projectNames: string[];
  useSprintTracking?: boolean;
  defaultIterationPath?: string;
}

export interface AzureDevOpsWorkItem {
  id: number;
  workItemType: string;
  title: string;
  state: string;
  assignedTo?: string;
  description?: string;
  areaPath?: string;
  iterationPath?: string;
  tags?: string;
  resolvedDate?: string;
  closedDate?: string;
  createdDate?: string;
  changedDate?: string;
  priority?: number;
  severity?: string;
}

export interface AzureDevOpsIterationPath {
  id: number;
  name: string;
  path: string;
  startDate?: string;
  finishDate?: string;
}

export interface DevOpsOverviewData {
  todayWorkItems: AzureDevOpsWorkItem[];
  todayBugs: AzureDevOpsWorkItem[];
  activePullRequests: AzureDevOpsPullRequest[];
  completedPullRequests: AzureDevOpsPullRequest[];
  iterations: AzureDevOpsIterationPath[];
  pullRequestStats: {
    totalActive: number;
    completedToday: number;
    waitingReview: number;
    approved: number;
    drafts: number;
    conflicts: number;
  };
  useSprintTracking: boolean;
  generatedAt: string;
}

// Local storage key for config
const CONFIG_STORAGE_KEY = 'engineering_dashboard_config';

export const engineeringService = {
  // Get saved config from local storage (with backward-compat migration)
  getSavedConfig(): EngineeringConfig | null {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!saved) return null;
    const config = JSON.parse(saved) as EngineeringConfig;
    // Migrate old single-project configs
    if (!config.projectNames || config.projectNames.length === 0) {
      config.projectNames = config.projectName ? [config.projectName] : [];
    }
    if (!config.projectName && config.projectNames.length > 0) {
      config.projectName = config.projectNames[0];
    }
    return config;
  },

  // Save config to local storage
  saveConfig(config: EngineeringConfig): void {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  },

  // Clear saved config
  clearConfig(): void {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  },

  // Get repositories
  async getRepositories(organizationUrl: string, projectName: string): Promise<AzureDevOpsRepository[]> {
    const response = await api.get('/engineering/repositories', {
      params: { organizationUrl, projectName }
    });
    return response.data;
  },

  // Get pull requests
  async getPullRequests(
    organizationUrl: string, 
    projectName: string, 
    repositoryId?: string,
    status?: string,
    top: number = 100
  ): Promise<AzureDevOpsPullRequest[]> {
    const response = await api.get('/engineering/pull-requests', {
      params: { organizationUrl, projectName, repositoryId, status, top }
    });
    return response.data;
  },

  // Get builds
  async getBuilds(
    organizationUrl: string, 
    projectName: string, 
    definitionId?: number,
    status?: string,
    minTime?: string,
    top: number = 100
  ): Promise<AzureDevOpsBuild[]> {
    const response = await api.get('/engineering/builds', {
      params: { organizationUrl, projectName, definitionId, status, minTime, top }
    });
    return response.data;
  },

  // Get pipelines
  async getPipelines(organizationUrl: string, projectName: string): Promise<AzureDevOpsPipeline[]> {
    const response = await api.get('/engineering/pipelines', {
      params: { organizationUrl, projectName }
    });
    return response.data;
  },

  // Get commits
  async getCommits(
    organizationUrl: string, 
    projectName: string, 
    repositoryId: string,
    fromDate?: string,
    top: number = 100
  ): Promise<AzureDevOpsCommit[]> {
    const response = await api.get('/engineering/commits', {
      params: { organizationUrl, projectName, repositoryId, fromDate, top }
    });
    return response.data;
  },

  // Get engineering stats
  async getStats(organizationUrl: string, projectName: string): Promise<EngineeringDashboardStats> {
    const response = await api.get('/engineering/stats', {
      params: { organizationUrl, projectName }
    });
    return response.data;
  },

  // Get full dashboard data (single call for all data)
  async getDashboardData(
    organizationUrl: string, 
    projectName: string, 
    daysBack: number = 7
  ): Promise<EngineeringDashboardData> {
    const response = await api.get('/engineering/dashboard', {
      params: { organizationUrl, projectName, daysBack }
    });
    return response.data;
  },

  // Get iterations for a project
  async getIterations(organizationUrl: string, projectName: string): Promise<AzureDevOpsIterationPath[]> {
    const response = await api.get('/engineering/iterations', {
      params: { organizationUrl, projectName }
    });
    return response.data;
  },

  // Execute WIQL query for work items
  async queryWorkItems(
    organizationUrl: string,
    projectName: string,
    wiql: string,
    top: number = 200
  ): Promise<AzureDevOpsWorkItem[]> {
    const response = await api.post('/engineering/work-items/query', { wiql, top }, {
      params: { organizationUrl, projectName }
    });
    return response.data;
  },

  // Get today's bugs
  async getTodayBugs(
    organizationUrl: string,
    projectName: string,
    iterationPath?: string
  ): Promise<AzureDevOpsWorkItem[]> {
    const response = await api.get('/engineering/work-items/today-bugs', {
      params: { organizationUrl, projectName, iterationPath }
    });
    return response.data;
  },

  // Get work items by iteration
  async getWorkItemsByIteration(
    organizationUrl: string,
    projectName: string,
    iterationPath: string,
    workItemType?: string,
    state?: string
  ): Promise<AzureDevOpsWorkItem[]> {
    const response = await api.get('/engineering/work-items/by-iteration', {
      params: { organizationUrl, projectName, iterationPath, workItemType, state }
    });
    return response.data;
  },

  // Get DevOps overview (work items + PRs + iterations — single call)
  async getOverview(
    organizationUrl: string,
    projectName: string,
    iterationPath?: string,
    useSprintTracking: boolean = false
  ): Promise<DevOpsOverviewData> {
    const response = await api.get('/engineering/overview', {
      params: { organizationUrl, projectName, iterationPath, useSprintTracking }
    });
    return response.data;
  },
};

export default engineeringService;
