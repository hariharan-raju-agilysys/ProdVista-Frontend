import axios from 'axios';
import { API_BASE_PATH } from './api';

const api = axios.create({
  baseURL: `${API_BASE_PATH}/dashboard-overview`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('prodvista_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface DevOpsMetrics {
  connected: boolean;
  openPRs?: number;
  mergedPRsLast7Days?: number;
  commitsToday?: number;
  commitsLast7Days?: number;
  totalRepositories?: number;
  activePipelines?: number;
  buildSuccessRate?: number;
  avgBuildTimeMinutes?: number;
}

export interface BuildTrendItem {
  date: string;
  succeeded: number;
  failed: number;
  total: number;
}

export interface PullRequestItem {
  id: number;
  title: string;
  createdBy: string;
  repo: string;
  sourceBranch: string;
  status: string;
  createdDate: string;
  reviewers?: { displayName: string; vote: number }[];
}

export interface WorkItemMetrics {
  total: number;
  bugs: { total: number; active: number; resolved: number; closed: number };
  features: { total: number; active: number; completed: number };
  stories: { total: number; active: number; completed: number };
  tasks: { total: number; active: number; completed: number };
  byType: Record<string, number>;
  byState: Record<string, number>;
}

export interface DashboardOverviewData {
  devops: DevOpsMetrics;
  workItems: WorkItemMetrics | null;
  buildTrend: BuildTrendItem[] | null;
  pullRequests: PullRequestItem[] | null;
  customers: { total: number };
  team: { totalMembers: number };
  support: { openIncidents: number };
  generatedAt: string;
}

export const dashboardOverviewService = {
  async getOverview(): Promise<DashboardOverviewData> {
    const { data } = await api.get<DashboardOverviewData>('/');
    return data;
  },
};
