/**
 * useAzureOpenAI Hook
 * Custom hook for Azure OpenAI resource discovery and selection
 * Specifically for AI Query Assistant and similar features
 */

import { useState, useEffect, useCallback } from 'react';
import { azureResourceService } from '../services/azureResourceService';
import type {
  AzureOpenAIResource,
  AzureOpenAIDeployment,
  AzureSqlDatabase,
  AzureAutoConfigResult
} from '../types/azure';

// ============================================================================
// Types
// ============================================================================

export interface UseAzureOpenAIState {
  // Data
  openAIResources: AzureOpenAIResource[];
  deployments: AzureOpenAIDeployment[];
  databases: AzureSqlDatabase[];
  
  // Selections
  selectedResource: AzureOpenAIResource | undefined;
  selectedDeployment: AzureOpenAIDeployment | undefined;
  
  // Loading states
  isLoadingResources: boolean;
  isLoadingDeployments: boolean;
  isLoadingDatabases: boolean;
  isAutoConfiguring: boolean;
  
  // Errors
  error: string | null;
  
  // Auto-config result
  autoConfigResult: AzureAutoConfigResult | null;
}

export interface UseAzureOpenAIOptions {
  autoLoad?: boolean;
  subscriptionIds?: string[];
  initialResourceEndpoint?: string;
  initialDeploymentName?: string;
}

export interface UseAzureOpenAIReturn extends UseAzureOpenAIState {
  // Methods
  refreshResources: () => Promise<void>;
  selectResource: (resource: AzureOpenAIResource | undefined) => Promise<void>;
  selectDeployment: (deployment: AzureOpenAIDeployment | undefined) => void;
  selectByEndpoint: (endpoint: string) => Promise<void>;
  selectByDeploymentName: (deploymentName: string) => void;
  autoConfiguration: () => Promise<AzureAutoConfigResult>;
  clearError: () => void;
  
  // Computed
  endpoint: string | undefined;
  deploymentName: string | undefined;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAzureOpenAI(options: UseAzureOpenAIOptions = {}): UseAzureOpenAIReturn {
  const {
    autoLoad = true,
    subscriptionIds,
    initialResourceEndpoint,
    initialDeploymentName
  } = options;

  // Data state
  const [openAIResources, setOpenAIResources] = useState<AzureOpenAIResource[]>([]);
  const [deployments, setDeployments] = useState<AzureOpenAIDeployment[]>([]);
  const [databases, _setDatabases] = useState<AzureSqlDatabase[]>([]);
  
  // Selection state
  const [selectedResource, setSelectedResource] = useState<AzureOpenAIResource | undefined>();
  const [selectedDeployment, setSelectedDeployment] = useState<AzureOpenAIDeployment | undefined>();
  
  // Loading states
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(false);
  const [isLoadingDatabases, _setIsLoadingDatabases] = useState(false);
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Auto-config result
  const [autoConfigResult, setAutoConfigResult] = useState<AzureAutoConfigResult | null>(null);

  // ============================================================================
  // Refresh Resources
  // ============================================================================

  const refreshResources = useCallback(async () => {
    setIsLoadingResources(true);
    setError(null);
    try {
      const resources = await azureResourceService.getOpenAIResources(subscriptionIds, true);
      setOpenAIResources(resources);
      
      // Auto-select based on initial endpoint
      if (initialResourceEndpoint && resources.length > 0) {
        const matching = resources.find(r => 
          r.endpoint?.toLowerCase() === initialResourceEndpoint.toLowerCase() ||
          r.endpoint?.toLowerCase().includes(initialResourceEndpoint.toLowerCase().replace('https://', '').replace('.openai.azure.com/', ''))
        );
        if (matching) {
          await selectResource(matching);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OpenAI resources');
    } finally {
      setIsLoadingResources(false);
    }
  }, [subscriptionIds, initialResourceEndpoint]);

  // ============================================================================
  // Resource Selection
  // ============================================================================

  const selectResource = useCallback(async (resource: AzureOpenAIResource | undefined) => {
    setSelectedResource(resource);
    setSelectedDeployment(undefined);
    setDeployments([]);
    
    if (resource) {
      setIsLoadingDeployments(true);
      try {
        const deps = await azureResourceService.getDeployments(resource.id, true);
        setDeployments(deps);
        
        // Auto-select based on initial deployment name
        if (initialDeploymentName && deps.length > 0) {
          const matching = deps.find(d => d.name === initialDeploymentName);
          if (matching) {
            setSelectedDeployment(matching);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load deployments');
      } finally {
        setIsLoadingDeployments(false);
      }
    }
  }, [initialDeploymentName]);

  const selectDeployment = useCallback((deployment: AzureOpenAIDeployment | undefined) => {
    setSelectedDeployment(deployment);
  }, []);

  const selectByEndpoint = useCallback(async (endpoint: string) => {
    const resource = openAIResources.find(r => 
      r.endpoint?.toLowerCase() === endpoint.toLowerCase() ||
      r.endpoint?.toLowerCase().includes(endpoint.toLowerCase().replace('https://', '').replace('.openai.azure.com/', ''))
    );
    if (resource) {
      await selectResource(resource);
    }
  }, [openAIResources, selectResource]);

  const selectByDeploymentName = useCallback((deploymentName: string) => {
    const deployment = deployments.find(d => d.name === deploymentName);
    if (deployment) {
      setSelectedDeployment(deployment);
    }
  }, [deployments]);

  // ============================================================================
  // Auto-Configuration
  // ============================================================================

  const autoConfiguration = useCallback(async (): Promise<AzureAutoConfigResult> => {
    setIsAutoConfiguring(true);
    setError(null);
    try {
      const result = await azureResourceService.autoConfiguration();
      setAutoConfigResult(result);
      
      if (result.success) {
        await refreshResources();
      }
      
      return result;
    } catch (err) {
      const errorResult: AzureAutoConfigResult = {
        success: false,
        message: err instanceof Error ? err.message : 'Auto-configuration failed',
        discoveredSubscriptions: 0,
        discoveredOpenAIResources: 0,
        discoveredDeployments: 0,
        discoveredDatabases: 0
      };
      setAutoConfigResult(errorResult);
      return errorResult;
    } finally {
      setIsAutoConfiguring(false);
    }
  }, [refreshResources]);

  // ============================================================================
  // Clear Error
  // ============================================================================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================================================
  // Auto-load on mount
  // ============================================================================

  useEffect(() => {
    if (autoLoad) {
      refreshResources();
    }
  }, [autoLoad]); // Don't include refreshResources to avoid infinite loop

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Data
    openAIResources,
    deployments,
    databases,
    
    // Selections
    selectedResource,
    selectedDeployment,
    
    // Loading states
    isLoadingResources,
    isLoadingDeployments,
    isLoadingDatabases,
    isAutoConfiguring,
    
    // Error
    error,
    
    // Auto-config result
    autoConfigResult,
    
    // Methods
    refreshResources,
    selectResource,
    selectDeployment,
    selectByEndpoint,
    selectByDeploymentName,
    autoConfiguration,
    clearError,
    
    // Computed
    endpoint: selectedResource?.endpoint,
    deploymentName: selectedDeployment?.name
  };
}

export default useAzureOpenAI;
