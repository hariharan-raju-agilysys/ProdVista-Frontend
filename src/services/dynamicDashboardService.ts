import axios from 'axios';

const api = axios.create({
  baseURL: '/api/dynamicdashboard',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('prodvista_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface DashboardPage {
  id: string;
  pageType: string;
  slug: string;
  displayName: string;
  description?: string;
  icon: string;
  displayOrder: number;
  isConfigured: boolean;
  layoutType: string;
  gridColumns: number;
  widgetCount?: number;
}

export interface DashboardPageDetail extends DashboardPage {
  pageConfig: Record<string, unknown>;
  widgets: DashboardWidget[];
}

export interface DashboardWidget {
  id: string;
  widgetType: string;
  title: string;
  subtitle?: string;
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  minWidth: number;
  minHeight: number;
  displayOrder: number;
  dataProviderType: string;
  dataProviderConfigId?: string;
  widgetConfig: Record<string, unknown>;
  dataProviderConfig: Record<string, unknown>;
  refreshIntervalSeconds: number;
  isLocked: boolean;
  cachedData?: unknown;
  lastDataFetch?: string;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  pageType: string;
  category: string;
  icon: string;
  previewImageUrl?: string;
  layoutType: string;
  gridColumns: number;
  isSystemTemplate: boolean;
  tags: string[];
  requiredDataProviders: string[];
}

export interface DashboardTemplateDetail extends DashboardTemplate {
  widgetDefinitions: TemplateWidgetDefinition[];
  pageConfig: Record<string, unknown>;
}

export interface TemplateWidgetDefinition {
  widgetType: string;
  title: string;
  subtitle?: string;
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  minWidth: number;
  minHeight: number;
  displayOrder: number;
  dataProviderType: string;
  widgetConfig?: Record<string, unknown>;
  dataProviderConfig?: Record<string, unknown>;
  refreshIntervalSeconds: number;
}

export interface DataProviderConfig {
  id: string;
  name: string;
  description?: string;
  providerType: string;
  lastTestedAt?: string;
  lastTestSuccessful?: boolean;
}

export interface TenantSetupStatus {
  isSetupComplete: boolean;
  currentSetupStep: number;
  configuredPages: string[];
  setupCompletedAt?: string;
}

export interface WidgetType {
  type: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
}

export interface WidgetPositionUpdate {
  widgetId: string;
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  displayOrder: number;
}

// Dashboard Pages API
export const getDashboardPages = () => 
  api.get<DashboardPage[]>('/pages');

export const getDashboardPage = (slug: string) => 
  api.get<DashboardPageDetail>(`/pages/${slug}`);

export const createOrUpdatePage = (page: Partial<DashboardPage>) =>
  api.post<DashboardPage>('/pages', page);

export const deletePage = (id: string) =>
  api.delete(`/pages/${id}`);

// Widgets API
export const addWidget = (pageId: string, widget: Partial<DashboardWidget>) =>
  api.post<DashboardWidget>(`/pages/${pageId}/widgets`, widget);

export const updateWidget = (id: string, widget: Partial<DashboardWidget>) =>
  api.put<DashboardWidget>(`/widgets/${id}`, widget);

export const updateWidgetPositions = (pageId: string, positions: WidgetPositionUpdate[]) =>
  api.put(`/pages/${pageId}/widgets/positions`, positions);

export const deleteWidget = (id: string) =>
  api.delete(`/widgets/${id}`);

export const fetchWidgetData = (id: string) =>
  api.post<unknown>(`/widgets/${id}/fetch`);

export const testDataProvider = (data: {
  dataProviderType: string;
  dataProviderConfig: string;
}) => api.post<unknown>('/data-providers/test', data);

// Templates API
export const getTemplates = (pageType?: string) =>
  api.get<DashboardTemplate[]>('/templates', { params: { pageType } });

export const getTemplate = (id: string) =>
  api.get<DashboardTemplateDetail>(`/templates/${id}`);

export const applyTemplate = (templateId: string, data: {
  slug: string;
  displayName?: string;
  displayOrder?: number;
  replaceExisting?: boolean;
}) => api.post<DashboardPageDetail>(`/templates/${templateId}/apply`, data);

export const saveAsTemplate = (pageId: string, data: {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  includeDataProviderConfig?: boolean;
}) => api.post<DashboardTemplate>(`/pages/${pageId}/save-as-template`, data);

// Data Providers API
export const getDataProviders = () =>
  api.get<DataProviderConfig[]>('/data-providers');

export const createDataProvider = (provider: {
  name: string;
  description?: string;
  providerType: string;
  configuration?: Record<string, unknown>;
}) => api.post<DataProviderConfig>('/data-providers', provider);

// Setup API
export const getSetupStatus = () =>
  api.get<TenantSetupStatus>('/setup/status');

export const initializeTenantDashboards = () =>
  api.post('/setup/initialize');

export const completeSetup = () =>
  api.post('/setup/complete');

// Widget Types API
export const getWidgetTypes = () =>
  api.get<WidgetType[]>('/widget-types');

// Azure Resource Discovery APIs
export interface AzureSubscription {
  id: string;
  name: string;
  state: string;
}

export interface AzureWorkspace {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
}

export interface AzureAppInsights {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
  kind?: string;
}

export interface AzureMetricResource {
  id: string;
  name: string;
  type: string;
  resourceGroup: string;
  location: string;
}

export interface AzureMetricDefinition {
  name: string;
  displayName: string;
  unit: string;
  aggregations: string[];
  dimensions: string[];
}

export const getAzureSubscriptions = () =>
  api.get<AzureSubscription[]>('/azure/subscriptions');

export const getLogAnalyticsWorkspaces = (subscriptionId: string) =>
  api.get<AzureWorkspace[]>(`/azure/subscriptions/${subscriptionId}/workspaces`);

export const getAppInsightsInstances = (subscriptionId: string) =>
  api.get<AzureAppInsights[]>(`/azure/subscriptions/${subscriptionId}/appinsights`);

export const getMetricResources = (subscriptionId: string, resourceType?: string) =>
  api.get<AzureMetricResource[]>(`/azure/subscriptions/${subscriptionId}/metric-resources`, {
    params: resourceType ? { resourceType } : undefined
  });

export const getMetricDefinitions = (resourceId: string) =>
  api.get<AzureMetricDefinition[]>('/azure/metrics/definitions', {
    params: { resourceId }
  });

export const executeLogAnalyticsQuery = (data: {
  workspaceId: string;
  query: string;
  timeRange?: string;
}) => api.post<{ columns: { name: string; type: string }[]; rows: Record<string, unknown>[]; rowCount: number }>('/azure/loganalytics/query', data);

export const queryAzureMetrics = (data: {
  resourceId: string;
  metricNames: string[];
  timeRange?: string;
  granularity?: string;
  aggregations?: string[];
}) => api.post<{ metrics: { name: string; unit: string; timeSeries: { timestamp: string; average?: number; total?: number; count?: number }[] }[] }>('/azure/metrics/query', data);

export const queryAppInsightsMetrics = (data: {
  appInsightsId: string;
  metricNames?: string[];
  timeRange?: string;
  granularity?: string;
}) => api.post<{ metrics: { name: string; unit: string; timeSeries: { timestamp: string; average?: number; total?: number; count?: number }[] }[] }>('/azure/appinsights/metrics', data);

// SignalR Test Functions
export interface SignalRTestResponse {
  message: string;
  widgetId: string;
  widgetType: string;
  testData: unknown;
}

export interface SignalRStreamResponse {
  message: string;
  widgetId: string;
  intervalMs: number;
  durationSeconds: number;
}

export const testWidgetSignalR = (widgetId: string) =>
  api.post<SignalRTestResponse>(`/widgets/${widgetId}/test-signalr`);

export const startWidgetTestStream = (widgetId: string, intervalMs = 2000, durationSeconds = 30) =>
  api.post<SignalRStreamResponse>(`/widgets/${widgetId}/start-test-stream`, null, {
    params: { intervalMs, durationSeconds }
  });

// Template Catalog API
export interface WidgetTemplateCatalog {
  categories: { name: string; count: number }[];
  totalCount: number;
  templates: WidgetTemplateItem[];
}

export interface WidgetTemplateItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  widgetType: string;
  dataProviderType: string;
  defaultWidth: number;
  defaultHeight: number;
  icon: string;
  description: string;
  refreshIntervalSeconds: number;
  tags: string[];
}

export interface WidgetTemplateDetail extends WidgetTemplateItem {
  widgetConfig: string;
  dataProviderConfig: string;
}

export interface AzureConfigOverride {
  subscriptionId?: string;
  resourceId?: string;
  workspaceId?: string;
}

export interface ApplyTemplatesRequest {
  templateIds: string[];
  azureConfig?: AzureConfigOverride;
}

export interface QuickSetupRequest {
  replaceExisting?: boolean;
  categories?: string[];
  azureConfig?: AzureConfigOverride;
}

export const getTemplateCatalog = (category?: string) =>
  api.get<WidgetTemplateCatalog>('/template-catalog', { params: category ? { category } : undefined });

export const getTemplateDetail = (templateId: string) =>
  api.get<WidgetTemplateDetail>(`/template-catalog/${templateId}`);

export const applyTemplates = (pageSlug: string, request: ApplyTemplatesRequest) =>
  api.post(`/pages/${pageSlug}/apply-templates`, request);

export const quickSetupPage = (pageSlug: string, request: QuickSetupRequest) =>
  api.post(`/pages/${pageSlug}/quick-setup`, request);

// Dashboard Export/Import
export const exportDashboard = (pageSlug: string) =>
  api.get(`/pages/${pageSlug}/export`);

export const importDashboard = (pageSlug: string, data: { replaceExisting: boolean; widgets: unknown[] }) =>
  api.post(`/pages/${pageSlug}/import`, data);

// AI Config Save API
export interface SaveAIConfigRequest {
  prompt?: string;
  description?: string;
  pageTitle?: string;
  pageDescription?: string;
  gridColumns?: number;
  widgets: AIWidgetDefinition[];
}

export interface AIWidgetDefinition {
  widgetType?: string;
  title?: string;
  subtitle?: string;
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  minWidth?: number;
  minHeight?: number;
  dataProviderType?: string;
  widgetConfig?: Record<string, unknown>;
  dataProviderConfig?: Record<string, unknown>;
  cachedData?: unknown;
  refreshIntervalSeconds?: number;
}

export const saveAIConfig = (pageSlug: string, request: SaveAIConfigRequest) =>
  api.post(`/pages/${pageSlug}/save-ai-config`, request);

// Dashboard Version History API
export interface DashboardVersion {
  id: string;
  versionNumber: number;
  description: string;
  widgetCount: number;
  createdAt: string;
  createdByUserId?: string;
}

export const getVersionHistory = (pageSlug: string) =>
  api.get<DashboardVersion[]>(`/pages/${pageSlug}/versions`);

export const rollbackToVersion = (pageSlug: string, versionId: string) =>
  api.post(`/pages/${pageSlug}/rollback/${versionId}`);

export default api;
