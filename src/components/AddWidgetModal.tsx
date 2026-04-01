import { useState, useEffect, ReactNode } from 'react';
import { 
  X, Plus, Loader2, Hash, TrendingUp, BarChart3, PieChart, 
  Table, List, Clock, Map, Terminal, Code, Target, Gauge,
  CheckCircle, ChevronRight, ArrowLeft, Cloud, Server
} from 'lucide-react';
import clsx from 'clsx';
import { SearchableSelect } from './SearchableSelect';
import { 
  addWidget, 
  getWidgetTypes, 
  WidgetType,
  testDataProvider,
  getLogAnalyticsWorkspaces,
  getAppInsightsInstances,
  AzureSubscription,
  AzureWorkspace,
  AzureAppInsights,
} from '../services/dynamicDashboardService';
import { getResourceGraphSubscriptions } from '../services/api';
import {
  DataProviderType,
  DEFAULT_WIDGET_CONFIGS,
  getDataProvidersForWidget
} from './widget-configs/types';
import { DataProviderSelector, DataProviderConfigForm } from './widget-configs/DataProviderConfig';
import { KqlQueryTemplates, KqlTemplate } from './widget-configs/KqlQueryTemplates';
import { MetricCardConfig } from './widget-configs/MetricCardConfig';
import { ChartConfig } from './widget-configs/ChartConfig';
import { TableConfig } from './widget-configs/TableConfig';
import { KpiConfig } from './widget-configs/KpiConfig';
import { GaugeConfig } from './widget-configs/GaugeConfig';
import { LogsConfig } from './widget-configs/LogsConfig';
import { AzureMetricsConfig } from './widget-configs/AzureMetricsConfig';

interface AddWidgetModalProps {
  pageId: string;
  onClose: () => void;
  onWidgetAdded: () => void;
}

const WIDGET_ICONS: Record<string, typeof Hash> = {
  'metric-card': Hash,
  'kpi': Target,
  'gauge': Gauge,
  'line-chart': TrendingUp,
  'bar-chart': BarChart3,
  'doughnut-chart': PieChart,
  'area-chart': TrendingUp,
  'data-table': Table,
  'status-list': List,
  'timeline': Clock,
  'map': Map,
  'logs-viewer': Terminal,
  'azure-metrics': TrendingUp,
  'custom-html': Code,
};

type Step = 'type' | 'basicInfo' | 'dataSource' | 'widgetConfig';

