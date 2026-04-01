import { aiService } from './aiService';
import api from './api';

// Default Azure Log Analytics queries for V1 services
export const V1_LOG_ANALYTICS_QUERIES = {
  // Application performance monitoring
  appPerformance: {
    name: 'V1 Application Performance',
    description: 'Performance metrics for V1 services',
    query: `
requests
| where timestamp > ago(1h)
| where cloud_RoleName contains "V1" or cloud_RoleName contains "VisualOne"
| summarize 
    TotalRequests = count(),
    AvgDuration = avg(duration),
    P95Duration = percentile(duration, 95),
    FailedRequests = countif(success == false)
  by bin(timestamp, 5m), cloud_RoleName
| order by timestamp desc
`,
    widgetType: 'line-chart',
    fieldMapping: {
      x: 'timestamp',
      y: 'TotalRequests',
      series: 'cloud_RoleName'
    }
  },

  // Error tracking
  errorsByService: {
    name: 'V1 Errors by Service',
    description: 'Error distribution across V1 services',
    query: `
exceptions
| where timestamp > ago(24h)
| where cloud_RoleName contains "V1" or cloud_RoleName contains "VisualOne"
| summarize ErrorCount = count() by cloud_RoleName, type
| order by ErrorCount desc
| take 20
`,
    widgetType: 'bar-chart',
    fieldMapping: {
      label: 'cloud_RoleName',
      value: 'ErrorCount'
    }
  },

  // Request success rate
  successRate: {
    name: 'V1 Success Rate',
    description: 'Request success rate for V1 services',
    query: `
requests
| where timestamp > ago(1h)
| where cloud_RoleName contains "V1" or cloud_RoleName contains "VisualOne"
| summarize 
    TotalRequests = count(),
    SuccessCount = countif(success == true),
    SuccessRate = round(100.0 * countif(success == true) / count(), 2)
  by cloud_RoleName
`,
    widgetType: 'gauge',
    fieldMapping: {
      value: 'SuccessRate',
      label: 'cloud_RoleName'
    }
  },

  // Dependency health
  dependencyHealth: {
    name: 'V1 Dependency Health',
    description: 'External dependency call statistics',
    query: `
dependencies
| where timestamp > ago(1h)
| where cloud_RoleName contains "V1" or cloud_RoleName contains "VisualOne"
| summarize 
    CallCount = count(),
    AvgDuration = avg(duration),
    FailedCalls = countif(success == false),
    FailureRate = round(100.0 * countif(success == false) / count(), 2)
  by target, type
| order by FailureRate desc
`,
    widgetType: 'data-table',
    fieldMapping: {
      columns: ['target', 'type', 'CallCount', 'AvgDuration', 'FailedCalls', 'FailureRate']
    }
  },

  // Active users
  activeUsers: {
    name: 'V1 Active Users',
    description: 'Active user count over time',
    query: `
pageViews
| where timestamp > ago(24h)
| where cloud_RoleName contains "V1" or cloud_RoleName contains "VisualOne"
| summarize UserCount = dcount(user_Id) by bin(timestamp, 1h)
| order by timestamp asc
`,
    widgetType: 'area-chart',
    fieldMapping: {
      x: 'timestamp',
      y: 'UserCount'
    }
  },

  // Top slow requests
  slowRequests: {
    name: 'V1 Slow Requests',
    description: 'Slowest API endpoints',
    query: `
requests
| where timestamp > ago(1h)
| where cloud_RoleName contains "V1" or cloud_RoleName contains "VisualOne"
| where duration > 1000
| summarize 
    AvgDuration = avg(duration),
    MaxDuration = max(duration),
    CallCount = count()
  by name
| order by AvgDuration desc
| take 10
`,
    widgetType: 'status-list',
    fieldMapping: {
      label: 'name',
      value: 'AvgDuration',
      status: 'CallCount'
    }
  },

  // Browser distribution
  browserDistribution: {
    name: 'V1 Browser Distribution',
    description: 'User browser distribution',
    query: `
pageViews
| where timestamp > ago(7d)
| where cloud_RoleName contains "V1" or cloud_RoleName contains "VisualOne"
| summarize Count = count() by client_Browser
| order by Count desc
| take 10
`,
    widgetType: 'pie-chart',
    fieldMapping: {
      label: 'client_Browser',
      value: 'Count'
    }
  },

  // KPI Summary
  kpiSummary: {
    name: 'V1 KPI Summary',
    description: 'Key performance indicators',
    query: `
requests
| where timestamp > ago(1h)
| where cloud_RoleName contains "V1" or cloud_RoleName contains "VisualOne"
| summarize 
    TotalRequests = count(),
    AvgResponseTime = round(avg(duration), 0),
    SuccessRate = round(100.0 * countif(success == true) / count(), 1),
    ActiveUsers = dcount(user_Id)
`,
    widgetType: 'kpi',
    fieldMapping: {
      value: 'TotalRequests',
      label: 'Total Requests'
    }
  }
};

