import { LucideIcon } from 'lucide-react';
import { Database, Globe, Cloud, Terminal, Cpu, Zap, Code, FileJson, Hash } from 'lucide-react';

export type DataProviderType = 
  | 'None' 
  | 'Static' 
  | 'ApiEndpoint' 
  | 'DatabaseQuery' 
  | 'AzureMetrics' 
  | 'AzureLogAnalytics' 
  | 'AppInsights' 
  | 'SignalR' 
  | 'Custom';

export interface DataProviderOption {
  type: DataProviderType;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export interface WidgetConfigProps {
  config: Record<string, unknown>;
  setConfig: (config: Record<string, unknown>) => void;
  dataProviderType: DataProviderType;
  setDataProviderType: (type: DataProviderType) => void;
  dataProviderConfig: Record<string, unknown>;
  setDataProviderConfig: (config: Record<string, unknown>) => void;
}

// All available data providers
export const ALL_DATA_PROVIDERS: DataProviderOption[] = [
  { type: 'Static', name: 'Static Data', description: 'Enter JSON data directly', icon: FileJson, color: 'text-gray-600' },
  { type: 'ApiEndpoint', name: 'API Endpoint', description: 'Fetch from REST API', icon: Globe, color: 'text-blue-600' },
  { type: 'DatabaseQuery', name: 'Database Query', description: 'Run SQL query', icon: Database, color: 'text-green-600' },
  { type: 'AzureMetrics', name: 'Azure Metrics', description: 'Azure Monitor metrics', icon: Cloud, color: 'text-cyan-600' },
  { type: 'AzureLogAnalytics', name: 'Log Analytics', description: 'Azure Log Analytics query', icon: Terminal, color: 'text-purple-600' },
  { type: 'AppInsights', name: 'App Insights', description: 'Application Insights data', icon: Cpu, color: 'text-pink-600' },
  { type: 'SignalR', name: 'Real-time (SignalR)', description: 'Live streaming data', icon: Zap, color: 'text-yellow-600' },
  { type: 'Custom', name: 'Custom Script', description: 'Custom JavaScript function', icon: Code, color: 'text-orange-600' },
  { type: 'None', name: 'No Data Provider', description: 'Configure later', icon: Hash, color: 'text-gray-400' },
];

// Widget type to recommended data providers mapping
export const WIDGET_DATA_PROVIDERS: Record<string, DataProviderType[]> = {
  // Metrics & KPI - numeric data sources
  'metric-card': ['Static', 'ApiEndpoint', 'DatabaseQuery', 'AzureMetrics', 'AppInsights', 'SignalR'],
  'kpi': ['Static', 'ApiEndpoint', 'DatabaseQuery', 'AzureMetrics', 'AppInsights', 'SignalR'],
  'gauge': ['Static', 'ApiEndpoint', 'DatabaseQuery', 'AzureMetrics', 'SignalR'],
  
  // Charts - time series and aggregated data
  'line-chart': ['ApiEndpoint', 'DatabaseQuery', 'AzureMetrics', 'AzureLogAnalytics', 'AppInsights'],
  'bar-chart': ['ApiEndpoint', 'DatabaseQuery', 'AzureLogAnalytics', 'AppInsights', 'Static'],
  'area-chart': ['ApiEndpoint', 'DatabaseQuery', 'AzureMetrics', 'AzureLogAnalytics'],
  'doughnut-chart': ['ApiEndpoint', 'DatabaseQuery', 'AzureLogAnalytics', 'Static'],
  
  // Tables & Lists - tabular data
  'data-table': ['ApiEndpoint', 'DatabaseQuery', 'AzureLogAnalytics', 'Static'],
  'status-list': ['ApiEndpoint', 'DatabaseQuery', 'SignalR', 'Static'],
  'timeline': ['ApiEndpoint', 'DatabaseQuery', 'AzureLogAnalytics', 'AppInsights'],
  
  // Azure specific
  'azure-metrics': ['AzureMetrics'],
  
  // Monitoring & Logs
  'logs-viewer': ['AzureLogAnalytics', 'AppInsights', 'ApiEndpoint', 'SignalR'],
  
  // Advanced
  'map': ['ApiEndpoint', 'DatabaseQuery', 'Static'],
  'custom-html': ['Custom', 'Static', 'ApiEndpoint'],
};

// Get filtered data providers for a widget type
export function getDataProvidersForWidget(widgetType: string): DataProviderOption[] {
  const allowed = WIDGET_DATA_PROVIDERS[widgetType] || [];
  const providers = ALL_DATA_PROVIDERS.filter(p => allowed.includes(p.type));
  // Always include 'None' option at the end
  const none = ALL_DATA_PROVIDERS.find(p => p.type === 'None');
  if (none && !providers.find(p => p.type === 'None')) {
    providers.push(none);
  }
  return providers;
}

// Default configurations for widget types
export const DEFAULT_WIDGET_CONFIGS: Record<string, Record<string, unknown>> = {
  'metric-card': {
    valueField: 'value',
    labelField: 'label',
    format: 'number',
    prefix: '',
    suffix: '',
    showTrend: false,
    trendField: 'trend',
  },
  'kpi': {
    valueField: 'value',
    targetField: 'target',
    format: 'number',
    showTarget: true,
    showProgress: true,
    thresholds: { warning: 70, critical: 90 },
  },
  'gauge': {
    valueField: 'value',
    minValue: 0,
    maxValue: 100,
    unit: '%',
    thresholds: { warning: 70, critical: 90 },
  },
  'line-chart': {
    xAxisField: 'timestamp',
    yAxisField: 'value',
    seriesField: 'series',
    showLegend: true,
    showGrid: true,
    lineType: 'smooth',
  },
  'bar-chart': {
    xAxisField: 'category',
    yAxisField: 'value',
    orientation: 'vertical',
    showLegend: true,
    stacked: false,
  },
  'doughnut-chart': {
    labelField: 'label',
    valueField: 'value',
    showLegend: true,
    showLabels: true,
    innerRadius: 60,
  },
  'area-chart': {
    xAxisField: 'timestamp',
    yAxisField: 'value',
    seriesField: 'series',
    showLegend: true,
    filled: true,
  },
  'data-table': {
    columns: [],
    pageSize: 10,
    sortable: true,
    filterable: true,
    showPagination: true,
  },
  'status-list': {
    nameField: 'name',
    statusField: 'status',
    messageField: 'message',
    timestampField: 'timestamp',
    maxItems: 10,
  },
  'timeline': {
    timestampField: 'timestamp',
    titleField: 'title',
    descriptionField: 'description',
    typeField: 'type',
    maxItems: 20,
  },
  'logs-viewer': {
    timestampField: 'timestamp',
    levelField: 'level',
    messageField: 'message',
    maxLines: 100,
    autoScroll: true,
    showFilters: true,
  },
  'azure-metrics': {
    resourceId: '',
    metricName: '',
    aggregation: 'Average',
    timespan: 'PT1H',
    interval: 'PT5M',
  },
  'map': {
    latField: 'latitude',
    lngField: 'longitude',
    labelField: 'name',
    zoom: 10,
  },
  'custom-html': {
    template: '',
    script: '',
  },
};
