import React, { useState, useMemo } from 'react';
import { 
  Target, Trash2, ArrowRight, CheckCircle, AlertCircle, 
  Database, Grid3X3, BarChart3, PieChart, Activity, 
  List, Clock, FileText
} from 'lucide-react';
import clsx from 'clsx';
import { JsonExplorer } from './JsonExplorer';

// Widget data requirements - defines what each widget type needs
export interface FieldMapping {
  path: string;
  type: string;
  sampleValue?: any;
}

export interface DataMapping {
  dataPath: string;           // Path to array/object in JSON (e.g., "$.data.items")
  fieldMappings: {
    [fieldName: string]: FieldMapping;
  };
}

export interface WidgetDataRequirement {
  name: string;
  icon: React.FC<{ className?: string }>;
  description: string;
  dataSourceType: 'array' | 'object' | 'single';
  requiredFields: {
    key: string;
    label: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'any';
    required: boolean;
  }[];
  optionalFields: {
    key: string;
    label: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'any';
  }[];
}

// Define data requirements for each widget type
export const WIDGET_DATA_REQUIREMENTS: Record<string, WidgetDataRequirement> = {
  MetricCard: {
    name: 'Metric Card',
    icon: Target,
    description: 'Displays a single metric value with optional trend',
    dataSourceType: 'object',
    requiredFields: [
      { key: 'value', label: 'Value', description: 'The main metric value to display', type: 'number', required: true },
    ],
    optionalFields: [
      { key: 'label', label: 'Label', description: 'Label text for the metric', type: 'string' },
      { key: 'trend', label: 'Trend', description: 'Trend percentage (positive/negative)', type: 'number' },
      { key: 'trendLabel', label: 'Trend Label', description: 'Text describing the trend', type: 'string' },
      { key: 'icon', label: 'Icon', description: 'Icon name to display', type: 'string' },
      { key: 'color', label: 'Color', description: 'Theme color for the card', type: 'string' },
    ],
  },
  BarChart: {
    name: 'Bar Chart',
    icon: BarChart3,
    description: 'Displays data as vertical or horizontal bars',
    dataSourceType: 'array',
    requiredFields: [
      { key: 'label', label: 'Category Label', description: 'Labels for each bar (X-axis)', type: 'string', required: true },
      { key: 'value', label: 'Value', description: 'Numeric values for bar heights', type: 'number', required: true },
    ],
    optionalFields: [
      { key: 'color', label: 'Bar Color', description: 'Color for each bar', type: 'string' },
      { key: 'group', label: 'Group/Series', description: 'For grouped bar charts', type: 'string' },
    ],
  },
  LineChart: {
    name: 'Line Chart',
    icon: Activity,
    description: 'Displays data as connected points over time',
    dataSourceType: 'array',
    requiredFields: [
      { key: 'x', label: 'X-Axis (Time/Category)', description: 'Values for X-axis', type: 'any', required: true },
      { key: 'y', label: 'Y-Axis (Value)', description: 'Numeric values for Y-axis', type: 'number', required: true },
    ],
    optionalFields: [
      { key: 'series', label: 'Series Name', description: 'For multiple lines', type: 'string' },
      { key: 'color', label: 'Line Color', description: 'Color for the line', type: 'string' },
    ],
  },
  PieChart: {
    name: 'Pie/Donut Chart',
    icon: PieChart,
    description: 'Displays data as proportional slices',
    dataSourceType: 'array',
    requiredFields: [
      { key: 'label', label: 'Segment Label', description: 'Name of each segment', type: 'string', required: true },
      { key: 'value', label: 'Value', description: 'Numeric value for segment size', type: 'number', required: true },
    ],
    optionalFields: [
      { key: 'color', label: 'Segment Color', description: 'Color for each segment', type: 'string' },
    ],
  },
  DataGrid: {
    name: 'Data Grid/Table',
    icon: Grid3X3,
    description: 'Displays data in a tabular format',
    dataSourceType: 'array',
    requiredFields: [],
    optionalFields: [
      { key: 'columns', label: 'Dynamic Columns', description: 'Auto-detect columns from data', type: 'any' },
    ],
  },
  StatusList: {
    name: 'Status List',
    icon: List,
    description: 'Displays a list of items with status indicators',
    dataSourceType: 'array',
    requiredFields: [
      { key: 'name', label: 'Item Name', description: 'Name/title of each item', type: 'string', required: true },
      { key: 'status', label: 'Status', description: 'Status indicator (success, warning, error)', type: 'string', required: true },
    ],
    optionalFields: [
      { key: 'description', label: 'Description', description: 'Additional details', type: 'string' },
      { key: 'time', label: 'Timestamp', description: 'When the status was updated', type: 'date' },
      { key: 'icon', label: 'Icon', description: 'Custom icon name', type: 'string' },
    ],
  },
  RecentActivity: {
    name: 'Activity/Timeline',
    icon: Clock,
    description: 'Displays chronological activity feed',
    dataSourceType: 'array',
    requiredFields: [
      { key: 'title', label: 'Activity Title', description: 'Title of the activity', type: 'string', required: true },
      { key: 'time', label: 'Timestamp', description: 'When the activity occurred', type: 'date', required: true },
    ],
    optionalFields: [
      { key: 'description', label: 'Description', description: 'Activity details', type: 'string' },
      { key: 'type', label: 'Activity Type', description: 'Type/category of activity', type: 'string' },
      { key: 'user', label: 'User', description: 'Who performed the activity', type: 'string' },
      { key: 'icon', label: 'Icon', description: 'Icon for the activity type', type: 'string' },
    ],
  },
  MarkdownContent: {
    name: 'Text/Markdown',
    icon: FileText,
    description: 'Displays formatted text or markdown content',
    dataSourceType: 'single',
    requiredFields: [
      { key: 'content', label: 'Content', description: 'Text or markdown content', type: 'string', required: true },
    ],
    optionalFields: [],
  },
};

