/**
 * useAzure - React Hook for Azure Service Integration
 * 
 * Provides reactive access to Azure service state with automatic
 * subscription management and state updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import azureService, {
  type AzureServiceStatus,
  type AzureAuthStatus,
  type AzureOpenAIResource,
  type AzureSubscription,
  type AzureOpenAIDeployment
} from '../services/azureService'

export interface UseAzureReturn {
  // State
  status: AzureServiceStatus
  isLoading: boolean
  isReady: boolean
  isAuthenticated: boolean
  error: string | null
  
  // Data
  authStatus: AzureAuthStatus | null
  subscriptions: AzureSubscription[]
  resources: AzureOpenAIResource[]
  
  // Selection state (managed by this hook)
  selectedSubscription: AzureSubscription | null
  selectedResource: AzureOpenAIResource | null
  selectedDeployment: AzureOpenAIDeployment | null
  
  // Actions
  discover: (options?: { subscriptionId?: string; forceRefresh?: boolean }) => Promise<void>
  selectSubscription: (subscription: AzureSubscription | null) => void
  selectResource: (resource: AzureOpenAIResource | null) => void
  selectDeployment: (deployment: AzureOpenAIDeployment | null) => void
  clearCache: () => void
  getAccessToken: () => Promise<string | null>
  
  // Helpers
  getResourcesForSubscription: (subscriptionId: string) => AzureOpenAIResource[]
  getDeploymentsForResource: (resourceId: string) => AzureOpenAIDeployment[]
  getRecommendedConfig: () => ReturnType<typeof azureService.getRecommendedConfig>
  autoSelectBest: () => void
}

export interface UseAzureOptions {
  /** Auto-discover on mount */
  autoDiscover?: boolean
  /** Auto-select best available resource/deployment */
  autoSelect?: boolean
  /** Callback when selection changes */
  onSelectionChange?: (config: {
    endpoint: string
    deployment: string
    modelName: string
  } | null) => void
}

export function useAzure(options: UseAzureOptions = {}): UseAzureReturn {
  const {
    autoDiscover = false,
    autoSelect = false,
    onSelectionChange
  } = options

  // Service state
  const [status, setStatus] = useState<AzureServiceStatus>(azureService.getStatus())
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([])
  const [resources, setResources] = useState<AzureOpenAIResource[]>([])
  const [authStatus, setAuthStatus] = useState<AzureAuthStatus | null>(azureService.getAuthStatus())
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectedSubscription, setSelectedSubscription] = useState<AzureSubscription | null>(null)
  const [selectedResource, setSelectedResource] = useState<AzureOpenAIResource | null>(null)
  const [selectedDeployment, setSelectedDeployment] = useState<AzureOpenAIDeployment | null>(null)

  // Refs for callbacks
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange

  // Derived state
  const isLoading = status.state === 'authenticating' || status.state === 'discovering'
  const isReady = status.state === 'ready'
  const isAuthenticated = authStatus?.isAuthenticated ?? false

  // Subscribe to service events
  useEffect(() => {
    const unsubscribeState = azureService.on('state:changed', (newStatus: AzureServiceStatus) => {
      setStatus(newStatus)
      if (newStatus.error) {
        setError(newStatus.error)
      }
    })

    const unsubscribeLoaded = azureService.on('resources:loaded', () => {
      setSubscriptions(azureService.getSubscriptions())
      setResources(azureService.getResources())
      setAuthStatus(azureService.getAuthStatus())
      setError(null)
    })

    const unsubscribeError = azureService.on('resources:error', (err: Error) => {
      setError(err.message)
    })

    const unsubscribeClear = azureService.on('cache:cleared', () => {
      setSubscriptions([])
      setResources([])
      setSelectedSubscription(null)
      setSelectedResource(null)
      setSelectedDeployment(null)
    })

    return () => {
      unsubscribeState()
      unsubscribeLoaded()
      unsubscribeError()
      unsubscribeClear()
    }
  }, [])

  // Auto-discover on mount
  useEffect(() => {
    if (autoDiscover) {
      discover()
    }
  }, [autoDiscover])

  // Auto-select when resources are loaded
  useEffect(() => {
    if (autoSelect && isReady && resources.length > 0 && !selectedResource) {
      autoSelectBest()
    }
  }, [autoSelect, isReady, resources])

  // Notify on selection change
  useEffect(() => {
    if (onSelectionChangeRef.current) {
      if (selectedResource && selectedDeployment) {
        onSelectionChangeRef.current({
          endpoint: selectedResource.endpoint,
          deployment: selectedDeployment.name,
          modelName: selectedDeployment.modelName
        })
      } else {
        onSelectionChangeRef.current(null)
      }
    }
  }, [selectedResource, selectedDeployment])

  // Actions
  const discover = useCallback(async (opts?: { subscriptionId?: string; forceRefresh?: boolean }) => {
    try {
      setError(null)
      await azureService.discoverResources(opts)
    } catch (err: any) {
      const errorMessage = err?.response?.status === 401
        ? 'Session expired - please log out and log back in'
        : err?.response?.status === 404
        ? 'API endpoint not found - check backend is running'
        : err?.message || 'Failed to discover Azure resources'
      setError(errorMessage)
    }
  }, [])

  const selectSubscription = useCallback((subscription: AzureSubscription | null) => {
    setSelectedSubscription(subscription)
    // Clear dependent selections
    setSelectedResource(null)
    setSelectedDeployment(null)
  }, [])

  const selectResource = useCallback((resource: AzureOpenAIResource | null) => {
    setSelectedResource(resource)
    // Auto-select first deployment if available
    if (resource?.deployments.length) {
      setSelectedDeployment(resource.deployments[0])
    } else {
      setSelectedDeployment(null)
    }
  }, [])

  const selectDeployment = useCallback((deployment: AzureOpenAIDeployment | null) => {
    setSelectedDeployment(deployment)
  }, [])

  const clearCache = useCallback(() => {
    azureService.clearCache()
  }, [])

  const getAccessToken = useCallback(() => {
    return azureService.getAccessToken()
  }, [])

  // Helpers
  const getResourcesForSubscription = useCallback((subscriptionId: string) => {
    return resources.filter(r => r.subscriptionId === subscriptionId)
  }, [resources])

  const getDeploymentsForResource = useCallback((resourceId: string) => {
    return resources.find(r => r.id === resourceId)?.deployments || []
  }, [resources])

  const getRecommendedConfig = useCallback(() => {
    return azureService.getRecommendedConfig()
  }, [])

  const autoSelectBest = useCallback(() => {
    const recommended = azureService.getRecommendedConfig()
    if (recommended) {
      // Find and select the subscription
      const sub = subscriptions.find(s => s.id === recommended.resource.subscriptionId)
      if (sub) setSelectedSubscription(sub)
      
      setSelectedResource(recommended.resource)
      const deployment = recommended.resource.deployments.find(d => d.name === recommended.deployment)
      if (deployment) setSelectedDeployment(deployment)
    }
  }, [subscriptions])

  return {
    // State
    status,
    isLoading,
    isReady,
    isAuthenticated,
    error,
    
    // Data
    authStatus,
    subscriptions,
    resources,
    
    // Selection
    selectedSubscription,
    selectedResource,
    selectedDeployment,
    
    // Actions
    discover,
    selectSubscription,
    selectResource,
    selectDeployment,
    clearCache,
    getAccessToken,
    
    // Helpers
    getResourcesForSubscription,
    getDeploymentsForResource,
    getRecommendedConfig,
    autoSelectBest
  }
}

export default useAzure
