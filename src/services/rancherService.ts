import api from './api'

// ==========================================
// Types
// ==========================================

export interface RancherConnection {
  id: string
  connectionName: string
  serverUrl: string
  defaultClusterId?: string
  defaultNamespace: string
  environment: string
  isActive: boolean
  lastCheckedAt?: string
  lastStatus?: string
  createdAt: string
}

export interface CreateRancherConnectionRequest {
  connectionName: string
  serverUrl: string
  bearerToken: string
  defaultClusterId?: string
  defaultNamespace?: string
  environment: string
}

export interface UpdateRancherConnectionRequest {
  connectionName?: string
  serverUrl?: string
  bearerToken?: string
  defaultClusterId?: string
  defaultNamespace?: string
  environment?: string
  isActive?: boolean
}

export interface TestRancherConnectionRequest {
  serverUrl: string
  bearerToken: string
}

export interface RancherTestResult {
  success: boolean
  message: string
  serverVersion?: string
}

export interface RancherCluster {
  id: string
  name: string
  state: string
  provider: string
  nodeCount: number
}

export interface RancherPod {
  name: string
  namespace: string
  status: string
  podIp?: string
  nodeName?: string
  restartCount: number
  createdAt?: string
  image?: string
  isReady: boolean
  statusMessage?: string
  containers: RancherContainerStatus[]
}

export interface RancherContainerStatus {
  name: string
  image: string
  ready: boolean
  restartCount: number
  state: string
  reason?: string
  message?: string
}

export interface RancherDeployment {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  image?: string
  createdAt?: string
  lastUpdated?: string
  status: string
  conditions: string[]
}

export interface RancherPodAlert {
  podName: string
  namespace: string
  alertType: string
  message: string
  restartCount: number
  detectedAt: string
  connectionName: string
  environment: string
}

// ==========================================
// Service
// ==========================================

class RancherServiceClient {
  // Connection CRUD
  async getConnections(): Promise<RancherConnection[]> {
    const response = await api.get<RancherConnection[]>('/rancher/connections')
    return response.data
  }

  async getConnection(id: string): Promise<RancherConnection> {
    const response = await api.get<RancherConnection>(`/rancher/connections/${id}`)
    return response.data
  }

  async createConnection(request: CreateRancherConnectionRequest): Promise<RancherConnection> {
    const response = await api.post<RancherConnection>('/rancher/connections', request)
    return response.data
  }

  async updateConnection(id: string, request: UpdateRancherConnectionRequest): Promise<void> {
    await api.put(`/rancher/connections/${id}`, request)
  }

  async deleteConnection(id: string): Promise<void> {
    await api.delete(`/rancher/connections/${id}`)
  }

  // Test Connection
  async testConnection(request: TestRancherConnectionRequest): Promise<RancherTestResult> {
    const response = await api.post<RancherTestResult>('/rancher/connections/test', request)
    return response.data
  }

  async testSavedConnection(id: string): Promise<RancherTestResult> {
    const response = await api.post<RancherTestResult>(`/rancher/connections/${id}/test`)
    return response.data
  }

  // Clusters
  async getClusters(connectionId: string): Promise<RancherCluster[]> {
    const response = await api.get<RancherCluster[]>(`/rancher/connections/${connectionId}/clusters`)
    return response.data
  }

  // Pods
  async getPods(connectionId: string, ns?: string, limit = 50): Promise<RancherPod[]> {
    const response = await api.get<RancherPod[]>(`/rancher/connections/${connectionId}/pods`, {
      params: { ns, limit }
    })
    return response.data
  }

  async searchPods(connectionId: string, query: string, ns?: string): Promise<RancherPod[]> {
    const response = await api.get<RancherPod[]>(`/rancher/connections/${connectionId}/pods/search`, {
      params: { q: query, ns }
    })
    return response.data
  }

  // Deployments
  async getDeployments(connectionId: string, ns?: string): Promise<RancherDeployment[]> {
    const response = await api.get<RancherDeployment[]>(`/rancher/connections/${connectionId}/deployments`, {
      params: { ns }
    })
    return response.data
  }

  // Alerts
  async getAlerts(connectionId: string, ns?: string): Promise<RancherPodAlert[]> {
    const response = await api.get<RancherPodAlert[]>(`/rancher/connections/${connectionId}/alerts`, {
      params: { ns }
    })
    return response.data
  }

  async getAllAlerts(): Promise<RancherPodAlert[]> {
    const response = await api.get<RancherPodAlert[]>('/rancher/alerts/all')
    return response.data
  }
}

export const rancherService = new RancherServiceClient()
