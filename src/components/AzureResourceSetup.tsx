import { useState, useEffect, useMemo } from 'react';
import {
  Cloud, Check, CheckCircle2, AlertTriangle, Loader2,
  ChevronRight, Search, RefreshCw, Building2,
  Database, Activity, Save, X, Shield, ArrowRight
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

interface TenantGroup {
  tenantId: string;
  subscriptions: Subscription[];
}

export function AzureResourceSetup() {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'intro' | 'subscriptions' | 'resources' | 'review'>('intro');

  const [availableSubscriptions, setAvailableSubscriptions] = useState<Subscription[]>([]);
  const [availableWorkspaces, setAvailableWorkspaces] = useState<AzureResource[]>([]);
  const [availableAppInsights, setAvailableAppInsights] = useState<AzureResource[]>([]);

  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(new Set());
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(new Set());
  const [selectedAppInsights, setSelectedAppInsights] = useState<Set<string>>(new Set());

  const [defaultWorkspace, setDefaultWorkspace] = useState<string | null>(null);
  const [defaultAppInsight, setDefaultAppInsight] = useState<string | null>(null);

  const [currentSettings, setCurrentSettings] = useState<TenantAzureSettings | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());

  const DRAFT_STORAGE_KEY = 'azure-setup-draft';

  // Group subscriptions by Azure AD tenant
  const tenantGroups = useMemo<TenantGroup[]>(() => {
    const map = new Map<string, Subscription[]>();
    for (const sub of availableSubscriptions) {
      const tid = sub.tenantId || 'unknown';
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(sub);
    }
    return Array.from(map.entries())
      .map(([tenantId, subscriptions]) => ({ tenantId, subscriptions }))
      .sort((a, b) => b.subscriptions.length - a.subscriptions.length);
  }, [availableSubscriptions]);

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
      const subs = response.data.subscriptions || [];
      setAvailableSubscriptions(subs);
      if (subs.length === 0) {
        setError('No subscriptions found. The Azure credential may not have Reader access on any subscriptions. Check App Registration RBAC assignments or sign in with Azure SSO.');
      } else {
        setError(null);
      }
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
  const selectAllSubscriptions = () => {
    setSelectedSubscriptions(new Set(availableSubscriptions.map(s => s.subscriptionId)));
  };

  const clearAllSubscriptions = () => {
    setSelectedSubscriptions(new Set());
  };

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

  // Toggle a whole tenant group
  const toggleTenantGroup = (group: TenantGroup) => {
    const groupSubIds = group.subscriptions.map(s => s.subscriptionId);
    const allSelected = groupSubIds.every(id => selectedSubscriptions.has(id));
    const newSet = new Set(selectedSubscriptions);
    if (allSelected) {
      groupSubIds.forEach(id => newSet.delete(id));
    } else {
      groupSubIds.forEach(id => newSet.add(id));
    }
    setSelectedSubscriptions(newSet);
  };

  const toggleExpandTenant = (tenantId: string) => {
    const newSet = new Set(expandedTenants);
    if (newSet.has(tenantId)) newSet.delete(tenantId);
    else newSet.add(tenantId);
    setExpandedTenants(newSet);
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

  const steps = ['subscriptions', 'resources', 'review'] as const;
  const stepLabels = { subscriptions: 'Subscriptions', resources: 'Resources', review: 'Review' };
  const currentStepIdx = steps.indexOf(step as typeof steps[number]);

  // â”€â”€ Intro â”€â”€
  const renderIntro = () => (
    <div className="text-center space-y-8 py-10">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
        <Cloud className="w-8 h-8 text-white" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Azure Resource Setup</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm leading-relaxed">
          Select the subscriptions and monitoring resources your organization uses. 
          This enables fast, scoped filtering across the entire application.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
        {[
          { icon: Shield, label: 'Subscriptions', desc: 'Scope by org', color: 'text-blue-500' },
          { icon: Database, label: 'Log Analytics', desc: 'Query logs', color: 'text-purple-500' },
          { icon: Activity, label: 'App Insights', desc: 'Telemetry', color: 'text-green-500' },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            <Icon className={clsx('w-6 h-6 mx-auto mb-2', color)} />
            <p className="text-xs font-semibold text-gray-900 dark:text-white">{label}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={async () => {
          setStep('subscriptions');
          if (availableSubscriptions.length === 0) await loadSubscriptions();
        }}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
      >
        {currentSettings?.isSetupCompleted ? 'Modify Setup' : 'Start Setup'}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );

  // â”€â”€ Subscriptions grouped by Azure AD Tenant â”€â”€
  const renderSubscriptions = () => {
    const filteredGroups = tenantGroups.map(g => ({
      ...g,
      subscriptions: filterBySearch(g.subscriptions),
    })).filter(g => g.subscriptions.length > 0);

    return (
      <div className="space-y-5">
        {/* Header bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search subscriptions..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => { selectAllSubscriptions(); }}
            className="px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
          >
            Select All
          </button>
          <button
            onClick={() => { clearAllSubscriptions(); }}
            className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Clear
          </button>
          <button
            onClick={loadSubscriptions}
            disabled={!!loadingStep}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', loadingStep === 'subscriptions' && 'animate-spin')} />
          </button>
        </div>

        {/* Loading */}
        {loadingStep === 'subscriptions' ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading subscriptions from Azure...</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <Cloud className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No subscriptions found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Make sure you're signed in to Azure</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {filteredGroups.map(group => {
              const groupSubIds = group.subscriptions.map(s => s.subscriptionId);
              const selectedCount = groupSubIds.filter(id => selectedSubscriptions.has(id)).length;
              const allSelected = selectedCount === group.subscriptions.length;
              const someSelected = selectedCount > 0 && !allSelected;
              const isExpanded = expandedTenants.has(group.tenantId);

              return (
                <div key={group.tenantId} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Tenant header */}
                  <div
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors',
                      'bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800'
                    )}
                    onClick={() => toggleExpandTenant(group.tenantId)}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); toggleTenantGroup(group); }}
                      className={clsx(
                        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        allSelected ? 'bg-blue-600 border-blue-600' :
                        someSelected ? 'bg-blue-600/40 border-blue-600' :
                        'border-gray-300 dark:border-gray-600'
                      )}
                    >
                      {(allSelected || someSelected) && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Tenant {group.tenantId.slice(0, 8)}...
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {group.subscriptions.length} subscription{group.subscriptions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {selectedCount > 0 && (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">
                        {selectedCount} selected
                      </span>
                    )}
                    <ChevronRight className={clsx(
                      'w-4 h-4 text-gray-400 transition-transform',
                      isExpanded && 'rotate-90'
                    )} />
                  </div>

                  {/* Subscription items */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {group.subscriptions.map(sub => (
                        <div
                          key={sub.subscriptionId}
                          onClick={() => toggleSubscription(sub.subscriptionId)}
                          className={clsx(
                            'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                            selectedSubscriptions.has(sub.subscriptionId)
                              ? 'bg-blue-50/50 dark:bg-blue-500/5'
                              : 'bg-white dark:bg-gray-900/40 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          )}
                        >
                          <div className="pl-5">
                            <div className={clsx(
                              'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                              selectedSubscriptions.has(sub.subscriptionId)
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-gray-300 dark:border-gray-600'
                            )}>
                              {selectedSubscriptions.has(sub.subscriptionId) && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {sub.displayName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                              {sub.subscriptionId}
                            </p>
                          </div>
                          <span className={clsx(
                            'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full',
                            sub.state === 'Enabled'
                              ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-500/10'
                              : 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10'
                          )}>
                            {sub.state}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setStep('intro')}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Back
          </button>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {selectedSubscriptions.size} of {availableSubscriptions.length} selected
            </span>
            <button
              onClick={handleNext}
              disabled={selectedSubscriptions.size === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // â”€â”€ Resources (Workspaces + App Insights) â”€â”€
  const renderResources = () => (
    <div className="space-y-6">
      {/* Search + refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={async () => { await loadWorkspaces(); await loadAppInsights(); }}
          disabled={!!loadingStep}
          className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-4 h-4', loadingStep && 'animate-spin')} />
        </button>
      </div>

      {/* Log Analytics Workspaces */}
      <ResourceSection
        icon={Database}
        iconColor="text-purple-500"
        title="Log Analytics Workspaces"
        count={availableWorkspaces.length}
        loading={loadingStep === 'workspaces' || loadingStep === 'syncing'}
        loadingLabel={loadingStep === 'syncing' ? 'Syncing Azure resources...' : 'Loading workspaces...'}
        emptyLabel="No Log Analytics workspaces found"
        items={filterBySearch(availableWorkspaces)}
        selectedIds={selectedWorkspaces}
        onToggle={toggleWorkspace}
        accentClass="purple"
        defaultId={defaultWorkspace}
        onDefaultChange={setDefaultWorkspace}
      />

      {/* Application Insights */}
      <ResourceSection
        icon={Activity}
        iconColor="text-green-500"
        title="Application Insights"
        count={availableAppInsights.length}
        loading={loadingStep === 'appinsights'}
        loadingLabel="Loading App Insights..."
        emptyLabel="No Application Insights found"
        items={filterBySearch(availableAppInsights)}
        selectedIds={selectedAppInsights}
        onToggle={toggleAppInsight}
        accentClass="green"
        defaultId={defaultAppInsight}
        onDefaultChange={setDefaultAppInsight}
      />

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setStep('subscriptions')}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors inline-flex items-center gap-2"
        >
          Review Setup
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // â”€â”€ Review â”€â”€
  const renderReview = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Review Configuration</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentSettings?.isSetupCompleted
              ? 'Your Azure resources are configured. Update anytime.'
              : 'Confirm your selections to complete setup.'}
          </p>
        </div>
        {currentSettings?.isSetupCompleted && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Setup Complete
          </span>
        )}
      </div>

      <div className="grid gap-3">
        <SummaryCard
          icon={Cloud}
          iconColor="text-blue-500"
          bgColor="bg-blue-50 dark:bg-blue-500/10"
          title="Subscriptions"
          count={selectedSubscriptions.size}
          items={Array.from(selectedSubscriptions).filter(Boolean).slice(0, 5).map(subId => {
            const sub = availableSubscriptions.find(s => s.subscriptionId === subId);
            return sub?.displayName || subId || 'Unknown';
          })}
          total={selectedSubscriptions.size}
        />
        <SummaryCard
          icon={Database}
          iconColor="text-purple-500"
          bgColor="bg-purple-50 dark:bg-purple-500/10"
          title="Log Analytics Workspaces"
          count={selectedWorkspaces.size}
          items={Array.from(selectedWorkspaces).filter(Boolean).slice(0, 5).map(wsId => {
            const ws = availableWorkspaces.find(w => w.id === wsId);
            const name = ws?.name || (wsId ? wsId.split('/').pop() : 'Unknown');
            return defaultWorkspace === wsId ? `${name} (Default)` : name || 'Unknown';
          })}
          total={selectedWorkspaces.size}
        />
        <SummaryCard
          icon={Activity}
          iconColor="text-green-500"
          bgColor="bg-green-50 dark:bg-green-500/10"
          title="Application Insights"
          count={selectedAppInsights.size}
          items={Array.from(selectedAppInsights).filter(Boolean).slice(0, 5).map(aiId => {
            const ai = availableAppInsights.find(a => a.id === aiId);
            const name = ai?.name || (aiId ? aiId.split('/').pop() : 'Unknown');
            return defaultAppInsight === aiId ? `${name} (Default)` : name || 'Unknown';
          })}
          total={selectedAppInsights.size}
        />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setStep('resources')}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2 shadow-sm"
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4" /> {currentSettings?.isSetupCompleted ? 'Update Setup' : 'Complete Setup'}</>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Step progress */}
      {step !== 'intro' && (
        <div className="flex items-center gap-1 mb-6 pb-5 border-b border-gray-200 dark:border-gray-700">
          {steps.map((s, idx) => (
            <div key={s} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                  step === s ? 'bg-blue-600 text-white' :
                  currentStepIdx > idx ? 'bg-green-500 text-white' :
                  'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                )}>
                  {currentStepIdx > idx ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <span className={clsx(
                  'text-xs font-medium hidden sm:inline',
                  step === s ? 'text-blue-600 dark:text-blue-400' :
                  currentStepIdx > idx ? 'text-green-600 dark:text-green-400' :
                  'text-gray-400 dark:text-gray-500'
                )}>
                  {stepLabels[s]}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={clsx(
                  'w-10 h-0.5 mx-3 rounded-full',
                  currentStepIdx > idx ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                )} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-700 dark:hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'intro' && renderIntro()}
      {step === 'subscriptions' && renderSubscriptions()}
      {step === 'resources' && renderResources()}
      {step === 'review' && renderReview()}
    </div>
  );
}

// â”€â”€ Reusable sub-components â”€â”€

function ResourceSection({
  icon: Icon, iconColor, title, count, loading, loadingLabel, emptyLabel,
  items, selectedIds, onToggle, accentClass, defaultId, onDefaultChange,
}: {
  icon: React.ElementType; iconColor: string; title: string; count: number;
  loading: boolean; loadingLabel: string; emptyLabel: string;
  items: AzureResource[]; selectedIds: Set<string>;
  onToggle: (id: string) => void; accentClass: 'purple' | 'green';
  defaultId: string | null; onDefaultChange: (id: string | null) => void;
}) {
  const accent = {
    purple: { selected: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30', check: 'bg-purple-600 border-purple-600', badge: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300' },
    green: { selected: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30', check: 'bg-green-600 border-green-600', badge: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300' },
  }[accentClass];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={clsx('w-5 h-5', iconColor)} />
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
        <span className="text-xs text-gray-400">({count})</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 justify-center text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{loadingLabel}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">{emptyLabel}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => onToggle(item.id)}
                className={clsx(
                  'flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors',
                  selectedIds.has(item.id) ? accent.selected : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
              >
                <div className={clsx(
                  'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  selectedIds.has(item.id) ? accent.check : 'border-gray-300 dark:border-gray-600'
                )}>
                  {selectedIds.has(item.id) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {item.resourceGroup} Â· {item.subscriptionName || item.subscriptionId?.slice(0, 8)}
                  </p>
                </div>
                {defaultId === item.id && (
                  <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', accent.badge)}>
                    Default
                  </span>
                )}
              </div>
            ))}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Default:</span>
              <select
                value={defaultId || ''}
                onChange={e => onDefaultChange(e.target.value || null)}
                className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="">None</option>
                {Array.from(selectedIds).map(id => {
                  const item = items.find(i => i.id === id);
                  return <option key={id} value={id}>{item?.name}</option>;
                })}
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon, iconColor, bgColor, title, count, items, total,
}: {
  icon: React.ElementType; iconColor: string; bgColor: string;
  title: string; count: number; items: string[]; total: number;
}) {
  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40">
      <div className="flex items-center gap-2 mb-2">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', bgColor)}>
          <Icon className={clsx('w-4 h-4', iconColor)} />
        </div>
        <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{title}</span>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((name, i) => (
            <span key={i} className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/60 px-2 py-0.5 rounded">
              {name}
            </span>
          ))}
          {total > 5 && <span className="text-xs text-gray-400">+{total - 5} more</span>}
        </div>
      ) : (
        <p className="text-xs text-gray-400">None selected</p>
      )}
    </div>
  );
}

export default AzureResourceSetup;

