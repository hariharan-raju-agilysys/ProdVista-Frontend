import { useState, useEffect } from 'react';
import {
  Cloud, Check, CheckCircle2, AlertTriangle, Loader2,
  ChevronDown, ChevronRight, Search, Zap, RefreshCw,
  Database, Activity, Server, Save, X
} from 'lucide-react';
import clsx from 'clsx';
import api from '../services/api';

interface Subscription {
  id: string;
  subscriptionId: string;
  displayName: string;
  state: string;
  tenantId?: string;
}

interface AzureResource {
  id: string;
  name: string;
  type?: string;
  subscriptionId?: string;
  subscriptionName?: string;
  resourceGroup?: string;
  location?: string;
  customLabel?: string;
}

interface ResourceGroup {
  id: string;
  name: string;
  subscriptionId: string;
  location: string;
  subscriptionName?: string;
}

interface TenantAzureSettings {
  isSetupCompleted: boolean;
  lastSyncedAt?: string;
  selectedSubscriptions: Subscription[];
  selectedResourceGroups: ResourceGroup[];
  selectedLogAnalyticsWorkspaces: AzureResource[];
  selectedAppInsights: AzureResource[];
  selectedResources: AzureResource[];
  defaultWorkspaceId?: string;
  defaultAppInsightsId?: string;
}

