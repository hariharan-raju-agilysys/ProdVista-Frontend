import api from './api';

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

export interface SalesforceConnection {
  id: string;
  connectionName: string;
  instanceUrl: string;
  apiVersion?: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  hasRefreshToken: boolean;
  cachedUserName?: string;
}

export interface CreateSalesforceConnectionRequest {
  connectionName: string;
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  apiVersion?: string;
}

export interface SalesforceTestResult {
  success: boolean;
  message: string;
  userName?: string;
  userEmail?: string;
  organizationId?: string;
}

export interface SalesforceCase {
  id: string;
  caseNumber: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  type?: string;
  reason?: string;
  origin?: string;
  accountName?: string;
  contactName?: string;
  contactEmail?: string;
  ownerName?: string;
  createdDate: string;
  closedDate?: string;
  lastModifiedDate: string;
  isClosed: boolean;
  isEscalated: boolean;
  caseUrl?: string;
}

export interface SalesforceCaseListResponse {
  cases: SalesforceCase[];
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  scope?: string;
  currentUserEmail?: string;
}

export interface SalesforceCaseComment {
  id: string;
  commentBody?: string;
  createdByName?: string;
  createdDate: string;
  isPublished: boolean;
}

export interface SalesforceAccount {
  id: string;
  name: string;
  industry?: string;
  phone?: string;
  website?: string;
  type?: string;
  openCaseCount: number;
}

export interface SalesforceUserIdentity {
  userId: string;
  userName: string;
  displayName: string;
  email: string;
  organizationId?: string;
  profileUrl?: string;
  thumbnailUrl?: string;
}

// ════════════════════════════════════════════════════════════════
// API functions
// ════════════════════════════════════════════════════════════════

const BASE = '/salesforce';

const salesforceService = {
  // ─── Connections ──────────────────────────────────────────────

  async getConnections(): Promise<SalesforceConnection[]> {
    const { data } = await api.get(`${BASE}/connections`);
    return data ?? [];
  },

  async createConnection(req: CreateSalesforceConnectionRequest): Promise<SalesforceConnection> {
    const { data } = await api.post(`${BASE}/connections`, req);
    return data;
  },

  async deleteConnection(id: string): Promise<void> {
    await api.delete(`${BASE}/connections/${id}`);
  },

  async getAuthUrl(connectionId: string, redirectUri: string): Promise<string> {
    const { data } = await api.get(`${BASE}/connections/${connectionId}/auth-url`, {
      params: { redirectUri },
    });
    return data.authorizationUrl;
  },

  async oauthCallback(connectionId: string, code: string, redirectUri: string): Promise<SalesforceTestResult> {
    const { data } = await api.post(`${BASE}/connections/${connectionId}/oauth-callback`, {
      code,
      redirectUri,
      connectionId,
    });
    return data;
  },

  async testConnection(connectionId: string): Promise<SalesforceTestResult> {
    const { data } = await api.post(`${BASE}/connections/${connectionId}/test`);
    return data;
  },

  // ─── Cases (Support Tickets) ──────────────────────────────────

  async getCases(
    connectionId: string,
    params?: {
      scope?: 'mine' | 'all';
      status?: string;
      priority?: string;
      accountName?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<SalesforceCaseListResponse> {
    const { data } = await api.get(`${BASE}/connections/${connectionId}/cases`, { params });
    return data;
  },

  async getCaseById(connectionId: string, caseId: string): Promise<SalesforceCase> {
    const { data } = await api.get(`${BASE}/connections/${connectionId}/cases/${caseId}`);
    return data;
  },

  async getCaseComments(connectionId: string, caseId: string): Promise<SalesforceCaseComment[]> {
    const { data } = await api.get(`${BASE}/connections/${connectionId}/cases/${caseId}/comments`);
    return data ?? [];
  },

  // ─── Accounts ─────────────────────────────────────────────────

  async getAccounts(
    connectionId: string,
    search?: string,
    limit?: number
  ): Promise<SalesforceAccount[]> {
    const { data } = await api.get(`${BASE}/connections/${connectionId}/accounts`, {
      params: { search, limit },
    });
    return data ?? [];
  },

  // ─── Identity ─────────────────────────────────────────────────

  async getIdentity(connectionId: string): Promise<SalesforceUserIdentity> {
    const { data } = await api.get(`${BASE}/connections/${connectionId}/identity`);
    return data;
  },
};

// ════════════════════════════════════════════════════════════════
// Helper utilities
// ════════════════════════════════════════════════════════════════

export function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'high': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
    case 'medium': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20';
    case 'low': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
    case 'critical': return 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20';
    default: return 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800';
  }
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'new': return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
    case 'working':
    case 'in progress': return 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20';
    case 'escalated': return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20';
    case 'closed':
    case 'resolved': return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
    case 'on hold':
    case 'waiting': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20';
    default: return 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800';
  }
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default salesforceService;
