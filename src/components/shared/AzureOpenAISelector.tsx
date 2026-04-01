import React, { useEffect } from 'react';
import { useAzureOpenAI } from '../../hooks/useAzureOpenAI';
import { AzureResourceSelectorProps } from '../../types';
import { Sparkles, RefreshCw, Check, AlertCircle, ChevronDown, Loader2 } from 'lucide-react';

interface AzureOpenAISelectorProps extends Partial<AzureResourceSelectorProps> {
  onSelectionChange?: (selection: {
    endpoint: string;
    deploymentName: string;
    resourceName?: string;
    subscriptionId?: string;
  }) => void;
  initialEndpoint?: string;
  initialDeploymentName?: string;
  showAutoDiscover?: boolean;
  compact?: boolean;
  className?: string;
}

export const AzureOpenAISelector: React.FC<AzureOpenAISelectorProps> = ({
  onSelectionChange,
  initialEndpoint,
  initialDeploymentName,
  showAutoDiscover = true,
  compact = false,
  className = '',
}) => {
  const {
    openAIResources,
    deployments,
    selectedResource,
    selectedDeployment,
    isLoadingResources,
    isLoadingDeployments,
    error,
    refreshResources,
    selectResource,
    selectDeployment,
    selectByEndpoint,
    autoConfiguration,
  } = useAzureOpenAI();

  // Initialize with provided values
  useEffect(() => {
    if (initialEndpoint && openAIResources.length > 0) {
      selectByEndpoint(initialEndpoint);
    }
  }, [initialEndpoint, openAIResources]);

  // Select initial deployment
  useEffect(() => {
    if (initialDeploymentName && deployments.length > 0) {
      const deployment = deployments.find(d => d.name === initialDeploymentName);
      if (deployment) {
        selectDeployment(deployment);
      }
    }
  }, [initialDeploymentName, deployments]);

  // Notify parent of selection changes
  useEffect(() => {
    if (selectedResource && selectedDeployment && onSelectionChange) {
      onSelectionChange({
        endpoint: selectedResource.endpoint,
        deploymentName: selectedDeployment.name,
        resourceName: selectedResource.name,
        subscriptionId: selectedResource.subscriptionId,
      });
    }
  }, [selectedResource, selectedDeployment, onSelectionChange]);

  const handleAutoDiscover = async () => {
    const result = await autoConfiguration();
    if (result && result.success && result.suggestedEndpoint && result.suggestedDeployment && onSelectionChange) {
      onSelectionChange({
        endpoint: result.suggestedEndpoint,
        deploymentName: result.suggestedDeployment,
      });
    }
  };

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2">
          <select
            value={selectedResource?.id || ''}
            onChange={(e) => {
              const resource = openAIResources.find(r => r.id === e.target.value);
              if (resource) selectResource(resource);
            }}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoadingResources}
          >
            <option value="">Select OpenAI Resource</option>
            {openAIResources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
          <select
            value={selectedDeployment?.id || ''}
            onChange={(e) => {
              const deployment = deployments.find(d => d.id === e.target.value);
              if (deployment) selectDeployment(deployment);
            }}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!selectedResource || isLoadingDeployments}
          >
            <option value="">Select Deployment</option>
            {deployments.map((deployment) => (
              <option key={deployment.id} value={deployment.id}>
                {deployment.name} ({deployment.model})
              </option>
            ))}
          </select>
          <button
            onClick={() => refreshResources()}
            disabled={isLoadingResources}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-300 ${isLoadingResources ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Auto-Discover */}
      {showAutoDiscover && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Azure OpenAI Configuration
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoDiscover}
              disabled={isLoadingResources}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all text-sm font-medium"
            >
              {isLoadingResources ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Auto-Discover
            </button>
            <button
              onClick={() => refreshResources()}
              disabled={isLoadingResources}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              title="Refresh resources"
            >
              <RefreshCw className={`w-4 h-4 text-gray-300 ${isLoadingResources ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Resource Selection */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* OpenAI Resource Dropdown */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            OpenAI Resource
          </label>
          <div className="relative">
            <select
              value={selectedResource?.id || ''}
              onChange={(e) => {
                const resource = openAIResources.find(r => r.id === e.target.value);
                if (resource) selectResource(resource);
              }}
              disabled={isLoadingResources}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {isLoadingResources ? 'Loading resources...' : 'Select an OpenAI resource'}
              </option>
              {openAIResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name} ({resource.location})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          {selectedResource && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Check className="w-3 h-3 text-green-400" />
              <span className="truncate">{selectedResource.endpoint}</span>
            </div>
          )}
        </div>

        {/* Deployment Dropdown */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Model Deployment
          </label>
          <div className="relative">
            <select
              value={selectedDeployment?.id || ''}
              onChange={(e) => {
                const deployment = deployments.find(d => d.id === e.target.value);
                if (deployment) selectDeployment(deployment);
              }}
              disabled={!selectedResource || isLoadingDeployments}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {isLoadingDeployments
                  ? 'Loading deployments...'
                  : !selectedResource
                  ? 'Select a resource first'
                  : 'Select a deployment'}
              </option>
              {deployments.map((deployment) => (
                <option key={deployment.id} value={deployment.id}>
                  {deployment.name} - {deployment.model}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          {selectedDeployment && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Check className="w-3 h-3 text-green-400" />
              <span>
                Model: {selectedDeployment.model}{selectedDeployment.modelVersion ? ` | Version: ${selectedDeployment.modelVersion}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Selection Summary */}
      {selectedResource && selectedDeployment && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-400">Configuration Complete</p>
              <div className="text-xs text-gray-400 space-y-0.5">
                <p>
                  <span className="text-gray-500">Endpoint:</span>{' '}
                  <code className="px-1 py-0.5 bg-gray-800 rounded">{selectedResource.endpoint}</code>
                </p>
                <p>
                  <span className="text-gray-500">Deployment:</span>{' '}
                  <code className="px-1 py-0.5 bg-gray-800 rounded">{selectedDeployment.name}</code>
                </p>
                <p>
                  <span className="text-gray-500">Model:</span>{' '}
                  <code className="px-1 py-0.5 bg-gray-800 rounded">{selectedDeployment.model}</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingResources && openAIResources.length === 0 && (
        <div className="p-6 text-center border border-gray-700 rounded-lg border-dashed">
          <Sparkles className="w-10 h-10 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No Azure OpenAI resources found</p>
          <p className="text-xs text-gray-500 mb-4">
            Make sure you're signed in to Azure and have OpenAI resources in your subscriptions.
          </p>
          <button
            onClick={() => refreshResources()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
          >
            Refresh Resources
          </button>
        </div>
      )}
    </div>
  );
};

export default AzureOpenAISelector;
