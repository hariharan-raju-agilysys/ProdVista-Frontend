import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('prodvista_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and trigger re-login
      localStorage.removeItem('prodvista_auth_token');
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// Dashboard
export const getDashboards = (category?: string) => 
  api.get('/dashboards', { params: { category } })

export const getDashboard = (id: string) => 
  api.get(`/dashboards/${id}`)

// Metrics
export const getMetrics = (category: string, start?: Date, end?: Date) =>
  api.get(`/metrics/${category}`, { params: { start, end } })

export const getMetricSummary = (category: string) =>
  api.get(`/metrics/${category}/summary`)

// Bugs
export const getBugAnalytics = (product?: string) =>
  api.get('/bugs/analytics', { params: { product } })

export const getLongRunningBugs = (minAgeDays: number = 30) =>
  api.get('/bugs/long-running', { params: { minAgeDays } })

// Releases
export const getReleases = (status?: string) =>
  api.get('/releases', { params: { status } })

export const getReleaseNotes = (version: string) =>
  api.get(`/releases/${version}/notes`)

// Customers
export const getCustomerDeployments = (customerId?: string) =>
  api.get('/customers/deployments', { params: { customerId } })

export const getVersionDistribution = () =>
  api.get('/customers/version-distribution')

// Production
export const getIncidentSummary = (start?: Date, end?: Date) =>
  api.get('/production/incidents', { params: { start, end } })

export const getApiHealth = () =>
  api.get('/production/api-health')

export const getLongRunningJobs = () =>
  api.get('/production/jobs')

// Engineering
export const getSprintProgress = (sprintName: string) =>
  api.get(`/engineering/sprints/${sprintName}`)

export const getBuildHealth = (pipeline?: string) =>
  api.get('/engineering/builds', { params: { pipeline } })

export const getPRReviewStatus = () =>
  api.get('/engineering/pull-requests')

// Adapters
export const getAdapters = () =>
  api.get('/adapters')

export const syncAdapter = (adapterName: string) =>
  api.post(`/adapters/${adapterName}/sync`)

export const syncAllAdapters = () =>
  api.post('/adapters/sync-all')

// Azure Resources
export const getAzureAuthStatus = () =>
  api.get('/azure/auth-status')

export const refreshAzureAuth = (tenantId?: string) =>
  api.post('/azure/refresh-auth', { tenantId })

export const getAzureSubscriptions = () =>
  api.get('/azure/subscriptions')

export const getAzureResourceGroups = (subscriptionId: string) =>
  api.get(`/azure/subscriptions/${subscriptionId}/resourcegroups`)

export const getAzureResources = (subscriptionId: string, resourceGroup: string) =>
  api.get(`/azure/subscriptions/${subscriptionId}/resourcegroups/${resourceGroup}/resources`)

export const getAzureResourcesByType = (subscriptionId: string, type?: string, limit: number = 100) =>
  api.get(`/azure/subscriptions/${subscriptionId}/resources`, { params: { type, limit } })

export const getAzureAppInsights = (subscriptionId: string) =>
  api.get(`/azure/subscriptions/${subscriptionId}/appinsights`)

export const getAzureStorageAccounts = (subscriptionId: string) =>
  api.get(`/azure/subscriptions/${subscriptionId}/storageaccounts`)

export const getAzureWorkspaces = (subscriptionId: string) =>
  api.get(`/azure/subscriptions/${subscriptionId}/workspaces`)

// Azure Traces
export const getDistributedTraces = (workspaceId: string, operationId?: string, timeRange: string = '1h', limit: number = 100) =>
  api.get('/azure/traces', { params: { workspaceId, operationId, timeRange, limit } })

export const getTraceDetails = (operationId: string, workspaceId: string) =>
  api.get(`/azure/traces/${operationId}`, { params: { workspaceId } })

export const getAzureMetrics = (resourceId: string, metricNames: string, timeRange: string = '1h', interval: string = 'PT5M') =>
  api.get('/azure/metrics', { params: { resourceId, metricNames, timeRange, interval } })

// Azure Storage Logs
export const getStorageContainers = (accountName: string) =>
  api.get(`/azure/storage/${accountName}/containers`)

export const getStorageBlobs = (accountName: string, containerName: string, prefix?: string, limit: number = 100) =>
  api.get(`/azure/storage/${accountName}/${containerName}/blobs`, { params: { prefix, limit } })

export const getBlobContent = (accountName: string, containerName: string, blobName: string, maxLines: number = 1000) =>
  api.get(`/azure/storage/${accountName}/${containerName}/blob`, { params: { blobName, maxLines } })

export const searchLogs = (accountName: string, containerName: string, searchRequest: {
  query?: string
  level?: string
  datePrefix?: string
  maxBlobs?: number
  maxResultsPerBlob?: number
  maxTotalResults?: number
}) =>
  api.post(`/azure/storage/${accountName}/${containerName}/search`, searchRequest)

// ============================================
// Azure Resource Cache (Fast Access)
// ============================================

// Sync all resources to cache (call once, then use cached endpoints)
export const syncAzureResourceCache = () =>
  api.post('/azure/cache/sync')

// Get cache status
export const getAzureCacheStatus = () =>
  api.get('/azure/cache/status')

// Clear cache
export const clearAzureCache = () =>
  api.delete('/azure/cache')

// Get cached subscriptions (instant if synced)
export const getCachedSubscriptions = () =>
  api.get('/azure/cached/subscriptions')

// Get cached workspaces (instant if synced)
export const getCachedWorkspaces = () =>
  api.get('/azure/cached/workspaces')

// Get cached App Insights (instant if synced)
export const getCachedAppInsights = () =>
  api.get('/azure/cached/appinsights')

// ============================================
// Azure Resource Graph (Single API Calls - Fastest)
// ============================================

// Get all subscriptions via Resource Graph (single fast API call)
export const getResourceGraphSubscriptions = () =>
  api.get('/resourcegraph/subscriptions')

// Get all Log Analytics workspaces (single query across all/specified subscriptions)
export const getResourceGraphWorkspaces = (subscriptionIds?: string[]) =>
  api.get('/resourcegraph/workspaces', {
    params: { subscriptionIds: subscriptionIds?.join(',') }
  })

// Get all Application Insights (single query)
export const getResourceGraphAppInsights = (subscriptionIds?: string[]) =>
  api.get('/resourcegraph/appinsights', {
    params: { subscriptionIds: subscriptionIds?.join(',') }
  })

// Get both workspaces + App Insights in one call
export const getResourceGraphMonitoring = (subscriptionIds?: string[]) =>
  api.get('/resourcegraph/monitoring', {
    params: { subscriptionIds: subscriptionIds?.join(',') }
  })

// Get AKS clusters
export const getResourceGraphAks = (subscriptionIds?: string[]) =>
  api.get('/resourcegraph/aks', {
    params: { subscriptionIds: subscriptionIds?.join(',') }
  })

// Get any resource type dynamically
export const getResourceGraphByType = (resourceType: string, subscriptionIds?: string[], limit = 500) =>
  api.get(`/resourcegraph/resources/${encodeURIComponent(resourceType)}`, {
    params: { subscriptionIds: subscriptionIds?.join(','), limit }
  })

// Search resources by name/tags
export const searchResourceGraph = (query: string, subscriptionIds?: string[], resourceType?: string, maxResults = 100) =>
  api.get('/resourcegraph/search', {
    params: { query, subscriptionIds: subscriptionIds?.join(','), resourceType, maxResults }
  })

// Execute custom KQL query
export const queryResourceGraph = (kqlQuery: string, subscriptionIds?: string[], top?: number, skip?: number) =>
  api.post('/resourcegraph/query', {
    query: kqlQuery,
    subscriptionIds,
    top,
    skip
  })

// ============================================
// Scoped KQL Queries (Uses Tenant's Selected Resources)
// ============================================

// Execute KQL query scoped to tenant's workspace
export const executeScopedKqlQuery = (query: string, workspaceId?: string, timeRange = '1h') =>
  api.post('/scopedquery/execute', { query, workspaceId, timeRange })

// Execute cross-resource KQL query across App Insights
export const executeCrossResourceQuery = (query: string, resourceIds?: string[], timeRange = '1h') =>
  api.post('/scopedquery/cross-resource', { query, resourceIds, timeRange })

// Get optimized KQL templates for tenant's resources
export const getScopedKqlTemplates = (category?: string) =>
  api.get('/scopedquery/templates', { params: { category } })

// Optimize a KQL query without executing
export const optimizeKqlQuery = (query: string, timeRange = '1h', rowLimit = 1000) =>
  api.post('/scopedquery/optimize', { query, timeRange, rowLimit })

// Execute widget KQL query with scope
export const executeWidgetScopedQuery = (widgetId: string, query: string, workspaceId?: string, timeRange = '1h') =>
  api.post(`/scopedquery/widget/${widgetId}/execute`, { query, workspaceId, timeRange })

// Get cached resources with optional type filter
export const getCachedResources = (type?: string) =>
  api.get('/azure/cached/resources', { params: { type } })

// Get all cached resources in one call
export const getAllCachedResources = () =>
  api.get('/azure/cached/all')

// ============================================
// Filtered Resources (Based on Tenant Settings)
// ============================================

// Get only selected subscriptions (or all if setup not done)
export const getFilteredSubscriptions = () =>
  api.get('/azure/filtered/subscriptions')

// Get only selected workspaces
export const getFilteredWorkspaces = () =>
  api.get('/azure/filtered/workspaces')

// Get only selected App Insights
export const getFilteredAppInsights = () =>
  api.get('/azure/filtered/appinsights')

// Get only selected resources
export const getFilteredResources = () =>
  api.get('/azure/filtered/resources')

// Get all filtered resources in one call
export const getAllFilteredResources = () =>
  api.get('/azure/filtered/all')

// ============================================
// Smart Resource Loader (Auto-uses filtered if setup done)
// ============================================

export interface SmartResourceResult {
  subscriptions: any[];
  workspaces: any[];
  appInsights: any[];
  isSetupCompleted: boolean;
  isCached: boolean;
  needsSetup?: boolean;
  lastSyncedAt?: string;
}

/**
 * Get saved/selected Azure resources from tenant settings.
 * These are the resources the user selected during setup - fast database read.
 * Use this throughout the app for dropdowns and resource access.
 */
export const getSmartResources = async (): Promise<SmartResourceResult> => {
  try {
    // Get saved selections from database (fast)
    const response = await api.get('/azure/filtered/all');
    const data = response.data;
    
    return {
      subscriptions: data.subscriptions || [],
      workspaces: data.workspaces || [],
      appInsights: data.appInsights || [],
      isSetupCompleted: data.isSetupCompleted === true,
      isCached: false, // Not using cache, reading from DB
      needsSetup: data.setupRequired === true,
      lastSyncedAt: data.lastSyncedAt
    };
  } catch (err) {
    console.warn('Could not load saved Azure resources:', err);
    return {
      subscriptions: [],
      workspaces: [],
      appInsights: [],
      isSetupCompleted: false,
      isCached: false,
      needsSetup: true
    };
  }
}

// Log Analytics Query Execution
export const executeLogAnalyticsQuery = async (workspaceId: string, query: string, timespan: string = 'PT1H') => {
  const response = await api.post('/dashboard/azure/loganalytics/query', { workspaceId, query, timeRange: timespan })
  return response.data
}

// Tenant Azure Settings
export const getTenantAzureSettings = async () => {
  const response = await api.get('/azure/settings')
  return response.data
}

export const updateTenantAzureSettings = (settings: {
  defaultSubscriptionId?: string
  defaultSubscriptionName?: string
  defaultWorkspaceId?: string
  defaultWorkspaceName?: string
  defaultAppInsightsId?: string
  defaultAppInsightsName?: string
  defaultStorageAccountName?: string
}) => api.put('/azure/settings', settings)

export const setDefaultWorkspace = (resourceId: string, resourceName?: string) =>
  api.post('/azure/settings/default-workspace', { resourceId, resourceName })

export const addFavoriteWorkspace = (resource: {
  resourceId: string
  resourceName?: string
  resourceType?: string
  subscriptionId?: string
  location?: string
}) => api.post('/azure/settings/favorite-workspace', resource)

export const removeFavoriteWorkspace = (resourceId: string) =>
  api.delete(`/azure/settings/favorite-workspace/${encodeURIComponent(resourceId)}`)

export const saveQuery = (query: {
  name: string
  query: string
  workspaceId?: string
  workspaceName?: string
  description?: string
}) => api.post('/azure/settings/saved-query', query)

export const deleteSavedQuery = (queryId: string) =>
  api.delete(`/azure/settings/saved-query/${queryId}`)

export const trackWorkspaceUsage = (resourceId: string, resourceName?: string) =>
  api.post('/azure/settings/track-usage', { resourceId, resourceName })

export default api
