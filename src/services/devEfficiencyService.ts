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
  efficiencyScore: number;
}

export interface DevEfficiencyTeamResponse {
  developers: DeveloperEfficiencyDto[];
  topDevelopers: DeveloperEfficiencyDto[];
  totalDevelopers: number;
  totalPrsMerged: number;
  totalCommits: number;
  totalReviews: number;
  fromDate: string;
  toDate: string;
  connectionName?: string;
  projectName?: string;
  warning?: string;
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

const devEfficiencyService = {
  getTeamEfficiency: (days = 30, connectionId?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (connectionId) params.append('connectionId', connectionId);
    return api.get<DevEfficiencyTeamResponse>(`/dev-efficiency/team?${params}`);
  },

  getConnections: () =>
    api.get<DevOpsConnectionSummary[]>('/dev-efficiency/connections'),

  getReleases: () =>
    api.get<ReleaseSummary[]>('/dev-efficiency/releases'),
};

export default devEfficiencyService;
