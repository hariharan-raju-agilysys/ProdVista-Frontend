import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface AppInsightsQuery {
  query: string;
  timeRange: string;
  workspaceId?: string;
  resourceId?: string;
}

export interface SearchContext {
  correlationId?: string;
  operationId?: string;
  requestId?: string;
  errorCode?: string;
  statusCode?: number;
  serviceName?: string;
  region?: string;
  timeRange?: string;
  customQuery?: string;
}

export interface QueryResult {
  success: boolean;
  data: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  generatedKql?: string;
  error?: string;
  portalLink?: string;
}

export interface TraceSpan {
  id: string;
  operationId: string;
  parentId?: string;
  name: string;
  timestamp: string;
  duration: number;
  success: boolean;
  resultCode?: string;
  type: 'request' | 'dependency' | 'trace' | 'exception' | 'customEvent';
  target?: string;
  message?: string;
  severityLevel?: number;
  cloudRoleName: string;
  cloudRoleInstance?: string;
  customDimensions?: Record<string, string>;
}

export interface Operation {
  operationId: string;
  operationName: string;
  timestamp: string;
  duration: number;
  status: 'success' | 'error' | 'warning';
  resultCode: string;
  url?: string;
  serviceName: string;
  region?: string;
  clientIp?: string;
  userId?: string;
  spanCount: number;
  spans?: TraceSpan[];
}

export interface Exception {
  id: string;
  timestamp: string;
  problemId: string;
  type: string;
  message: string;
  outerMessage: string;
  assembly: string;
  method: string;
  severityLevel: number;
  operationId: string;
  cloudRoleName: string;
  stackTrace?: string;
  count: number;
}

export interface Dependency {
  id: string;
  timestamp: string;
  name: string;
  type: string;
  target: string;
  duration: number;
  success: boolean;
  resultCode: string;
  operationId: string;
  cloudRoleName: string;
}

export interface AiQueryInterpretation {
  intent: 'search_by_id' | 'search_errors' | 'performance_analysis' | 'trace_lookup' | 'general_query';
  searchContext: SearchContext;
  suggestedKql: string;
  confidence: number;
  explanation: string;
}

export interface TimeRange {
  label: string;
  value: string;
  duration: string;
}

// ============================================================================
// Constants
// ============================================================================

export const TIME_RANGES: TimeRange[] = [
  { label: 'Last 30 minutes', value: '30m', duration: 'PT30M' },
  { label: 'Last 1 hour', value: '1h', duration: 'PT1H' },
  { label: 'Last 4 hours', value: '4h', duration: 'PT4H' },
  { label: 'Last 12 hours', value: '12h', duration: 'PT12H' },
  { label: 'Last 24 hours', value: '24h', duration: 'P1D' },
  { label: 'Last 7 days', value: '7d', duration: 'P7D' },
  { label: 'Last 30 days', value: '30d', duration: 'P30D' },
];

export const SEVERITY_LEVELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Verbose', color: 'text-gray-400' },
  1: { label: 'Information', color: 'text-blue-400' },
  2: { label: 'Warning', color: 'text-yellow-400' },
  3: { label: 'Error', color: 'text-red-400' },
  4: { label: 'Critical', color: 'text-red-600' },
};

// ============================================================================
// KQL Query Templates
// ============================================================================

