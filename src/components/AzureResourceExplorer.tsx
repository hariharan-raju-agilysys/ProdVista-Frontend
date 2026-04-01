import { useState, useEffect, useMemo } from 'react';
import { 
  Server, Database, Globe, Box, HardDrive, Cloud, Key, 
  Activity, Search, GripVertical,
  Layers, Cpu, Network, Shield, Zap, BarChart3, X, Plus,
  Grid3X3, List, Loader2
} from 'lucide-react';
import clsx from 'clsx';
import { SearchableSelect } from './SearchableSelect';
import {
  getResourceGraphSubscriptions,
  getResourceGraphByType,
} from '../services/api';
import {
  AzureSubscription,
  AzureMetricResource,
} from '../services/dynamicDashboardService';

// Resource type icons and colors
const RESOURCE_TYPE_CONFIG: Record<string, { icon: typeof Server; color: string; bgColor: string }> = {
  'Microsoft.Web/sites': { icon: Globe, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  'Microsoft.Compute/virtualMachines': { icon: Server, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  'Microsoft.Sql/servers': { icon: Database, color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  'Microsoft.Sql/servers/databases': { icon: Database, color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  'Microsoft.Storage/storageAccounts': { icon: HardDrive, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  'Microsoft.ContainerService/managedClusters': { icon: Box, color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
  'Microsoft.App/containerApps': { icon: Box, color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
  'Microsoft.KeyVault/vaults': { icon: Key, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  'Microsoft.ServiceBus/namespaces': { icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  'Microsoft.EventHub/namespaces': { icon: Activity, color: 'text-pink-600', bgColor: 'bg-pink-100 dark:bg-pink-900/30' },
  'Microsoft.Cache/Redis': { icon: Cpu, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  'microsoft.insights/components': { icon: BarChart3, color: 'text-teal-600', bgColor: 'bg-teal-100 dark:bg-teal-900/30' },
  'Microsoft.Network/loadBalancers': { icon: Network, color: 'text-violet-600', bgColor: 'bg-violet-100 dark:bg-violet-900/30' },
  'Microsoft.Network/applicationGateways': { icon: Shield, color: 'text-rose-600', bgColor: 'bg-rose-100 dark:bg-rose-900/30' },
};

const getResourceConfig = (type: string) => {
  return RESOURCE_TYPE_CONFIG[type] || { icon: Cloud, color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-700' };
};

interface SelectedResource extends AzureMetricResource {
  widgetType?: string;
}

interface AzureResourceExplorerProps {
  onResourceSelect?: (resources: SelectedResource[]) => void;
  onCreateWidget?: (resource: AzureMetricResource, widgetType: string) => void;
  selectedResources?: SelectedResource[];
  mode?: 'explorer' | 'picker';
}

export function AzureResourceExplorer({ 
  onResourceSelect, 
  onCreateWidget,
  selectedResources: externalSelected,
  mode = 'explorer'
}: AzureResourceExplorerProps) {
  // State
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<string>('');
  const [resources, setResources] = useState<AzureMetricResource[]>([]);
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>(externalSelected || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'graph' | 'list'>('grid');
  
  // Loading states
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  
  // Drag state
  const [draggedResource, setDraggedResource] = useState<AzureMetricResource | null>(null);

  // Load subscriptions on mount
  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Load resources when subscription changes
  useEffect(() => {
    if (selectedSubscription) {
      loadResources(selectedSubscription);
    }
  }, [selectedSubscription]);

  // Sync external selected resources
  useEffect(() => {
    if (externalSelected) {
      setSelectedResources(externalSelected);
    }
  }, [externalSelected]);

  const loadSubscriptions = async () => {
    setLoadingSubscriptions(true);
    try {
      // Use Resource Graph for fast subscription discovery
      const { data } = await getResourceGraphSubscriptions();
      const subs = (data.subscriptions || []).map((s: any) => ({
        id: s.subscriptionId,
        name: s.name || s.displayName,
        state: s.state || 'Enabled'
      }));
      setSubscriptions(subs);
      if (subs.length === 1) {
        setSelectedSubscription(subs[0].id);
      }
      console.log(`Loaded ${subs.length} subscriptions via Resource Graph in ${data.queryTimeMs}ms`);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const loadResources = async (subscriptionId: string) => {
    setLoadingResources(true);
    try {
      // Use Resource Graph for fast resource discovery - get common metric resources
      const resourceTypes = [
        'microsoft.web/sites',
        'microsoft.compute/virtualmachines',
        'microsoft.sql/servers',
        'microsoft.storage/storageaccounts',
        'microsoft.containerservice/managedclusters',
        'microsoft.insights/components',
        'microsoft.keyvault/vaults'
      ];
      
      // Fetch all resource types in parallel using Resource Graph
      const results = await Promise.all(
        resourceTypes.map(type => 
          getResourceGraphByType(type, [subscriptionId], 100)
            .then(res => res.data.resources || [])
            .catch(() => [])
        )
      );
      
      // Flatten and map resources
      const allResources = results.flat().map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        resourceGroup: r.resourceGroup,
        location: r.location,
        subscriptionId: r.subscriptionId
      }));
      
      setResources(allResources);
      console.log(`Loaded ${allResources.length} metric resources via Resource Graph`);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoadingResources(false);
    }
  };

  // Filter resources
  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      const matchesSearch = !searchQuery || 
        resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.resourceGroup.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = !typeFilter || resource.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [resources, searchQuery, typeFilter]);

  // Group resources by type for graph view
  const groupedResources = useMemo(() => {
    const groups: Record<string, AzureMetricResource[]> = {};
    filteredResources.forEach(resource => {
      const type = resource.type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(resource);
    });
    return groups;
  }, [filteredResources]);

  // Get unique resource types
  const resourceTypes = useMemo(() => {
    const types = new Set(resources.map(r => r.type));
    return Array.from(types).sort();
  }, [resources]);

  // Handle resource selection
  const toggleResourceSelection = (resource: AzureMetricResource) => {
    setSelectedResources(prev => {
      const isSelected = prev.some(r => r.id === resource.id);
      const newSelection = isSelected 
        ? prev.filter(r => r.id !== resource.id)
        : [...prev, resource];
      onResourceSelect?.(newSelection);
      return newSelection;
    });
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, resource: AzureMetricResource) => {
    setDraggedResource(resource);
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'azure-resource',
      resource
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedResource(null);
  };

  // Render resource card
  const ResourceCard = ({ resource, size = 'normal' }: { resource: AzureMetricResource; size?: 'small' | 'normal' | 'large' }) => {
    const config = getResourceConfig(resource.type);
    const Icon = config.icon;
    const isSelected = selectedResources.some(r => r.id === resource.id);
    const isDragging = draggedResource?.id === resource.id;

    const sizeClasses = {
      small: 'p-2',
      normal: 'p-3',
      large: 'p-4'
    };

    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, resource)}
        onDragEnd={handleDragEnd}
        onClick={() => toggleResourceSelection(resource)}
        className={clsx(
          'relative rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all',
          sizeClasses[size],
          isSelected 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/30' 
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600',
          isDragging && 'opacity-50 scale-95',
          config.bgColor
        )}
      >
        {/* Drag handle */}
        <div className="absolute top-1 right-1 opacity-50">
          <GripVertical className="w-3 h-3" />
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">✓</span>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className={clsx('p-2 rounded-lg', config.bgColor)}>
            <Icon className={clsx('w-5 h-5', config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {resource.name}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {resource.resourceGroup}
            </p>
            {size !== 'small' && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                {resource.type.split('/').pop()}
              </p>
            )}
          </div>
        </div>

        {/* Quick action buttons */}
        {size !== 'small' && (
          <div className="mt-2 flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateWidget?.(resource, 'metric-card');
              }}
              className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              + Metric
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateWidget?.(resource, 'line-chart');
              }}
              className="flex-1 px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              + Chart
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render type group for graph view
  const TypeGroup = ({ type, resources: typeResources }: { type: string; resources: AzureMetricResource[] }) => {
    const config = getResourceConfig(type);
    const Icon = config.icon;
    const typeName = type.split('/').pop() || type;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className={clsx('px-4 py-3 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700', config.bgColor)}>
          <Icon className={clsx('w-5 h-5', config.color)} />
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{typeName}</h3>
            <p className="text-xs text-gray-500">{typeResources.length} resource{typeResources.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {typeResources.map(resource => (
            <ResourceCard key={resource.id} resource={resource} size="small" />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Azure Resource Explorer
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                'p-2 rounded-lg',
                viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={clsx(
                'p-2 rounded-lg',
                viewMode === 'graph' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
              title="Graph view"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                'p-2 rounded-lg',
                viewMode === 'list' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subscription & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Subscription */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Subscription
            </label>
            <SearchableSelect
              options={subscriptions.map(sub => ({
                value: sub.id,
                label: sub.name,
                description: sub.id.slice(0, 36) + '...',
              }))}
              value={selectedSubscription}
              onChange={setSelectedSubscription}
              placeholder={loadingSubscriptions ? 'Loading...' : 'Select subscription'}
              loading={loadingSubscriptions}
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Resource Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            >
              <option value="">All Types ({resources.length})</option>
              {resourceTypes.map(type => (
                <option key={type} value={type}>
                  {type.split('/').pop()} ({resources.filter(r => r.type === type).length})
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resources..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Selected Resources Bar */}
      {selectedResources.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {selectedResources.length} selected
              </span>
              <div className="flex gap-1 flex-wrap">
                {selectedResources.slice(0, 5).map(r => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded text-xs"
                  >
                    {r.name}
                    <button
                      onClick={() => toggleResourceSelection(r)}
                      className="hover:text-blue-900 dark:hover:text-blue-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {selectedResources.length > 5 && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    +{selectedResources.length - 5} more
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedResources([]);
                  onResourceSelect?.([]);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear all
              </button>
              {mode === 'explorer' && (
                <button
                  onClick={() => {
                    selectedResources.forEach(r => onCreateWidget?.(r, 'metric-card'));
                  }}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600"
                >
                  Create Widgets
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loadingResources ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading Azure resources...</p>
            </div>
          </div>
        ) : !selectedSubscription ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Cloud className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select an Azure subscription to view resources</p>
            </div>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No resources found matching your criteria</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredResources.map(resource => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        ) : viewMode === 'graph' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(groupedResources).map(([type, typeResources]) => (
              <TypeGroup key={type} type={type} resources={typeResources} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource Group</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredResources.map(resource => {
                  const config = getResourceConfig(resource.type);
                  const Icon = config.icon;
                  const isSelected = selectedResources.some(r => r.id === resource.id);
                  return (
                    <tr 
                      key={resource.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, resource)}
                      onDragEnd={handleDragEnd}
                      onClick={() => toggleResourceSelection(resource)}
                      className={clsx(
                        'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50',
                        isSelected && 'bg-blue-50 dark:bg-blue-900/20'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                          <div className={clsx('p-1.5 rounded', config.bgColor)}>
                            <Icon className={clsx('w-4 h-4', config.color)} />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{resource.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {resource.type.split('/').pop()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {resource.resourceGroup}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {resource.location}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateWidget?.(resource, 'metric-card');
                            }}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer with drag hint */}
      <div className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <GripVertical className="w-3 h-3 inline-block mr-1" />
          Drag resources to the dashboard to create widgets, or click + buttons for quick add
        </p>
      </div>
    </div>
  );
}

export default AzureResourceExplorer;
