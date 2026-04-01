/**
 * Azure Resource Service
 * Centralized service for Azure resource discovery and management
 */

import api from './api';
import type {
  AzureSubscription,
  AzureOpenAIResource,
  AzureOpenAIDeployment,
  AzureSqlDatabase,
  AzureDiscoveryResult,
  AzureAutoConfigResult,
  DeploymentListResponse
} from '../types/azure';

// ============================================================================
// API Response Types
// ============================================================================

interface SubscriptionListResponse {
  subscriptions: AzureSubscription[];
  count: number;
}

interface ResourceListResponse {
  resources: AzureOpenAIResource[];
  count: number;
}

interface DatabaseListResponse {
  databases: AzureSqlDatabase[];
  count: number;
}

// ============================================================================
// Azure Resource Service
// ============================================================================

class AzureResourceService {
  private readonly baseUrl = '/ai-query/discovery';
  
  // Cache for discovered resources
  private subscriptionCache: AzureSubscription[] = [];
  private resourceCache: Map<string, AzureOpenAIResource[]> = new Map();
  private deploymentCache: Map<string, AzureOpenAIDeployment[]> = new Map();
  private databaseCache: Map<string, AzureSqlDatabase[]> = new Map();
  private lastCacheUpdate: Date | null = null;
  private readonly cacheDuration = 5 * 60 * 1000; // 5 minutes

  // ============================================================================
  // Subscription Methods
  // ============================================================================

  async getSubscriptions(forceRefresh = false): Promise<AzureSubscription[]> {
    if (!forceRefresh && this.isCacheValid() && this.subscriptionCache.length > 0) {
      return this.subscriptionCache;
    }

    try {
      const response = await api.get<SubscriptionListResponse>(`${this.baseUrl}/subscriptions`);
      this.subscriptionCache = response.data.subscriptions;
      this.lastCacheUpdate = new Date();
      return this.subscriptionCache;
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
      throw error;
    }
  }

  // ============================================================================
  // OpenAI Resource Methods
  // ============================================================================

  async getOpenAIResources(
    subscriptionIds?: string[],
    forceRefresh = false
  ): Promise<AzureOpenAIResource[]> {
    const cacheKey = subscriptionIds?.join(',') || 'all';
    
    if (!forceRefresh && this.isCacheValid() && this.resourceCache.has(cacheKey)) {
      return this.resourceCache.get(cacheKey)!;
    }

    try {
      const params = subscriptionIds 
        ? `?subscriptionIds=${subscriptionIds.join(',')}`
        : '';
      const response = await api.get<ResourceListResponse>(
        `${this.baseUrl}/openai-resources${params}`
      );
      
      this.resourceCache.set(cacheKey, response.data.resources);
      this.lastCacheUpdate = new Date();
      return response.data.resources;
    } catch (error) {
      console.error('Failed to fetch OpenAI resources:', error);
      throw error;
    }
  }

  async getDeployments(
    resourceId: string,
    forceRefresh = false
  ): Promise<AzureOpenAIDeployment[]> {
    if (!forceRefresh && this.isCacheValid() && this.deploymentCache.has(resourceId)) {
      return this.deploymentCache.get(resourceId)!;
    }

    try {
      // Base64 encode the resourceId to handle slashes in Azure resource IDs
      const encodedId = btoa(resourceId);
      const response = await api.get<DeploymentListResponse>(
        `${this.baseUrl}/openai-resources/${encodedId}/deployments`
      );
      
      this.deploymentCache.set(resourceId, response.data.deployments);
      this.lastCacheUpdate = new Date();
      return response.data.deployments;
    } catch (error) {
      console.error('Failed to fetch deployments:', error);
      throw error;
    }
  }

  // ============================================================================
  // Database Methods
  // ============================================================================

  async getDatabases(
    subscriptionIds?: string[],
    forceRefresh = false
  ): Promise<AzureSqlDatabase[]> {
    const cacheKey = subscriptionIds?.join(',') || 'all';
    
    if (!forceRefresh && this.isCacheValid() && this.databaseCache.has(cacheKey)) {
      return this.databaseCache.get(cacheKey)!;
    }

    try {
      const params = subscriptionIds 
        ? `?subscriptionIds=${subscriptionIds.join(',')}`
        : '';
      const response = await api.get<DatabaseListResponse>(
        `${this.baseUrl}/databases${params}`
      );
      
      this.databaseCache.set(cacheKey, response.data.databases);
      this.lastCacheUpdate = new Date();
      return response.data.databases;
    } catch (error) {
      console.error('Failed to fetch databases:', error);
      throw error;
    }
  }

  async testDatabaseConnection(connectionString: string): Promise<{
    success: boolean;
    databaseName?: string;
    tableCount?: number;
    latencyMs?: number;
    errorMessage?: string;
  }> {
    try {
      const response = await api.post<{
        success: boolean;
        databaseName?: string;
        tableCount?: number;
        latencyMs?: number;
        errorMessage?: string;
      }>(`${this.baseUrl}/databases/test`, { connectionString });
      return response.data;
    } catch (error) {
      console.error('Failed to test database connection:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  // ============================================================================
  // Auto-Configuration
  // ============================================================================

  async autoConfiguration(): Promise<AzureAutoConfigResult> {
    try {
      const response = await api.post<AzureAutoConfigResult>(`${this.baseUrl}/auto-configure`);
      return response.data;
    } catch (error) {
      console.error('Failed to auto-configure:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Auto-configuration failed',
        discoveredSubscriptions: 0,
        discoveredOpenAIResources: 0,
        discoveredDeployments: 0,
        discoveredDatabases: 0
      };
    }
  }

  async discoverAll(): Promise<AzureDiscoveryResult> {
    try {
      const [subscriptions, resources, databases] = await Promise.all([
        this.getSubscriptions(true),
        this.getOpenAIResources(undefined, true),
        this.getDatabases(undefined, true)
      ]);

      // Get deployments for all resources
      const allDeployments: AzureOpenAIDeployment[] = [];
      for (const resource of resources) {
        try {
          const deployments = await this.getDeployments(resource.id, true);
          allDeployments.push(...deployments);
        } catch {
          // Continue if one fails
        }
      }

      return {
        success: true,
        subscriptions,
        openAIResources: resources,
        sqlServers: [],
        databases,
        discoveredAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        subscriptions: [],
        openAIResources: [],
        sqlServers: [],
        databases: [],
        discoveredAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'Discovery failed'
      };
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  private isCacheValid(): boolean {
    if (!this.lastCacheUpdate) return false;
    return Date.now() - this.lastCacheUpdate.getTime() < this.cacheDuration;
  }

  clearCache(): void {
    this.subscriptionCache = [];
    this.resourceCache.clear();
    this.deploymentCache.clear();
    this.databaseCache.clear();
    this.lastCacheUpdate = null;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  getResourceEndpoint(resource: AzureOpenAIResource): string {
    return resource.endpoint || `https://${resource.name}.openai.azure.com/`;
  }

  formatResourceDisplayName(resource: AzureOpenAIResource): string {
    return `${resource.displayName || resource.name} (${resource.location})`;
  }

  formatDeploymentDisplayName(deployment: AzureOpenAIDeployment): string {
    const modelInfo = deployment.modelVersion 
      ? `${deployment.model} v${deployment.modelVersion}`
      : deployment.model;
    return `${deployment.name} - ${modelInfo}`;
  }
}

// Export singleton instance
export const azureResourceService = new AzureResourceService();
export default azureResourceService;
