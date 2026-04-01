/**
 * useAzureAuth Hook
 * React hook for Azure authentication state
 * Automatically updates when auth state changes
 */

import { useState, useEffect, useCallback } from 'react'
import azureAuth, { AzureAuthState, AzureResourceGroup, AzureService } from '../services/azureAuthService'

export function useAzureAuth() {
  const [authState, setAuthState] = useState<AzureAuthState>(azureAuth.getState())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = azureAuth.subscribe(setAuthState)
    return unsubscribe
  }, [])

  const loginInteractive = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await azureAuth.loginInteractive()
    } catch (err: any) {
      setError(err.message || 'Login failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loginDemo = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await azureAuth.loginDemo()
    } catch (err: any) {
      setError(err.message || 'Demo login failed')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    azureAuth.logout()
  }, [])

  const selectSubscription = useCallback((subscriptionId: string) => {
    azureAuth.selectSubscription(subscriptionId)
  }, [])

  return {
    // State
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    subscriptions: authState.subscriptions,
    selectedSubscription: authState.selectedSubscription,
    isLoading,
    error,

    // Actions
    loginInteractive,
    loginDemo,
    logout,
    selectSubscription,
  }
}

/**
 * useAzureResources Hook
 * Fetches Azure resources when authenticated
 */
export function useAzureResources() {
  const { isAuthenticated } = useAzureAuth()
  const [resourceGroups, setResourceGroups] = useState<AzureResourceGroup[]>([])
  const [services, setServices] = useState<AzureService[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchResourceGroups = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    setError(null)
    try {
      const groups = await azureAuth.getResourceGroups()
      setResourceGroups(groups)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  const fetchServices = useCallback(async (resourceGroup: string) => {
    if (!isAuthenticated) return
    setIsLoading(true)
    setError(null)
    try {
      const svcs = await azureAuth.getServices(resourceGroup)
      setServices(svcs)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  return {
    resourceGroups,
    services,
    isLoading,
    error,
    fetchResourceGroups,
    fetchServices,
  }
}

/**
 * useAzureLogs Hook
 * Fetches logs from Azure Monitor
 */
export function useAzureLogs() {
  const { isAuthenticated } = useAzureAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async (query: string = '*', timeRange: string = '1h') => {
    if (!isAuthenticated) return []
    setIsLoading(true)
    setError(null)
    try {
      const data = await azureAuth.getLogs(query, timeRange)
      setLogs(data)
      return data
    } catch (err: any) {
      setError(err.message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  return {
    logs,
    isLoading,
    error,
    fetchLogs,
  }
}

/**
 * useAzureMetrics Hook
 * Fetches metrics from Azure Monitor
 */
export function useAzureMetrics() {
  const { isAuthenticated } = useAzureAuth()
  const [metrics, setMetrics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async (resourceId: string, metricNames: string[] = []) => {
    if (!isAuthenticated) return null
    setIsLoading(true)
    setError(null)
    try {
      const data = await azureAuth.getMetrics(resourceId, metricNames)
      setMetrics(data)
      return data
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  return {
    metrics,
    isLoading,
    error,
    fetchMetrics,
  }
}

export default useAzureAuth
