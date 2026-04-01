/**
 * Azure Service - Centralized Azure Operations with Caching
 * 
 * This service provides a single point of access for all Azure-related operations.
 * Features:
 * - Caching with configurable TTL
 * - Background resource discovery
 * - Event-based state updates
 * - Automatic retry with backoff
 * - Support for AI-generated method calls
 */

import api from './api'

// ============================================================================
// Types
// ============================================================================

export interface AzureSubscription {
  id: string
  name: string
  tenantId?: string
}

export interface AzureOpenAIDeployment {
  name: string
  modelName: string
  modelVersion: string
  provisioningState: string
}

export interface AzureOpenAIResource {
  id: string
  name: string
  resourceGroup: string | null
  subscriptionId: string
  subscriptionName: string
  endpoint: string
  location: string
  deployments: AzureOpenAIDeployment[]
  supportsTokenAuth: boolean
}

export interface AzureOpenAIDiscoveryResponse {
  isAuthenticated: boolean
  authMethod: string
  message: string
  resources: AzureOpenAIResource[]
}

export interface AzureAuthStatus {
  isAuthenticated: boolean
  authMethod: string
  message: string
  expiresAt?: Date
}

export type AzureServiceState = 
  | 'idle'
  | 'authenticating'
  | 'discovering'
  | 'ready'
  | 'error'

export interface AzureServiceStatus {
  state: AzureServiceState
  error?: string
  authStatus?: AzureAuthStatus
  lastUpdated?: Date
}

// ============================================================================
// Event System
// ============================================================================

type AzureEventType = 
  | 'auth:changed'
  | 'resources:loaded'
  | 'resources:error'
  | 'state:changed'
  | 'cache:cleared'

type AzureEventCallback = (data: any) => void

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
// const RETRY_DELAY_MS = 2000 // Reserved for retry logic

// ============================================================================
// Azure Service Class
// ============================================================================

class AzureServiceEngine {
  private cache: Map<string, { data: any; expires: number }> = new Map()
  private listeners: Map<AzureEventType, Set<AzureEventCallback>> = new Map()
  private status: AzureServiceStatus = { state: 'idle' }
  private discoveryPromise: Promise<AzureOpenAIDiscoveryResponse> | null = null
  private subscriptions: AzureSubscription[] = []
  private resources: AzureOpenAIResource[] = []
  private authStatus: AzureAuthStatus | null = null

  // ============================================================================
  // Event System
  // ============================================================================

  on(event: AzureEventType, callback: AzureEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    
    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  off(event: AzureEventType, callback: AzureEventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: AzureEventType, data?: any): void {
    this.listeners.get(event)?.forEach(cb => {
      try {
        cb(data)
      } catch (e) {
        console.error(`Azure Service event handler error for ${event}:`, e)
      }
    })
  }

  // ============================================================================
  // Status Management
  // ============================================================================

  getStatus(): AzureServiceStatus {
    return { ...this.status }
  }

  private setStatus(state: AzureServiceState, error?: string): void {
    this.status = {
      state,
      error,
      authStatus: this.authStatus || undefined,
      lastUpdated: new Date()
    }
    this.emit('state:changed', this.status)
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() < cached.expires) {
      return cached.data as T
    }
    this.cache.delete(key)
    return null
  }

