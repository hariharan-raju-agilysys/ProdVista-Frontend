import api from './api';

// ============================================================================
// MCP-Style Safe Query Service
// Read-only database and Azure queries with built-in safety guarantees
// ============================================================================

export interface SafeQueryResult {
  success: boolean;
  error?: string;
  warning?: string;
  data: Record<string, unknown>[];
  columns: SafeQueryColumn[];
  rowCount: number;
  executionDurationMs: number;
  executedAt: string;
  metadata: SafeQueryMetadata;
}

export interface SafeQueryColumn {
  name: string;
  dataType: string;
}

export interface SafeQueryMetadata {
  queryType: 'sql' | 'kql';
  noLockApplied: boolean;
  sanitizedQuery?: string;
  validationMessage?: string;
}

export interface SafeQueryValidation {
  isValid: boolean;
  isReadOnly: boolean;
  error?: string;
  warning?: string;
  sanitizedQuery?: string;
  tablesReferenced: string[];
}

export interface SqlQueryRequest {
  connectionString: string;
  query: string;
  timeoutSeconds?: number;
  maxRows?: number;
}

export interface KqlQueryRequest {
  resourceId?: string;
  workspaceId?: string;
  query: string;
  hoursBack?: number;
  maxRows?: number;
}

export interface SafeQueryInfo {
  version: string;
  sqlFeatures: {
    allowedOperations: string[];
    blockedKeywords: string[];
    autoNoLock: boolean;
    maxTimeoutSeconds: number;
    maxRows: number;
  };
  kqlFeatures: {
    allowedOperations: string[];
    blockedCommands: string[];
    validTables: string[];
    maxHoursBack: number;
    maxRows: number;
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Execute a safe SQL query with automatic NOLOCK hints.
 * Only SELECT queries are allowed.
 */
export const executeSafeSqlQuery = async (request: SqlQueryRequest): Promise<SafeQueryResult> => {
  const response = await api.post<SafeQueryResult>('/safe-query/sql', request);
  return response.data;
};

/**
 * Execute a safe KQL query against App Insights or Log Analytics.
 * Only read-only queries are allowed.
 */
export const executeSafeKqlQuery = async (request: KqlQueryRequest): Promise<SafeQueryResult> => {
  const response = await api.post<SafeQueryResult>('/safe-query/kql', request);
  return response.data;
};

/**
 * Validate a SQL query without executing (dry run).
 */
export const validateSqlQuery = async (query: string): Promise<SafeQueryValidation> => {
  const response = await api.post<SafeQueryValidation>('/safe-query/sql/validate', { query });
  return response.data;
};

/**
 * Validate a KQL query without executing (dry run).
 */
export const validateKqlQuery = async (query: string): Promise<SafeQueryValidation> => {
  const response = await api.post<SafeQueryValidation>('/safe-query/kql/validate', { query });
  return response.data;
};

/**
 * Get information about safety features and allowed operations.
 */
export const getSafeQueryInfo = async (): Promise<SafeQueryInfo> => {
  const response = await api.get<SafeQueryInfo>('/safe-query/info');
  return response.data;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a SQL query is safe before sending to API (client-side validation)
 */
export const isQuerySafe = (query: string): { safe: boolean; reason?: string } => {
  const upperQuery = query.toUpperCase().trim();
  
  // Must start with SELECT or WITH
  if (!upperQuery.startsWith('SELECT') && !upperQuery.startsWith('WITH')) {
    return { safe: false, reason: 'Query must start with SELECT or WITH' };
  }
  
  // Check for dangerous keywords
  const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'EXEC', 'EXECUTE'];
  for (const keyword of dangerous) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(query)) {
      return { safe: false, reason: `Query contains forbidden keyword: ${keyword}` };
    }
  }
  
  return { safe: true };
};

/**
 * Format query result for display
 */
export const formatQueryResult = (result: SafeQueryResult): string => {
  if (!result.success) {
    return `Error: ${result.error}`;
  }
  
  let output = `✅ Query executed successfully\n`;
  output += `📊 Rows: ${result.rowCount} | Duration: ${result.executionDurationMs}ms\n`;
  
  if (result.metadata.noLockApplied) {
    output += `🔒 WITH(NOLOCK) automatically applied\n`;
  }
  
  if (result.warning) {
    output += `⚠️ ${result.warning}\n`;
  }
  
  return output;
};

export default {
  executeSafeSqlQuery,
  executeSafeKqlQuery,
  validateSqlQuery,
  validateKqlQuery,
  getSafeQueryInfo,
  isQuerySafe,
  formatQueryResult
};
