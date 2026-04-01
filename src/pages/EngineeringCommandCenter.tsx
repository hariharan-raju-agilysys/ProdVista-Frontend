import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, RefreshCw, Clock, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertTriangle, Loader2, Copy,
  Zap, Activity, Database, Server, Code2, 
  Terminal, BarChart3, List, Grid, Play, X, HelpCircle,
  Filter, TrendingUp, Bug, Timer, Gauge, Info, Settings, Tag,
  Flame, Hash, Globe, Layers, AlertOctagon, Cpu, ArrowDown,
  Sparkles, GitPullRequest, FileCode, Eye, ExternalLink
} from 'lucide-react';
import appInsightsService, {
  Operation, TraceSpan, AiQueryInterpretation, Exception,
  TIME_RANGES, KQL_TEMPLATES
} from '../services/appInsightsService';
import exceptionAnalysisService, {
  ExceptionDetail, AnalysisResult, CreatePrResult
} from '../services/exceptionAnalysisService';
import { engineeringService } from '../services/engineeringService';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'transactions' | 'failures' | 'performance' | 'custom';
type DisplayMode = 'table' | 'timeline';

interface QueryState {
  isLoading: boolean;
  error: string | null;
  lastQuery: string | null;
  executionTime: number;
}

// ============================================================================
// Utility Components
// ============================================================================

