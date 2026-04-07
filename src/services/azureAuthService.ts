import { API_BASE_PATH } from './api'

/**
 * Azure Authentication Service
 * Handles global Azure authentication at the application level
 * One-time login - credentials stored and reused across all Azure features
 */

export interface AzureUser {
  id: string
  email: string
  displayName: string
  tenantId: string
}

export interface AzureAuthState {
  isAuthenticated: boolean
  user: AzureUser | null
  accessToken: string | null
  expiresAt: number | null
  subscriptions: AzureSubscriptionInfo[]
  selectedSubscription: string | null
}

export interface AzureSubscriptionInfo {
  id: string
  subscriptionId: string
  displayName: string
  state: string
  tenantId: string
}

export interface AzureResourceGroup {
  id: string
  name: string
  location: string
  type: string
}

export interface AzureService {
  id: string
  name: string
  type: string
  resourceGroup: string
  location: string
}

class AzureAuthService {
  private static instance: AzureAuthService
  private authState: AzureAuthState = {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    expiresAt: null,
    subscriptions: [],
    selectedSubscription: null,
  }

  private listeners: Set<(state: AzureAuthState) => void> = new Set()

  private constructor() {
    // Load persisted auth state from localStorage
    this.loadFromStorage()
  }

  static getInstance(): AzureAuthService {
    if (!AzureAuthService.instance) {
      AzureAuthService.instance = new AzureAuthService()
    }
    return AzureAuthService.instance
  }

