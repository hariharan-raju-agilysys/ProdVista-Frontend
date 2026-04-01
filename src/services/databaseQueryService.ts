import api from './api';

// ==========================================
// Database Connection Types
// ==========================================

export type ConnectionMethod = 'ConnectionString' | 'IndividualFields';
export type AuthenticationType = 'SqlAuthentication' | 'WindowsAuthentication' | 'AzureActiveDirectory' | 'ManagedIdentity';
export type DatabaseType = 'SqlServer' | 'PostgreSQL' | 'MySQL' | 'Oracle' | 'AzureLogAnalytics';

export interface DatabaseConnection {
  id: string;
  name: string;
  databaseType: string;
  connectionMethod: ConnectionMethod;
  
  // Individual Fields (when using IndividualFields method)
  serverName?: string;
  port?: number;
  databaseName?: string;
  authenticationType: AuthenticationType;
  useEncryption: boolean;
  trustServerCertificate: boolean;
  
  // Azure Log Analytics fields
  workspaceId?: string;
  azureTenantId?: string;
  azureClientId?: string;
  
  // Common fields
  description?: string;
  isActive: boolean;
  lastTestedAt?: string;
  lastTestSuccessful?: boolean;
  connectionTimeoutSeconds: number;
  queryTimeoutSeconds: number;
  createdAt: string;
}

export interface CreateDatabaseConnectionRequest {
  name: string;
  databaseType: string;
  
  /** How to provide connection details: "ConnectionString" or "IndividualFields" */
  connectionMethod: ConnectionMethod;
  
  // ===== Connection String Mode =====
  connectionString?: string;
  
  // ===== Individual Fields Mode (Microsoft-style) =====
  serverName?: string;
  port?: number;
  databaseName?: string;
  authenticationType?: AuthenticationType;
  username?: string;
  password?: string;
  useEncryption?: boolean;
  trustServerCertificate?: boolean;
  additionalOptions?: Record<string, string>;
  
  // ===== Azure Log Analytics specific =====
  workspaceId?: string;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
  
  // ===== Common =====
  description?: string;
  connectionTimeoutSeconds?: number;
  queryTimeoutSeconds?: number;
}

export interface UpdateDatabaseConnectionRequest {
  name?: string;
  connectionMethod?: ConnectionMethod;
  
  // Connection String Mode
  connectionString?: string;
  
  // Individual Fields Mode
  serverName?: string;
  port?: number;
  databaseName?: string;
  authenticationType?: AuthenticationType;
  username?: string;
  password?: string;
  useEncryption?: boolean;
  trustServerCertificate?: boolean;
  additionalOptions?: Record<string, string>;
  
  // Azure Log Analytics
  workspaceId?: string;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
  
  // Common
  description?: string;
  connectionTimeoutSeconds?: number;
  queryTimeoutSeconds?: number;
}

export interface ConnectionTestResult {
  success: boolean;
  testedAt: string;
  message: string;
}

// ==========================================
// Query Configuration Types
// ==========================================

export interface DatabaseQueryConfig {
  id: string;
  name: string;
  description?: string;
  databaseConnectionId: string;
  databaseConnectionName?: string;
  sqlQuery: string;
  refreshType: 'manual' | 'interval' | 'cron';
  refreshIntervalMinutes?: number;
  cronExpression?: string;
  maxRows: number;
  cacheResults: boolean;
  cacheDurationMinutes: number;
  isActive: boolean;
  lastExecutedAt?: string;
  nextExecutionAt?: string;
  lastExecutionStatus?: 'success' | 'failed' | 'running';
  lastExecutionError?: string;
  lastExecutionDurationMs?: number;
  createdAt: string;
}

export interface CreateQueryConfigRequest {
  name: string;
  description?: string;
  databaseConnectionId: string;
  sqlQuery: string;
  refreshType: 'manual' | 'interval' | 'cron';
  refreshIntervalMinutes?: number;
  cronExpression?: string;
  maxRows?: number;
  cacheResults?: boolean;
  cacheDurationMinutes?: number;
}

export interface UpdateQueryConfigRequest {
  name?: string;
  description?: string;
  sqlQuery?: string;
  refreshType?: 'manual' | 'interval' | 'cron';
  refreshIntervalMinutes?: number;
  cronExpression?: string;
  maxRows?: number;
  cacheResults?: boolean;
  cacheDurationMinutes?: number;
  isActive?: boolean;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
}

export interface QueryExecutionResult {
  success: boolean;
  error?: string;
  data: Record<string, unknown>[];
  columns: ColumnInfo[];
  rowCount: number;
  executionDurationMs: number;
  executedAt: string;
}

export interface CachedResult {
  queryConfigId: string;
  data: Record<string, unknown>[];
  columns: ColumnInfo[];
  rowCount: number;
  generatedAt: string;
  expiresAt: string;
  executionDurationMs: number;
}

// ==========================================
// Query Filter & Insights Types
// ==========================================

export interface QueryFilterRequest {
  startDate?: string;
  endDate?: string;
  dateColumn?: string;
  skip?: number;
  take?: number;
  sortColumn?: string;
  sortDescending?: boolean;
  filters?: Record<string, string>;
  summaryOnly?: boolean;
}

