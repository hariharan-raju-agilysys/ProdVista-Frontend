import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Cloud, AlertCircle } from 'lucide-react';
import { SearchableSelect, MultiSearchableSelect } from '../SearchableSelect';
import { WidgetConfigProps } from './types';
import {
  getMetricResources,
  getMetricDefinitions,
  AzureSubscription,
  AzureMetricResource,
  AzureMetricDefinition,
} from '../../services/dynamicDashboardService';
import { getResourceGraphSubscriptions } from '../../services/api';

type AzureMetricsConfigProps = Pick<WidgetConfigProps, 'config' | 'setConfig'>;

// Common Azure resource types for filtering
const RESOURCE_TYPE_FILTERS = [
  { value: '', label: 'All Resources' },
  { value: 'Microsoft.Compute/virtualMachines', label: 'Virtual Machines' },
  { value: 'Microsoft.Web/sites', label: 'App Services' },
  { value: 'Microsoft.Sql/servers', label: 'SQL Servers' },
  { value: 'Microsoft.Storage/storageAccounts', label: 'Storage Accounts' },
  { value: 'Microsoft.ContainerService/managedClusters', label: 'AKS Clusters' },
  { value: 'Microsoft.Cache/Redis', label: 'Redis Cache' },
  { value: 'Microsoft.ServiceBus/namespaces', label: 'Service Bus' },
  { value: 'Microsoft.EventHub/namespaces', label: 'Event Hubs' },
  { value: 'Microsoft.DocumentDB/databaseAccounts', label: 'Cosmos DB' },
  { value: 'Microsoft.KeyVault/vaults', label: 'Key Vault' },
  { value: 'Microsoft.Network/loadBalancers', label: 'Load Balancers' },
  { value: 'Microsoft.Network/applicationGateways', label: 'Application Gateways' },
];

