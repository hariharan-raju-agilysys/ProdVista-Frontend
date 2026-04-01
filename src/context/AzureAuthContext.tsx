import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react'
import { useAuth } from './AuthContext'
import { getAzureAuthStatus, refreshAzureAuth } from '../services/api'

// Check if running in development mode
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

// Event for Azure auth state changes
export type AzureAuthEvent = 'authenticated' | 'expired' | 'error' | 'checking';
type AzureAuthListener = (event: AzureAuthEvent, status: AzureAuthStatus | null) => void;

export interface AzureAuthStatus {
  authenticated: boolean
  method: 'AzureCLI' | 'ManagedIdentity' | 'ServicePrincipal' | 'None'
  message: string
  instructions?: string
  user?: {
    name: string
    email: string
  }
}

interface AzureAuthContextType {
  azureStatus: AzureAuthStatus | null
  isAzureAuthenticated: boolean
  isCheckingAzure: boolean
  lastChecked: Date | null
  isDevelopment: boolean
  hasExpired: boolean
  refreshAzureStatus: () => Promise<void>
  retryAzureAuth: () => Promise<void>
  clearExpiredFlag: () => void
  subscribeToAuthEvents: (listener: AzureAuthListener) => () => void
}

const AzureAuthContext = createContext<AzureAuthContextType | null>(null)

// Cache Azure status for 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000
const AZURE_STATUS_KEY = 'prodvista_azure_status'
const AZURE_STATUS_TIME_KEY = 'prodvista_azure_status_time'

function getCachedAzureStatus(): { status: AzureAuthStatus | null; lastChecked: Date | null } {
  try {
    const cached = localStorage.getItem(AZURE_STATUS_KEY)
    const cachedTime = localStorage.getItem(AZURE_STATUS_TIME_KEY)
    
    if (cached && cachedTime) {
      const lastChecked = new Date(cachedTime)
      const now = new Date()
      
      // Return cached if still valid
      if (now.getTime() - lastChecked.getTime() < CACHE_DURATION_MS) {
        return { status: JSON.parse(cached), lastChecked }
      }
    }
  } catch (e) {
    console.warn('Failed to load cached Azure status:', e)
  }
  return { status: null, lastChecked: null }
}

function setCachedAzureStatus(status: AzureAuthStatus) {
  try {
    localStorage.setItem(AZURE_STATUS_KEY, JSON.stringify(status))
    localStorage.setItem(AZURE_STATUS_TIME_KEY, new Date().toISOString())
  } catch (e) {
    console.warn('Failed to cache Azure status:', e)
  }
}

function clearCachedAzureStatus() {
  try {
    localStorage.removeItem(AZURE_STATUS_KEY)
    localStorage.removeItem(AZURE_STATUS_TIME_KEY)
  } catch (e) {
    console.warn('Failed to clear Azure status cache:', e)
  }
}

