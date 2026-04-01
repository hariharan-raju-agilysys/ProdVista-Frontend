import { useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle, 
  XCircle, Clock, AlertTriangle, Activity, MapPin
} from 'lucide-react';
import clsx from 'clsx';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { DashboardWidget } from '../../services/dynamicDashboardService';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Data Mapping types and utilities
interface FieldMapping {
  path: string;
  type: string;
  sampleValue?: unknown;
}

interface DataMapping {
  dataPath: string;
  fieldMappings: Record<string, FieldMapping>;
}

// Extract value at a JSON path
function getValueAtPath(data: unknown, path: string): unknown {
  if (!path || path === '$' || !data) return data;
  
  // Parse path like "$.items[0].name" or "$.data.value"
  const parts = path.replace(/^\$\.?/, '').split(/\.|\[|\]/).filter(Boolean);
  let current: unknown = data;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const key = part.replace(/^['"]|['"]$/g, '');
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}

// Apply data mapping to transform raw data
function applyDataMapping(data: unknown, mapping?: DataMapping): unknown {
  if (!mapping || !mapping.dataPath) return data;
  
  // Extract data from the specified path
  let extractedData = getValueAtPath(data, mapping.dataPath);
  
  // If no field mappings, return extracted data as-is
  if (!mapping.fieldMappings || Object.keys(mapping.fieldMappings).length === 0) {
    return extractedData;
  }
  
  // Apply field mappings
  if (Array.isArray(extractedData)) {
    // For arrays, map each item
    return extractedData.map((item) => {
      const mappedItem: Record<string, unknown> = {};
      
      for (const [targetField, fieldMapping] of Object.entries(mapping.fieldMappings)) {
        // Skip if fieldMapping or path is undefined
        if (!fieldMapping || typeof fieldMapping.path !== 'string') continue;
        
        // Extract the field name from the path (e.g., "$.data.items.name" -> "name")
        const fieldPath = fieldMapping.path.replace(mapping.dataPath + '.', '').replace(/^\$\.?/, '');
        mappedItem[targetField] = getValueAtPath(item, fieldPath) ?? item[fieldPath as keyof typeof item];
      }
      
      // Include original fields not in mapping
      return { ...item, ...mappedItem };
    });
  } else if (typeof extractedData === 'object' && extractedData !== null) {
    // For single objects
    const mappedObject: Record<string, unknown> = {};
    
    for (const [targetField, fieldMapping] of Object.entries(mapping.fieldMappings)) {
      // Skip if fieldMapping or path is undefined
      if (!fieldMapping || typeof fieldMapping.path !== 'string') continue;
      
      const fieldPath = fieldMapping.path.replace(mapping.dataPath + '.', '').replace(/^\$\.?/, '');
      mappedObject[targetField] = getValueAtPath(extractedData, fieldPath) ?? (extractedData as Record<string, unknown>)[fieldPath];
    }
    
    return { ...extractedData, ...mappedObject };
  }
  
  return extractedData;
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface WidgetRendererProps {
  widget: DashboardWidget;
  data?: unknown;
  isLoading?: boolean;
}

// Widget config interfaces
interface MetricCardConfig {
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trendField?: string;
  valueField?: string;
  colorScheme?: 'blue' | 'green' | 'red' | 'amber' | 'purple';
}

interface ChartConfig {
  labelField?: string;
  valueField?: string;
  datasetLabel?: string;
  colors?: string[];
  fill?: boolean;
  stacked?: boolean;
}

interface TableConfig {
  columns?: { key: string; label: string; width?: string }[];
  pageSize?: number;
}

interface MapConfig {
  center?: [number, number];
  zoom?: number;
  markers?: { lat: number; lng: number; label?: string; popup?: string }[];
  latField?: string;
  lngField?: string;
  labelField?: string;
  popupField?: string;
  tileLayer?: 'osm' | 'carto-light' | 'carto-dark' | 'esri';
}

interface StatusListConfig {
  nameField?: string;
  statusField?: string;
  statusColors?: Record<string, string>;
}

export function WidgetRenderer({ widget, data, isLoading }: WidgetRendererProps) {
  const config = widget.widgetConfig as Record<string, unknown>;
  
  // Apply data mapping if configured
  const mappedData = useMemo(() => {
    const mapping = config?.dataMapping as DataMapping | undefined;
    return applyDataMapping(data, mapping);
  }, [data, config?.dataMapping]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="mt-2 h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!data && !mappedData && widget.dataProviderType === 'None') {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No data source configured</p>
        </div>
      </div>
    );
  }

  // Use mapped data for rendering
  const renderData = mappedData ?? data;

  switch (widget.widgetType) {
    case 'metric-card':
      return <MetricCardWidget data={renderData} config={config as MetricCardConfig} />;
    case 'kpi':
      return <KPIWidget data={renderData} config={config} />;
    case 'gauge':
      return <GaugeWidget data={renderData} config={config} />;
    case 'line-chart':
      return <LineChartWidget data={renderData} config={config as ChartConfig} />;
    case 'bar-chart':
      return <BarChartWidget data={renderData} config={config as ChartConfig} />;
    case 'doughnut-chart':
      return <DoughnutChartWidget data={renderData} config={config as ChartConfig} />;
    case 'data-table':
      return <DataTableWidget data={renderData} config={config as TableConfig} />;
    case 'status-list':
      return <StatusListWidget data={renderData} config={config as StatusListConfig} />;
    case 'timeline':
      return <TimelineWidget data={renderData} config={config} />;
    case 'logs-viewer':
      return <LogsViewerWidget data={renderData} config={config} />;
    case 'custom-html':
      return <CustomHTMLWidget config={config} />;
    case 'azure-metrics':
      return <AzureMetricsWidget data={renderData} config={config} />;
    case 'area-chart':
      return <LineChartWidget data={renderData} config={{ ...config as ChartConfig, fill: true }} />;
    case 'pie-chart':
      return <DoughnutChartWidget data={renderData} config={config as ChartConfig} />;
    case 'map':
      return <MapWidget data={renderData} config={config as MapConfig} />;
    case 'jenkins-stats':
      return <JenkinsStatsWidget data={renderData} />;
    case 'jenkins-jobs':
      return <JenkinsJobsWidget data={renderData} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Unknown widget type: {widget.widgetType}</p>
          </div>
        </div>
      );
  }
}

// Jenkins Stats Widget
function JenkinsStatsWidget({ data }: { data: unknown }) {
  const stats = data as {
    totalJobs?: number; successfulJobs?: number; failedJobs?: number;
    unstableJobs?: number; buildingJobs?: number; buildsLast24h?: number;
    totalNodes?: number; onlineNodes?: number; averageHealthScore?: number;
  } | null;
  if (!stats || typeof stats !== 'object') return <div className="text-gray-400 text-center text-sm p-4">No Jenkins data</div>;

  const items = [
    { label: 'Jobs', value: stats.totalJobs ?? 0, color: 'text-blue-500' },
    { label: 'Passing', value: stats.successfulJobs ?? 0, color: 'text-green-500' },
    { label: 'Failing', value: stats.failedJobs ?? 0, color: 'text-red-500' },
    { label: 'Building', value: stats.buildingJobs ?? 0, color: 'text-yellow-500' },
    { label: 'Builds 24h', value: stats.buildsLast24h ?? 0, color: 'text-purple-500' },
    { label: 'Health', value: `${stats.averageHealthScore ?? 0}%`, color: 'text-cyan-500' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 h-full content-center p-3">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className={clsx('text-xl font-bold', item.color)}>{item.value}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// Jenkins Jobs Widget
function JenkinsJobsWidget({ data }: { data: unknown }) {
  const jobs = (Array.isArray(data) ? data : (data as { jobs?: unknown[] })?.jobs || []) as Array<{
    name: string; fullName?: string; color?: string;
    healthReport?: Array<{ score: number }>;
    lastBuild?: { number: number; result?: string };
  }>;
  if (!jobs.length) return <div className="text-gray-400 text-center text-sm p-4">No Jenkins jobs</div>;

  const colorMap: Record<string, string> = {
    blue: 'bg-green-500', blue_anime: 'bg-green-400 animate-pulse',
    red: 'bg-red-500', red_anime: 'bg-red-400 animate-pulse',
    yellow: 'bg-yellow-500', yellow_anime: 'bg-yellow-400 animate-pulse',
    grey: 'bg-gray-500', disabled: 'bg-gray-600', notbuilt: 'bg-gray-500',
  };

  return (
    <div className="overflow-auto h-full text-xs">
      <table className="w-full">
        <thead className="sticky top-0 bg-white">
          <tr className="text-gray-500 border-b">
            <th className="text-left py-1 px-2">Job</th>
            <th className="text-center py-1">Status</th>
            <th className="text-center py-1">Health</th>
            <th className="text-right py-1 px-2">Build</th>
          </tr>
        </thead>
        <tbody>
          {jobs.slice(0, 15).map((job) => (
            <tr key={job.fullName || job.name} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-1 px-2 truncate max-w-[120px]">{job.name}</td>
              <td className="py-1 text-center">
                <span className={clsx('inline-block w-2.5 h-2.5 rounded-full', colorMap[job.color || 'grey'] || 'bg-gray-400')} />
              </td>
              <td className="py-1 text-center text-gray-500">{job.healthReport?.[0]?.score != null ? `${job.healthReport[0].score}%` : '—'}</td>
              <td className="py-1 px-2 text-right text-gray-500">{job.lastBuild ? `#${job.lastBuild.number}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Metric Card Widget
function MetricCardWidget({ data, config }: { data: unknown; config: MetricCardConfig }) {
  const value = useMemo(() => {
    if (!data) return null;
    if (typeof data === 'object' && config.valueField) {
      return (data as Record<string, unknown>)[config.valueField];
    }
    if (typeof data === 'object' && 'value' in data) {
      return (data as { value: unknown }).value;
    }
    return data;
  }, [data, config.valueField]);

  const trend = useMemo(() => {
    if (!data || typeof data !== 'object') return null;
    const trendKey = config.trendField || 'change';
    return (data as Record<string, unknown>)[trendKey] as number | undefined;
  }, [data, config.trendField]);

  const formattedValue = useMemo(() => {
    if (value === null || value === undefined) return '—';
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value);
    
    const decimals = config.decimals ?? 0;
    const formatted = num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return `${config.prefix || ''}${formatted}${config.suffix || ''}`;
  }, [value, config]);

  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600',
  };

  return (
    <div className="flex flex-col h-full justify-center">
      <div className={clsx('text-3xl font-bold', colorClasses[config.colorScheme || 'blue'])}>
        {formattedValue}
      </div>
      {trend !== null && trend !== undefined && (
        <div className={clsx(
          'flex items-center gap-1 mt-2 text-sm',
          trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
        )}>
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4" />
          ) : trend < 0 ? (
            <TrendingDown className="w-4 h-4" />
          ) : (
            <Minus className="w-4 h-4" />
          )}
          <span>{trend > 0 ? '+' : ''}{trend}%</span>
        </div>
      )}
    </div>
  );
}

// KPI Widget
function KPIWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const value = typeof data === 'object' && data && 'value' in data 
    ? (data as { value: number }).value 
    : typeof data === 'number' ? data : 0;
  const target = (config.target as number) || 100;
  const progress = Math.min((value / target) * 100, 100);

  return (
    <div className="flex flex-col h-full justify-center">
      <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-gray-500 mt-1">
        Target: {target.toLocaleString()}
      </div>
      <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={clsx(
            'h-full rounded-full transition-all',
            progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-blue-500' : progress >= 50 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {progress.toFixed(1)}% of target
      </div>
    </div>
  );
}

// Gauge Widget
function GaugeWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const value = typeof data === 'number' ? data : 
    (typeof data === 'object' && data && 'value' in data ? (data as { value: number }).value : 0);
  const max = (config.max as number) || 100;
  const percentage = Math.min((value / max) * 100, 100);
  
  const getColor = () => {
    if (percentage >= 90) return '#22c55e';
    if (percentage >= 70) return '#3b82f6';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative w-32 h-16 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 100 50" className="w-full h-full">
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke={getColor()}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${percentage * 1.26} 126`}
            />
          </svg>
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-2">
        {value}
        <span className="text-sm text-gray-500 ml-1">/ {max}</span>
      </div>
    </div>
  );
}

// Line Chart Widget
function LineChartWidget({ data, config }: { data: unknown; config: ChartConfig }) {
  const chartData = useMemo(() => {
    if (!data) return null;
    
    // If data is already in Chart.js format
    if (typeof data === 'object' && 'labels' in (data as object) && 'datasets' in (data as object)) {
      return data as { labels: string[]; datasets: unknown[] };
    }
    
    // Transform array data
    if (Array.isArray(data)) {
      const labelField = config.labelField || 'label';
      const valueField = config.valueField || 'value';
      return {
        labels: data.map(d => String(d[labelField] || '')),
        datasets: [{
          label: config.datasetLabel || 'Value',
          data: data.map(d => d[valueField] || 0),
          borderColor: config.colors?.[0] || 'rgb(59, 130, 246)',
          backgroundColor: config.fill ? 'rgba(59, 130, 246, 0.1)' : undefined,
          fill: config.fill ?? true,
        }]
      };
    }
    
    return null;
  }, [data, config]);

  if (!chartData) {
    return <div className="text-gray-400 text-center">No chart data</div>;
  }

  return (
    <Line 
      data={chartData as any}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        }
      }}
    />
  );
}

// Bar Chart Widget
function BarChartWidget({ data, config }: { data: unknown; config: ChartConfig }) {
  const chartData = useMemo(() => {
    if (!data) return null;
    
    if (typeof data === 'object' && 'labels' in (data as object)) {
      return data as { labels: string[]; datasets: unknown[] };
    }
    
    if (Array.isArray(data)) {
      const labelField = config.labelField || 'label';
      const valueField = config.valueField || 'value';
      const colors = config.colors || ['rgba(59, 130, 246, 0.8)'];
      return {
        labels: data.map(d => String(d[labelField] || '')),
        datasets: [{
          label: config.datasetLabel || 'Value',
          data: data.map(d => d[valueField] || 0),
          backgroundColor: colors,
        }]
      };
    }
    
    return null;
  }, [data, config]);

  if (!chartData) {
    return <div className="text-gray-400 text-center">No chart data</div>;
  }

  return (
    <Bar 
      data={chartData as any}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        }
      }}
    />
  );
}

// Doughnut Chart Widget
function DoughnutChartWidget({ data, config }: { data: unknown; config: ChartConfig }) {
  const chartData = useMemo(() => {
    if (!data) return null;
    
    if (typeof data === 'object' && 'labels' in (data as object)) {
      return data as { labels: string[]; datasets: unknown[] };
    }
    
    if (Array.isArray(data)) {
      const labelField = config.labelField || 'label';
      const valueField = config.valueField || 'value';
      const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
      return {
        labels: data.map(d => String(d[labelField] || '')),
        datasets: [{
          data: data.map(d => d[valueField] || 0),
          backgroundColor: config.colors || defaultColors,
        }]
      };
    }
    
    return null;
  }, [data, config]);

  if (!chartData) {
    return <div className="text-gray-400 text-center">No chart data</div>;
  }

  return (
    <Doughnut 
      data={chartData as any}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            position: 'right',
            labels: { boxWidth: 12, font: { size: 10 } }
          }
        },
        cutout: '60%'
      }}
    />
  );
}

