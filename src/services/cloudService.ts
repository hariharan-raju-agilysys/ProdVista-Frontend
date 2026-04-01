/**
 * Cloud Service - Generic provider-agnostic cloud resource operations.
 * 
 * Routes through the adapter framework. The backend resolves which cloud provider
 * (Azure, AWS, GCP) to use based on tenant configuration.
 * 
 * SOLID O/C: This service never changes when adding new cloud providers.
 */

import api from './api'

// ============================================================================
// Types
// ============================================================================

export interface ProviderInfo {
  providerId: string
  displayName: string
  isConfigured: boolean
}

export interface AdapterHealthResult {
  provider: string
  providerId: string
  isHealthy: boolean
  message: string | null
  details?: Record<string, unknown>
}

export interface CloudResource {
  id: string
  name: string
  type: string
  location: string
  status?: string
}

export interface CloudResourceDetail extends CloudResource {
  properties: Record<string, unknown>
}

export interface AdapterStatus {
  auth: ProviderInfo
  cloud: ProviderInfo
  monitoring: ProviderInfo
  ai: ProviderInfo
  cicd: ProviderInfo
  sourceControl: ProviderInfo
}

export interface AdapterHealthInfo {
  category: string
  providerId: string
  displayName: string
  isHealthy: boolean
  message: string | null
}

export interface AllAdaptersHealth {
  overallHealthy: boolean
  adapters: AdapterHealthInfo[]
}

export interface ProviderOption {
  id: string
  displayName: string
  description: string
  adapterType: string
  requiredSettings: string[]
}

// ============================================================================
// Adapter Status & Discovery API
// ============================================================================

export const adapterService = {
  /** Get status of all adapters for current tenant */
  async getStatus(): Promise<AdapterStatus> {
    const { data } = await api.get('/adapters/status')
    return data
  },

  /** Health check all configured adapters */
  async healthCheckAll(): Promise<AllAdaptersHealth> {
    const { data } = await api.get('/adapters/health')
    return data
  },

  /** Get all available provider options (for admin UI) */
  async getAvailableProviders(): Promise<Record<string, ProviderOption[]>> {
    const { data } = await api.get('/adapters/providers')
    return data
  },
}

// ============================================================================
// Cloud Resources API (provider-agnostic)
// ============================================================================

export const cloudService = {
  /** Get active cloud provider info */
  async getProvider(): Promise<ProviderInfo> {
    const { data } = await api.get('/cloud/provider')
    return data
  },

  /** Health check cloud provider */
  async healthCheck(): Promise<AdapterHealthResult> {
    const { data } = await api.get('/cloud/health')
    return data
  },

  /** List cloud resources */
  async listResources(filter?: string): Promise<{ provider: string; resources: CloudResource[]; count: number }> {
    const { data } = await api.get('/cloud/resources', { params: { filter } })
    return data
  },

  /** Get a specific cloud resource */
  async getResource(resourceId: string): Promise<CloudResourceDetail> {
    const { data } = await api.get(`/cloud/resources/${encodeURIComponent(resourceId)}`)
    return data
  },
}

// ============================================================================
// Monitoring API (provider-agnostic)
// ============================================================================

export interface LogEntry {
  id: string
  timestamp: string
  level: string
  message: string
  properties?: Record<string, string>
}

export interface MonitoringMetric {
  name: string
  value: number
  unit: string
  timestamp: string
  dimensions?: Record<string, string>
}

export interface TraceEntry {
  operationId: string
  name: string
  timestamp: string
  durationMs: number
  success: boolean
  parentId?: string
}