export function AzureAuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [azureStatus, setAzureStatus] = useState<AzureAuthStatus | null>(() => getCachedAzureStatus().status)
  const [isCheckingAzure, setIsCheckingAzure] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(() => getCachedAzureStatus().lastChecked)
  const [hasExpired, setHasExpired] = useState(false)
  
  // Track previous auth state to detect expiration
  const wasAuthenticatedRef = useRef(azureStatus?.authenticated ?? false)
  const listenersRef = useRef<Set<AzureAuthListener>>(new Set())

  // Notify all listeners of auth events
  const notifyListeners = useCallback((event: AzureAuthEvent, status: AzureAuthStatus | null) => {
    listenersRef.current.forEach(listener => {
      try {
        listener(event, status)
      } catch (e) {
        console.error('Azure auth listener error:', e)
      }
    })
  }, [])

  const subscribeToAuthEvents = useCallback((listener: AzureAuthListener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const clearExpiredFlag = useCallback(() => {
    setHasExpired(false)
  }, [])

  const checkAzureStatus = useCallback(async (force = false) => {
    // Don't check if not authenticated to ProdVista
    if (!isAuthenticated) return

    // Use cached if available and not forced
    if (!force && azureStatus && lastChecked) {
      const now = new Date()
      if (now.getTime() - lastChecked.getTime() < CACHE_DURATION_MS) {
        return
      }
    }

    setIsCheckingAzure(true)
    notifyListeners('checking', null)
    
    try {
      const response = await getAzureAuthStatus()
      const status: AzureAuthStatus = response.data
      
      // Detect expiration: was authenticated, now not
      if (wasAuthenticatedRef.current && !status.authenticated) {
        setHasExpired(true)
        notifyListeners('expired', status)
        clearCachedAzureStatus()
        
        if (isDevelopment) {
          console.warn('[Azure Auth] ⚠️ Session expired! Was authenticated, now not.')
        }
      } else if (status.authenticated) {
        notifyListeners('authenticated', status)
        setHasExpired(false)
      }
      
      wasAuthenticatedRef.current = status.authenticated
      setAzureStatus(status)
      setLastChecked(new Date())
      
      if (status.authenticated) {
        setCachedAzureStatus(status)
      }
      
      if (isDevelopment) {
        console.log('[Azure Auth]', status.authenticated ? '✅ Authenticated via' : '❌ Not authenticated:', status.method, status.message)
      }
    } catch (error) {
      console.error('[Azure Auth] Failed to check status:', error)
      const errorStatus: AzureAuthStatus = {
        authenticated: false,
        method: 'None',
        message: 'Failed to check Azure authentication status',
        instructions: isDevelopment 
          ? 'Run "az login" in your terminal to authenticate with Azure CLI'
          : 'Contact your administrator to configure Azure access',
      }
      
      // If was authenticated, this is an expiration
      if (wasAuthenticatedRef.current) {
        setHasExpired(true)
        notifyListeners('expired', errorStatus)
        clearCachedAzureStatus()
      } else {
        notifyListeners('error', errorStatus)
      }
      
      wasAuthenticatedRef.current = false
      setAzureStatus(errorStatus)
      setLastChecked(new Date())
    } finally {
      setIsCheckingAzure(false)
    }
  }, [isAuthenticated, azureStatus, lastChecked, notifyListeners])

  const retryAzureAuth = useCallback(async () => {
    setIsCheckingAzure(true)
    try {
      // Try to refresh Azure auth
      await refreshAzureAuth()
      // Then check status again
      await checkAzureStatus(true)
    } catch (error) {
      console.error('[Azure Auth] Failed to retry authentication:', error)
    } finally {
      setIsCheckingAzure(false)
    }
  }, [checkAzureStatus])

  // Check Azure status when user authenticates to ProdVista
  useEffect(() => {
    if (isAuthenticated) {
      // Small delay to not block initial render
      const timer = setTimeout(() => {
        checkAzureStatus()
      }, 500)
      return () => clearTimeout(timer)
    } else {
      // Clear Azure status when logged out
      setAzureStatus(null)
      setLastChecked(null)
      setHasExpired(false)
      wasAuthenticatedRef.current = false
    }
  }, [isAuthenticated, checkAzureStatus])

  // Periodic check for expiration (every 2 minutes when authenticated)
  useEffect(() => {
    if (!isAuthenticated || !azureStatus?.authenticated) return
    
    const intervalId = setInterval(() => {
      checkAzureStatus(true)
    }, 2 * 60 * 1000) // Check every 2 minutes
    
    return () => clearInterval(intervalId)
  }, [isAuthenticated, azureStatus?.authenticated, checkAzureStatus])

  const refreshAzureStatus = useCallback(() => checkAzureStatus(true), [checkAzureStatus]);

  const value = useMemo<AzureAuthContextType>(() => ({
    azureStatus,
    isAzureAuthenticated: azureStatus?.authenticated ?? false,
    isCheckingAzure,
    lastChecked,
    isDevelopment,
    hasExpired,
    refreshAzureStatus,
    retryAzureAuth,
    clearExpiredFlag,
    subscribeToAuthEvents,
  }), [azureStatus, isCheckingAzure, lastChecked, hasExpired, refreshAzureStatus, retryAzureAuth, clearExpiredFlag, subscribeToAuthEvents]);

  return (
    <AzureAuthContext.Provider value={value}>
      {children}
    </AzureAuthContext.Provider>
  )
}

export function useAzureAuth() {
  const context = useContext(AzureAuthContext)
  if (!context) {
    throw new Error('useAzureAuth must be used within an AzureAuthProvider')
  }
  return context
}

// Hook for components that need Azure features
export function useRequireAzureAuth() {
  const { isAzureAuthenticated, azureStatus, isCheckingAzure, refreshAzureStatus, hasExpired } = useAzureAuth()
  
  return {
    isReady: isAzureAuthenticated,
    isLoading: isCheckingAzure,
    hasExpired,
    error: !isAzureAuthenticated && !isCheckingAzure ? azureStatus?.message : null,
    instructions: azureStatus?.instructions,
    retry: refreshAzureStatus,
  }
}