// Data Table Widget
// Format cell value for display - handles nested objects/arrays
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    // For arrays of objects, show count
    if (typeof value[0] === 'object') return `[${value.length} items]`;
    // For simple arrays, show joined values
    return value.slice(0, 5).map(v => formatCellValue(v)).join(', ') + (value.length > 5 ? '...' : '');
  }
  if (typeof value === 'object') {
    // For objects, try to show a meaningful summary
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    // Check for common displayable fields
    for (const key of ['name', 'title', 'label', 'id', 'value']) {
      if (obj[key] !== undefined && typeof obj[key] !== 'object') {
        return String(obj[key]);
      }
    }
    // Fallback: show first few key-value pairs
    return keys.slice(0, 2).map(k => `${k}: ${formatCellValue(obj[k])}`).join(', ');
  }
  return String(value);
}

function DataTableWidget({ data, config }: { data: unknown; config: TableConfig }) {
  const rows = Array.isArray(data) ? data : [];
  const columns: { key: string; label: string; width?: string }[] = config.columns || (rows[0] ? Object.keys(rows[0]).map(k => ({ key: k, label: k })) : []);

  if (rows.length === 0) {
    return <div className="text-gray-400 text-center py-4">No data</div>;
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
          <tr>
            {columns.map(col => (
              <th 
                key={col.key}
                className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows.slice(0, config.pageSize || 100).map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              {columns.map(col => (
                <td key={col.key} className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {formatCellValue(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Status List Widget
function StatusListWidget({ data, config }: { data: unknown; config: StatusListConfig }) {
  const items = Array.isArray(data) ? data : [];
  const nameField = config.nameField || 'name';
  const statusField = config.statusField || 'status';
  
  const statusIcons: Record<string, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4 text-green-500" />,
    ok: <CheckCircle className="w-4 h-4 text-green-500" />,
    healthy: <CheckCircle className="w-4 h-4 text-green-500" />,
    running: <CheckCircle className="w-4 h-4 text-green-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    degraded: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
    down: <XCircle className="w-4 h-4 text-red-500" />,
    pending: <Clock className="w-4 h-4 text-gray-400" />,
  };

  if (items.length === 0) {
    return <div className="text-gray-400 text-center py-4">No items</div>;
  }

  return (
    <div className="space-y-2 overflow-auto h-full">
      {items.map((item, i) => {
        const status = String(item[statusField] || 'unknown').toLowerCase();
        return (
          <div 
            key={i}
            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-750"
          >
            <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
              {String(item[nameField] || '')}
            </span>
            {statusIcons[status] || <AlertCircle className="w-4 h-4 text-gray-400" />}
          </div>
        );
      })}
    </div>
  );
}

// Timeline Widget
function TimelineWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const events = Array.isArray(data) ? data : [];
  const timeField = (config.timeField as string) || 'timestamp';
  const titleField = (config.titleField as string) || 'title';
  const descField = (config.descriptionField as string) || 'description';

  if (events.length === 0) {
    return <div className="text-gray-400 text-center py-4">No events</div>;
  }

  return (
    <div className="relative overflow-auto h-full pl-4">
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-4">
        {events.map((event, i) => (
          <div key={i} className="relative pl-6">
            <div className="absolute left-0 top-1 w-2 h-2 rounded-full bg-blue-500" />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {event[timeField] ? new Date(event[timeField]).toLocaleString() : ''}
            </div>
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {String(event[titleField] || '')}
            </div>
            {event[descField] && (
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {String(event[descField])}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Logs Viewer Widget
function LogsViewerWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const logs = Array.isArray(data) ? data : [];
  const messageField = (config.messageField as string) || 'message';
  const levelField = (config.levelField as string) || 'level';
  const timeField = (config.timeField as string) || 'timestamp';

  const levelColors: Record<string, string> = {
    error: 'text-red-500',
    warn: 'text-amber-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
    debug: 'text-gray-500',
  };

  if (logs.length === 0) {
    return <div className="text-gray-400 text-center py-4">No logs</div>;
  }

  return (
    <div className="font-mono text-xs overflow-auto h-full bg-gray-900 text-gray-100 rounded p-2">
      {logs.map((log, i) => {
        const level = String(log[levelField] || 'info').toLowerCase();
        return (
          <div key={i} className="py-0.5">
            <span className="text-gray-500">
              {log[timeField] ? new Date(log[timeField]).toLocaleTimeString() : ''}
            </span>
            {' '}
            <span className={levelColors[level] || 'text-gray-400'}>
              [{level.toUpperCase()}]
            </span>
            {' '}
            <span>{String(log[messageField] || '')}</span>
          </div>
        );
      })}
    </div>
  );
}

// Custom HTML Widget
function CustomHTMLWidget({ config }: { config: Record<string, unknown> }) {
  const html = (config.html as string) || '';
  // Note: In production, use a proper HTML sanitizer like DOMPurify
  // const allowedTags = (config.allowedTags as string[]) || ['div', 'span', 'p', 'h1', 'h2', 'h3', 'ul', 'li', 'a', 'img'];

  return (
    <div 
      className="prose prose-sm dark:prose-invert max-w-none h-full overflow-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Map Fit Bounds Component - auto-fits map to show all markers
function MapFitBounds({ markers }: { markers: { lat: number; lng: number }[] }) {
  const map = useMap();
  
  useMemo(() => {
    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [20, 20] });
    } else if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 12);
    }
  }, [markers, map]);
  
  return null;
}

// Map Widget - Interactive OpenStreetMap view using Leaflet
function MapWidget({ data, config }: { data: unknown; config: MapConfig }) {
  const tileLayers = {
    'osm': {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    'carto-light': {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    'carto-dark': {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    'esri': {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri'
    }
  };

  // Extract markers from data or config
  const markers = useMemo(() => {
    // Config markers take precedence
    if (config.markers && config.markers.length > 0) {
      return config.markers;
    }
    
    // Extract from data array
    if (Array.isArray(data)) {
      const latField = config.latField || 'lat' || 'latitude';
      const lngField = config.lngField || 'lng' || 'longitude';
      const labelField = config.labelField || 'name' || 'label';
      const popupField = config.popupField || 'description' || 'popup';
      
      return data
        .filter(item => {
          const lat = item[latField] ?? item.lat ?? item.latitude;
          const lng = item[lngField] ?? item.lng ?? item.longitude;
          return lat !== undefined && lng !== undefined;
        })
        .map(item => ({
          lat: Number(item[latField] ?? item.lat ?? item.latitude),
          lng: Number(item[lngField] ?? item.lng ?? item.longitude),
          label: String(item[labelField] ?? item.name ?? item.label ?? ''),
          popup: String(item[popupField] ?? item.description ?? item.popup ?? '')
        }));
    }
    
    // Single location object
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const lat = obj.lat ?? obj.latitude;
      const lng = obj.lng ?? obj.longitude;
      if (lat !== undefined && lng !== undefined) {
        return [{
          lat: Number(lat),
          lng: Number(lng),
          label: String(obj.name ?? obj.label ?? ''),
          popup: String(obj.description ?? obj.popup ?? '')
        }];
      }
    }
    
    return [];
  }, [data, config]);

  const center: [number, number] = config.center || 
    (markers.length > 0 ? [markers[0].lat, markers[0].lng] : [51.505, -0.09]);
  const zoom = config.zoom || 10;
  const tileConfig = tileLayers[config.tileLayer || 'osm'];

  // Show placeholder if no data
  if (markers.length === 0 && !config.center) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <MapPin className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium">No location data</p>
        <p className="text-xs mt-1">Add markers or configure center coordinates</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-lg overflow-hidden" style={{ minHeight: '200px' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution={tileConfig.attribution}
          url={tileConfig.url}
        />
        {markers.length > 0 && <MapFitBounds markers={markers} />}
        {markers.map((marker, idx) => (
          <Marker key={idx} position={[marker.lat, marker.lng]}>
            {(marker.label || marker.popup) && (
              <Popup>
                {marker.label && <strong>{marker.label}</strong>}
                {marker.label && marker.popup && <br />}
                {marker.popup && <span>{marker.popup}</span>}
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// Azure Metrics Widget - displays Azure Monitor metrics
function AzureMetricsWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const { metrics, chartData, metricName, resourceName } = useMemo(() => {
    const metricNameConfig = (config.metricName as string) || 'Metric';
    const resourceNameConfig = (config.resourceName as string) || 'Azure Resource';
    
    if (!data) return { metrics: null, chartData: null, metricName: metricNameConfig, resourceName: resourceNameConfig };
    
    // Handle nested Azure metrics format: [{name, unit, timeseries: [{timestamp, average, ...}]}]
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      const firstMetric = data[0] as Record<string, unknown>;
      
      // Check if first item has nested timeseries array
      if (firstMetric.timeseries && Array.isArray(firstMetric.timeseries)) {
        const timeseries = firstMetric.timeseries as Record<string, unknown>[];
        
        if (timeseries.length > 0) {
          return {
            metrics: data,
            chartData: {
              labels: timeseries.map((ts) => {
                const timestamp = ts.timestamp || ts.timeStamp || ts.time;
                return timestamp ? new Date(timestamp as string).toLocaleTimeString() : '';
              }),
              datasets: [{
                label: (firstMetric.name as string) || metricNameConfig,
                data: timeseries.map((ts) => 
                  (ts.average ?? ts.total ?? ts.count ?? ts.value ?? 0) as number
                ),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3,
              }],
            },
            metricName: (firstMetric.name as string) || metricNameConfig,
            resourceName: resourceNameConfig,
          };
        }
      }
      
      // Check if first item has timestamp (flat timeseries)
      if ('timestamp' in firstMetric || 'timeStamp' in firstMetric || 'time' in firstMetric) {
        return {
          metrics: data,
          chartData: {
            labels: (data as Record<string, unknown>[]).map((m) => {
              const ts = m.timestamp || m.timeStamp || m.time;
              return ts ? new Date(ts as string).toLocaleTimeString() : '';
            }),
            datasets: [{
              label: metricNameConfig,
              data: (data as Record<string, unknown>[]).map((m) => 
                (m.average ?? m.total ?? m.count ?? m.value ?? 0) as number
              ),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.3,
            }],
          },
          metricName: metricNameConfig,
          resourceName: resourceNameConfig,
        };
      }
    }
    
    // Handle Azure metrics response format with metrics property
    if (typeof data === 'object' && 'metrics' in (data as Record<string, unknown>)) {
      return { 
        metrics: (data as { metrics: unknown[] }).metrics, 
        chartData: null, 
        metricName: metricNameConfig, 
        resourceName: resourceNameConfig 
      };
    }
    
    // Handle timeSeries data
    if (typeof data === 'object' && 'timeSeries' in (data as Record<string, unknown>)) {
      return { 
        metrics: (data as { timeSeries: unknown[] }).timeSeries, 
        chartData: null, 
        metricName: metricNameConfig, 
        resourceName: resourceNameConfig 
      };
    }
    
    return { metrics: data, chartData: null, metricName: metricNameConfig, resourceName: resourceNameConfig };
  }, [data, config]);

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Activity className="w-8 h-8 mb-2" />
        <p className="text-sm">No metrics data available</p>
        <p className="text-xs mt-1">Resource: {resourceName}</p>
      </div>
    );
  }

  // Render chart if we have chart data
  if (chartData) {
    return (
      <div className="h-full w-full">
        <Line 
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              title: { display: false },
            },
            scales: {
              x: { 
                display: true,
                grid: { display: false },
                ticks: { maxTicksLimit: 6, font: { size: 10 } }
              },
              y: { 
                display: true,
                grid: { color: 'rgba(0,0,0,0.05)' },
                beginAtZero: true,
              },
            },
          }}
        />
      </div>
    );
  }

  // Fallback: display summary
  const summaryValue = Array.isArray(metrics) ? metrics.length : String(metrics);
  return (
    <div className="flex flex-col justify-center h-full">
      <div className="text-2xl font-bold text-blue-600">{summaryValue}</div>
      <div className="text-sm text-gray-500 mt-1">{metricName}</div>
    </div>
  );
}

export default WidgetRenderer;
