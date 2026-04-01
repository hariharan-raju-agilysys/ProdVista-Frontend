/**
 * AzureOpenAISetup - Clean Azure OpenAI Configuration Component
 * 
 * Features:
 * - Subscription → Resource → Deployment hierarchy
 * - Background resource discovery with caching
 * - Manual configuration mode (no waiting for discovery)
 * - Save settings independently of discovery state
 */

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Cloud, Server, RefreshCw, Shield, AlertCircle, Loader2,
  Check, Settings2, ChevronDown, Zap, Key, Edit3
} from 'lucide-react'
import { useAzure } from '../hooks/useAzure'
import type { AzureOpenAIResource, AzureOpenAIDeployment } from '../services/azureService'

export interface AzureOpenAIConfig {
  endpoint: string
  deployment: string
  modelName?: string
  useTokenAuth: boolean
  apiKey?: string
  apiVersion: string
}

interface AzureOpenAISetupProps {
  value: AzureOpenAIConfig
  onChange: (config: AzureOpenAIConfig) => void
  disabled?: boolean
}

type ConfigMode = 'auto' | 'manual'

export function AzureOpenAISetup({ value, onChange, disabled }: AzureOpenAISetupProps) {
  const [mode, setMode] = useState<ConfigMode>('auto')
  const [localConfig, setLocalConfig] = useState<AzureOpenAIConfig>(value)
  
  const azure = useAzure({
    autoDiscover: true,
    autoSelect: true,
    onSelectionChange: (selection) => {
      if (selection && mode === 'auto') {
        updateConfig({
          endpoint: selection.endpoint,
          deployment: selection.deployment,
          modelName: selection.modelName
        })
      }
    }
  })

  // Sync external value changes
  useEffect(() => {
    setLocalConfig(value)
  }, [value])

  const updateConfig = useCallback((updates: Partial<AzureOpenAIConfig>) => {
    const newConfig = { ...localConfig, ...updates }
    setLocalConfig(newConfig)
    onChange(newConfig)
  }, [localConfig, onChange])

  // Filtered resources based on selected subscription
  const filteredResources = azure.selectedSubscription
    ? azure.getResourcesForSubscription(azure.selectedSubscription.id)
    : azure.resources

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <StatusBadge azure={azure} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => azure.discover({ forceRefresh: true })}
            disabled={azure.isLoading || disabled}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
          >
            {azure.isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {azure.error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{azure.error}</span>
          </div>
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
        <button
          onClick={() => setMode('auto')}
          disabled={disabled}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            mode === 'auto'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Cloud className="w-4 h-4 inline mr-2" />
          Auto-Discover
        </button>
        <button
          onClick={() => setMode('manual')}
          disabled={disabled}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            mode === 'manual'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Edit3 className="w-4 h-4 inline mr-2" />
          Manual Config
        </button>
      </div>

      {mode === 'auto' ? (
        <AutoDiscoverMode
          azure={azure}
          updateConfig={updateConfig}
          filteredResources={filteredResources}
          disabled={disabled}
        />
      ) : (
        <ManualConfigMode
          config={localConfig}
          updateConfig={updateConfig}
          disabled={disabled}
        />
      )}

      {/* Authentication Method */}
      <div className="space-y-3 pt-3 border-t border-gray-700">
        <label className="block text-sm font-medium text-gray-300">
          <Shield className="w-4 h-4 inline mr-2" />
          Authentication
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateConfig({ useTokenAuth: true, apiKey: undefined })}
            disabled={disabled}
            className={`p-3 rounded-lg border text-left transition-all ${
              localConfig.useTokenAuth
                ? 'border-green-500 bg-green-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <Zap className="w-4 h-4 text-green-400 mb-1" />
            <div className="text-white text-sm font-medium">Azure Token</div>
            <div className="text-xs text-gray-400">Managed Identity / CLI</div>
          </button>
          <button
            onClick={() => updateConfig({ useTokenAuth: false })}
            disabled={disabled}
            className={`p-3 rounded-lg border text-left transition-all ${
              !localConfig.useTokenAuth
                ? 'border-yellow-500 bg-yellow-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <Key className="w-4 h-4 text-yellow-400 mb-1" />
            <div className="text-white text-sm font-medium">API Key</div>
            <div className="text-xs text-gray-400">Classic auth</div>
          </button>
        </div>

        {/* API Key input */}
        {!localConfig.useTokenAuth && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <input
              type="password"
              value={localConfig.apiKey || ''}
              onChange={(e) => updateConfig({ apiKey: e.target.value })}
              placeholder="Enter your Azure OpenAI API key"
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </motion.div>
        )}
      </div>

      {/* API Version */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">API Version</label>
        <input
          type="text"
          value={localConfig.apiVersion}
          onChange={(e) => updateConfig({ apiVersion: e.target.value })}
          placeholder="e.g., 2024-02-15-preview"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
        />
      </div>

      {/* Config Summary */}
      {(localConfig.endpoint || localConfig.deployment) && (
        <ConfigSummary config={localConfig} />
      )}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function StatusBadge({ azure }: { azure: ReturnType<typeof useAzure> }) {
  if (azure.isLoading) {
    return (
      <div className="flex items-center gap-2 text-blue-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Discovering resources...</span>
      </div>
    )
  }

  if (azure.isAuthenticated) {
    return (
      <div className="flex items-center gap-2 text-green-400">
        <Shield className="w-4 h-4" />
        <span className="text-sm">
          Azure Connected • {azure.authStatus?.authMethod} • {azure.resources.length} resource(s)
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-gray-400">
      <Cloud className="w-4 h-4" />
      <span className="text-sm">Manual configuration mode</span>
    </div>
  )
}

function AutoDiscoverMode({
  azure,
  updateConfig,
  filteredResources,
  disabled
}: {
  azure: ReturnType<typeof useAzure>
  updateConfig: (updates: Partial<AzureOpenAIConfig>) => void
  filteredResources: AzureOpenAIResource[]
  disabled?: boolean
}) {
  if (!azure.isAuthenticated && !azure.isLoading) {
    return (
      <div className="p-4 bg-gray-800/50 rounded-lg text-center">
        <Cloud className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400 mb-3">
          Run <code className="bg-gray-700 px-2 py-0.5 rounded text-xs">az login</code> in terminal for auto-discovery
        </p>
        <p className="text-xs text-gray-500">Or switch to Manual Config mode</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Subscription Selector */}
      {azure.subscriptions.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Subscription</label>
          <div className="relative">
            <select
              value={azure.selectedSubscription?.id || ''}
              onChange={(e) => {
                const sub = azure.subscriptions.find(s => s.id === e.target.value)
                azure.selectSubscription(sub || null)
              }}
              disabled={disabled || azure.isLoading}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm appearance-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Subscriptions</option>
              {azure.subscriptions.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Resource Selector */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          OpenAI Resource ({filteredResources.length} available)
        </label>
        {azure.isLoading ? (
          <div className="p-3 bg-gray-800/50 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400 mx-auto" />
          </div>
        ) : filteredResources.length > 0 ? (
          <div className="grid gap-2 max-h-40 overflow-y-auto">
            {filteredResources.map(resource => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                isSelected={azure.selectedResource?.id === resource.id}
                onSelect={() => {
                  azure.selectResource(resource)
                  updateConfig({ 
                    endpoint: resource.endpoint,
                    deployment: resource.deployments[0]?.name || '',
                    modelName: resource.deployments[0]?.modelName
                  })
                }}
                disabled={disabled}
              />
            ))}
          </div>
        ) : (
          <div className="p-3 bg-gray-800/50 rounded-lg text-center text-sm text-gray-400">
            No Azure OpenAI resources found
          </div>
        )}
      </div>

      {/* Deployment Selector */}
      {azure.selectedResource && azure.selectedResource.deployments.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Model Deployment ({azure.selectedResource.deployments.length} available)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {azure.selectedResource.deployments.map(deployment => (
              <DeploymentCard
                key={deployment.name}
                deployment={deployment}
                isSelected={azure.selectedDeployment?.name === deployment.name}
                onSelect={() => {
                  azure.selectDeployment(deployment)
                  updateConfig({
                    deployment: deployment.name,
                    modelName: deployment.modelName
                  })
                }}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ManualConfigMode({
  config,
  updateConfig,
  disabled
}: {
  config: AzureOpenAIConfig
  updateConfig: (updates: Partial<AzureOpenAIConfig>) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Endpoint URL
        </label>
        <input
          type="url"
          value={config.endpoint}
          onChange={(e) => updateConfig({ endpoint: e.target.value })}
          placeholder="https://your-resource.openai.azure.com/"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Format: https://[resource-name].openai.azure.com/
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Deployment Name
        </label>
        <input
          type="text"
          value={config.deployment}
          onChange={(e) => updateConfig({ deployment: e.target.value })}
          placeholder="gpt-4o-mini"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          The deployment name from Azure Portal (not the model name)
        </p>
      </div>
    </div>
  )
}

function ResourceCard({
  resource,
  isSelected,
  onSelect,
  disabled
}: {
  resource: AzureOpenAIResource
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.01 }}
      whileTap={{ scale: disabled ? 1 : 0.99 }}
      onClick={onSelect}
      disabled={disabled}
      className={`p-3 rounded-lg text-left transition-all border ${
        isSelected
          ? 'bg-blue-600/20 border-blue-500'
          : 'bg-gray-800/50 hover:bg-gray-700/50 border-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-400" />
          <span className="text-white font-medium text-sm">{resource.name}</span>
        </div>
        {isSelected && <Check className="w-4 h-4 text-green-400" />}
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {resource.location} • {resource.deployments.length} deployment(s)
      </div>
    </motion.button>
  )
}

function DeploymentCard({
  deployment,
  isSelected,
  onSelect,
  disabled
}: {
  deployment: AzureOpenAIDeployment
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onSelect}
      disabled={disabled}
      className={`p-2 rounded-lg text-left transition-all border ${
        isSelected
          ? 'bg-purple-600/20 border-purple-500'
          : 'bg-gray-800/50 hover:bg-gray-700/50 border-gray-700'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-white font-medium text-sm">{deployment.name}</span>
        {isSelected && <Check className="w-4 h-4 text-green-400" />}
      </div>
      <span className="text-xs text-gray-400 block">
        {deployment.modelName} v{deployment.modelVersion}
      </span>
    </motion.button>
  )
}

function ConfigSummary({ config }: { config: AzureOpenAIConfig }) {
  return (
    <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        <Settings2 className="w-4 h-4" />
        <span className="text-xs font-medium">Current Configuration</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Endpoint:</span>
          <span className="text-white ml-1 break-all">{config.endpoint || '-'}</span>
        </div>
        <div>
          <span className="text-gray-500">Deployment:</span>
          <span className="text-white ml-1">{config.deployment || '-'}</span>
        </div>
        <div>
          <span className="text-gray-500">Auth:</span>
          <span className={`ml-1 ${config.useTokenAuth ? 'text-green-400' : 'text-yellow-400'}`}>
            {config.useTokenAuth ? 'Token' : 'API Key'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">API Version:</span>
          <span className="text-white ml-1">{config.apiVersion}</span>
        </div>
      </div>
    </div>
  )
}

export default AzureOpenAISetup