// Widget field requirements for AI mapping
export const WIDGET_FIELD_REQUIREMENTS: Record<string, {
  required: string[];
  optional: string[];
  dataType: 'array' | 'object' | 'single';
  description: string;
}> = {
  'kpi': {
    required: ['value'],
    optional: ['label', 'change', 'trend', 'prefix', 'suffix'],
    dataType: 'object',
    description: 'Key Performance Indicator with single value'
  },
  'metric-card': {
    required: ['value'],
    optional: ['label', 'change', 'trend', 'prefix', 'suffix', 'icon'],
    dataType: 'object',
    description: 'Metric card with value and optional trend'
  },
  'gauge': {
    required: ['value'],
    optional: ['min', 'max', 'target', 'label', 'thresholds'],
    dataType: 'object',
    description: 'Gauge chart showing progress or percentage'
  },
  'line-chart': {
    required: ['x', 'y'],
    optional: ['series', 'label', 'color'],
    dataType: 'array',
    description: 'Line chart for time series or trend data'
  },
  'area-chart': {
    required: ['x', 'y'],
    optional: ['series', 'label', 'color', 'filled'],
    dataType: 'array',
    description: 'Area chart for cumulative data visualization'
  },
  'bar-chart': {
    required: ['label', 'value'],
    optional: ['color', 'group', 'series'],
    dataType: 'array',
    description: 'Bar chart for categorical comparisons'
  },
  'pie-chart': {
    required: ['label', 'value'],
    optional: ['color'],
    dataType: 'array',
    description: 'Pie chart for proportional data'
  },
  'doughnut-chart': {
    required: ['label', 'value'],
    optional: ['color', 'centerLabel'],
    dataType: 'array',
    description: 'Donut chart for proportional data with center space'
  },
  'data-table': {
    required: ['columns', 'rows'],
    optional: ['sortable', 'filterable', 'pageSize'],
    dataType: 'array',
    description: 'Data table for tabular data display'
  },
  'status-list': {
    required: ['items'],
    optional: ['showStatus', 'showValue'],
    dataType: 'array',
    description: 'List of items with status indicators'
  },
  'logs-viewer': {
    required: ['logs'],
    optional: ['timestamp', 'level', 'message', 'source'],
    dataType: 'array',
    description: 'Log viewer for application logs'
  },
  'timeline': {
    required: ['events'],
    optional: ['timestamp', 'title', 'description'],
    dataType: 'array',
    description: 'Timeline for event sequences'
  },
  'map': {
    required: ['markers'],
    optional: ['lat', 'lng', 'label', 'zoom'],
    dataType: 'array',
    description: 'Map with location markers'
  }
};

// Interface for transformed data
export interface TransformedData {
  data: unknown;
  fieldMappings: Record<string, string>;
  dataType: 'array' | 'object' | 'single';
  sampleValues: Record<string, unknown>;
  confidence: number;
  aiSuggestions?: string;
  warnings?: string[];
}

