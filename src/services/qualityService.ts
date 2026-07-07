import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface QualitySummaryDto {
  totalBugs: number;
  activeBugs: number;
  resolvedBugs: number;
  closedBugs: number;
  criticalBugs: number;
  highBugs: number;
  mediumBugs: number;
  lowBugs: number;
  reopenedBugs: number;
  customerReportedBugs: number;
  avgResolutionDays: number;
  bugEscapeRate: number;
  // All work item type counts
  totalWorkItems: number;
  totalFeatures: number;
  totalUserStories: number;
  totalTasks: number;
  completedItems: number;
  activeItems: number;
  byState: Record<string, number>;
  bySeverity: Record<string, number>;
  byArea: Record<string, number>;
  byIteration: Record<string, number>;
  byType: Record<string, number>;
}

export interface QualityWorkItemDto {
  id: number;
  workItemType: string;
  title: string;
  state: string;
  assignedTo?: string;
  devOwner?: string;
  baOwner?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  severity?: string;
  createdDate?: string;
  resolvedDate?: string;
  closedDate?: string;
  changedDate?: string;
  tags: string[];
  parentId?: number;
  parentTitle?: string;
  parentType?: string;
  customer?: string;
  issueScope?: string;
  project?: string;
  reopenCount: number;
  ageDays: number;
  efficiencyScore?: number;
  devOpsUrl: string;
}

export interface QualityReleaseDto {
  id: string;
  name: string;
  iterationPath: string;
  startDate?: string;
  endDate?: string;
  state: string;
  totalWorkItems: number;
  totalBugs: number;
  resolvedBugs: number;
  activeBugs: number;
  customerIssues: number;
  completionRate: number;
  workItems?: QualityWorkItemDto[];
}

export interface QualityFeatureGroupDto {
  parentId: number;
  parentTitle: string;
  parentType: string;
  state: string;
  assignedTo?: string;
  totalChildItems: number;
  totalBugs: number;
  resolvedBugs: number;
  reopenedBugs: number;
  bugResolutionRate: number;
  avgBugAge: number;
  childItems: QualityWorkItemDto[];
}

export interface CustomerIssueGroupDto {
  customerName: string;
  totalIssues: number;
  activeIssues: number;
  resolvedIssues: number;
  criticalIssues: number;
  avgResolutionDays: number;
  issues: QualityWorkItemDto[];
}

export interface OwnerEfficiencyDto {
  ownerName: string;
  ownerType: string;
  totalAssigned: number;
  resolved: number;
  active: number;
  avgResolutionDays: number;
  efficiencyScore: number;
  
  // Resolver-based metrics (NEW)
  totalResolvedByUser: number;
  reopenedCount: number;
  reopenRate: number;
  resolutionQuality: number;
  
  workItems?: QualityWorkItemDto[];
}

export interface TagSummaryDto {
  tag: string;
  count: number;
}

export interface QualityFilterOptionsDto {
  states: string[];
  severities: string[];
  priorities: string[];
  workItemTypes: string[];
  areaPaths: string[];
  iterationPaths: string[];
  assignedToUsers: string[];
  tags: TagSummaryDto[];
  customers: string[];
  issueScopes: string[];
}

export interface QualityFilterDto {
  organization?: string;
  project?: string;
  state?: string;
  severity?: string;
  priority?: number;
  workItemType?: string;
  areaPath?: string;
  iterationPath?: string;
  assignedTo?: string;
  tag?: string;
  customer?: string;
  issueScope?: string;
  createdAfter?: string;
  createdBefore?: string;
  searchTerm?: string;
  minAgeDays?: number;
  maxAgeDays?: number;
}

export interface WiqlQueryDto {
  wiql: string;
  devOpsUrl: string;
}

export interface QualityTrendPointDto {
  date: string;
  opened: number;
  closed: number;
  reopened: number;
  netChange: number;
  cumulativeActive: number;
}