export function AzureResourceSetup() {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'intro' | 'subscriptions' | 'resources' | 'review'>('intro');
  
  // All available resources from Azure
  const [availableSubscriptions, setAvailableSubscriptions] = useState<Subscription[]>([]);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<AzureResource[]>([]);
  const [availableAppInsights, setAvailableAppInsights] = useState<AzureResource[]>([]);
  
  // Selected resources
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(new Set());
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set());
  const [selectedAppInsights, setSelectedAppInsights] = useState<Set<string>>(new Set());
  
  // Defaults
  const [defaultWorkspace, setDefaultWorkspace] = useState<string | null>(null);
  const [defaultAppInsight, setDefaultAppInsight] = useState<string | null>(null);
  
  // Current settings from backend
  const [currentSettings, setCurrentSettings] = useState<TenantAzureSettings | null>(null);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Loading states
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // LocalStorage key for draft selections
  const DRAFT_STORAGE_KEY = 'azure-setup-draft';

  // Save draft selections to localStorage whenever they change
  useEffect(() => {
    const draft = {
      step,
      selectedSubscriptions: Array.from(selectedSubscriptions),
      selectedWorkspaces: Array.from(selectedWorkspaces),
      selectedAppInsights: Array.from(selectedAppInsights),
      defaultWorkspace,
      defaultAppInsight,
      savedAt: new Date().toISOString()
    };
    // Only save if we have any selections
    if (selectedSubscriptions.size > 0 || selectedWorkspaces.size > 0 || selectedAppInsights.size > 0) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [step, selectedSubscriptions, selectedWorkspaces, selectedAppInsights, defaultWorkspace, defaultAppInsight]);

  // Load draft on mount (before loading from backend)
  useEffect(() => {
    const loadDraft = () => {
      try {
        const draftStr = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (draftStr) {
          const draft = JSON.parse(draftStr);
          // Only restore draft if it's recent (within 24 hours)
          const savedAt = new Date(draft.savedAt);
          const hoursSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceSave < 24) {
            if (draft.selectedSubscriptions?.length > 0) {
              setSelectedSubscriptions(new Set(draft.selectedSubscriptions));
            }
            if (draft.selectedWorkspaces?.length > 0) {
              setSelectedWorkspaces(new Set(draft.selectedWorkspaces));
            }
            if (draft.selectedAppInsights?.length > 0) {
              setSelectedAppInsights(new Set(draft.selectedAppInsights));
            }
            if (draft.defaultWorkspace) {
              setDefaultWorkspace(draft.defaultWorkspace);
            }
            if (draft.defaultAppInsight) {
              setDefaultAppInsight(draft.defaultAppInsight);
            }
            // Restore step if we have selections
            if (draft.step && draft.step !== 'intro') {
              setStep(draft.step);
            }
            console.log('Restored Azure setup draft from', savedAt.toLocaleString());
          }
        }
      } catch (err) {
        console.warn('Error loading draft:', err);
      }
    };
    loadDraft();
  }, []);

  // Clear draft after successful save
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  // Load existing settings
  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      const response = await api.get('/azure/settings');
      const settings = response.data;
      setCurrentSettings(settings);
      
      // Pre-populate selections from existing settings (overrides draft)
      if (settings.isSetupCompleted) {
        setSelectedSubscriptions(new Set(settings.selectedSubscriptions?.map((s: Subscription) => s.subscriptionId) || []));
        setSelectedWorkspaces(new Set(settings.selectedLogAnalyticsWorkspaces?.map((w: AzureResource) => w.id) || []));
        setSelectedAppInsights(new Set(settings.selectedAppInsights?.map((a: AzureResource) => a.id) || []));
        setDefaultWorkspace(settings.defaultWorkspaceId || null);
        setDefaultAppInsight(settings.defaultAppInsightsId || null);
        setStep('review');
        // Clear any draft since we have saved settings
        clearDraft();
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  // Load subscriptions
  const loadSubscriptions = async () => {
    setLoadingStep('subscriptions');
    try {
      const response = await api.get('/azure/subscriptions');
      setAvailableSubscriptions(response.data.subscriptions || []);
      setError(null);
    } catch (err) {
      setError('Failed to load subscriptions. Please check Azure authentication.');
      console.error('Error loading subscriptions:', err);
    } finally {
      setLoadingStep(null);
    }
  };

  // Load workspaces using Resource Graph (single API call - much faster)
  const loadWorkspaces = async () => {
    setLoadingStep('workspaces');
    try {
      const subscriptionIds = Array.from(selectedSubscriptions).join(',');
      
      // Use Resource Graph endpoint - single fast query across all subscriptions
      const response = await api.get(`/resourcegraph/workspaces`, {
        params: { subscriptionIds }
      });
      
      // Map workspaces with subscription names
      const workspaces: AzureResource[] = (response.data.workspaces || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        type: 'Microsoft.OperationalInsights/workspaces',
        subscriptionId: w.subscriptionId,
        subscriptionName: availableSubscriptions.find(s => s.subscriptionId === w.subscriptionId)?.displayName,
        resourceGroup: w.resourceGroup,
        location: w.location
      }));
      
      setAvailableWorkspaces(workspaces);
      console.log(`Loaded ${workspaces.length} workspaces in ${response.data.queryTimeMs}ms`);
    } catch (err) {
      console.error('Error loading workspaces:', err);
      setAvailableWorkspaces([]);
    } finally {
      setLoadingStep(null);
    }
  };

  // Load App Insights using Resource Graph (single API call - much faster)
  const loadAppInsights = async () => {
    setLoadingStep('appinsights');
    try {
      const subscriptionIds = Array.from(selectedSubscriptions).join(',');
      
      // Use Resource Graph endpoint - single fast query across all subscriptions
      const response = await api.get(`/resourcegraph/appinsights`, {
        params: { subscriptionIds }
      });
      
      // Map app insights with subscription names
      const appInsights: AzureResource[] = (response.data.appInsights || []).map((ai: any) => ({
        id: ai.id,
        name: ai.name,
        type: 'microsoft.insights/components',
        subscriptionId: ai.subscriptionId,
        subscriptionName: availableSubscriptions.find(s => s.subscriptionId === ai.subscriptionId)?.displayName,
        resourceGroup: ai.resourceGroup,
        location: ai.location
      }));
      
      setAvailableAppInsights(appInsights);
      console.log(`Loaded ${appInsights.length} App Insights in ${response.data.queryTimeMs}ms`);
    } catch (err) {
      console.error('Error loading App Insights:', err);
      setAvailableAppInsights([]);
    } finally {
      setLoadingStep(null);
    }
  };

  // Proceed to next step
  const handleNext = async () => {
    switch (step) {
      case 'intro':
        setStep('subscriptions');
        await loadSubscriptions();
        break;
      case 'subscriptions':
        if (selectedSubscriptions.size === 0) {
          setError('Please select at least one subscription');
          return;
        }
        setStep('resources');
        // Load all monitoring resources in one call (much faster)
        await loadMonitoringResources();
        break;
      case 'resources':
        setStep('review');
        break;
    }
  };

  // Load both workspaces and app insights in a single Resource Graph call
  const loadMonitoringResources = async () => {
    setLoadingStep('loading monitoring resources');
    try {
      const subscriptionIds = Array.from(selectedSubscriptions).join(',');
      
      // Single call to get both workspaces and app insights
      const response = await api.get(`/resourcegraph/monitoring`, {
        params: { subscriptionIds }
      });
      
      // Map workspaces
      const workspaces: AzureResource[] = (response.data.workspaces || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        type: 'Microsoft.OperationalInsights/workspaces',
        subscriptionId: w.subscriptionId,
        subscriptionName: availableSubscriptions.find(s => s.subscriptionId === w.subscriptionId)?.displayName,
        resourceGroup: w.resourceGroup,
        location: w.location
      }));
      
      // Map app insights
      const appInsights: AzureResource[] = (response.data.appInsights || []).map((ai: any) => ({
        id: ai.id,
        name: ai.name,
        type: 'microsoft.insights/components',
        subscriptionId: ai.subscriptionId,
        subscriptionName: availableSubscriptions.find(s => s.subscriptionId === ai.subscriptionId)?.displayName,
        resourceGroup: ai.resourceGroup,
        location: ai.location
      }));
      
      setAvailableWorkspaces(workspaces);
      setAvailableAppInsights(appInsights);
      console.log(`Loaded ${workspaces.length} workspaces and ${appInsights.length} App Insights in ${response.data.queryTimeMs}ms`);
    } catch (err) {
      console.error('Error loading monitoring resources:', err);
      setAvailableWorkspaces([]);
      setAvailableAppInsights([]);
    } finally {
      setLoadingStep(null);
    }
  };

  // Save settings
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const selectedSubList = availableSubscriptions.filter(s => 
        selectedSubscriptions.has(s.subscriptionId)
      );
      
      const selectedWorkspaceList = availableWorkspaces.filter(w => 
        selectedWorkspaces.has(w.id)
      );
      
      const selectedAppInsightList = availableAppInsights.filter(a => 
        selectedAppInsights.has(a.id)
      );

      await api.put('/azure/settings', {
        selectedSubscriptions: selectedSubList.map(s => ({
          subscriptionId: s.subscriptionId,
          displayName: s.displayName,
          tenantId: s.tenantId,
          state: s.state
        })),
        selectedLogAnalyticsWorkspaces: selectedWorkspaceList.map(w => ({
          resourceId: w.id,
          name: w.name,
          subscriptionId: w.subscriptionId,
          resourceGroup: w.resourceGroup,
          location: w.location
        })),
        selectedAppInsights: selectedAppInsightList.map(a => ({
          resourceId: a.id,
          name: a.name,
          subscriptionId: a.subscriptionId,
          resourceGroup: a.resourceGroup,
          location: a.location
        })),
        defaultWorkspaceId: defaultWorkspace,
        defaultAppInsightsId: defaultAppInsight,
        isSetupCompleted: true
      });

      await loadCurrentSettings();
      setError(null);
    } catch (err) {
      setError('Failed to save settings');
      console.error('Error saving settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle selection helpers
  const toggleSubscription = (subId: string) => {
    const newSet = new Set(selectedSubscriptions);
    if (newSet.has(subId)) {
      newSet.delete(subId);
    } else {
      newSet.add(subId);
    }
    setSelectedSubscriptions(newSet);
  };

  const toggleWorkspace = (wsId: string) => {
    const newSet = new Set(selectedWorkspaces);
    if (newSet.has(wsId)) {
      newSet.delete(wsId);
      if (defaultWorkspace === wsId) setDefaultWorkspace(null);
    } else {
      newSet.add(wsId);
    }
    setSelectedWorkspaces(newSet);
  };

  const toggleAppInsight = (aiId: string) => {
    const newSet = new Set(selectedAppInsights);
    if (newSet.has(aiId)) {
      newSet.delete(aiId);
      if (defaultAppInsight === aiId) setDefaultAppInsight(null);
    } else {
      newSet.add(aiId);
    }
    setSelectedAppInsights(newSet);
  };

  const selectAllSubscriptions = () => {
    setSelectedSubscriptions(new Set(availableSubscriptions.map(s => s.subscriptionId)));
  };

  const clearAllSubscriptions = () => {
    setSelectedSubscriptions(new Set());
  };

  // Filter by search term
  const filterBySearch = <T extends { name?: string; displayName?: string }>(items: T[]) => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      (item.name?.toLowerCase().includes(term)) ||
      (item.displayName?.toLowerCase().includes(term))
    );
  };

  // Render intro step
  const renderIntro = () => (
    <div className="text-center space-y-6 py-8">
      <div className="w-20 h-20 mx-auto bg-blue-500/20 rounded-full flex items-center justify-center">
        <Cloud className="w-10 h-10 text-blue-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Azure Resource Setup</h2>
        <p className="text-gray-400 max-w-lg mx-auto">
          Configure which Azure subscriptions and resources your team will use. 
          This one-time setup will make resource selection fast by filtering to only your selected resources.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <Database className="w-8 h-8 text-purple-400 mx-auto mb-2" />
          <p className="text-sm text-gray-300">Log Analytics</p>
          <p className="text-xs text-gray-500">Query logs & traces</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <Activity className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-gray-300">App Insights</p>
          <p className="text-xs text-gray-500">Monitor applications</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <Server className="w-8 h-8 text-orange-400 mx-auto mb-2" />
          <p className="text-sm text-gray-300">Azure Metrics</p>
          <p className="text-xs text-gray-500">Resource metrics</p>
        </div>
      </div>
      <button
        onClick={handleNext}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
      >
        <Zap className="w-5 h-5" />
        Start Setup
      </button>
    </div>
  );

  // Render subscription selection
  const renderSubscriptions = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Select Subscriptions</h3>
          <p className="text-gray-400 text-sm">Choose which Azure subscriptions to include</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSubscriptions}
            disabled={loadingStep === 'subscriptions'}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', loadingStep === 'subscriptions' && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={selectAllSubscriptions}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          >
            Select All
          </button>
          <button
            onClick={clearAllSubscriptions}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {loadingStep === 'subscriptions' ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <span className="ml-3 text-gray-400">Loading subscriptions...</span>
        </div>
      ) : availableSubscriptions.length === 0 ? (
        <div className="p-8 bg-gray-800/30 rounded-lg border border-gray-700 text-center">
          <Cloud className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-300 font-medium mb-2">No Subscriptions Found</p>
          <p className="text-gray-500 text-sm mb-4">
            Please ensure you're logged into Azure CLI with: <code className="bg-gray-700 px-2 py-0.5 rounded">az login</code>
          </p>
          <button
            onClick={loadSubscriptions}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {availableSubscriptions.map(sub => (
            <div
              key={sub.subscriptionId}
              onClick={() => toggleSubscription(sub.subscriptionId)}
              className={clsx(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                selectedSubscriptions.has(sub.subscriptionId)
                  ? 'bg-blue-500/20 border-blue-500/50'
                  : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
              )}
            >
              <div className={clsx(
                'w-5 h-5 rounded border flex items-center justify-center transition-colors',
                selectedSubscriptions.has(sub.subscriptionId)
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-600'
              )}>
                {selectedSubscriptions.has(sub.subscriptionId) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{sub.displayName}</p>
                <p className="text-xs text-gray-500">{sub.subscriptionId}</p>
              </div>
              <span className={clsx(
                'text-xs px-2 py-0.5 rounded',
                sub.state === 'Enabled' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
              )}>
                {sub.state}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <span className="text-sm text-gray-400">
          {selectedSubscriptions.size} of {availableSubscriptions.length} selected
        </span>
        <button
          onClick={handleNext}
          disabled={selectedSubscriptions.size === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Render resource selection (workspaces + app insights)
  const renderResources = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search resources..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={async () => {
            await loadWorkspaces();
            await loadAppInsights();
          }}
          disabled={!!loadingStep}
          className="ml-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1"
        >
          <RefreshCw className={clsx('w-4 h-4', loadingStep && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Log Analytics Workspaces */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-400" />
          <h4 className="text-lg font-medium text-white">Log Analytics Workspaces</h4>
          <span className="text-sm text-gray-500">({availableWorkspaces.length})</span>
        </div>
        
        {loadingStep === 'syncing' ? (
          <div className="flex items-center py-4 bg-blue-500/10 rounded-lg px-4 border border-blue-500/30">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span className="ml-2 text-blue-300">Syncing Azure resources... This may take a moment.</span>
          </div>
        ) : loadingStep === 'workspaces' ? (
          <div className="flex items-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="ml-2 text-gray-400">Loading workspaces from selected subscriptions...</span>
          </div>
        ) : availableWorkspaces.length === 0 ? (
          <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700 text-center">
            <Database className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No Log Analytics workspaces found</p>
            <p className="text-gray-500 text-xs mt-1">in selected subscriptions</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {filterBySearch(availableWorkspaces).map(ws => (
              <div
                key={ws.id}
                onClick={() => toggleWorkspace(ws.id)}
                className={clsx(
                  'flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors',
                  selectedWorkspaces.has(ws.id)
                    ? 'bg-purple-500/20 border-purple-500/50'
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                )}
              >
                <div className={clsx(
                  'w-4 h-4 rounded border flex items-center justify-center',
                  selectedWorkspaces.has(ws.id)
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-gray-600'
                )}>
                  {selectedWorkspaces.has(ws.id) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{ws.name}</p>
                  <p className="text-xs text-gray-500 truncate">{ws.resourceGroup} • {ws.subscriptionName || ws.subscriptionId?.slice(0,8)}</p>
                </div>
                {defaultWorkspace === ws.id && (
                  <span className="text-xs bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded">Default</span>
                )}
              </div>
            ))}
          </div>
        )}
        
        {selectedWorkspaces.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Set default:</span>
            <select
              value={defaultWorkspace || ''}
              onChange={e => setDefaultWorkspace(e.target.value || null)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value="">None</option>
              {Array.from(selectedWorkspaces).map(wsId => {
                const ws = availableWorkspaces.find(w => w.id === wsId);
                return (
                  <option key={wsId} value={wsId}>{ws?.name}</option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Application Insights */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-400" />
          <h4 className="text-lg font-medium text-white">Application Insights</h4>
          <span className="text-sm text-gray-500">({availableAppInsights.length})</span>
        </div>
        
        {loadingStep === 'appinsights' ? (
          <div className="flex items-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-green-400" />
            <span className="ml-2 text-gray-400">Loading App Insights from selected subscriptions...</span>
          </div>
        ) : availableAppInsights.length === 0 ? (
          <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700 text-center">
            <Activity className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No Application Insights found</p>
            <p className="text-gray-500 text-xs mt-1">in selected subscriptions</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {filterBySearch(availableAppInsights).map(ai => (
              <div
                key={ai.id}
                onClick={() => toggleAppInsight(ai.id)}
                className={clsx(
                  'flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors',
                  selectedAppInsights.has(ai.id)
                    ? 'bg-green-500/20 border-green-500/50'
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                )}
              >
                <div className={clsx(
                  'w-4 h-4 rounded border flex items-center justify-center',
                  selectedAppInsights.has(ai.id)
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-600'
                )}>
                  {selectedAppInsights.has(ai.id) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{ai.name}</p>
                  <p className="text-xs text-gray-500 truncate">{ai.resourceGroup} • {ai.subscriptionName || ai.subscriptionId?.slice(0,8)}</p>
                </div>
                {defaultAppInsight === ai.id && (
                  <span className="text-xs bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded">Default</span>
                )}
              </div>
            ))}
          </div>
        )}
        
        {selectedAppInsights.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Set default:</span>
            <select
              value={defaultAppInsight || ''}
              onChange={e => setDefaultAppInsight(e.target.value || null)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
            >
              <option value="">None</option>
              {Array.from(selectedAppInsights).map(aiId => {
                const ai = availableAppInsights.find(a => a.id === aiId);
                return (
                  <option key={aiId} value={aiId}>{ai?.name}</option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <button
          onClick={() => setStep('subscriptions')}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
          Back
        </button>
        <button
          onClick={handleNext}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2"
        >
          Review Setup
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Render review step
  const renderReview = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Review Configuration</h3>
          <p className="text-gray-400 text-sm">
            {currentSettings?.isSetupCompleted 
              ? 'Your Azure resources are configured. You can update the selection anytime.'
              : 'Confirm your selection to complete the setup.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              await loadSubscriptions();
              await loadWorkspaces();
              await loadAppInsights();
            }}
            disabled={!!loadingStep}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', loadingStep && 'animate-spin')} />
            Refresh All
          </button>
          {currentSettings?.isSetupCompleted && (
            <span className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/30">
              <CheckCircle2 className="w-4 h-4" />
              Setup Complete
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {/* Subscriptions Summary */}
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="w-5 h-5 text-blue-400" />
            <span className="font-medium text-white">Subscriptions</span>
            <span className="ml-auto text-sm text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
              {selectedSubscriptions.size} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from(selectedSubscriptions).filter(Boolean).slice(0, 5).map(subId => {
              const sub = availableSubscriptions.find(s => s.subscriptionId === subId);
              return (
                <span key={subId} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                  {sub?.displayName || subId || 'Unknown'}
                </span>
              );
            })}
            {selectedSubscriptions.size > 5 && (
              <span className="text-xs text-gray-500">+{selectedSubscriptions.size - 5} more</span>
            )}
          </div>
        </div>

        {/* Workspaces Summary */}
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-purple-400" />
            <span className="font-medium text-white">Log Analytics Workspaces</span>
            <span className="ml-auto text-sm text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
              {selectedWorkspaces.size} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from(selectedWorkspaces).filter(Boolean).slice(0, 5).map(wsId => {
              const ws = availableWorkspaces.find(w => w.id === wsId);
              return (
                <span key={wsId} className={clsx(
                  'text-xs px-2 py-1 rounded',
                  defaultWorkspace === wsId 
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50' 
                    : 'bg-gray-700 text-gray-300'
                )}>
                  {ws?.name || (wsId ? wsId.split('/').pop() : 'Unknown')}
                  {defaultWorkspace === wsId && ' (Default)'}
                </span>
              );
            })}
          </div>
        </div>

        {/* App Insights Summary */}
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-green-400" />
            <span className="font-medium text-white">Application Insights</span>
            <span className="ml-auto text-sm text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
              {selectedAppInsights.size} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from(selectedAppInsights).filter(Boolean).slice(0, 5).map(aiId => {
              const ai = availableAppInsights.find(a => a.id === aiId);
              return (
                <span key={aiId} className={clsx(
                  'text-xs px-2 py-1 rounded',
                  defaultAppInsight === aiId 
                    ? 'bg-green-500/30 text-green-300 border border-green-500/50' 
                    : 'bg-gray-700 text-gray-300'
                )}>
                  {ai?.name || (aiId ? aiId.split('/').pop() : 'Unknown')}
                  {defaultAppInsight === aiId && ' (Default)'}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <button
          onClick={() => setStep('resources')}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
          Back to Resources
        </button>
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {currentSettings?.isSetupCompleted ? 'Update Setup' : 'Complete Setup'}
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
      {/* Progress indicator */}
      {step !== 'intro' && (
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-700">
          {['subscriptions', 'resources', 'review'].map((s, idx) => (
            <div key={s} className="flex items-center">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                step === s ? 'bg-blue-500 text-white' :
                ['subscriptions', 'resources', 'review'].indexOf(step) > idx 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-700 text-gray-400'
              )}>
                {['subscriptions', 'resources', 'review'].indexOf(step) > idx ? (
                  <Check className="w-4 h-4" />
                ) : (
                  idx + 1
                )}
              </div>
              {idx < 2 && (
                <div className={clsx(
                  'w-12 h-1 mx-2 rounded',
                  ['subscriptions', 'resources', 'review'].indexOf(step) > idx 
                    ? 'bg-green-500' 
                    : 'bg-gray-700'
                )} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 hover:text-red-300" />
          </button>
        </div>
      )}

      {/* Step content */}
      {step === 'intro' && renderIntro()}
      {step === 'subscriptions' && renderSubscriptions()}
      {step === 'resources' && renderResources()}
      {step === 'review' && renderReview()}
    </div>
  );
}

export default AzureResourceSetup;