// AI-powered data transformation service
export const aiDataTransformService = {
  /**
   * Auto-detect and transform data for a widget type
   */
  async transformForWidget(
    rawData: unknown,
    widgetType: string,
    useAI: boolean = true
  ): Promise<TransformedData> {
    const requirements = WIDGET_FIELD_REQUIREMENTS[widgetType];
    if (!requirements) {
      return {
        data: rawData,
        fieldMappings: {},
        dataType: 'object',
        sampleValues: {},
        confidence: 0,
        warnings: [`Unknown widget type: ${widgetType}`]
      };
    }

    // Analyze the data structure
    const analysis = analyzeDataStructure(rawData);
    
    // Try AI-powered mapping first if enabled
    if (useAI) {
      try {
        const aiResult = await aiService.suggestMappings(rawData, widgetType);
        if (aiResult.success && aiResult.mappings) {
          return {
            data: applyMappings(rawData, aiResult.mappings, requirements),
            fieldMappings: aiResult.mappings,
            dataType: requirements.dataType,
            sampleValues: extractSampleValues(rawData, aiResult.mappings),
            confidence: aiResult.confidence,
            aiSuggestions: aiResult.explanation
          };
        }
      } catch (error) {
        // Fall back to heuristic mapping
        console.log('AI mapping failed, using heuristic mapping:', error);
      }
    }

    // Use heuristic mapping
    const mappings = generateHeuristicMappings(analysis, requirements);
    return {
      data: applyMappings(rawData, mappings, requirements),
      fieldMappings: mappings,
      dataType: requirements.dataType,
      sampleValues: extractSampleValues(rawData, mappings),
      confidence: calculateConfidence(mappings, requirements),
      warnings: generateWarnings(mappings, requirements)
    };
  },

  /**
   * Execute a default V1 query and transform results
   */
  async executeV1Query(
    queryKey: keyof typeof V1_LOG_ANALYTICS_QUERIES,
    workspaceId: string,
    timeRange: string = '1h'
  ): Promise<TransformedData> {
    const queryDef = V1_LOG_ANALYTICS_QUERIES[queryKey];
    if (!queryDef) {
      throw new Error(`Unknown query key: ${queryKey}`);
    }

    try {
      const response = await api.post<{
        columns: { name: string; type: string }[];
        rows: Record<string, unknown>[];
        rowCount: number;
      }>('/DynamicDashboard/azure/loganalytics/query', {
        workspaceId,
        query: queryDef.query,
        timeRange
      });

      const { rows } = response.data;
      
      return this.transformForWidget(rows, queryDef.widgetType);
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  },

  /**
   * Get list of available V1 queries
   */
  getAvailableQueries(): Array<{
    key: string;
    name: string;
    description: string;
    widgetType: string;
  }> {
    return Object.entries(V1_LOG_ANALYTICS_QUERIES).map(([key, value]) => ({
      key,
      name: value.name,
      description: value.description,
      widgetType: value.widgetType
    }));
  },

  /**
   * Preview transformation with sample data
   */
  previewTransformation(
    rawData: unknown,
    widgetType: string
  ): {
    canTransform: boolean;
    previewData: unknown;
    mappingPreview: Record<string, { field: string; value: unknown }>;
    issues: string[];
  } {
    const requirements = WIDGET_FIELD_REQUIREMENTS[widgetType];
    if (!requirements) {
      return {
        canTransform: false,
        previewData: null,
        mappingPreview: {},
        issues: [`Unknown widget type: ${widgetType}`]
      };
    }

    const analysis = analyzeDataStructure(rawData);
    const mappings = generateHeuristicMappings(analysis, requirements);
    const issues: string[] = [];

    // Check for missing required fields
    for (const field of requirements.required) {
      if (!mappings[field]) {
        issues.push(`Missing required field mapping: ${field}`);
      }
    }

    // Generate preview
    const previewData = applyMappings(rawData, mappings, requirements);
    const mappingPreview: Record<string, { field: string; value: unknown }> = {};
    
    for (const [key, field] of Object.entries(mappings)) {
      mappingPreview[key] = {
        field,
        value: extractValue(rawData, field)
      };
    }

    return {
      canTransform: issues.length === 0,
      previewData,
      mappingPreview,
      issues
    };
  }
};

// Helper functions

interface DataAnalysis {
  isArray: boolean;
  isObject: boolean;
  fields: Array<{
    name: string;
    type: string;
    sampleValue: unknown;
    isNumeric: boolean;
    isDate: boolean;
    isString: boolean;
  }>;
  rowCount?: number;
}

function analyzeDataStructure(data: unknown): DataAnalysis {
  const analysis: DataAnalysis = {
    isArray: false,
    isObject: false,
    fields: []
  };

  if (Array.isArray(data)) {
    analysis.isArray = true;
    analysis.rowCount = data.length;
    
    if (data.length > 0) {
      const sample = data[0];
      if (typeof sample === 'object' && sample !== null) {
        analysis.fields = Object.entries(sample).map(([name, value]) => ({
          name,
          type: typeof value,
          sampleValue: value,
          isNumeric: typeof value === 'number' || !isNaN(Number(value)),
          isDate: value instanceof Date || isDateString(value),
          isString: typeof value === 'string'
        }));
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    analysis.isObject = true;
    analysis.fields = Object.entries(data).map(([name, value]) => ({
      name,
      type: typeof value,
      sampleValue: value,
      isNumeric: typeof value === 'number' || !isNaN(Number(value)),
      isDate: value instanceof Date || isDateString(value),
      isString: typeof value === 'string'
    }));
  }

  return analysis;
}

function isDateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/, // ISO date
    /^\d{4}\/\d{2}\/\d{2}/, // Slash date
    /^\w{3}\s+\d{1,2},?\s+\d{4}/, // "Jan 1, 2024"
  ];
  return datePatterns.some(pattern => pattern.test(value));
}

function generateHeuristicMappings(
  analysis: DataAnalysis,
  requirements: { required: string[]; optional: string[]; dataType: string }
): Record<string, string> {
  const mappings: Record<string, string> = {};
  
  // Field name similarity patterns
  const patterns: Record<string, RegExp[]> = {
    value: [/^value$/i, /^count$/i, /^total$/i, /^amount$/i, /^sum$/i, /^avg/i, /^average$/i],
    label: [/^label$/i, /^name$/i, /^title$/i, /^description$/i, /^category$/i],
    x: [/^timestamp$/i, /^time$/i, /^date$/i, /^x$/i, /^period$/i],
    y: [/^value$/i, /^count$/i, /^y$/i, /^metric$/i, /^amount$/i],
    series: [/^series$/i, /^group$/i, /^category$/i, /^type$/i, /role/i],
    change: [/^change$/i, /^delta$/i, /^diff$/i, /^trend$/i, /^percent/i],
    min: [/^min/i, /^minimum$/i],
    max: [/^max/i, /^maximum$/i],
    target: [/^target$/i, /^goal$/i, /^threshold$/i],
    color: [/^color$/i, /^colour$/i],
    status: [/^status$/i, /^state$/i, /^level$/i, /^severity$/i],
    timestamp: [/^timestamp$/i, /^time$/i, /^date$/i, /^created/i, /^updated/i],
    message: [/^message$/i, /^msg$/i, /^text$/i, /^content$/i, /^body$/i],
    level: [/^level$/i, /^severity$/i, /^type$/i, /^priority$/i],
  };

  // Map required fields first
  for (const requiredField of requirements.required) {
    const fieldPatterns = patterns[requiredField] || [new RegExp(`^${requiredField}$`, 'i')];
    
    // Find best matching field
    for (const field of analysis.fields) {
      if (mappings[requiredField]) break;
      
      for (const pattern of fieldPatterns) {
        if (pattern.test(field.name)) {
          mappings[requiredField] = field.name;
          break;
        }
      }
    }

    // If still not mapped, try type-based inference
    if (!mappings[requiredField]) {
      if (requiredField === 'value' || requiredField === 'y') {
        const numericField = analysis.fields.find(f => f.isNumeric && !mappings[f.name]);
        if (numericField) mappings[requiredField] = numericField.name;
      } else if (requiredField === 'x' || requiredField === 'timestamp') {
        const dateField = analysis.fields.find(f => f.isDate && !mappings[f.name]);
        if (dateField) mappings[requiredField] = dateField.name;
      } else if (requiredField === 'label' || requiredField === 'series') {
        const stringField = analysis.fields.find(f => f.isString && !f.isDate && !mappings[f.name]);
        if (stringField) mappings[requiredField] = stringField.name;
      }
    }
  }

  // Map optional fields
  for (const optionalField of requirements.optional) {
    if (mappings[optionalField]) continue;
    
    const fieldPatterns = patterns[optionalField] || [new RegExp(`^${optionalField}$`, 'i')];
    
    for (const field of analysis.fields) {
      if (Object.values(mappings).includes(field.name)) continue;
      
      for (const pattern of fieldPatterns) {
        if (pattern.test(field.name)) {
          mappings[optionalField] = field.name;
          break;
        }
      }
      if (mappings[optionalField]) break;
    }
  }

  return mappings;
}

function applyMappings(
  data: unknown,
  mappings: Record<string, string>,
  requirements: { required: string[]; optional: string[]; dataType: string }
): unknown {
  if (requirements.dataType === 'array' && Array.isArray(data)) {
    return data.map(item => {
      if (typeof item !== 'object' || item === null) return item;
      
      const mapped: Record<string, unknown> = {};
      for (const [targetField, sourceField] of Object.entries(mappings)) {
        if (sourceField in (item as Record<string, unknown>)) {
          mapped[targetField] = (item as Record<string, unknown>)[sourceField];
        }
      }
      return { ...item, ...mapped };
    });
  } else if (typeof data === 'object' && data !== null) {
    const mapped: Record<string, unknown> = {};
    for (const [targetField, sourceField] of Object.entries(mappings)) {
      if (sourceField in (data as Record<string, unknown>)) {
        mapped[targetField] = (data as Record<string, unknown>)[sourceField];
      }
    }
    return { ...data as Record<string, unknown>, ...mapped };
  }
  
  return data;
}

function extractSampleValues(
  data: unknown,
  mappings: Record<string, string>
): Record<string, unknown> {
  const samples: Record<string, unknown> = {};
  
  const sample = Array.isArray(data) && data.length > 0 
    ? data[0] 
    : data;

  if (typeof sample === 'object' && sample !== null) {
    for (const [key, field] of Object.entries(mappings)) {
      if (field in (sample as Record<string, unknown>)) {
        samples[key] = (sample as Record<string, unknown>)[field];
      }
    }
  }

  return samples;
}

function extractValue(data: unknown, field: string): unknown {
  if (Array.isArray(data) && data.length > 0) {
    const sample = data[0];
    if (typeof sample === 'object' && sample !== null) {
      return (sample as Record<string, unknown>)[field];
    }
  } else if (typeof data === 'object' && data !== null) {
    return (data as Record<string, unknown>)[field];
  }
  return undefined;
}

function calculateConfidence(
  mappings: Record<string, string>,
  requirements: { required: string[]; optional: string[] }
): number {
  const requiredMapped = requirements.required.filter(f => mappings[f]).length;
  const optionalMapped = requirements.optional.filter(f => mappings[f]).length;
  
  const requiredScore = requirements.required.length > 0 
    ? (requiredMapped / requirements.required.length) * 0.7 
    : 0.7;
  const optionalScore = requirements.optional.length > 0 
    ? (optionalMapped / requirements.optional.length) * 0.3 
    : 0.3;
  
  return Math.round((requiredScore + optionalScore) * 100) / 100;
}

function generateWarnings(
  mappings: Record<string, string>,
  requirements: { required: string[]; optional: string[] }
): string[] {
  const warnings: string[] = [];
  
  for (const field of requirements.required) {
    if (!mappings[field]) {
      warnings.push(`Required field '${field}' could not be mapped automatically`);
    }
  }
  
  return warnings;
}

/**
 * Detect if data is Azure Metrics format
 * Azure Metrics format: [{ name, unit, timeseries: [{ timestamp, average, minimum, maximum, total, count }] }]
 */
function isAzureMetricsData(data: unknown): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;
  const first = data[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'name' in first &&
    'unit' in first &&
    'timeseries' in first &&
    Array.isArray((first as Record<string, unknown>).timeseries)
  );
}

