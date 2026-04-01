import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Data Source Types
export type DataSourceType = 
  | 'local-logs' 
  | 'azure-logs' 
  | 'dynatrace' 
  | 'splunk' 
  | 'datadog'
  | 'elastic'
  | 'prometheus'
  | 'custom-api'

export interface DataSourceConfig {
  type: DataSourceType
  name: string
  icon: string
  description: string
  requiresAuth: boolean
  authFields?: string[]
}

export const DATA_SOURCES: DataSourceConfig[] = [
  {
    type: 'local-logs',
    name: 'Local Log Files',
    icon: '📁',
    description: 'Read logs from local file system or mounted volumes',
    requiresAuth: false,
  },
  {
    type: 'azure-logs',
    name: 'Azure Monitor Logs',
    icon: '☁️',
    description: 'Azure Log Analytics, Application Insights, Container Insights',
    requiresAuth: true,
    authFields: ['tenantId', 'clientId', 'clientSecret', 'subscriptionId'],
  },
  {
    type: 'dynatrace',
    name: 'Dynatrace',
    icon: '🔬',
    description: 'Dynatrace APM and log monitoring',
    requiresAuth: true,
    authFields: ['environmentUrl', 'apiToken'],
  },
  {
    type: 'splunk',
    name: 'Splunk',
    icon: '🔍',
    description: 'Splunk Enterprise and Cloud',
    requiresAuth: true,
    authFields: ['host', 'port', 'token'],
  },
  {
    type: 'datadog',
    name: 'Datadog',
    icon: '🐕',
    description: 'Datadog logs and APM',
    requiresAuth: true,
    authFields: ['apiKey', 'appKey', 'site'],
  },
  {
    type: 'elastic',
    name: 'Elasticsearch',
    icon: '🔎',
    description: 'Elastic Stack / ELK logs',
    requiresAuth: true,
    authFields: ['host', 'username', 'password', 'index'],
  },
  {
    type: 'prometheus',
    name: 'Prometheus/Loki',
    icon: '📊',
    description: 'Prometheus metrics and Loki logs',
    requiresAuth: true,
    authFields: ['prometheusUrl', 'lokiUrl'],
  },
  {
    type: 'custom-api',
    name: 'Custom API',
    icon: '🔗',
    description: 'Connect to any REST API endpoint',
    requiresAuth: true,
    authFields: ['endpoint', 'authHeader', 'authToken'],
  },
]

// Widget Data Source Configuration
export interface WidgetDataSourceConfig {
  type: DataSourceType | 'none' | 'static'
  // API endpoint configuration
  endpoint?: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: Record<string, any>
  // Database query configuration
  query?: string
  connectionString?: string
  // Azure configuration
  workspaceId?: string
  resourceId?: string
  kustoQuery?: string
  // Field mapping
  fieldMappings?: {
    labelField?: string
    valueField?: string
    groupByField?: string
    timestampField?: string
  }
  // Processing
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'none'
  filters?: Array<{ field: string; operator: string; value: any }>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  limit?: number
  // Refresh
  refreshIntervalSeconds?: number
  // Static data (for manual entry)
  staticData?: any
}

// Widget Types
export interface DashboardWidget {
  id: string
  type: 
    // Local widget types
    | 'metric' | 'chart-line' | 'chart-bar' | 'chart-doughnut' | 'table' | 'list' | 'status' | 'logs' | 'ai-insights' | 'ai-predictions'
    // Backend widget types
    | 'metric-card' | 'kpi' | 'gauge' | 'line-chart' | 'bar-chart' | 'area-chart' | 'doughnut-chart' 
    | 'data-table' | 'status-list' | 'logs-viewer' | 'timeline' | 'custom-html' | 'azure-metrics' | 'map'
  title: string
  dataKey: string
  dataSource?: string
  size: 'small' | 'medium' | 'large' | 'full'
  position: { x: number; y: number; w: number; h: number }
  config?: Record<string, any>
  // New data source configuration
  dataSourceConfig?: WidgetDataSourceConfig
}

// Azure-specific types
export interface AzureSubscription {
  id: string
  name: string
  tenantId: string
}

export interface AzureResourceGroup {
  id: string
  name: string
  location: string
}

export interface AzureService {
  id: string
  name: string
  type: 'app-service' | 'container-app' | 'aks' | 'function' | 'vm' | 'storage'
  resourceGroup: string
}

export interface AzurePod {
  name: string
  namespace: string
  status: string
  containers: string[]
}