export const KQL_TEMPLATES = {
  // Search by IDs
  searchByCorrelationId: (correlationId: string, _timeRange: string) => `
union requests, traces, exceptions, dependencies
| where operation_Id == "${correlationId}" or customDimensions.CorrelationId == "${correlationId}"
| project timestamp, itemType, name, duration, success, resultCode, operation_Id, cloud_RoleName, severityLevel, message
| order by timestamp asc`,

  searchByOperationId: (operationId: string, _timeRange: string) => `
union requests, traces, exceptions, dependencies
| where operation_Id == "${operationId}"
| project timestamp, itemType, name, duration, success, resultCode, cloud_RoleName, severityLevel, message, customDimensions
| order by timestamp asc`,

  searchByRequestId: (requestId: string, _timeRange: string) => `
requests
| where id == "${requestId}" or operation_Id == "${requestId}"
| project timestamp, name, duration, success, resultCode, url, operation_Id, cloud_RoleName, client_IP, user_Id
| take 100`,

  // Error searches
  searchByErrorCode: (errorCode: string, _timeRange: string) => `
union requests, dependencies
| where resultCode == "${errorCode}" or resultCode contains "${errorCode}"
| summarize count() by name, resultCode, cloud_RoleName, bin(timestamp, 5m)
| order by timestamp desc`,

  searchByStatusCode: (statusCode: number, _timeRange: string) => `
requests
| where toint(resultCode) == ${statusCode}
| project timestamp, name, url, duration, resultCode, operation_Id, cloud_RoleName, client_IP
| order by timestamp desc
| take 200`,

  // Exception queries
  exceptions: (_timeRange: string, service?: string) => {
    const serviceFilter = service ? `| where cloud_RoleName contains "${service}"` : '';
    return `
exceptions
${serviceFilter}
| summarize count() by type, outerMessage, problemId, cloud_RoleName
| order by count_ desc
| take 100`;
  },

  exceptionDetails: (problemId: string) => `
exceptions
| where problemId == "${problemId}"
| project timestamp, type, message, outerMessage, assembly, method, severityLevel, operation_Id, cloud_RoleName, details
| order by timestamp desc
| take 50`,

  // Performance
  slowRequests: (_timeRange: string, thresholdMs: number = 5000) => `
requests
| where duration > ${thresholdMs}
| project timestamp, name, url, duration, resultCode, operation_Id, cloud_RoleName
| order by duration desc
| take 100`,

  slowDependencies: (_timeRange: string, thresholdMs: number = 3000) => `
dependencies
| where duration > ${thresholdMs}
| project timestamp, name, type, target, duration, resultCode, success, operation_Id, cloud_RoleName
| order by duration desc
| take 100`,

  // Service health
  requestSummary: (_timeRange: string, service?: string) => {
    const serviceFilter = service ? `| where cloud_RoleName contains "${service}"` : '';
    return `
requests
${serviceFilter}
| summarize 
    requests = count(),
    failures = countif(success == false),
    avgDuration = avg(duration),
    p95Duration = percentile(duration, 95),
    p99Duration = percentile(duration, 99)
  by cloud_RoleName, bin(timestamp, 5m)
| order by timestamp desc`;
  },

  dependencyHealth: (_timeRange: string) => `
dependencies
| summarize 
    calls = count(),
    failures = countif(success == false),
    avgDuration = avg(duration)
  by type, target, bin(timestamp, 5m)
| order by timestamp desc`,

  // Trace search
  tracesByMessage: (searchTerm: string, _timeRange: string) => `
traces
| where message contains "${searchTerm}" or customDimensions contains "${searchTerm}"
| project timestamp, message, severityLevel, operation_Id, cloud_RoleName, customDimensions
| order by timestamp desc
| take 200`,

  // Generic operations view
  operations: (_timeRange: string, limit: number = 100) => `
requests
| project 
    operationId = operation_Id,
    operationName = name,
    timestamp,
    duration,
    status = iff(success == true, "success", "error"),
    resultCode,
    url,
    serviceName = cloud_RoleName,
    clientIp = client_IP,
    userId = user_Id
| order by timestamp desc
| take ${limit}`,
};

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Interpret natural language query and extract search context
 */
