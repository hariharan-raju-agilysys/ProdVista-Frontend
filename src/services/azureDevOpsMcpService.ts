import api from './api';

// ========================================
// Types
// ========================================

export interface DevOpsOrganization {
  name: string;
  id: string;
  url: string;
}

export interface DevOpsProject {
  name: string;
  id: string;
  description?: string;
  url: string;
}

export interface DevOpsConnection {
  configured: boolean;
  connectionName?: string;
  organizationUrl?: string;
  project?: string;
  lastSync?: string;
  useManagedIdentity?: boolean;
  message?: string;
}

export interface DevOpsWorkItem {
  id: number;
  type: string;
  title: string;
  state: string;
  assignedTo?: string;
  priority?: number;
  severity?: string;
  iteration?: string;
  area?: string;
  createdDate?: string;
  changedDate?: string;
  tags?: string[];
  url: string;
  description?: string;
}

export interface DevOpsIteration {
  path: string;
  name: string;
  startDate?: string;
  finishDate?: string;
  isCurrent: boolean;
}

export interface DevOpsArea {
  path: string;
  name: string;
}

export interface DevOpsRepository {
  id: string;
  name: string;
  defaultBranch: string;
  size: number;
  url: string;
}

export interface DevOpsPullRequest {
  id: number;
  title: string;
  description?: string;
  status: string;
  createdBy: string;
  creationDate: string;
  sourceBranch: string;
  targetBranch: string;
  repository: string;
  isDraft: boolean;
  reviewers?: { name: string; vote: number }[];
  url: string;
}

export interface DevOpsCommit {
  commitId: string;
  shortId: string;
  comment: string;
  author: string;
  authorEmail?: string;
  authorDate: string;
  committer?: string;
  repository: string;
  url: string;
}

export interface DevOpsPipeline {
  id: number;
  name: string;
  folder?: string;
  revision?: number;
}

export interface DevOpsBuildRun {
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  startTime?: string;
  finishTime?: string;
  sourceBranch: string;
  triggeredBy: string;
  url: string;
}

export interface DevOpsAutoSetupRequest {
  organization?: string;
  organizationUrl?: string;
  project: string;
  connectionName?: string;
}

// ========================================
// API Client Functions
// ========================================

/**
 * Auto-discover Azure DevOps organizations accessible to current credentials
 */
export const discoverOrganizations = async (): Promise<{
  success: boolean;
  organizations: DevOpsOrganization[];
  authMethod?: string;
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/discover/organizations');
  return response.data;
};

/**
 * Discover projects within an organization
 */
export const discoverProjects = async (organization: string): Promise<{
  success: boolean;
  organization: string;
  projects: DevOpsProject[];
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/discover/projects', {
    params: { organization }
  });
  return response.data;
};

/**
 * Auto-setup a DevOps connection for the tenant
 */
export const autoSetup = async (request: DevOpsAutoSetupRequest): Promise<{
  success: boolean;
  message: string;
  connectionInfo?: {
    organizationUrl: string;
    project: string;
    iterationCount: number;
    areaCount: number;
    currentIteration?: string;
  };
}> => {
  const response = await api.post('/mcp/devops/auto-setup', request);
  return response.data;
};

/**
 * Get current DevOps configuration status
 */
export const getStatus = async (): Promise<DevOpsConnection> => {
  const response = await api.get('/mcp/devops/status');
  return response.data;
};

// ========================================
// MCP Tools (Work Items, PRs, Commits, etc.)
// ========================================

export interface WorkItemsFilter {
  type?: string;
  state?: string;
  assignedTo?: string;
  iteration?: string;
  area?: string;
  tags?: string;
  limit?: number;
}

/**
 * Get work items with optional filters
 */
export const getWorkItems = async (filter?: WorkItemsFilter): Promise<{
  success: boolean;
  count: number;
  workItems: DevOpsWorkItem[];
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/tools/work-items', { params: filter });
  return response.data;
};

/**
 * Get a single work item by ID
 */