  // Subscribe to auth state changes
  subscribe(listener: (state: AzureAuthState) => void): () => void {
    this.listeners.add(listener)
    listener(this.authState) // Call immediately with current state
    return () => this.listeners.delete(listener)
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.authState))
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('ProdVista-azure-auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        // Check if token is still valid
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          this.authState = parsed
        } else {
          // Token expired, clear it
          this.clearAuth()
        }
      }
    } catch (e) {
      console.error('Failed to load Azure auth from storage:', e)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem('ProdVista-azure-auth', JSON.stringify(this.authState))
    } catch (e) {
      console.error('Failed to save Azure auth to storage:', e)
    }
  }

  getState(): AzureAuthState {
    return this.authState
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && 
           this.authState.expiresAt !== null && 
           this.authState.expiresAt > Date.now()
  }

  getAccessToken(): string | null {
    if (this.isAuthenticated()) {
      return this.authState.accessToken
    }
    return null
  }

  /**
   * Interactive Login - Opens Azure login in browser
   * Uses device code flow or redirect flow
   */
  async loginInteractive(): Promise<AzureAuthState> {
    try {
      // Call backend to initiate OAuth flow
      const response = await fetch(`${API_BASE_PATH}/azure/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to initiate Azure login')
      }

      // Simulate successful login for demo
      // In production, this would handle the OAuth callback
      const mockUser: AzureUser = {
        id: 'user-' + Date.now(),
        email: 'user@company.com',
        displayName: 'Azure User',
        tenantId: 'tenant-' + Date.now(),
      }

      const mockSubscriptions: AzureSubscriptionInfo[] = [
        {
          id: '/subscriptions/sub-prod',
          subscriptionId: 'sub-prod',
          displayName: 'Production Subscription',
          state: 'Enabled',
          tenantId: mockUser.tenantId,
        },
        {
          id: '/subscriptions/sub-dev',
          subscriptionId: 'sub-dev',
          displayName: 'Development Subscription',
          state: 'Enabled',
          tenantId: mockUser.tenantId,
        },
      ]

      this.authState = {
        isAuthenticated: true,
        user: mockUser,
        accessToken: 'mock-token-' + Date.now(),
        expiresAt: Date.now() + 3600 * 1000, // 1 hour
        subscriptions: mockSubscriptions,
        selectedSubscription: mockSubscriptions[0].subscriptionId,
      }

      this.saveToStorage()
      this.notifyListeners()
      return this.authState
    } catch (error) {
      console.error('Azure login failed:', error)
      throw error
    }
  }

  /**
   * Demo Login - Uses mock data, no real Azure connection
   * Also registers/updates user in backend database
   */
  async loginDemo(): Promise<AzureAuthState> {
    // Simulate brief loading
    await new Promise(resolve => setTimeout(resolve, 500))

    const mockUser: AzureUser = {
      id: 'demo-user-' + Date.now().toString().slice(-6),
      email: 'demo@example.com',
      displayName: 'Demo User',
      tenantId: 'demo-tenant',
    }

    const mockSubscriptions: AzureSubscriptionInfo[] = [
      {
        id: '/subscriptions/demo-prod',
        subscriptionId: 'demo-prod',
        displayName: 'Demo Production',
        state: 'Enabled',
        tenantId: 'demo-tenant',
      },
      {
        id: '/subscriptions/demo-dev',
        subscriptionId: 'demo-dev',
        displayName: 'Demo Development',
        state: 'Enabled',
        tenantId: 'demo-tenant',
      },
    ]

    // Register/update user in backend database
    try {
      const loginResponse = await fetch(`${API_BASE_PATH}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azureObjectId: mockUser.id,
          email: mockUser.email,
          displayName: mockUser.displayName,
          tenantId: mockUser.tenantId,
          department: 'Engineering',
          jobTitle: 'Developer',
        }),
      })

      if (loginResponse.ok) {
        const data = await loginResponse.json()
        console.log(data.isNewUser ? 'New user created' : 'User logged in', data.message)
        
        // Store the backend user role info
        if (data.user) {
          localStorage.setItem('ProdVista-user-role', data.user.role)
          localStorage.setItem('ProdVista-user-id', data.user.id.toString())
        }
      }
    } catch (error) {
      console.warn('Backend user sync failed (may be offline):', error)
    }

    this.authState = {
      isAuthenticated: true,
      user: mockUser,
      accessToken: 'demo-token',
      expiresAt: Date.now() + 24 * 3600 * 1000, // 24 hours for demo
      subscriptions: mockSubscriptions,
      selectedSubscription: mockSubscriptions[0].subscriptionId,
    }

    this.saveToStorage()
    this.notifyListeners()
    return this.authState
  }

  /**
   * Logout - Clear all Azure auth state
   */
  logout() {
    this.clearAuth()
    this.notifyListeners()
  }

  private clearAuth() {
    this.authState = {
      isAuthenticated: false,
      user: null,
      accessToken: null,
      expiresAt: null,
      subscriptions: [],
      selectedSubscription: null,
    }
    localStorage.removeItem('ProdVista-azure-auth')
  }

  /**
   * Select subscription
   */
  selectSubscription(subscriptionId: string) {
    if (this.authState.subscriptions.some(s => s.subscriptionId === subscriptionId)) {
      this.authState.selectedSubscription = subscriptionId
      this.saveToStorage()
      this.notifyListeners()
    }
  }

  /**
   * Get Resource Groups for selected subscription
   */
  async getResourceGroups(): Promise<AzureResourceGroup[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Azure')
    }

    // In production, call: GET /api/azure/subscriptions/{subId}/resourceGroups
    // For demo, return mock data
    await new Promise(resolve => setTimeout(resolve, 500))

    return [
      { id: 'rg-1', name: 'rg-production-apps', location: 'eastus', type: 'Microsoft.Resources/resourceGroups' },
      { id: 'rg-2', name: 'rg-production-data', location: 'eastus', type: 'Microsoft.Resources/resourceGroups' },
      { id: 'rg-3', name: 'rg-shared-services', location: 'westus', type: 'Microsoft.Resources/resourceGroups' },
    ]
  }

  /**
   * Get Services/Resources in a resource group
   */
  async getServices(resourceGroup: string): Promise<AzureService[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Azure')
    }

    // In production, call Azure Resource Manager API
    await new Promise(resolve => setTimeout(resolve, 500))

    return [
      { id: 'svc-1', name: 'ProdVista-api-app', type: 'Microsoft.Web/sites', resourceGroup, location: 'eastus' },
      { id: 'svc-2', name: 'ProdVista-container-app', type: 'Microsoft.App/containerApps', resourceGroup, location: 'eastus' },
      { id: 'svc-3', name: 'ProdVista-aks-cluster', type: 'Microsoft.ContainerService/managedClusters', resourceGroup, location: 'eastus' },
      { id: 'svc-4', name: 'ProdVista-functions', type: 'Microsoft.Web/sites', resourceGroup, location: 'eastus' },
    ]
  }

  /**
   * Get logs from Azure Monitor
   */
  async getLogs(_query: string, _timeRange: string = '1h'): Promise<any[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Azure')
    }

    // In production, call: POST /api/azure/logs/query
    // For demo, return mock logs
    await new Promise(resolve => setTimeout(resolve, 300))

    const now = Date.now()
    return [
      { timestamp: new Date(now - 1000).toISOString(), level: 'info', message: 'Application started successfully', source: 'ProdVista-api' },
      { timestamp: new Date(now - 5000).toISOString(), level: 'warn', message: 'High memory usage detected: 85%', source: 'ProdVista-api' },
      { timestamp: new Date(now - 10000).toISOString(), level: 'error', message: 'Database connection timeout', source: 'ProdVista-api' },
      { timestamp: new Date(now - 15000).toISOString(), level: 'info', message: 'Request processed: GET /api/users', source: 'ProdVista-api' },
    ]
  }

  /**
   * Get metrics from Azure Monitor
   */
  async getMetrics(_resourceId: string, _metricNames: string[]): Promise<any> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Azure')
    }

    // Mock metrics data
    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      cpu: { current: 45, average: 38, peak: 72 },
      memory: { current: 68, average: 55, peak: 85 },
      requests: { current: 1250, average: 980, peak: 2100 },
      errors: { current: 12, average: 8, peak: 25 },
    }
  }
}

// Export singleton instance
export const azureAuth = AzureAuthService.getInstance()
export default azureAuth
