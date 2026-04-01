import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cloud, CheckCircle2, AlertTriangle, Loader2, ChevronRight,
  Search, Monitor, Database, Activity, FileText, RefreshCw,
  Zap, Clock, Play, Eye, Heart, Pin, Save, LogIn, AlertCircle
} from 'lucide-react'
import {
  getResourceGraphSubscriptions,
  getResourceGraphWorkspaces,
  getResourceGraphByType,
  getTenantAzureSettings,
  setDefaultWorkspace,
  addFavoriteWorkspace,
  removeFavoriteWorkspace,
  saveQuery,
  trackWorkspaceUsage,
  refreshAzureAuth,
} from '../services/api'

interface Subscription {
  id: string
  subscriptionId: string
  displayName: string
  state: string
}

interface Workspace {
  id: string
  name: string
  resourceGroup: string
  location: string
}

interface Resource {
  id: string
  name: string
  type: string
  location: string
  resourceGroup?: string
}

interface AzureAuthStatus {
  authenticated: boolean
  method: string
  message: string
  user?: { name: string; email: string }
  instructions?: string
}

interface TenantSettings {
  defaultWorkspaceId?: string
  defaultWorkspaceName?: string
  favoriteWorkspaces: Array<{ resourceId: string; resourceName?: string }>
  savedQueries: Array<{ id: string; name: string; query: string; workspaceId?: string }>
}

interface Props {
  onWorkspaceSelect?: (workspace: Workspace, subscriptionId: string) => void
  onResourceSelect?: (resource: Resource, subscriptionId: string) => void
  onRunQuery?: (workspaceId: string, query: string) => void
  compact?: boolean
}

const QUICK_QUERIES = [
  { name: 'Recent Errors', icon: AlertTriangle, query: 'AppExceptions | where TimeGenerated > ago(1h) | summarize count() by ProblemId | top 10 by count_', color: 'red' },
  { name: 'Request Duration', icon: Activity, query: 'AppRequests | where TimeGenerated > ago(1h) | summarize avg(DurationMs) by bin(TimeGenerated, 5m)', color: 'blue' },
  { name: 'Dependencies', icon: Database, query: 'AppDependencies | where TimeGenerated > ago(1h) | summarize count() by DependencyType | top 10 by count_', color: 'purple' },
  { name: 'Page Views', icon: Eye, query: 'AppPageViews | where TimeGenerated > ago(1h) | summarize count() by Name | top 10 by count_', color: 'green' },
]

const RESOURCE_TYPES = [
  { type: 'microsoft.insights/components', label: 'Application Insights', icon: '📊' },
  { type: 'Microsoft.OperationalInsights/workspaces', label: 'Log Analytics', icon: '📋' },
  { type: 'Microsoft.Web/sites', label: 'App Services', icon: '🌐' },
  { type: 'Microsoft.Sql/servers', label: 'SQL Servers', icon: '🗄️' },
  { type: 'Microsoft.ContainerService/managedClusters', label: 'Kubernetes', icon: '☸️' },
  { type: 'Microsoft.Storage/storageAccounts', label: 'Storage', icon: '📦' },
]