export function AzureMetricsConfig({ config, setConfig }: AzureMetricsConfigProps) {
  // Azure discovery state
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [resources, setResources] = useState<AzureMetricResource[]>([]);
  const [metricDefs, setMetricDefs] = useState<AzureMetricDefinition[]>([]);
  
  // Loading states
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selection state
  const [selectedSubscription, setSelectedSubscription] = useState<string>((config.subscriptionId as string) || '');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('');

  const updateConfig = (key: string, value: unknown) => {
    setConfig({ ...config, [key]: value });
  };

  // Load subscriptions on mount
  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Load resources when subscription changes
  useEffect(() => {
    if (selectedSubscription) {
      loadResources(selectedSubscription, resourceTypeFilter);
    }
  }, [selectedSubscription, resourceTypeFilter]);

  const loadSubscriptions = async () => {
    setLoadingSubscriptions(true);
    setError(null);
    try {
      // Use Resource Graph for fast subscription discovery
      const { data } = await getResourceGraphSubscriptions();
      const subs = (data.subscriptions || []).map((s: any) => ({
        id: s.subscriptionId,
        name: s.name || s.displayName,
        state: s.state || 'Enabled'
      }));
      setSubscriptions(subs);
      
      // Auto-select subscription if there's a saved one or only one available
      if (config.subscriptionId) {
        setSelectedSubscription(config.subscriptionId as string);
      } else if (subs.length === 1) {
        setSelectedSubscription(subs[0].id);
        updateConfig('subscriptionId', subs[0].id);
      }
      console.log(`Loaded ${subs.length} subscriptions via Resource Graph in ${data.queryTimeMs}ms`);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      setError('Failed to load Azure subscriptions. Please check your Azure connection in Settings.');
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const loadResources = async (subscriptionId: string, resourceType?: string) => {
    setLoadingResources(true);
    try {
      const response = await getMetricResources(subscriptionId, resourceType || undefined);
      setResources(response.data);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoadingResources(false);
    }
  };

  const loadMetricDefinitions = async (resourceId: string) => {
    setLoadingMetrics(true);
    try {
      const response = await getMetricDefinitions(resourceId);
      setMetricDefs(response.data);
      
      // Auto-select first metric if none selected
      if (!config.metricName && response.data.length > 0) {
        updateConfig('metricName', response.data[0].name);
        updateConfig('metricNamespace', response.data[0].unit);
      }
    } catch (err) {
      console.error('Failed to load metric definitions:', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleSubscriptionChange = (subscriptionId: string) => {
    setSelectedSubscription(subscriptionId);
    updateConfig('subscriptionId', subscriptionId);
    // Clear resource selection when subscription changes
    updateConfig('resourceIds', []);
    updateConfig('resourceId', '');
    updateConfig('metricName', '');
    setMetricDefs([]);
  };

  const handleResourcesChange = (resourceIds: string[]) => {
    updateConfig('resourceIds', resourceIds);
    // Also set single resourceId for backward compatibility (use first selected)
    if (resourceIds.length > 0) {
      updateConfig('resourceId', resourceIds[0]);
      const resource = resources.find(r => r.id === resourceIds[0]);
      if (resource) {
        updateConfig('resourceName', resource.name);
        updateConfig('resourceType', resource.type);
      }
    } else {
      updateConfig('resourceId', '');
      updateConfig('resourceName', '');
      updateConfig('resourceType', '');
    }
    // Clear metric selection when resources change
    updateConfig('metricName', '');
    setMetricDefs([]);
  };

  // Load metrics when first resource is selected
  useEffect(() => {
    const resourceIds = config.resourceIds as string[] || [];
    if (resourceIds.length > 0) {
      loadMetricDefinitions(resourceIds[0]);
    }
  }, [config.resourceIds]);

  const handleMetricChange = (metricName: string) => {
    updateConfig('metricName', metricName);
    // Find the metric to get its details
    const metric = metricDefs.find(m => m.name === metricName);
    if (metric) {
      updateConfig('metricDisplayName', metric.displayName);
      updateConfig('metricUnit', metric.unit);
      // Set default aggregation if available
      if (metric.aggregations.length > 0 && !config.aggregation) {
        updateConfig('aggregation', metric.aggregations[0]);
      }
    }
  };

  // Get currently selected metric for showing available aggregations
  const selectedMetric = metricDefs.find(m => m.name === config.metricName);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Cloud className="w-5 h-5 text-blue-500" />
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Azure Metrics Configuration
        </h4>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Subscription Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Azure Subscription *
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchableSelect
              options={subscriptions.map(sub => ({
                value: sub.id,
                label: sub.name,
                description: sub.id.slice(0, 36) + '...',
              }))}
              value={selectedSubscription}
              onChange={handleSubscriptionChange}
              placeholder={loadingSubscriptions ? 'Loading subscriptions...' : 'Select subscription'}
              disabled={loadingSubscriptions}
            />
          </div>
          <button
            onClick={loadSubscriptions}
            disabled={loadingSubscriptions}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Refresh subscriptions"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSubscriptions ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Resource Type Filter */}
      {selectedSubscription ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Resource Type Filter
          </label>
          <select
            value={resourceTypeFilter}
            onChange={(e) => setResourceTypeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            {RESOURCE_TYPE_FILTERS.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Resource Selection - Multi-select */}
      {selectedSubscription ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Azure Resources * <span className="text-xs text-gray-500 font-normal">(select one or more)</span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              {loadingResources ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-500">Loading resources...</span>
                </div>
              ) : (
                <MultiSearchableSelect
                  options={resources.map(res => ({
                    value: res.id,
                    label: res.name,
                    description: `${res.type} • ${res.resourceGroup}`,
                  }))}
                  values={(config.resourceIds as string[]) || []}
                  onChange={handleResourcesChange}
                  placeholder="Select resources..."
                  searchPlaceholder="Search by name, type, or resource group..."
                />
              )}
            </div>
            <button
              onClick={() => loadResources(selectedSubscription, resourceTypeFilter)}
              disabled={loadingResources}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh resources"
            >
              <RefreshCw className={`w-4 h-4 ${loadingResources ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {resources.length === 0 && !loadingResources && selectedSubscription && (
            <p className="text-xs text-gray-500 mt-1">
              No resources found. Try changing the resource type filter.
            </p>
          )}
        </div>
      ) : null}

      {/* Metric Selection */}
      {((config.resourceIds as string[])?.length > 0) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Metric *
          </label>
          {loadingMetrics ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm text-gray-500">Loading available metrics...</span>
            </div>
          ) : (
            <SearchableSelect
              options={metricDefs.map(metric => ({
                value: metric.name,
                label: metric.displayName,
                description: `Unit: ${metric.unit} • Aggregations: ${metric.aggregations.join(', ')}`,
              }))}
              value={(config.metricName as string) || ''}
              onChange={handleMetricChange}
              placeholder="Select metric"
            />
          )}
        </div>
      )}

      {/* Aggregation and Time Settings */}
      {Boolean(config.metricName) && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Aggregation
            </label>
            <select
              value={(config.aggregation as string) || 'Average'}
              onChange={(e) => updateConfig('aggregation', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            >
              {selectedMetric?.aggregations.map(agg => (
                <option key={agg} value={agg}>{agg}</option>
              )) || (
                <>
                  <option value="Average">Average</option>
                  <option value="Total">Total</option>
                  <option value="Maximum">Maximum</option>
                  <option value="Minimum">Minimum</option>
                  <option value="Count">Count</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Range
            </label>
            <select
              value={(config.timespan as string) || 'PT1H'}
              onChange={(e) => updateConfig('timespan', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            >
              <option value="PT5M">Last 5 minutes</option>
              <option value="PT15M">Last 15 minutes</option>
              <option value="PT30M">Last 30 minutes</option>
              <option value="PT1H">Last 1 hour</option>
              <option value="PT6H">Last 6 hours</option>
              <option value="PT12H">Last 12 hours</option>
              <option value="PT24H">Last 24 hours</option>
              <option value="P7D">Last 7 days</option>
              <option value="P30D">Last 30 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Granularity
            </label>
            <select
              value={(config.interval as string) || 'PT5M'}
              onChange={(e) => updateConfig('interval', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            >
              <option value="PT1M">1 minute</option>
              <option value="PT5M">5 minutes</option>
              <option value="PT15M">15 minutes</option>
              <option value="PT30M">30 minutes</option>
              <option value="PT1H">1 hour</option>
              <option value="P1D">1 day</option>
            </select>
          </div>
        </div>
      )}

      {/* Display Settings - only show when metric is selected */}
      {Boolean(config.metricName) && (
        <>
          <div className="border-t pt-4">
            <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase">
              Display Options
            </h5>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Type
                </label>
                <select
                  value={(config.displayType as string) || 'chart'}
                  onChange={(e) => updateConfig('displayType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                >
                  <option value="chart">Line Chart</option>
                  <option value="area">Area Chart</option>
                  <option value="metric">Single Metric</option>
                  <option value="gauge">Gauge</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Display
                </label>
                <select
                  value={(config.unitDisplay as string) || 'auto'}
                  onChange={(e) => updateConfig('unitDisplay', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="percent">Percentage (%)</option>
                  <option value="bytes">Bytes (KB/MB/GB)</option>
                  <option value="count">Count</option>
                  <option value="ms">Milliseconds</option>
                  <option value="seconds">Seconds</option>
                </select>
              </div>
            </div>
          </div>

          {/* Thresholds */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={(config.showThresholds as boolean) || false}
                onChange={(e) => updateConfig('showThresholds', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Show threshold lines on chart</span>
            </label>
            
            {(config.showThresholds as boolean) && (
              <div className="grid grid-cols-2 gap-4 ml-6">
                <div>
                  <label className="block text-sm font-medium text-yellow-600 mb-1">Warning</label>
                  <input
                    type="number"
                    value={(config.warningThreshold as number) || 70}
                    onChange={(e) => updateConfig('warningThreshold', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-yellow-300 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-600 mb-1">Critical</label>
                  <input
                    type="number"
                    value={(config.criticalThreshold as number) || 90}
                    onChange={(e) => updateConfig('criticalThreshold', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Selected Summary */}
      {Boolean(config.resourceId) && Boolean(config.metricName) && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <p className="text-xs text-green-700 dark:text-green-300">
            <strong>Selected:</strong> {String(config.resourceName || 'Resource')} → {String(config.metricDisplayName || config.metricName)}
            <br />
            <span className="text-green-600 dark:text-green-400">
              Aggregation: {String(config.aggregation || 'Average')} • Range: {String(config.timespan || 'PT1H')}
            </span>
          </p>
        </div>
      )}

      {/* Azure Info */}
      {!selectedSubscription && !loadingSubscriptions && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Note:</strong> Azure Metrics requires Azure authentication. 
            Please ensure Azure is connected in <a href="/settings" className="underline">Settings → Azure Connections</a>.
          </p>
        </div>
      )}
    </div>
  );
}
