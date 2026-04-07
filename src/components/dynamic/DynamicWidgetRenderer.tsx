import { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { API_BASE_PATH } from '../../services/api'
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2'
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
} from 'chart.js'
import { 
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle,
  MoreVertical, Settings, Trash2, Copy, Lock, Unlock, MapPin,
  Sparkles
} from 'lucide-react'
import clsx from 'clsx'
import { aiDataTransformService, TransformedData, autoTransformAzureMetrics } from '../../services/aiDataTransformService'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Register Chart.js components
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
)

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

// Widget data from API
export interface WidgetData {
  id: string
  widgetType: string
  title: string
  subtitle?: string
  gridX: number
  gridY: number
  gridWidth: number
  gridHeight: number
  dataProviderType: string
  dataProviderConfig: Record<string, unknown>
  widgetConfig: Record<string, unknown>
  refreshIntervalSeconds: number
  isLocked: boolean
  cachedData?: unknown
}

interface DynamicWidgetRendererProps {
  widget: WidgetData
  isEditMode?: boolean
  onEdit?: (widget: WidgetData) => void
  onDelete?: (widgetId: string) => void
  onDuplicate?: (widget: WidgetData) => void
  onToggleLock?: (widgetId: string) => void
}

// Generic data fetcher
async function fetchWidgetData(widget: WidgetData): Promise<unknown> {
  const { dataProviderType, dataProviderConfig, cachedData } = widget
  
  if (dataProviderType === 'Static' || dataProviderType === 'None') {
    return dataProviderConfig?.staticData || cachedData || null
  }
  
  if (dataProviderType === 'Mock') {
    return generateMockData(widget)
  }
  
  if (dataProviderType === 'ApiEndpoint') {
    const url = dataProviderConfig?.url as string
    if (!url) return null
    
    try {
      const method = (dataProviderConfig?.method as string) || 'GET'
      const headers = (dataProviderConfig?.headers as Record<string, string>) || {}
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: method !== 'GET' ? JSON.stringify(dataProviderConfig?.body) : undefined,
      })
      
      if (!response.ok) throw new Error('API request failed')
      return await response.json()
    } catch (error) {
      console.error('Widget data fetch error:', error)
      return null
    }
  }
  
  // For Azure Log Analytics and App Insights, use scoped query for optimized execution
  if (['AzureLogAnalytics', 'AppInsights'].includes(dataProviderType)) {
    try {
      const query = dataProviderConfig?.query as string
      const workspaceId = dataProviderConfig?.workspaceId as string || dataProviderConfig?.appInsightsId as string
      const timeRange = (dataProviderConfig?.timeRange as string) || '1h'
      
      if (!query) {
        console.warn('Widget has no KQL query configured')
        return cachedData || null
      }
      
      // Use scoped query endpoint for better performance
      const response = await fetch(`${API_BASE_PATH}/scopedquery/execute`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('prodvista_auth_token') || ''}`
        },
        body: JSON.stringify({ query, workspaceId, timeRange })
      })
      
      if (!response.ok) {
        console.error('Scoped query error:', response.status)
        return cachedData || null
      }
      
      const result = await response.json()
      console.log(`Widget ${widget.id} query: ${result.rowCount} rows in ${result.queryTimeMs}ms`)
      return result.data || result
    } catch (error) {
      console.error('Widget scoped query error:', error)
      return cachedData || null
    }
  }
  
  // For Azure Metrics and Database providers, use the widget fetch endpoint
  if (['AzureMetrics', 'DatabaseQuery'].includes(dataProviderType)) {
    try {
      const response = await fetch(`${API_BASE_PATH}/dynamicdashboard/widgets/${widget.id}/fetch`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('prodvista_auth_token') || ''}`
        },
      })
      
      if (!response.ok) {
        console.error('Widget fetch API error:', response.status)
        return cachedData || null
      }
      
      return await response.json()
    } catch (error) {
      console.error('Widget data fetch error:', error)
      return cachedData || null
    }
  }

  // Jenkins data provider
  if (dataProviderType === 'Jenkins' || dataProviderConfig?.jenkinsConnectionId) {
    try {
      const connectionId = dataProviderConfig?.jenkinsConnectionId as string
      if (!connectionId) return cachedData || null
      const token = localStorage.getItem('prodvista_auth_token') || ''
      const endpoint = dataProviderConfig?.jenkinsEndpoint as string || 'stats'

      const response = await fetch(`${API_BASE_PATH}/jenkins/connections/${connectionId}/${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      })
      if (!response.ok) return cachedData || null
      return await response.json()
    } catch (error) {
      console.error('Jenkins widget data fetch error:', error)
      return cachedData || null
    }
  }
  
  // For other types, use cached data or return null
  return cachedData || null
}

// Generate mock data based on widget type
function generateMockData(widget: WidgetData): unknown {
  const { widgetType } = widget
  
  if (widgetType === 'metric-card' || widgetType === 'kpi' || widgetType === 'gauge') {
    return {
      value: Math.floor(Math.random() * 10000),
      change: (Math.random() - 0.5) * 20,
      target: Math.floor(Math.random() * 12000),
    }
  }
  
  if (widgetType.includes('chart')) {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    return {
      labels,
      datasets: [{
        label: 'Series 1',
        data: labels.map(() => Math.floor(Math.random() * 100)),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        fill: widgetType === 'area-chart',
      }],
    }
  }
  
  if (widgetType === 'data-table') {
    return {
      columns: [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'status', label: 'Status' },
        { key: 'value', label: 'Value' },
      ],
      rows: Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        status: ['Active', 'Pending', 'Completed'][Math.floor(Math.random() * 3)],
        value: Math.floor(Math.random() * 1000),
      })),
    }
  }
  
  if (widgetType === 'status-list') {
    return [
      { name: 'API Server', status: 'healthy' },
      { name: 'Database', status: 'healthy' },
      { name: 'Cache', status: 'warning' },
      { name: 'Queue', status: 'healthy' },
    ]
  }
  
  if (widgetType === 'logs-viewer') {
    return Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      level: ['INFO', 'WARN', 'ERROR'][Math.floor(Math.random() * 3)],
      message: `Log message ${i + 1}`,
    }))
  }
  
  return null
}

// Format number based on config
function formatValue(value: number, config: Record<string, unknown>): string {
  const format = config?.format as string
  const prefix = config?.prefix as string || ''
  const suffix = config?.suffix as string || ''
  
  let formatted: string
  
  switch (format) {
    case 'currency':
      formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
      break
    case 'percent':
      formatted = `${value.toFixed(1)}%`
      break
    case 'bytes':
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let unitIndex = 0
      let size = value
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
      }
      formatted = `${size.toFixed(1)} ${units[unitIndex]}`
      break
    default:
      formatted = new Intl.NumberFormat('en-US').format(value)
  }
  
  return `${prefix}${formatted}${suffix}`
}

// Widget Renderers
function MetricWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  // Handle different data structures
  let metricData: { value: number; change?: number; target?: number; label?: string; additionalFields?: Record<string, unknown> } | null = null
  
  if (data === null || data === undefined) {
    return <div className="text-gray-400 text-center">No data</div>
  }
  
  // If data is an array, extract first item or aggregate
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <div className="text-gray-400 text-center">No data</div>
    }
    const first = data[0] as Record<string, unknown>
    // Find numeric field for value
    const numericFields = Object.entries(first).filter(([, v]) => typeof v === 'number')
    if (numericFields.length > 0) {
      metricData = {
        value: numericFields[0][1] as number,
        label: String(first[Object.keys(first).find(k => typeof first[k] === 'string') || ''] || ''),
        additionalFields: numericFields.length > 1 
          ? Object.fromEntries(numericFields.slice(1))
          : undefined
      }
    }
  } else if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    metricData = {
      value: (obj.value ?? obj.count ?? obj.total ?? Object.values(obj).find(v => typeof v === 'number')) as number,
      change: obj.change as number | undefined,
      target: obj.target as number | undefined,
      label: obj.label as string | undefined,
      additionalFields: Object.fromEntries(
        Object.entries(obj).filter(([k, v]) => 
          typeof v === 'number' && 
          !['value', 'change', 'target'].includes(k)
        )
      )
    }
  } else if (typeof data === 'number') {
    metricData = { value: data }
  }

  if (!metricData || metricData.value === undefined) {
    return <div className="text-gray-400 text-center">No data</div>
  }
  
  const { value, change, label, additionalFields } = metricData
  const formattedValue = formatValue(value, config)
  
  return (
    <div className="flex flex-col justify-center h-full px-2">
      {label && (
        <div className="text-xs text-gray-500 mb-1 truncate">{label}</div>
      )}
      <div className="text-3xl font-bold text-gray-800">{formattedValue}</div>
      {change !== undefined && (
        <div className={clsx(
          'flex items-center gap-1 mt-1 text-sm',
          change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
        )}>
          {change > 0 ? <TrendingUp className="w-4 h-4" /> : 
           change < 0 ? <TrendingDown className="w-4 h-4" /> : 
           <Minus className="w-4 h-4" />}
          <span>{Math.abs(change).toFixed(1)}%</span>
        </div>
      )}
      {/* Show additional fields if available */}
      {additionalFields && Object.keys(additionalFields).length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          {Object.entries(additionalFields).slice(0, 4).map(([key, val]) => (
            <div key={key} className="text-xs">
              <span className="text-gray-500">{key}:</span>
              <span className="ml-1 font-medium text-gray-700">
                {formatValue(val as number, {})}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GaugeWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const gaugeData = data as { value: number; target?: number } | null
  if (!gaugeData) return <div className="text-gray-400 text-center">No data</div>
  
  const { value, target = 100 } = gaugeData
  const percentage = Math.min((value / target) * 100, 100)
  const thresholds = Array.isArray(config?.thresholds) ? config.thresholds as { value: number; color: string }[] : []
  
  let color = 'rgb(59, 130, 246)' // Default blue
  for (const threshold of thresholds) {
    if (value >= threshold.value) color = threshold.color
  }
  
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="48" cy="48" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="48" cy="48" r="40" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={`${percentage * 2.51} 251`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold">{percentage.toFixed(0)}%</span>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-500">{formatValue(value, config)} / {formatValue(target, config)}</div>
    </div>
  )
}

function ChartWidget({ data, config, type }: { data: unknown; config: Record<string, unknown>; type: string }) {
  // Transform data to Chart.js format
  type ChartDataType = { labels: string[]; datasets: { label: string; data: number[]; backgroundColor?: string | string[]; borderColor?: string; fill?: boolean }[] }
  let chartData: ChartDataType | null = null
  
  if (!data) return <div className="text-gray-400 text-center">No data</div>
  
  // If already in Chart.js format
  if (typeof data === 'object' && data !== null && 'labels' in data && 'datasets' in data) {
    chartData = data as ChartDataType
  }
  // If array of objects, transform to chart format
  else if (Array.isArray(data) && data.length > 0) {
    const sample = data[0] as Record<string, unknown>
    const fields = Object.keys(sample)
    
    // Find label field (string type, usually name/label/category)
    const labelField = fields.find(f => 
      ['label', 'name', 'category', 'x', 'timestamp', 'date', 'time'].some(p => 
        f.toLowerCase().includes(p)
      )
    ) || fields.find(f => typeof sample[f] === 'string') || fields[0]
    
    // Find value fields (numeric)
    const valueFields = fields.filter(f => 
      typeof sample[f] === 'number' && f !== labelField
    )
    
    if (valueFields.length === 0) {
      return <div className="text-gray-400 text-center">No numeric data for chart</div>
    }
    
    const labels = data.map(item => String((item as Record<string, unknown>)[labelField] || ''))
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
    
    chartData = {
      labels,
      datasets: valueFields.map((field, i) => ({
        label: field,
        data: data.map(item => Number((item as Record<string, unknown>)[field]) || 0),
        backgroundColor: type === 'pie-chart' || type === 'doughnut-chart' 
          ? colors.slice(0, labels.length).map((c, j) => `${c}${Math.round(80 - j * 10).toString(16)}`)
          : `${colors[i % colors.length]}80`,
        borderColor: colors[i % colors.length],
        fill: type === 'area-chart',
      }))
    }
  }
  // If single object with numeric values
  else if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const entries = Object.entries(obj).filter(([, v]) => typeof v === 'number')
    if (entries.length > 0) {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
      chartData = {
        labels: entries.map(([k]) => k),
        datasets: [{
          label: 'Values',
          data: entries.map(([, v]) => v as number),
          backgroundColor: type === 'pie-chart' || type === 'doughnut-chart'
            ? colors.slice(0, entries.length)
            : '#3b82f680',
          borderColor: '#3b82f6',
          fill: type === 'area-chart',
        }]
      }
    }
  }
  
  if (!chartData?.labels) return <div className="text-gray-400 text-center">No data</div>
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: config?.showLegend !== false },
    },
    scales: type !== 'doughnut-chart' && type !== 'pie-chart' ? {
      x: { grid: { display: config?.showGrid !== false } },
      y: { grid: { display: config?.showGrid !== false } },
    } : undefined,
  }
  
  const ChartComponent = {
    'line-chart': Line,
    'bar-chart': Bar,
    'doughnut-chart': Doughnut,
    'pie-chart': Pie,
    'area-chart': Line,
  }[type] || Line
  
  return (
    <div className="h-full w-full p-2">
      <ChartComponent data={chartData as any} options={options as any} />
    </div>
  )
}

function TableWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  // Transform data to table format
  type TableDataType = { columns: { key: string; label: string }[]; rows: Record<string, unknown>[] }
  let tableData: TableDataType | null = null
  
  if (!data) return <div className="text-gray-400 text-center">No data</div>
  
  // If already in table format
  if (typeof data === 'object' && data !== null && 'columns' in data && 'rows' in data) {
    tableData = data as TableDataType
  }
  // If array of objects, auto-generate columns
  else if (Array.isArray(data) && data.length > 0) {
    const sample = data[0] as Record<string, unknown>
    const fields = Object.keys(sample)
    tableData = {
      columns: fields.map(key => ({ 
        key, 
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim() 
      })),
      rows: data as Record<string, unknown>[]
    }
  }
  // If single object, show as key-value pairs
  else if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    tableData = {
      columns: [{ key: 'key', label: 'Field' }, { key: 'value', label: 'Value' }],
      rows: entries.map(([key, value]) => ({ 
        key, 
        value: typeof value === 'object' ? JSON.stringify(value) : value 
      }))
    }
  }
  
  if (!tableData?.columns) return <div className="text-gray-400 text-center">No data</div>
  
  const { columns, rows } = tableData
  const pageSize = (config?.pageSize as number) || 10
  const [currentPage, setCurrentPage] = useState(0)
  
  const paginatedRows = config?.pagination !== false 
    ? rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : rows
  
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-600">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedRows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-2 text-gray-700">{formatCellValue(row[col.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {config?.pagination !== false && rows.length > pageSize && (
        <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50 text-xs">
          <span className="text-gray-500">
            {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-1">
            <button 
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Prev
            </button>
            <button 
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={(currentPage + 1) * pageSize >= rows.length}
              className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusListWidget({ data }: { data: unknown }) {
  // Transform data to status list format
  let items: { name: string; status: string; value?: number | string }[] = []
  
  if (!data) return <div className="text-gray-400 text-center">No data</div>
  
  // If already array with name/status
  if (Array.isArray(data)) {
    items = data.map(item => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>
        // Find name/label field
        const nameField = ['name', 'label', 'title', 'service', 'resource'].find(f => f in obj)
        // Find status field
        const statusField = ['status', 'state', 'health', 'level'].find(f => f in obj)
        // Find value field
        const valueField = ['value', 'count', 'duration', 'latency'].find(f => f in obj)
        
        return {
          name: String(obj[nameField || Object.keys(obj)[0]] || 'Unknown'),
          status: String(obj[statusField || ''] || 'unknown').toLowerCase(),
          value: obj[valueField || ''] as number | string | undefined
        }
      }
      return { name: String(item), status: 'unknown' }
    })
  }
  // If single object, create list from entries
  else if (typeof data === 'object') {
    items = Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
      name: key,
      status: typeof value === 'boolean' ? (value ? 'healthy' : 'error') : 'unknown',
      value: typeof value === 'number' || typeof value === 'string' ? value : undefined
    }))
  }
  
  if (!items.length) return <div className="text-gray-400 text-center">No data</div>
  
  const statusColors: Record<string, string> = {
    healthy: 'bg-green-500',
    success: 'bg-green-500',
    ok: 'bg-green-500',
    active: 'bg-green-500',
    warning: 'bg-yellow-500',
    degraded: 'bg-yellow-500',
    slow: 'bg-yellow-500',
    error: 'bg-red-500',
    failed: 'bg-red-500',
    critical: 'bg-red-500',
    down: 'bg-red-500',
    unknown: 'bg-gray-400',
  }
  
  return (
    <div className="space-y-2 p-2 overflow-auto max-h-full">
      {items.slice(0, 20).map((item, i) => (
        <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-700 truncate block">{item.name}</span>
            {item.value !== undefined && (
              <span className="text-xs text-gray-500">
                {typeof item.value === 'number' ? formatValue(item.value, {}) : item.value}
              </span>
            )}
          </div>
          <span className={clsx(
            'w-3 h-3 rounded-full flex-shrink-0 ml-2',
            statusColors[item.status] || statusColors.unknown
          )} />
        </div>
      ))}
      {items.length > 20 && (
        <div className="text-xs text-gray-500 text-center">
          +{items.length - 20} more items
        </div>
      )}
    </div>
  )
}

function LogsWidget({ data }: { data: unknown }) {
  // Transform data to logs format
  let logs: { timestamp: string; level: string; message: string; source?: string }[] = []
  
  if (!data) return <div className="text-gray-400 text-center">No logs</div>
  
  if (Array.isArray(data)) {
    logs = data.map(item => {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>
        const timestampField = ['timestamp', 'time', 'date', 'created', 'eventTime'].find(f => f in obj)
        const levelField = ['level', 'severity', 'type', 'logLevel'].find(f => f in obj)
        const messageField = ['message', 'msg', 'text', 'content', 'body', 'description'].find(f => f in obj)
        const sourceField = ['source', 'logger', 'component', 'service'].find(f => f in obj)
        
        return {
          timestamp: String(obj[timestampField || ''] || new Date().toISOString()),
          level: String(obj[levelField || ''] || 'INFO').toUpperCase(),
          message: String(obj[messageField || Object.keys(obj).find(k => typeof obj[k] === 'string') || ''] || ''),
          source: obj[sourceField || ''] as string | undefined
        }
      }
      return { timestamp: new Date().toISOString(), level: 'INFO', message: String(item) }
    })
  }
  
  if (!logs.length) return <div className="text-gray-400 text-center">No logs</div>
  
  const levelColors: Record<string, string> = {
    INFO: 'text-blue-600 bg-blue-50',
    INFORMATION: 'text-blue-600 bg-blue-50',
    WARN: 'text-yellow-600 bg-yellow-50',
    WARNING: 'text-yellow-600 bg-yellow-50',
    ERROR: 'text-red-600 bg-red-50',
    CRITICAL: 'text-red-700 bg-red-100',
    DEBUG: 'text-gray-500 bg-gray-50',
    TRACE: 'text-gray-400 bg-gray-50',
  }
  
  return (
    <div className="h-full overflow-auto font-mono text-xs">
      {logs.slice(0, 100).map((log, i) => (
        <div key={i} className="flex gap-2 px-2 py-1 hover:bg-gray-50 border-b border-gray-100">
          <span className="text-gray-400 whitespace-nowrap flex-shrink-0">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          <span className={clsx(
            'font-medium px-1.5 py-0.5 rounded text-[10px] flex-shrink-0', 
            levelColors[log.level] || 'text-gray-600 bg-gray-50'
          )}>
            {log.level.slice(0, 5)}
          </span>
          {log.source && (
            <span className="text-purple-600 flex-shrink-0">[{log.source}]</span>
          )}
          <span className="text-gray-700 truncate">{log.message}</span>
        </div>
      ))}
    </div>
  )
}

function HtmlWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const content = (config?.content as string) || (data as string) || ''
  return (
    <div 
      className="h-full overflow-auto p-2 prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

function TimelineWidget({ data }: { data: unknown }) {
  const events = data as { time: string; title: string; description?: string }[] | null
  if (!events?.length) return <div className="text-gray-400 text-center">No events</div>
  
  return (
    <div className="h-full overflow-auto p-2">
      <div className="relative border-l-2 border-gray-200 ml-2">
        {events.map((event, i) => (
          <div key={i} className="ml-4 mb-4">
            <div className="absolute -left-1.5 mt-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
            <time className="text-xs text-gray-500">{event.time}</time>
            <h4 className="text-sm font-medium text-gray-800">{event.title}</h4>
            {event.description && <p className="text-xs text-gray-600">{event.description}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// Map Fit Bounds Component
function MapFitBoundsHelper({ markers }: { markers: { lat: number; lng: number }[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [20, 20] });
    } else if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 12);
    }
  }, [markers, map]);
  
  return null;
}

// Map Widget - Interactive OpenStreetMap
function MapWidget({ data, config }: { data: unknown; config: Record<string, unknown> }) {
  const tileLayers: Record<string, { url: string; attribution: string }> = {
    'osm': {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    'carto-light': {
      url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    },
    'carto-dark': {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }
  };

  // Extract markers from data
  const markers = useMemo(() => {
    if (config?.markers && Array.isArray(config.markers)) {
      return config.markers as { lat: number; lng: number; label?: string; popup?: string }[];
    }
    
    if (Array.isArray(data)) {
      const latField = (config?.latField as string) || 'lat';
      const lngField = (config?.lngField as string) || 'lng';
      const labelField = (config?.labelField as string) || 'name';
      
      return data
        .filter(item => item[latField] !== undefined && item[lngField] !== undefined)
        .map(item => ({
          lat: Number(item[latField] ?? item.lat ?? item.latitude),
          lng: Number(item[lngField] ?? item.lng ?? item.longitude),
          label: String(item[labelField] ?? item.name ?? ''),
          popup: String(item.description ?? item.popup ?? '')
        }));
    }
    
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

  const center: [number, number] = (config?.center as [number, number]) || 
    (markers.length > 0 ? [markers[0].lat, markers[0].lng] : [51.505, -0.09]);
  const zoom = (config?.zoom as number) || 10;
  const tileConfig = tileLayers[(config?.tileLayer as string) || 'osm'];

  if (markers.length === 0 && !config?.center) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <MapPin className="w-10 h-10 mb-2 opacity-50" />
        <p className="text-sm">No location data</p>
        <p className="text-xs">Add markers or configure coordinates</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded overflow-hidden" style={{ minHeight: '150px' }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
        <TileLayer attribution={tileConfig.attribution} url={tileConfig.url} />
        {markers.length > 0 && <MapFitBoundsHelper markers={markers} />}
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

// Jenkins Stats Widget — displays CI/CD overview stats
function JenkinsStatsWidget({ data }: { data: unknown }) {
  const stats = data as {
    totalJobs?: number; successfulJobs?: number; failedJobs?: number;
    unstableJobs?: number; buildingJobs?: number; buildsLast24h?: number;
    totalNodes?: number; onlineNodes?: number; averageHealthScore?: number;
  } | null;
  if (!stats) return <div className="text-gray-400 text-center text-sm">No Jenkins data</div>;

  const items = [
    { label: 'Jobs', value: stats.totalJobs ?? 0, color: 'text-blue-400' },
    { label: 'Passing', value: stats.successfulJobs ?? 0, color: 'text-green-400' },
    { label: 'Failing', value: stats.failedJobs ?? 0, color: 'text-red-400' },
    { label: 'Building', value: stats.buildingJobs ?? 0, color: 'text-yellow-400' },
    { label: 'Builds 24h', value: stats.buildsLast24h ?? 0, color: 'text-purple-400' },
    { label: 'Health', value: `${stats.averageHealthScore ?? 0}%`, color: 'text-cyan-400' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 h-full content-center p-2">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className={clsx('text-lg font-bold', item.color)}>{item.value}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

// Jenkins Jobs Widget — displays a list of jobs with status indicators
function JenkinsJobsWidget({ data }: { data: unknown }) {
  const jobs = (Array.isArray(data) ? data : (data as { jobs?: unknown[] })?.jobs || []) as Array<{
    name: string; fullName?: string; color?: string; buildable?: boolean;
    healthReport?: Array<{ score: number; description?: string }>;
    lastBuild?: { number: number; result?: string; timestamp?: number };
  }>;
  if (!jobs.length) return <div className="text-gray-400 text-center text-sm">No jobs found</div>;

  const colorMap: Record<string, string> = {
    blue: 'bg-green-500', blue_anime: 'bg-green-400 animate-pulse',
    red: 'bg-red-500', red_anime: 'bg-red-400 animate-pulse',
    yellow: 'bg-yellow-500', yellow_anime: 'bg-yellow-400 animate-pulse',
    grey: 'bg-gray-500', disabled: 'bg-gray-600', notbuilt: 'bg-gray-500',
    aborted: 'bg-gray-500',
  };

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white">
          <tr className="text-gray-500 border-b">
            <th className="text-left py-1 px-2">Job</th>
            <th className="text-center py-1 px-1">Status</th>
            <th className="text-center py-1 px-1">Health</th>
            <th className="text-right py-1 px-2">Last #</th>
          </tr>
        </thead>
        <tbody>
          {jobs.slice(0, 15).map((job) => (
            <tr key={job.fullName || job.name} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-1 px-2 truncate max-w-[120px]" title={job.fullName || job.name}>
                {job.name}
              </td>
              <td className="py-1 px-1 text-center">
                <span className={clsx('inline-block w-2.5 h-2.5 rounded-full', colorMap[job.color || 'grey'] || 'bg-gray-400')} />
              </td>
              <td className="py-1 px-1 text-center text-gray-500">
                {job.healthReport?.[0]?.score != null ? `${job.healthReport[0].score}%` : '—'}
              </td>
              <td className="py-1 px-2 text-right text-gray-500">
                {job.lastBuild ? `#${job.lastBuild.number}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Main Dynamic Widget Renderer
export function DynamicWidgetRenderer({ 
  widget, 
  isEditMode = false,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleLock,
}: DynamicWidgetRendererProps) {
  const [data, setData] = useState<unknown>(widget.cachedData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [transformInfo, setTransformInfo] = useState<TransformedData | null>(null)
  
  // Use ref to avoid stale closures while keeping callback stable
  const widgetRef = useRef(widget)
  widgetRef.current = widget
  
  // Stabilize widget ID to prevent recursive calls
  const widgetId = widget.id
  
  const loadData = useCallback(async () => {
    const currentWidget = widgetRef.current
    
    // Skip fetch for static/none providers — use dataProviderConfig as data
    if (currentWidget.dataProviderType === 'Static' || currentWidget.dataProviderType === 'None') {
      const staticData = currentWidget.dataProviderConfig?.staticData 
        || currentWidget.cachedData 
        || currentWidget.dataProviderConfig 
        || null
      setData(staticData)
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    setError(null)
    try {
      let result = await fetchWidgetData(currentWidget)
      
      // Apply Azure Metrics transformation if this is Azure Metrics data
      if (result && currentWidget.dataProviderType === 'AzureMetrics') {
        result = autoTransformAzureMetrics(result, currentWidget.widgetType)
        console.log(`Azure Metrics transformed for ${currentWidget.widgetType}:`, result)
      }
      
      // Apply AI data transform if we have data
      if (result) {
        try {
          const transformed = await aiDataTransformService.transformForWidget(
            result, 
            currentWidget.widgetType,
            true // Use AI when available
          )
          setData(transformed.data)
          setTransformInfo(transformed)
        } catch {
          // Fallback to raw data if transform fails
          setData(result)
        }
      } else {
        setData(result)
      }
    } catch (err) {
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [widgetId]) // Only depend on widget ID to prevent recursive calls
  
  useEffect(() => {
    loadData()
    
    // Set up refresh interval
    if (widget.refreshIntervalSeconds > 0) {
      const interval = setInterval(loadData, widget.refreshIntervalSeconds * 1000)
      return () => clearInterval(interval)
    }
  }, [loadData, widget.refreshIntervalSeconds])
  
  const config = widget.widgetConfig || {}
  
  // Render widget content based on type
  const renderContent = useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      )
    }
    
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-500">
          <AlertCircle className="w-6 h-6 mb-1" />
          <span className="text-xs">{error}</span>
        </div>
      )
    }
    
    const { widgetType } = widget
    
    // Route to appropriate renderer
    switch (widgetType) {
      case 'metric-card':
      case 'kpi':
        return <MetricWidget data={data} config={config} />
      case 'gauge':
        return <GaugeWidget data={data} config={config} />
      case 'line-chart':
      case 'bar-chart':
      case 'doughnut-chart':
      case 'pie-chart':
      case 'area-chart':
      case 'azure-metrics':
        return <ChartWidget data={data} config={config} type={widgetType} />
      case 'data-table':
        return <TableWidget data={data} config={config} />
      case 'status-list':
        return <StatusListWidget data={data} />
      case 'logs-viewer':
        return <LogsWidget data={data} />
      case 'custom-html':
        return <HtmlWidget data={data} config={config} />
      case 'timeline':
        return <TimelineWidget data={data} />
      case 'map':
        return <MapWidget data={data} config={config} />
      case 'jenkins-stats':
        return <JenkinsStatsWidget data={data} />
      case 'jenkins-jobs':
        return <JenkinsJobsWidget data={data} />
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <span className="text-sm">Unknown widget type: {widgetType}</span>
          </div>
        )
    }
  }, [isLoading, error, widget, data, config])
  
  return (
    <div className={clsx(
      'bg-white rounded-lg shadow-sm border h-full flex flex-col',
      isEditMode ? 'border-blue-200' : 'border-gray-200',
      widget.isLocked && isEditMode && 'opacity-75'
    )}>
      {/* Widget Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-800 truncate">{widget.title}</h3>
            {transformInfo?.confidence && transformInfo.confidence > 0.5 && (
              <span 
                className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                title={`AI mapped ${Math.round(transformInfo.confidence * 100)}% fields`}
              >
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </span>
            )}
          </div>
          {widget.subtitle && (
            <p className="text-xs text-gray-500 truncate">{widget.subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          {widget.refreshIntervalSeconds > 0 && (
            <button 
              onClick={loadData}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          
          {isEditMode && (
            <>
              {/* Lock/Unlock button */}
              <button
                onClick={() => onToggleLock?.(widget.id)}
                className="p-1 text-gray-400 hover:text-amber-500 rounded"
                title={widget.isLocked ? 'Unlock widget' : 'Lock widget'}
              >
                {widget.isLocked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
              
              {/* Configure/Edit button - only show if onEdit is provided */}
              {onEdit && (
                <button
                  onClick={() => onEdit(widget)}
                  className="p-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Configure widget"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
              
              {/* Delete button - directly visible */}
              <button
                onClick={() => onDelete?.(widget.id)}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Delete widget"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              
              {/* More options dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50">
                    <button
                      onClick={() => { onDuplicate?.(widget); setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      <Copy className="w-4 h-4" /> Duplicate
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Widget Content */}
      <div className="flex-1 overflow-hidden p-2">
        {renderContent}
      </div>
    </div>
  )
}

export default DynamicWidgetRenderer