export interface AzureConnection {
  isConnected: boolean
  credentials?: {
    tenantId: string
    clientId: string
    clientSecret: string
    subscriptionId: string
  }
  subscriptions: AzureSubscription[]
  selectedSubscription?: string
  resourceGroups: AzureResourceGroup[]
  selectedResourceGroup?: string
  services: AzureService[]
  selectedServices: string[]
  pods: AzurePod[]
  selectedPods: string[]
}

// Log entry type
export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug' | 'critical'
  source: string
  message: string
  metadata?: Record<string, any>
}

// AI Insight type
export interface AIInsight {
  id: string
  type: 'anomaly' | 'trend' | 'prediction' | 'recommendation' | 'alert'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  affectedServices: string[]
  suggestedAction?: string
  confidence: number
  timestamp: string
}

// Dashboard Template
export interface DashboardTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'logs' | 'metrics' | 'devops' | 'executive' | 'custom'
  dataSources: DataSourceType[]
  widgets: DashboardWidget[]
  isManagerOnly?: boolean
}

// User role
export type UserRole = 'viewer' | 'editor' | 'manager' | 'admin'

// Dashboard Store
interface DashboardState {
  // User
  userRole: UserRole
  setUserRole: (role: UserRole) => void

  // Current dashboard
  currentDashboard: DashboardTemplate | null
  setCurrentDashboard: (dashboard: DashboardTemplate | null) => void
  updateWidgetPosition: (widgetId: string, position: { x: number; y: number; w: number; h: number }) => void
  addWidget: (widget: DashboardWidget) => void
  removeWidget: (widgetId: string) => void
  updateWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void

  // Data sources
  connectedSources: Map<string, { type: DataSourceType; config: Record<string, any>; status: 'connected' | 'error' | 'connecting' }>
  connectDataSource: (id: string, type: DataSourceType, config: Record<string, any>) => void
  disconnectDataSource: (id: string) => void

  // Azure specific
  azureConnection: AzureConnection
  setAzureCredentials: (credentials: AzureConnection['credentials']) => void
  setAzureSubscriptions: (subscriptions: AzureSubscription[]) => void
  selectSubscription: (subscriptionId: string) => void
  setResourceGroups: (groups: AzureResourceGroup[]) => void
  selectResourceGroup: (groupName: string) => void
  setServices: (services: AzureService[]) => void
  selectServices: (serviceIds: string[]) => void
  setPods: (pods: AzurePod[]) => void
  selectPods: (podNames: string[]) => void

  // Logs
  logs: LogEntry[]
  addLogs: (logs: LogEntry[]) => void
  clearLogs: () => void
  isCollectingLogs: boolean
  setIsCollectingLogs: (collecting: boolean) => void

  // AI Insights
  aiInsights: AIInsight[]
  setAiInsights: (insights: AIInsight[]) => void
  isAnalyzing: boolean
  setIsAnalyzing: (analyzing: boolean) => void

  // Wizard state
  wizardStep: number
  setWizardStep: (step: number) => void
  selectedTemplate: string | null
  setSelectedTemplate: (templateId: string | null) => void
  selectedDataSources: DataSourceType[]
  setSelectedDataSources: (sources: DataSourceType[]) => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // User
      userRole: 'manager',
      setUserRole: (role) => set({ userRole: role }),

      // Current dashboard
      currentDashboard: null,
      setCurrentDashboard: (dashboard) => set({ currentDashboard: dashboard }),
      updateWidgetPosition: (widgetId, position) => {
        const { currentDashboard } = get()
        if (!currentDashboard) return
        set({
          currentDashboard: {
            ...currentDashboard,
            widgets: currentDashboard.widgets.map((w) =>
              w.id === widgetId ? { ...w, position } : w
            ),
          },
        })
      },
      addWidget: (widget) => {
        const { currentDashboard } = get()
        if (!currentDashboard) return
        set({
          currentDashboard: {
            ...currentDashboard,
            widgets: [...currentDashboard.widgets, widget],
          },
        })
      },
      removeWidget: (widgetId) => {
        const { currentDashboard } = get()
        if (!currentDashboard) return
        set({
          currentDashboard: {
            ...currentDashboard,
            widgets: currentDashboard.widgets.filter((w) => w.id !== widgetId),
          },
        })
      },
      updateWidget: (widgetId, updates) => {
        const { currentDashboard } = get()
        if (!currentDashboard) return
        set({
          currentDashboard: {
            ...currentDashboard,
            widgets: currentDashboard.widgets.map((w) =>
              w.id === widgetId ? { ...w, ...updates } : w
            ),
          },
        })
      },

