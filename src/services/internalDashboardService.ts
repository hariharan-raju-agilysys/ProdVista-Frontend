import api from './api';

// ========================================
// Types
// ========================================

export interface RecentPR {
  pullRequestId: number;
  title: string;
  status: string;
  createdBy: string;
  creationDate: string;
  closedDate?: string;
  sourceBranch: string;
  targetBranch: string;
  repositoryName: string;
  url: string;
}

export interface DashboardSummary {
  devops: {
    connected: boolean;
    connectionId?: string;
    totalCommits?: number;
    commitsToday?: number;
    openPRs?: number;
    mergedPRsLast7Days?: number;
    prsWaitingApproval?: number;
    totalRepositories?: number;
    activePipelines?: number;
    buildSuccessRate?: number;
    avgBuildTimeMinutes?: number;
    recentActivity?: {
      prsCreated: number;
      prsCompleted: number;
      recentPRs: RecentPR[];
    };
    todayBuilds?: {
      total: number;
      succeeded: number;
      failed: number;
      inProgress: number;
      builds: BuildInfo[];
    };
  };
  jenkins: {
    connected: boolean;
    connectionName?: string;
    totalJobs?: number;
    successfulJobs?: number;
    failedJobs?: number;
    buildingJobs?: number;
    queuedBuilds?: number;
    onlineNodes?: number;
    totalNodes?: number;
    buildsLast24h?: number;
    healthScore?: number;
    error?: string;
  };
  customers: { total: number };
  team: { totalMembers: number };
  support: { openIncidents: number };
  birthdays: BirthdayInfo[];
  knowledgeSharesCount: number;
  apiCatalogCount: number;
  generatedAt: string;
}

export interface BuildInfo {
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  definitionName: string;
  sourceBranch: string;
  requestedBy: string;
  startTime: string;
  finishTime: string;
  durationMinutes: number;
  url: string;
}

export interface BranchInfo { name: string; objectId: string; }

export interface BranchesResponse {
  repository: string;
  repositoryId: string;
  defaultBranch: string;
  branches: BranchInfo[];
  repositories: { id: string; name: string; defaultBranch: string }[];
}

export interface PRInfo {
  pullRequestId: number;
  title: string;
  status: string;
  createdBy: string;
  creationDate: string;
  sourceBranch: string;
  targetBranch: string;
  repositoryName: string;
  isDraft: boolean;
  commitCount: number;
  commentCount: number;
  reviewerCount: number;
  isApproved: boolean;
  url: string;
}

export interface PRSummaryResponse {
  totalActive: number;
  waitingApproval: number;
  approved: number;
  drafts: number;
  prs: PRInfo[];
}

export interface CommitStatsResponse {
  totalCommits: number;
  totalChanges: number;
  daysBack: number;
  isAllTime: boolean;
  lastCommitDate: string | null;
  repoCount: number;
  byAuthor: { author: string; commits: number; changes: number }[];
  byDay: { date: string; commits: number }[];
  recentCommits: { shortCommitId: string; comment: string; authorName: string; authorDate: string; repositoryName: string }[];
}

export interface BirthdayInfo {
  id: string;
  name: string;
  role?: string;
  department?: string;
  birthday: string;
  daysUntil: number;
  isToday: boolean;
}

export interface TeamMemberInfo {
  id: string;
  name: string;
  email?: string;
  role?: string;
  department?: string;
  birthday?: string;
  isActive: boolean;
}

export interface KnowledgeShareInfo {
  id: string;
  title: string;
  description?: string;
  url?: string;
  category?: string;
  sharedBy?: string;
  sharedDate: string;
  tags?: string;
}

export interface ProductionSupportEntry {
  id: string;
  incidentDate: string;
  title: string;
  description?: string;
  severity?: string;
  status?: string;
  assignedTo?: string;
  resolution?: string;
  tenantAffected?: string;
  propertyAffected?: string;
  resolutionTimeHours?: number;
}

export interface ProductionSupportResponse {
  summary: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    critical: number;
    avgResolutionHours: number;
  };
  entries: ProductionSupportEntry[];
}

export interface ApiCatalogInfo {
  id: string;
  serviceName: string;
  endpoint?: string;
  httpMethod?: string;
  description?: string;
  category?: string;
  version?: string;
  documentationUrl?: string;
  isActive: boolean;
}

export interface CustomerOverviewItem {
  id: string;
  customerId: string;
  customerName: string;
  customerTenantId: string;
  propertyId?: string;
  currentVersion?: string;
  status: string;
  region: string;
  activeUsers: number;
  totalProperties: number;
}

export interface CustomersOverviewResponse {
  total: number;
  saas: { count: number; active: number; customers: CustomerOverviewItem[] };
  onPremise: { count: number; active: number; customers: CustomerOverviewItem[] };
  hybrid: { count: number; active: number; customers: CustomerOverviewItem[] };
}

// ========================================
// API Functions
// ========================================

const BASE = '/internal-dashboard';

export const getSummary = (connectionId?: string) =>
  api.get<DashboardSummary>(`${BASE}/summary${connectionId ? `?connectionId=${connectionId}` : ''}`).then(r => r.data);

export const getBranches = (connectionId?: string, repositoryId?: string) => {
  const p = new URLSearchParams();
  if (connectionId) p.append('connectionId', connectionId);
  if (repositoryId) p.append('repositoryId', repositoryId);
  const qs = p.toString();
  return api.get<BranchesResponse>(`${BASE}/branches${qs ? `?${qs}` : ''}`).then(r => r.data);
};