export const monitoringService = {
  /** Get active monitoring provider info */
  async getProvider(): Promise<ProviderInfo> {
    const { data } = await api.get('/monitoring/provider')
    return data
  },

  /** Health check monitoring provider */
  async healthCheck(): Promise<AdapterHealthResult> {
    const { data } = await api.get('/monitoring/health')
    return data
  },

  /** Search logs */
  async searchLogs(query?: string, from?: string, to?: string, maxResults?: number) {
    const { data } = await api.post('/monitoring/logs', { query, from, to, maxResults })
    return data as { provider: string; logs: LogEntry[]; count: number }
  },

  /** Get metrics */
  async getMetrics(query?: string, from?: string, to?: string) {
    const { data } = await api.post('/monitoring/metrics', { query, from, to })
    return data as { provider: string; metrics: MonitoringMetric[]; count: number }
  },

  /** Get distributed traces */
  async getTraces(operationId?: string, from?: string, to?: string) {
    const { data } = await api.get('/monitoring/traces', { params: { operationId, from, to } })
    return data as { provider: string; traces: TraceEntry[]; count: number }
  },

  /** Get query language info for active monitoring provider */
  async getQueryInfo() {
    const { data } = await api.get('/monitoring/query-info')
    return data as { provider: string; providerId: string; queryLanguage: string; isConfigured: boolean }
  },

  /** Get built-in query templates for active provider */
  async getQueryTemplates() {
    const { data } = await api.get('/monitoring/query-templates')
    return data as {
      queryLanguage: string
      provider: string
      categories: string[]
      templates: QueryTemplate[]
    }
  },

  /** Execute a native monitoring query (KQL/DQL/PromQL) */
  async executeQuery(query: string, from?: string, to?: string, maxResults?: number) {
    const { data } = await api.post('/monitoring/query', { query, from, to, maxResults })
    return data as QueryExecutionResult
  },

  /** Get monitoring dashboard setup status */
  async getDashboardStatus() {
    const { data } = await api.get('/monitoring/dashboard-status')
    return data as MonitoringDashboardStatus
  },

  /** Auto-provision monitoring dashboard with provider-specific widgets */
  async setupDashboard(replaceExisting?: boolean) {
    const { data } = await api.post('/monitoring/setup-dashboard', { replaceExisting })
    return data as MonitoringDashboardSetupResult
  },
}

// Query types
export interface QueryTemplate {
  name: string
  description: string
  query: string
  category: string
}

export interface QueryColumn {
  name: string
  type: string
}

export interface QueryExecutionResult {
  provider: string
  providerId: string
  queryLanguage: string
  columns: QueryColumn[]
  rows: (string | number | boolean | null)[][]
  totalCount: number
  executionTimeMs: number | null
}

export interface MonitoringDashboardStatus {
  provider: string
  providerId: string
  queryLanguage: string
  isProviderConfigured: boolean
  isDashboardProvisioned: boolean
  pageSlug: string | null
  pageId: string | null
  widgetCount: number
  pageDescription: string | null
  availableTemplateCount: number
}

export interface MonitoringDashboardSetupResult {
  message: string
  pageSlug: string
  pageId: string
  provider: string
  providerId: string
  queryLanguage: string
  widgetCount: number
  alreadyExists: boolean
}

// ============================================================================
// CI/CD API (provider-agnostic)
// ============================================================================

export interface PipelineInfo {
  id: string
  name: string
  status?: string
  lastRunAt?: string
}

export interface BuildInfo {
  id: string
  pipelineName: string
  status: string
  branch?: string
  startedAt: string
  durationSeconds?: number
}

export interface WorkItemInfo {
  id: string
  title: string
  type: string
  state: string
  assignedTo?: string
  changedDate?: string
}

export const cicdService = {
  /** Get active CI/CD provider info */
  async getProvider(): Promise<ProviderInfo> {
    const { data } = await api.get('/cicd/provider')
    return data
  },

  /** Health check CI/CD provider */
  async healthCheck(): Promise<AdapterHealthResult> {
    const { data } = await api.get('/cicd/health')
    return data
  },

  /** Get pipelines */
  async getPipelines(): Promise<{ provider: string; pipelines: PipelineInfo[]; count: number }> {
    const { data } = await api.get('/cicd/pipelines')
    return data
  },

  /** Get recent builds */
  async getRecentBuilds(count = 20): Promise<{ provider: string; builds: BuildInfo[]; count: number }> {
    const { data } = await api.get('/cicd/builds', { params: { count } })
    return data
  },

  /** Get work items */
  async getWorkItems(query?: string): Promise<{ provider: string; workItems: WorkItemInfo[]; count: number }> {
    const { data } = await api.get('/cicd/workitems', { params: { query } })
    return data
  },
}

// ============================================================================
// AI Pipeline API (provider-agnostic)
// ============================================================================

export const aiPipelineService = {
  /** Get active AI provider info */
  async getProvider(): Promise<ProviderInfo> {
    const { data } = await api.get('/ai-pipeline/provider')
    return data
  },

  /** Health check AI provider */
  async healthCheck(): Promise<AdapterHealthResult> {
    const { data } = await api.get('/ai-pipeline/health')
    return data
  },

  /** Check if AI is available */
  async isAvailable(): Promise<{ provider: string; available: boolean }> {
    const { data } = await api.get('/ai-pipeline/available')
    return data
  },

  /** Generate a one-shot completion */
  async generateCompletion(userPrompt: string, systemPrompt?: string): Promise<{ provider: string; content: string }> {
    const { data } = await api.post('/ai-pipeline/completion', { userPrompt, systemPrompt })
    return data
  },
}