/**
 * Transform Azure Metrics nested structure to flat chart-ready format
 * Converts: [{ name, unit, timeseries: [{ timestamp, average, ... }] }]
 * To: { labels: [...timestamps], datasets: [{ label, data: [...values] }] }
 */
export function transformAzureMetricsForChart(
  data: unknown[],
  valueField: 'average' | 'minimum' | 'maximum' | 'total' | 'count' = 'average'
): { labels: string[]; datasets: { label: string; data: number[]; unit: string }[] } {
  const allTimestamps = new Set<string>();
  const metricsData: Array<{
    name: string;
    unit: string;
    values: Map<string, number>;
  }> = [];

  // Collect all timestamps and metric values
  for (const metric of data) {
    const m = metric as { name: string; unit: string; timeseries: Array<Record<string, unknown>> };
    const values = new Map<string, number>();
    
    if (m.timeseries && Array.isArray(m.timeseries)) {
      for (const point of m.timeseries) {
        const ts = String(point.timestamp);
        allTimestamps.add(ts);
        const val = point[valueField];
        if (typeof val === 'number') {
          values.set(ts, val);
        }
      }
    }
    
    metricsData.push({ name: m.name, unit: m.unit, values });
  }

  // Sort timestamps
  const sortedTimestamps = Array.from(allTimestamps).sort();
  
  // Format labels (show time only for readability)
  const labels = sortedTimestamps.map(ts => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return ts.slice(11, 16); // Fallback: extract HH:MM from ISO
    }
  });

  // Build datasets
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const datasets = metricsData.map((metric, idx) => ({
    label: metric.name,
    unit: metric.unit,
    data: sortedTimestamps.map(ts => metric.values.get(ts) ?? 0),
    borderColor: colors[idx % colors.length],
    backgroundColor: `${colors[idx % colors.length]}40`,
    fill: false,
    tension: 0.3,
  }));

  return { labels, datasets };
}