export interface MasterDetailSummary {
  totalRecords: number;
  aggregations: Record<string, number>;
  topItems: Record<string, unknown>[];
  summaryDescription: string;
}

export interface DataAnomaly {
  column: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  value?: unknown;
}

export interface DataTrend {
  column: string;
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  description: string;
}

export interface DataInsights {
  summary: string;
  keyFindings: string[];
  anomalies: DataAnomaly[];
  trends: DataTrend[];
  recommendation: string;
}

export interface FilteredQueryResult {
  data: Record<string, unknown>[];
  columns: ColumnInfo[];
  totalCount: number;
  filteredCount: number;
  cachedAt: string;
  expiresAt: string;
  fromCache: boolean;
  summary?: MasterDetailSummary;
  insights?: DataInsights;
}

// ==========================================
// Query Template Types
// ==========================================

export interface QueryTemplate {
  id?: string;
  templateKey: string;
  name: string;
  description: string;
  category: string;
  databaseType: string;
  icon: string;
  recommendedRefreshMinutes: number;
  recommendedCacheMinutes: number;
  isSystemTemplate: boolean;
  displayOrder: number;
  defaultParameters: string;
  columnConfig: string;
}

export interface QueryTemplateDetail extends QueryTemplate {
  sqlQueryTemplate: string;
}

export interface CreateConfigFromTemplateRequest {
  databaseConnectionId: string;
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  refreshType?: string;
  refreshIntervalMinutes?: number;
  maxRows?: number;
  cacheDurationMinutes?: number;
}

export interface CacheStatistics {
  tenantId: string;
  cachedQueries: number;
  totalCachedRows: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
}

// ==========================================
// API Functions - Database Connections
// ==========================================

export const databaseQueryApi = {
  // Database Connections
  getConnections: async (): Promise<DatabaseConnection[]> => {
    const response = await api.get('/databasequeries/connections');
    return response.data;
  },

  getConnection: async (id: string): Promise<DatabaseConnection> => {
    const response = await api.get(`/databasequeries/connections/${id}`);
    return response.data;
  },

  createConnection: async (data: CreateDatabaseConnectionRequest): Promise<DatabaseConnection> => {
    const response = await api.post('/databasequeries/connections', data);
    return response.data;
  },

  updateConnection: async (id: string, data: UpdateDatabaseConnectionRequest): Promise<void> => {
    await api.put(`/databasequeries/connections/${id}`, data);
  },

  deleteConnection: async (id: string): Promise<void> => {
    await api.delete(`/databasequeries/connections/${id}`);
  },

  testConnection: async (id: string): Promise<ConnectionTestResult> => {
    const response = await api.post(`/databasequeries/connections/${id}/test`);
    return response.data;
  },

  // Query Configurations
  getQueryConfigs: async (): Promise<DatabaseQueryConfig[]> => {
    const response = await api.get('/databasequeries/configs');
    return response.data;
  },

  getQueryConfig: async (id: string): Promise<DatabaseQueryConfig> => {
    const response = await api.get(`/databasequeries/configs/${id}`);
    return response.data;
  },

  createQueryConfig: async (data: CreateQueryConfigRequest): Promise<DatabaseQueryConfig> => {
    const response = await api.post('/databasequeries/configs', data);
    return response.data;
  },

  updateQueryConfig: async (id: string, data: UpdateQueryConfigRequest): Promise<void> => {
    await api.put(`/databasequeries/configs/${id}`, data);
  },

  deleteQueryConfig: async (id: string): Promise<void> => {
    await api.delete(`/databasequeries/configs/${id}`);
  },

  executeQuery: async (id: string): Promise<QueryExecutionResult> => {
    const response = await api.post(`/databasequeries/configs/${id}/execute`);
    return response.data;
  },

  getCachedResult: async (id: string): Promise<CachedResult> => {
    const response = await api.get(`/databasequeries/configs/${id}/cache`);
    return response.data;
  },

  // Filtered Results with Date Range Support
  getFilteredResult: async (id: string, filter?: QueryFilterRequest): Promise<FilteredQueryResult> => {
    const response = await api.post(`/databasequeries/configs/${id}/cache/filter`, filter || {});
    return response.data;
  },

  // Query Templates
  getTemplates: async (): Promise<QueryTemplate[]> => {
    const response = await api.get('/databasequeries/templates');
    return response.data;
  },

  getTemplate: async (templateKey: string): Promise<QueryTemplateDetail> => {
    const response = await api.get(`/databasequeries/templates/${templateKey}`);
    return response.data;
  },

  createConfigFromTemplate: async (templateKey: string, data: CreateConfigFromTemplateRequest): Promise<DatabaseQueryConfig> => {
    const response = await api.post(`/databasequeries/templates/${templateKey}/create-config`, data);
    return response.data;
  },

  // Cache Statistics
  getCacheStatistics: async (): Promise<CacheStatistics> => {
    const response = await api.get('/databasequeries/cache/stats');
    return response.data;
  },
};

export default databaseQueryApi;