      // Data sources
      connectedSources: new Map(),
      connectDataSource: (id, type, config) => {
        const sources = new Map(get().connectedSources)
        sources.set(id, { type, config, status: 'connected' })
        set({ connectedSources: sources })
      },
      disconnectDataSource: (id) => {
        const sources = new Map(get().connectedSources)
        sources.delete(id)
        set({ connectedSources: sources })
      },

      // Azure
      azureConnection: {
        isConnected: false,
        subscriptions: [],
        resourceGroups: [],
        services: [],
        selectedServices: [],
        pods: [],
        selectedPods: [],
      },
      setAzureCredentials: (credentials) =>
        set((state) => ({
          azureConnection: { ...state.azureConnection, credentials, isConnected: !!credentials },
        })),
      setAzureSubscriptions: (subscriptions) =>
        set((state) => ({
          azureConnection: { ...state.azureConnection, subscriptions },
        })),
      selectSubscription: (subscriptionId) =>
        set((state) => ({
          azureConnection: { ...state.azureConnection, selectedSubscription: subscriptionId },
        })),
      setResourceGroups: (groups) =>
        set((state) => ({
          azureConnection: { ...state.azureConnection, resourceGroups: groups },
        })),
      selectResourceGroup: (groupName) =>
        set((state) => ({
          azureConnection: { ...state.azureConnection, selectedResourceGroup: groupName },
        })),
      setServices: (services) =>
        set((state) => ({
          azureConnection: { ...state.azureConnection, services },
        })),
      selectServices: (serviceIds) =>
        set((state) => ({
          azureConnection: { ...state.azureConnection, selectedServices: serviceIds },
        })),
      setPods: (pods) =>
        set((state) => ({
          azureConnection: { ...state.azureConnection, pods },
        })),
      selectPods: (podNames) =>
        set((state) => ({
          azureConnection: { ...state.azureConnection, selectedPods: podNames },
        })),

      // Logs
      logs: [],
      addLogs: (newLogs) => set((state) => ({ logs: [...state.logs, ...newLogs].slice(-1000) })),
      clearLogs: () => set({ logs: [] }),
      isCollectingLogs: false,
      setIsCollectingLogs: (collecting) => set({ isCollectingLogs: collecting }),

      // AI
      aiInsights: [],
      setAiInsights: (insights) => set({ aiInsights: insights }),
      isAnalyzing: false,
      setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

      // Wizard
      wizardStep: 0,
      setWizardStep: (step) => set({ wizardStep: step }),
      selectedTemplate: null,
      setSelectedTemplate: (templateId) => set({ selectedTemplate: templateId }),
      selectedDataSources: [],
      setSelectedDataSources: (sources) => set({ selectedDataSources: sources }),
    }),
    {
      name: 'ProdVista-dashboard-store',
      partialize: (state) => ({
        userRole: state.userRole,
        currentDashboard: state.currentDashboard,
        selectedTemplate: state.selectedTemplate,
        selectedDataSources: state.selectedDataSources,
      }),
    }
  )
)