export const getPRSummary = (connectionId?: string) =>
  api.get<PRSummaryResponse>(`${BASE}/pr-summary${connectionId ? `?connectionId=${connectionId}` : ''}`).then(r => r.data);

export const getCommitStats = (connectionId?: string, daysBack = 7) => {
  const p = new URLSearchParams();
  if (connectionId) p.append('connectionId', connectionId);
  p.append('daysBack', daysBack.toString());
  return api.get<CommitStatsResponse>(`${BASE}/commit-stats?${p.toString()}`).then(r => r.data);
};

export const getTeamMembers = () => api.get<TeamMemberInfo[]>(`${BASE}/team-members`).then(r => r.data);

export const addTeamMember = (data: Omit<TeamMemberInfo, 'id' | 'isActive'>) =>
  api.post(`${BASE}/team-members`, data).then(r => r.data);

export const removeTeamMember = (id: string) => api.delete(`${BASE}/team-members/${id}`);

export const uploadFile = (endpoint: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<{ created: number; errors: number }>(`${BASE}/${endpoint}`, form,
    { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};

export const getKnowledgeShares = (category?: string) =>
  api.get<KnowledgeShareInfo[]>(`${BASE}/knowledge-shares${category ? `?category=${category}` : ''}`).then(r => r.data);

export const addKnowledgeShare = (data: { title: string; description?: string; url?: string; category?: string; tags?: string }) =>
  api.post(`${BASE}/knowledge-shares`, data).then(r => r.data);

export const removeKnowledgeShare = (id: string) => api.delete(`${BASE}/knowledge-shares/${id}`);

export const getProductionSupport = (status?: string, days?: number) => {
  const p = new URLSearchParams();
  if (status) p.append('status', status);
  if (days) p.append('days', days.toString());
  const qs = p.toString();
  return api.get<ProductionSupportResponse>(`${BASE}/production-support${qs ? `?${qs}` : ''}`).then(r => r.data);
};

export const getApiCatalog = (category?: string) =>
  api.get<ApiCatalogInfo[]>(`${BASE}/api-catalog${category ? `?category=${category}` : ''}`).then(r => r.data);

export const addApiCatalogEntry = (data: Omit<ApiCatalogInfo, 'id' | 'isActive'>) =>
  api.post(`${BASE}/api-catalog`, data).then(r => r.data);

export const removeApiCatalogEntry = (id: string) => api.delete(`${BASE}/api-catalog/${id}`);

export const getCustomersOverview = () =>
  api.get<CustomersOverviewResponse>(`${BASE}/customers-overview`).then(r => r.data);

export const downloadTemplate = async (type: 'production-support' | 'team-members' | 'customers') => {
  const res = await api.get(`${BASE}/${type}/template`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}_template.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

// ========================================
// Dashboard Config
// ========================================

export interface WidgetConfig {
  key: string;
  title: string;
  icon: string;
  column: number;
  order: number;
  enabled: boolean;
  size: 'normal' | 'large';
}

export interface MetricConfig {
  key: string;
  label: string;
  color: string;
  order: number;
  enabled: boolean;
}

export interface DashboardConfig {
  id: string;
  configSlug: string;
  displayName: string;
  schemaVersion: number;
  widgets: string; // JSON string — parsed on frontend
  metrics: string; // JSON string
  isActive: boolean;
  lastModifiedBy?: string;
  updatedAt?: string;
}

export const getDashboardConfig = () =>
  api.get<DashboardConfig>(`${BASE}/config`).then(r => r.data);

export const updateDashboardConfig = (data: { displayName?: string; widgets?: string; metrics?: string }) =>
  api.put(`${BASE}/config`, data).then(r => r.data);

export const resetDashboardConfig = () =>
  api.post<DashboardConfig>(`${BASE}/config/reset`).then(r => r.data);

export const parseWidgets = (json: string): WidgetConfig[] => {
  try { return JSON.parse(json); } catch { return []; }
};

export const parseMetrics = (json: string): MetricConfig[] => {
  try { return JSON.parse(json); } catch { return []; }
};

// ========================================
// Jenkins Builds
// ========================================

export interface JenkinsBuildInfo {
  number: number;
  result: string | null;
  building: boolean;
  displayName: string;
  timestamp: number;
  duration: number;
  durationMinutes: number;
}

export interface JenkinsJobInfo {
  name: string;
  fullName: string;
  displayName: string;
  url: string;
  status: string;
  isBuilding: boolean;
  healthScore: number | null;
  healthDescription: string | null;
  lastBuild: JenkinsBuildInfo | null;
  lastSuccessfulBuild: { number: number; timestamp: number } | null;
  builds: JenkinsBuildInfo[];
}

export interface JenkinsBuildsResponse {
  connected: boolean;
  connectionName?: string;
  serverUrl?: string;
  jenkinsVersion?: string;
  totalJobs?: number;
  buildingCount?: number;
  jobs?: JenkinsJobInfo[];
  error?: string;
}

export const getJenkinsBuilds = (jobFilter?: string) => {
  const params = new URLSearchParams();
  if (jobFilter) params.append('jobFilter', jobFilter);
  const qs = params.toString();
  return api.get<JenkinsBuildsResponse>(`${BASE}/jenkins-builds${qs ? `?${qs}` : ''}`).then(r => r.data);
};

// Helpers
export const getSeverityColor = (s?: string) => ({
  Critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  High: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
}[s || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300');

export const getStatusColor = (s?: string) => ({
  Open: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  InProgress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
}[s || ''] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300');
