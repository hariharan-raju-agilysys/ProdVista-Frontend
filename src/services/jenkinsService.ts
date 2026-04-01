import api from './api'

// ==========================================
// Types
// ==========================================

export interface JenkinsConnection {
  id: string
  connectionName: string
  serverUrl: string
  username?: string
  isActive: boolean
  lastSyncAt?: string
  lastSyncStatus?: string
  jenkinsVersion?: string
  serverDescription?: string
  cacheUpdatedAt?: string
  createdAt: string
}

export interface JenkinsConnectionDetail extends JenkinsConnection {
  verifySsl: boolean
  useCrumbIssuer: boolean
  cachedJobs?: JenkinsJob[]
  cachedViews?: JenkinsView[]
  cachedNodes?: JenkinsNode[]
}

export interface CreateJenkinsConnectionRequest {
  connectionName: string
  serverUrl: string
  username?: string
  apiToken?: string
  useCrumbIssuer?: boolean
  verifySsl?: boolean
}

export interface UpdateJenkinsConnectionRequest {
  connectionName?: string
  serverUrl?: string
  username?: string
  apiToken?: string
  useCrumbIssuer?: boolean
  verifySsl?: boolean
  isActive?: boolean
}

export interface TestJenkinsConnectionRequest {
  serverUrl: string
  username?: string
  apiToken?: string
}

export interface JenkinsTestResult {
  success: boolean
  message: string
  jenkinsVersion?: string
  serverDescription?: string
}

export interface JenkinsSyncResult {
  success: boolean
  jobCount: number
  viewCount: number
  nodeCount: number
  pluginCount: number
  jenkinsVersion?: string
  error?: string
}

export interface JenkinsJob {
  name: string
  fullName?: string
  fullDisplayName?: string
  displayName?: string
  url?: string
  color?: string
  description?: string
  buildable: boolean
  inQueue: boolean
  lastBuild?: JenkinsBuild
  lastSuccessfulBuild?: JenkinsBuild
  lastFailedBuild?: JenkinsBuild
  healthReport?: JenkinsHealthReport[]
  jobs?: JenkinsJob[]
}

export interface JenkinsJobDetail extends JenkinsJob {
  builds?: JenkinsBuild[]
  nextBuildNumber: number
}

export interface JenkinsBuild {
  number: number
  result?: string
  timestamp: number
  duration: number
  building: boolean
  displayName?: string
  description?: string
}

export interface JenkinsBuildDetail extends JenkinsBuild {
  url?: string
  fullDisplayName?: string
  id?: string
  estimatedDuration: number
  keepLog: boolean
  actions?: JenkinsBuildAction[]
  artifacts?: JenkinsBuildArtifact[]
  changeSets?: JenkinsBuildChangeSet[]
}

export interface JenkinsBuildAction {
  _class?: string
  causes?: JenkinsBuildCause[]
}

export interface JenkinsBuildCause {
  shortDescription?: string
  userName?: string
  userId?: string
}

export interface JenkinsBuildArtifact {
  displayPath?: string
  fileName?: string
  relativePath?: string
}

export interface JenkinsBuildChangeSet {
  kind?: string
  items?: JenkinsChangeItem[]
}

export interface JenkinsChangeItem {
  commitId?: string
  msg?: string
  timestamp: number
  author?: { absoluteUrl?: string; fullName?: string }
  affectedPaths?: string[]
}

export interface JenkinsHealthReport {
  description?: string
  score: number
  iconClassName?: string
}

export interface JenkinsView {
  name: string
  url?: string
  description?: string
  jobs?: { name: string; color?: string }[]
}

export interface JenkinsNode {
  displayName: string
  description?: string
  idle: boolean
  jnlpAgent: boolean
  offline: boolean
  temporarilyOffline: boolean
  numExecutors: number
  icon?: string
}

export interface JenkinsDashboardStats {
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  unstableJobs: number
  disabledJobs: number
  buildingJobs: number
  queuedBuilds: number
  totalNodes: number
  onlineNodes: number
  offlineNodes: number
  busyExecutors: number
  totalExecutors: number
  averageHealthScore: number
  buildsLast24h: number
}

export interface JenkinsUrlValidation {
  originalUrl: string
  normalizedUrl: string
  isValid: boolean
  isReachable: boolean
  requiresAuth: boolean
  jenkinsVersion?: string
  serverDescription?: string
  suggestedConnectionName?: string
  suggestions: string[]
}

export interface JenkinsDiscoveryResult {
  connectionValid: boolean
  jenkinsVersion?: string
  error?: string
  serverInfo?: {
    description?: string
    nodeDescription?: string
    numExecutors: number
    mode?: string
    useSecurity: boolean
    version?: string
  }
  jobs?: JenkinsJob[]
  views?: JenkinsView[]
  nodes?: JenkinsNode[]
  stats?: {
    totalJobs: number
    pipelineJobs: number
    totalViews: number
    totalNodes: number
    onlineNodes: number
  }
}

export interface JenkinsPipelineConfig {
  id: string
  connectionId: string
  connectionName: string
  serverUrl: string
  jobName: string
  displayName: string
  description?: string
  jobType: string
  isMonitored: boolean
  lastBuildStatus?: string
  lastBuildNumber?: number
  lastBuildTimestamp?: string
  lastBuildDurationMs?: number
}

export interface AddJenkinsPipelineRequest {
  connectionId: string
  jobName: string
  displayName?: string
  description?: string
  jobType?: string
  pollIntervalSeconds?: number
}

