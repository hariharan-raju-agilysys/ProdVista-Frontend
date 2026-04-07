import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

const API_BASE_URL = (import.meta.env.VITE_BASE_PATH || '').replace(/\/$/, '');

// Cache key for Azure auth status (shared with AzureAuthContext)
const AZURE_STATUS_KEY = 'prodvista_azure_status';

// Types
export interface AzureAuthStatus {
  isAuthenticated: boolean;
  method: string;
  message: string;
  user?: { name?: string; email?: string };
  instructions?: string;
}

export interface AzureSubscription {
  subscriptionId: string;
  displayName: string;
  state?: string;
  tenantId?: string;
}

export interface AzureResourceGroup {
  name: string;
  location?: string;
  subscriptionId: string;
}

export interface AzureResource {
  id: string;
  name: string;
  type: string;
  location?: string;
  resourceGroup?: string;
  subscriptionId: string;
  tags?: Record<string, string>;
}

export interface AzureMetricsRequest {
  resourceId: string;
  metricNames?: string[];
  timeSpan?: number; // hours
  granularity?: number; // minutes
}

export interface AzureLogsRequest {
  workspaceId: string;
  query: string;
  timeSpan?: number; // hours
}

export interface AzureDiscoveryUpdate {
  phase: string;
  message: string;
  operationId: string;
  currentItem?: unknown;
  totalSubscriptions: number;
  totalResourceGroups: number;
  totalResources: number;
  isComplete: boolean;
}

export interface AzureAiQueryRequest {
  query: string;
  appInsightsResourceId?: string;
  appInsightsName?: string;
  workspaceId?: string;
  workspaceName?: string;
  subscriptionId?: string;
}

export interface AzureAiQueryResult {
  success: boolean;
  isAzureQuery: boolean;
  queryType?: string;
  serviceName?: string;
  timeRange?: string;
  rowCount: number;
  data?: Record<string, unknown>[];
  generatedKql?: string;
  azurePortalLink?: string;
  formattedResponse?: string;
  error?: string;
  recommendations?: {
    summary?: string;
    items?: Array<{
      title: string;
      description?: string;
      priority: string;
    }>;
  };
}

// Resource Cache Types
export interface AzureSyncResult {
  success: boolean;
  message: string;
  subscriptionsFound: number;
  workspacesFound: number;
  appInsightsFound: number;
  duration?: number;
}

export interface AzureWorkspacesResult {
  success: boolean;
  needsSync: boolean;
  message?: string;
  workspaces?: AzureWorkspaceInfo[];
}

export interface AzureWorkspaceInfo {
  id: string;
  name: string;
  subscriptionId?: string;
  subscriptionName?: string;
  resourceGroup?: string;
  location?: string;
}

export interface AzureAppInsightsResult {
  success: boolean;
  needsSync: boolean;
  message?: string;
  resources?: AzureAppInsightsInfo[];
}

export interface AzureAppInsightsInfo {
  id: string;
  name: string;
  subscriptionId?: string;
  subscriptionName?: string;
  resourceGroup?: string;
  location?: string;
}

export interface AzureCacheStatusResult {
  isCached: boolean;
  isExpired: boolean;
  lastSyncedAt?: string;
  expiresAt?: string;
  subscriptionCount: number;
  workspaceCount: number;
  appInsightsCount: number;
}

// Optimized Cache Types (Resource Graph based)
export interface OptimizedSyncResult {
  success: boolean;
  message?: string;
  error?: string;
  subscriptionsFound: number;
  workspacesFound: number;
  appInsightsFound: number;
  durationMs: number;
}

export interface AzureResourceRef {
  resourceId: string;
  name: string;
  type: string;
  subscriptionId?: string;
  subscriptionName?: string;
  resourceGroup?: string;
  location?: string;
  displayName: string;
}

export interface AzureResourceDetails extends AzureResourceRef {
  kind?: string;
  tags?: Record<string, string>;
  properties?: Record<string, unknown>;
}

export interface UserCacheStatus {
  isCached: boolean;
  lastSyncedAt?: string;
  subscriptionsExpired: boolean;
  resourcesExpired: boolean;
  subscriptionCount: number;
  workspaceCount: number;
  appInsightsCount: number;
}

