import { useState, useMemo, useCallback, useEffect } from 'react';
import { Settings, Trash2, Plus, Eye, EyeOff, Sparkles, ArrowRight, MousePointer2 } from 'lucide-react';
import clsx from 'clsx';
import { JsonPathSelector, getValueAtPath, extractAllPaths } from './JsonPathSelector';
import { WIDGET_FIELD_REQUIREMENTS } from '../../services/aiDataTransformService';

// Data mapping entry
export interface DataMappingEntry {
  id: string;
  targetField: string;
  sourcePath: string;
  label?: string;
  transform?: 'none' | 'number' | 'string' | 'date' | 'boolean';
}

// Props for DataMappingEditor
interface DataMappingEditorProps {
  widgetType: string;
  responseData: unknown;
  mappings: DataMappingEntry[];
  onChange: (mappings: DataMappingEntry[]) => void;
  onPreviewMapped?: (data: unknown) => void;
}

// Available transforms
const TRANSFORMS = [
  { value: 'none', label: 'Auto' },
  { value: 'number', label: 'Number' },
  { value: 'string', label: 'String' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
];

// Field requirements type - matches WIDGET_FIELD_REQUIREMENTS structure
interface FieldRequirements {
  required: string[];
  optional: string[];
  dataType: 'array' | 'object' | 'single';
  description: string;
}

// Default field requirements for unknown widget types
const DEFAULT_FIELD_REQUIREMENTS: FieldRequirements = {
  required: ['value'],
  optional: ['label'],
  dataType: 'object',
  description: 'Custom widget type'
};

// Helper to get field requirements with proper typing
function getFieldRequirements(widgetType: string): FieldRequirements {
  const reqs = WIDGET_FIELD_REQUIREMENTS[widgetType];
  return reqs ? (reqs as FieldRequirements) : DEFAULT_FIELD_REQUIREMENTS;
}

// Generate unique ID
const generateId = () => `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function DataMappingEditor({
  widgetType,
  responseData,
  mappings,
  onChange,
  onPreviewMapped,
}: DataMappingEditorProps) {
  const [activeMapping, setActiveMapping] = useState<string | null>(null);
  const [showJsonTree, setShowJsonTree] = useState(true);
  const [autoDetectDone, setAutoDetectDone] = useState(false);

  // Get field requirements for the current widget type
  const fieldRequirements: FieldRequirements = useMemo(() => getFieldRequirements(widgetType), [widgetType]);

  // All available target fields (required + optional)
  const availableFields = useMemo(() => {
    const fields = [
      ...fieldRequirements.required.map(f => ({ name: f, required: true })),
      ...fieldRequirements.optional.map(f => ({ name: f, required: false })),
    ];
    return fields;
  }, [fieldRequirements]);

  // Auto-detect mappings based on field names
  const autoDetectMappings = useCallback(() => {
    if (!responseData) return;

    const allPaths = extractAllPaths(responseData);
    const newMappings: DataMappingEntry[] = [];

    // Mapping patterns for common field names
    const fieldPatterns: Record<string, RegExp[]> = {
      value: [/value$/i, /count$/i, /total$/i, /amount$/i, /sum$/i, /avg/i, /average$/i, /number$/i],
      label: [/label$/i, /name$/i, /title$/i, /description$/i, /category$/i, /^name$/i],
      x: [/timestamp$/i, /time$/i, /date$/i, /^x$/i, /period$/i, /datetime$/i],
      y: [/value$/i, /count$/i, /^y$/i, /metric$/i, /amount$/i],
      series: [/series$/i, /group$/i, /category$/i, /type$/i, /role$/i],
      change: [/change$/i, /delta$/i, /diff$/i, /trend$/i, /percent/i],
      status: [/status$/i, /state$/i, /level$/i, /severity$/i],
      timestamp: [/timestamp$/i, /time$/i, /date$/i, /created/i, /updated/i],
      message: [/message$/i, /msg$/i, /text$/i, /content$/i, /body$/i],
      level: [/level$/i, /severity$/i, /type$/i, /priority$/i],
    };

    for (const field of availableFields) {
      const patterns = fieldPatterns[field.name] || [new RegExp(`${field.name}$`, 'i')];
      
      // Find matching path
      for (const path of allPaths) {
        const pathParts = path.split(/[.\[\]]+/).filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        
        if (patterns.some(p => p.test(lastPart))) {
          // Check if this path yields a value
          const value = getValueAtPath(responseData, path);
          if (value !== undefined) {
            newMappings.push({
              id: generateId(),
              targetField: field.name,
              sourcePath: path,
              transform: 'none',
            });
            break; // Move to next field
          }
        }
      }
    }

    // Add any remaining required fields with empty mappings
    for (const field of fieldRequirements.required) {
      if (!newMappings.find(m => m.targetField === field)) {
        newMappings.push({
          id: generateId(),
          targetField: field,
          sourcePath: '',
          transform: 'none',
        });
      }
    }

    onChange(newMappings);
    setAutoDetectDone(true);
  }, [responseData, availableFields, fieldRequirements.required, onChange]);

  // Auto-detect on first load if no mappings exist
  useEffect(() => {
    if (mappings.length === 0 && responseData && !autoDetectDone) {
      autoDetectMappings();
    }
  }, [mappings.length, responseData, autoDetectDone, autoDetectMappings]);

  // Handle path selection from JSON tree
  const handlePathSelect = useCallback((path: string, value: unknown) => {
    if (!activeMapping) return;

    const updatedMappings = mappings.map(m => {
      if (m.id === activeMapping) {
        // Auto-detect transform based on value type
        let transform: DataMappingEntry['transform'] = 'none';
        if (typeof value === 'number') transform = 'number';
        else if (typeof value === 'boolean') transform = 'boolean';
        else if (typeof value === 'string' && isDateString(value)) transform = 'date';

        return { ...m, sourcePath: path, transform };
      }
      return m;
    });

    onChange(updatedMappings);
    setActiveMapping(null);
  }, [activeMapping, mappings, onChange]);

  // Add new mapping
  const addMapping = useCallback((field?: string) => {
    const targetField = field || (availableFields.find(f => !mappings.some(m => m.targetField === f.name))?.name) || 'custom';
    
    const newMapping: DataMappingEntry = {
      id: generateId(),
      targetField,
      sourcePath: '',
      transform: 'none',
    };

    onChange([...mappings, newMapping]);
    setActiveMapping(newMapping.id);
  }, [mappings, availableFields, onChange]);

  // Remove mapping
  const removeMapping = useCallback((id: string) => {
    onChange(mappings.filter(m => m.id !== id));
    if (activeMapping === id) setActiveMapping(null);
  }, [mappings, activeMapping, onChange]);

  // Update mapping
  const updateMapping = useCallback((id: string, updates: Partial<DataMappingEntry>) => {
    onChange(mappings.map(m => m.id === id ? { ...m, ...updates } : m));
  }, [mappings, onChange]);

  // Apply mappings to data and get preview
  const mappedPreview = useMemo(() => {
    if (!responseData) return null;

    try {
      const result: Record<string, unknown> = {};

      for (const mapping of mappings) {
        if (!mapping.sourcePath) continue;
        
        let value = getValueAtPath(responseData, mapping.sourcePath);
        
        // Apply transform
        if (value !== undefined && mapping.transform !== 'none') {
          value = applyTransform(value, mapping.transform || 'none');
        }

        result[mapping.targetField] = value;
      }

      return result;
    } catch {
      return null;
    }
  }, [responseData, mappings]);

  // Update preview when mappings change
  useEffect(() => {
    if (onPreviewMapped && mappedPreview) {
      onPreviewMapped(mappedPreview);
    }
  }, [mappedPreview, onPreviewMapped]);

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-700 dark:text-gray-300">Data Mapping</h3>
          <span className="text-xs text-gray-500">
            ({fieldRequirements.required.length} required, {fieldRequirements.optional.length} optional)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={autoDetectMappings}
            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="Auto-detect mappings based on field names"
          >
            <Sparkles className="w-3 h-3" />
            Auto-detect
          </button>
          <button
            type="button"
            onClick={() => setShowJsonTree(!showJsonTree)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {showJsonTree ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showJsonTree ? 'Hide JSON' : 'Show JSON'}
          </button>
        </div>
      </div>

      {/* Mapping entries */}
      <div className="space-y-2">
        {mappings.map((mapping) => {
          const fieldInfo = availableFields.find(f => f.name === mapping.targetField);
          const isRequired = fieldInfo?.required || false;
          const hasValue = mapping.sourcePath && getValueAtPath(responseData, mapping.sourcePath) !== undefined;
          const isActive = activeMapping === mapping.id;

          return (
            <div
              key={mapping.id}
              className={clsx(
                'border rounded-lg p-3 transition-all',
                isActive && 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20',
                !isActive && hasValue && 'border-green-200 dark:border-green-800',
                !isActive && !hasValue && isRequired && 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10',
                !isActive && !hasValue && !isRequired && 'border-gray-200 dark:border-gray-600'
              )}
            >
              <div className="flex items-center gap-3">
                {/* Target field */}
                <div className="w-28 flex-shrink-0">
                  <select
                    value={mapping.targetField}
                    onChange={(e) => updateMapping(mapping.id, { targetField: e.target.value })}
                    className={clsx(
                      'w-full px-2 py-1 text-sm border rounded font-medium',
                      isRequired && 'text-red-600 dark:text-red-400',
                      !isRequired && 'text-gray-700 dark:text-gray-300',
                      'dark:bg-gray-700 dark:border-gray-600'
                    )}
                  >
                    {availableFields.map(f => (
                      <option key={f.name} value={f.name}>
                        {f.name}{f.required ? ' *' : ''}
                      </option>
                    ))}
                    <option value="custom">custom</option>
                  </select>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

                {/* Source path input */}
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={mapping.sourcePath}
                      onChange={(e) => updateMapping(mapping.id, { sourcePath: e.target.value })}
                      placeholder="Click 'Select' or enter JSON path (e.g., $.data.value)"
                      className={clsx(
                        'flex-1 px-2 py-1 text-sm border rounded font-mono',
                        hasValue && 'border-green-300 dark:border-green-700',
                        !hasValue && 'border-gray-300 dark:border-gray-600',
                        'dark:bg-gray-700'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setActiveMapping(isActive ? null : mapping.id)}
                      className={clsx(
                        'px-2 py-1 text-xs rounded transition-colors flex items-center gap-1',
                        isActive && 'bg-blue-600 text-white',
                        !isActive && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                      )}
                    >
                      <MousePointer2 className="w-3 h-3" />
                      {isActive ? 'Selecting...' : 'Select'}
                    </button>
                  </div>
                </div>

                {/* Transform */}
                <select
                  value={mapping.transform || 'none'}
                  onChange={(e) => updateMapping(mapping.id, { transform: e.target.value as DataMappingEntry['transform'] })}
                  className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                >
                  {TRANSFORMS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>

                {/* Value preview */}
                <div className="w-24 text-xs text-gray-500 truncate flex-shrink-0">
                  {hasValue ? (
                    <span className="text-green-600 dark:text-green-400">
                      {formatPreviewValue(getValueAtPath(responseData, mapping.sourcePath))}
                    </span>
                  ) : (
                    <span className="italic">no value</span>
                  )}
                </div>

                {/* Remove button */}
                {!isRequired && (
                  <button
                    type="button"
                    onClick={() => removeMapping(mapping.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove mapping"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add mapping button */}
        <button
          type="button"
          onClick={() => addMapping()}
          className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Field Mapping
        </button>
      </div>

      {/* JSON Tree viewer (shown when selecting) */}
      {showJsonTree && !!responseData && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Response Data
            </span>
            {activeMapping && (
              <span className="text-xs text-blue-600 animate-pulse">
                Click any property to map it to "{mappings.find(m => m.id === activeMapping)?.targetField}"
              </span>
            )}
          </div>
          <JsonPathSelector
            data={responseData}
            onSelectPath={handlePathSelect}
            selectedPath={activeMapping ? mappings.find(m => m.id === activeMapping)?.sourcePath : undefined}
          />
        </div>
      )}

      {/* Mapped data preview */}
      {mappedPreview && Object.keys(mappedPreview).length > 0 && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mapped Output Preview</span>
          </div>
          <pre className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 overflow-auto max-h-40">
            {JSON.stringify(mappedPreview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Helper: Check if string looks like a date
function isDateString(value: string): boolean {
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}/, // ISO date
    /^\d{4}\/\d{2}\/\d{2}/, // Slash date
    /^\w{3}\s+\d{1,2},?\s+\d{4}/, // "Jan 1, 2024"
  ];
  return datePatterns.some(p => p.test(value));
}

// Helper: Apply transform to value
function applyTransform(value: unknown, transform: string): unknown {
  switch (transform) {
    case 'number':
      return typeof value === 'number' ? value : Number(value);
    case 'string':
      return String(value);
    case 'date':
      return typeof value === 'string' ? new Date(value).toISOString() : value;
    case 'boolean':
      return Boolean(value);
    default:
      return value;
  }
}

// Helper: Format value for preview
function formatPreviewValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value.length > 15 ? value.slice(0, 15) + '...' : value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === 'object') return '{...}';
  return String(value);
}

// Helper: Apply all mappings to data array
export function applyMappingsToData(
  data: unknown,
  mappings: DataMappingEntry[]
): unknown {
  if (!data || mappings.length === 0) return data;

  // Handle array of objects
  if (Array.isArray(data)) {
    return data.map(item => {
      const mapped: Record<string, unknown> = {};
      for (const mapping of mappings) {
        if (!mapping.sourcePath) continue;
        // For array items, adjust path to be relative
        const relativePath = mapping.sourcePath.replace(/^\$\[\d+\]/, '$');
        let value = getValueAtPath(item, relativePath);
        if (mapping.transform !== 'none') {
          value = applyTransform(value, mapping.transform || 'none');
        }
        mapped[mapping.targetField] = value;
      }
      return { ...item, ...mapped };
    });
  }

  // Handle single object
  if (typeof data === 'object' && data !== null) {
    const mapped: Record<string, unknown> = {};
    for (const mapping of mappings) {
      if (!mapping.sourcePath) continue;
      let value = getValueAtPath(data, mapping.sourcePath);
      if (mapping.transform !== 'none') {
        value = applyTransform(value, mapping.transform || 'none');
      }
      mapped[mapping.targetField] = value;
    }
    return { ...data as Record<string, unknown>, ...mapped };
  }

  return data;
}

export default DataMappingEditor;