export interface JenkinsTriggerResult {
  success: boolean
  message: string
  queueId?: number
  queueUrl?: string
}

export interface JenkinsParameterDefinition {
  name: string
  type?: string
  description?: string
  defaultParameterValue?: { value?: string }
  choices?: string[]
}

export interface TriggerBuildRequest {
  jobPath: string
  parameters?: Record<string, string>
}

// ==========================================
// Service
// ==========================================

class JenkinsService {
  // Connections
  async getConnections(): Promise<JenkinsConnection[]> {
    const response = await api.get<JenkinsConnection[]>('/jenkins/connections')
    return response.data
  }

  async getConnection(id: string): Promise<JenkinsConnectionDetail> {
    const response = await api.get<JenkinsConnectionDetail>(`/jenkins/connections/${id}`)
    return response.data
  }

  async createConnection(request: CreateJenkinsConnectionRequest): Promise<JenkinsConnection> {
    const response = await api.post<JenkinsConnection>('/jenkins/connections', request)
    return response.data
  }

  async updateConnection(id: string, request: UpdateJenkinsConnectionRequest): Promise<void> {
    await api.put(`/jenkins/connections/${id}`, request)
  }

  async testConnection(request: TestJenkinsConnectionRequest): Promise<JenkinsTestResult> {
    const response = await api.post<JenkinsTestResult>('/jenkins/connections/test', request)
    return response.data
  }

  async testSavedConnection(id: string): Promise<JenkinsTestResult> {
    const response = await api.post<JenkinsTestResult>(`/jenkins/connections/${id}/test`)
    return response.data
  }

  async syncConnection(id: string): Promise<JenkinsSyncResult> {
    const response = await api.post<JenkinsSyncResult>(`/jenkins/connections/${id}/sync`)
    return response.data
  }

  // AI Auto-Discovery
  async validateUrl(url: string, username?: string, apiToken?: string): Promise<JenkinsUrlValidation> {
    const response = await api.post<JenkinsUrlValidation>('/jenkins/ai/validate-url', { url, username, apiToken })
    return response.data
  }

  async discover(serverUrl: string, username?: string, apiToken?: string): Promise<JenkinsDiscoveryResult> {
    const response = await api.post<JenkinsDiscoveryResult>('/jenkins/ai/discover', { serverUrl, username, apiToken })
    return response.data
  }

  // Live Data
  async getJobs(connectionId: string): Promise<JenkinsJob[]> {
    const response = await api.get<JenkinsJob[]>(`/jenkins/connections/${connectionId}/jobs`)
    return response.data
  }

  async getBuilds(connectionId: string, jobPath: string, count = 20): Promise<JenkinsBuild[]> {
    const response = await api.get<JenkinsBuild[]>(`/jenkins/connections/${connectionId}/builds`, {
      params: { jobPath, count }
    })
    return response.data
  }

  async getBuildDetail(connectionId: string, jobPath: string, buildNumber: number): Promise<JenkinsBuildDetail> {
    const response = await api.get<JenkinsBuildDetail>(`/jenkins/connections/${connectionId}/builds/${buildNumber}`, {
      params: { jobPath }
    })
    return response.data
  }

  async getBuildConsole(connectionId: string, jobPath: string, buildNumber: number): Promise<string> {
    const response = await api.get<{ consoleOutput: string }>(`/jenkins/connections/${connectionId}/builds/${buildNumber}/console`, {
      params: { jobPath }
    })
    return response.data.consoleOutput
  }

  async getStats(connectionId: string): Promise<JenkinsDashboardStats> {
    const response = await api.get<JenkinsDashboardStats>(`/jenkins/connections/${connectionId}/stats`)
    return response.data
  }

  async getNodes(connectionId: string): Promise<JenkinsNode[]> {
    const response = await api.get<JenkinsNode[]>(`/jenkins/connections/${connectionId}/nodes`)
    return response.data
  }

  async getQueue(connectionId: string): Promise<{ items?: Array<{ id: number; why?: string; task?: { name: string } }> }> {
    const response = await api.get(`/jenkins/connections/${connectionId}/queue`)
    return response.data
  }

  // Pipeline Tracking
  async getPipelines(): Promise<JenkinsPipelineConfig[]> {
    const response = await api.get<JenkinsPipelineConfig[]>('/jenkins/pipelines')
    return response.data
  }

  async addPipeline(request: AddJenkinsPipelineRequest): Promise<JenkinsPipelineConfig> {
    const response = await api.post<JenkinsPipelineConfig>('/jenkins/pipelines', request)
    return response.data
  }

  // Build Trigger
  async triggerBuild(connectionId: string, jobPath: string, parameters?: Record<string, string>): Promise<JenkinsTriggerResult> {
    const response = await api.post<JenkinsTriggerResult>(`/jenkins/connections/${connectionId}/trigger`, { jobPath, parameters })
    return response.data
  }

  async stopBuild(connectionId: string, jobPath: string, buildNumber: number): Promise<JenkinsTriggerResult> {
    const response = await api.post<JenkinsTriggerResult>(`/jenkins/connections/${connectionId}/builds/${buildNumber}/stop`, null, {
      params: { jobPath }
    })
    return response.data
  }

  async getJobParameters(connectionId: string, jobPath: string): Promise<JenkinsParameterDefinition[]> {
    const response = await api.get<JenkinsParameterDefinition[]>(`/jenkins/connections/${connectionId}/job-parameters`, {
      params: { jobPath }
    })
    return response.data
  }
}

export const jenkinsService = new JenkinsService()
export default jenkinsService