export function AddWidgetModal({ pageId, onClose, onWidgetAdded }: AddWidgetModalProps) {
  const [step, setStep] = useState<Step>('type');
  const [widgetTypes, setWidgetTypes] = useState<WidgetType[]>([]);
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  
  // Basic info
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [gridWidth, setGridWidth] = useState(4);
  const [gridHeight, setGridHeight] = useState(3);
  
  // Data Provider configuration
  const [dataProviderType, setDataProviderType] = useState<DataProviderType>('None');
  const [dataProviderConfig, setDataProviderConfig] = useState<Record<string, unknown>>({});
  const [refreshInterval, setRefreshInterval] = useState(0);
  
  // Widget-specific configuration
  const [widgetConfig, setWidgetConfig] = useState<Record<string, unknown>>({});

  // Azure resource discovery state
  const [azureSubscriptions, setAzureSubscriptions] = useState<AzureSubscription[]>([]);
  const [azureWorkspaces, setAzureWorkspaces] = useState<AzureWorkspace[]>([]);
  const [azureAppInsights, setAzureAppInsights] = useState<AzureAppInsights[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<string>('');
  const [loadingAzure, setLoadingAzure] = useState(false);

  useEffect(() => {
    loadWidgetTypes();
  }, []);

  // Load Azure subscriptions when Azure provider is selected
  useEffect(() => {
    if (['AzureMetrics', 'AzureLogAnalytics', 'AppInsights'].includes(dataProviderType)) {
      loadAzureSubscriptions();
    }
  }, [dataProviderType]);

  // Load Azure resources when subscription changes
  useEffect(() => {
    if (selectedSubscription) {
      if (dataProviderType === 'AzureLogAnalytics') {
        loadLogAnalyticsWorkspaces(selectedSubscription);
        // Also load App Insights for queries that use App Insights tables
        loadAppInsightsInstances(selectedSubscription);
      } else if (dataProviderType === 'AppInsights') {
        loadAppInsightsInstances(selectedSubscription);
      }
    }
  }, [selectedSubscription, dataProviderType]);

  const loadWidgetTypes = async () => {
    try {
      const response = await getWidgetTypes();
      setWidgetTypes(response.data);
    } catch (err) {
      console.error('Failed to load widget types:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAzureSubscriptions = async () => {
    setLoadingAzure(true);
    try {
      // Use Resource Graph for fast subscription discovery
      const { data } = await getResourceGraphSubscriptions();
      const subs = (data.subscriptions || []).map((s: any) => ({
        id: s.subscriptionId,
        name: s.name || s.displayName,
        state: s.state || 'Enabled'
      }));
      setAzureSubscriptions(subs);
      // Auto-select first subscription if only one
      if (subs.length === 1 && !selectedSubscription) {
        setSelectedSubscription(subs[0].id);
        setDataProviderConfig(prev => ({ ...prev, subscriptionId: subs[0].id }));
      }
      console.log(`Loaded ${subs.length} subscriptions via Resource Graph in ${data.queryTimeMs}ms`);
    } catch (error) {
      console.error('Failed to load Azure subscriptions:', error);
    } finally {
      setLoadingAzure(false);
    }
  };

  const loadLogAnalyticsWorkspaces = async (subscriptionId: string) => {
    setLoadingAzure(true);
    try {
      const response = await getLogAnalyticsWorkspaces(subscriptionId);
      setAzureWorkspaces(response.data);
      // Auto-select first workspace if only one
      if (response.data.length === 1) {
        setDataProviderConfig(prev => ({ ...prev, workspaceId: response.data[0].id }));
      }
    } catch (error) {
      console.error('Failed to load Log Analytics workspaces:', error);
    } finally {
      setLoadingAzure(false);
    }
  };

  const loadAppInsightsInstances = async (subscriptionId: string) => {
    setLoadingAzure(true);
    try {
      const response = await getAppInsightsInstances(subscriptionId);
      setAzureAppInsights(response.data);
      // Auto-select first instance if only one
      if (response.data.length === 1) {
        setDataProviderConfig(prev => ({ ...prev, appInsightsId: response.data[0].id }));
      }
    } catch (error) {
      console.error('Failed to load App Insights:', error);
    } finally {
      setLoadingAzure(false);
    }
  };

  const handleSelectType = (type: WidgetType) => {
    setSelectedType(type);
    setTitle(type.name);
    setGridWidth(type.defaultWidth);
    setGridHeight(type.defaultHeight);
    
    // Set default config for this widget type
    const defaultConfig = DEFAULT_WIDGET_CONFIGS[type.type] || {};
    setWidgetConfig(defaultConfig);
    
    // Set default data provider based on widget type
    const providers = getDataProvidersForWidget(type.type);
    if (providers.length > 0 && providers[0].type !== 'None') {
      setDataProviderType(providers[0].type);
    } else {
      setDataProviderType('None');
    }
    
    setStep('basicInfo');
  };

  const handleSelectDataProvider = (type: DataProviderType) => {
    setDataProviderType(type);
    setDataProviderConfig({});
    setTestResult(null);
    setSelectedSubscription('');
    setAzureWorkspaces([]);
    setAzureAppInsights([]);
  };

  const updateDataProviderConfigField = (key: string, value: unknown) => {
    setDataProviderConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleTestDataProvider = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await testDataProvider({
        dataProviderType,
        dataProviderConfig: JSON.stringify(dataProviderConfig),
      });
      setTestResult({ success: true, data: response.data });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Test failed';
      setTestResult({ success: false, error: errorMessage });
    } finally {
      setTesting(false);
    }
  };

  const handleAddWidget = async () => {
    if (!selectedType) return;
    
    setSaving(true);
    try {
      await addWidget(pageId, {
        widgetType: selectedType.type,
        title,
        subtitle: subtitle || undefined,
        gridX: 0,
        gridY: 0,
        gridWidth,
        gridHeight,
        minWidth: 2,
        minHeight: 2,
        displayOrder: 0,
        dataProviderType,
        widgetConfig,
        dataProviderConfig,
        refreshIntervalSeconds: refreshInterval,
      });
      onWidgetAdded();
    } catch (err) {
      console.error('Failed to add widget:', err);
      alert('Failed to add widget');
    } finally {
      setSaving(false);
    }
  };

  // Render widget-specific configuration
  const renderWidgetConfig = (): ReactNode => {
    if (!selectedType) return null;
    
    switch (selectedType.type) {
      case 'metric-card':
        return <MetricCardConfig config={widgetConfig} setConfig={setWidgetConfig} />;
      
      case 'kpi':
        return <KpiConfig config={widgetConfig} setConfig={setWidgetConfig} />;
      
      case 'gauge':
        return <GaugeConfig config={widgetConfig} setConfig={setWidgetConfig} />;
      
      case 'line-chart':
      case 'bar-chart':
      case 'area-chart':
      case 'doughnut-chart':
        return (
          <ChartConfig 
            chartType={selectedType.type as 'line-chart' | 'bar-chart' | 'area-chart' | 'doughnut-chart'} 
            config={widgetConfig} 
            setConfig={setWidgetConfig} 
          />
        );
      
      case 'data-table':
        return <TableConfig config={widgetConfig} setConfig={setWidgetConfig} />;
      
      case 'logs-viewer':
        return <LogsConfig config={widgetConfig} setConfig={setWidgetConfig} />;
      
      case 'azure-metrics':
        return <AzureMetricsConfig config={widgetConfig} setConfig={setWidgetConfig} />;
      
      default:
        // Generic config for other widget types
        return (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Widget-specific settings will be available after creation. 
              Use the edit button on the widget to customize display options.
            </p>
          </div>
        );
    }
  };

  // Group widget types by category
  const groupedTypes = widgetTypes.reduce((acc, type) => {
    const category = type.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(type);
    return acc;
  }, {} as Record<string, WidgetType[]>);

  const categoryLabels: Record<string, string> = {
    metrics: 'Metrics & KPIs',
    charts: 'Charts',
    tables: 'Tables & Lists',
    status: 'Status & Monitoring',
    monitoring: 'Monitoring',
    azure: 'Azure',
    advanced: 'Advanced',
    other: 'Other',
  };

  const steps = ['type', 'basicInfo', 'dataSource', 'widgetConfig'] as const;
  const stepLabels = ['Widget Type', 'Basic Info', 'Data Source', 'Configuration'];
  const currentStepIndex = steps.indexOf(step);

  const canProceed = () => {
    switch (step) {
      case 'type': return !!selectedType;
      case 'basicInfo': return !!title;
      case 'dataSource': return true;
      case 'widgetConfig': return true;
      default: return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header with Step Indicator */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Add Widget
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          {/* Step Indicator */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={clsx(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium',
                  currentStepIndex > i ? 'bg-green-500 text-white' :
                  currentStepIndex === i ? 'bg-blue-600 text-white' : 
                  'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                )}>
                  {currentStepIndex > i ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className={clsx(
                  'ml-1.5 text-xs hidden sm:inline',
                  currentStepIndex === i ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'
                )}>
                  {stepLabels[i]}
                </span>
                {i < steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 mx-1 text-gray-300 dark:text-gray-600" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Step 1: Select Widget Type */}
          {step === 'type' && (
            <div className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : (
                Object.entries(groupedTypes).map(([category, types]) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      {categoryLabels[category] || category}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {types.map(type => {
                        const Icon = WIDGET_ICONS[type.type] || Hash;
                        return (
                          <button
                            key={type.type}
                            onClick={() => handleSelectType(type)}
                            className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
                          >
                            <Icon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
                                {type.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                {type.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Step 2: Basic Info */}
          {step === 'basicInfo' && selectedType && (
            <div className="space-y-6">
              {/* Selected Widget Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center gap-3">
                {(() => {
                  const Icon = WIDGET_ICONS[selectedType.type] || Hash;
                  return <Icon className="w-6 h-6 text-blue-600" />;
                })()}
                <div>
                  <div className="font-medium text-blue-800 dark:text-blue-200">
                    {selectedType.name}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-300">
                    {selectedType.description}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Widget Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  placeholder="Enter a descriptive title"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subtitle / Description
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  placeholder="Optional additional context"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Width (columns)
                  </label>
                  <input
                    type="number"
                    value={gridWidth}
                    onChange={(e) => setGridWidth(Number(e.target.value))}
                    min={2}
                    max={12}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Height (rows)
                  </label>
                  <input
                    type="number"
                    value={gridHeight}
                    onChange={(e) => setGridHeight(Number(e.target.value))}
                    min={2}
                    max={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Data Source */}
          {step === 'dataSource' && selectedType && (
            <div className="space-y-6">
              {/* Widget Info Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                {(() => {
                  const Icon = WIDGET_ICONS[selectedType.type] || Hash;
                  return <Icon className="w-5 h-5 text-gray-500" />;
                })()}
                <div>
                  <div className="font-medium text-gray-800 dark:text-gray-200">{title}</div>
                  <div className="text-sm text-gray-500">{selectedType.name}</div>
                </div>
              </div>

              {/* Data Provider Selection */}
              <DataProviderSelector
                widgetType={selectedType.type}
                selectedType={dataProviderType}
                onSelect={handleSelectDataProvider}
              />

              {/* Azure Log Analytics Configuration */}
              {dataProviderType === 'AzureLogAnalytics' && (
                <div className="space-y-4">
                  {/* Azure Subscription Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Azure Subscription
                    </label>
                    <SearchableSelect
                      options={azureSubscriptions.map(sub => ({
                        value: sub.id,
                        label: sub.name,
                        description: sub.id,
                      }))}
                      value={selectedSubscription}
                      onChange={(value) => {
                        setSelectedSubscription(value);
                        updateDataProviderConfigField('subscriptionId', value);
                        updateDataProviderConfigField('workspaceId', '');
                      }}
                      placeholder="Select subscription..."
                      searchPlaceholder="Search subscriptions..."
                      loading={loadingAzure}
                    />
                  </div>

                  {/* Workspace Selection */}
                  {selectedSubscription && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Log Analytics Workspace
                      </label>
                      <SearchableSelect
                        options={azureWorkspaces.map(ws => ({
                          value: ws.id,
                          label: ws.name,
                          description: ws.resourceGroup,
                        }))}
                        value={(dataProviderConfig.workspaceId as string) || ''}
                        onChange={(value) => updateDataProviderConfigField('workspaceId', value)}
                        placeholder="Select workspace..."
                        searchPlaceholder="Search workspaces..."
                        loading={loadingAzure}
                      />
                    </div>
                  )}

                  {/* App Insights for queries using App Insights tables */}
                  {selectedSubscription && azureAppInsights.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Application Insights <span className="text-xs text-gray-500">(for App Insights tables)</span>
                      </label>
                      <SearchableSelect
                        options={azureAppInsights.map(ai => ({
                          value: ai.id,
                          label: ai.name,
                          description: ai.resourceGroup,
                        }))}
                        value={(dataProviderConfig.appInsightsId as string) || ''}
                        onChange={(value) => updateDataProviderConfigField('appInsightsId', value)}
                        placeholder="Select App Insights (optional)..."
                        searchPlaceholder="Search instances..."
                        loading={loadingAzure}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Required for queries using: requests, dependencies, traces, exceptions, pageViews, performanceCounters, etc.
                      </p>
                    </div>
                  )}

                  {/* Query Templates */}
                  <KqlQueryTemplates
                    currentQuery={(dataProviderConfig.query as string) || ''}
                    onSelectTemplate={(template: KqlTemplate) => {
                      updateDataProviderConfigField('query', template.query);
                      updateDataProviderConfigField('timeRange', template.suggestedTimeRange);
                    }}
                  />

                  {/* KQL Query */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      KQL Query
                    </label>
                    <textarea
                      value={(dataProviderConfig.query as string) || ''}
                      onChange={(e) => updateDataProviderConfigField('query', e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
                      placeholder="Select a template above or write your own KQL query"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Write a KQL query to fetch data from Log Analytics
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Time Range
                    </label>
                    <select
                      value={(dataProviderConfig.timeRange as string) || '1h'}
                      onChange={(e) => updateDataProviderConfigField('timeRange', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    >
                      <option value="15m">Last 15 minutes</option>
                      <option value="1h">Last hour</option>
                      <option value="4h">Last 4 hours</option>
                      <option value="12h">Last 12 hours</option>
                      <option value="24h">Last 24 hours</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                    </select>
                  </div>

                  {/* Test Button */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleTestDataProvider}
                      disabled={testing || !dataProviderConfig.workspaceId || !dataProviderConfig.query}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                        testing || !dataProviderConfig.workspaceId || !dataProviderConfig.query
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      )}
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                      Test Query
                    </button>
                    {testResult && (
                      <div className={clsx(
                        'flex items-center gap-2 text-sm',
                        testResult.success ? 'text-green-600' : 'text-red-600'
                      )}>
                        {testResult.success ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        {testResult.success ? 'Query successful' : testResult.error}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Application Insights Configuration */}
              {dataProviderType === 'AppInsights' && (
                <div className="space-y-4">
                  {/* Azure Subscription Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Azure Subscription
                    </label>
                    <SearchableSelect
                      options={azureSubscriptions.map(sub => ({
                        value: sub.id,
                        label: sub.name,
                        description: sub.id,
                      }))}
                      value={selectedSubscription}
                      onChange={(value) => {
                        setSelectedSubscription(value);
                        updateDataProviderConfigField('subscriptionId', value);
                        updateDataProviderConfigField('appInsightsId', '');
                      }}
                      placeholder="Select subscription..."
                      searchPlaceholder="Search subscriptions..."
                      loading={loadingAzure}
                    />
                  </div>

                  {/* App Insights Instance Selection */}
                  {selectedSubscription && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Application Insights Instance
                      </label>
                      <SearchableSelect
                        options={azureAppInsights.map(ai => ({
                          value: ai.id,
                          label: ai.name,
                          description: ai.resourceGroup,
                        }))}
                        value={(dataProviderConfig.appInsightsId as string) || ''}
                        onChange={(value) => updateDataProviderConfigField('appInsightsId', value)}
                        placeholder="Select App Insights..."
                        searchPlaceholder="Search instances..."
                        loading={loadingAzure}
                      />
                    </div>
                  )}

                  {/* Metric Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Metric Type
                    </label>
                    <select
                      value={(dataProviderConfig.metricType as string) || 'requests'}
                      onChange={(e) => updateDataProviderConfigField('metricType', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    >
                      <option value="requests">Requests</option>
                      <option value="exceptions">Exceptions</option>
                      <option value="dependencies">Dependencies</option>
                      <option value="performance">Performance</option>
                      <option value="availability">Availability</option>
                    </select>
                  </div>

                  {/* Test Button */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleTestDataProvider}
                      disabled={testing || !dataProviderConfig.appInsightsId}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                        testing || !dataProviderConfig.appInsightsId
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      )}
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                      Test Connection
                    </button>
                    {testResult && (
                      <div className={clsx(
                        'flex items-center gap-2 text-sm',
                        testResult.success ? 'text-green-600' : 'text-red-600'
                      )}>
                        {testResult.success ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        {testResult.success ? 'Connection successful' : testResult.error}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Azure Metrics Configuration */}
              {dataProviderType === 'AzureMetrics' && (
                <AzureMetricsConfig 
                  config={dataProviderConfig} 
                  setConfig={setDataProviderConfig} 
                />
              )}

              {/* Other Data Provider Configuration */}
              {dataProviderType !== 'None' && dataProviderType !== 'AzureLogAnalytics' && dataProviderType !== 'AppInsights' && dataProviderType !== 'AzureMetrics' && (
                <DataProviderConfigForm
                  type={dataProviderType}
                  config={dataProviderConfig}
                  onChange={setDataProviderConfig}
                  onTest={handleTestDataProvider}
                  testing={testing}
                  testResult={testResult}
                />
              )}

              {/* Refresh Interval */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Auto Refresh
                </label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="w-full sm:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                >
                  <option value={0}>Manual refresh only</option>
                  <option value={10}>Every 10 seconds</option>
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every minute</option>
                  <option value={300}>Every 5 minutes</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Widget Configuration */}
          {step === 'widgetConfig' && selectedType && (
            <div className="space-y-6">
              {/* Widget Info Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = WIDGET_ICONS[selectedType.type] || Hash;
                    return <Icon className="w-5 h-5 text-gray-500" />;
                  })()}
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">{title}</div>
                    <div className="text-sm text-gray-500">
                      {selectedType.name} • {dataProviderType === 'None' ? 'No data source' : dataProviderType}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {gridWidth}×{gridHeight}
                </div>
              </div>

              {/* Widget-specific configuration */}
              {renderWidgetConfig()}

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mt-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Summary</h4>
                <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <dt className="text-gray-500 dark:text-gray-400">Widget:</dt>
                  <dd className="text-gray-800 dark:text-gray-200">{selectedType.name}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">Title:</dt>
                  <dd className="text-gray-800 dark:text-gray-200">{title}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">Data Source:</dt>
                  <dd className="text-gray-800 dark:text-gray-200">
                    {dataProviderType === 'None' ? 'Not configured' : dataProviderType}
                  </dd>
                  <dt className="text-gray-500 dark:text-gray-400">Size:</dt>
                  <dd className="text-gray-800 dark:text-gray-200">{gridWidth} × {gridHeight}</dd>
                  <dt className="text-gray-500 dark:text-gray-400">Auto Refresh:</dt>
                  <dd className="text-gray-800 dark:text-gray-200">
                    {refreshInterval === 0 ? 'Manual' : `Every ${refreshInterval}s`}
                  </dd>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            {step !== 'type' && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            {step !== 'widgetConfig' ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={clsx(
                  'flex items-center gap-2 px-6 py-2 rounded-lg font-medium',
                  canProceed()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleAddWidget}
                disabled={saving}
                className={clsx(
                  'flex items-center gap-2 px-6 py-2 rounded-lg font-medium',
                  saving
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Plus className="w-4 h-4" />
                Add Widget
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddWidgetModal;