export interface ResourceGraphQueryResult {
  success: boolean;
  error?: string;
  resultCount: number;
  data?: unknown[];
  durationMs: number;
}

// DevOps Discovery Types
export interface DevOpsDiscoveryResult {
  success: boolean;
  message?: string;
  organizations?: DevOpsOrganizationInfo[];
}

export interface DevOpsOrganizationInfo {
  id: string;
  name: string;
  url: string;
}

export interface DevOpsProjectsResult {
  success: boolean;
  message?: string;
  projects?: DevOpsProjectInfo[];
}

export interface DevOpsProjectInfo {
  id: string;
  name: string;
  description?: string;
  state?: string;
}

export interface DevOpsTestResult {
  success: boolean;
  message: string;
}

// DevOps Analytics Types (OData-based - fast aggregations)
export interface DevOpsBugAnalytics {
  asOf: string;
  totalBugs: number;
  activeBugs: number;
  resolvedBugs: number;
  criticalBugs: number;
  byState: Record<string, number>;
  bySeverity: Record<string, number>;
  trend: DevOpsBugTrendPoint[];
}

export interface DevOpsBugTrendPoint {
  date: string;
  active: number;
  resolved: number;
}

export interface DevOpsWorkItemCounts {
  asOf: string;
  areaPath?: string;
  total: number;
  byType: Record<string, number>;
  byState: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface DevOpsSprintAnalytics {
  iterationPath: string;
  name: string;
  startDate?: string;
  endDate?: string;
  totalItems: number;
  completedItems: number;
  totalBugs: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  completionRate: number;
}

export interface DevOpsPipelineAnalytics {
  asOf: string;
  days: number;
  totalRuns: number;
  overallSuccessRate: number;
  pipelines: DevOpsPipelineStats[];
}

export interface DevOpsPipelineStats {
  name: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  avgDurationSeconds: number;
}

export interface DevOpsPRAnalytics {
  asOf: string;
  days: number;
  totalPRs: number;
  openPRs: number;
  mergedPRs: number;
  abandonedPRs: number;
  mergeRate: number;
  avgCycleTimeHours: number;
}

export interface DevOpsCycleTimeAnalytics {
  asOf: string;
  overallAvgCycleTimeDays: number;
  overallAvgLeadTimeDays: number;
  byType: DevOpsCycleTimeByType[];
}

export interface DevOpsCycleTimeByType {
  workItemType: string;
  avgCycleTimeDays: number;
  avgLeadTimeDays: number;
  completedCount: number;
}

export interface DevOpsWorkItemOData {
  workItemId: number;
  title?: string;
  workItemType?: string;
  state?: string;
  stateCategory?: string;
  severity?: string;
  priority?: number;
  assignedTo?: string;
  areaPath?: string;
  iterationPath?: string;
  createdDate?: string;
  changedDate?: string;
  completedDate?: string;
  cycleTimeDays?: number;
  leadTimeDays?: number;
  tags?: string;
  parentWorkItemId?: number;
}

// Analytics Result Types
export interface DevOpsBugAnalyticsResult {
  success: boolean;
  message?: string;
  data?: DevOpsBugAnalytics;
}

export interface DevOpsWorkItemCountsResult {
  success: boolean;
  message?: string;
  data?: DevOpsWorkItemCounts;
}

export interface DevOpsSprintAnalyticsResult {
  success: boolean;
  message?: string;
  sprints?: DevOpsSprintAnalytics[];
}

export interface DevOpsPipelineAnalyticsResult {
  success: boolean;
  message?: string;
  data?: DevOpsPipelineAnalytics;
}

export interface DevOpsPRAnalyticsResult {
  success: boolean;
  message?: string;
  data?: DevOpsPRAnalytics;
}

export interface DevOpsCycleTimeResult {
  success: boolean;
  message?: string;
  data?: DevOpsCycleTimeAnalytics;
}

export interface DevOpsDashboardAnalyticsResult {
  success: boolean;
  message?: string;
  asOf: string;
  bugs?: DevOpsBugAnalytics;
  workItems?: DevOpsWorkItemCounts;
  sprints?: DevOpsSprintAnalytics[];
  pipelines?: DevOpsPipelineAnalytics;
  prs?: DevOpsPRAnalytics;
  cycleTime?: DevOpsCycleTimeAnalytics;
}

export interface UseAzureHubOptions {
  autoConnect?: boolean;
  onAuthExpired?: (message: string) => void;
  onError?: (error: Error) => void;
}

// Get cached Azure auth status from shared localStorage (same as AzureAuthContext)
function getCachedAzureAuth(): AzureAuthStatus | null {
  try {
    const cached = localStorage.getItem(AZURE_STATUS_KEY);
    if (cached) {
      const status = JSON.parse(cached);
      // Map from AzureAuthContext format to useAzureHub format
      return {
        isAuthenticated: status.authenticated ?? false,
        method: status.method ?? 'None',
        message: status.message ?? '',
        user: status.user,
        instructions: status.instructions
      };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function useAzureHub(options: UseAzureHubOptions = {}) {
  const { autoConnect = true, onAuthExpired, onError } = options;
  
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  // Initialize auth status from shared cache (same source as AzureAuthContext)
  const [authStatus, setAuthStatus] = useState<AzureAuthStatus | null>(() => getCachedAzureAuth());
  const [error, setError] = useState<string | null>(null);
  
  // Operation tracking
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [operationProgress, setOperationProgress] = useState<{
    message: string;
    current?: number;
    total?: number;
  } | null>(null);

  // Build connection
  const buildConnection = useCallback(() => {
    const token = localStorage.getItem('prodvista_auth_token');
    if (!token) {
      setError('No authentication token found');
      return null;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/azure`, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0, 2, 4, 8, 16, 30, 30, 30...
          const delays = [0, 2000, 4000, 8000, 16000, 30000];
          return delays[Math.min(retryContext.previousRetryCount, delays.length - 1)];
        }
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    return connection;
  }, []);

  // Connect to hub
  const connect = useCallback(async () => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const connection = buildConnection();
      if (!connection) return;

      // Set up event handlers
      connection.on('Connected', (data: { authStatus: AzureAuthStatus }) => {
        console.log('AzureHub: Connected', data);
        setAuthStatus(data.authStatus);
      });

      connection.on('AuthExpired', (data: { message: string }) => {
        console.warn('AzureHub: Auth expired', data);
        setAuthStatus(prev => prev ? { ...prev, isAuthenticated: false, message: data.message } : null);
        onAuthExpired?.(data.message);
      });

      connection.on('AuthRefreshed', (status: AzureAuthStatus) => {
        console.log('AzureHub: Auth refreshed', status);
        setAuthStatus(status);
      });

      connection.on('OperationStarted', (data: { operationId: string; operation: string; message: string }) => {
        setCurrentOperation(data.operation);
        setOperationProgress({ message: data.message });
      });

      connection.on('OperationProgress', (data: { operation: string; message: string; current?: number; total?: number }) => {
        setOperationProgress({ message: data.message, current: data.current, total: data.total });
      });

      connection.on('OperationCompleted', (data: { operation: string; total: number; message: string }) => {
        setOperationProgress({ message: data.message, total: data.total });
        setTimeout(() => {
          setCurrentOperation(null);
          setOperationProgress(null);
        }, 1000);
      });

      connection.on('OperationsCancelled', () => {
        setCurrentOperation(null);
        setOperationProgress(null);
      });

      connection.onreconnecting(() => {
        console.log('AzureHub: Reconnecting...');
        setIsConnected(false);
      });

      connection.onreconnected(() => {
        console.log('AzureHub: Reconnected');
        setIsConnected(true);
      });

      connection.onclose((err) => {
        console.log('AzureHub: Connection closed', err);
        setIsConnected(false);
        if (err) {
          setError(err.message);
          onError?.(err);
        }
      });

      await connection.start();
      connectionRef.current = connection;
      setIsConnected(true);
    } catch (err) {
      const error = err as Error;
      console.error('AzureHub: Connection failed', error);
      setError(error.message);
      onError?.(error);
    } finally {
      setIsConnecting(false);
    }
  }, [buildConnection, onAuthExpired, onError]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.stop();
      connectionRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Check auth status
  const checkAuthStatus = useCallback(async (forceRefresh = false): Promise<AzureAuthStatus | null> => {
    if (!connectionRef.current) return null;
    
    try {
      const status = await connectionRef.current.invoke<AzureAuthStatus>('CheckAuthStatus', forceRefresh);
      setAuthStatus(status);
      return status;
    } catch (err) {
      console.error('Failed to check auth status', err);
      return null;
    }
  }, []);

  // Refresh authentication
  const refreshAuth = useCallback(async (tenantId?: string) => {
    if (!connectionRef.current) return { success: false, message: 'Not connected' };
    
    try {
      return await connectionRef.current.invoke('RefreshAuth', tenantId);
    } catch (err) {
      const error = err as Error;
      return { success: false, message: error.message };
    }
  }, []);

  // Get subscriptions (streaming)
  const getSubscriptions = useCallback(async function* (useCache = true): AsyncGenerator<AzureSubscription> {
    if (!connectionRef.current) return;
    
    const stream = connectionRef.current.stream<AzureSubscription>('GetSubscriptions', useCache);
    
    for await (const subscription of streamToAsyncIterable(stream)) {
      yield subscription;
    }
  }, []);

  // Get subscriptions as array
  const getSubscriptionsArray = useCallback(async (useCache = true): Promise<AzureSubscription[]> => {
    const subscriptions: AzureSubscription[] = [];
    for await (const sub of getSubscriptions(useCache)) {
      subscriptions.push(sub);
    }
    return subscriptions;
  }, [getSubscriptions]);

  // Get resource groups (streaming)
  const getResourceGroups = useCallback(async function* (subscriptionId: string, useCache = true): AsyncGenerator<AzureResourceGroup> {
    if (!connectionRef.current) return;
    
    const stream = connectionRef.current.stream<AzureResourceGroup>('GetResourceGroups', subscriptionId, useCache);
    
    for await (const rg of streamToAsyncIterable(stream)) {
      yield rg;
    }
  }, []);

  // Get resources (streaming)
  const getResources = useCallback(async function* (
    subscriptionId: string, 
    resourceGroup?: string, 
    resourceType?: string,
    useCache = true
  ): AsyncGenerator<AzureResource> {
    if (!connectionRef.current) return;
    
    const stream = connectionRef.current.stream<AzureResource>('GetResources', subscriptionId, resourceGroup, resourceType, useCache);
    
    for await (const resource of streamToAsyncIterable(stream)) {
      yield resource;
    }
  }, []);

  // Query metrics
  const queryMetrics = useCallback(async (request: AzureMetricsRequest) => {
    if (!connectionRef.current) return { success: false, error: 'Not connected' };
    
    try {
      return await connectionRef.current.invoke('QueryMetrics', request);
    } catch (err) {
      const error = err as Error;
      return { success: false, error: error.message };
    }
  }, []);

  // Query logs
  const queryLogs = useCallback(async (request: AzureLogsRequest) => {
    if (!connectionRef.current) return { success: false, error: 'Not connected' };
    
    try {
      return await connectionRef.current.invoke('QueryLogs', request);
    } catch (err) {
      const error = err as Error;
      return { success: false, error: error.message };
    }
  }, []);

  // Discover all resources (streaming)
  const discoverAllResources = useCallback(async function* (refreshCache = false): AsyncGenerator<AzureDiscoveryUpdate> {
    if (!connectionRef.current) return;
    
    const stream = connectionRef.current.stream<AzureDiscoveryUpdate>('DiscoverAllResources', refreshCache);
    
    for await (const update of streamToAsyncIterable(stream)) {
      yield update;
    }
  }, []);

  // Cancel all operations
  const cancelOperations = useCallback(async () => {
    if (!connectionRef.current) return;
    await connectionRef.current.invoke('CancelOperations');
  }, []);

  // Execute AI Query (long-running, no timeout)
  const executeAiQuery = useCallback(async (request: AzureAiQueryRequest): Promise<AzureAiQueryResult> => {
    if (!connectionRef.current) {
      return { success: false, isAzureQuery: false, rowCount: 0, error: 'Not connected to Azure Hub' };
    }
    
    try {
      const result = await connectionRef.current.invoke<AzureAiQueryResult>('ExecuteAiQuery', request);
      return result;
    } catch (err) {
      const error = err as Error;
      console.error('AI Query failed:', error);
      return { 
        success: false, 
        isAzureQuery: false, 
        rowCount: 0, 
        error: error.message 
      };
    }
  }, []);

  // ==========================================
  // RESOURCE CACHE METHODS (SignalR)
  // ==========================================

  // Sync Azure resource cache
  const syncResourceCache = useCallback(async (forceRefresh = false): Promise<AzureSyncResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected', subscriptionsFound: 0, workspacesFound: 0, appInsightsFound: 0 };
    }
    
    try {
      const result = await connectionRef.current.invoke<AzureSyncResult>('SyncResourceCache', forceRefresh);
      return result;
    } catch (err) {
      const error = err as Error;
      console.error('Resource sync failed:', error);
      return { success: false, message: error.message, subscriptionsFound: 0, workspacesFound: 0, appInsightsFound: 0 };
    }
  }, []);

  // Get workspaces from cache
  const getWorkspaces = useCallback(async (forceRefresh = false): Promise<AzureWorkspacesResult> => {
    if (!connectionRef.current) {
      return { success: false, needsSync: true, message: 'Not connected' };
    }
    
    try {
      return await connectionRef.current.invoke<AzureWorkspacesResult>('GetWorkspaces', forceRefresh);
    } catch (err) {
      const error = err as Error;
      return { success: false, needsSync: true, message: error.message };
    }
  }, []);

  // Get App Insights from cache
  const getAppInsights = useCallback(async (forceRefresh = false): Promise<AzureAppInsightsResult> => {
    if (!connectionRef.current) {
      return { success: false, needsSync: true, message: 'Not connected' };
    }
    
    try {
      return await connectionRef.current.invoke<AzureAppInsightsResult>('GetAppInsights', forceRefresh);
    } catch (err) {
      const error = err as Error;
      return { success: false, needsSync: true, message: error.message };
    }
  }, []);

  // Get cache status
  const getCacheStatus = useCallback(async (): Promise<AzureCacheStatusResult | null> => {
    if (!connectionRef.current) return null;
    
    try {
      return await connectionRef.current.invoke<AzureCacheStatusResult>('GetCacheStatus');
    } catch (err) {
      console.error('Failed to get cache status:', err);
      return null;
    }
  }, []);

  // ==========================================
  // AZURE DEVOPS DISCOVERY METHODS (SignalR)
  // ==========================================

  // Discover Azure DevOps organizations
  const discoverDevOpsOrganizations = useCallback(async (): Promise<DevOpsDiscoveryResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub' };
    }
    
    try {
      const result = await connectionRef.current.invoke<DevOpsDiscoveryResult>('DiscoverDevOpsOrganizations');
      return result;
    } catch (err) {
      const error = err as Error;
      console.error('DevOps discovery failed:', error);
      return { success: false, message: error.message };
    }
  }, []);

  // Discover Azure DevOps projects
  const discoverDevOpsProjects = useCallback(async (organizationUrl: string): Promise<DevOpsProjectsResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub' };
    }
    
    try {
      const result = await connectionRef.current.invoke<DevOpsProjectsResult>('DiscoverDevOpsProjects', organizationUrl);
      return result;
    } catch (err) {
      const error = err as Error;
      console.error('DevOps projects discovery failed:', error);
      return { success: false, message: error.message };
    }
  }, []);

  // Test Azure DevOps connection
  const testDevOpsConnection = useCallback(async (organizationUrl: string, projectName: string): Promise<DevOpsTestResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub' };
    }
    
    try {
      const result = await connectionRef.current.invoke<DevOpsTestResult>('TestDevOpsConnection', organizationUrl, projectName);
      return result;
    } catch (err) {
      const error = err as Error;
      return { success: false, message: error.message };
    }
  }, []);

  // ==========================================
  // AZURE DEVOPS ANALYTICS (OData - FAST!)
  // Uses OData Analytics for fast aggregated queries
  // ==========================================

  // Get bug analytics (much faster than WIQL for aggregations)
  const getBugAnalytics = useCallback(async (organizationUrl: string, projectName: string): Promise<DevOpsBugAnalyticsResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub' };
    }
    
    try {
      return await connectionRef.current.invoke<DevOpsBugAnalyticsResult>('GetBugAnalytics', organizationUrl, projectName);
    } catch (err) {
      const error = err as Error;
      console.error('Bug analytics failed:', error);
      return { success: false, message: error.message };
    }
  }, []);

  // Get work item counts by type/state/category
  const getWorkItemCounts = useCallback(async (organizationUrl: string, projectName: string, areaPath?: string): Promise<DevOpsWorkItemCountsResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub' };
    }
    
    try {
      return await connectionRef.current.invoke<DevOpsWorkItemCountsResult>('GetWorkItemCounts', organizationUrl, projectName, areaPath);
    } catch (err) {
      const error = err as Error;
      console.error('Work item counts failed:', error);
      return { success: false, message: error.message };
    }
  }, []);

  // Get sprint analytics with velocity data
  const getSprintAnalytics = useCallback(async (organizationUrl: string, projectName: string, sprintCount = 6): Promise<DevOpsSprintAnalyticsResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub' };
    }
    
    try {
      return await connectionRef.current.invoke<DevOpsSprintAnalyticsResult>('GetSprintAnalytics', organizationUrl, projectName, sprintCount);
    } catch (err) {
      const error = err as Error;
      console.error('Sprint analytics failed:', error);
      return { success: false, message: error.message };
    }
  }, []);

  // Get pipeline analytics (success rate, duration trends)
  const getPipelineAnalytics = useCallback(async (organizationUrl: string, projectName: string, days = 30): Promise<DevOpsPipelineAnalyticsResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub' };
    }
    
    try {
      return await connectionRef.current.invoke<DevOpsPipelineAnalyticsResult>('GetPipelineAnalytics', organizationUrl, projectName, days);
    } catch (err) {
      const error = err as Error;
      console.error('Pipeline analytics failed:', error);
      return { success: false, message: error.message };
    }
  }, []);

  // Get PR analytics
  const getPRAnalytics = useCallback(async (organizationUrl: string, projectName: string, days = 30): Promise<DevOpsPRAnalyticsResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub' };
    }
    
    try {
      return await connectionRef.current.invoke<DevOpsPRAnalyticsResult>('GetPRAnalytics', organizationUrl, projectName, days);
    } catch (err) {
      const error = err as Error;
      console.error('PR analytics failed:', error);
      return { success: false, message: error.message };
    }
  }, []);

  // Get cycle time analytics
  const getCycleTimeAnalytics = useCallback(async (organizationUrl: string, projectName: string): Promise<DevOpsCycleTimeResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub' };
    }
    
    try {
      return await connectionRef.current.invoke<DevOpsCycleTimeResult>('GetCycleTimeAnalytics', organizationUrl, projectName);
    } catch (err) {
      const error = err as Error;
      console.error('Cycle time analytics failed:', error);
      return { success: false, message: error.message };
    }
  }, []);

  // Stream work items in batches (efficient for large datasets)
  const streamWorkItems = useCallback(async (
    organizationUrl: string, 
    projectName: string, 
    onBatch: (items: DevOpsWorkItemOData[], batchNumber: number, totalSoFar: number) => void,
    filter?: string, 
    batchSize = 200
  ): Promise<{ success: boolean; totalItems: number; error?: string }> => {
    if (!connectionRef.current) {
      return { success: false, totalItems: 0, error: 'Not connected to Azure Hub' };
    }
    
    return new Promise((resolve) => {
      let totalItems = 0;
      
      // Set up event handlers
      const onStreamBatch = (data: { batchNumber: number; itemCount: number; totalSoFar: number; items: DevOpsWorkItemOData[] }) => {
        totalItems = data.totalSoFar;
        onBatch(data.items, data.batchNumber, data.totalSoFar);
      };
      
      const onStreamCompleted = (data: { totalItems: number }) => {
        cleanup();
        resolve({ success: true, totalItems: data.totalItems });
      };
      
      const onStreamError = (data: { message: string }) => {
        cleanup();
        resolve({ success: false, totalItems, error: data.message });
      };
      
      const onStreamCancelled = () => {
        cleanup();
        resolve({ success: false, totalItems, error: 'Stream cancelled' });
      };
      
      const cleanup = () => {
        connectionRef.current?.off('StreamBatch', onStreamBatch);
        connectionRef.current?.off('StreamCompleted', onStreamCompleted);
        connectionRef.current?.off('StreamError', onStreamError);
        connectionRef.current?.off('StreamCancelled', onStreamCancelled);
      };
      
      // Register event handlers
      connectionRef.current!.on('StreamBatch', onStreamBatch);
      connectionRef.current!.on('StreamCompleted', onStreamCompleted);
      connectionRef.current!.on('StreamError', onStreamError);
      connectionRef.current!.on('StreamCancelled', onStreamCancelled);
      
      // Start streaming
      connectionRef.current!.invoke('StreamWorkItems', organizationUrl, projectName, filter, batchSize)
        .catch((err: Error) => {
          cleanup();
          resolve({ success: false, totalItems, error: err.message });
        });
    });
  }, []);

  // Get comprehensive dashboard analytics (all metrics in one call)
  const getDashboardAnalytics = useCallback(async (organizationUrl: string, projectName: string): Promise<DevOpsDashboardAnalyticsResult> => {
    if (!connectionRef.current) {
      return { success: false, message: 'Not connected to Azure Hub', asOf: new Date().toISOString() };
    }
    
    try {
      return await connectionRef.current.invoke<DevOpsDashboardAnalyticsResult>('GetDashboardAnalytics', organizationUrl, projectName);
    } catch (err) {
      const error = err as Error;
      console.error('Dashboard analytics failed:', error);
      return { success: false, message: error.message, asOf: new Date().toISOString() };
    }
  }, []);

  // ==========================================
  // OPTIMIZED RESOURCE GRAPH METHODS (FAST!)
  // Uses Resource Graph for 10-50x faster queries
  // ==========================================

  // Fast sync using Resource Graph (single API call)
  const syncWithResourceGraph = useCallback(async (azureUserId?: string): Promise<OptimizedSyncResult> => {
    if (!connectionRef.current) {
      return { success: false, error: 'Not connected', subscriptionsFound: 0, workspacesFound: 0, appInsightsFound: 0, durationMs: 0 };
    }
    
    try {
      const result = await connectionRef.current.invoke<OptimizedSyncResult>('SyncWithResourceGraph', azureUserId);
      return result;
    } catch (err) {
      const error = err as Error;
      console.error('Resource Graph sync failed:', error);
      return { success: false, error: error.message, subscriptionsFound: 0, workspacesFound: 0, appInsightsFound: 0, durationMs: 0 };
    }
  }, []);

  // Get cached workspaces (fast - from optimized cache)
  const getCachedWorkspaces = useCallback(async (azureUserId?: string): Promise<AzureResourceRef[]> => {
    if (!connectionRef.current) return [];
    
    try {
      return await connectionRef.current.invoke<AzureResourceRef[]>('GetCachedWorkspaces', azureUserId);
    } catch (err) {
      console.error('Failed to get cached workspaces:', err);
      return [];
    }
  }, []);

  // Get cached App Insights (fast - from optimized cache)
  const getCachedAppInsights = useCallback(async (azureUserId?: string): Promise<AzureResourceRef[]> => {
    if (!connectionRef.current) return [];
    
    try {
      return await connectionRef.current.invoke<AzureResourceRef[]>('GetCachedAppInsights', azureUserId);
    } catch (err) {
      console.error('Failed to get cached App Insights:', err);
      return [];
    }
  }, []);

  // Get cached subscriptions (fast - from optimized cache)
  const getCachedSubscriptions = useCallback(async (azureUserId?: string): Promise<AzureResourceRef[]> => {
    if (!connectionRef.current) return [];
    
    try {
      return await connectionRef.current.invoke<AzureResourceRef[]>('GetCachedSubscriptions', azureUserId);
    } catch (err) {
      console.error('Failed to get cached subscriptions:', err);
      return [];
    }
  }, []);

  // Get user cache status
  const getUserCacheStatus = useCallback(async (azureUserId?: string): Promise<UserCacheStatus | null> => {
    if (!connectionRef.current) return null;
    
    try {
      return await connectionRef.current.invoke<UserCacheStatus>('GetUserCacheStatus', azureUserId);
    } catch (err) {
      console.error('Failed to get user cache status:', err);
      return null;
    }
  }, []);

  // Direct resource access by ID (no enumeration needed)
  const getResourceById = useCallback(async (resourceId: string): Promise<AzureResourceDetails | null> => {
    if (!connectionRef.current) return null;
    
    try {
      return await connectionRef.current.invoke<AzureResourceDetails | null>('GetResourceById', resourceId);
    } catch (err) {
      console.error('Failed to get resource by ID:', err);
      return null;
    }
  }, []);

  // Execute custom Resource Graph query (KQL)
  const queryResourceGraph = useCallback(async (kql: string, subscriptionIds?: string[]): Promise<ResourceGraphQueryResult> => {
    if (!connectionRef.current) {
      return { success: false, error: 'Not connected', resultCount: 0, durationMs: 0 };
    }
    
    try {
      return await connectionRef.current.invoke<ResourceGraphQueryResult>('QueryResourceGraph', kql, subscriptionIds);
    } catch (err) {
      const error = err as Error;
      console.error('Resource Graph query failed:', error);
      return { success: false, error: error.message, resultCount: 0, durationMs: 0 };
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    error,
    
    // Auth state (shared with AzureAuthContext via localStorage cache)
    authStatus,
    isAzureAuthenticated: authStatus?.isAuthenticated ?? false,
    
    // Operation state
    currentOperation,
    operationProgress,
    
    // Methods
    connect,
    disconnect,
    checkAuthStatus,
    refreshAuth,
    getSubscriptions,
    getSubscriptionsArray,
    getResourceGroups,
    getResources,
    queryMetrics,
    queryLogs,
    discoverAllResources,
    cancelOperations,
    executeAiQuery,
    
    // Resource cache methods
    syncResourceCache,
    getWorkspaces,
    getAppInsights,
    getCacheStatus,
    
    // DevOps discovery methods
    discoverDevOpsOrganizations,
    discoverDevOpsProjects,
    testDevOpsConnection,
    
    // DevOps analytics methods (OData - FAST!)
    getBugAnalytics,
    getWorkItemCounts,
    getSprintAnalytics,
    getPipelineAnalytics,
    getPRAnalytics,
    getCycleTimeAnalytics,
    streamWorkItems,
    getDashboardAnalytics,
    
    // Optimized Resource Graph methods (FAST!)
    syncWithResourceGraph,
    getCachedWorkspaces,
    getCachedAppInsights,
    getCachedSubscriptions,
    getUserCacheStatus,
    getResourceById,
    queryResourceGraph
  };
}

// Helper to convert SignalR stream to async iterable
async function* streamToAsyncIterable<T>(stream: signalR.IStreamResult<T>): AsyncGenerator<T> {
  const subscriber = stream.subscribe({
    next: () => {},
    error: () => {},
    complete: () => {}
  });

  const queue: T[] = [];
  let resolve: (() => void) | null = null;
  let done = false;
  let streamError: Error | null = null;

  stream.subscribe({
    next: (value) => {
      queue.push(value);
      if (resolve) {
        resolve();
        resolve = null;
      }
    },
    error: (err) => {
      streamError = err;
      done = true;
      if (resolve) {
        resolve();
        resolve = null;
      }
    },
    complete: () => {
      done = true;
      if (resolve) {
        resolve();
        resolve = null;
      }
    }
  });

  try {
    while (!done || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else if (!done) {
        await new Promise<void>(r => { resolve = r; });
      }
    }
    
    if (streamError) {
      throw streamError;
    }
  } finally {
    subscriber.dispose();
  }
}

export default useAzureHub;
