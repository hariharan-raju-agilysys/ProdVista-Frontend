import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getAzureResourceGroups,
  getAzureResources,
  getResourceGraphSubscriptions,
  getResourceGraphMonitoring,
  getResourceGraphByType
} from '../services/api'

interface Subscription {
  id: string
  subscriptionId: string
  displayName: string
  state: string
  tenantId: string
}

interface ResourceGroup {
  id: string
  name: string
  location: string
  managedBy?: string
  tags?: Record<string, string>
}

interface AzureResource {
  id: string
  name: string
  type: string
  location: string
  resourceGroup?: string
  kind?: string
  tags?: Record<string, string>
}

interface Props {
  onResourceSelect?: (resource: AzureResource & { subscriptionId: string }) => void
  onWorkspaceSelect?: (workspace: AzureResource & { subscriptionId: string }) => void
  onStorageSelect?: (storage: AzureResource & { subscriptionId: string }) => void
  onAppInsightsSelect?: (appInsights: AzureResource & { subscriptionId: string }) => void
}

const resourceTypeIcons: Record<string, string> = {
  'microsoft.web/sites': '🌐',
  'microsoft.storage/storageaccounts': '📦',
  'microsoft.insights/components': '📊',
  'microsoft.operationalinsights/workspaces': '📋',
  'microsoft.sql/servers': '🗄️',
  'microsoft.keyvault/vaults': '🔐',
  'microsoft.compute/virtualmachines': '🖥️',
  'microsoft.containerservice/managedclusters': '☸️',
  'microsoft.network/virtualnetworks': '🔗',
  'microsoft.apimanagement/service': '🔌',
  'default': '📁'
}

const getResourceIcon = (type: string) => {
  const key = type.toLowerCase()
  return resourceTypeIcons[key] || resourceTypeIcons['default']
}