/**
 * Transform Azure Metrics to table format (flattened rows)
 */
export function transformAzureMetricsForTable(
  data: unknown[]
): { columns: { key: string; label: string }[]; rows: Record<string, unknown>[] } {
  const rows: Record<string, unknown>[] = [];
  
  for (const metric of data) {
    const m = metric as { name: string; unit: string; timeseries: Array<Record<string, unknown>> };
    
    if (m.timeseries && Array.isArray(m.timeseries)) {
      for (const point of m.timeseries) {
        rows.push({
          metricName: m.name,
          unit: m.unit,
          timestamp: point.timestamp,
          average: point.average,
          minimum: point.minimum,
          maximum: point.maximum,
          total: point.total,
          count: point.count,
        });
      }
    }
  }

  const columns = [
    { key: 'metricName', label: 'Metric' },
    { key: 'timestamp', label: 'Time' },
    { key: 'average', label: 'Average' },
    { key: 'minimum', label: 'Min' },
    { key: 'maximum', label: 'Max' },
    { key: 'total', label: 'Total' },
  ];

  return { columns, rows };
}

/**
 * Transform Azure Metrics to metric card format (latest/summary values)
 */
export function transformAzureMetricsForKPI(
  data: unknown[]
): { value: number; label: string; unit: string; change?: number; additionalMetrics?: Record<string, number> } {
  const firstMetric = data[0] as { name: string; unit: string; timeseries: Array<Record<string, unknown>> } | undefined;
  
  if (!firstMetric?.timeseries?.length) {
    return { value: 0, label: 'No Data', unit: '' };
  }

  // Get latest value
  const timeseries = firstMetric.timeseries;
  const latestPoint = timeseries[timeseries.length - 1];
  const previousPoint = timeseries.length > 1 ? timeseries[timeseries.length - 2] : null;
  
  const currentValue = (latestPoint.average ?? latestPoint.total ?? 0) as number;
  const previousValue = previousPoint ? (previousPoint.average ?? previousPoint.total ?? 0) as number : null;
  
  const change = previousValue !== null && previousValue !== 0
    ? ((currentValue - previousValue) / previousValue) * 100
    : undefined;

  // Collect additional metrics if multiple metrics present
  const additionalMetrics: Record<string, number> = {};
  for (let i = 1; i < Math.min(data.length, 4); i++) {
    const m = data[i] as { name: string; timeseries: Array<Record<string, unknown>> };
    if (m?.timeseries?.length) {
      const lastVal = m.timeseries[m.timeseries.length - 1];
      additionalMetrics[m.name] = (lastVal.average ?? lastVal.total ?? 0) as number;
    }
  }

  return {
    value: currentValue,
    label: firstMetric.name,
    unit: firstMetric.unit,
    change,
    additionalMetrics: Object.keys(additionalMetrics).length > 0 ? additionalMetrics : undefined,
  };
}

