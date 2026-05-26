import api from './api';

export interface DeveloperEfficiencyDto {
  rank: number;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  reportingTo?: string;
  prsMerged: number;
  prsOpen: number;
  commitsCount: number;
  reviewsDone: number;
  bugsResolved: number;
  avgDaysToResolve: number;
  efficiencyScore: number;
}

export interface DirectorSummary {
  employeeId: number;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  reportingTo?: string;
}

export interface DevEfficiencyTeamResponse {
  developers: DeveloperEfficiencyDto[];
  topDevelopers: DeveloperEfficiencyDto[];
  /** Bottom 5 performers by efficiency score (worst-first). Empty when team <= 10. */
  bottomDevelopers: DeveloperEfficiencyDto[];
  totalDevelopers: number;
  totalPrsMerged: number;
  totalCommits: number;
  totalReviews: number;
  totalBugsResolved: number;
  fromDate: string;
  toDate: string;
  connectionName?: string;
  projectName?: string;
  targetBranch?: string;
  warning?: string;
  rootEmployee?: DirectorSummary;
}

export interface DevOpsConnectionSummary {
  id: string;
  connectionName: string;
  projectName: string;
  organizationUrl: string;
}

export interface ReleaseSummary {
  id: string;
  version: string;
  name: string;
  status: string;
  plannedDate?: string;
  actualDate?: string;
}

/** Lightweight employee shape returned by /hierarchy */
export interface HierarchyEmployeeItem {
  employeeId: number;
  name: string;
  email: string;
  department?: string;
  designation?: string;
}

/**
 * Response from GET /api/dev-efficiency/hierarchy
 * Pure HR data — no DevOps calls — designed to be cached on the frontend.
 */
export interface HierarchyResponse {
  rootEmployee?: DirectorSummary;
  /** All leaf-developer emails under the root (lowercased, deduplicated) */
  emails: string[];
  /** Full employee details for the hierarchy */
  employees: HierarchyEmployeeItem[];
  totalCount: number;
}

export interface TrendDataPoint {
  snapshotDate: string;
  prsMerged: number;
  prsOpen: number;
  commitsCount: number;
  reviewsDone: number;
  bugsResolved: number;
  avgDaysToResolve: number;
  efficiencyScore: number;
}

const devEfficiencyService = {
  getTeamEfficiency: (days = 30, connectionId?: string, employeeId?: number, emails?: string[], targetBranch?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (connectionId) params.append('connectionId', connectionId);
    if (employeeId != null) params.append('employeeId', String(employeeId));
    if (emails && emails.length > 0) params.append('emails', emails.join(','));
    if (targetBranch) params.append('targetBranch', targetBranch);
    return api.get<DevEfficiencyTeamResponse>(`/dev-efficiency/team?${params}`);
  },

  getConnections: () =>
    api.get<DevOpsConnectionSummary[]>('/dev-efficiency/connections'),

  getRepositories: (connectionId?: string) => {
    const params = new URLSearchParams();
    if (connectionId) params.append('connectionId', connectionId);
    return api.get<{ id: string; name: string; defaultBranch: string; branches: string[] }[]>(
      `/dev-efficiency/repositories${params.toString() ? `?${params}` : ''}`
    );
  },

  getReleases: () =>
    api.get<ReleaseSummary[]>('/dev-efficiency/releases'),

  getDirectors: () =>
    api.get<DirectorSummary[]>('/dev-efficiency/directors'),

  /**
   * Fetch the full hierarchy for a root employee (or the logged-in manager if no
   * employeeId is provided). Returns a flat email list + employee list.
   * Designed to be called once and cached in devHierarchyStore (30-min TTL).
   */
  getHierarchy: (employeeId?: number) => {
    const params = new URLSearchParams();
    if (employeeId != null) params.append('employeeId', String(employeeId));
    const qs = params.toString();
    return api.get<HierarchyResponse>(`/dev-efficiency/hierarchy${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get the most recent stored snapshot (from daily cron job).
   * Instant loading — no Azure DevOps API calls required.
   */
  getSnapshots: (connectionId?: string, days = 30) => {
    const params = new URLSearchParams({ days: String(days) });
    if (connectionId) params.append('connectionId', connectionId);
    return api.get<DevEfficiencyTeamResponse>(`/dev-efficiency/snapshots?${params}`);
  },

  /**
   * Get historical trend data for a specific developer (for trend charts).
   */
  getTrends: (email: string, connectionId?: string, days = 90) => {
    const params = new URLSearchParams({ email, days: String(days) });
    if (connectionId) params.append('connectionId', connectionId);
    return api.get<TrendDataPoint[]>(`/dev-efficiency/trends?${params}`);
  },
};

export default devEfficiencyService;