export const getWorkItem = async (id: number): Promise<{
  success: boolean;
  workItem: DevOpsWorkItem;
  message?: string;
}> => {
  const response = await api.get(`/mcp/devops/tools/work-items/${id}`);
  return response.data;
};

/**
 * Get iterations/sprints
 */
export const getIterations = async (includeAll?: boolean): Promise<{
  success: boolean;
  currentIteration?: string;
  iterations: DevOpsIteration[];
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/tools/iterations', {
    params: { includeAll }
  });
  return response.data;
};

/**
 * Get area paths
 */
export const getAreas = async (): Promise<{
  success: boolean;
  areas: DevOpsArea[];
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/tools/areas');
  return response.data;
};

/**
 * Get repositories
 */
export const getRepositories = async (): Promise<{
  success: boolean;
  count: number;
  repositories: DevOpsRepository[];
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/tools/repositories');
  return response.data;
};

export interface PullRequestsFilter {
  repository?: string;
  status?: string;
  limit?: number;
}

/**
 * Get pull requests
 */
export const getPullRequests = async (filter?: PullRequestsFilter): Promise<{
  success: boolean;
  count: number;
  pullRequests: DevOpsPullRequest[];
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/tools/pull-requests', { params: filter });
  return response.data;
};

export interface AllProjectsPullRequestsFilter {
  status?: string;
  limitPerProject?: number;
  createdByEmail?: string;
}

export interface DevOpsPullRequestWithProject extends DevOpsPullRequest {
  project: string;
  createdByEmail?: string;
}

export interface DevOpsConnectionInfo {
  connectionId: string;
  connectionName: string;
  project: string;
  success: boolean;
  prCount: number;
}

/**
 * Get pull requests from ALL configured DevOps connections/projects
 */
export const getPullRequestsFromAllProjects = async (filter?: AllProjectsPullRequestsFilter): Promise<{
  success: boolean;
  totalConnections: number;
  totalPRs: number;
  connections: DevOpsConnectionInfo[];
  pullRequests: DevOpsPullRequestWithProject[];
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/tools/pull-requests/all-projects', { params: filter });
  return response.data;
};

/**
 * Get all configured DevOps connections for the tenant
 */
export const getConnections = async (): Promise<{
  success: boolean;
  count: number;
  connections: {
    id: string;
    name: string;
    project: string;
    organizationUrl: string;
    isActive: boolean;
    lastSync?: string;
  }[];
}> => {
  const response = await api.get('/mcp/devops/connections');
  return response.data;
};

export interface CommitsFilter {
  repository: string;
  days?: number;
  limit?: number;
}

/**
 * Get commits from a repository
 */
export const getCommits = async (filter: CommitsFilter): Promise<{
  success: boolean;
  count: number;
  commits: DevOpsCommit[];
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/tools/commits', { params: filter });
  return response.data;
};

/**
 * Get pipelines or specific pipeline runs
 */
export const getPipelines = async (pipelineId?: number, limit?: number): Promise<{
  success: boolean;
  count?: number;
  pipelines?: DevOpsPipeline[];
  pipeline?: DevOpsPipeline;
  runs?: DevOpsBuildRun[];
  message?: string;
}> => {
  const response = await api.get('/mcp/devops/tools/pipelines', {
    params: { pipelineId, limit }
  });
  return response.data;
};

/**
 * Search work items with natural language
 */
export const searchWorkItems = async (query: string, limit?: number): Promise<{
  success: boolean;
  query: string;
  generatedWiql: string;
  count: number;
  workItems: DevOpsWorkItem[];
  message?: string;
}> => {
  const response = await api.post('/mcp/devops/tools/search', { query, limit });
  return response.data;
};

// Default export for convenience
const azureDevOpsMcpService = {
  discoverOrganizations,
  discoverProjects,
  autoSetup,
  getStatus,
  getWorkItems,
  getWorkItem,
  getIterations,
  getAreas,
  getRepositories,
  getPullRequests,
  getCommits,
  getPipelines,
  searchWorkItems,
};

export default azureDevOpsMcpService;