/**
 * Auto-transform Azure Metrics data based on target widget type
 */
export function autoTransformAzureMetrics(
  data: unknown,
  widgetType: string
): unknown {
  if (!isAzureMetricsData(data)) {
    return data; // Not Azure Metrics format, return as-is
  }

  const metricsData = data as unknown[];
  
  switch (widgetType) {
    case 'line-chart':
    case 'area-chart':
      return transformAzureMetricsForChart(metricsData, 'average');
    
    case 'bar-chart':
      // For bar chart, show latest values per metric
      return {
        labels: metricsData.map(m => (m as { name: string }).name),
        datasets: [{
          label: 'Latest Value',
          data: metricsData.map(m => {
            const ts = (m as { timeseries: Array<{ average?: number }> }).timeseries;
            return ts?.length ? (ts[ts.length - 1].average ?? 0) : 0;
          }),
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].slice(0, metricsData.length),
        }],
      };
    
    case 'data-table':
      return transformAzureMetricsForTable(metricsData);
    
    case 'metric-card':
    case 'kpi':
    case 'gauge':
      return transformAzureMetricsForKPI(metricsData);
    
    default:
      // For unknown types, flatten the data
      return transformAzureMetricsForTable(metricsData).rows;
  }
}

// ============================================================================
// Widget Data Model Templates for AI Mapping
// ============================================================================

/**
 * Complete widget data model definitions with TypeScript interfaces and sample data
 * Used for AI prompt generation to map raw data to widget-compatible format
 */