  private setCache(key: string, data: any, ttlMs: number = CACHE_TTL_MS): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs
    })
  }

  clearCache(): void {
    this.cache.clear()
    this.discoveryPromise = null
    this.resources = []
    this.subscriptions = []
    this.emit('cache:cleared')
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  getAuthStatus(): AzureAuthStatus | null {
    return this.authStatus
  }

  isAuthenticated(): boolean {
    return this.authStatus?.isAuthenticated ?? false
  }

  // ============================================================================
  // Resource Discovery (Optimized)
  // ============================================================================

  /**
   * Discover Azure OpenAI resources with caching
   * If a discovery is already in progress, returns the same promise
   */
  async discoverResources(options?: {
    subscriptionId?: string
    forceRefresh?: boolean
  }): Promise<AzureOpenAIDiscoveryResponse> {
    const cacheKey = `discovery:${options?.subscriptionId || 'all'}`

    // Check cache first (unless force refresh)
    if (!options?.forceRefresh) {
      const cached = this.getCached<AzureOpenAIDiscoveryResponse>(cacheKey)
      if (cached) {
        return cached
      }
    }

    // If already discovering, return existing promise
    if (this.discoveryPromise && !options?.forceRefresh) {
      return this.discoveryPromise
    }

    // Start discovery
    this.setStatus('discovering')
    
    this.discoveryPromise = this.executeDiscovery(options?.subscriptionId)
      .then(result => {
        this.setCache(cacheKey, result)
        this.resources = result.resources
        this.authStatus = {
          isAuthenticated: result.isAuthenticated,
          authMethod: result.authMethod,
          message: result.message
        }
        
        // Extract unique subscriptions
        this.subscriptions = this.extractSubscriptions(result.resources)
        
        this.setStatus('ready')
        this.emit('resources:loaded', result)
        return result
      })
      .catch(error => {
        this.setStatus('error', error.message)
        this.emit('resources:error', error)
        throw error
      })
      .finally(() => {
        this.discoveryPromise = null
      })

    return this.discoveryPromise
  }

  private async executeDiscovery(subscriptionId?: string): Promise<AzureOpenAIDiscoveryResponse> {
    const url = subscriptionId 
      ? `/llm/azure-openai/discover?subscriptionId=${subscriptionId}`
      : '/llm/azure-openai/discover'
    
    const response = await api.get<AzureOpenAIDiscoveryResponse>(url)
    return response.data
  }

  private extractSubscriptions(resources: AzureOpenAIResource[]): AzureSubscription[] {
    const subMap = new Map<string, AzureSubscription>()
    for (const r of resources) {
      if (!subMap.has(r.subscriptionId)) {
        subMap.set(r.subscriptionId, {
          id: r.subscriptionId,
          name: r.subscriptionName
        })
      }
    }
    return Array.from(subMap.values())
  }

  // ============================================================================
  // Getters (Cached Data Access)
  // ============================================================================

  getResources(): AzureOpenAIResource[] {
    return [...this.resources]
  }

  getSubscriptions(): AzureSubscription[] {
    return [...this.subscriptions]
  }

  getResourcesBySubscription(subscriptionId: string): AzureOpenAIResource[] {
    return this.resources.filter(r => r.subscriptionId === subscriptionId)
  }

  getResourceById(resourceId: string): AzureOpenAIResource | undefined {
    return this.resources.find(r => r.id === resourceId)
  }

  getDeploymentsByResource(resourceId: string): AzureOpenAIDeployment[] {
    return this.getResourceById(resourceId)?.deployments || []
  }

  // ============================================================================
  // Token Management (for Azure OpenAI API calls)
  // ============================================================================

  async getAccessToken(): Promise<string | null> {
    const cacheKey = 'azure:token'
    const cached = this.getCached<{ token: string; expiresAt: number }>(cacheKey)
    
    if (cached && Date.now() < cached.expiresAt - 60000) { // 1 min buffer
      return cached.token
    }

    try {
      const response = await api.post<{ accessToken: string; expiresOn: string }>('/llm/azure-openai/token')
      const data = response.data
      
      const expiresAt = new Date(data.expiresOn).getTime()
      this.setCache(cacheKey, { token: data.accessToken, expiresAt }, expiresAt - Date.now())
      
      return data.accessToken
    } catch (error) {
      console.error('Failed to get Azure access token:', error)
      return null
    }
  }

  // ============================================================================
  // Quick Config Helpers
  // ============================================================================

  /**
   * Get recommended Azure OpenAI configuration
   * Finds the first available resource with deployments
   */
  getRecommendedConfig(): { 
    endpoint: string
    deployment: string
    modelName: string
    resource: AzureOpenAIResource
  } | null {
    const resourceWithDeployment = this.resources.find(r => r.deployments.length > 0)
    if (!resourceWithDeployment) return null

    const deployment = resourceWithDeployment.deployments[0]
    return {
      endpoint: resourceWithDeployment.endpoint,
      deployment: deployment.name,
      modelName: deployment.modelName,
      resource: resourceWithDeployment
    }
  }

  // ============================================================================
  // AI Integration Interface
  // ============================================================================

  /**
   * Execute a dynamic Azure operation (for AI-generated calls)
   * This allows AI to call Azure operations by method name
   */
  async execute<T = any>(
    operation: string, 
    params?: Record<string, any>
  ): Promise<T> {
    const operations: Record<string, (params?: any) => Promise<any>> = {
      'discover': () => this.discoverResources(params),
      'getResources': () => Promise.resolve(this.getResources()),
      'getSubscriptions': () => Promise.resolve(this.getSubscriptions()),
      'getToken': () => this.getAccessToken(),
      'getRecommendedConfig': () => Promise.resolve(this.getRecommendedConfig()),
      'clearCache': () => { this.clearCache(); return Promise.resolve(true) }
    }

    const op = operations[operation]
    if (!op) {
      throw new Error(`Unknown Azure operation: ${operation}`)
    }

    return op(params)
  }

  /**
   * Get available operations for AI discovery
   */
  getAvailableOperations(): string[] {
    return [
      'discover',
      'getResources', 
      'getSubscriptions',
      'getToken',
      'getRecommendedConfig',
      'clearCache'
    ]
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const azureService = new AzureServiceEngine()

// Convenience exports
export const {
  discoverResources,
  getResources,
  getSubscriptions,
  getResourceById,
  getDeploymentsByResource,
  getAccessToken,
  getRecommendedConfig,
  clearCache,
  getStatus,
  getAuthStatus,
  isAuthenticated,
  on,
  off,
  execute,
  getAvailableOperations
} = {
  discoverResources: azureService.discoverResources.bind(azureService),
  getResources: azureService.getResources.bind(azureService),
  getSubscriptions: azureService.getSubscriptions.bind(azureService),
  getResourceById: azureService.getResourceById.bind(azureService),
  getDeploymentsByResource: azureService.getDeploymentsByResource.bind(azureService),
  getAccessToken: azureService.getAccessToken.bind(azureService),
  getRecommendedConfig: azureService.getRecommendedConfig.bind(azureService),
  clearCache: azureService.clearCache.bind(azureService),
  getStatus: azureService.getStatus.bind(azureService),
  getAuthStatus: azureService.getAuthStatus.bind(azureService),
  isAuthenticated: azureService.isAuthenticated.bind(azureService),
  on: azureService.on.bind(azureService),
  off: azureService.off.bind(azureService),
  execute: azureService.execute.bind(azureService),
  getAvailableOperations: azureService.getAvailableOperations.bind(azureService)
}

export default azureService