export default function AzureCloudSetup({ 
  onResourceSelect, 
  onWorkspaceSelect, 
  onStorageSelect,
  onAppInsightsSelect 
}: Props) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSubscription, setSelectedSubscription] = useState<string | null>(null)
  const [resourceGroups, setResourceGroups] = useState<ResourceGroup[]>([])
  const [selectedResourceGroup, setSelectedResourceGroup] = useState<string | null>(null)
  const [resources, setResources] = useState<AzureResource[]>([])
  const [appInsights, setAppInsights] = useState<AzureResource[]>([])
  const [storageAccounts, setStorageAccounts] = useState<AzureResource[]>([])
  const [workspaces, setWorkspaces] = useState<AzureResource[]>([])
  const [loading, setLoading] = useState({ subscriptions: false, rgs: false, resources: false })
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'resources' | 'appinsights' | 'storage' | 'workspaces'>('resources')

  // Load subscriptions on mount
  useEffect(() => {
    loadSubscriptions()
  }, [])

  // Load resource groups when subscription changes
  useEffect(() => {
    if (selectedSubscription) {
      loadResourceGroups(selectedSubscription)
      loadServiceResources(selectedSubscription)
    }
  }, [selectedSubscription])

  // Load resources when resource group changes
  useEffect(() => {
    if (selectedSubscription && selectedResourceGroup) {
      loadResources(selectedSubscription, selectedResourceGroup)
    }
  }, [selectedSubscription, selectedResourceGroup])

  const loadSubscriptions = async () => {
    setLoading(l => ({ ...l, subscriptions: true }))
    setError(null)
    try {
      // Use Resource Graph for fast subscription discovery
      const { data } = await getResourceGraphSubscriptions()
      const subs = (data.subscriptions || []).map((s: any) => ({
        id: s.id,
        subscriptionId: s.subscriptionId,
        displayName: s.name || s.displayName,
        state: s.state || 'Enabled',
        tenantId: s.tenantId
      }))
      setSubscriptions(subs)
      if (subs.length > 0) {
        setSelectedSubscription(subs[0].subscriptionId)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load subscriptions')
    } finally {
      setLoading(l => ({ ...l, subscriptions: false }))
    }
  }

  const loadResourceGroups = async (subscriptionId: string) => {
    setLoading(l => ({ ...l, rgs: true }))
    try {
      const { data } = await getAzureResourceGroups(subscriptionId)
      setResourceGroups(data.resourceGroups || [])
      setSelectedResourceGroup(null)
      setResources([])
    } catch (err: any) {
      console.error('Failed to load resource groups:', err)
    } finally {
      setLoading(l => ({ ...l, rgs: false }))
    }
  }

  const loadServiceResources = async (subscriptionId: string) => {
    try {
      // Use Resource Graph for single-call resource fetching
      const [monitoringRes, storageRes] = await Promise.all([
        getResourceGraphMonitoring([subscriptionId]),
        getResourceGraphByType('microsoft.storage/storageaccounts', [subscriptionId])
      ])
      
      // Map monitoring resources
      const workspaceList = (monitoringRes.data.workspaces || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        type: 'microsoft.operationalinsights/workspaces',
        location: w.location,
        resourceGroup: w.resourceGroup
      }))
      
      const appInsightsList = (monitoringRes.data.appInsights || []).map((ai: any) => ({
        id: ai.id,
        name: ai.name,
        type: 'microsoft.insights/components',
        location: ai.location,
        resourceGroup: ai.resourceGroup
      }))
      
      const storageList = (storageRes.data.resources || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        type: 'microsoft.storage/storageaccounts',
        location: s.location,
        resourceGroup: s.resourceGroup
      }))
      
      setWorkspaces(workspaceList)
      setAppInsights(appInsightsList)
      setStorageAccounts(storageList)
      
      console.log(`Loaded resources via Resource Graph: ${workspaceList.length} workspaces, ${appInsightsList.length} app insights, ${storageList.length} storage accounts`)
    } catch (err: any) {
      console.error('Failed to load service resources:', err)
    }
  }

  const loadResources = async (subscriptionId: string, resourceGroup: string) => {
    setLoading(l => ({ ...l, resources: true }))
    try {
      const { data } = await getAzureResources(subscriptionId, resourceGroup)
      setResources(data.resources || [])
    } catch (err: any) {
      console.error('Failed to load resources:', err)
    } finally {
      setLoading(l => ({ ...l, resources: false }))
    }
  }

  const handleResourceClick = (resource: AzureResource) => {
    if (selectedSubscription && onResourceSelect) {
      onResourceSelect({ ...resource, subscriptionId: selectedSubscription })
    }
  }

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-red-50 border border-red-200 rounded-xl p-6"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-medium text-red-800">Azure Connection Error</h3>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button 
              onClick={loadSubscriptions}
              className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Subscription Selector */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">☁️</span>
          <h2 className="text-lg font-semibold text-gray-800">Azure Subscriptions</h2>
          {loading.subscriptions && (
            <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          )}
        </div>
        
        <select
          value={selectedSubscription || ''}
          onChange={(e) => setSelectedSubscription(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          disabled={loading.subscriptions}
        >
          <option value="">Select a subscription...</option>
          {subscriptions.map(sub => (
            <option key={sub.subscriptionId} value={sub.subscriptionId}>
              {sub.displayName} ({sub.state})
            </option>
          ))}
        </select>

        {selectedSubscription && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">Resource Groups</p>
              <p className="text-xl font-bold text-blue-600">{resourceGroups.length}</p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">App Insights</p>
              <p className="text-xl font-bold text-purple-600">{appInsights.length}</p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">Storage Accounts</p>
              <p className="text-xl font-bold text-green-600">{storageAccounts.length}</p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500">Log Workspaces</p>
              <p className="text-xl font-bold text-orange-600">{workspaces.length}</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Tab Navigation */}
      {selectedSubscription && (
        <div className="flex gap-2 border-b border-gray-200">
          {[
            { id: 'resources', label: 'Resources', icon: '📁' },
            { id: 'appinsights', label: 'Application Insights', icon: '📊' },
            { id: 'storage', label: 'Storage Accounts', icon: '📦' },
            { id: 'workspaces', label: 'Log Analytics', icon: '📋' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-[2px] ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Resources Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'resources' && selectedSubscription && (
          <motion.div
            key="resources"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {/* Resource Groups */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-medium text-gray-700">Resource Groups</h3>
                {loading.rgs && (
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {resourceGroups.map((rg, idx) => (
                  <motion.div
                    key={rg.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => setSelectedResourceGroup(rg.name)}
                    className={`px-4 py-3 cursor-pointer transition-all border-b border-gray-50 last:border-0 ${
                      selectedResourceGroup === rg.name
                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📁</span>
                      <div>
                        <p className="font-medium text-gray-800">{rg.name}</p>
                        <p className="text-xs text-gray-500">📍 {rg.location}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {resourceGroups.length === 0 && !loading.rgs && (
                  <p className="px-4 py-6 text-center text-gray-400">No resource groups found</p>
                )}
              </div>
            </div>

            {/* Resources in Selected Group */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-medium text-gray-700">
                  {selectedResourceGroup ? `Resources in ${selectedResourceGroup}` : 'Select a Resource Group'}
                </h3>
                {loading.resources && (
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {resources.map((res, idx) => (
                  <motion.div
                    key={res.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => handleResourceClick(res)}
                    className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-all border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getResourceIcon(res.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{res.name}</p>
                        <p className="text-xs text-gray-500 truncate">{res.type}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {!selectedResourceGroup && (
                  <p className="px-4 py-6 text-center text-gray-400">Select a resource group to view resources</p>
                )}
                {selectedResourceGroup && resources.length === 0 && !loading.resources && (
                  <p className="px-4 py-6 text-center text-gray-400">No resources in this group</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* App Insights Tab */}
        {activeTab === 'appinsights' && (
          <motion.div
            key="appinsights"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
              <h3 className="font-medium text-gray-700">Application Insights Instances</h3>
              <p className="text-xs text-gray-500 mt-1">Click to view distributed traces</p>
            </div>
            <div className="divide-y divide-gray-50">
              {appInsights.map((ai, idx) => (
                <motion.div
                  key={ai.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => selectedSubscription && onAppInsightsSelect?.({ ...ai, subscriptionId: selectedSubscription })}
                  className="px-4 py-4 cursor-pointer hover:bg-purple-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📊</span>
                      <div>
                        <p className="font-medium text-gray-800">{ai.name}</p>
                        <p className="text-xs text-gray-500">📍 {ai.location} • 📁 {ai.resourceGroup}</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 transition-colors">
                      View Traces →
                    </button>
                  </div>
                </motion.div>
              ))}
              {appInsights.length === 0 && (
                <p className="px-4 py-8 text-center text-gray-400">No Application Insights instances found</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <motion.div
            key="storage"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-gray-100">
              <h3 className="font-medium text-gray-700">Storage Accounts</h3>
              <p className="text-xs text-gray-500 mt-1">Click to browse containers and logs</p>
            </div>
            <div className="divide-y divide-gray-50">
              {storageAccounts.map((sa, idx) => (
                <motion.div
                  key={sa.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => selectedSubscription && onStorageSelect?.({ ...sa, subscriptionId: selectedSubscription })}
                  className="px-4 py-4 cursor-pointer hover:bg-green-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📦</span>
                      <div>
                        <p className="font-medium text-gray-800">{sa.name}</p>
                        <p className="text-xs text-gray-500">📍 {sa.location} • 📁 {sa.resourceGroup}</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition-colors">
                      Browse Logs →
                    </button>
                  </div>
                </motion.div>
              ))}
              {storageAccounts.length === 0 && (
                <p className="px-4 py-8 text-center text-gray-400">No Storage Accounts found</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Workspaces Tab */}
        {activeTab === 'workspaces' && (
          <motion.div
            key="workspaces"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-b border-gray-100">
              <h3 className="font-medium text-gray-700">Log Analytics Workspaces</h3>
              <p className="text-xs text-gray-500 mt-1">Click to query logs</p>
            </div>
            <div className="divide-y divide-gray-50">
              {workspaces.map((ws, idx) => (
                <motion.div
                  key={ws.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => selectedSubscription && onWorkspaceSelect?.({ ...ws, subscriptionId: selectedSubscription })}
                  className="px-4 py-4 cursor-pointer hover:bg-orange-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📋</span>
                      <div>
                        <p className="font-medium text-gray-800">{ws.name}</p>
                        <p className="text-xs text-gray-500">📍 {ws.location} • 📁 {ws.resourceGroup}</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm hover:bg-orange-200 transition-colors">
                      Query Logs →
                    </button>
                  </div>
                </motion.div>
              ))}
              {workspaces.length === 0 && (
                <p className="px-4 py-8 text-center text-gray-400">No Log Analytics Workspaces found</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