export default function AzureQuickSetup({ 
  onWorkspaceSelect, 
  onResourceSelect, 
  onRunQuery,
  compact = false 
}: Props) {
  const [authStatus, setAuthStatus] = useState<AzureAuthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSub, setSelectedSub] = useState<string>('')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState<'quick' | 'browse' | 'query'>('quick')
  const [customQuery, setCustomQuery] = useState('')
  const [loadingResources, setLoadingResources] = useState(false)
  const [recentWorkspaces, setRecentWorkspaces] = useState<(Workspace & { subId: string })[]>([])
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null)

  // Load tenant settings and recent workspaces
  useEffect(() => {
    const loadTenantSettings = async () => {
      try {
        const settings = await getTenantAzureSettings()
        setTenantSettings(settings)
      } catch (err) {
        console.log('Could not load tenant settings (auth required)')
      }
    }
    loadTenantSettings()

    const saved = localStorage.getItem('azure_recent_workspaces')
    if (saved) {
      try {
        setRecentWorkspaces(JSON.parse(saved))
      } catch { /* ignore */ }
    }
  }, [])

  // Check auth status
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/azure/auth-status')
      const status = await response.json()
      setAuthStatus(status)
      
      if (status.authenticated) {
        await loadSubscriptions()
      }
    } catch {
      setAuthStatus({
        authenticated: false,
        method: 'Unknown',
        message: 'Failed to check authentication',
        instructions: 'Run "az login" in your terminal'
      })
    }
    setLoading(false)
  }

  const loadSubscriptions = async () => {
    try {
      // Use Resource Graph for fast subscription discovery (single API call)
      const { data } = await getResourceGraphSubscriptions()
      const subs = (data.subscriptions || []).map((s: any) => ({
        id: s.id,
        subscriptionId: s.subscriptionId,
        displayName: s.name || s.displayName,
        state: s.state || 'Enabled'
      }))
      setSubscriptions(subs)
      if (subs.length > 0 && !selectedSub) {
        setSelectedSub(subs[0].subscriptionId)
      }
      console.log(`Loaded ${subs.length} subscriptions via Resource Graph in ${data.queryTimeMs}ms`)
    } catch (err) {
      console.error('Failed to load subscriptions:', err)
    }
  }

  useEffect(() => {
    if (selectedSub) {
      loadWorkspaces(selectedSub)
    }
  }, [selectedSub])

  const loadWorkspaces = async (subId: string) => {
    try {
      // Use Resource Graph for fast workspace discovery (single API call)
      const { data } = await getResourceGraphWorkspaces([subId])
      const workspaceList = (data.workspaces || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        resourceGroup: w.resourceGroup,
        location: w.location
      }))
      setWorkspaces(workspaceList)
      console.log(`Loaded ${workspaceList.length} workspaces via Resource Graph in ${data.queryTimeMs}ms`)
    } catch (err) {
      console.error('Failed to load workspaces:', err)
    }
  }

  const loadResources = async (resourceType?: string) => {
    if (!selectedSub) return
    setLoadingResources(true)
    try {
      // Use Resource Graph for fast resource discovery
      const { data } = await getResourceGraphByType(resourceType || 'microsoft.insights/components', [selectedSub], 50)
      setResources(data.resources || [])
      console.log(`Loaded ${data.count} resources via Resource Graph in ${data.queryTimeMs}ms`)
    } catch (err) {
      console.error('Failed to load resources:', err)
    }
    setLoadingResources(false)
  }

  const handleSelectWorkspace = async (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    
    // Save to recent (local)
    const recent = recentWorkspaces.filter(w => w.id !== workspace.id)
    const updated = [{ ...workspace, subId: selectedSub }, ...recent].slice(0, 5)
    setRecentWorkspaces(updated)
    localStorage.setItem('azure_recent_workspaces', JSON.stringify(updated))
    
    // Track usage on server
    try {
      await trackWorkspaceUsage(workspace.id, workspace.name)
    } catch { /* ignore */ }
    
    onWorkspaceSelect?.(workspace, selectedSub)
  }

  const handleSetDefaultWorkspace = async (workspace: Workspace) => {
    try {
      await setDefaultWorkspace(workspace.id, workspace.name)
      setTenantSettings(prev => ({
        ...prev!,
        defaultWorkspaceId: workspace.id,
        defaultWorkspaceName: workspace.name
      }))
    } catch (err) {
      console.error('Failed to set default workspace:', err)
    }
  }

  const handleToggleFavorite = async (workspace: Workspace) => {
    if (!tenantSettings) return
    
    const isFavorite = tenantSettings.favoriteWorkspaces.some(f => f.resourceId === workspace.id)
    
    try {
      if (isFavorite) {
        await removeFavoriteWorkspace(workspace.id)
        setTenantSettings(prev => ({
          ...prev!,
          favoriteWorkspaces: prev!.favoriteWorkspaces.filter(f => f.resourceId !== workspace.id)
        }))
      } else {
        await addFavoriteWorkspace({
          resourceId: workspace.id,
          resourceName: workspace.name,
          resourceType: 'workspace',
          subscriptionId: selectedSub,
          location: workspace.location
        })
        setTenantSettings(prev => ({
          ...prev!,
          favoriteWorkspaces: [...prev!.favoriteWorkspaces, { resourceId: workspace.id, resourceName: workspace.name }]
        }))
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

  const handleSaveQuery = async (name: string, query: string) => {
    if (!selectedWorkspace) return
    
    try {
      await saveQuery({
        name,
        query,
        workspaceId: selectedWorkspace.id,
        workspaceName: selectedWorkspace.name
      })
      // Refresh settings to get updated saved queries
      const settings = await getTenantAzureSettings()
      setTenantSettings(settings)
    } catch (err) {
      console.error('Failed to save query:', err)
    }
  }

  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null)

  const handleAutoLogin = async () => {
    setRefreshing(true)
    setRefreshMessage(null)
    try {
      const { data } = await refreshAzureAuth()
      if (data.success) {
        setRefreshMessage('Login successful! Rechecking...')
        setTimeout(checkAuthStatus, 1000)
      } else {
        setRefreshMessage(data.message || 'Login may be required manually')
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      const axiosError = err as { response?: { data?: { message?: string } } }
      setRefreshMessage(axiosError.response?.data?.message || errorMessage || 'Auto-login failed. Please run "az login" manually.')
    }
    setRefreshing(false)
  }

  const isDefaultWorkspace = (ws: Workspace) => tenantSettings?.defaultWorkspaceId === ws.id
  const isFavoriteWorkspace = (ws: Workspace) => tenantSettings?.favoriteWorkspaces?.some(f => f.resourceId === ws.id)

  const handleRunQuery = (query: string) => {
    if (selectedWorkspace && onRunQuery) {
      onRunQuery(selectedWorkspace.id, query)
    }
  }

  const filteredWorkspaces = workspaces.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.resourceGroup?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredResources = resources.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  // Not authenticated view
  if (!authStatus?.authenticated) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-8 border border-blue-100 dark:border-blue-900"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center">
            <Cloud className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Connect to Azure</h2>
            <p className="text-gray-600 dark:text-gray-400">Access your Azure resources and logs</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Not Connected</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">{authStatus?.message}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            Quick Connect via Azure CLI
          </h3>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="text-gray-700 dark:text-gray-300">Open a terminal</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="text-gray-700 dark:text-gray-300">Run the command:</p>
                <code className="block mt-1 px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded-lg font-mono text-sm">az login</code>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="text-gray-700 dark:text-gray-300">Complete browser authentication</p>
              </div>
            </li>
          </ol>

          <button
            onClick={checkAuthStatus}
            className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Check Connection Status
          </button>
          
          <button
            onClick={handleAutoLogin}
            disabled={refreshing}
            className="mt-3 w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {refreshing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening browser for login...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Auto Login (Opens Browser)
              </>
            )}
          </button>
          
          {refreshMessage && (
            <div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${
              refreshMessage.includes('successful') || refreshMessage.includes('valid')
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}>
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{refreshMessage}</span>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  // Connected - Compact view
  if (compact) {
    return (
      <div className="space-y-4">
        {/* Status Bar */}
        <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-2 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Connected as {authStatus.user?.name}
            </span>
          </div>
          <select
            value={selectedSub}
            onChange={(e) => setSelectedSub(e.target.value)}
            className="text-sm bg-transparent border-none focus:ring-0 text-green-700 dark:text-green-300 font-medium"
          >
            {subscriptions.map(sub => (
              <option key={sub.subscriptionId} value={sub.subscriptionId}>
                {sub.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Workspace Quick Select */}
        <div className="grid grid-cols-2 gap-2">
          {workspaces.slice(0, 4).map(ws => (
            <button
              key={ws.id}
              onClick={() => handleSelectWorkspace(ws)}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedWorkspace?.id === ws.id
                  ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
              }`}
            >
              <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{ws.name}</p>
              <p className="text-xs text-gray-500 truncate">{ws.resourceGroup}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Connected - Full view
  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-semibold text-green-800 dark:text-green-200">Connected to Azure</p>
              <p className="text-sm text-green-600 dark:text-green-400">{authStatus.user?.email}</p>
            </div>
          </div>
          
          {/* Subscription Selector */}
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-green-600" />
            <select
              value={selectedSub}
              onChange={(e) => setSelectedSub(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-green-300 dark:border-green-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-green-500"
            >
              {subscriptions.map(sub => (
                <option key={sub.subscriptionId} value={sub.subscriptionId}>
                  {sub.displayName}
                </option>
              ))}
            </select>
            <button 
              onClick={checkAuthStatus}
              className="p-2 hover:bg-green-100 dark:hover:bg-green-800 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-green-600" />
            </button>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
        {[
          { id: 'quick', label: 'Quick Access', icon: Zap },
          { id: 'browse', label: 'Browse', icon: Search },
          { id: 'query', label: 'Query', icon: FileText },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id as any)}
            className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center gap-2 text-sm font-medium transition-all ${
              activeView === tab.id
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Quick Access View */}
        {activeView === 'quick' && (
          <motion.div
            key="quick"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Default Workspace (if configured) */}
            {tenantSettings?.defaultWorkspaceId && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Pin className="w-4 h-4 text-green-500" />
                  Default Workspace
                </h3>
                <button
                  onClick={() => {
                    const defaultWs = workspaces.find(w => w.id === tenantSettings.defaultWorkspaceId) 
                      || { id: tenantSettings.defaultWorkspaceId!, name: tenantSettings.defaultWorkspaceName || 'Default Workspace', resourceGroup: '', location: '' }
                    handleSelectWorkspace(defaultWs)
                  }}
                  className="w-full p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
                      <Monitor className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{tenantSettings.defaultWorkspaceName}</p>
                      <p className="text-sm text-gray-500">Click to open default workspace</p>
                    </div>
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 group-hover:translate-x-1 transition-transform">
                      <span className="text-sm font-medium">Open</span>
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Favorite Workspaces */}
            {tenantSettings?.favoriteWorkspaces && tenantSettings.favoriteWorkspaces.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-amber-500" />
                  Favorites
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tenantSettings.favoriteWorkspaces.map(fav => (
                    <button
                      key={fav.resourceId}
                      onClick={() => {
                        const favWs = workspaces.find(w => w.id === fav.resourceId)
                          || { id: fav.resourceId, name: fav.resourceName || 'Workspace', resourceGroup: '', location: '' }
                        handleSelectWorkspace(favWs)
                      }}
                      className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 transition-all group text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{fav.resourceName}</p>
                          <p className="text-xs text-gray-500 mt-1">Favorite workspace</p>
                        </div>
                        <Heart className="w-4 h-4 text-amber-500 fill-current" />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-3 h-3" />
                        Open workspace
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Workspaces */}
            {recentWorkspaces.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Workspaces
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentWorkspaces.map(ws => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setSelectedSub(ws.subId)
                        handleSelectWorkspace(ws)
                      }}
                      className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all group text-left"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{ws.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{ws.resourceGroup}</p>
                        </div>
                        <Clock className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-3 h-3" />
                        Open workspace
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Available Workspaces */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Log Analytics Workspaces ({filteredWorkspaces.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredWorkspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => handleSelectWorkspace(ws)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedWorkspace?.id === ws.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center relative">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        {isDefaultWorkspace(ws) && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <Pin className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{ws.name}</p>
                          {isDefaultWorkspace(ws) && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded font-medium">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{ws.resourceGroup} • {ws.location}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleFavorite(ws) }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isFavoriteWorkspace(ws) 
                              ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30' 
                              : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          title={isFavoriteWorkspace(ws) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Heart className={`w-4 h-4 ${isFavoriteWorkspace(ws) ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSetDefaultWorkspace(ws) }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDefaultWorkspace(ws) 
                              ? 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30' 
                              : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          title={isDefaultWorkspace(ws) ? 'Default workspace' : 'Set as default'}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </button>
                ))}
                {workspaces.length === 0 && (
                  <p className="col-span-2 text-center py-8 text-gray-500">No Log Analytics workspaces found in this subscription</p>
                )}
              </div>
            </div>

            {/* Saved Queries (if any) */}
            {tenantSettings?.savedQueries && tenantSettings.savedQueries.length > 0 && selectedWorkspace && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Saved Queries
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {tenantSettings.savedQueries
                    .filter(q => q.workspaceId === selectedWorkspace.id)
                    .map(q => (
                    <button
                      key={q.id}
                      onClick={() => handleRunQuery(q.query)}
                      className="p-4 rounded-xl border bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group text-left"
                    >
                      <FileText className="w-5 h-5 text-purple-500 mb-2" />
                      <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{q.name}</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Run query →
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Queries (if workspace selected) */}
            {selectedWorkspace && onRunQuery && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Quick Queries for {selectedWorkspace.name}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {QUICK_QUERIES.map(q => (
                    <button
                      key={q.name}
                      onClick={() => handleRunQuery(q.query)}
                      className={`p-4 rounded-xl border bg-white dark:bg-slate-800 border-gray-200 dark:border-gray-700 hover:border-${q.color}-300 hover:bg-${q.color}-50 dark:hover:bg-${q.color}-900/20 transition-all group text-left`}
                    >
                      <q.icon className={`w-5 h-5 text-${q.color}-500 mb-2`} />
                      <p className="font-medium text-sm text-gray-900 dark:text-white">{q.name}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Run query →
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Browse View */}
        {activeView === 'browse' && (
          <motion.div
            key="browse"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resources..."
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Resource Type Filters */}
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TYPES.map(rt => (
                <button
                  key={rt.type}
                  onClick={() => loadResources(rt.type)}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex items-center gap-2"
                >
                  <span>{rt.icon}</span>
                  {rt.label}
                </button>
              ))}
              <button
                onClick={() => loadResources()}
                className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                Show All
              </button>
            </div>

            {/* Resources List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {loadingResources ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : filteredResources.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
                  {filteredResources.map(res => (
                    <button
                      key={res.id}
                      onClick={() => onResourceSelect?.(res, selectedSub)}
                      className="w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 text-left"
                    >
                      <span className="text-xl">
                        {RESOURCE_TYPES.find(rt => rt.type.toLowerCase() === res.type.toLowerCase())?.icon || '📁'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{res.name}</p>
                        <p className="text-xs text-gray-500 truncate">{res.type}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              ) : resources.length === 0 ? (
                <p className="py-12 text-center text-gray-500">Select a resource type to browse</p>
              ) : (
                <p className="py-12 text-center text-gray-500">No resources match your search</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Query View */}
        {activeView === 'query' && (
          <motion.div
            key="query"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Workspace Selector */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Workspace:</label>
              <select
                value={selectedWorkspace?.id || ''}
                onChange={(e) => {
                  const ws = workspaces.find(w => w.id === e.target.value)
                  if (ws) handleSelectWorkspace(ws)
                }}
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a workspace...</option>
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>

            {/* Query Editor */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">KQL Query</span>
                <div className="flex items-center gap-2">
                  {QUICK_QUERIES.map(q => (
                    <button
                      key={q.name}
                      onClick={() => setCustomQuery(q.query)}
                      className="px-2 py-1 text-xs bg-white dark:bg-slate-600 border border-gray-200 dark:border-gray-500 rounded hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
                      title={q.name}
                    >
                      <q.icon className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Enter your KQL query here...

Example:
AppRequests
| where TimeGenerated > ago(1h)
| summarize count() by bin(TimeGenerated, 5m)"
                className="w-full h-48 px-4 py-3 font-mono text-sm bg-transparent resize-none focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleRunQuery(customQuery)}
                disabled={!selectedWorkspace || !customQuery.trim()}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Play className="w-4 h-4" />
                Run Query
              </button>
              <button
                onClick={() => {
                  const name = prompt('Enter a name for this query:')
                  if (name && customQuery.trim()) {
                    handleSaveQuery(name, customQuery)
                  }
                }}
                disabled={!selectedWorkspace || !customQuery.trim()}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                title="Save query for later"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
