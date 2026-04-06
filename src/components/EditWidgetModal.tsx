import { useState, useEffect } from 'react';
import { 
  X, Database, Globe, Server, Cloud, FileSpreadsheet, 
  Zap, Settings, Eye, Loader2, CheckCircle, AlertCircle, Play, 
  RefreshCw, Maximize2, Map, Wand2, AlertTriangle, Sparkles, ArrowRight
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import clsx from 'clsx';
import { 
  DashboardWidget, 
  updateWidget,
  getDataProviders,
  DataProviderConfig,
  testDataProvider,
  getLogAnalyticsWorkspaces,
  getAppInsightsInstances,
  getMetricResources,
  getMetricDefinitions,
  AzureSubscription,
  AzureWorkspace,
  AzureAppInsights,
  AzureMetricResource,
  AzureMetricDefinition,
} from '../services/dynamicDashboardService';
import { getResourceGraphSubscriptions } from '../services/api';
import { aiService } from '../services/aiService';
import { WidgetRenderer } from './widgets/WidgetRenderer';
import { DataFieldMapper, DataMapping, WIDGET_DATA_REQUIREMENTS } from './DataFieldMapper';
import { KqlQueryTemplates, KqlTemplate } from './widget-configs/KqlQueryTemplates';

interface EditWidgetModalProps {
  widget: DashboardWidget;
  onClose: () => void;
  onSaved: () => void;
}

type DataProviderType = 'None' | 'Static' | 'ApiEndpoint' | 'DatabaseQuery' | 'AzureMetrics' | 'AzureLogAnalytics' | 'AppInsights' | 'Excel' | 'SignalR' | 'Custom';

const DATA_PROVIDER_OPTIONS: { value: DataProviderType; label: string; icon: typeof Database; description: string }[] = [
  { value: 'None', label: 'None', icon: Settings, description: 'No data source - static content only' },
  { value: 'Static', label: 'Static Data', icon: FileSpreadsheet, description: 'Hardcoded JSON data' },
  { value: 'ApiEndpoint', label: 'REST API', icon: Globe, description: 'Fetch from REST API endpoint' },
  { value: 'DatabaseQuery', label: 'Database Query', icon: Database, description: 'Query SQL database directly' },
  { value: 'AzureMetrics', label: 'Azure Metrics', icon: Cloud, description: 'Azure Monitor metrics' },
  { value: 'AzureLogAnalytics', label: 'Log Analytics', icon: Server, description: 'Azure Log Analytics workspace' },
  { value: 'AppInsights', label: 'App Insights', icon: Zap, description: 'Application Insights telemetry' },
  { value: 'SignalR', label: 'Real-time (SignalR)', icon: Zap, description: 'Live updates via SignalR' },
];

// All available widget types
const WIDGET_TYPES = [
  { value: 'metric-card', label: 'Metric Card', description: 'Single value with trend' },
  { value: 'kpi', label: 'KPI', description: 'Key performance indicator with target' },
  { value: 'gauge', label: 'Gauge', description: 'Circular progress indicator' },
  { value: 'line-chart', label: 'Line Chart', description: 'Time series visualization' },
  { value: 'bar-chart', label: 'Bar Chart', description: 'Category comparison' },
  { value: 'doughnut-chart', label: 'Doughnut Chart', description: 'Proportional data' },
  { value: 'data-table', label: 'Data Table', description: 'Tabular data display' },
  { value: 'status-list', label: 'Status List', description: 'List with status indicators' },
  { value: 'timeline', label: 'Timeline', description: 'Activity timeline' },
  { value: 'logs-viewer', label: 'Logs Viewer', description: 'Log entries display' },
  { value: 'map', label: 'Map', description: 'Interactive OpenStreetMap view' },
  { value: 'custom-html', label: 'Custom HTML', description: 'Embed custom HTML content' },
];

// Extract all keys from data (handles arrays, objects, nested data)
function extractDataKeys(data: unknown): { keys: string[]; isArray: boolean; sample: Record<string, unknown> | null; nestedArrays: { key: string; path: string; sample: unknown }[] } {
  if (!data) return { keys: [], isArray: false, sample: null, nestedArrays: [] };
  
  const nestedArrays: { key: string; path: string; sample: unknown }[] = [];
  
  if (Array.isArray(data)) {
    if (data.length === 0) return { keys: [], isArray: true, sample: null, nestedArrays: [] };
    const sample = data[0];
    if (typeof sample === 'object' && sample !== null) {
      const sampleObj = sample as Record<string, unknown>;
      const keys = Object.keys(sampleObj);
      
      // Find nested arrays (like Azure Metrics timeseries)
      for (const key of keys) {
        if (Array.isArray(sampleObj[key]) && (sampleObj[key] as unknown[]).length > 0) {
          const nestedSample = (sampleObj[key] as unknown[])[0];
          if (typeof nestedSample === 'object' && nestedSample !== null) {
            nestedArrays.push({ key, path: `$[0].${key}`, sample: nestedSample });
          }
        }
      }
      
      return { keys, isArray: true, sample: sampleObj, nestedArrays };
    }
    return { keys: [], isArray: true, sample: null, nestedArrays: [] };
  }
  
  if (typeof data === 'object' && data !== null) {
    const objData = data as Record<string, unknown>;
    const keys = Object.keys(objData);
    
    // Find nested arrays in object
    for (const key of keys) {
      if (Array.isArray(objData[key]) && (objData[key] as unknown[]).length > 0) {
        const nestedSample = (objData[key] as unknown[])[0];
        if (typeof nestedSample === 'object' && nestedSample !== null) {
          nestedArrays.push({ key, path: `$.${key}`, sample: nestedSample });
        }
      }
    }
    
    return { keys, isArray: false, sample: objData, nestedArrays };
  }
  
  return { keys: [], isArray: false, sample: null, nestedArrays: [] };
}

// AI auto-mapping: Match data keys to widget requirements
function generateAutoMappings(widgetType: string, data: unknown): DataMapping {
  const { keys, isArray, sample, nestedArrays } = extractDataKeys(data);
  if (keys.length === 0) return { dataPath: '', fieldMappings: {} };
  
  // Special handling for Azure Metrics-style data (array with nested timeseries)
  // Detect pattern: [{name, unit, timeseries: [...]}]
  const hasTimeseries = nestedArrays.some(n => n.key === 'timeseries');
  if (hasTimeseries && (widgetType === 'line-chart' || widgetType === 'data-table' || widgetType === 'bar-chart')) {
    const ts = nestedArrays.find(n => n.key === 'timeseries');
    if (ts && typeof ts.sample === 'object') {
      const tsKeys = Object.keys(ts.sample as Record<string, unknown>);
      const fieldMappings: Record<string, { path: string; type: string; sampleValue: unknown }> = {};
      
      // Map timestamp to x/label
      if (tsKeys.includes('timestamp')) {
        fieldMappings['x'] = { path: '$[0].timeseries.timestamp', type: 'string', sampleValue: (ts.sample as Record<string, unknown>).timestamp };
        fieldMappings['label'] = { path: '$[0].timeseries.timestamp', type: 'string', sampleValue: (ts.sample as Record<string, unknown>).timestamp };
      }
      
      // Map value fields (average, total, etc.)
      for (const valueKey of ['average', 'total', 'count', 'minimum', 'maximum']) {
        if (tsKeys.includes(valueKey)) {
          fieldMappings['value'] = { path: `$[0].timeseries.${valueKey}`, type: 'number', sampleValue: (ts.sample as Record<string, unknown>)[valueKey] };
          fieldMappings['y'] = { path: `$[0].timeseries.${valueKey}`, type: 'number', sampleValue: (ts.sample as Record<string, unknown>)[valueKey] };
          break;
        }
      }

      // Add name/unit from parent
      if (sample) {
        if ('name' in sample) {
          fieldMappings['name'] = { path: '$[0].name', type: 'string', sampleValue: sample.name };
          fieldMappings['title'] = { path: '$[0].name', type: 'string', sampleValue: sample.name };
        }
        if ('unit' in sample) {
          fieldMappings['unit'] = { path: '$[0].unit', type: 'string', sampleValue: sample.unit };
        }
      }
      
      return { dataPath: '$[0].timeseries', fieldMappings };
    }
  }
  
  const requirements = WIDGET_DATA_REQUIREMENTS[widgetType] || WIDGET_DATA_REQUIREMENTS['MetricCard'];
  const allFields = [...requirements.requiredFields, ...requirements.optionalFields.map(f => ({ ...f, required: false }))];
  
  // Determine data path based on widget type expectations
  let dataPath = '$';
  if (requirements.dataSourceType === 'array' && isArray) {
    dataPath = '$';
  } else if (requirements.dataSourceType === 'object' && !isArray) {
    dataPath = '$';
  }
  
  // Field matching patterns for common field names
  const fieldPatterns: Record<string, string[]> = {
    value: ['value', 'count', 'total', 'amount', 'metric', 'number', 'sum', 'avg', 'average'],
    label: ['label', 'name', 'title', 'category', 'key', 'item', 'description'],
    x: ['x', 'date', 'time', 'timestamp', 'month', 'year', 'day', 'period', 'label', 'name'],
    y: ['y', 'value', 'count', 'amount', 'total', 'metric'],
    trend: ['trend', 'change', 'delta', 'percent', 'growth', 'diff', 'difference'],
    trendLabel: ['trendLabel', 'changeLabel', 'period', 'timeframe'],
    status: ['status', 'state', 'type', 'level', 'severity', 'condition'],
    name: ['name', 'title', 'label', 'item', 'description', 'text'],
    title: ['title', 'name', 'heading', 'label', 'subject'],
    time: ['time', 'date', 'timestamp', 'createdAt', 'updatedAt', 'when', 'datetime'],
    description: ['description', 'desc', 'details', 'body', 'content', 'message', 'text'],
    user: ['user', 'author', 'createdBy', 'owner', 'username', 'assignee'],
    color: ['color', 'colour', 'backgroundColor', 'bg'],
    icon: ['icon', 'iconName', 'symbol'],
    type: ['type', 'category', 'kind', 'class'],
    series: ['series', 'group', 'category', 'dataset'],
    content: ['content', 'body', 'text', 'markdown', 'html'],
  };
  
  const fieldMappings: Record<string, { path: string; type: string; sampleValue: unknown }> = {};
  
  for (const field of allFields) {
    const patterns = fieldPatterns[field.key] || [field.key.toLowerCase()];
    
    // Find matching key in data
    const matchedKey = keys.find(k => {
      const lowerK = k.toLowerCase();
      return patterns.some(p => lowerK === p || lowerK.includes(p) || p.includes(lowerK));
    });
    
    if (matchedKey && sample) {
      const sampleValue = sample[matchedKey];
      fieldMappings[field.key] = {
        path: isArray ? `$.${matchedKey}` : `$.${matchedKey}`,
        type: typeof sampleValue,
        sampleValue,
      };
    }
  }
  
  return { dataPath, fieldMappings };
}

// AI suggestion helper - detects best widget type and mappings for data
function suggestWidgetConfig(data: unknown): { suggestedType?: string; suggestedMappings?: Record<string, string | undefined>; dataKeys?: string[] } {
  if (!data) return {};
  
  const { keys, isArray } = extractDataKeys(data);
  
  // Check if it's an array
  if (isArray) {
    if (keys.length === 0) return { suggestedType: 'data-table', dataKeys: [] };
    
    // Check for chart-like data (label + value)
    const hasLabel = keys.some(k => ['label', 'name', 'category', 'month', 'date', 'x'].includes(k.toLowerCase()));
    const hasValue = keys.some(k => ['value', 'count', 'amount', 'total', 'y'].includes(k.toLowerCase()));
    
    if (hasLabel && hasValue) {
      return {
        suggestedType: 'bar-chart',
        suggestedMappings: {
          label: keys.find(k => ['label', 'name', 'category', 'month', 'date', 'x'].includes(k.toLowerCase())) || keys[0],
          value: keys.find(k => ['value', 'count', 'amount', 'total', 'y'].includes(k.toLowerCase())) || keys[1],
        },
        dataKeys: keys,
      };
    }
    
    // Check for status list
    const hasStatus = keys.some(k => ['status', 'state', 'type'].includes(k.toLowerCase()));
    const hasName = keys.some(k => ['name', 'title', 'label', 'item'].includes(k.toLowerCase()));
    if (hasStatus && hasName) {
      return {
        suggestedType: 'status-list',
        suggestedMappings: {
          name: keys.find(k => ['name', 'title', 'label', 'item'].includes(k.toLowerCase())) || keys[0],
          status: keys.find(k => ['status', 'state', 'type'].includes(k.toLowerCase())) || keys[1],
        },
        dataKeys: keys,
      };
    }
    
    // Check for timeline/activity
    const hasTime = keys.some(k => ['time', 'date', 'timestamp', 'createdAt'].includes(k.toLowerCase()));
    const hasTitle = keys.some(k => ['title', 'name', 'activity', 'event'].includes(k.toLowerCase()));
    if (hasTime && hasTitle) {
      return {
        suggestedType: 'timeline',
        suggestedMappings: {
          title: keys.find(k => ['title', 'name', 'activity', 'event'].includes(k.toLowerCase())),
          time: keys.find(k => ['time', 'date', 'timestamp', 'createdAt'].includes(k.toLowerCase())),
        },
        dataKeys: keys,
      };
    }
    
    // Default to data table for arrays of objects
    return { suggestedType: 'data-table', dataKeys: keys };
  }
  
  // Check if it's a single object
  if (typeof data === 'object' && data !== null) {
    // Check for metric card data
    const hasValue = keys.some(k => ['value', 'count', 'total', 'amount', 'metric'].includes(k.toLowerCase()));
    const hasTrend = keys.some(k => ['trend', 'change', 'delta', 'percent', 'growth'].includes(k.toLowerCase()));
    
    if (hasValue) {
      return {
        suggestedType: 'metric-card',
        suggestedMappings: {
          value: keys.find(k => ['value', 'count', 'total', 'amount', 'metric'].includes(k.toLowerCase())) || 'value',
          trend: hasTrend ? (keys.find(k => ['trend', 'change', 'delta', 'percent', 'growth'].includes(k.toLowerCase())) || undefined) : undefined,
        },
        dataKeys: keys,
      };
    }
    
    return { dataKeys: keys };
  }
  
  return {};
}

// Helper component to display detected data keys
function DetectedKeysDisplay({ data }: { data: unknown }) {
  const { keys, isArray, nestedArrays } = extractDataKeys(data);
  
  if (keys.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">
          Detected {isArray ? 'array' : 'object'} with {keys.length} field{keys.length !== 1 ? 's' : ''}:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {keys.map(key => (
            <span 
              key={key} 
              className={clsx(
                "px-2 py-0.5 rounded border text-xs font-mono",
                nestedArrays.some(n => n.key === key)
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                  : "bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300"
              )}
            >
              {key}
              {nestedArrays.some(n => n.key === key) && ' []'}
            </span>
          ))}
        </div>
      </div>
      
      {nestedArrays.length > 0 && (
        <div className="pt-2 border-t border-purple-200 dark:border-purple-700">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
            📊 Nested arrays detected (drill-down available):
          </p>
          {nestedArrays.map(nested => (
            <div key={nested.key} className="ml-2 mt-1">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-300">
                {nested.path}
              </span>
              {typeof nested.sample === 'object' && nested.sample && (
                <span className="text-xs text-gray-500 ml-2">
                  ({Object.keys(nested.sample).slice(0, 5).join(', ')}{Object.keys(nested.sample).length > 5 ? '...' : ''})
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditWidgetModal({ widget, onClose, onSaved }: EditWidgetModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'data' | 'mapping' | 'display' | 'preview'>('basic');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: unknown; error?: string } | null>(null);
  
  // Form state
  const [title, setTitle] = useState(widget.title);
  const [subtitle, setSubtitle] = useState(widget.subtitle || '');
  const [widgetType, setWidgetType] = useState(widget.widgetType);
  const [dataProviderType, setDataProviderType] = useState<DataProviderType>(widget.dataProviderType as DataProviderType);
  const [dataProviderConfig, setDataProviderConfig] = useState<Record<string, unknown>>(
    widget.dataProviderConfig as Record<string, unknown> || {}
  );
  const [widgetConfig, setWidgetConfig] = useState<Record<string, unknown>>(
    widget.widgetConfig as Record<string, unknown> || {}
  );
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(widget.refreshIntervalSeconds);
  
  // Static JSON text state (separate from parsed config to allow free editing)
  const [staticJsonText, setStaticJsonText] = useState(
    JSON.stringify(widget.dataProviderConfig?.staticData || {}, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // Raw config JSON text state for advanced editor
  const [rawConfigText, setRawConfigText] = useState(
    JSON.stringify(widget.widgetConfig || {}, null, 2)
  );
  const [rawConfigError, setRawConfigError] = useState<string | null>(null);
  
  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestedType?: string; suggestedMappings?: Record<string, string | undefined>; isFromAI?: boolean; explanation?: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  // Available data providers from backend
  const [savedProviders, setSavedProviders] = useState<DataProviderConfig[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>(widget.dataProviderConfigId);
  const [previewData, setPreviewData] = useState<unknown>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  
  // Data mapping state
  const [dataMapping, setDataMapping] = useState<DataMapping>({
    dataPath: (widget.widgetConfig as any)?.dataMapping?.dataPath || '',
    fieldMappings: (widget.widgetConfig as any)?.dataMapping?.fieldMappings || {},
  });

  // Sync rawConfigText when widgetConfig or dataMapping changes
  useEffect(() => {
    const fullConfig = {
      ...widgetConfig,
      dataMapping: dataMapping.dataPath ? dataMapping : undefined,
    };
    setRawConfigText(JSON.stringify(fullConfig, null, 2));
    setRawConfigError(null);
  }, [widgetConfig, dataMapping]);

  // Azure resource discovery state
  const [azureSubscriptions, setAzureSubscriptions] = useState<AzureSubscription[]>([]);
  const [azureWorkspaces, setAzureWorkspaces] = useState<AzureWorkspace[]>([]);
  const [azureAppInsights, setAzureAppInsights] = useState<AzureAppInsights[]>([]);
  const [azureMetricResources, setAzureMetricResources] = useState<AzureMetricResource[]>([]);
  const [azureMetricDefs, setAzureMetricDefs] = useState<AzureMetricDefinition[]>([]);
  const [loadingAzure, setLoadingAzure] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<string>((dataProviderConfig.subscriptionId as string) || '');

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
      } else if (dataProviderType === 'AzureMetrics') {
        loadMetricResources(selectedSubscription);
      }
    }
  }, [selectedSubscription, dataProviderType]);

  // Load metric definitions when resource is selected
  useEffect(() => {
    const resourceId = dataProviderConfig.resourceId as string;
    if (dataProviderType === 'AzureMetrics' && resourceId) {
      loadMetricDefinitions(resourceId);
    }
  }, [dataProviderConfig.resourceId, dataProviderType]);

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
        updateDataProviderConfigField('subscriptionId', subs[0].id);
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
    } catch (error) {
      console.error('Failed to load App Insights:', error);
    } finally {
      setLoadingAzure(false);
    }
  };

  const loadMetricResources = async (subscriptionId: string) => {
    setLoadingAzure(true);
    try {
      const response = await getMetricResources(subscriptionId);
      setAzureMetricResources(response.data);
    } catch (error) {
      console.error('Failed to load metric resources:', error);
    } finally {
      setLoadingAzure(false);
    }
  };

  const loadMetricDefinitions = async (resourceId: string) => {
    try {
      const response = await getMetricDefinitions(resourceId);
      setAzureMetricDefs(response.data);
    } catch (error) {
      console.error('Failed to load metric definitions:', error);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  // Auto-fetch data when switching to mapping tab and data hasn't been loaded
  useEffect(() => {
    if (activeTab === 'mapping' && !previewData && dataProviderType !== 'None') {
      // Auto-load data for mapping tab
      if (dataProviderType === 'Static') {
        // For static, parse and use JSON directly
        try {
          const parsed = JSON.parse(staticJsonText);
          setPreviewData(parsed);
          // Run AI suggestion
          const suggestion = suggestWidgetConfig(parsed);
          if (suggestion.suggestedType || suggestion.suggestedMappings) {
            setAiSuggestion(suggestion);
          }
        } catch {
          // Invalid JSON, user needs to fix it
        }
      } else if (hasProviderConfig()) {
        // For other providers, auto-test to fetch data
        handleAutoFetchData();
      }
    }
  }, [activeTab]);

  // Check if provider has enough config to fetch data
  const hasProviderConfig = () => {
    switch (dataProviderType) {
      case 'ApiEndpoint':
        return !!(dataProviderConfig.url || selectedProviderId);
      case 'DatabaseQuery':
        return !!(dataProviderConfig.query || selectedProviderId);
      case 'AzureMetrics':
        return !!(dataProviderConfig.resourceId || selectedProviderId);
      case 'AzureLogAnalytics':
        return !!((dataProviderConfig.workspaceId && dataProviderConfig.query) || selectedProviderId);
      case 'AppInsights':
        return !!(dataProviderConfig.appInsightsId || dataProviderConfig.resourceId || selectedProviderId);
      case 'Excel':
        return !!selectedProviderId;
      default:
        return !!selectedProviderId;
    }
  };

  // Auto-fetch data without showing test results
  const handleAutoFetchData = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const testConfig = { ...dataProviderConfig };
      if (dataProviderType === 'Static') {
        const parsed = JSON.parse(staticJsonText);
        testConfig.staticData = parsed;
        testConfig.data = parsed;
      }
      
      const response = await testDataProvider({
        dataProviderType,
        dataProviderConfig: JSON.stringify(testConfig)
      });
      setPreviewData(response.data);
      
      // Run AI suggestion
      const suggestion = suggestWidgetConfig(response.data);
      if (suggestion.suggestedType || suggestion.suggestedMappings) {
        setAiSuggestion(suggestion);
      }
    } catch (err) {
      console.error('Auto-fetch failed:', err);
    } finally {
      setTesting(false);
    }
  };

  // Call backend AI to get widget suggestions
  const getAISuggestions = async (data: unknown, currentWidgetType: string) => {
    setAiLoading(true);
    try {
      // First try to get AI analysis for widget type suggestion
      const analysisResult = await aiService.analyzeData(data, currentWidgetType);
      
      // Then get field mappings for the suggested widget type
      const targetWidgetType = analysisResult.suggestedWidgetType || currentWidgetType;
      const mappingResult = await aiService.suggestMappings(data, targetWidgetType);
      
      if (analysisResult.success || mappingResult.success) {
        setAiSuggestion({
          suggestedType: analysisResult.suggestedWidgetType,
          suggestedMappings: mappingResult.mappings || {},
          isFromAI: analysisResult.isFromAI || mappingResult.isFromAI,
          explanation: mappingResult.explanation,
        });
        
        // Auto-apply mappings if we have them and AI suggests it
        if (mappingResult.success && mappingResult.mappings && Object.keys(mappingResult.mappings).length > 0) {
          // Convert AI mappings to internal format
          const fieldMappings: Record<string, { path: string; type: string; sampleValue?: unknown }> = {};
          for (const [targetField, sourcePath] of Object.entries(mappingResult.mappings)) {
            if (sourcePath) {
              fieldMappings[targetField] = {
                path: sourcePath,
                type: 'string',
              };
            }
          }
          
          // Update data mapping with AI suggestions
          setDataMapping({
            dataPath: Array.isArray(data) ? '$' : '$',
            fieldMappings,
          });
        }
      } else {
        // Fall back to local heuristics
        const fallbackSuggestion = suggestWidgetConfig(data);
        if (fallbackSuggestion.suggestedType || fallbackSuggestion.suggestedMappings) {
          setAiSuggestion({
            ...fallbackSuggestion,
            isFromAI: false,
          });
        }
      }
    } catch (err) {
      console.error('AI suggestion failed, using fallback:', err);
      // Fall back to local heuristics on error
      const fallbackSuggestion = suggestWidgetConfig(data);
      if (fallbackSuggestion.suggestedType || fallbackSuggestion.suggestedMappings) {
        setAiSuggestion({
          ...fallbackSuggestion,
          isFromAI: false,
        });
      }
    } finally {
      setAiLoading(false);
    }
  };

  const loadProviders = async () => {
    try {
      const response = await getDataProviders();
      setSavedProviders(response.data);
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Parse static JSON if using Static provider
      const finalDataProviderConfig = { ...dataProviderConfig };
      if (dataProviderType === 'Static') {
        try {
          finalDataProviderConfig.staticData = JSON.parse(staticJsonText);
          // Also set 'data' key for backend compatibility
          finalDataProviderConfig.data = finalDataProviderConfig.staticData;
        } catch {
          alert('Invalid JSON in Static Data field');
          setSaving(false);
          return;
        }
      }
      
      await updateWidget(widget.id, {
        title,
        subtitle: subtitle || undefined,
        widgetType,
        dataProviderType,
        dataProviderConfigId: selectedProviderId,
        dataProviderConfig: finalDataProviderConfig,
        widgetConfig: {
          ...widgetConfig,
          dataMapping: dataMapping.dataPath ? dataMapping : undefined,
        },
        refreshIntervalSeconds,
      });
      onSaved();
    } catch (err) {
      console.error('Failed to save widget:', err);
      alert('Failed to save widget');
    } finally {
      setSaving(false);
    }
  };

  const handleTestDataProvider = async () => {
    setTesting(true);
    setTestResult(null);
    setAiSuggestion(null);
    try {
      // Build proper config for test
      const testConfig = { ...dataProviderConfig };
      if (dataProviderType === 'Static') {
        try {
          const parsed = JSON.parse(staticJsonText);
          testConfig.staticData = parsed;
          testConfig.data = parsed; // Backend expects 'data' key
        } catch {
          setTestResult({ success: false, error: 'Invalid JSON in Static Data field' });
          setTesting(false);
          return;
        }
      }
      
      const response = await testDataProvider({
        dataProviderType,
        dataProviderConfig: JSON.stringify(testConfig)
      });
      setTestResult({ success: true, data: response.data });
      setPreviewData(response.data);
      
      // Get AI suggestions from backend (non-blocking)
      getAISuggestions(response.data, widgetType);
    } catch (err) {
      setTestResult({ 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to fetch data' 
      });
    } finally {
      setTesting(false);
    }
  };

  const updateDataProviderConfigField = (field: string, value: unknown) => {
    setDataProviderConfig(prev => ({ ...prev, [field]: value }));
  };

  const updateWidgetConfigField = (field: string, value: unknown) => {
    setWidgetConfig(prev => ({ ...prev, [field]: value }));
  };

  const tabs = [
    { id: 'basic', label: 'Basic', icon: Settings },
    { id: 'data', label: 'Data Provider', icon: Database },
    { id: 'mapping', label: 'Data Mapping', icon: Map },
    { id: 'display', label: 'Display', icon: Eye },
    { id: 'preview', label: 'Preview', icon: Play },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Edit Widget
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure widget settings and data provider
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Basic Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Widget Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  placeholder="Enter widget title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subtitle (optional)
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  placeholder="Enter subtitle or description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Widget Type
                </label>
                <select
                  value={widgetType}
                  onChange={(e) => setWidgetType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                >
                  {WIDGET_TYPES.map(wt => (
                    <option key={wt.value} value={wt.value}>
                      {wt.label} - {wt.description}
                    </option>
                  ))}
                </select>
                {widgetType !== widget.widgetType && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Changing widget type may affect data mappings
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Auto-Refresh Interval
                </label>
                <select
                  value={refreshIntervalSeconds}
                  onChange={(e) => setRefreshIntervalSeconds(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                >
                  <option value={0}>Manual refresh only</option>
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every minute</option>
                  <option value={300}>Every 5 minutes</option>
                  <option value={600}>Every 10 minutes</option>
                  <option value={1800}>Every 30 minutes</option>
                  <option value={3600}>Every hour</option>
                </select>
              </div>
            </div>
          )}

          {/* Data Provider Tab */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Data Provider Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {DATA_PROVIDER_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setDataProviderType(option.value)}
                      className={clsx(
                        'flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all',
                        dataProviderType === option.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      )}
                    >
                      <option.icon className={clsx(
                        'w-5 h-5 mt-0.5',
                        dataProviderType === option.value ? 'text-blue-600' : 'text-gray-400'
                      )} />
                      <div>
                        <div className={clsx(
                          'font-medium text-sm',
                          dataProviderType === option.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                        )}>
                          {option.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {option.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Saved Provider Selection */}
              {savedProviders.length > 0 && dataProviderType !== 'None' && dataProviderType !== 'Static' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Use Saved Provider (Optional)
                  </label>
                  <select
                    value={selectedProviderId || ''}
                    onChange={(e) => setSelectedProviderId(e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  >
                    <option value="">Configure manually</option>
                    {savedProviders
                      .filter(p => p.providerType === dataProviderType)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.lastTestSuccessful === true && '✓'}
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}

              {/* Provider-specific Configuration */}
              {dataProviderType === 'Static' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Static Data (JSON)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        // Format JSON
                        try {
                          const parsed = JSON.parse(staticJsonText);
                          setStaticJsonText(JSON.stringify(parsed, null, 2));
                          setJsonError(null);
                        } catch (err) {
                          setJsonError('Invalid JSON - cannot format');
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Format JSON
                    </button>
                  </div>
                  <textarea
                    value={staticJsonText}
                    onChange={(e) => {
                      setStaticJsonText(e.target.value);
                      // Validate JSON on change
                      try {
                        JSON.parse(e.target.value);
                        setJsonError(null);
                      } catch {
                        setJsonError('Invalid JSON syntax');
                      }
                    }}
                    rows={12}
                    className={clsx(
                      "w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm resize-y",
                      jsonError 
                        ? 'border-red-300 dark:border-red-600 focus:ring-red-500' 
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    )}
                    placeholder='{\n  "value": 100,\n  "trend": 5,\n  "label": "Total Sales"\n}'
                    spellCheck={false}
                  />
                  {jsonError && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {jsonError}
                    </p>
                  )}
                  {!jsonError && staticJsonText && (
                    <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                      ✓ Valid JSON
                    </p>
                  )}
                </div>
              )}

              {dataProviderType === 'ApiEndpoint' && !selectedProviderId && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      API URL *
                    </label>
                    <input
                      type="text"
                      value={(dataProviderConfig.url as string) || ''}
                      onChange={(e) => updateDataProviderConfigField('url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      placeholder="https://api.example.com/data"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        HTTP Method
                      </label>
                      <select
                        value={(dataProviderConfig.method as string) || 'GET'}
                        onChange={(e) => updateDataProviderConfigField('method', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Data Path (JSONPath)
                      </label>
                      <input
                        type="text"
                        value={(dataProviderConfig.dataPath as string) || ''}
                        onChange={(e) => updateDataProviderConfigField('dataPath', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        placeholder="$.data or leave empty"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Headers (JSON)
                    </label>
                    <textarea
                      value={JSON.stringify(dataProviderConfig.headers || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          updateDataProviderConfigField('headers', JSON.parse(e.target.value));
                        } catch {}
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
                      placeholder='{"Authorization": "Bearer token"}'
                    />
                  </div>
                </div>
              )}

              {dataProviderType === 'DatabaseQuery' && !selectedProviderId && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Database Connection ID
                    </label>
                    <input
                      type="text"
                      value={(dataProviderConfig.connectionId as string) || ''}
                      onChange={(e) => updateDataProviderConfigField('connectionId', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      placeholder="Connection ID from database connections"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      SQL Query
                    </label>
                    <textarea
                      value={(dataProviderConfig.query as string) || ''}
                      onChange={(e) => updateDataProviderConfigField('query', e.target.value)}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
                      placeholder="SELECT * FROM MyTable WHERE ..."
                    />
                  </div>
                </div>
              )}

              {dataProviderType === 'AzureMetrics' && !selectedProviderId && (
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
                        updateDataProviderConfigField('resourceId', '');
                        updateDataProviderConfigField('metricName', '');
                      }}
                      placeholder="Select subscription..."
                      searchPlaceholder="Search subscriptions..."
                      loading={loadingAzure}
                    />
                  </div>

                  {/* Resource Selection */}
                  {!!selectedSubscription && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Resource
                      </label>
                      <SearchableSelect
                        options={azureMetricResources.map(res => ({
                          value: res.id,
                          label: res.name,
                          description: `${res.type.split('/').pop()} • ${res.resourceGroup}`,
                        }))}
                        value={(dataProviderConfig.resourceId as string) || ''}
                        onChange={(value) => {
                          updateDataProviderConfigField('resourceId', value);
                          updateDataProviderConfigField('metricName', '');
                        }}
                        placeholder="Select resource..."
                        searchPlaceholder="Search resources..."
                        loading={loadingAzure}
                        maxDisplayed={30}
                      />
                    </div>
                  )}

                  {/* Metric Selection */}
                  {!!(dataProviderConfig.resourceId as string) && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Metric
                        </label>
                        <SearchableSelect
                          options={azureMetricDefs.map(m => ({
                            value: m.name,
                            label: m.displayName || m.name,
                            description: m.unit,
                          }))}
                          value={(dataProviderConfig.metricName as string) || ''}
                          onChange={(value) => updateDataProviderConfigField('metricName', value)}
                          placeholder="Select metric..."
                          searchPlaceholder="Search metrics..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Aggregation
                        </label>
                        <select
                          value={(dataProviderConfig.aggregation as string) || 'Average'}
                          onChange={(e) => updateDataProviderConfigField('aggregation', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        >
                          {(azureMetricDefs.find(m => m.name === dataProviderConfig.metricName)?.aggregations || ['Average', 'Maximum', 'Minimum', 'Total', 'Count']).map(agg => (
                            <option key={agg} value={agg}>{agg}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
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
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Granularity
                      </label>
                      <select
                        value={(dataProviderConfig.granularity as string) || 'PT5M'}
                        onChange={(e) => updateDataProviderConfigField('granularity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
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
                </div>
              )}

              {/* Azure Log Analytics Configuration */}
              {dataProviderType === 'AzureLogAnalytics' && !selectedProviderId && (
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
                </div>
              )}

              {/* Application Insights Configuration */}
              {dataProviderType === 'AppInsights' && !selectedProviderId && (
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
                  {!!selectedSubscription && (
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
                        searchPlaceholder="Search App Insights..."
                        loading={loadingAzure}
                      />
                    </div>
                  )}

                  {/* Metric Selection */}
                  {!!(dataProviderConfig.appInsightsId as string) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Metrics to Fetch
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'requests/count', label: 'Request Count' },
                          { value: 'requests/duration', label: 'Request Duration' },
                          { value: 'requests/failed', label: 'Failed Requests' },
                          { value: 'exceptions/count', label: 'Exception Count' },
                          { value: 'dependencies/count', label: 'Dependencies' },
                          { value: 'dependencies/failed', label: 'Failed Dependencies' },
                          { value: 'pageViews/count', label: 'Page Views' },
                          { value: 'performanceCounters/processorCpuPercentage', label: 'CPU %' },
                        ].map(metric => (
                          <label key={metric.value} className="flex items-center gap-2 p-2 rounded border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                            <input
                              type="checkbox"
                              checked={((dataProviderConfig.metricNames as string[]) || []).includes(metric.value)}
                              onChange={(e) => {
                                const currentMetrics = (dataProviderConfig.metricNames as string[]) || [];
                                if (e.target.checked) {
                                  updateDataProviderConfigField('metricNames', [...currentMetrics, metric.value]);
                                } else {
                                  updateDataProviderConfigField('metricNames', currentMetrics.filter(m => m !== metric.value));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">{metric.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
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
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Granularity
                      </label>
                      <select
                        value={(dataProviderConfig.granularity as string) || 'PT5M'}
                        onChange={(e) => updateDataProviderConfigField('granularity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
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
                </div>
              )}

              {dataProviderType === 'SignalR' && !selectedProviderId && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Hub URL
                    </label>
                    <input
                      type="text"
                      value={(dataProviderConfig.hubUrl as string) || ''}
                      onChange={(e) => updateDataProviderConfigField('hubUrl', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      placeholder="/hubs/dashboard"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={(dataProviderConfig.eventName as string) || ''}
                      onChange={(e) => updateDataProviderConfigField('eventName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      placeholder="ReceiveData"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Mapping Tab */}
          {activeTab === 'mapping' && (
            <div className="space-y-6">
              {/* Loading State */}
              {testing && (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading data from provider...</span>
                </div>
              )}

              {/* Provider Config Notice */}
              {!testing && !previewData && dataProviderType !== 'None' && dataProviderType !== 'Static' && !hasProviderConfig() && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Configure data provider first
                      </h4>
                      <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                        Go to the "Data Provider" tab and configure your data source, 
                        then return here to map the data fields.
                      </p>
                      <button
                        onClick={() => setActiveTab('data')}
                        className="mt-2 text-xs text-amber-700 dark:text-amber-300 underline hover:no-underline"
                      >
                        Go to Data Provider tab →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Keys Display & AI Auto-Map */}
              {!testing && previewData !== null && previewData !== undefined && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <span className="font-medium text-purple-700 dark:text-purple-300">AI Data Mapping</span>
                    </div>
                    <button
                      onClick={() => {
                        const autoMappings = generateAutoMappings(widgetType, previewData);
                        setDataMapping(autoMappings);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Wand2 className="w-4 h-4" />
                      Auto-Map Fields
                    </button>
                  </div>
                  
                  {/* Show detected keys */}
                  <DetectedKeysDisplay data={previewData} />

                  {/* AI Suggestion for widget type */}
                  {aiSuggestion?.suggestedType && aiSuggestion.suggestedType !== widgetType && (
                    <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                      <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">
                        Suggested widget type for this data:
                      </p>
                      <button
                        onClick={() => {
                          setWidgetType(aiSuggestion.suggestedType!);
                          // Re-generate mappings for new widget type
                          const autoMappings = generateAutoMappings(aiSuggestion.suggestedType!, previewData);
                          setDataMapping(autoMappings);
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 text-sm rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30"
                      >
                        Switch to {WIDGET_TYPES.find(w => w.value === aiSuggestion.suggestedType)?.label || aiSuggestion.suggestedType}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Widget Data Requirements Info */}
              {!testing && WIDGET_DATA_REQUIREMENTS[widgetType] ? (
                <DataFieldMapper
                  widgetType={widgetType}
                  data={previewData || (dataProviderType === 'Static' ? (() => { try { return JSON.parse(staticJsonText); } catch { return null; } })() : null)}
                  value={dataMapping}
                  onChange={setDataMapping}
                />
              ) : !testing && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                  <Database className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Generic Widget Type
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    This widget type doesn't have predefined data requirements. 
                    Configure the data mapping manually in the Display tab.
                  </p>
                </div>
              )}

              {/* Visual Mapping Summary */}
              {!testing && Object.keys(dataMapping.fieldMappings).length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="font-medium text-green-700 dark:text-green-300">
                      {aiSuggestion?.isFromAI ? 'AI Mapped Fields' : 'Mapped Fields'}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300 rounded-full">
                      {Object.keys(dataMapping.fieldMappings).length} fields
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(dataMapping.fieldMappings).map(([field, mapping]) => (
                      <div key={field} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{field}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <code className="text-xs font-mono text-green-600 dark:text-green-400 truncate">
                          {mapping.path?.replace(/^\$\.?/, '') || 'N/A'}
                        </code>
                        {mapping.sampleValue !== undefined && (
                          <span className="text-xs text-gray-400 truncate ml-auto">
                            ({String(mapping.sampleValue).slice(0, 20)})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              {!testing && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {dataMapping.dataPath ? (
                      <span className="text-green-600 dark:text-green-400">
                        ✓ Data source mapped: <code className="font-mono">{dataMapping.dataPath}</code>
                        {Object.keys(dataMapping.fieldMappings).length > 0 && (
                          <span className="ml-2">
                            ({Object.keys(dataMapping.fieldMappings).length} fields)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span>No data mapping configured yet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {previewData !== null && previewData !== undefined && (
                      <button
                        onClick={() => {
                          const autoMappings = generateAutoMappings(widgetType, previewData);
                          setDataMapping(autoMappings);
                        }}
                        className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
                      >
                        Re-apply AI mappings
                      </button>
                    )}
                    {dataMapping.dataPath && (
                      <button
                        onClick={() => setDataMapping({ dataPath: '', fieldMappings: {} })}
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        Clear all mappings
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Widget Type: {widget.widgetType}
                </h4>
                <p className="text-xs text-blue-600 dark:text-blue-300">
                  Configure how data is displayed in this widget.
                </p>
              </div>

              {/* Common display options */}
              {(widget.widgetType === 'metric-card' || widget.widgetType === 'kpi') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Value Field
                      </label>
                      <input
                        type="text"
                        value={(widgetConfig.valueField as string) || 'value'}
                        onChange={(e) => updateWidgetConfigField('valueField', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        placeholder="value"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Trend Field
                      </label>
                      <input
                        type="text"
                        value={(widgetConfig.trendField as string) || 'change'}
                        onChange={(e) => updateWidgetConfigField('trendField', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        placeholder="change"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Prefix
                      </label>
                      <input
                        type="text"
                        value={(widgetConfig.prefix as string) || ''}
                        onChange={(e) => updateWidgetConfigField('prefix', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        placeholder="$"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Suffix
                      </label>
                      <input
                        type="text"
                        value={(widgetConfig.suffix as string) || ''}
                        onChange={(e) => updateWidgetConfigField('suffix', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        placeholder="%"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Decimals
                      </label>
                      <input
                        type="number"
                        value={(widgetConfig.decimals as number) ?? 0}
                        onChange={(e) => updateWidgetConfigField('decimals', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        min={0}
                        max={6}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Color Scheme
                    </label>
                    <select
                      value={(widgetConfig.colorScheme as string) || 'blue'}
                      onChange={(e) => updateWidgetConfigField('colorScheme', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    >
                      <option value="blue">Blue</option>
                      <option value="green">Green</option>
                      <option value="red">Red</option>
                      <option value="amber">Amber</option>
                      <option value="purple">Purple</option>
                    </select>
                  </div>
                </div>
              )}

              {(widget.widgetType.includes('chart') || widget.widgetType === 'doughnut-chart') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Label Field
                      </label>
                      <input
                        type="text"
                        value={(widgetConfig.labelField as string) || 'label'}
                        onChange={(e) => updateWidgetConfigField('labelField', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        placeholder="label"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Value Field
                      </label>
                      <input
                        type="text"
                        value={(widgetConfig.valueField as string) || 'value'}
                        onChange={(e) => updateWidgetConfigField('valueField', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        placeholder="value"
                      />
                    </div>
                  </div>
                  {widget.widgetType === 'line-chart' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="fill"
                        checked={(widgetConfig.fill as boolean) ?? true}
                        onChange={(e) => updateWidgetConfigField('fill', e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="fill" className="text-sm text-gray-700 dark:text-gray-300">
                        Fill area under line
                      </label>
                    </div>
                  )}
                </div>
              )}

              {widget.widgetType === 'data-table' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Columns Configuration (JSON)
                    </label>
                    <textarea
                      value={JSON.stringify(widgetConfig.columns || [], null, 2)}
                      onChange={(e) => {
                        try {
                          updateWidgetConfigField('columns', JSON.parse(e.target.value));
                        } catch {}
                      }}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
                      placeholder='[{"key": "name", "label": "Name"}, {"key": "value", "label": "Value"}]'
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Page Size
                    </label>
                    <input
                      type="number"
                      value={(widgetConfig.pageSize as number) || 10}
                      onChange={(e) => updateWidgetConfigField('pageSize', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      min={5}
                      max={100}
                    />
                  </div>
                </div>
              )}

              {widget.widgetType === 'status-list' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Name Field
                      </label>
                      <input
                        type="text"
                        value={(widgetConfig.nameField as string) || 'name'}
                        onChange={(e) => updateWidgetConfigField('nameField', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status Field
                      </label>
                      <input
                        type="text"
                        value={(widgetConfig.statusField as string) || 'status'}
                        onChange={(e) => updateWidgetConfigField('statusField', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Raw config editor for advanced users */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <details>
                  <summary className="text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                    Advanced: Raw Configuration JSON
                  </summary>
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={rawConfigText}
                      onChange={(e) => {
                        const text = e.target.value;
                        setRawConfigText(text);
                        try {
                          const parsed = JSON.parse(text);
                          setWidgetConfig(parsed);
                          setRawConfigError(null);
                        } catch (err) {
                          setRawConfigError((err as Error).message);
                        }
                      }}
                      rows={8}
                      className={clsx(
                        "w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm",
                        rawConfigError 
                          ? "border-red-500 dark:border-red-400" 
                          : "border-gray-300 dark:border-gray-600"
                      )}
                    />
                    {rawConfigError && (
                      <p className="text-xs text-red-500">{rawConfigError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const formatted = JSON.stringify(widgetConfig, null, 2);
                          setRawConfigText(formatted);
                          setRawConfigError(null);
                        }}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-500"
                      >
                        Format JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRawConfigText('{}');
                          setWidgetConfig({});
                          setRawConfigError(null);
                        }}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-500"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="space-y-6">
              {/* Live Widget Preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Live Widget Preview
                  </h4>
                  <button
                    onClick={() => setShowFullPreview(!showFullPreview)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <Maximize2 className="w-3 h-3" />
                    {showFullPreview ? 'Compact' : 'Expand'}
                  </button>
                </div>
                <div className={clsx(
                  'border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden transition-all',
                  showFullPreview ? 'h-80' : 'h-48'
                )}>
                  <div className="p-4 h-full">
                    <WidgetRenderer 
                      widget={{
                        ...widget,
                        title,
                        subtitle,
                        widgetConfig,
                        dataProviderConfig,
                        dataProviderType,
                      }}
                      data={previewData || (dataProviderType === 'Static' ? dataProviderConfig.staticData : widget.cachedData)}
                      isLoading={testing}
                    />
                  </div>
                </div>
              </div>

              {/* Test Data Provider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Test Data Provider
                  </h4>
                  <div className="flex items-center gap-2">
                    {previewData !== null && (
                      <button
                        onClick={() => setPreviewData(null)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Clear Preview
                      </button>
                    )}
                    <button
                      onClick={handleTestDataProvider}
                      disabled={testing || dataProviderType === 'None'}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                        testing || dataProviderType === 'None'
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      )}
                    >
                      {testing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Test & Preview
                    </button>
                  </div>
                </div>

                {/* Test Result */}
                {testResult && (
                  <div className={clsx(
                    'rounded-lg border p-4',
                    testResult.success
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {testResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className={clsx(
                        'font-medium',
                        testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                      )}>
                        {testResult.success ? 'Data fetched successfully!' : 'Failed to fetch data'}
                      </span>
                    </div>
                    
                    {testResult.error && (
                      <p className="text-sm text-red-600 dark:text-red-400">{testResult.error}</p>
                    )}
                    
                    {testResult.success && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Widget preview updated with live data above.
                      </p>
                    )}
                    
                    {testResult.data !== undefined && testResult.data !== null && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          Show raw response data
                        </summary>
                        <pre className="mt-2 text-xs bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-auto max-h-32">
                          {JSON.stringify(testResult.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
                
                {/* AI Loading */}
                {aiLoading && (
                  <div className="mt-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin" />
                      <span className="font-medium text-purple-700 dark:text-purple-300">AI analyzing data...</span>
                    </div>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                      Getting smart suggestions for widget configuration
                    </p>
                  </div>
                )}
                
                {/* AI Suggestions */}
                {!aiLoading && aiSuggestion && (aiSuggestion.suggestedType || aiSuggestion.suggestedMappings) && (
                  <div className="mt-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <span className="font-medium text-purple-700 dark:text-purple-300">
                          {aiSuggestion.isFromAI ? 'AI Suggestions' : 'Smart Suggestions'}
                        </span>
                      </div>
                      {aiSuggestion.isFromAI && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-600 dark:text-purple-300 rounded-full">
                          AI Powered
                        </span>
                      )}
                    </div>
                    
                    {aiSuggestion.explanation && (
                      <p className="text-sm text-purple-600 dark:text-purple-400 mb-3 italic">
                        "{aiSuggestion.explanation}"
                      </p>
                    )}
                    
                    {aiSuggestion.suggestedType && aiSuggestion.suggestedType !== widgetType && (
                      <div className="mb-3">
                        <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                          Based on your data structure, consider using:
                        </p>
                        <button
                          onClick={() => {
                            setWidgetType(aiSuggestion.suggestedType!);
                            setActiveTab('basic');
                          }}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                        >
                          <Wand2 className="w-4 h-4" />
                          Switch to {WIDGET_TYPES.find(w => w.value === aiSuggestion.suggestedType)?.label || aiSuggestion.suggestedType}
                        </button>
                      </div>
                    )}
                    
                    {aiSuggestion.suggestedMappings && Object.keys(aiSuggestion.suggestedMappings).length > 0 && (
                      <div>
                        <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                          Detected field mappings:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(aiSuggestion.suggestedMappings).map(([field, path]) => (
                            path && (
                              <span key={field} className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-purple-200 dark:border-purple-700 text-xs">
                                <span className="font-medium text-purple-700 dark:text-purple-300">{field}:</span>
                                <code className="text-gray-600 dark:text-gray-400">{path}</code>
                              </span>
                            )
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            // Apply suggested mappings to widget config
                            const newConfig = { ...widgetConfig };
                            Object.entries(aiSuggestion.suggestedMappings!).forEach(([field, path]) => {
                              if (path) {
                                newConfig[field + 'Field'] = path;
                              }
                            });
                            setWidgetConfig(newConfig);
                            setActiveTab('display');
                          }}
                          className="mt-2 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 underline"
                        >
                          Apply these mappings →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Current Configuration Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Configuration Summary
                </h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block">Widget Type:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{widget.widgetType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Provider Type:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{dataProviderType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Auto-Refresh:</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">
                      {refreshIntervalSeconds === 0 ? 'Manual' : `Every ${refreshIntervalSeconds}s`}
                    </span>
                  </div>
                  {selectedProviderId && (
                    <div>
                      <span className="text-gray-500 block">Saved Provider:</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">
                        {savedProviders.find(p => p.id === selectedProviderId)?.name || 'Selected'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title}
            className={clsx(
              'flex items-center gap-2 px-6 py-2 rounded-lg font-medium',
              saving || !title
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditWidgetModal;