const StatusBadge = ({ status, small = false }: { status: 'success' | 'error' | 'warning'; small?: boolean }) => {
  const config = {
    success: { icon: CheckCircle, bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    error: { icon: XCircle, bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
    warning: { icon: AlertTriangle, bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  };
  const { icon: Icon, bg, text, border } = config[status];
  const size = small ? 'w-3 h-3' : 'w-4 h-4';
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${bg} ${text} border ${border} text-xs font-medium`}>
      <Icon className={size} />
      {!small && <span className="capitalize">{status}</span>}
    </span>
  );
};

const DurationBadge = ({ duration, threshold = 3000 }: { duration: number; threshold?: number }) => {
  const isSlowvariant = duration > threshold;
  const formattedDuration = duration < 1000 
    ? `${Math.round(duration)}ms` 
    : `${(duration / 1000).toFixed(2)}s`;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${
      isSlowvariant ? 'bg-orange-500/10 text-orange-400' : 'bg-slate-700 text-slate-300'
    }`}>
      <Clock className="w-3 h-3" />
      {formattedDuration}
    </span>
  );
};

const CopyButton = ({ value, label = 'Copy' }: { value: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-700"
      title={label}
    >
      {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
    </button>
  );
};

// ============================================================================
// AI Search Bar Component
// ============================================================================

interface AISearchBarProps {
  onSearch: (query: string, interpretation: AiQueryInterpretation) => void;
  isLoading: boolean;
  placeholder?: string;
}

const AISearchBar = ({ onSearch, isLoading, placeholder }: AISearchBarProps) => {
  const [query, setQuery] = useState('');
  const [interpretation, setInterpretation] = useState<AiQueryInterpretation | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleQueryChange = async (value: string) => {
    setQuery(value);
    if (value.length > 3) {
      const result = await appInsightsService.interpretQuery(value);
      setInterpretation(result);
    } else {
      setInterpretation(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && interpretation) {
      onSearch(query, interpretation);
    }
  };

  const searchExamples = [
    { query: 'correlation_id: abc-123-def', desc: 'Search by correlation ID' },
    { query: 'operation_id: 550e8400-e29b-41d4-a716-446655440000', desc: 'Search by operation ID' },
    { query: 'error 500', desc: 'Find all 500 errors' },
    { query: '404 errors in folio service', desc: 'Service-specific error search' },
    { query: 'slow requests', desc: 'Performance issues' },
    { query: 'exceptions in payment', desc: 'Find exceptions by service' },
  ];

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">AI</span>
          </div>
          
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={placeholder || "Search by correlation ID, operation ID, error code, or describe what you're looking for..."}
            className="w-full pl-24 pr-32 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-lg"
          />
          
          <div className="absolute right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
              title="Search help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors font-medium"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
        </div>
      </form>

      {/* AI Interpretation Preview */}
      <AnimatePresence>
        {interpretation && query.length > 3 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                interpretation.confidence > 0.8 ? 'bg-green-500/10 text-green-400' : 
                interpretation.confidence > 0.5 ? 'bg-yellow-500/10 text-yellow-400' : 
                'bg-slate-700 text-slate-400'
              }`}>
                <Activity className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-200">{interpretation.explanation}</span>
                  <span className="text-xs text-slate-500">
                    {Math.round(interpretation.confidence * 100)}% confident
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono bg-slate-900 rounded p-2 overflow-x-auto">
                  {interpretation.suggestedKql.split('\n').slice(0, 3).join('\n')}
                  {interpretation.suggestedKql.split('\n').length > 3 && '...'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Panel */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 p-4 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">Search Examples</h3>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {searchExamples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(example.query);
                    handleQueryChange(example.query);
                    setShowHelp(false);
                  }}
                  className="text-left p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <div className="text-xs font-mono text-blue-400">{example.query}</div>
                  <div className="text-xs text-slate-400 mt-1">{example.desc}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Operations Table Component
// ============================================================================

interface OperationsTableProps {
  operations: Operation[];
  selectedOperation: Operation | null;
  onSelectOperation: (op: Operation) => void;
  isLoading: boolean;
}

const OperationsTable = ({ operations, selectedOperation, onSelectOperation, isLoading }: OperationsTableProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Database className="w-12 h-12 mb-4" />
        <p>No operations found</p>
        <p className="text-sm text-slate-500 mt-1">Try adjusting your time range or search filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700">
            <th className="pb-3 pr-4">Status</th>
            <th className="pb-3 pr-4">Time</th>
            <th className="pb-3 pr-4">Operation</th>
            <th className="pb-3 pr-4">Service</th>
            <th className="pb-3 pr-4">Duration</th>
            <th className="pb-3 pr-4">Code</th>
            <th className="pb-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {operations.map((op) => (
            <motion.tr
              key={op.operationId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => onSelectOperation(op)}
              className={`cursor-pointer transition-colors ${
                selectedOperation?.operationId === op.operationId
                  ? 'bg-blue-500/10'
                  : 'hover:bg-slate-800/50'
              }`}
            >
              <td className="py-3 pr-4">
                <StatusBadge status={op.status} small />
              </td>
              <td className="py-3 pr-4 text-sm text-slate-300 font-mono">
                {new Date(op.timestamp).toLocaleTimeString()}
              </td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-200 truncate max-w-xs" title={op.operationName}>
                    {op.operationName}
                  </span>
                  {op.spanCount > 1 && (
                    <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
                      {op.spanCount} spans
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 pr-4">
                <span className="text-sm text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                  {op.serviceName}
                </span>
              </td>
              <td className="py-3 pr-4">
                <DurationBadge duration={op.duration} />
              </td>
              <td className="py-3 pr-4">
                <span className={`text-sm font-mono ${
                  op.resultCode.startsWith('2') ? 'text-green-400' :
                  op.resultCode.startsWith('4') ? 'text-yellow-400' :
                  op.resultCode.startsWith('5') ? 'text-red-400' :
                  'text-slate-400'
                }`}>
                  {op.resultCode}
                </span>
              </td>
              <td className="py-3">
                <div className="flex items-center gap-1">
                  <CopyButton value={op.operationId} label="Copy Operation ID" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOperation(op);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                    title="View details"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// Trace Details Panel Component
// ============================================================================

interface TraceDetailsPanelProps {
  operation: Operation;
  spans: TraceSpan[];
  isLoading: boolean;
  onClose: () => void;
}

const TraceDetailsPanel = ({ operation, spans, isLoading, onClose }: TraceDetailsPanelProps) => {
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());

  const toggleSpan = (spanId: string) => {
    setExpandedSpans(prev => {
      const next = new Set(prev);
      if (next.has(spanId)) next.delete(spanId);
      else next.add(spanId);
      return next;
    });
  };

  const getSpanTypeIcon = (type: TraceSpan['type']) => {
    const icons = {
      request: Server,
      dependency: Database,
      trace: Terminal,
      exception: AlertTriangle,
      customEvent: Activity,
    };
    return icons[type] || Activity;
  };

  const getSpanTypeColor = (type: TraceSpan['type']) => {
    const colors = {
      request: 'text-blue-400 bg-blue-500/10',
      dependency: 'text-purple-400 bg-purple-500/10',
      trace: 'text-slate-400 bg-slate-500/10',
      exception: 'text-red-400 bg-red-500/10',
      customEvent: 'text-green-400 bg-green-500/10',
    };
    return colors[type] || 'text-slate-400 bg-slate-500/10';
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 bottom-0 w-[600px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-3">
          <StatusBadge status={operation.status} />
          <div>
            <h3 className="text-lg font-semibold text-slate-200">{operation.operationName}</h3>
            <p className="text-sm text-slate-400">{operation.serviceName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Operation Info */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider">Operation ID</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm text-slate-300 font-mono truncate">{operation.operationId}</code>
              <CopyButton value={operation.operationId} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider">Duration</label>
            <div className="mt-1">
              <DurationBadge duration={operation.duration} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider">Timestamp</label>
            <p className="text-sm text-slate-300 mt-1 font-mono">
              {new Date(operation.timestamp).toLocaleString()}
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider">Result Code</label>
            <p className="text-sm text-slate-300 mt-1 font-mono">{operation.resultCode}</p>
          </div>
        </div>
        {operation.url && (
          <div className="mt-4">
            <label className="text-xs text-slate-500 uppercase tracking-wider">URL</label>
            <p className="text-sm text-slate-300 mt-1 font-mono truncate" title={operation.url}>
              {operation.url}
            </p>
          </div>
        )}
      </div>

      {/* Spans Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Trace Timeline ({spans.length} spans)
        </h4>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {spans.map((span, index) => {
              const Icon = getSpanTypeIcon(span.type);
              const isExpanded = expandedSpans.has(span.id);
              
              return (
                <motion.div
                  key={span.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border border-slate-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleSpan(span.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div className={`p-1.5 rounded ${getSpanTypeColor(span.type)}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200 truncate">{span.name}</span>
                        {!span.success && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{span.cloudRoleName}</span>
                        {span.resultCode && (
                          <span className="text-xs text-slate-500">• {span.resultCode}</span>
                        )}
                      </div>
                    </div>
                    <DurationBadge duration={span.duration} threshold={1000} />
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-700 bg-slate-800/30"
                      >
                        <div className="p-3 space-y-2">
                          {span.target && (
                            <div>
                              <span className="text-xs text-slate-500">Target:</span>
                              <span className="text-sm text-slate-300 ml-2 font-mono">{span.target}</span>
                            </div>
                          )}
                          {span.message && (
                            <div>
                              <span className="text-xs text-slate-500">Message:</span>
                              <p className="text-sm text-slate-300 mt-1">{span.message}</p>
                            </div>
                          )}
                          {span.customDimensions && Object.keys(span.customDimensions).length > 0 && (
                            <div>
                              <span className="text-xs text-slate-500">Custom Dimensions:</span>
                              <div className="mt-1 bg-slate-900 rounded p-2 text-xs font-mono overflow-x-auto">
                                {JSON.stringify(span.customDimensions, null, 2)}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-700">
                            <span>ID: {span.id}</span>
                            <span>Time: {new Date(span.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// KQL Editor Component
// ============================================================================

interface KQLEditorProps {
  query: string;
  onChange: (query: string) => void;
  onExecute: () => void;
  isLoading: boolean;
}

const KQLEditor = ({ query, onChange, onExecute, isLoading }: KQLEditorProps) => {
  const templates = [
    { name: 'Slow Requests', template: KQL_TEMPLATES.slowRequests('1h', 3000) },
    { name: 'Exceptions', template: KQL_TEMPLATES.exceptions('1h') },
    { name: 'Request Summary', template: KQL_TEMPLATES.requestSummary('1h') },
    { name: 'Dependency Health', template: KQL_TEMPLATES.dependencyHealth('1h') },
  ];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">KQL Query</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => onChange(e.target.value)}
            className="text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-300"
            defaultValue=""
          >
            <option value="" disabled>Templates...</option>
            {templates.map((t, i) => (
              <option key={i} value={t.template}>{t.name}</option>
            ))}
          </select>
          <button
            onClick={onExecute}
            disabled={isLoading || !query.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-sm font-medium transition-colors"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run
          </button>
        </div>
      </div>
      <textarea
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter KQL query..."
        className="w-full h-32 p-3 bg-slate-900 text-slate-200 font-mono text-sm resize-y focus:outline-none"
        spellCheck={false}
      />
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export default function EngineeringCommandCenter() {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('transactions');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');
  const [timeRange, setTimeRange] = useState('1h');
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [spans, setSpans] = useState<TraceSpan[]>([]);
  const [queryState, setQueryState] = useState<QueryState>({
    isLoading: false,
    error: null,
    lastQuery: null,
    executionTime: 0,
  });
  const [customKql, setCustomKql] = useState('');
  const [customResults, setCustomResults] = useState<Record<string, unknown>[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; label?: string }[]>([]);
  const [appInsightsInstances, setAppInsightsInstances] = useState<{ id: string; name: string }[]>([]);

  // Failures & Performance state
  const [failedOperations, setFailedOperations] = useState<Operation[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [slowOperations, setSlowOperations] = useState<Operation[]>([]);
  const [performanceStats, setPerformanceStats] = useState<{ avgDuration: number; p50: number; p95: number; p99: number; totalRequests: number; failureRate: number } | null>(null);
  const [slowThreshold, setSlowThreshold] = useState(3000);
  const [failuresLoading, setFailuresLoading] = useState(false);
  const [perfLoading, setPerfLoading] = useState(false);

  // Exception analysis state
  const [analysisPanel, setAnalysisPanel] = useState<{
    visible: boolean;
    exception: Exception | null;
    detail: ExceptionDetail | null;
    analysis: AnalysisResult | null;
    prResult: CreatePrResult | null;
    loading: 'detail' | 'analysis' | 'pr' | null;
    error: string | null;
    repoId: string;
    orgUrl: string;
    projectName: string;
  }>({
    visible: false, exception: null, detail: null, analysis: null, prResult: null,
    loading: null, error: null, repoId: '', orgUrl: '', projectName: '',
  });
  const [availableRepos, setAvailableRepos] = useState<{ id: string; name: string; defaultBranch: string }[]>([]);

  // Advanced filters
  const [filters, setFilters] = useState<{ service: string; status: '' | 'success' | 'error'; minDuration: number }>({ service: '', status: '', minDuration: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [availableServices, setAvailableServices] = useState<string[]>([]);

  // Connected resources info panel
  const [showResourceInfo, setShowResourceInfo] = useState(false);

  // Global service include/exclude filter (applies across Failures + Performance)
  const [excludedServices, setExcludedServices] = useState<Set<string>>(new Set());
  const [serviceFilterSearch, setServiceFilterSearch] = useState('');
  const [showServiceFilter, setShowServiceFilter] = useState(false);
  const [allServices, setAllServices] = useState<string[]>([]);

  // Load workspaces and App Insights from filtered resources on mount
  useEffect(() => {
    const loadResources = async () => {
      try {
        const resources = await appInsightsService.getFilteredResources();
        setWorkspaces(resources.workspaces);
        setAppInsightsInstances(resources.appInsights);
        // Prefer App Insights resource ID, fall back to workspace resource ID
        if (resources.appInsights.length > 0) {
          setWorkspaceId(resources.appInsights[0].id);
        } else if (resources.workspaces.length > 0) {
          setWorkspaceId(resources.workspaces[0].id);
        }
      } catch (err) {
        console.error('Failed to load Azure resources:', err);
      }
    };
    loadResources();
  }, []);

  // Load operations when time range changes
  const loadOperations = useCallback(async (filterOverrides?: { service?: string; status?: 'success' | 'error' | 'all'; minDuration?: number }) => {
    if (!workspaceId) return;
    
    setQueryState(prev => ({ ...prev, isLoading: true, error: null }));
    const startTime = Date.now();
    
    try {
      const activeFilters = filterOverrides || {
        ...(filters.service ? { service: filters.service } : {}),
        ...(filters.status ? { status: filters.status as 'success' | 'error' } : {}),
        ...(filters.minDuration > 0 ? { minDuration: filters.minDuration } : {}),
      };
      const hasFilters = Object.keys(activeFilters).length > 0;
      const ops = await appInsightsService.getOperations(timeRange, 200, hasFilters ? activeFilters : undefined, workspaceId);
      setOperations(ops);
      // Extract unique services for filter dropdown
      const serviceNames = [...new Set(ops.map(op => op.serviceName).filter(Boolean))].sort();
      if (serviceNames.length > 0) setAvailableServices(serviceNames);
      setQueryState(prev => ({
        ...prev,
        isLoading: false,
        executionTime: Date.now() - startTime,
      }));
    } catch (err) {
      setQueryState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load operations',
      }));
    }
  }, [timeRange, workspaceId, filters]);

  useEffect(() => {
    if (viewMode === 'transactions' && workspaceId) {
      loadOperations();
    }
  }, [viewMode, workspaceId, loadOperations]);

  // Load trace details when operation selected
  const loadTraceDetails = useCallback(async (operationId: string) => {
    if (!workspaceId) return;
    
    setQueryState(prev => ({ ...prev, isLoading: true }));
    try {
      const details = await appInsightsService.getTraceDetails(operationId, workspaceId);
      setSpans(details.spans);
    } catch (err) {
      console.error('Failed to load trace details:', err);
    } finally {
      setQueryState(prev => ({ ...prev, isLoading: false }));
    }
  }, [workspaceId]);

  const handleSelectOperation = (op: Operation) => {
    setSelectedOperation(op);
    if (op.operationId) {
      loadTraceDetails(op.operationId);
    }
  };

  // Collect unique services from all loaded data
  const collectServices = useCallback((ops: Operation[], excs: Exception[], slowOps: Operation[]) => {
    const serviceSet = new Set<string>();
    ops.forEach(o => { if (o.serviceName) serviceSet.add(o.serviceName); });
    excs.forEach(e => { if (e.cloudRoleName) serviceSet.add(e.cloudRoleName); });
    slowOps.forEach(o => { if (o.serviceName) serviceSet.add(o.serviceName); });
    const sorted = [...serviceSet].sort();
    setAllServices(sorted);
  }, []);

  // Load failures data
  const loadFailures = useCallback(async () => {
    if (!workspaceId) return;
    setFailuresLoading(true);
    try {
      const [failedOps, exceptionGroups] = await Promise.all([
        appInsightsService.getOperations(timeRange, 200, { status: 'error' }, workspaceId),
        appInsightsService.getExceptions(timeRange, undefined, workspaceId),
      ]);
      setFailedOperations(failedOps);
      setExceptions(exceptionGroups);
      collectServices(failedOps, exceptionGroups, slowOperations);
    } catch (err) {
      console.error('Failed to load failures:', err);
    } finally {
      setFailuresLoading(false);
    }
  }, [timeRange, workspaceId]);

  // Exception Analysis handlers
  const handleAnalyzeException = useCallback(async (exc: Exception) => {
    setAnalysisPanel(prev => ({
      ...prev, visible: true, exception: exc, detail: null, analysis: null,
      prResult: null, loading: 'detail', error: null,
    }));

    try {
      // Load repos if not loaded (need DevOps config from local storage)
      const config = engineeringService.getSavedConfig();
      if (config) {
        setAnalysisPanel(prev => ({ ...prev, orgUrl: config.organizationUrl, projectName: config.projectName }));
        if (availableRepos.length === 0) {
          try {
            const repos = await exceptionAnalysisService.getRepositories(config.organizationUrl, config.projectName);
            setAvailableRepos(repos.map(r => ({ id: r.id, name: r.name, defaultBranch: r.defaultBranch })));
            if (repos.length > 0) {
              setAnalysisPanel(prev => ({ ...prev, repoId: repos[0].id }));
            }
          } catch { /* repos optional */ }
        }
      }

      // Fetch exception detail with stack trace
      const detail = await exceptionAnalysisService.getExceptionDetail(exc.problemId, timeRange, workspaceId);
      setAnalysisPanel(prev => ({ ...prev, detail, loading: null }));
    } catch (err) {
      setAnalysisPanel(prev => ({
        ...prev, loading: null, error: err instanceof Error ? err.message : 'Failed to load exception details',
      }));
    }
  }, [timeRange, workspaceId, availableRepos.length]);

  const handleRunAIAnalysis = useCallback(async () => {
    const { detail, orgUrl, projectName, repoId } = analysisPanel;
    if (!detail || !orgUrl || !projectName || !repoId) return;

    setAnalysisPanel(prev => ({ ...prev, loading: 'analysis', error: null }));
    try {
      const result = await exceptionAnalysisService.analyzeException({
        problemId: detail.problemId,
        exceptionType: detail.type,
        message: detail.message,
        stackTrace: detail.stackTrace,
        parsedFrames: detail.parsedFrames,
        organizationUrl: orgUrl,
        projectName,
        repositoryId: repoId,
      });
      setAnalysisPanel(prev => ({ ...prev, analysis: result, loading: null }));
    } catch (err) {
      setAnalysisPanel(prev => ({
        ...prev, loading: null, error: err instanceof Error ? err.message : 'AI analysis failed',
      }));
    }
  }, [analysisPanel]);

  const handleCreatePR = useCallback(async () => {
    const { analysis, orgUrl, projectName, repoId, detail } = analysisPanel;
    if (!analysis?.fixedCode || !analysis.filePath || !detail) return;

    setAnalysisPanel(prev => ({ ...prev, loading: 'pr', error: null }));
    try {
      const result = await exceptionAnalysisService.createFixPR({
        organizationUrl: orgUrl,
        projectName,
        repositoryId: repoId,
        filePath: analysis.filePath,
        fixedCode: analysis.fixedCode,
        exceptionType: detail.type,
        exceptionMessage: detail.message,
      });
      setAnalysisPanel(prev => ({ ...prev, prResult: result, loading: null }));
    } catch (err) {
      setAnalysisPanel(prev => ({
        ...prev, loading: null, error: err instanceof Error ? err.message : 'PR creation failed',
      }));
    }
  }, [analysisPanel]);

  // Load performance data
  const loadPerformance = useCallback(async () => {
    if (!workspaceId) return;
    setPerfLoading(true);
    try {
      // Fetch slow operations
      const slowOps = await appInsightsService.getOperations(timeRange, 200, { minDuration: slowThreshold }, workspaceId);
      setSlowOperations(slowOps);
      collectServices(failedOperations, exceptions, slowOps);

      // Run KQL for percentile stats
      const statsKql = `requests
| summarize 
    totalRequests = count(),
    failures = countif(success == false),
    avgDuration = avg(duration),
    p50Duration = percentile(duration, 50),
    p95Duration = percentile(duration, 95),
    p99Duration = percentile(duration, 99)`;
      const statsResult = await appInsightsService.executeQuery(statsKql, timeRange, undefined, workspaceId);
      if (statsResult.success && statsResult.data.length > 0) {
        const row = statsResult.data[0];
        setPerformanceStats({
          totalRequests: Number(row.totalRequests) || 0,
          failureRate: Number(row.failures) / Math.max(Number(row.totalRequests), 1) * 100,
          avgDuration: Number(row.avgDuration) || 0,
          p50: Number(row.p50Duration) || 0,
          p95: Number(row.p95Duration) || 0,
          p99: Number(row.p99Duration) || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load performance:', err);
    } finally {
      setPerfLoading(false);
    }
  }, [timeRange, workspaceId, slowThreshold]);

  // Load data when tab changes
  useEffect(() => {
    if (viewMode === 'failures' && workspaceId) {
      loadFailures();
    } else if (viewMode === 'performance' && workspaceId) {
      loadPerformance();
    }
  }, [viewMode, workspaceId, timeRange, loadFailures, loadPerformance]);

  // Handle AI search
  const handleAISearch = async (query: string, interpretation: AiQueryInterpretation) => {
    setQueryState(prev => ({ ...prev, isLoading: true, lastQuery: query }));
    const startTime = Date.now();
    
    try {
      const result = await appInsightsService.executeQuery(
        interpretation.suggestedKql,
        timeRange,
        undefined,
        workspaceId
      );
      
      if (result.success) {
        // Transform to operations format if possible
        const ops = (result.data as Record<string, unknown>[]).map((row, i) => ({
          operationId: (row.operationId as string) || (row.operation_Id as string) || `op-${i}`,
          operationName: (row.name as string) || (row.operationName as string) || 'Unknown',
          timestamp: (row.timestamp as string) || new Date().toISOString(),
          duration: (row.duration as number) || 0,
          status: (row.success === true || row.status === 'success' ? 'success' : 'error') as 'success' | 'error',
          resultCode: (row.resultCode as string) || '200',
          serviceName: (row.cloud_RoleName as string) || (row.serviceName as string) || 'Unknown',
          url: row.url as string,
          spanCount: 1,
        }));
        setOperations(ops);
        setCustomKql(interpretation.suggestedKql);
      }
      
      setQueryState(prev => ({
        ...prev,
        isLoading: false,
        executionTime: Date.now() - startTime,
        error: result.error || null,
      }));
    } catch (err) {
      setQueryState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Search failed',
      }));
    }
  };

  // Execute custom KQL
  const executeCustomKql = async (kqlOverride?: string) => {
    const kql = kqlOverride || customKql;
    if (!kql.trim() || !workspaceId) return;
    
    setQueryState(prev => ({ ...prev, isLoading: true }));
    const startTime = Date.now();
    
    try {
      const result = await appInsightsService.executeQuery(kql, timeRange, undefined, workspaceId);
      setCustomResults(result.data as Record<string, unknown>[]);
      setQueryState(prev => ({
        ...prev,
        isLoading: false,
        executionTime: Date.now() - startTime,
        error: result.error || null,
      }));
    } catch (err) {
      setQueryState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Query failed',
      }));
    }
  };

  // Helper: detect if current resource is a Log Analytics Workspace (vs App Insights)
  const isLogAnalyticsWorkspace = workspaceId.includes('microsoft.operationalinsights/workspaces');

  // Helper: get the correct exceptions table name for KQL based on resource type
  const getExceptionsTableName = () => isLogAnalyticsWorkspace ? 'AppExceptions' : 'exceptions';

  // Helper: escape a string for safe use inside KQL double-quoted string literal
  const escapeKqlString = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  // Computed filtered data for Failures & Performance tabs (respects service exclusion)
  const filteredExceptions = excludedServices.size > 0
    ? exceptions.filter(e => !excludedServices.has(e.cloudRoleName))
    : exceptions;
  const filteredFailedOps = excludedServices.size > 0
    ? failedOperations.filter(o => !excludedServices.has(o.serviceName))
    : failedOperations;
  const filteredSlowOps = excludedServices.size > 0
    ? slowOperations.filter(o => !excludedServices.has(o.serviceName))
    : slowOperations;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-200">Engineering Command Center</h1>
                <p className="text-sm text-slate-400">Azure Application Insights • AI-Powered Diagnostics</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Resource Selector */}
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-400" />
                <select
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Resource</option>
                  {appInsightsInstances.length > 0 && (
                    <optgroup label="App Insights">
                      {appInsightsInstances.map(ai => (
                        <option key={ai.id} value={ai.id}>{ai.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {workspaces.length > 0 && (
                    <optgroup label="Log Analytics Workspaces">
                      {workspaces.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Time Range */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIME_RANGES.map(tr => (
                    <option key={tr.value} value={tr.value}>{tr.label}</option>
                  ))}
                </select>
              </div>

              {/* Refresh */}
              <button
                onClick={() => loadOperations()}
                disabled={queryState.isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${queryState.isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* AI Search Bar */}
          <AISearchBar
            onSearch={handleAISearch}
            isLoading={queryState.isLoading}
          />

          {/* Connected Resources Info Bar */}
          <div className="mt-3">
            <button
              onClick={() => setShowResourceInfo(!showResourceInfo)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Connected Resources</span>
              <div className="flex items-center gap-1.5 ml-1">
                {appInsightsInstances.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded text-[10px] font-medium">
                    {appInsightsInstances.length} App Insights
                  </span>
                )}
                {workspaces.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-purple-500/15 text-purple-400 rounded text-[10px] font-medium">
                    {workspaces.length} Workspace{workspaces.length > 1 ? 's' : ''}
                  </span>
                )}
                {(() => {
                  const config = engineeringService.getSavedConfig();
                  return config ? (
                    <span className="px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded text-[10px] font-medium">
                      DevOps
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-slate-600/30 text-slate-500 rounded text-[10px] font-medium">
                      DevOps N/A
                    </span>
                  );
                })()}
              </div>
              {showResourceInfo ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </button>

            <AnimatePresence>
              {showResourceInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 grid grid-cols-3 gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700/50">
                    {/* App Insights */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
                        <Database className="w-3.5 h-3.5" />
                        Application Insights
                      </div>
                      {appInsightsInstances.length > 0 ? (
                        <div className="space-y-1">
                          {appInsightsInstances.map(ai => (
                            <div key={ai.id} className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${ai.id === workspaceId ? 'bg-green-400' : 'bg-slate-500'}`} />
                              <span className="text-xs text-slate-300 truncate" title={ai.id}>{ai.name}</span>
                              {ai.id === workspaceId && <span className="text-[9px] text-green-400 font-medium">ACTIVE</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No App Insights configured</p>
                      )}
                    </div>

                    {/* Log Analytics Workspaces */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-purple-400">
                        <Layers className="w-3.5 h-3.5" />
                        Log Analytics Workspaces
                      </div>
                      {workspaces.length > 0 ? (
                        <div className="space-y-1">
                          {workspaces.map(ws => (
                            <div key={ws.id} className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${ws.id === workspaceId ? 'bg-green-400' : 'bg-slate-500'}`} />
                              <span className="text-xs text-slate-300 truncate" title={ws.id}>{ws.name}</span>
                              {ws.id === workspaceId && <span className="text-[9px] text-green-400 font-medium">ACTIVE</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No workspaces configured</p>
                      )}
                    </div>

                    {/* DevOps Connection */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                        <Settings className="w-3.5 h-3.5" />
                        Azure DevOps
                      </div>
                      {(() => {
                        const config = engineeringService.getSavedConfig();
                        if (config) {
                          const orgName = config.organizationUrl.split('/').filter(Boolean).pop() || config.organizationUrl;
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">Org:</span>
                                <span className="text-xs text-slate-300 truncate">{orgName}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">Project:</span>
                                <span className="text-xs text-slate-300 truncate">{config.projectName}</span>
                              </div>
                            </div>
                          );
                        }
                        return <p className="text-xs text-slate-500 italic">Not configured</p>;
                      })()}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex items-center gap-1">
            {[
              { id: 'transactions', label: 'Transaction Search', icon: Search },
              { id: 'failures', label: 'Failures', icon: XCircle },
              { id: 'performance', label: 'Performance', icon: BarChart3 },
              { id: 'custom', label: 'KQL Editor', icon: Code2 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as ViewMode)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  viewMode === tab.id
                    ? 'text-blue-400 border-blue-400 bg-blue-500/5'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Global Service Filter Bar - shown on Failures & Performance tabs */}
      {(viewMode === 'failures' || viewMode === 'performance') && allServices.length > 0 && (
        <div className="bg-slate-800/30 border-b border-slate-700/50">
          <div className="max-w-[1800px] mx-auto px-6 py-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowServiceFilter(!showServiceFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showServiceFilter || excludedServices.size > 0
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Service Filter
                {excludedServices.size > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                    {excludedServices.size}
                  </span>
                )}
              </button>

              {/* Excluded service pills */}
              {excludedServices.size > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">Excluded:</span>
                  {[...excludedServices].map(svc => (
                    <span
                      key={svc}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-full text-[11px]"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {svc}
                      <button
                        onClick={() => {
                          const next = new Set(excludedServices);
                          next.delete(svc);
                          setExcludedServices(next);
                        }}
                        className="hover:text-red-300 ml-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={() => setExcludedServices(new Set())}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors ml-1"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Expanded Service Filter Panel */}
            <AnimatePresence>
              {showServiceFilter && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={serviceFilterSearch}
                        onChange={(e) => setServiceFilterSearch(e.target.value)}
                        placeholder="Search services..."
                        className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        onClick={() => setExcludedServices(new Set(allServices))}
                        className="text-[10px] text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                      >
                        Exclude All
                      </button>
                      <button
                        onClick={() => setExcludedServices(new Set())}
                        className="text-[10px] text-slate-500 hover:text-green-400 transition-colors px-2 py-1 rounded hover:bg-green-500/10"
                      >
                        Include All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {allServices
                        .filter(s => !serviceFilterSearch || s.toLowerCase().includes(serviceFilterSearch.toLowerCase()))
                        .map(svc => {
                          const isExcluded = excludedServices.has(svc);
                          return (
                            <button
                              key={svc}
                              onClick={() => {
                                const next = new Set(excludedServices);
                                if (isExcluded) next.delete(svc); else next.add(svc);
                                setExcludedServices(next);
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border ${
                                isExcluded
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20 line-through opacity-60'
                                  : 'bg-green-500/10 text-green-400 border-green-500/20'
                              }`}
                            >
                              {isExcluded ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                              {svc}
                            </button>
                          );
                        })}
                    </div>
                    {allServices.length > 0 && (
                      <p className="text-[10px] text-slate-500 mt-2">
                        {allServices.length - excludedServices.size} of {allServices.length} services included
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {/* Query Status Bar */}
        {(queryState.error || queryState.executionTime > 0) && (
          <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
            queryState.error ? 'bg-red-500/10 border border-red-500/30' : 'bg-slate-800 border border-slate-700'
          }`}>
            <div className="flex items-center gap-2">
              {queryState.error ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{queryState.error}</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-slate-300">
                    Query completed • {operations.length} results • {queryState.executionTime}ms
                  </span>
                </>
              )}
            </div>
            {queryState.lastQuery && (
              <span className="text-xs text-slate-500 truncate max-w-md" title={queryState.lastQuery}>
                Last search: {queryState.lastQuery}
              </span>
            )}
          </div>
        )}

        {/* View Mode Content */}
        {viewMode === 'transactions' && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <List className="w-5 h-5" />
                Operations
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    showFilters || filters.service || filters.status || filters.minDuration > 0
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {(filters.service || filters.status || filters.minDuration > 0) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                      {[filters.service, filters.status, filters.minDuration > 0].filter(Boolean).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setDisplayMode('table')}
                  className={`p-2 rounded ${displayMode === 'table' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDisplayMode('timeline')}
                  className={`p-2 rounded ${displayMode === 'timeline' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Advanced Filter Bar */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="flex flex-wrap items-end gap-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Service</label>
                      <select
                        value={filters.service}
                        onChange={(e) => setFilters(f => ({ ...f, service: e.target.value }))}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 min-w-[180px]"
                      >
                        <option value="">All Services</option>
                        {availableServices.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Status</label>
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as '' | 'success' | 'error' }))}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 min-w-[140px]"
                      >
                        <option value="">All Status</option>
                        <option value="success">Success</option>
                        <option value="error">Failed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Min Duration (ms)</label>
                      <input
                        type="number"
                        value={filters.minDuration || ''}
                        onChange={(e) => setFilters(f => ({ ...f, minDuration: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 w-[120px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { loadOperations(); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Apply
                      </button>
                      <button
                        onClick={() => { setFilters({ service: '', status: '', minDuration: 0 }); setTimeout(() => loadOperations(), 0); }}
                        className="px-3 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <OperationsTable
              operations={operations}
              selectedOperation={selectedOperation}
              onSelectOperation={handleSelectOperation}
              isLoading={queryState.isLoading}
            />
          </div>
        )}

        {viewMode === 'custom' && (
          <div className="space-y-4">
            <KQLEditor
              query={customKql}
              onChange={setCustomKql}
              onExecute={executeCustomKql}
              isLoading={queryState.isLoading}
            />

            {customResults.length > 0 && (
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-x-auto">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Results ({customResults.length} rows)</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700">
                      {customResults[0] && Object.keys(customResults[0]).map(key => (
                        <th key={key} className="pb-2 pr-4">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {customResults.slice(0, 100).map((row, i) => (
                      <tr key={i} className="text-slate-300">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="py-2 pr-4 font-mono text-xs">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {viewMode === 'failures' && (
          <div className="space-y-4">
            {/* Failure Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: 'Total Failures',
                  value: filteredFailedOps.length,
                  icon: XCircle,
                  color: 'text-red-400',
                  bg: 'bg-red-500/10',
                  border: 'border-red-500/20',
                },
                {
                  label: 'Exception Groups',
                  value: filteredExceptions.length,
                  icon: Bug,
                  color: 'text-orange-400',
                  bg: 'bg-orange-500/10',
                  border: 'border-orange-500/20',
                },
                {
                  label: 'Top Error Code',
                  value: (() => {
                    const codes = filteredFailedOps.map(o => o.resultCode).filter(Boolean);
                    if (codes.length === 0) return 'N/A';
                    const freq: Record<string, number> = {};
                    codes.forEach(c => { freq[c] = (freq[c] || 0) + 1; });
                    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
                  })(),
                  icon: Hash,
                  color: 'text-yellow-400',
                  bg: 'bg-yellow-500/10',
                  border: 'border-yellow-500/20',
                },
                {
                  label: 'Services Affected',
                  value: new Set(filteredFailedOps.map(o => o.serviceName)).size,
                  icon: Globe,
                  color: 'text-purple-400',
                  bg: 'bg-purple-500/10',
                  border: 'border-purple-500/20',
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`${card.bg} ${card.border} border rounded-lg p-4`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                    <span className="text-xs text-slate-400 uppercase tracking-wider">{card.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Two column: Exception Groups + Failed Operations */}
            <div className="grid grid-cols-2 gap-4">
              {/* Exception Groups */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Bug className="w-4 h-4 text-orange-400" />
                    Exception Groups
                  </h3>
                  <button
                    onClick={loadFailures}
                    disabled={failuresLoading}
                    className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${failuresLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {failuresLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                  </div>
                ) : filteredExceptions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                    <CheckCircle className="w-8 h-8 mb-2 text-green-400" />
                    <p className="text-sm">No exceptions found{excludedServices.size > 0 ? ' (filters applied)' : ' in this time range'}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredExceptions.map((exc, i) => (
                      <motion.div
                        key={exc.id || i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-red-500/30 transition-colors group"
                      >
                        <div className="flex items-start justify-between">
                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              const table = getExceptionsTableName();
                              const safeProblemId = escapeKqlString(exc.problemId);
                              const problemIdCol = isLogAnalyticsWorkspace ? 'ProblemId' : 'problemId';
                              const columns = isLogAnalyticsWorkspace
                                ? 'TimeGenerated, ExceptionType, ProblemId, OuterMessage, Assembly, Method, SeverityLevel, OperationId, AppRoleName, Details'
                                : 'timestamp, type, message, outerMessage, assembly, method, severityLevel, operation_Id, cloud_RoleName, details';
                              const orderCol = isLogAnalyticsWorkspace ? 'TimeGenerated' : 'timestamp';
                              const kql = `${table}\n| where ${problemIdCol} == "${safeProblemId}"\n| project ${columns}\n| order by ${orderCol} desc\n| take 50`;
                              setCustomKql(kql);
                              setViewMode('custom');
                              executeCustomKql(kql);
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <AlertOctagon className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-red-300 truncate">{exc.type}</span>
                            </div>
                            <p className="text-xs text-slate-400 truncate" title={exc.message}>
                              {exc.message || exc.outerMessage}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Server className="w-3 h-3" />
                                {exc.cloudRoleName}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAnalyzeException(exc); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-xs rounded-md flex items-center gap-1"
                              title="Analyze with AI"
                            >
                              <Sparkles className="w-3 h-3" />
                              Analyze
                            </button>
                            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-full">
                              {exc.count}x
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Failed Operations */}
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-red-400" />
                    Failed Requests ({filteredFailedOps.length})
                  </h3>
                </div>
                {failuresLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                  </div>
                ) : filteredFailedOps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                    <CheckCircle className="w-8 h-8 mb-2 text-green-400" />
                    <p className="text-sm">No failed requests{excludedServices.size > 0 ? ' (filters applied)' : ' in this time range'}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                    {filteredFailedOps.map((op, i) => (
                      <motion.div
                        key={op.operationId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-2.5 bg-slate-900/50 rounded-lg border border-slate-700 hover:border-red-500/30 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedOperation(op);
                          loadTraceDetails(op.operationId);
                        }}
                      >
                        <span className={`px-1.5 py-0.5 text-xs font-mono rounded ${
                          op.resultCode.startsWith('5') ? 'bg-red-500/20 text-red-400' :
                          op.resultCode.startsWith('4') ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {op.resultCode}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{op.operationName}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{op.serviceName}</span>
                            <span>•</span>
                            <span>{new Date(op.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <DurationBadge duration={op.duration} />
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Error Code Distribution */}
            {filteredFailedOps.length > 0 && (
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Error Code Distribution
                </h3>
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    const codeFreq: Record<string, number> = {};
                    filteredFailedOps.forEach(op => {
                      const code = op.resultCode || 'Unknown';
                      codeFreq[code] = (codeFreq[code] || 0) + 1;
                    });
                    const sorted = Object.entries(codeFreq).sort((a, b) => b[1] - a[1]);
                    const max = sorted[0]?.[1] || 1;
                    return sorted.map(([code, count]) => (
                      <div key={code} className="flex items-center gap-2 min-w-[150px]">
                        <span className={`text-sm font-mono font-bold ${
                          code.startsWith('5') ? 'text-red-400' :
                          code.startsWith('4') ? 'text-yellow-400' :
                          'text-slate-300'
                        }`}>
                          {code}
                        </span>
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              code.startsWith('5') ? 'bg-red-500' : 'bg-yellow-500'
                            }`}
                            style={{ width: `${(count / max) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === 'performance' && (
          <div className="space-y-4">
            {/* Performance Stats Cards */}
            {performanceStats && (
              <div className="grid grid-cols-6 gap-3">
                {[
                  { label: 'Total Requests', value: performanceStats.totalRequests.toLocaleString(), icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                  { label: 'Error Rate', value: `${performanceStats.failureRate.toFixed(1)}%`, icon: AlertTriangle, color: performanceStats.failureRate > 5 ? 'text-red-400' : 'text-green-400', bg: performanceStats.failureRate > 5 ? 'bg-red-500/10' : 'bg-green-500/10', border: performanceStats.failureRate > 5 ? 'border-red-500/20' : 'border-green-500/20' },
                  { label: 'Avg Duration', value: `${Math.round(performanceStats.avgDuration)}ms`, icon: Timer, color: 'text-slate-300', bg: 'bg-slate-700/50', border: 'border-slate-600' },
                  { label: 'P50 Latency', value: `${Math.round(performanceStats.p50)}ms`, icon: Gauge, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
                  { label: 'P95 Latency', value: `${Math.round(performanceStats.p95)}ms`, icon: TrendingUp, color: performanceStats.p95 > 5000 ? 'text-orange-400' : 'text-yellow-400', bg: performanceStats.p95 > 5000 ? 'bg-orange-500/10' : 'bg-yellow-500/10', border: performanceStats.p95 > 5000 ? 'border-orange-500/20' : 'border-yellow-500/20' },
                  { label: 'P99 Latency', value: `${Math.round(performanceStats.p99)}ms`, icon: Flame, color: performanceStats.p99 > 10000 ? 'text-red-400' : 'text-orange-400', bg: performanceStats.p99 > 10000 ? 'bg-red-500/10' : 'bg-orange-500/10', border: performanceStats.p99 > 10000 ? 'border-red-500/20' : 'border-orange-500/20' },
                ].map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`${card.bg} ${card.border} border rounded-lg p-3`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                      <span className="text-xs text-slate-400">{card.label}</span>
                    </div>
                    <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Slow Threshold Control */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Timer className="w-4 h-4 text-orange-400" />
                  Slow Requests (duration &gt; {slowThreshold}ms)
                  <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full ml-2">
                    {filteredSlowOps.length} found{excludedServices.size > 0 ? ` (${slowOperations.length} total)` : ''}
                  </span>
                </h3>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400">Threshold:</label>
                  <div className="flex items-center gap-2">
                    {[1000, 3000, 5000, 10000].map(t => (
                      <button
                        key={t}
                        onClick={() => setSlowThreshold(t)}
                        className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                          slowThreshold === t
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        {t >= 1000 ? `${t / 1000}s` : `${t}ms`}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={loadPerformance}
                    disabled={perfLoading}
                    className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${perfLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {perfLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                </div>
              ) : filteredSlowOps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                  <CheckCircle className="w-8 h-8 mb-2 text-green-400" />
                  <p className="text-sm">No requests slower than {slowThreshold}ms{excludedServices.size > 0 ? ' (filters applied)' : ''}</p>
                  <p className="text-xs text-slate-600 mt-1">Try lowering the threshold</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700">
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Operation</th>
                        <th className="pb-3 pr-4">Service</th>
                        <th className="pb-3 pr-4 cursor-pointer hover:text-slate-200 flex items-center gap-1">
                          Duration <ArrowDown className="w-3 h-3" />
                        </th>
                        <th className="pb-3 pr-4">Code</th>
                        <th className="pb-3 pr-4">Time</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {filteredSlowOps
                        .sort((a, b) => b.duration - a.duration)
                        .map((op, idx) => (
                        <motion.tr
                          key={op.operationId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className="cursor-pointer hover:bg-slate-800/50 transition-colors"
                          onClick={() => { setSelectedOperation(op); loadTraceDetails(op.operationId); }}
                        >
                          <td className="py-3 pr-4"><StatusBadge status={op.status} small /></td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-slate-200 truncate max-w-xs block">{op.operationName}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">{op.serviceName}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold ${
                              op.duration > 10000 ? 'bg-red-500/20 text-red-400' :
                              op.duration > 5000 ? 'bg-orange-500/20 text-orange-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              <Timer className="w-3 h-3" />
                              {op.duration < 1000 ? `${Math.round(op.duration)}ms` : `${(op.duration / 1000).toFixed(2)}s`}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-sm font-mono ${
                              op.resultCode.startsWith('2') ? 'text-green-400' :
                              op.resultCode.startsWith('5') ? 'text-red-400' :
                              'text-slate-400'
                            }`}>{op.resultCode}</span>
                          </td>
                          <td className="py-3 pr-4 text-sm text-slate-400 font-mono">
                            {new Date(op.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              <CopyButton value={op.operationId} label="Copy Operation ID" />
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Performance Insights */}
            {performanceStats && filteredSlowOps.length > 0 && (
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  Performance Insights
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {/* Slow by Service */}
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <h4 className="text-xs text-slate-400 mb-2">Slowest Services</h4>
                    <div className="space-y-2">
                      {(() => {
                        const serviceDurations: Record<string, { total: number; count: number }> = {};
                        filteredSlowOps.forEach(op => {
                          if (!serviceDurations[op.serviceName]) serviceDurations[op.serviceName] = { total: 0, count: 0 };
                          serviceDurations[op.serviceName].total += op.duration;
                          serviceDurations[op.serviceName].count += 1;
                        });
                        return Object.entries(serviceDurations)
                          .map(([name, d]) => ({ name, avg: d.total / d.count, count: d.count }))
                          .sort((a, b) => b.avg - a.avg)
                          .slice(0, 5)
                          .map((s, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-xs text-slate-300 truncate">{s.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">{s.count} reqs</span>
                                <span className="text-xs text-orange-400 font-mono">{Math.round(s.avg)}ms avg</span>
                              </div>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                  {/* Slow by Endpoint */}
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <h4 className="text-xs text-slate-400 mb-2">Slowest Endpoints</h4>
                    <div className="space-y-2">
                      {(() => {
                        const endpointDurations: Record<string, { total: number; count: number }> = {};
                        filteredSlowOps.forEach(op => {
                          const key = op.operationName || 'Unknown';
                          if (!endpointDurations[key]) endpointDurations[key] = { total: 0, count: 0 };
                          endpointDurations[key].total += op.duration;
                          endpointDurations[key].count += 1;
                        });
                        return Object.entries(endpointDurations)
                          .map(([name, d]) => ({ name, avg: d.total / d.count, count: d.count }))
                          .sort((a, b) => b.avg - a.avg)
                          .slice(0, 5)
                          .map((e, i) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-300 truncate flex-1" title={e.name}>{e.name}</span>
                              <span className="text-xs text-orange-400 font-mono flex-shrink-0">{Math.round(e.avg)}ms</span>
                            </div>
                          ));
                      })()}
                    </div>
                  </div>
                  {/* Duration Distribution */}
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <h4 className="text-xs text-slate-400 mb-2">Duration Distribution</h4>
                    <div className="space-y-2">
                      {(() => {
                        const buckets = [
                          { label: '1-3s', min: 1000, max: 3000, color: 'bg-yellow-500' },
                          { label: '3-5s', min: 3000, max: 5000, color: 'bg-orange-500' },
                          { label: '5-10s', min: 5000, max: 10000, color: 'bg-red-500' },
                          { label: '10s+', min: 10000, max: Infinity, color: 'bg-red-600' },
                        ];
                        const total = filteredSlowOps.length || 1;
                        return buckets.map((b, i) => {
                          const count = filteredSlowOps.filter(op => op.duration >= b.min && op.duration < b.max).length;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 w-12">{b.label}</span>
                              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full ${b.color} rounded-full`} style={{ width: `${(count / total) * 100}%` }} />
                              </div>
                              <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exception Analysis Panel */}
      <AnimatePresence>
        {analysisPanel.visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex justify-end"
            onClick={() => setAnalysisPanel(prev => ({ ...prev, visible: false }))}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-[700px] h-full bg-slate-900 border-l border-slate-700 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Panel Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 p-4 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <h2 className="text-lg font-semibold text-white">AI Exception Analysis</h2>
                  </div>
                  <button
                    onClick={() => setAnalysisPanel(prev => ({ ...prev, visible: false }))}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {analysisPanel.exception && (
                  <div className="mt-2">
                    <p className="text-sm text-red-300 font-medium">{analysisPanel.exception.type}</p>
                    <p className="text-xs text-slate-400 truncate">{analysisPanel.exception.message || analysisPanel.exception.outerMessage}</p>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* Error */}
                {analysisPanel.error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
                    {analysisPanel.error}
                  </div>
                )}

                {/* Loading Detail */}
                {analysisPanel.loading === 'detail' && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin mr-2" />
                    <span className="text-slate-300">Loading exception details...</span>
                  </div>
                )}

                {/* Exception Detail */}
                {analysisPanel.detail && (
                  <>
                    {/* Stack Trace */}
                    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                        <Code2 className="w-4 h-4 text-blue-400" />
                        Stack Trace
                        <span className="text-xs text-slate-500">({analysisPanel.detail.parsedFrames.length} frames)</span>
                      </h3>
                      {analysisPanel.detail.stackTrace ? (
                        <pre className="text-xs text-slate-300 font-mono bg-slate-950 rounded p-3 overflow-x-auto max-h-60 whitespace-pre-wrap">
                          {analysisPanel.detail.stackTrace}
                        </pre>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No stack trace available for this exception group</p>
                      )}

                      {/* Parsed Frames with file info */}
                      {analysisPanel.detail.parsedFrames.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-slate-400 font-medium mb-1">Parsed Frames:</p>
                          {analysisPanel.detail.parsedFrames.slice(0, 8).map((frame, fi) => (
                            <div key={fi} className="flex items-center gap-2 text-xs">
                              <span className="text-slate-500 w-4">{fi}</span>
                              <span className="text-blue-300 font-mono truncate">{frame.method}</span>
                              {frame.fileName && (
                                <span className="text-green-400 flex items-center gap-1">
                                  <FileCode className="w-3 h-3" />
                                  {frame.fileName.split('/').pop()}:{frame.lineNumber}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Repo Selection + Run Analysis */}
                    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                      <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        AI Code Analysis
                      </h3>

                      {/* Config */}
                      {!analysisPanel.orgUrl && (
                        <p className="text-xs text-yellow-400 mb-3">
                          Configure Engineering Dashboard settings first (DevOps org/project) to enable code analysis.
                        </p>
                      )}

                      {availableRepos.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <label className="text-xs text-slate-400">Repository:</label>
                          <select
                            value={analysisPanel.repoId}
                            onChange={(e) => setAnalysisPanel(prev => ({ ...prev, repoId: e.target.value }))}
                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200"
                          >
                            {availableRepos.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <button
                        onClick={handleRunAIAnalysis}
                        disabled={analysisPanel.loading === 'analysis' || !analysisPanel.orgUrl || !analysisPanel.repoId}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                      >
                        {analysisPanel.loading === 'analysis' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analyzing with AI...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Analyze Exception with AI
                          </>
                        )}
                      </button>
                    </div>

                    {/* Analysis Results */}
                    {analysisPanel.analysis && (
                      <div className="space-y-4">
                        {!analysisPanel.analysis.success && (
                          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
                            {analysisPanel.analysis.error || 'Analysis failed'}
                          </div>
                        )}

                        {analysisPanel.analysis.success && (
                          <>
                            {/* Source File Info */}
                            {analysisPanel.analysis.filePath && (
                              <div className="bg-slate-800 rounded-lg border border-green-500/30 p-3">
                                <div className="flex items-center gap-2 text-sm">
                                  <FileCode className="w-4 h-4 text-green-400" />
                                  <span className="text-green-300 font-mono">{analysisPanel.analysis.filePath}</span>
                                  {analysisPanel.analysis.lineNumber && (
                                    <span className="text-slate-400">: line {analysisPanel.analysis.lineNumber}</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* AI Summary */}
                            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                                <Eye className="w-4 h-4 text-blue-400" />
                                AI Analysis
                                {analysisPanel.analysis.model && (
                                  <span className="text-xs text-slate-500">({analysisPanel.analysis.model})</span>
                                )}
                              </h3>
                              <div className="prose prose-sm prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                                {analysisPanel.analysis.summary}
                              </div>
                            </div>

                            {/* Fixed Code Preview */}
                            {analysisPanel.analysis.fixedCode && (
                              <div className="bg-slate-800 rounded-lg border border-purple-500/30 p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                                    <Code2 className="w-4 h-4" />
                                    Suggested Fix
                                  </h3>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(analysisPanel.analysis!.fixedCode!)}
                                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" /> Copy
                                  </button>
                                </div>
                                <pre className="text-xs text-green-300 font-mono bg-slate-950 rounded p-3 overflow-x-auto max-h-80 whitespace-pre-wrap">
                                  {analysisPanel.analysis.fixedCode}
                                </pre>
                              </div>
                            )}

                            {/* Create PR Button */}
                            {analysisPanel.analysis.fixedCode && analysisPanel.analysis.filePath && (
                              <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-3">
                                  <GitPullRequest className="w-4 h-4 text-green-400" />
                                  Create Pull Request
                                </h3>
                                <p className="text-xs text-slate-400 mb-3">
                                  Create a PR with this fix in Azure DevOps. A new branch will be created automatically.
                                </p>

                                {analysisPanel.prResult ? (
                                  <div className={`p-3 rounded-lg text-sm ${
                                    analysisPanel.prResult.success
                                      ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                                      : 'bg-red-500/10 border border-red-500/30 text-red-300'
                                  }`}>
                                    <p>{analysisPanel.prResult.message}</p>
                                    {analysisPanel.prResult.pullRequestUrl && (
                                      <a
                                        href={analysisPanel.prResult.pullRequestUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 mt-2 text-blue-400 hover:text-blue-300 text-xs"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        Open PR #{analysisPanel.prResult.pullRequestId}
                                      </a>
                                    )}
                                    {analysisPanel.prResult.branchName && (
                                      <p className="text-xs text-slate-500 mt-1">Branch: {analysisPanel.prResult.branchName}</p>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={handleCreatePR}
                                    disabled={analysisPanel.loading === 'pr'}
                                    className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                                  >
                                    {analysisPanel.loading === 'pr' ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Creating PR...
                                      </>
                                    ) : (
                                      <>
                                        <GitPullRequest className="w-4 h-4" />
                                        Create Fix PR
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trace Details Panel */}
      <AnimatePresence>
        {selectedOperation && (
          <TraceDetailsPanel
            operation={selectedOperation}
            spans={spans}
            isLoading={queryState.isLoading}
            onClose={() => {
              setSelectedOperation(null);
              setSpans([]);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
