import React, { useState, useEffect } from 'react';
import { aiService, AIProviderInfo, AIConfig, AIConfigResponse, getProviderIcon } from '../services/aiService';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured?: () => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose, onConfigured }) => {
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [currentConfig, setCurrentConfig] = useState<AIConfigResponse | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('built-in');
  const [config, setConfig] = useState<AIConfig>({
    providerId: 'built-in',
    apiKey: '',
    endpoint: '',
    modelName: '',
    deploymentName: '',
    maxTokens: 1000,
    temperature: 0.3
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [providersData, configData] = await Promise.all([
        aiService.getProviders(),
        aiService.getConfig()
      ]);
      setProviders(providersData);
      setCurrentConfig(configData);
      if (configData.currentProvider) {
        setSelectedProvider(configData.currentProvider.providerId);
        setConfig(prev => ({
          ...prev,
          providerId: configData.currentProvider!.providerId,
          endpoint: configData.endpoint || '',
          modelName: configData.modelName || '',
          deploymentName: configData.deploymentName || ''
        }));
      }
    } catch (err) {
      setError('Failed to load AI settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    setConfig(prev => ({
      ...prev,
      providerId,
      apiKey: '',
      endpoint: '',
      modelName: '',
      deploymentName: ''
    }));
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setError(null);
      const result = await aiService.testConnection(config);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await aiService.setConfig(config);
      setCurrentConfig(result);
      if (result.testResult?.success !== false) {
        onConfigured?.();
        onClose();
      } else {
        setError(result.testResult?.message || 'Configuration failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      await aiService.resetToBuiltIn();
      setSelectedProvider('built-in');
      setConfig({
        providerId: 'built-in',
        apiKey: '',
        endpoint: '',
        modelName: '',
        deploymentName: '',
        maxTokens: 1000,
        temperature: 0.3
      });
      setTestResult(null);
      await loadData();
    } catch (err) {
      setError('Failed to reset');
    } finally {
      setLoading(false);
    }
  };

  const selectedProviderInfo = providers.find(p => p.providerId === selectedProvider);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && !providers.length ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              {/* Current Status */}
              {currentConfig && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getProviderIcon(currentConfig.currentProvider?.providerId || 'built-in')}</span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Current: {currentConfig.currentProvider?.providerName || 'Built-in Analyzer'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {currentConfig.isUsingBuiltIn
                          ? 'Using smart heuristics (no AI API required)'
                          : currentConfig.hasApiKey
                            ? 'API key configured'
                            : 'API key not configured'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Provider Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select AI Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {providers.map(provider => (
                    <button
                      key={provider.providerId}
                      onClick={() => handleProviderChange(provider.providerId)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        selectedProvider === provider.providerId
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getProviderIcon(provider.providerId)}</span>
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          {provider.providerName}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider Description */}
              {selectedProviderInfo && (
                <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {selectedProviderInfo.description}
                  </p>
                </div>
              )}

              {/* Configuration Fields */}
              {selectedProvider !== 'built-in' && (
                <div className="space-y-4 mb-6">
                  {/* API Key */}
                  {selectedProviderInfo?.requiresApiKey && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={config.apiKey || ''}
                        onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder="Enter your API key"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Endpoint */}
                  {(selectedProvider === 'azure-openai' || selectedProvider === 'custom') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Endpoint URL
                      </label>
                      <input
                        type="text"
                        value={config.endpoint || ''}
                        onChange={e => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                        placeholder={selectedProvider === 'azure-openai' 
                          ? 'https://your-resource.openai.azure.com' 
                          : 'http://localhost:11434/v1'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Deployment Name (Azure) */}
                  {selectedProvider === 'azure-openai' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Deployment Name
                      </label>
                      <input
                        type="text"
                        value={config.deploymentName || ''}
                        onChange={e => setConfig(prev => ({ ...prev, deploymentName: e.target.value }))}
                        placeholder="gpt-4o"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Model Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Model Name {selectedProvider === 'azure-openai' && '(optional)'}
                    </label>
                    {selectedProviderInfo?.supportedModels && selectedProviderInfo.supportedModels.length > 0 ? (
                      <select
                        value={config.modelName || ''}
                        onChange={e => setConfig(prev => ({ ...prev, modelName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select a model</option>
                        {selectedProviderInfo.supportedModels.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={config.modelName || ''}
                        onChange={e => setConfig(prev => ({ ...prev, modelName: e.target.value }))}
                        placeholder="Enter model name"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>

                  {/* Advanced Settings */}
                  <details className="border border-gray-200 dark:border-gray-600 rounded-lg">
                    <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                      Advanced Settings
                    </summary>
                    <div className="p-4 border-t border-gray-200 dark:border-gray-600 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Max Tokens
                          </label>
                          <input
                            type="number"
                            value={config.maxTokens || 1000}
                            onChange={e => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Temperature
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            value={config.temperature || 0.3}
                            onChange={e => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      {selectedProvider === 'openai' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Organization ID (optional)
                          </label>
                          <input
                            type="text"
                            value={config.organizationId || ''}
                            onChange={e => setConfig(prev => ({ ...prev, organizationId: e.target.value }))}
                            placeholder="org-xxxxx"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}

              {/* Test Result */}
              {testResult && (
                <div className={`mb-6 p-4 rounded-lg ${testResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                      {testResult.message}
                    </span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Reset to Built-in
          </button>
          <div className="flex gap-3">
            {selectedProvider !== 'built-in' && (
              <button
                onClick={handleTestConnection}
                disabled={testing || loading}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISettingsModal;
