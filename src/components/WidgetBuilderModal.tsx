import { useState, useCallback } from 'react';
import { 
  X, Cloud, Trash2, Settings, ChevronRight, BarChart3, 
  Activity, PieChart, Table, Gauge, ArrowRight, Save
} from 'lucide-react';
import clsx from 'clsx';
import { AzureResourceExplorer } from './AzureResourceExplorer';
import { AzureMetricResource } from '../services/dynamicDashboardService';

interface WidgetConfig {
  resource: AzureMetricResource;
  widgetType: string;
  metricName?: string;
  aggregation?: string;
  timespan?: string;
  title?: string;
}

interface WidgetBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWidgets: (configs: WidgetConfig[]) => void;
  pageId: string;
}

const WIDGET_TYPES = [
  { type: 'metric-card', label: 'Metric Card', icon: BarChart3, description: 'Single value display' },
  { type: 'line-chart', label: 'Line Chart', icon: Activity, description: 'Time series chart' },
  { type: 'bar-chart', label: 'Bar Chart', icon: BarChart3, description: 'Comparison chart' },
  { type: 'gauge', label: 'Gauge', icon: Gauge, description: 'Progress indicator' },
  { type: 'doughnut-chart', label: 'Pie Chart', icon: PieChart, description: 'Distribution view' },
  { type: 'data-table', label: 'Data Table', icon: Table, description: 'Tabular data' },
];

const TIME_RANGES = [
  { value: 'PT5M', label: 'Last 5 minutes' },
  { value: 'PT15M', label: 'Last 15 minutes' },
  { value: 'PT1H', label: 'Last 1 hour' },
  { value: 'PT6H', label: 'Last 6 hours' },
  { value: 'PT24H', label: 'Last 24 hours' },
  { value: 'P7D', label: 'Last 7 days' },
];

const AGGREGATIONS = ['Average', 'Total', 'Maximum', 'Minimum', 'Count'];