interface DataFieldMapperProps {
  widgetType: string;
  data: any;
  value: DataMapping;
  onChange: (mapping: DataMapping) => void;
}

const getValueAtPath = (data: any, path: string): any => {
  if (!path || path === '$') return data;
  
  // Parse path like "$.items[0].name" or "$['key with space']"
  const parts = path.replace(/^\$\.?/, '').split(/\.|\[|\]/).filter(Boolean);
  let current = data;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    // Handle quoted keys
    const key = part.replace(/^['"]|['"]$/g, '');
    current = current[key];
  }
  
  return current;
};

export const DataFieldMapper: React.FC<DataFieldMapperProps> = ({
  widgetType,
  data,
  value,
  onChange,
}) => {
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [explorerSelectedPath, setExplorerSelectedPath] = useState<string>('');
  
  const requirements = WIDGET_DATA_REQUIREMENTS[widgetType];
  
  if (!requirements) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
        <AlertCircle className="w-4 h-4 inline mr-2" />
        Widget type "{widgetType}" doesn't have defined data requirements.
      </div>
    );
  }

  const allFields = [...requirements.requiredFields, ...requirements.optionalFields.map(f => ({ ...f, required: false }))];
  
  const handleDataPathSelect = (path: string, _selectedValue: any, type: string) => {
    // Check if selecting array for array-based widgets
    if (requirements.dataSourceType === 'array' && type === 'array') {
      onChange({
        ...value,
        dataPath: path,
      });
    } else if (requirements.dataSourceType === 'object' && type === 'object') {
      onChange({
        ...value,
        dataPath: path,
      });
    } else if (requirements.dataSourceType === 'single') {
      onChange({
        ...value,
        dataPath: path,
      });
    }
    setExplorerSelectedPath(path);
  };

  const handleFieldMapping = (fieldKey: string, path: string, type: string, sampleValue: any) => {
    const newMappings = {
      ...value.fieldMappings,
      [fieldKey]: { path, type, sampleValue },
    };
    onChange({
      ...value,
      fieldMappings: newMappings,
    });
    setActiveFieldKey(null);
  };

  const removeFieldMapping = (fieldKey: string) => {
    const newMappings = { ...value.fieldMappings };
    delete newMappings[fieldKey];
    onChange({
      ...value,
      fieldMappings: newMappings,
    });
  };

  // Get sample data based on selected data path
  const sampleData = useMemo(() => {
    if (!data || !value.dataPath) return null;
    const extracted = getValueAtPath(data, value.dataPath);
    if (Array.isArray(extracted) && extracted.length > 0) {
      return extracted[0]; // Show first item for field mapping
    }
    return extracted;
  }, [data, value.dataPath]);

  const Icon = requirements.icon;

  return (
    <div className="space-y-4">
      {/* Widget Type Info */}
      <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-800 dark:text-gray-200">{requirements.name}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">{requirements.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={clsx(
              'text-xs px-2 py-0.5 rounded-full',
              requirements.dataSourceType === 'array' && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
              requirements.dataSourceType === 'object' && 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
              requirements.dataSourceType === 'single' && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
            )}>
              Expects: {requirements.dataSourceType === 'array' ? 'Array of items' : requirements.dataSourceType === 'object' ? 'Single object' : 'Single value'}
            </span>
          </div>
        </div>
      </div>

      {/* Step 1: Select Data Source */}
      <div>
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
          Select Data Source
          {value.dataPath && <CheckCircle className="w-4 h-4 text-green-500" />}
        </h5>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Click on a{requirements.dataSourceType === 'array' ? 'n array' : requirements.dataSourceType === 'object' ? 'n object' : ' value'} in the explorer to use as your data source
        </p>
        
        <JsonExplorer
          data={data}
          onSelectPath={handleDataPathSelect}
          selectedPath={value.dataPath || explorerSelectedPath}
          title="Select Data Source"
          maxHeight="200px"
        />
        
        {value.dataPath && (
          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-green-600 dark:text-green-400">Data source selected:</span>
                <code className="ml-2 text-xs font-mono text-green-800 dark:text-green-300">{value.dataPath}</code>
              </div>
              <button
                onClick={() => onChange({ ...value, dataPath: '', fieldMappings: {} })}
                className="text-red-500 hover:text-red-600 p-1"
                title="Clear selection"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Map Fields */}
      {value.dataPath && sampleData && (
        <div>
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
            Map Fields
          </h5>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Map your data fields to widget properties. Click "Map" and select a field from the sample data.
          </p>

          <div className="space-y-2">
            {allFields.map((field) => {
              const mapping = value.fieldMappings[field.key];
              const isActive = activeFieldKey === field.key;
              
              return (
                <div key={field.key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className={clsx(
                    'flex items-center gap-3 p-3 transition-colors',
                    isActive ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-white dark:bg-gray-800'
                  )}>
                    {/* Field Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                          {field.label}
                        </span>
                        {field.required && (
                          <span className="text-xs text-red-500">*Required</span>
                        )}
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {field.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{field.description}</p>
                    </div>
                    
                    {/* Mapping Display or Button */}
                    {mapping ? (
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <code className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded max-w-[150px] truncate">
                          {mapping.path.replace(/^\$\.?/, '')}
                        </code>
                        <button
                          onClick={() => removeFieldMapping(field.key)}
                          className="text-red-500 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveFieldKey(isActive ? null : field.key)}
                        className={clsx(
                          'px-3 py-1.5 text-xs rounded-lg font-medium transition-colors',
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        )}
                      >
                        <Target className="w-3.5 h-3.5 inline mr-1" />
                        {isActive ? 'Selecting...' : 'Map'}
                      </button>
                    )}
                  </div>
                  
                  {/* Field Selector */}
                  {isActive && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-blue-50/50 dark:bg-blue-900/20">
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                        Select a field from the sample data:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(sampleData || {}).map(([key, val]) => (
                          <button
                            key={key}
                            onClick={() => handleFieldMapping(field.key, `${value.dataPath}.${key}`, typeof val, val)}
                            className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-xs hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{key}</span>
                            <span className="text-gray-400">:</span>
                            <span className="text-gray-500 truncate max-w-[80px]">
                              {typeof val === 'object' ? JSON.stringify(val).slice(0, 15) + '...' : String(val).slice(0, 15)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mapping Summary */}
      {Object.keys(value.fieldMappings).length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Database className="w-4 h-4" />
            Mapping Summary
          </h5>
          <pre className="text-xs font-mono text-gray-600 dark:text-gray-400 overflow-auto">
{JSON.stringify({
  dataPath: value.dataPath,
  fields: Object.fromEntries(
    Object.entries(value.fieldMappings).map(([k, v]) => [k, v.path])
  )
}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DataFieldMapper;
