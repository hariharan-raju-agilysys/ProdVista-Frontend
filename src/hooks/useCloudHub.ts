/**
 * useCloudHub - Generic provider-agnostic SignalR hook for cloud/monitoring operations.
 * 
 * Connects to /hubs/cloud instead of /hubs/azure. Routes through adapter framework.
 * SOLID O/C: This hook never changes when adding new cloud providers.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'

const API_BASE_URL = (import.meta.env.VITE_BASE_PATH || '').replace(/\/$/, '')

// Types
export interface ProviderInfo {
  providerId: string
  displayName: string
  isConfigured: boolean
}

export interface CloudConnectionStatus {
  connectionId: string
  timestamp: string
  cloud: ProviderInfo
  monitoring: ProviderInfo
  ai: ProviderInfo
  cicd: ProviderInfo
}

export interface CloudResourceUpdate {
  phase: string
  message: string
  operationId: string
  provider?: string
  totalResources: number
  resource?: {
    id: string
    name: string
    type: string
    location: string
    status?: string
  }
  isComplete: boolean
}

export interface CloudLogsResult {
  success: boolean
  provider?: string
  error?: string
  logs?: Array<{
    id: string
    timestamp: string
    level: string
    message: string
    properties?: Record<string, string>
  }>
  rowCount: number
}

export interface CloudMetricsResult {
  success: boolean
  provider?: string
  error?: string
  metrics?: Array<{
    name: string
    value: number
    unit: string
    timestamp: string
  }>
  count: number
}

export interface CloudHealthResult {
  overallHealthy: boolean
  adapters: Record<string, {
    providerId: string
    displayName: string
    isHealthy: boolean
    message?: string
  }>
}

export function useCloudHub() {
  const connectionRef = useRef<signalR.HubConnection | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<CloudConnectionStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Build connection
  useEffect(() => {
    const token = sessionStorage.getItem('prodvista_auth_token')
    if (!token) return

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/cloud`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    connection.on('Connected', (status: CloudConnectionStatus) => {
      setConnectionStatus(status)
    })

    connection.on('OperationStarted', (data: { operationId: string; operation: string; message: string }) => {
      console.log(`[CloudHub] Operation started: ${data.operation} - ${data.message}`)
    })

    connection.on('OperationCompleted', (data: { operationId: string; operation: string; total: number; message: string }) => {
      console.log(`[CloudHub] Operation completed: ${data.operation} - ${data.message}`)
    })

    connection.onreconnecting(() => {
      setIsConnected(false)
      setError('Reconnecting...')
    })

    connection.onreconnected(() => {
      setIsConnected(true)
      setError(null)
    })

    connection.onclose(() => {
      setIsConnected(false)
    })

    connection
      .start()
      .then(() => {
        setIsConnected(true)
        setError(null)
      })
      .catch((err) => {
        setError(`Connection failed: ${err.message}`)
        setIsConnected(false)
      })

    connectionRef.current = connection

    return () => {
      connection.stop()
    }
  }, [])

  // Health check all adapters
  const checkAllHealth = useCallback(async (): Promise<CloudHealthResult | null> => {
    if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) return null
    try {
      return await connectionRef.current.invoke<CloudHealthResult>('CheckAllHealth')
    } catch (err) {
      setError(`Health check failed: ${(err as Error).message}`)
      return null
    }
  }, [])

  // Search logs via monitoring adapter
  const searchLogs = useCallback(async (query?: string, from?: string, to?: string, maxResults?: number): Promise<CloudLogsResult | null> => {
    if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) return null
    try {
      return await connectionRef.current.invoke<CloudLogsResult>('SearchLogs', { query, from, to, maxResults })
    } catch (err) {
      setError(`Log search failed: ${(err as Error).message}`)
      return null
    }
  }, [])

  // Get metrics via monitoring adapter
  const getMetrics = useCallback(async (query?: string, from?: string, to?: string): Promise<CloudMetricsResult | null> => {
    if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) return null
    try {
      return await connectionRef.current.invoke<CloudMetricsResult>('GetMetrics', { query, from, to })
    } catch (err) {
      setError(`Metrics fetch failed: ${(err as Error).message}`)
      return null
    }
  }, [])

  // Stream cloud resources
  const streamResources = useCallback((
    filter?: string,
    onUpdate?: (update: CloudResourceUpdate) => void
  ): (() => void) | undefined => {
    if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) return undefined

    const stream = connectionRef.current.stream<CloudResourceUpdate>('StreamResources', filter)
    const subscription = stream.subscribe({
      next: (update) => onUpdate?.(update),
      error: (err) => setError(`Resource stream error: ${err.message}`),
      complete: () => console.log('[CloudHub] Resource stream complete'),
    })

    return () => subscription.dispose()
  }, [])

  return {
    isConnected,
    connectionStatus,
    error,
    checkAllHealth,
    searchLogs,
    getMetrics,
    streamResources,
    connection: connectionRef.current,
  }
}
