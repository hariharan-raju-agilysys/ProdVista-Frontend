/**
 * LLMConfigPanel - Unified LLM Configuration
 * 
 * Supports:
 * - Azure OpenAI (cloud)
 * - OpenAI (cloud)
 * 
 * Uses centralized Azure service for all Azure operations.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Settings, Save, RotateCcw, Check, X, AlertCircle, 
  Cpu, Cloud, Key, Thermometer, Hash, Loader2
} from 'lucide-react'
import { useSettingsStore, useIsManager, type LLMConfig } from '../stores/settingsStore'
import api from '../services/api'
import AzureOpenAISetup, { type AzureOpenAIConfig } from './AzureOpenAISetup'

// ============================================================================
// Types
// ============================================================================

interface LLMModel {
  id: string
  name: string
  description: string
  provider: 'azure-openai' | 'openai'
}

interface TestResult {
  success: boolean
  model: string
  response: string
  error?: string
  duration: number
}

// ============================================================================
// Static Data
// ============================================================================

const staticModels: LLMModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient', provider: 'openai' },
]

// ============================================================================
// Main Component
// ============================================================================

export function LLMConfigPanel() {
  const { settings, updateLLMConfig } = useSettingsStore()
  const isManager = useIsManager()
  
  // Track if we've loaded from server to prevent overwriting user edits
  const hasLoadedFromServer = useRef(false)
  const isUserEditing = useRef(false)
  
  // Local state
  const [config, setConfig] = useState<LLMConfig>(settings.llm)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  
  // Connection/Test state
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  const [testResult, setTestResult] = useState<TestResult | null>(null)
  
  // Azure OpenAI config (for the new component)
  const [azureConfig, setAzureConfig] = useState<AzureOpenAIConfig>({
    endpoint: config.baseUrl || '',
    deployment: config.model || '',
    useTokenAuth: true,
    apiVersion: '2024-02-15-preview'
  })

  // ============================================================================
  // Effects
  // ============================================================================

  // Sync with settings store - only on initial mount, not during user edits
  useEffect(() => {
    // Don't sync if we've already loaded from server and user is editing
    if (hasLoadedFromServer.current && hasChanges) {
      return
    }
    
    setConfig(settings.llm)
    if (settings.llm.provider === 'azure-openai') {
      setAzureConfig(prev => ({
        ...prev,
        endpoint: settings.llm.baseUrl || prev.endpoint,
        deployment: settings.llm.model || prev.deployment
      }))
    }
  }, [settings.llm])

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(config) !== JSON.stringify(settings.llm)
    setHasChanges(changed)
    isUserEditing.current = changed
  }, [config, settings.llm])

  // Load settings from backend on mount
  useEffect(() => {
    loadSettingsFromServer()
  }, [])

  // ============================================================================
  // API Functions
  // ============================================================================

  const loadSettingsFromServer = async () => {
    try {
      const response = await api.get('/llm/settings')
      if (response.data) {
        const serverConfig: LLMConfig = {
          provider: response.data.provider as LLMConfig['provider'],
          baseUrl: response.data.baseUrl,
          model: response.data.model,
          temperature: response.data.temperature,
          maxTokens: response.data.maxTokens,
        }
        
        // Always update with server data on initial load
        updateLLMConfig(serverConfig)
        setConfig(serverConfig)
        
        if (response.data.useAzureTokenAuth !== undefined) {
          setAzureConfig(prev => ({
            ...prev,
            useTokenAuth: response.data.useAzureTokenAuth,
            endpoint: response.data.baseUrl || prev.endpoint,
            deployment: response.data.model || prev.deployment
          }))
        }
        
        // Mark that we've loaded from server
        hasLoadedFromServer.current = true
      }
    } catch (error) {
      console.log('Could not load LLM settings from server:', error)
      // Still mark as loaded even on error to prevent overwriting user edits
      hasLoadedFromServer.current = true
    }
  }

  const saveConfig = async () => {
    setIsSaving(true)
    setSaveError(null)
    
    try {
      const payload = {
        provider: config.provider,
        baseUrl: config.provider === 'azure-openai' ? azureConfig.endpoint : config.baseUrl,
        model: config.provider === 'azure-openai' ? azureConfig.deployment : config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        apiKey: config.provider === 'azure-openai' ? azureConfig.apiKey : config.apiKey,
        useAzureTokenAuth: azureConfig.useTokenAuth,
        azureApiVersion: azureConfig.apiVersion,
        isEnabled: true
      }
      
      await api.post('/llm/settings', payload)
      
      // Update local config with Azure values if needed
      const finalConfig = {
        ...config,
        baseUrl: config.provider === 'azure-openai' ? azureConfig.endpoint : config.baseUrl,
        model: config.provider === 'azure-openai' ? azureConfig.deployment : config.model,
        apiKey: config.provider === 'azure-openai' ? azureConfig.apiKey : config.apiKey
      }
      
      updateLLMConfig(finalConfig)
      setConfig(finalConfig)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save LLM settings:', error)
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const testConnection = async () => {
    setIsTestingConnection(true)
    setConnectionStatus('idle')
    
    try {
      await api.get('/llm/status')
      setConnectionStatus('success')
    } catch {
      setConnectionStatus('error')
    } finally {
      setIsTestingConnection(false)
    }
  }



  const resetConfig = () => {
    setConfig(settings.llm)
    setHasChanges(false)
  }

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAzureConfigChange = useCallback((newAzureConfig: AzureOpenAIConfig) => {
    setAzureConfig(newAzureConfig)
    // Update main config with Azure values
    setConfig(prev => ({
      ...prev,
      baseUrl: newAzureConfig.endpoint,
      model: newAzureConfig.deployment,
      apiKey: newAzureConfig.apiKey
    }))
    setHasChanges(true)
  }, [])

  const handleProviderChange = useCallback((provider: LLMConfig['provider']) => {
    setConfig(prev => ({
      ...prev,
      provider,
      baseUrl: provider === 'azure-openai' ? azureConfig.endpoint :
               'https://api.openai.com/v1',
      model: provider === 'azure-openai' ? azureConfig.deployment :
             'gpt-4o-mini'
    }))
    setConnectionStatus('idle')
    setTestResult(null)
  }, [azureConfig])

  // ============================================================================
  // Helpers
  // ============================================================================

  const getAvailableModels = (): LLMModel[] => {
    return staticModels.filter(m => m.provider === config.provider)
  }

  const availableModels = getAvailableModels()

  // ============================================================================
  // Render - Non-manager view
  // ============================================================================

  if (!isManager) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center gap-3 text-gray-400">
          <AlertCircle className="w-5 h-5" />
          <span>Only managers can configure LLM settings</span>
        </div>
        <div className="mt-4 p-4 bg-gray-900/50 rounded-lg">
          <p className="text-sm text-gray-500">Current Model: <span className="text-white">{settings.llm.model}</span></p>
          <p className="text-sm text-gray-500">Provider: <span className="text-white">{settings.llm.provider}</span></p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // Render - Main
  // ============================================================================

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Cpu className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">LLM Configuration</h3>
              <p className="text-sm text-gray-400">Configure AI model for analysis</p>
            </div>
          </div>
          
          {/* Save/Reset Buttons */}
          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2"
              >
                <button
                  onClick={resetConfig}
                  disabled={isSaving}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  title="Reset changes"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={saveConfig}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {saveError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-yellow-400 mt-2"
          >
            Warning: {saveError}
          </motion.div>
        )}
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Cloud className="w-4 h-4 inline mr-2" />
            Provider
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(['azure-openai', 'openai'] as const).map((provider) => (
              <button
                key={provider}
                onClick={() => handleProviderChange(provider)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  config.provider === provider
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <span className="text-white capitalize">{provider.replace('-', ' ')}</span>
                <span className="block text-xs text-gray-400 mt-1">
                  Cloud
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Azure OpenAI Configuration */}
        {config.provider === 'azure-openai' && (
          <AzureOpenAISetup
            value={azureConfig}
            onChange={handleAzureConfigChange}
          />
        )}

        {/* OpenAI Configuration */}
        {config.provider === 'openai' && (
          <OpenAIConfig
            config={config}
            setConfig={setConfig}
            availableModels={availableModels}
          />
        )}

        {/* Temperature & Max Tokens */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Thermometer className="w-4 h-4 inline mr-2" />
              Temperature: {config.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Hash className="w-4 h-4 inline mr-2" />
              Max Tokens
            </label>
            <input
              type="number"
              value={config.maxTokens}
              onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 2048 })}
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              min="256"
              max="8192"
              step="256"
            />
          </div>
        </div>

        {/* Test Section */}
        <TestSection
          config={config}
          connectionStatus={connectionStatus}
          isTestingConnection={isTestingConnection}
          testResult={testResult}
          onTestConnection={testConnection}
        />
      </div>
    </motion.div>
  )
}