export interface BugAgingDistributionDto {
  range: string;
  count: number;
  percentage: number;
}

// ============================================================================
// Connection & Iteration Types
// ============================================================================

export interface QualityConnection {
  id: string;
  connectionName: string;
  organizationUrl: string;
  projectName: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
}

export interface QualityIteration {
  id: string;
  name: string;
  path: string;
  startDate?: string;
  finishDate?: string;
  state: 'Past' | 'Current' | 'Future' | 'Unscheduled';
  children?: QualityIteration[]; // Hierarchical child iterations
}

// ============================================================================
// API Functions
// ============================================================================

const buildParams = (connectionId?: string, extra?: Record<string, string | undefined>): string => {
  const p = new URLSearchParams();
  if (connectionId) p.append('connectionId', connectionId);
  if (extra) Object.entries(extra).forEach(([k, v]) => { if (v) p.append(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const getConnections = async (): Promise<QualityConnection[]> => {
  const response = await api.get<QualityConnection[]>('/quality/connections');
  return response.data;
};

export const getIterations = async (connectionId?: string): Promise<QualityIteration[]> => {
  const response = await api.get<QualityIteration[]>(`/quality/iterations${buildParams(connectionId, { scopedIterationsOnly: 'true' })}`);
  return response.data;
};

export const getQualitySummary = async (connectionId?: string, iterationPath?: string): Promise<QualitySummaryDto> => {
  const response = await api.get<QualitySummaryDto>(`/quality/summary${buildParams(connectionId, { iterationPath })}`);
  return response.data;
};

export const getBugs = async (filter?: Partial<QualityFilterDto>, connectionId?: string): Promise<QualityWorkItemDto[]> => {
  const params = new URLSearchParams();
  if (connectionId) params.append('connectionId', connectionId);
  if (filter?.state) params.append('state', filter.state);
  if (filter?.severity) params.append('severity', filter.severity);
  if (filter?.iterationPath) params.append('iterationPath', filter.iterationPath);
  if (filter?.assignedTo) params.append('assignedTo', filter.assignedTo);
  if (filter?.areaPath) params.append('areaPath', filter.areaPath);
  if (filter?.searchTerm) params.append('searchTerm', filter.searchTerm);
  const qs = params.toString();
  const response = await api.get<QualityWorkItemDto[]>(qs ? `/quality/bugs?${qs}` : '/quality/bugs');
  return response.data;
};

export const getMyBugs = async (connectionId?: string, iterationPath?: string, state?: string): Promise<QualityWorkItemDto[]> => {
  const response = await api.get<QualityWorkItemDto[]>(`/quality/my-bugs${buildParams(connectionId, { iterationPath, state })}`);
  return response.data;
};

export const getReleases = async (connectionId?: string): Promise<QualityReleaseDto[]> => {
  const response = await api.get<QualityReleaseDto[]>(`/quality/releases${buildParams(connectionId)}`);
  return response.data;
};

export const getReleaseWorkItems = async (iterationPath: string, connectionId?: string): Promise<QualityWorkItemDto[]> => {
  const response = await api.get<QualityWorkItemDto[]>(`/quality/releases/${encodeURIComponent(iterationPath)}/work-items${buildParams(connectionId)}`);
  return response.data;
};

export const getFeatureGroups = async (iterationPath?: string): Promise<QualityFeatureGroupDto[]> => {
  const url = iterationPath
    ? `/quality/feature-groups?iterationPath=${encodeURIComponent(iterationPath)}`
    : '/quality/feature-groups';
  const response = await api.get<QualityFeatureGroupDto[]>(url);
  return response.data;
};

export const getCustomerIssues = async (groupBy?: string): Promise<CustomerIssueGroupDto[]> => {
  const url = groupBy
    ? `/quality/customer-issues?groupBy=${groupBy}`
    : '/quality/customer-issues';
  try {
    const response = await api.get<CustomerIssueGroupDto[]>(url);
    // Ensure response data is an array
    return Array.isArray(response.data) ? response.data : [];
  } catch {
    // Return empty array on error instead of throwing
    return [];
  }
};

export const getOwnerEfficiency = async (connectionId?: string, iterationPath?: string, emails?: string[]): Promise<OwnerEfficiencyDto[]> => {
  const params: any = { iterationPath };
  if (emails && emails.length > 0) {
    params.emails = emails.join(',');
  }
  const response = await api.get<OwnerEfficiencyDto[]>(`/quality/owner-efficiency${buildParams(connectionId, params)}`);
  return response.data;
};

export const getFilterOptions = async (connectionId?: string): Promise<QualityFilterOptionsDto> => {
  const response = await api.get<QualityFilterOptionsDto>(`/quality/filter-options${buildParams(connectionId)}`);
  return response.data;
};

export const generateQuery = async (filter: QualityFilterDto, connectionId?: string): Promise<WiqlQueryDto> => {
  const response = await api.post<WiqlQueryDto>(`/quality/generate-query${buildParams(connectionId)}`, filter);
  return response.data;
};

export const getTrend = async (days?: number, connectionId?: string, iterationPath?: string): Promise<QualityTrendPointDto[]> => {
  const params = new URLSearchParams();
  if (days) params.append('days', days.toString());
  if (connectionId) params.append('connectionId', connectionId);
  if (iterationPath) params.append('iterationPath', iterationPath);
  const qs = params.toString();
  const response = await api.get<QualityTrendPointDto[]>(qs ? `/quality/trend?${qs}` : '/quality/trend');
  return response.data;
};

export const getAgingDistribution = async (connectionId?: string, iterationPath?: string): Promise<BugAgingDistributionDto[]> => {
  const response = await api.get<BugAgingDistributionDto[]>(`/quality/aging${buildParams(connectionId, { iterationPath })}`);
  return response.data;
};

// ============================================================================
// Bug Analytics API Functions
// ============================================================================

export interface BugAnalyticsFilter {
  connectionId?: string;
  iterationPath?: string;
  areaPath?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AreaBugGroup {
  areaPath: string;
  shortName: string;
  total: number;
  active: number;
  resolved: number;
  critical: number;
  high: number;
  avgAgeDays: number;
}

export interface AreaBugResponse {
  totalBugs: number;
  areas: AreaBugGroup[];
}

export interface DailyTimelinePoint {
  date: string;
  opened: number;
  resolved: number;
  closed: number;
  moved: number;
}

export interface IterationRangeResponse {
  dateFrom: string;
  dateTo: string;
  totalBugs: number;
  active: number;
  resolved: number;
  dailyTimeline: DailyTimelinePoint[];
  bugs: QualityWorkItemDto[];
}

export interface UserAreaActivity {
  area: string;
  count: number;
}

export interface UserBugAnalysis {
  userName: string;
  totalItems: number;
  totalBugs: number;
  activeBugs: number;
  resolvedBugs: number;
  criticalBugs: number;
  highBugs: number;
  features: number;
  tasks: number;
  avgResolutionDays: number;
  resolutionRate: number;
  efficiencyScore: number;
  
  // Resolver-based metrics (NEW)
  totalResolvedByUser: number;
  reopenedCount: number;
  reopenRate: number;
  resolutionQuality: number;
  
  topAreas: UserAreaActivity[];
  recentBugs: QualityWorkItemDto[];
  reopenedBugs: QualityWorkItemDto[]; // NEW
}

export interface UserAnalysisResponse {
  totalUsers: number;
  totalBugs: number;
  totalWorkItems: number;
  users: UserBugAnalysis[];
}

export interface FeatureChildStatus {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  tags: string[];
  totalRelatedBugs: number;
  openBugCount: number;
  resolvedBugCount: number;
  criticalOpenBugs: number;
  hasRisk: boolean;
  openBugs: QualityWorkItemDto[];
  devOpsUrl: string;
}

export interface FeatureChildrenResponse {
  totalFeatures: number;
  featuresWithOpenBugs: number;
  featuresAtRisk: number;
  features: FeatureChildStatus[];
}

export interface DailyVelocityPoint {
  date: string;
  resolved: number;
  closed: number;
  created: number;
}

export interface UserScoreboardEntry {
  userName: string;
  resolved: number;
  avgDays: number;
}

export interface TeamSummaryResponse {
  dateFrom: string;
  dateTo: string;
  totalWorkItems: number;
  totalBugs: number;
  activeBugs: number;
  resolvedBugs: number;
  criticalBugs: number;
  avgResolutionDays: number;
  dailyVelocity: DailyVelocityPoint[];
  userScoreboard: UserScoreboardEntry[];
  byArea: Record<string, number>;
  bySeverity: Record<string, number>;
  byState: Record<string, number>;
}

const buildAnalyticsParams = (filter: BugAnalyticsFilter): string => {
  const p = new URLSearchParams();
  if (filter.connectionId) p.append('connectionId', filter.connectionId);
  if (filter.iterationPath) p.append('iterationPath', filter.iterationPath);
  if (filter.areaPath) p.append('areaPath', filter.areaPath);
  if (filter.dateFrom) p.append('dateFrom', filter.dateFrom);
  if (filter.dateTo) p.append('dateTo', filter.dateTo);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const getBugsByArea = async (filter: BugAnalyticsFilter = {}): Promise<AreaBugResponse> => {
  const response = await api.get<AreaBugResponse>(`/quality/bug-analytics/by-area${buildAnalyticsParams(filter)}`);
  return response.data;
};

export const getIterationRangeBugs = async (filter: BugAnalyticsFilter = {}): Promise<IterationRangeResponse> => {
  const response = await api.get<IterationRangeResponse>(`/quality/bug-analytics/iteration-range${buildAnalyticsParams(filter)}`);
  return response.data;
};

export const getUserBugAnalysis = async (filter: BugAnalyticsFilter = {}): Promise<UserAnalysisResponse> => {
  const response = await api.get<UserAnalysisResponse>(`/quality/bug-analytics/user-analysis${buildAnalyticsParams(filter)}`);
  return response.data;
};

export const getFeatureChildrenStatus = async (filter: BugAnalyticsFilter = {}): Promise<FeatureChildrenResponse> => {
  const response = await api.get<FeatureChildrenResponse>(`/quality/bug-analytics/feature-children${buildAnalyticsParams(filter)}`);
  return response.data;
};

export const getBugDetail = async (workItemId: number, connectionId?: string): Promise<QualityWorkItemDto> => {
  const response = await api.get<QualityWorkItemDto>(`/quality/bug-analytics/detail/${workItemId}${buildParams(connectionId)}`);
  return response.data;
};

export const getTeamSummary = async (filter: BugAnalyticsFilter = {}): Promise<TeamSummaryResponse> => {
  const response = await api.get<TeamSummaryResponse>(`/quality/bug-analytics/team-summary${buildAnalyticsParams(filter)}`);
  return response.data;
};

// ============================================================================
// New Endpoints: Repos, Area Paths, KPI Summary, Bug Detail with Context
// ============================================================================

export interface QualityRepository {
  id: string;
  name: string;
  defaultBranch?: string;
  size?: number;
}

export interface QualityAreaPath {
  id: number;
  name: string;
  path: string;
  shortName: string;
}

export interface KpiSummary {
  totalWorkItems: number;
  totalBugs: number;
  activeBugs: number;
  resolvedBugs: number;
  criticalActive: number;
  features: number;
  userStories: number;
  tasks: number;
  mttr: number;
  resolutionRate: number;
  bugDensity: number;
  weeklyResolved: number;
  weeklyCreated: number;
  bugTrend: number;
  bySeverity: Record<string, number>;
  byState: Record<string, number>;
  byType: Record<string, number>;
  topAreas: { area: string; total: number; active: number; critical: number; avgAge: number }[];
  recentCritical: QualityWorkItemDto[];
}

export interface BugDetailContext {
  bug: QualityWorkItemDto;
  description?: string;
  reproSteps?: string;
  acceptanceCriteria?: string;
  relatedBugsInArea?: QualityWorkItemDto[];
  siblingWorkItems?: QualityWorkItemDto[];
  areaContext: {
    areaPath: string;
    shortName: string;
    totalRelatedBugs: number;
    activeRelated: number;
    criticalRelated: number;
  };
}

// Work Item Relations / Linked Commits
export interface LinkedCommit {
  commitId: string;
  shortCommitId: string;
  comment: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  repositoryId: string;
  additions: number;
  edits: number;
  deletions: number;
}

export interface LinkedPR {
  url: string;
  name: string;
}

export interface WorkItemRelations {
  workItemId: number;
  totalCommits: number;
  commits: LinkedCommit[];
  pullRequestLinks: LinkedPR[];
}

export const getRepositories = async (connectionId?: string): Promise<QualityRepository[]> => {
  const response = await api.get<QualityRepository[]>(`/quality/repositories${buildParams(connectionId)}`);
  return response.data;
};

export const getAreaPaths = async (connectionId?: string): Promise<QualityAreaPath[]> => {
  const response = await api.get<QualityAreaPath[]>(`/quality/area-paths${buildParams(connectionId)}`);
  return response.data;
};

export const getKpiSummary = async (connectionId?: string, areaPath?: string): Promise<KpiSummary> => {
  const response = await api.get<KpiSummary>(`/quality/kpi-summary${buildParams(connectionId, { areaPath })}`);
  return response.data;
};

export const getBugDetailWithContext = async (workItemId: number, connectionId?: string): Promise<BugDetailContext> => {
  const response = await api.get<BugDetailContext>(`/quality/bug-detail/${workItemId}${buildParams(connectionId)}`);
  return response.data;
};

export const getWorkItemCommits = async (workItemId: number, connectionId?: string): Promise<WorkItemRelations> => {
  const response = await api.get<WorkItemRelations>(`/quality/work-item-commits/${workItemId}${buildParams(connectionId)}`);
  return response.data;
};

// ============================================================================
// Team Workload (hierarchy-scoped manager view)
// ============================================================================

export interface TeamWorkloadTypeBucket {
  total: number;
  open?: number;
  closed?: number;
  active?: number;
  completed?: number;
  critical?: number;
  high?: number;
}

export interface TeamWorkloadTypeSummary {
  bugs: TeamWorkloadTypeBucket;
  features: TeamWorkloadTypeBucket;
  userStories: TeamWorkloadTypeBucket;
  tasks: TeamWorkloadTypeBucket;
  changeRequests: TeamWorkloadTypeBucket;
}

export interface TeamWorkloadPersonDto {
  name: string;
  email?: string;
  total: number;
  active: number;
  completed: number;
  completionRate: number;
  openBugs: number;
  criticalBugs: number;
  features: number;
  tasks: number;
  stories: number;
  lastActivity?: string;
}

export interface TeamWorkloadResponse {
  totalWorkItems: number;
  teamSize: number;
  isScoped: boolean;
  typeSummary: TeamWorkloadTypeSummary;
  perPerson: TeamWorkloadPersonDto[];
  activeBugs: QualityWorkItemDto[];
}

export const getTeamWorkload = async (
  connectionId?: string,
  areaPath?: string,
  emails?: string[]
): Promise<TeamWorkloadResponse> => {
  const p = new URLSearchParams();
  if (connectionId) p.append('connectionId', connectionId);
  if (areaPath) p.append('areaPath', areaPath);
  if (emails && emails.length > 0) p.append('emails', emails.join(','));
  const qs = p.toString();
  const response = await api.get<TeamWorkloadResponse>(`/quality/team-workload${qs ? `?${qs}` : ''}`);
  return response.data;
};

// ============================================================================
// Helper Functions
// ============================================================================

export const getSeverityColor = (severity?: string): string => {
  switch (severity) {
    case '1 - Critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case '2 - High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case '3 - Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case '4 - Low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export const getStateColor = (state: string): string => {
  switch (state.toLowerCase()) {
    case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'active': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export const getReleaseStateColor = (state: string): string => {
  switch (state.toLowerCase()) {
    case 'in progress': return 'bg-blue-500';
    case 'completed': return 'bg-green-500';
    case 'future': return 'bg-gray-400';
    default: return 'bg-gray-400';
  }
};

export const getParentTypeColor = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'feature': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'enhancement': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'change request': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300';
    case 'epic': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export const formatDate = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
};

export const getEfficiencyColor = (score: number): string => {
  if (score >= 85) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

export const getCompletionColor = (rate: number): string => {
  if (rate >= 90) return 'bg-green-500';
  if (rate >= 70) return 'bg-yellow-500';
  if (rate >= 50) return 'bg-orange-500';
  return 'bg-red-500';
};

// ============================================================================
// New Unified Dashboard Types
// ============================================================================

export interface BoardSummary {
  totalWorkItems: number;
  byTypeAndState: { workItemType: string; total: number; byState: Record<string, number> }[];
  stateDistribution: Record<string, number>;
  typeCounts: Record<string, number>;
}

export interface FeatureItem {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  priority?: number;
  createdDate?: string;
  tags: string[];
  relatedBugCount: number;
  activeBugs: number;
  resolvedBugs: number;
  devOpsUrl: string;
}

export interface PipelineInfo {
  id: number;
  name: string;
  folder: string;
  url: string;
  latestRunStatus?: string;
  latestRunResult?: string;
  latestRunDate?: string;
}

export interface BuildInfo {
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  definitionName: string;
  definitionId: number;
  sourceBranch: string;
  requestedBy: string;
  requestedByImageUrl: string;
  queueTime?: string;
  startTime?: string;
  finishTime?: string;
  durationMinutes?: number;
  url: string;
  repositoryName: string;
  reason: string;
}

export interface PullRequestInfo {
  pullRequestId: number;
  title: string;
  status: string;
  createdBy: string;
  createdByEmail: string;
  creationDate: string;
  closedDate?: string;
  sourceBranch: string;
  targetBranch: string;
  repositoryName: string;
  url: string;
  isDraft: boolean;
  commitCount: number;
  commentCount: number;
}

export interface SprintWorkItemsResult {
  iterationPath: string;
  totalItems: number;
  completedItems: number;
  completionRate: number;
  byType: { workItemType: string; total: number; items: QualityWorkItemDto[] }[];
  stateDistribution: Record<string, number>;
}

export interface DashboardSummary {
  totalWorkItems: number;
  bugs: { total: number; active: number; resolved: number; closed: number; critical: number; avgAgeDays: number };
  features: { total: number; active: number; completed: number };
  userStories: { total: number; active: number; completed: number };
  tasks: { total: number; active: number; completed: number };
  stateDistribution: Record<string, number>;
  typeCounts: Record<string, number>;
  recentBuilds: BuildInfo[];
  buildSuccessRate: number;
  activePRs: number;
  recentPRs: PullRequestInfo[];
}

// ============================================================================
// New API Functions
// ============================================================================

export const getBoardSummary = async (connectionId?: string, iterationPath?: string): Promise<BoardSummary> => {
  const response = await api.get<BoardSummary>(`/quality/board-summary${buildParams(connectionId, { iterationPath })}`);
  return response.data;
};

export const getFeatures = async (connectionId?: string, iterationPath?: string, state?: string): Promise<FeatureItem[]> => {
  const response = await api.get<FeatureItem[]>(`/quality/features${buildParams(connectionId, { iterationPath, state })}`);
  return response.data;
};

export const getPipelines = async (connectionId?: string): Promise<PipelineInfo[]> => {
  const response = await api.get<PipelineInfo[]>(`/quality/pipelines${buildParams(connectionId)}`);
  return response.data;
};

export const getBuilds = async (connectionId?: string, top?: number): Promise<BuildInfo[]> => {
  const response = await api.get<BuildInfo[]>(`/quality/builds${buildParams(connectionId, { top: top?.toString() })}`);
  return response.data;
};

export const getPullRequests = async (connectionId?: string, status?: string, top?: number): Promise<PullRequestInfo[]> => {
  const response = await api.get<PullRequestInfo[]>(`/quality/pull-requests${buildParams(connectionId, { status, top: top?.toString() })}`);
  return response.data;
};

// ============================================================================
// Today Activity — PRs + Commits grouped by Repo
// ============================================================================

export interface TodayPR {
  pullRequestId: number;
  title: string;
  status: string;
  createdBy: string;
  sourceBranch: string;
  targetBranch: string;
  creationDate: string;
  closedDate?: string;
  isDraft: boolean;
  mergeStatus: string;
}

export interface TodayCommit {
  shortCommitId: string;
  comment: string;
  authorName: string;
  authorDate: string;
  changeCounts: number;
}

export interface TodayActivity {
  date: string;
  scope?: string;
  currentUserEmail?: string;
  pullRequests: {
    activeTotal: number;
    completedToday: number;
    byRepo: {
      repo: string;
      branches: {
        branch: string;
        prs: TodayPR[];
      }[];
    }[];
  };
  commits: {
    totalToday: number;
    totalChanges: number;
    byRepo: {
      repo: string;
      totalCommits: number;
      totalChanges: number;
      authors: {
        author: string;
        commits: TodayCommit[];
      }[];
    }[];
  };
}

export const getTodayActivity = async (connectionId?: string, repositoryIds?: string[], scope?: 'mine' | 'all'): Promise<TodayActivity> => {
  const params = new URLSearchParams();
  if (connectionId) params.append('connectionId', connectionId);
  if (repositoryIds && repositoryIds.length > 0) params.append('repositoryIds', repositoryIds.join(','));
  if (scope) params.append('scope', scope);
  const qs = params.toString();
  const response = await api.get<TodayActivity>(qs ? `/quality/today-activity?${qs}` : '/quality/today-activity');
  return response.data;
};

export const getSprintWorkItems = async (connectionId?: string, iterationPath?: string): Promise<SprintWorkItemsResult> => {
  const response = await api.get<SprintWorkItemsResult>(`/quality/sprint-work-items${buildParams(connectionId, { iterationPath })}`);
  return response.data;
};

export const getDashboardSummary = async (connectionId?: string, iterationPath?: string): Promise<DashboardSummary> => {
  const response = await api.get<DashboardSummary>(`/quality/dashboard-summary${buildParams(connectionId, { iterationPath })}`);
  return response.data;
};

export const getWorkItemTypeIcon = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'bug': return '🐛';
    case 'task': return '📋';
    case 'user story': return '📖';
    case 'feature': return '🚀';
    case 'epic': return '⚡';
    default: return '📌';
  }
};

export const getBuildResultColor = (result: string): string => {
  switch (result?.toLowerCase()) {
    case 'succeeded': return 'text-green-600 dark:text-green-400';
    case 'failed': return 'text-red-600 dark:text-red-400';
    case 'partiallySucceeded': return 'text-yellow-600 dark:text-yellow-400';
    case 'canceled': return 'text-gray-500';
    default: return 'text-gray-500';
  }
};

export const getPRStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'active': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'abandoned': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};