export const WIDGET_DATA_MODELS: Record<string, {
  name: string;
  description: string;
  interface: string;
  sampleData: unknown;
  aiPromptHint: string;
}> = {
  'kpi': {
    name: 'KPI Card',
    description: 'Single value display with optional trend indicator',
    interface: `interface KPIData {
  value: number | string;      // Required: The main value to display
  label?: string;              // Optional: Label/title for the KPI
  change?: number;             // Optional: Change from previous period (e.g., +5.2)
  trend?: 'up' | 'down' | 'flat'; // Optional: Trend direction
  prefix?: string;             // Optional: Prefix (e.g., '$', '€')
  suffix?: string;             // Optional: Suffix (e.g., '%', 'ms')
}`,
    sampleData: {
      value: 1234,
      label: 'Total Revenue',
      change: 12.5,
      trend: 'up',
      prefix: '$',
      suffix: ''
    },
    aiPromptHint: 'Extract a single numeric value as the main KPI. Look for totals, counts, sums, or key metrics.'
  },

  'metric-card': {
    name: 'Metric Card',
    description: 'Enhanced metric display with icon and trend',
    interface: `interface MetricCardData {
  value: number | string;      // Required: The main metric value
  label?: string;              // Optional: Metric name/label
  change?: number;             // Optional: Percentage change
  trend?: 'up' | 'down' | 'flat'; // Optional: Trend direction
  prefix?: string;             // Optional: Value prefix
  suffix?: string;             // Optional: Value suffix
  icon?: string;               // Optional: Icon name (lucide icons)
}`,
    sampleData: {
      value: 98.5,
      label: 'Uptime',
      change: 0.5,
      trend: 'up',
      suffix: '%',
      icon: 'Activity'
    },
    aiPromptHint: 'Find the primary metric value. Calculate change if historical data available.'
  },

  'gauge': {
    name: 'Gauge Chart',
    description: 'Progress or percentage visualization',
    interface: `interface GaugeData {
  value: number;               // Required: Current value (0-100 for percentage)
  min?: number;                // Optional: Minimum value (default: 0)
  max?: number;                // Optional: Maximum value (default: 100)
  target?: number;             // Optional: Target/goal value
  label?: string;              // Optional: Gauge label
  thresholds?: {               // Optional: Color thresholds
    warning: number;
    critical: number;
  };
}`,
    sampleData: {
      value: 75,
      min: 0,
      max: 100,
      target: 90,
      label: 'CPU Usage',
      thresholds: { warning: 70, critical: 90 }
    },
    aiPromptHint: 'Find a percentage or ratio value. Identify min/max bounds if available.'
  },

  'line-chart': {
    name: 'Line Chart',
    description: 'Time series or trend data visualization',
    interface: `interface LineChartData {
  data: Array<{
    x: string | number | Date;  // Required: X-axis value (timestamp/category)
    y: number;                  // Required: Y-axis value
    series?: string;            // Optional: Series name for multi-line
  }>;
  // OR Chart.js format:
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
  }>;
}`,
    sampleData: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [{
        label: 'Revenue',
        data: [1200, 1900, 3000, 5000, 4200],
        borderColor: '#3b82f6'
      }]
    },
    aiPromptHint: 'Extract time-series data. Group by timestamp/date for x-axis, numeric values for y-axis.'
  },

  'area-chart': {
    name: 'Area Chart',
    description: 'Stacked or filled area visualization',
    interface: `interface AreaChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    fill?: boolean | string;
  }>;
}`,
    sampleData: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      datasets: [{
        label: 'Users',
        data: [120, 190, 300, 500, 420],
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        fill: true
      }]
    },
    aiPromptHint: 'Similar to line chart. Use for cumulative or stacked data visualization.'
  },

  'bar-chart': {
    name: 'Bar Chart',
    description: 'Categorical comparison visualization',
    interface: `interface BarChartData {
  data: Array<{
    label: string;             // Required: Category name
    value: number;             // Required: Bar value
    color?: string;            // Optional: Bar color
    group?: string;            // Optional: Group for stacked/grouped bars
  }>;
  // OR Chart.js format:
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
  }>;
}`,
    sampleData: {
      labels: ['Product A', 'Product B', 'Product C'],
      datasets: [{
        label: 'Sales',
        data: [450, 320, 280],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
      }]
    },
    aiPromptHint: 'Group data by category. Use category names as labels, counts/sums as values.'
  },

  'pie-chart': {
    name: 'Pie Chart',
    description: 'Proportional data distribution',
    interface: `interface PieChartData {
  data: Array<{
    label: string;             // Required: Slice label
    value: number;             // Required: Slice value
    color?: string;            // Optional: Slice color
  }>;
  // OR Chart.js format:
  labels: string[];
  datasets: Array<{
    data: number[];
    backgroundColor?: string[];
  }>;
}`,
    sampleData: {
      labels: ['Desktop', 'Mobile', 'Tablet'],
      datasets: [{
        data: [65, 25, 10],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b']
      }]
    },
    aiPromptHint: 'Find categorical distribution data. Each category needs a label and numeric value.'
  },

  'doughnut-chart': {
    name: 'Doughnut Chart',
    description: 'Proportional data with center hole',
    interface: `interface DoughnutChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
    backgroundColor?: string[];
  }>;
  centerLabel?: string;        // Optional: Text in center
}`,
    sampleData: {
      labels: ['Completed', 'In Progress', 'Pending'],
      datasets: [{
        data: [45, 30, 25],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b']
      }],
      centerLabel: '100 Tasks'
    },
    aiPromptHint: 'Similar to pie chart. Use for status distributions or completion ratios.'
  },

  'data-table': {
    name: 'Data Table',
    description: 'Tabular data display with sorting/filtering',
    interface: `interface DataTableData {
  columns: Array<{
    key: string;               // Required: Column identifier
    label: string;             // Required: Column header text
    sortable?: boolean;        // Optional: Enable sorting
    type?: 'string' | 'number' | 'date'; // Optional: Data type
  }>;
  rows: Array<Record<string, unknown>>; // Required: Row data
  pageSize?: number;           // Optional: Rows per page
}`,
    sampleData: {
      columns: [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'value', label: 'Value', type: 'number' }
      ],
      rows: [
        { name: 'Item 1', status: 'Active', value: 100 },
        { name: 'Item 2', status: 'Pending', value: 250 }
      ],
      pageSize: 10
    },
    aiPromptHint: 'Convert array data to rows. Auto-detect columns from object keys.'
  },

  'status-list': {
    name: 'Status List',
    description: 'List of items with status indicators',
    interface: `interface StatusListData {
  items: Array<{
    label: string;             // Required: Item label
    value?: string | number;   // Optional: Item value
    status?: 'success' | 'warning' | 'error' | 'info'; // Optional: Status
    icon?: string;             // Optional: Icon name
  }>;
}`,
    sampleData: {
      items: [
        { label: 'API Server', status: 'success', value: '99.9%' },
        { label: 'Database', status: 'warning', value: '85%' },
        { label: 'Cache', status: 'success', value: '100%' }
      ]
    },
    aiPromptHint: 'Create list items with name/label and optional status. Map health/status fields.'
  },

  'logs-viewer': {
    name: 'Logs Viewer',
    description: 'Application log display',
    interface: `interface LogsViewerData {
  logs: Array<{
    timestamp: string | Date;  // Required: Log timestamp
    level: 'info' | 'warn' | 'error' | 'debug'; // Required: Log level
    message: string;           // Required: Log message
    source?: string;           // Optional: Log source/service
  }>;
}`,
    sampleData: {
      logs: [
        { timestamp: '2024-01-15T10:30:00Z', level: 'error', message: 'Connection failed', source: 'API' },
        { timestamp: '2024-01-15T10:29:00Z', level: 'info', message: 'User logged in', source: 'Auth' }
      ]
    },
    aiPromptHint: 'Extract log entries with timestamp, level (severity), and message.'
  },

  'timeline': {
    name: 'Timeline',
    description: 'Event sequence visualization',
    interface: `interface TimelineData {
  events: Array<{
    timestamp: string | Date;  // Required: Event time
    title: string;             // Required: Event title
    description?: string;      // Optional: Event details
    type?: string;             // Optional: Event type/category
  }>;
}`,
    sampleData: {
      events: [
        { timestamp: '2024-01-15T10:00:00Z', title: 'Deployment Started', type: 'deploy' },
        { timestamp: '2024-01-15T10:05:00Z', title: 'Tests Passed', type: 'test' },
        { timestamp: '2024-01-15T10:10:00Z', title: 'Deployment Complete', type: 'deploy' }
      ]
    },
    aiPromptHint: 'Extract timestamped events. Order by time, identify event types.'
  },

  'map': {
    name: 'Map View',
    description: 'Geographic location markers',
    interface: `interface MapData {
  markers: Array<{
    lat: number;               // Required: Latitude
    lng: number;               // Required: Longitude
    label?: string;            // Optional: Marker label
    value?: string | number;   // Optional: Associated value
  }>;
  center?: { lat: number; lng: number }; // Optional: Map center
  zoom?: number;               // Optional: Zoom level
}`,
    sampleData: {
      markers: [
        { lat: 40.7128, lng: -74.0060, label: 'New York', value: 125 },
        { lat: 34.0522, lng: -118.2437, label: 'Los Angeles', value: 89 }
      ],
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4
    },
    aiPromptHint: 'Extract latitude/longitude pairs. Associate labels and values with locations.'
  }
};