// ============================================================================
// Sub-Components
// ============================================================================

function OpenAIConfig({
  config,
  setConfig,
  availableModels
}: {
  config: LLMConfig
  setConfig: (c: LLMConfig) => void
  availableModels: LLMModel[]
}) {
  return (
    <div className="space-y-4">
      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <Key className="w-4 h-4 inline mr-2" />
          API Key
        </label>
        <input
          type="password"
          value={config.apiKey || ''}
          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none"
          placeholder="sk-..."
        />
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <Cpu className="w-4 h-4 inline mr-2" />
          Model
        </label>
        <div className="grid grid-cols-2 gap-2">
          {availableModels.map((model) => (
            <motion.button
              key={model.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setConfig({ ...config, model: model.id })}
              className={`p-3 rounded-lg text-left transition-all border ${
                config.model === model.id
                  ? 'bg-purple-600 border-purple-500'
                  : 'bg-gray-700/50 hover:bg-gray-700 border-gray-600'
              }`}
            >
              <span className="text-white font-medium">{model.name}</span>
              <span className="block text-xs text-gray-400 mt-1">{model.description}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}

function TestSection({
  config,
  connectionStatus,
  isTestingConnection,
  testResult,
  onTestConnection,
}: {
  config: LLMConfig
  connectionStatus: 'idle' | 'success' | 'error'
  isTestingConnection: boolean
  testResult: TestResult | null
  onTestConnection: () => void
}) {
  return (
    <div className="pt-4 border-t border-gray-700 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onTestConnection}
          disabled={isTestingConnection}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isTestingConnection ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : connectionStatus === 'success' ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : connectionStatus === 'error' ? (
            <X className="w-4 h-4 text-red-400" />
          ) : (
            <Settings className="w-4 h-4" />
          )}
          Test Connection
        </button>
      </div>

      {connectionStatus === 'success' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-green-400"
        >
          ✓ Connected successfully to {config.provider}
        </motion.p>
      )}
      
      {connectionStatus === 'error' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-red-400"
        >
          ✗ Could not connect. Make sure the service is running.
        </motion.p>
      )}

      {/* Test Result */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-lg ${
              testResult.success 
                ? 'bg-green-900/30 border border-green-700' 
                : 'bg-red-900/30 border border-red-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`font-medium ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.success ? '✓ Model Response' : '✗ Test Failed'}
              </span>
              {testResult.success && (
                <span className="text-xs text-gray-400">
                  {(testResult.duration / 1000).toFixed(2)}s
                </span>
              )}
            </div>
            {testResult.success ? (
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{testResult.response}</p>
            ) : (
              <p className="text-sm text-red-300">{testResult.error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LLMConfigPanel
