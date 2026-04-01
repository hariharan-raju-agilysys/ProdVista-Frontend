import { useState, useEffect, useCallback } from 'react';
import { 
  Wand2, RefreshCw, Check, X, AlertTriangle, 
  ChevronDown, ChevronUp, Sparkles, Database, ArrowRight,
  Loader2, Eye, EyeOff, Zap
} from 'lucide-react';
import clsx from 'clsx';
import { aiDataTransformService, TransformedData, WIDGET_FIELD_REQUIREMENTS, V1_LOG_ANALYTICS_QUERIES } from '../services/aiDataTransformService';
import { aiService } from '../services/aiService';

interface AIDataPreviewProps {
  data: unknown;
  widgetType: string;
  onTransformed?: (transformed: TransformedData) => void;
  onMappingsChange?: (mappings: Record<string, string>) => void;
  className?: string;
  autoTransform?: boolean;
  showRawData?: boolean;
}

export function AIDataPreview({
  data,
  widgetType,
  onTransformed,
  onMappingsChange,
  className,
  autoTransform = true,
  showRawData = false
}: AIDataPreviewProps) {
  const [transformedData, setTransformedData] = useState<TransformedData | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRaw, setShowRaw] = useState(showRawData);
  const [useAI, setUseAI] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);

  // Check AI availability
  useEffect(() => {
    const checkAI = async () => {
      try {
        const config = await aiService.getConfig();
        setAiAvailable(config.isConfigured);
        setUseAI(config.isConfigured);
      } catch {
        setAiAvailable(false);
        setUseAI(false);
      }
    };
    checkAI();
  }, []);

  // Transform data when it changes
  const transformData = useCallback(async () => {
    if (data === undefined || data === null || !widgetType) return;

    setIsTransforming(true);
    setError(null);

    try {
      const result = await aiDataTransformService.transformForWidget(data, widgetType, useAI);
      setTransformedData(result);
      onTransformed?.(result);
      onMappingsChange?.(result.fieldMappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transform failed');
    } finally {
      setIsTransforming(false);
    }
  }, [data, widgetType, useAI, onTransformed, onMappingsChange]);

  useEffect(() => {
    if (autoTransform && data !== undefined && data !== null) {
      transformData();
    }
  }, [autoTransform, data, transformData]);

  const requirements = WIDGET_FIELD_REQUIREMENTS[widgetType];

  if (!requirements) {
    return (
      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
          <AlertTriangle className="w-4 h-4" />
          <span>Unknown widget type: {widgetType}</span>
        </div>
      </div>
    );
  }

  // Extract for type safety
  const reqRequired: string[] = requirements.required;
  const reqOptional: string[] = requirements.optional;

  // Helper to safely render sample value
  const renderSampleValue = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Render field mapping row
  const renderFieldMapping = (field: string, isRequired: boolean) => {
    if (!transformedData) return null;
    
    const sourceField = transformedData.fieldMappings[field];
    const sampleValue = transformedData.sampleValues[field];
    const isMapped = !!sourceField;
    
    return (
      <div key={field} className={clsx(
        'flex items-center gap-2 p-2 rounded text-sm',
        isMapped ? 'bg-green-50 dark:bg-green-900/20' : 
          isRequired ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
      )}>
        <div className="flex items-center gap-1 min-w-[80px]">
          {isMapped ? <Check className="w-3 h-3 text-green-500" /> : 
           isRequired ? <X className="w-3 h-3 text-red-500" /> : <span className="w-3 h-3" />}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {field}{isRequired && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </div>
        {sourceField && (
          <>
            <ArrowRight className="w-3 h-3 text-gray-400" />
            <code className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
              {sourceField}
            </code>
          </>
        )}
        {sampleValue !== undefined && (
          <span className="ml-auto text-xs text-gray-500 truncate max-w-[120px]" title={renderSampleValue(sampleValue)}>
            = {renderSampleValue(sampleValue)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={clsx('rounded-lg border bg-white dark:bg-gray-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="font-medium text-sm">AI Data Transform</span>
          {transformedData && (
            <span className={clsx(
              'text-xs px-2 py-0.5 rounded-full',
              transformedData.confidence > 0.7 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              transformedData.confidence > 0.4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}>
              {Math.round(transformedData.confidence * 100)}% match
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {aiAvailable && (
            <button
              onClick={() => setUseAI(!useAI)}
              className={clsx(
                'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
                useAI 
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              )}
              title={useAI ? 'Using AI mapping' : 'Using heuristic mapping'}
            >
              <Wand2 className="w-3 h-3" />
              {useAI ? 'AI' : 'Auto'}
            </button>
          )}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title={showRaw ? 'Hide raw data' : 'Show raw data'}
          >
            {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={transformData}
            disabled={isTransforming}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Refresh transform"
          >
            <RefreshCw className={clsx('w-4 h-4', isTransforming && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Loading state */}
        {isTransforming && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            <span className="ml-2 text-sm text-gray-500">Analyzing data...</span>
          </div>
        )}
        
        {/* Error state */}
        {!isTransforming && error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <X className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Field mappings */}
        {transformedData !== null && !isTransforming && (
          <>
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Field Mappings
              </h4>
              <div className="grid gap-2">
                {reqRequired.map(field => renderFieldMapping(field, true))}
                {reqOptional.map(field => renderFieldMapping(field, false))}
              </div>
            </div>

            {/* Warnings */}
            {transformedData.warnings && transformedData.warnings.length > 0 && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="space-y-1">
                    {transformedData.warnings.map((warning, i) => (
                      <p key={i} className="text-xs text-yellow-700 dark:text-yellow-300">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AI suggestions */}
            {transformedData.aiSuggestions && (
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    {transformedData.aiSuggestions}
                  </p>
                </div>
              </div>
            )}

            {/* Show details toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showDetails ? 'Hide details' : 'Show transformed data'}
            </button>

            {showDetails && (
              <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs font-mono overflow-auto max-h-40">
                <pre className="text-gray-600 dark:text-gray-400">
                  {JSON.stringify(transformedData.data, null, 2).slice(0, 1000)}
                  {String(JSON.stringify(transformedData.data)).length > 1000 ? '...' : ''}
                </pre>
              </div>
            )}
          </>
        )}

        {/* Raw data */}
        {showRaw && data !== undefined && data !== null && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Database className="w-3 h-3" />
              Raw Data
            </h4>
            <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs font-mono overflow-auto max-h-40">
              <pre className="text-gray-600 dark:text-gray-400">
                {JSON.stringify(data, null, 2).slice(0, 2000)}
                {String(JSON.stringify(data)).length > 2000 ? '...' : ''}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// V1 Query Selector Component
interface V1QuerySelectorProps {
  workspaceId: string;
  onQuerySelect: (queryKey: string, data: TransformedData) => void;
  className?: string;
}

export function V1QuerySelector({
  workspaceId,
  onQuerySelect,
  className
}: V1QuerySelectorProps) {
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queries = aiDataTransformService.getAvailableQueries();

  const executeQuery = async (queryKey: string) => {
    if (!workspaceId) {
      setError('Workspace ID is required');
      return;
    }

    setIsLoading(true);
    setSelectedQuery(queryKey);
    setError(null);

    try {
      const result = await aiDataTransformService.executeV1Query(
        queryKey as keyof typeof V1_LOG_ANALYTICS_QUERIES,
        workspaceId
      );
      onQuerySelect(queryKey, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={clsx('space-y-2', className)}>
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <Zap className="w-4 h-4 text-blue-500" />
        V1 Service Queries
      </h4>
      
      <div className="grid grid-cols-2 gap-2">
        {queries.map(query => (
          <button
            key={query.key}
            onClick={() => executeQuery(query.key)}
            disabled={isLoading}
            className={clsx(
              'p-2 text-left rounded-lg border transition-colors',
              selectedQuery === query.key
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
            )}
          >
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {query.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {query.description}
            </div>
            <div className="mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {query.widgetType}
              </span>
            </div>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-gray-500">Executing query...</span>
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

export default AIDataPreview;