// Predefined Templates
export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'log-analytics',
    name: 'Log Analytics',
    description: 'Monitor and analyze application logs with AI-powered insights',
    icon: '📋',
    category: 'logs',
    dataSources: ['local-logs', 'azure-logs', 'dynatrace', 'elastic'],
    widgets: [
      { id: 'log-stream', type: 'logs', title: 'Live Log Stream', dataKey: 'logs', size: 'full', position: { x: 0, y: 0, w: 12, h: 4 } },
      { id: 'error-count', type: 'metric', title: 'Error Count', dataKey: 'errorCount', size: 'small', position: { x: 0, y: 4, w: 3, h: 2 } },
      { id: 'warn-count', type: 'metric', title: 'Warnings', dataKey: 'warnCount', size: 'small', position: { x: 3, y: 4, w: 3, h: 2 } },
      { id: 'log-volume', type: 'chart-line', title: 'Log Volume', dataKey: 'logVolume', size: 'medium', position: { x: 6, y: 4, w: 6, h: 3 } },
      { id: 'ai-insights', type: 'ai-insights', title: 'AI Insights', dataKey: 'insights', size: 'large', position: { x: 0, y: 6, w: 6, h: 4 } },
      { id: 'error-dist', type: 'chart-doughnut', title: 'Error Distribution', dataKey: 'errorDist', size: 'medium', position: { x: 6, y: 7, w: 6, h: 3 } },
    ],
  },
  {
    id: 'azure-monitor',
    name: 'Azure Cloud Monitor',
    description: 'Full Azure infrastructure and application monitoring',
    icon: '☁️',
    category: 'devops',
    dataSources: ['azure-logs'],
    widgets: [
      { id: 'azure-health', type: 'status', title: 'Service Health', dataKey: 'azureHealth', size: 'medium', position: { x: 0, y: 0, w: 4, h: 3 } },
      { id: 'pod-status', type: 'table', title: 'Pod Status', dataKey: 'pods', size: 'medium', position: { x: 4, y: 0, w: 4, h: 3 } },
      { id: 'container-logs', type: 'logs', title: 'Container Logs', dataKey: 'containerLogs', size: 'large', position: { x: 8, y: 0, w: 4, h: 6 } },
      { id: 'resource-usage', type: 'chart-bar', title: 'Resource Usage', dataKey: 'resourceUsage', size: 'medium', position: { x: 0, y: 3, w: 8, h: 3 } },
      { id: 'ai-predictions', type: 'ai-insights', title: 'Predictive Insights', dataKey: 'predictions', size: 'full', position: { x: 0, y: 6, w: 12, h: 4 } },
    ],
  },
  {
    id: 'devops-pipeline',
    name: 'DevOps Pipeline',
    description: 'CI/CD monitoring with deployment insights',
    icon: '🚀',
    category: 'devops',
    dataSources: ['azure-logs', 'dynatrace', 'prometheus'],
    widgets: [
      { id: 'deploy-count', type: 'metric', title: 'Deployments Today', dataKey: 'deployCount', size: 'small', position: { x: 0, y: 0, w: 3, h: 2 } },
      { id: 'success-rate', type: 'metric', title: 'Success Rate', dataKey: 'successRate', size: 'small', position: { x: 3, y: 0, w: 3, h: 2 } },
      { id: 'avg-time', type: 'metric', title: 'Avg Deploy Time', dataKey: 'avgDeployTime', size: 'small', position: { x: 6, y: 0, w: 3, h: 2 } },
      { id: 'failures', type: 'metric', title: 'Failed Builds', dataKey: 'failures', size: 'small', position: { x: 9, y: 0, w: 3, h: 2 } },
      { id: 'pipeline-log', type: 'logs', title: 'Pipeline Logs', dataKey: 'pipelineLogs', size: 'large', position: { x: 0, y: 2, w: 8, h: 4 } },
      { id: 'deploy-trend', type: 'chart-line', title: 'Deploy Trend', dataKey: 'deployTrend', size: 'medium', position: { x: 8, y: 2, w: 4, h: 4 } },
    ],
  },
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview for leadership and stakeholders',
    icon: '📊',
    category: 'executive',
    dataSources: ['azure-logs', 'dynatrace'],
    isManagerOnly: true,
    widgets: [
      { id: 'uptime', type: 'metric', title: 'System Uptime', dataKey: 'uptime', size: 'small', position: { x: 0, y: 0, w: 3, h: 2 } },
      { id: 'incidents', type: 'metric', title: 'Active Incidents', dataKey: 'incidents', size: 'small', position: { x: 3, y: 0, w: 3, h: 2 } },
      { id: 'mttr', type: 'metric', title: 'MTTR', dataKey: 'mttr', size: 'small', position: { x: 6, y: 0, w: 3, h: 2 } },
      { id: 'sla', type: 'metric', title: 'SLA Compliance', dataKey: 'sla', size: 'small', position: { x: 9, y: 0, w: 3, h: 2 } },
      { id: 'ai-summary', type: 'ai-insights', title: 'AI Executive Summary', dataKey: 'executiveSummary', size: 'full', position: { x: 0, y: 2, w: 12, h: 4 } },
      { id: 'trend-chart', type: 'chart-line', title: 'Health Trend', dataKey: 'healthTrend', size: 'large', position: { x: 0, y: 6, w: 8, h: 3 } },
      { id: 'cost-dist', type: 'chart-doughnut', title: 'Cost Distribution', dataKey: 'costDist', size: 'medium', position: { x: 8, y: 6, w: 4, h: 3 } },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Dashboard',
    description: 'Build your own dashboard from scratch',
    icon: '✨',
    category: 'custom',
    dataSources: [],
    widgets: [],
  },
]
