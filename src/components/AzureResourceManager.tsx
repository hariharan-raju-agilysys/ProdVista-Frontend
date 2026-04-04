import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cloud, CheckCircle2, AlertTriangle, Loader2, RefreshCw,
  Activity, Star, StarOff,
  ChevronDown, ChevronRight, Search,
  HardDrive, BarChart3, Terminal,
  Check
} from 'lucide-react'
import {
  getResourceGraphSubscriptions,
  getResourceGraphMonitoring,
  getResourceGraphByType,
  getTenantAzureSettings,
  updateTenantAzureSettings,
  addFavoriteWorkspace,
  removeFavoriteWorkspace,
  refreshAzureAuth,
} from '../services/api'

// Check if we're in development mode
const isDev = import.meta.env.DEV;

// Loading step indicator with "up next" preview
function LoadingSteps({ steps }: { steps: { label: string; status: 'pending' | 'loading' | 'done' | 'error'; count?: number; icon?: string }[] }) {
  // Find current loading index and next pending
  const currentLoadingIdx = steps.findIndex(s => s.status === 'loading');
  const nextPendingIdx = steps.findIndex((s, i) => s.status === 'pending' && i > currentLoadingIdx);
  
  return (
    <div className="space-y-2">
      {steps.map((step, idx) => {
        const isNext = idx === nextPendingIdx && currentLoadingIdx !== -1;
        
        return (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08 }}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              step.status === 'loading' ? 'bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/10' :
              step.status === 'done' ? 'bg-green-500/10 border-green-500/30' :
              step.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
              isNext ? 'bg-gray-700/30 border-gray-600 border-dashed' :
              'bg-gray-800/30 border-gray-700/50'
            }`}
          >
            {/* Step number or status icon */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              step.status === 'loading' ? 'bg-blue-500 text-white' :
              step.status === 'done' ? 'bg-green-500 text-white' :
              step.status === 'error' ? 'bg-red-500 text-white' :
              isNext ? 'bg-gray-600 text-gray-300' :
              'bg-gray-700 text-gray-500'
            }`}>
              {step.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              {step.status === 'done' && <CheckCircle2 className="w-4 h-4" />}
              {step.status === 'error' && <AlertTriangle className="w-4 h-4" />}
              {step.status === 'pending' && (idx + 1)}
            </div>
            
            <div className="flex-1">
              <span className={`block ${
                step.status === 'loading' ? 'text-blue-400 font-medium' :
                step.status === 'done' ? 'text-green-400' :
                step.status === 'error' ? 'text-red-400' :
                isNext ? 'text-gray-300' :
                'text-gray-500'
              }`}>
                {step.label}
              </span>
              {step.status === 'loading' && (
                <span className="text-xs text-blue-400/70">Loading...</span>
              )}
              {isNext && step.status === 'pending' && (
                <span className="text-xs text-gray-500">Up next</span>
              )}
            </div>
            
            {step.status === 'done' && step.count !== undefined && (
              <span className="text-sm text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30">
                {step.count} found
              </span>
            )}
          </motion.div>
        );
      })}
      
      {/* Progress bar */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Progress</span>
          <span>{steps.filter(s => s.status === 'done').length} / {steps.length} complete</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500"
            initial={{ width: 0 }}
            animate={{ 
              width: `${(steps.filter(s => s.status === 'done').length / steps.length) * 100}%` 
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  );
}

// Detailed loading state type
interface LoadingState {
  auth: 'pending' | 'loading' | 'done' | 'error';
  subscriptions: 'pending' | 'loading' | 'done' | 'error';
  workspaces: 'pending' | 'loading' | 'done' | 'error';
  appInsights: 'pending' | 'loading' | 'done' | 'error';
  storageAccounts: 'pending' | 'loading' | 'done' | 'error';
}

// Cache to prevent redundant API calls across component remounts
const discoveryCache = {
  subscriptions: [] as Subscription[],
  workspaces: [] as Workspace[],
  appInsights: [] as AppInsightsResource[],
  storageAccounts: [] as StorageAccount[],
  authStatus: null as AuthStatus | null,
  projectConfig: null as ProjectAzureConfig | null,
  lastDiscoveryTime: 0,
}

interface Subscription {
  id: string
  subscriptionId: string
  displayName: string
  state: string
  tenantId?: string
}



interface Workspace {
  id: string
  name: string
  resourceGroup: string
  location: string
  subscriptionId?: string
}

interface AppInsightsResource {
  id: string
  name: string
  resourceGroup: string
  location: string
  instrumentationKey?: string
  subscriptionId?: string
}

interface StorageAccount {
  id: string
  name: string
  resourceGroup: string
  location: string
  subscriptionId?: string
}

interface AuthStatus {
  authenticated: boolean
  method: string
  message: string
  user?: { name: string; email: string }
}

interface ProjectAzureConfig {
  defaultSubscriptionId?: string
  defaultWorkspaceId?: string
  defaultAppInsightsId?: string
  defaultStorageAccountId?: string
  favoriteResources: string[]
  enabledResourceTypes: string[]
}



export default function AzureResourceManager() {
  // Track if discovery is in progress globally
  const isDiscoveryInProgress = useRef(false)
  
  // Auth state
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(discoveryCache.authStatus)
  const [loading, setLoading] = useState(!discoveryCache.authStatus)
  const [refreshing, setRefreshing] = useState(false)

  // Detailed loading state for each endpoint
  const [loadingState, setLoadingState] = useState<LoadingState>({
    auth: discoveryCache.authStatus ? 'done' : 'pending',
    subscriptions: discoveryCache.subscriptions.length > 0 ? 'done' : 'pending',
    workspaces: discoveryCache.workspaces.length > 0 ? 'done' : 'pending',
    appInsights: discoveryCache.appInsights.length > 0 ? 'done' : 'pending',
    storageAccounts: discoveryCache.storageAccounts.length > 0 ? 'done' : 'pending',
  })

  // Discovery state - all resources auto-discovered from Azure CLI
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(discoveryCache.subscriptions)
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>(discoveryCache.workspaces)
  const [allAppInsights, setAllAppInsights] = useState<AppInsightsResource[]>(discoveryCache.appInsights)
  const [allStorageAccounts, setAllStorageAccounts] = useState<StorageAccount[]>(discoveryCache.storageAccounts)
  const [discoveryProgress, setDiscoveryProgress] = useState<string>('')
  const [isDiscovering, setIsDiscovering] = useState(false)

  // Project configuration
  const [projectConfig, setProjectConfig] = useState<ProjectAzureConfig>(
    discoveryCache.projectConfig || {
      favoriteResources: [],
      enabledResourceTypes: ['workspaces', 'appinsights', 'storageaccounts'],
    }
  )

  // UI state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    workspaces: true,
    appinsights: true,
    storageaccounts: true,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Cache expiry: 5 minutes
  const CACHE_TTL = 5 * 60 * 1000
  const isCacheValid = () => Date.now() - discoveryCache.lastDiscoveryTime < CACHE_TTL

  // Check auth and auto-discover on mount, but use cache if valid
  useEffect(() => {
    // If cache is valid and we have data, skip discovery
    if (isCacheValid() && discoveryCache.subscriptions.length > 0) {
      setLoading(false)
      setDiscoveryProgress(`Using cached data (${discoveryCache.workspaces.length} workspaces, ${discoveryCache.appInsights.length} App Insights, ${discoveryCache.storageAccounts.length} storage accounts)`)
      return
    }
    
    // Prevent concurrent discoveries
    if (isDiscoveryInProgress.current) {
      return
    }
    
    checkAuthAndDiscover()
  }, [])

  const checkAuthAndDiscover = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent calls
    if (isDiscoveryInProgress.current && !forceRefresh) {
      return
    }
    
    isDiscoveryInProgress.current = true
    setLoading(true)
    setLoadingState(prev => ({ ...prev, auth: 'loading' }))
    
    try {
      // Check auth status
      const response = await fetch('/api/azure/auth-status')
      const status = await response.json()
      setAuthStatus(status)
      discoveryCache.authStatus = status
      setLoadingState(prev => ({ ...prev, auth: 'done' }))

      if (status.authenticated) {
        // Load saved project config
        await loadProjectConfig()
        // Auto-discover all resources
        await discoverAllResources()
      }
    } catch (err) {
      console.error('Auth check failed:', err)
      setLoadingState(prev => ({ ...prev, auth: 'error' }))
      setAuthStatus({
        authenticated: false,
        method: 'Unknown',
        message: 'Failed to check Azure authentication',
      })
    }
    setLoading(false)
    isDiscoveryInProgress.current = false
  }, [])

  const loadProjectConfig = async () => {
    try {
      const settings = await getTenantAzureSettings()
      if (settings) {
        const config = {
          defaultSubscriptionId: settings.defaultSubscriptionId,
          defaultWorkspaceId: settings.defaultWorkspaceId,
          defaultAppInsightsId: settings.defaultAppInsightsId,
          defaultStorageAccountId: settings.defaultStorageAccountId,
          favoriteResources: settings.favoriteWorkspaces?.map((f: { resourceId: string }) => f.resourceId) || [],
          enabledResourceTypes: settings.enabledResourceTypes || ['workspaces', 'appinsights', 'storageaccounts'],
        }
        setProjectConfig(config)
        discoveryCache.projectConfig = config
      }
    } catch {
      console.log('No saved project config')
    }
  }

  const discoverAllResources = async () => {
    setIsDiscovering(true)
    setDiscoveryProgress('Discovering subscriptions via Resource Graph...')
    setLoadingState(prev => ({ 
      ...prev, 
      subscriptions: 'loading',
      workspaces: 'pending',
      appInsights: 'pending',
      storageAccounts: 'pending'
    }))

    try {
      // Get all subscriptions using Resource Graph (single API call)
      const { data: subData } = await getResourceGraphSubscriptions()
      const subs = (subData.subscriptions || []).map((s: any) => ({
        id: s.id,
        subscriptionId: s.subscriptionId,
        displayName: s.name || s.displayName,
        state: s.state || 'Enabled',
        tenantId: s.tenantId
      }))
      setSubscriptions(subs)
      discoveryCache.subscriptions = subs
      setLoadingState(prev => ({ ...prev, subscriptions: 'done' }))
      console.log(`Loaded ${subs.length} subscriptions via Resource Graph in ${subData.queryTimeMs}ms`)

      if (subs.length === 0) {
        setDiscoveryProgress('No subscriptions found')
        setIsDiscovering(false)
        setLoadingState(prev => ({ 
          ...prev, 
          workspaces: 'done',
          appInsights: 'done',
          storageAccounts: 'done'
        }))
        return
      }

      // Set all resource types to loading
      setLoadingState(prev => ({ 
        ...prev, 
        workspaces: 'loading',
        appInsights: 'loading',
        storageAccounts: 'loading'
      }))

      // Get all subscriptions IDs for Resource Graph query
      const subIds = subs.map((s: any) => s.subscriptionId)
      setDiscoveryProgress('Discovering resources via Resource Graph (single query)...')

      // Use Resource Graph for single-call discovery of all resources
      const [monitoringRes, storageRes] = await Promise.all([
        getResourceGraphMonitoring(subIds),
        getResourceGraphByType('microsoft.storage/storageaccounts', subIds)
      ])

      // Map workspaces with subscription info
      const workspaces = (monitoringRes.data.workspaces || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        resourceGroup: w.resourceGroup,
        location: w.location,
        subscriptionId: w.subscriptionId,
        subscriptionName: subs.find((s: any) => s.subscriptionId === w.subscriptionId)?.displayName || 'Unknown'
      }))

      // Map App Insights with subscription info
      const appInsights = (monitoringRes.data.appInsights || []).map((ai: any) => ({
        id: ai.id,
        name: ai.name,
        resourceGroup: ai.resourceGroup,
        location: ai.location,
        subscriptionId: ai.subscriptionId,
        subscriptionName: subs.find((s: any) => s.subscriptionId === ai.subscriptionId)?.displayName || 'Unknown'
      }))

      // Map storage accounts with subscription info
      const storageAccounts = (storageRes.data.resources || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        resourceGroup: s.resourceGroup,
        location: s.location,
        subscriptionId: s.subscriptionId,
        subscriptionName: subs.find((sub: any) => sub.subscriptionId === s.subscriptionId)?.displayName || 'Unknown'
      }))

      setAllWorkspaces(workspaces)
      setAllAppInsights(appInsights)
      setAllStorageAccounts(storageAccounts)
      
      // Update cache
      discoveryCache.workspaces = workspaces
      discoveryCache.appInsights = appInsights
      discoveryCache.storageAccounts = storageAccounts
      discoveryCache.lastDiscoveryTime = Date.now()
      
      // Mark all as done
      setLoadingState(prev => ({ 
        ...prev, 
        workspaces: 'done',
        appInsights: 'done',
        storageAccounts: 'done'
      }))
      
      const totalTime = (monitoringRes.data.queryTimeMs || 0) + (storageRes.data.queryTimeMs || 0)
      setDiscoveryProgress(`Found ${workspaces.length} workspaces, ${appInsights.length} App Insights, ${storageAccounts.length} storage accounts (${totalTime}ms)`)
      console.log(`Resource Graph discovery complete: ${workspaces.length} workspaces, ${appInsights.length} App Insights, ${storageAccounts.length} storage in ${totalTime}ms`)

    } catch (err) {
      console.error('Discovery failed:', err)
      setDiscoveryProgress('Discovery failed - check Azure access')
      setLoadingState(prev => ({ 
        ...prev, 
        subscriptions: 'error',
        workspaces: 'error',
        appInsights: 'error',
        storageAccounts: 'error'
      }))
    }

    setIsDiscovering(false)
  }

  const handleRefreshAuth = async () => {
    setRefreshing(true)
    // Clear cache to force fresh discovery
    discoveryCache.lastDiscoveryTime = 0
    try {
      const { data } = await refreshAzureAuth()
      if (data.success) {
        // Re-check auth and discover with force refresh
        await checkAuthAndDiscover(true)
      }
    } catch {
      // Will trigger browser login
    }
    setRefreshing(false)
  }

  const handleManualRefresh = async () => {
    // Clear cache and force re-discovery
    discoveryCache.lastDiscoveryTime = 0
    isDiscoveryInProgress.current = false
    await discoverAllResources()
  }

  const toggleFavorite = async (resourceId: string) => {
    const isCurrentlyFavorite = projectConfig.favoriteResources.includes(resourceId)
    
    // Update local state immediately for responsive UI
    setProjectConfig(prev => ({
      ...prev,
      favoriteResources: isCurrentlyFavorite
        ? prev.favoriteResources.filter(id => id !== resourceId)
        : [...prev.favoriteResources, resourceId],
    }))
    
    // Persist to server
    try {
      if (isCurrentlyFavorite) {
        await removeFavoriteWorkspace(resourceId)
      } else {
        await addFavoriteWorkspace({ resourceId })
      }
    } catch (err) {
      console.warn('Failed to sync favorite status:', err)
    }
  }

  const setDefaultResource = (type: 'workspace' | 'appinsights' | 'storage', resourceId: string) => {
    setProjectConfig(prev => ({
      ...prev,
      ...(type === 'workspace' && { defaultWorkspaceId: prev.defaultWorkspaceId === resourceId ? undefined : resourceId }),
      ...(type === 'appinsights' && { defaultAppInsightsId: prev.defaultAppInsightsId === resourceId ? undefined : resourceId }),
      ...(type === 'storage' && { defaultStorageAccountId: prev.defaultStorageAccountId === resourceId ? undefined : resourceId }),
    }))
  }

  const saveProjectConfig = async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      // Save default settings
      await updateTenantAzureSettings({
        defaultSubscriptionId: projectConfig.defaultSubscriptionId,
        defaultWorkspaceId: projectConfig.defaultWorkspaceId,
        defaultWorkspaceName: allWorkspaces.find(w => w.id === projectConfig.defaultWorkspaceId)?.name,
        defaultAppInsightsId: projectConfig.defaultAppInsightsId,
        defaultAppInsightsName: allAppInsights.find(a => a.id === projectConfig.defaultAppInsightsId)?.name,
        defaultStorageAccountName: allStorageAccounts.find(s => s.id === projectConfig.defaultStorageAccountId)?.name,
      })
      
      // Save favorites separately
      for (const resourceId of projectConfig.favoriteResources) {
        try {
          await addFavoriteWorkspace({ resourceId })
        } catch {
          // May already exist, ignore
        }
      }
      
      setSaveMessage('Settings saved successfully!')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage('Failed to save settings')
    }
    setSaving(false)
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const filterResources = <T extends { name: string; resourceGroup?: string }>(resources: T[]): T[] => {
    if (!searchQuery) return resources
    const q = searchQuery.toLowerCase()
    return resources.filter(r => 
      r.name.toLowerCase().includes(q) || 
      r.resourceGroup?.toLowerCase().includes(q)
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Cloud className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Connecting to Azure</h3>
              <p className="text-gray-400 text-sm">Auto-discovering your resources...</p>
            </div>
          </div>
          
          <LoadingSteps steps={[
            { 
              label: 'Checking authentication', 
              status: loadingState.auth,
            },
            { 
              label: 'Loading subscriptions', 
              status: loadingState.subscriptions,
              count: loadingState.subscriptions === 'done' ? subscriptions.length : undefined
            },
            { 
              label: 'Loading Log Analytics workspaces', 
              status: loadingState.workspaces,
              count: loadingState.workspaces === 'done' ? allWorkspaces.length : undefined
            },
            { 
              label: 'Loading Application Insights', 
              status: loadingState.appInsights,
              count: loadingState.appInsights === 'done' ? allAppInsights.length : undefined
            },
            { 
              label: 'Loading Storage Accounts', 
              status: loadingState.storageAccounts,
              count: loadingState.storageAccounts === 'done' ? allStorageAccounts.length : undefined
            },
          ]} />
          
          {discoveryProgress && (
            <p className="mt-4 text-sm text-gray-400 text-center">{discoveryProgress}</p>
          )}
        </div>
      </div>
    )
  }

  // Not authenticated - show login prompt
  if (!authStatus?.authenticated) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 border border-gray-700">
        <div className="text-center max-w-lg mx-auto">
          <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-6">
            <Cloud className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Connect to Azure</h2>
          <p className="text-gray-400 mb-6">
            {isDev 
              ? 'Auto-discover all Azure resources you have access to via Azure CLI or SSO credentials.'
              : 'Connect to Azure using your organization\'s Microsoft account.'
            }
          </p>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium">Authentication Required</p>
                <p className="text-amber-400/70 text-sm">{authStatus?.message}</p>
              </div>
            </div>
          </div>

          {/* DEV MODE: Azure CLI Quick Connect */}
          {isDev && (
            <div className="bg-gray-900 rounded-lg p-6 text-left mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded">DEV ONLY</span>
              </div>
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Quick Connect via Azure CLI
              </h3>
              <ol className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
                  <span>Open a terminal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
                  <div>
                    <span>Run: </span>
                    <code className="bg-gray-800 px-2 py-0.5 rounded font-mono">az login</code>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
                  <span>Complete login in browser</span>
                </li>
              </ol>
            </div>
          )}

          <div className="flex gap-3">
            {isDev && (
              <button
                onClick={handleRefreshAuth}
                disabled={refreshing}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/50 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {refreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Terminal className="w-4 h-4" />
                    Auto Login (CLI)
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => checkAuthAndDiscover(true)}
              className={`${isDev ? '' : 'flex-1'} px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2`}
            >
              <RefreshCw className="w-4 h-4" />
              Check Status
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Authenticated - show resource manager
  return (
    <div className="space-y-6">
      {/* Header with status */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-4 border border-green-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Connected to Azure</h3>
              <p className="text-green-400/80 text-sm">
                {authStatus.user?.email || authStatus.method} • {subscriptions.length} subscription(s) accessible
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isDiscovering}
              className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isDiscovering ? 'animate-spin' : ''}`} />
              {isDiscovering ? 'Scanning...' : 'Refresh All'}
            </button>
            <button
              onClick={saveProjectConfig}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
        {discoveryProgress && (
          <p className="mt-2 text-sm text-gray-400">{discoveryProgress}</p>
        )}
        {saveMessage && (
          <div className={`mt-2 text-sm ${saveMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
            {saveMessage}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search all resources..."
          className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Subscriptions Overview */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Available Subscriptions</h4>
        <div className="flex flex-wrap gap-2">
          {subscriptions.map(sub => (
            <div
              key={sub.subscriptionId}
              className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${
                projectConfig.defaultSubscriptionId === sub.subscriptionId
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                  : 'bg-gray-900 border-gray-700 text-gray-300'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{sub.displayName}</span>
              {sub.state === 'Enabled' && <span className="w-2 h-2 bg-green-500 rounded-full" />}
            </div>
          ))}
        </div>
      </div>

      {/* Log Analytics Workspaces */}
      <ResourceSection
        title="Log Analytics Workspaces"
        icon={BarChart3}
        iconColor="text-blue-400"
        resources={filterResources(allWorkspaces)}
        expanded={expandedSections.workspaces}
        onToggle={() => toggleSection('workspaces')}
        defaultId={projectConfig.defaultWorkspaceId}
        favorites={projectConfig.favoriteResources}
        onSetDefault={(id) => setDefaultResource('workspace', id)}
        onToggleFavorite={toggleFavorite}
        renderItem={(ws) => (
          <div key={ws.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <BarChart3 className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{ws.name}</p>
                <p className="text-gray-500 text-sm truncate">{ws.resourceGroup} • {ws.location}</p>
              </div>
            </div>
          </div>
        )}
      />

      {/* Application Insights */}
      <ResourceSection
        title="Application Insights"
        icon={Activity}
        iconColor="text-purple-400"
        resources={filterResources(allAppInsights)}
        expanded={expandedSections.appinsights}
        onToggle={() => toggleSection('appinsights')}
        defaultId={projectConfig.defaultAppInsightsId}
        favorites={projectConfig.favoriteResources}
        onSetDefault={(id) => setDefaultResource('appinsights', id)}
        onToggleFavorite={toggleFavorite}
        renderItem={(ai) => (
          <div key={ai.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Activity className="w-5 h-5 text-purple-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{ai.name}</p>
                <p className="text-gray-500 text-sm truncate">{ai.resourceGroup} • {ai.location}</p>
              </div>
            </div>
          </div>
        )}
      />

      {/* Storage Accounts */}
      <ResourceSection
        title="Storage Accounts"
        icon={HardDrive}
        iconColor="text-green-400"
        resources={filterResources(allStorageAccounts)}
        expanded={expandedSections.storageaccounts}
        onToggle={() => toggleSection('storageaccounts')}
        defaultId={projectConfig.defaultStorageAccountId}
        favorites={projectConfig.favoriteResources}
        onSetDefault={(id) => setDefaultResource('storage', id)}
        onToggleFavorite={toggleFavorite}
        renderItem={(st) => (
          <div key={st.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <HardDrive className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{st.name}</p>
                <p className="text-gray-500 text-sm truncate">{st.resourceGroup} • {st.location}</p>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  )
}

// ResourceSection Component
interface ResourceSectionProps<T extends { id: string; name: string }> {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  resources: T[]
  expanded: boolean
  onToggle: () => void
  defaultId?: string
  favorites: string[]
  onSetDefault: (id: string) => void
  onToggleFavorite: (id: string) => void
  renderItem: (item: T) => React.ReactNode
}

function ResourceSection<T extends { id: string; name: string }>({
  title,
  icon: Icon,
  iconColor,
  resources,
  expanded,
  onToggle,
  defaultId,
  favorites,
  onSetDefault,
  onToggleFavorite,
  renderItem,
}: ResourceSectionProps<T>) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <span className="text-white font-medium">{title}</span>
          <span className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-400">
            {resources.length}
          </span>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-gray-700 divide-y divide-gray-700/50">
              {resources.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500">
                  No resources found
                </div>
              ) : (
                resources.map((resource) => (
                  <div
                    key={resource.id}
                    className={`px-4 py-3 flex items-center justify-between hover:bg-gray-700/30 transition-colors ${
                      defaultId === resource.id ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">{renderItem(resource)}</div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => onToggleFavorite(resource.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          favorites.includes(resource.id)
                            ? 'text-yellow-400 hover:bg-yellow-400/20'
                            : 'text-gray-500 hover:text-yellow-400 hover:bg-gray-700'
                        }`}
                        title={favorites.includes(resource.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {favorites.includes(resource.id) ? (
                          <Star className="w-4 h-4 fill-current" />
                        ) : (
                          <StarOff className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onSetDefault(resource.id)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${
                          defaultId === resource.id
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                        }`}
                        title={defaultId === resource.id ? 'Current default' : 'Set as default'}
                      >
                        {defaultId === resource.id ? 'Default' : 'Set Default'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