export async function interpretQuery(userQuery: string): Promise<AiQueryInterpretation> {
  // Pattern matching for common search terms
  const patterns = {
    correlationId: /correlation[_\s-]?id[:\s=]?\s*["']?([a-f0-9-]{36}|[a-f0-9]{32})["']?/i,
    operationId: /operation[_\s-]?id[:\s=]?\s*["']?([a-f0-9-]{36}|[a-f0-9]{32})["']?/i,
    requestId: /request[_\s-]?id[:\s=]?\s*["']?([a-f0-9-]{36}|[a-f0-9]{32})["']?/i,
    errorCode: /(?:error|status)[_\s-]?code[:\s=]?\s*["']?(\d{3})["']?/i,
    statusCode: /(?:http|status)[_\s]?(\d{3})/i,
    guid: /\b([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\b/i,
  };

  const context: SearchContext = {};
  let intent: AiQueryInterpretation['intent'] = 'general_query';
  let confidence = 0.5;
  let explanation = 'General query';

  // Check for correlation ID
  const corrMatch = userQuery.match(patterns.correlationId);
  if (corrMatch) {
    context.correlationId = corrMatch[1];
    intent = 'search_by_id';
    confidence = 0.95;
    explanation = `Searching for correlation ID: ${corrMatch[1]}`;
  }

  // Check for operation ID
  const opMatch = userQuery.match(patterns.operationId);
  if (opMatch) {
    context.operationId = opMatch[1];
    intent = 'search_by_id';
    confidence = 0.95;
    explanation = `Searching for operation ID: ${opMatch[1]}`;
  }

  // Check for request ID
  const reqMatch = userQuery.match(patterns.requestId);
  if (reqMatch) {
    context.requestId = reqMatch[1];
    intent = 'search_by_id';
    confidence = 0.95;
    explanation = `Searching for request ID: ${reqMatch[1]}`;
  }

  // Check for any GUID (might be operation/correlation ID)
  if (!context.correlationId && !context.operationId && !context.requestId) {
    const guidMatch = userQuery.match(patterns.guid);
    if (guidMatch) {
      context.operationId = guidMatch[1];
      intent = 'search_by_id';
      confidence = 0.8;
      explanation = `Found GUID, searching as operation ID: ${guidMatch[1]}`;
    }
  }

  // Check for error codes
  const errMatch = userQuery.match(patterns.errorCode);
  if (errMatch) {
    context.errorCode = errMatch[1];
    context.statusCode = parseInt(errMatch[1], 10);
    intent = 'search_errors';
    confidence = 0.9;
    explanation = `Searching for error code: ${errMatch[1]}`;
  }

  // Check for HTTP status codes
  const statusMatch = userQuery.match(patterns.statusCode);
  if (statusMatch && !context.errorCode) {
    context.statusCode = parseInt(statusMatch[1], 10);
    intent = 'search_errors';
    confidence = 0.85;
    explanation = `Searching for HTTP status: ${statusMatch[1]}`;
  }

  // Check for error-related keywords
  if (/\b(error|exception|fail|crash|500|404|503|timeout)\b/i.test(userQuery)) {
    if (!context.statusCode && !context.errorCode) {
      intent = 'search_errors';
      confidence = 0.7;
      explanation = 'Searching for errors and exceptions';
    }
  }

  // Check for performance keywords
  if (/\b(slow|performance|latency|duration|timeout|long[_\s]?running)\b/i.test(userQuery)) {
    intent = 'performance_analysis';
    confidence = 0.8;
    explanation = 'Analyzing performance issues';
  }

  // Generate KQL based on context
  let suggestedKql = '';
  if (context.correlationId) {
    suggestedKql = KQL_TEMPLATES.searchByCorrelationId(context.correlationId, '1h');
  } else if (context.operationId) {
    suggestedKql = KQL_TEMPLATES.searchByOperationId(context.operationId, '1h');
  } else if (context.requestId) {
    suggestedKql = KQL_TEMPLATES.searchByRequestId(context.requestId, '1h');
  } else if (context.statusCode) {
    suggestedKql = KQL_TEMPLATES.searchByStatusCode(context.statusCode, '1h');
  } else if (context.errorCode) {
    suggestedKql = KQL_TEMPLATES.searchByErrorCode(context.errorCode, '1h');
  } else if (intent === 'performance_analysis') {
    suggestedKql = KQL_TEMPLATES.slowRequests('1h', 3000);
  } else if (intent === 'search_errors') {
    if (/\b(exception|exceptions)\b/i.test(userQuery)) {
      suggestedKql = KQL_TEMPLATES.exceptions('1h');
    } else {
      suggestedKql = `
union requests, exceptions
| where success == false or toint(resultCode) >= 400 or itemType == "exception"
| project timestamp, itemType, name, duration, resultCode, operation_Id, cloud_RoleName, type, outerMessage
| order by timestamp desc
| take 100`;
    }
  } else {
    suggestedKql = KQL_TEMPLATES.operations('1h', 50);
  }

  return {
    intent,
    searchContext: context,
    suggestedKql: suggestedKql.trim(),
    confidence,
    explanation,
  };
}

/**
 * Execute KQL query against Azure
 */
export async function executeQuery(
  query: string,
  timeRange: string,
  workspaceId?: string,
  resourceId?: string
): Promise<QueryResult> {
  const response = await api.post<QueryResult>('/appinsights/query', {
    query,
    timeRange,
    workspaceId,
    resourceId,
  });
  return response.data;
}

/**
 * Get operations list (main requests view)
 */
export async function getOperations(
  timeRange: string,
  limit: number = 100,
  filters?: {
    service?: string;
    status?: 'success' | 'error' | 'all';
    minDuration?: number;
  },
  resourceOrWorkspaceId?: string
): Promise<Operation[]> {
  const isResourceId = resourceOrWorkspaceId?.startsWith('/subscriptions/');
  const response = await api.get<{ operations: Operation[] }>('/appinsights/operations', {
    params: {
      timeRange,
      limit,
      ...filters,
      ...(isResourceId ? { resourceId: resourceOrWorkspaceId } : { workspaceId: resourceOrWorkspaceId }),
    },
  });
  return response.data.operations;
}

/**
 * Get trace details for an operation
 */
export async function getTraceDetails(
  operationId: string,
  resourceOrWorkspaceId?: string
): Promise<{ spans: TraceSpan[]; totalDuration: number }> {
  const isResourceId = resourceOrWorkspaceId?.startsWith('/subscriptions/');
  const response = await api.get<{ spans: TraceSpan[]; totalDuration: number }>(
    `/appinsights/traces/${encodeURIComponent(operationId)}`,
    { params: isResourceId ? { resourceId: resourceOrWorkspaceId } : { workspaceId: resourceOrWorkspaceId } }
  );
  return response.data;
}

/**
 * Get exceptions summary
 */
export async function getExceptions(
  timeRange: string,
  service?: string,
  resourceOrWorkspaceId?: string
): Promise<Exception[]> {
  const isResourceId = resourceOrWorkspaceId?.startsWith('/subscriptions/');
  const response = await api.get<{ exceptions: Exception[] }>('/appinsights/exceptions', {
    params: { timeRange, service, ...(isResourceId ? { resourceId: resourceOrWorkspaceId } : { workspaceId: resourceOrWorkspaceId }) },
  });
  return response.data.exceptions;
}

/**
 * Search by any identifier (AI-powered)
 */
export async function searchById(
  identifier: string,
  timeRange: string,
  workspaceId?: string
): Promise<QueryResult> {
  const interpretation = await interpretQuery(identifier);
  return executeQuery(interpretation.suggestedKql, timeRange, workspaceId);
}

export interface AzureResource {
  id: string;
  name: string;
  label?: string;
}

export interface FilteredResources {
  isSetupCompleted: boolean;
  lastSyncedAt?: string;
  subscriptions: AzureResource[];
  workspaces: AzureResource[];
  appInsights: AzureResource[];
}

/**
 * Get all filtered Azure resources (workspaces, App Insights, subscriptions)
 * Uses the cached/filtered endpoint that respects tenant settings
 */
export async function getFilteredResources(): Promise<FilteredResources> {
  const response = await api.get<FilteredResources>('/azure/filtered/all');
  return response.data;
}

/**
 * Get Log Analytics workspaces from filtered resources
 */
export async function getWorkspaces(): Promise<AzureResource[]> {
  const resources = await getFilteredResources();
  return resources.workspaces;
}

/**
 * Get App Insights instances from filtered resources
 */
export async function getAppInsightsInstances(): Promise<AzureResource[]> {
  const resources = await getFilteredResources();
  return resources.appInsights;
}

export default {
  interpretQuery,
  executeQuery,
  getOperations,
  getTraceDetails,
  getExceptions,
  searchById,
  getFilteredResources,
  getAppInsightsInstances,
  getWorkspaces,
  KQL_TEMPLATES,
  TIME_RANGES,
  SEVERITY_LEVELS,
};