/**
 * Generate AI prompt for data mapping
 * @param rawData The raw data from the data source
 * @param widgetType The target widget type
 * @returns Formatted prompt string for AI
 */
export function generateAIDataMappingPrompt(
  rawData: unknown,
  widgetType: string
): string {
  const model = WIDGET_DATA_MODELS[widgetType];
  const requirements = WIDGET_FIELD_REQUIREMENTS[widgetType];
  
  if (!model || !requirements) {
    return `Transform the following data for a "${widgetType}" widget. Return JSON in a format suitable for the widget.`;
  }

  // Truncate large data for prompt
  let dataPreview = JSON.stringify(rawData, null, 2);
  if (dataPreview.length > 3000) {
    // Show first 10 items if array, or truncate
    if (Array.isArray(rawData)) {
      dataPreview = JSON.stringify(rawData.slice(0, 10), null, 2) + '\n// ... truncated';
    } else {
      dataPreview = dataPreview.substring(0, 3000) + '\n// ... truncated';
    }
  }

  return `You are a data transformation assistant. Transform the provided data to match the widget data model.

## Widget: ${model.name}
${model.description}

## Target TypeScript Interface:
\`\`\`typescript
${model.interface}
\`\`\`

## Required Fields: ${requirements.required.join(', ')}
## Optional Fields: ${requirements.optional.join(', ')}
## Data Type: ${requirements.dataType}

## Mapping Hint:
${model.aiPromptHint}

## Sample Output:
\`\`\`json
${JSON.stringify(model.sampleData, null, 2)}
\`\`\`

## Source Data:
\`\`\`json
${dataPreview}
\`\`\`

## Instructions:
1. Analyze the source data structure
2. Map fields to match the target interface
3. Transform values as needed (dates, numbers, strings)
4. Return ONLY valid JSON matching the interface
5. If data is an array, preserve the array structure

Return the transformed JSON:`;
}

/**
 * Generate field mapping suggestions using heuristic analysis
 * This analyzes the data structure and finds the best matches for widget fields
 */
export function generateFieldMappings(
  rawData: unknown,
  widgetType: string
): {
  mappings: Record<string, string>;
  confidence: number;
  suggestions: string[];
} {
  const requirements = WIDGET_FIELD_REQUIREMENTS[widgetType];
  if (!requirements) {
    return { 
      mappings: {}, 
      confidence: 0, 
      suggestions: [`Unknown widget type: ${widgetType}`] 
    };
  }
  
  const analysis = analyzeDataStructure(rawData);
  const mappings = generateHeuristicMappings(analysis, requirements);
  const suggestions: string[] = [];
  
  // Calculate confidence based on how many required fields were mapped
  const requiredMapped = requirements.required.filter(f => mappings[f]).length;
  const confidence = requiredMapped / requirements.required.length;
  
  // Generate suggestions
  if (confidence === 1) {
    suggestions.push('All required fields successfully mapped');
  } else {
    const missingRequired = requirements.required.filter(f => !mappings[f]);
    suggestions.push(`Missing required fields: ${missingRequired.join(', ')}`);
  }
  
  const optionalMapped = requirements.optional.filter(f => mappings[f]).length;
  if (optionalMapped > 0) {
    suggestions.push(`${optionalMapped} optional field(s) also mapped`);
  }
  
  return { mappings, confidence, suggestions };
}

/**
 * Get widget data model for a specific widget type
 */
export function getWidgetDataModel(widgetType: string): typeof WIDGET_DATA_MODELS[string] | null {
  return WIDGET_DATA_MODELS[widgetType] || null;
}

/**
 * List all available widget data models
 */
export function listWidgetDataModels(): Array<{
  type: string;
  name: string;
  description: string;
  requiredFields: string[];
}> {
  return Object.entries(WIDGET_DATA_MODELS).map(([type, model]) => ({
    type,
    name: model.name,
    description: model.description,
    requiredFields: WIDGET_FIELD_REQUIREMENTS[type]?.required || []
  }));
}

export default aiDataTransformService;