export function WidgetBuilderModal({ isOpen, onClose, onCreateWidgets, pageId: _pageId }: WidgetBuilderModalProps) {
  const [step, setStep] = useState<'explore' | 'configure'>('explore');
  const [bucket, setBucket] = useState<WidgetConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<number | null>(null);

  // Handle resource drop from explorer
  const handleResourceDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'azure-resource' && data.resource) {
        addResourceToBucket(data.resource, 'metric-card');
      }
    } catch (err) {
      console.error('Invalid drop data:', err);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Add resource to bucket
  const addResourceToBucket = (resource: AzureMetricResource, widgetType: string) => {
    const newConfig: WidgetConfig = {
      resource,
      widgetType,
      aggregation: 'Average',
      timespan: 'PT1H',
      title: `${resource.name} - ${resource.type.split('/').pop()}`
    };
    setBucket(prev => [...prev, newConfig]);
  };

  // Remove from bucket
  const removeFromBucket = (index: number) => {
    setBucket(prev => prev.filter((_, i) => i !== index));
    if (selectedConfig === index) setSelectedConfig(null);
  };

  // Update config
  const updateConfig = (index: number, updates: Partial<WidgetConfig>) => {
    setBucket(prev => prev.map((config, i) => 
      i === index ? { ...config, ...updates } : config
    ));
  };

  // Handle create widget from explorer
  const handleCreateWidget = (resource: AzureMetricResource, widgetType: string) => {
    addResourceToBucket(resource, widgetType);
  };

  // Create all widgets
  const handleCreateAll = () => {
    onCreateWidgets(bucket);
    setBucket([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[95vw] h-[90vh] max-w-[1600px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Cloud className="w-6 h-6 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Visual Widget Builder
            </h2>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => setStep('explore')}
                className={clsx(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  step === 'explore' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">1</span>
                Explore Resources
              </button>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <button
                onClick={() => bucket.length > 0 && setStep('configure')}
                disabled={bucket.length === 0}
                className={clsx(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  step === 'configure' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                  bucket.length === 0 && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className={clsx(
                  'w-5 h-5 rounded-full text-xs flex items-center justify-center',
                  step === 'configure' ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                )}>2</span>
                Configure ({bucket.length})
              </button>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {step === 'explore' ? (
            <>
              {/* Azure Resource Explorer */}
              <div className="flex-1 overflow-hidden">
                <AzureResourceExplorer 
                  onCreateWidget={handleCreateWidget}
                  mode="picker"
                />
              </div>

              {/* Drop Zone / Bucket */}
              <div 
                onDrop={handleResourceDrop}
                onDragOver={handleDragOver}
                className={clsx(
                  'w-80 border-l border-gray-200 dark:border-gray-700 flex flex-col',
                  'bg-gray-50 dark:bg-gray-900'
                )}
              >
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <h3 className="font-medium text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">
                      {bucket.length}
                    </span>
                    Widget Bucket
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Drop resources here or click + buttons</p>
                </div>

                <div className="flex-1 overflow-auto p-3">
                  {bucket.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-3">
                        <ArrowRight className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">
                        Drag resources here to add them to your widget collection
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bucket.map((config, index) => {
                        const WidgetIcon = WIDGET_TYPES.find(w => w.type === config.widgetType)?.icon || BarChart3;
                        return (
                          <div 
                            key={index}
                            onClick={() => setSelectedConfig(selectedConfig === index ? null : index)}
                            className={clsx(
                              'p-3 rounded-lg border-2 cursor-pointer transition-all',
                              selectedConfig === index
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <WidgetIcon className="w-4 h-4 text-blue-500" />
                                <div>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
                                    {config.resource.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {WIDGET_TYPES.find(w => w.type === config.widgetType)?.label}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromBucket(index);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Quick config when selected */}
                            {selectedConfig === index && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Widget Type</label>
                                  <select
                                    value={config.widgetType}
                                    onChange={(e) => updateConfig(index, { widgetType: e.target.value })}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                  >
                                    {WIDGET_TYPES.map(wt => (
                                      <option key={wt.type} value={wt.type}>{wt.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Aggregation</label>
                                  <select
                                    value={config.aggregation}
                                    onChange={(e) => updateConfig(index, { aggregation: e.target.value })}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                                  >
                                    {AGGREGATIONS.map(agg => (
                                      <option key={agg} value={agg}>{agg}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {bucket.length > 0 && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <button
                      onClick={() => setStep('configure')}
                      className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium flex items-center justify-center gap-2"
                    >
                      Configure Widgets
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Configure Step */
            <div className="flex-1 flex overflow-hidden">
              {/* Widget List */}
              <div className="w-72 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <h3 className="font-medium text-gray-800 dark:text-gray-100">
                    Widgets to Create ({bucket.length})
                  </h3>
                </div>
                <div className="flex-1 overflow-auto p-3 space-y-2">
                  {bucket.map((config, index) => {
                    const WidgetIcon = WIDGET_TYPES.find(w => w.type === config.widgetType)?.icon || BarChart3;
                    return (
                      <div 
                        key={index}
                        onClick={() => setSelectedConfig(index)}
                        className={clsx(
                          'p-3 rounded-lg border-2 cursor-pointer transition-all',
                          selectedConfig === index
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <WidgetIcon className="w-4 h-4 text-blue-500" />
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                            {config.title || config.resource.name}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {config.resource.resourceGroup}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Config Panel */}
              <div className="flex-1 overflow-auto p-6">
                {selectedConfig !== null && bucket[selectedConfig] ? (
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                      Configure Widget
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Title */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Widget Title
                        </label>
                        <input
                          type="text"
                          value={bucket[selectedConfig].title || ''}
                          onChange={(e) => updateConfig(selectedConfig, { title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        />
                      </div>

                      {/* Widget Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Widget Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {WIDGET_TYPES.map(wt => {
                            const Icon = wt.icon;
                            return (
                              <button
                                key={wt.type}
                                onClick={() => updateConfig(selectedConfig, { widgetType: wt.type })}
                                className={clsx(
                                  'p-3 rounded-lg border-2 text-left transition-all',
                                  bucket[selectedConfig].widgetType === wt.type
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                )}
                              >
                                <Icon className={clsx(
                                  'w-5 h-5 mb-1',
                                  bucket[selectedConfig].widgetType === wt.type ? 'text-blue-500' : 'text-gray-500'
                                )} />
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{wt.label}</p>
                                <p className="text-xs text-gray-500">{wt.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Aggregation */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Aggregation
                          </label>
                          <select
                            value={bucket[selectedConfig].aggregation}
                            onChange={(e) => updateConfig(selectedConfig, { aggregation: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                          >
                            {AGGREGATIONS.map(agg => (
                              <option key={agg} value={agg}>{agg}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Time Range
                          </label>
                          <select
                            value={bucket[selectedConfig].timespan}
                            onChange={(e) => updateConfig(selectedConfig, { timespan: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                          >
                            {TIME_RANGES.map(tr => (
                              <option key={tr.value} value={tr.value}>{tr.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Resource Info */}
                      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resource Details</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Name:</span>
                            <span className="text-gray-800 dark:text-gray-100">{bucket[selectedConfig].resource.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Type:</span>
                            <span className="text-gray-800 dark:text-gray-100">{bucket[selectedConfig].resource.type.split('/').pop()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Resource Group:</span>
                            <span className="text-gray-800 dark:text-gray-100">{bucket[selectedConfig].resource.resourceGroup}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Location:</span>
                            <span className="text-gray-800 dark:text-gray-100">{bucket[selectedConfig].resource.location}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>Select a widget from the list to configure it</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm text-gray-500">
            {bucket.length > 0 
              ? `${bucket.length} widget${bucket.length !== 1 ? 's' : ''} ready to create`
              : 'No widgets selected yet'}
          </div>
          <div className="flex gap-3">
            {step === 'configure' && (
              <button
                onClick={() => setStep('explore')}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                ← Back to Explorer
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateAll}
              disabled={bucket.length === 0}
              className={clsx(
                'px-6 py-2 rounded-lg font-medium flex items-center gap-2',
                bucket.length > 0
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              )}
            >
              <Save className="w-4 h-4" />
              Create {bucket.length} Widget{bucket.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WidgetBuilderModal;
