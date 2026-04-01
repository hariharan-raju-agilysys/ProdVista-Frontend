import { useState, useEffect, useCallback } from 'react';
import {
  getSmartResources,
  getTenantAzureSettings,
} from '../services/api';

export interface AzureSubscription {
  id?: string;
  subscriptionId: string;
  displayName: string;
  state?: string;
  tenantId?: string;
}

export interface AzureResource {
  id: string;
  name: string;
  type?: string;
  subscriptionId?: string;
  subscriptionName?: string;
  resourceGroup?: string;
  location?: string;
  customLabel?: string;
}

export interface UseAzureResourcesState {
  subscriptions: AzureSubscription[];
  workspaces: AzureResource[];
  appInsights: AzureResource[];
  isLoading: boolean;
  isSetupCompleted: boolean;
  needsSetup: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  
  // Default selections from settings
  defaultWorkspaceId: string | null;
  defaultAppInsightsId: string | null;
  defaultSubscriptionId: string | null;
}

export interface UseAzureResourcesActions {
  refresh: () => Promise<void>;
}

export type UseAzureResourcesReturn = UseAzureResourcesState & UseAzureResourcesActions;

/**
 * Hook to load saved Azure resources from tenant settings.
 * Returns only the resources that were selected during setup.
 * Fast database read - no Azure API calls needed.
 * 
 * Usage:
 * ```tsx
 * const { subscriptions, workspaces, isLoading, needsSetup } = useAzureResources();
 * 
 * if (needsSetup) {
 *   return <Navigate to="/azure-setup" />;
 * }
 * ```
 */
export function useAzureResources(): UseAzureResourcesReturn {
  const [state, setState] = useState<UseAzureResourcesState>({
    subscriptions: [],
    workspaces: [],
    appInsights: [],
    isLoading: true,
    isSetupCompleted: false,
    needsSetup: false,
    lastSyncedAt: null,
    error: null,
    defaultWorkspaceId: null,
    defaultAppInsightsId: null,
    defaultSubscriptionId: null,
  });

  const loadResources = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Get saved resources from database (fast)
      const resources = await getSmartResources();
      
      // Also get tenant settings for defaults
      let defaults = {
        defaultWorkspaceId: null as string | null,
        defaultAppInsightsId: null as string | null,
        defaultSubscriptionId: null as string | null,
      };
      
      try {
        const settings = await getTenantAzureSettings();
        defaults = {
          defaultWorkspaceId: settings.defaultWorkspaceId || null,
          defaultAppInsightsId: settings.defaultAppInsightsId || null,
          defaultSubscriptionId: settings.defaultSubscriptionId || null,
        };
      } catch (err) {
        console.warn('Could not load tenant settings:', err);
      }
      
      setState({
        subscriptions: resources.subscriptions,
        workspaces: resources.workspaces,
        appInsights: resources.appInsights,
        isLoading: false,
        isSetupCompleted: resources.isSetupCompleted,
        needsSetup: resources.needsSetup || !resources.isSetupCompleted,
        lastSyncedAt: resources.lastSyncedAt || null,
        error: null,
        ...defaults
      });
    } catch (err) {
      console.error('Error loading Azure resources:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load resources'
      }));
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  return {
    ...state,
    refresh: loadResources,
  };
}

/**
 * Hook to check if Azure setup is needed.
 * Returns a simple status object for routing decisions.
 */
export function useAzureSetupStatus() {
  const [status, setStatus] = useState<{
    isLoading: boolean;
    isSetupCompleted: boolean;
    needsSetup: boolean;
  }>({
    isLoading: true,
    isSetupCompleted: false,
    needsSetup: true,
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const settings = await getTenantAzureSettings();
        const isSetupCompleted = settings.isSetupCompleted === true;
        
        setStatus({
          isLoading: false,
          isSetupCompleted,
          needsSetup: !isSetupCompleted,
        });
      } catch (err) {
        console.warn('Error checking Azure setup status:', err);
        setStatus({
          isLoading: false,
          isSetupCompleted: false,
          needsSetup: true,
        });
      }
    };
    
    checkStatus();
  }, []);

  return status;
}

export default useAzureResources;
