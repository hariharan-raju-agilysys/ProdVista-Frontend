import { useState, useEffect, useCallback } from 'react';
import { 
  Database, Play, Copy, Check,
  ChevronDown, AlertCircle, Info, Loader2,
  Maximize2, FileText, Table
} from 'lucide-react';
import clsx from 'clsx';
import { useAzureResources } from '../hooks/useAzureResources';
import { executeLogAnalyticsQuery } from '../services/api';
import { FullScreenModal } from './FullScreenModal';

// Default KQL Query Templates
const DEFAULT_KQL_TEMPLATES = [
  {
    name: 'Recent Errors',
    description: 'Get all error-level logs from the last hour',
    query: `// Recent Errors (last 1 hour)
AppExceptions
| where TimeGenerated > ago(1h)
| project TimeGenerated, ProblemId, OuterMessage, InnermostMessage, AppRoleName
| order by TimeGenerated desc
| take 100`,
    category: 'Errors'
  },
  {
    name: 'Request Performance',
    description: 'Analyze API request performance',
    query: `// Request Performance
AppRequests
| where TimeGenerated > ago(1h)
| summarize 
    Count = count(),
    AvgDuration = avg(DurationMs),
    P95Duration = percentile(DurationMs, 95),
    P99Duration = percentile(DurationMs, 99),
    FailedCount = countif(Success == false)
  by Name
| order by Count desc
| take 20`,
    category: 'Performance'
  },
  {
    name: 'Slow Requests',
    description: 'Find requests taking more than 1 second',
    query: `// Slow Requests (>1 second)
AppRequests
| where TimeGenerated > ago(1h)
| where DurationMs > 1000
| project TimeGenerated, Name, DurationMs, Success, ResultCode, AppRoleName
| order by DurationMs desc
| take 50`,
    category: 'Performance'
  },
  {
    name: 'Application Traces',
    description: 'Recent trace logs from the application',
    query: `// Application Traces
AppTraces
| where TimeGenerated > ago(1h)
| project TimeGenerated, Message, SeverityLevel, AppRoleName, OperationId
| order by TimeGenerated desc
| take 100`,
    category: 'Traces'
  },
  {
    name: 'Dependency Calls',
    description: 'External dependency call statistics',
    query: `// Dependency Call Statistics
AppDependencies
| where TimeGenerated > ago(1h)
| summarize 
    Count = count(),
    AvgDuration = avg(DurationMs),
    FailureRate = round(100.0 * countif(Success == false) / count(), 2)
  by Target, DependencyType, Name
| order by Count desc
| take 20`,
    category: 'Dependencies'
  },
  {
    name: 'Failed Requests',
    description: 'List of failed API requests',
    query: `// Failed Requests
AppRequests
| where TimeGenerated > ago(1h)
| where Success == false
| project TimeGenerated, Name, ResultCode, DurationMs, AppRoleName, OperationId
| order by TimeGenerated desc
| take 100`,
    category: 'Errors'
  },
  {
    name: 'Heartbeat Status',
    description: 'Check agent heartbeat status',
    query: `// Agent Heartbeat
Heartbeat
| where TimeGenerated > ago(30m)
| summarize LastHeartbeat = max(TimeGenerated) by Computer, OSType, Version
| order by LastHeartbeat desc`,
    category: 'Infrastructure'
  },
  {
    name: 'Custom Events',
    description: 'Recent custom events logged',
    query: `// Custom Events
AppEvents
| where TimeGenerated > ago(1h)
| project TimeGenerated, Name, Properties, AppRoleName
| order by TimeGenerated desc
| take 100`,
    category: 'Events'
  },
  {
    name: 'Syslog Errors',
    description: 'Linux syslog error messages',
    query: `// Syslog Errors
Syslog
| where TimeGenerated > ago(1h)
| where SeverityLevel in ("err", "crit", "alert", "emerg")
| project TimeGenerated, Computer, Facility, SeverityLevel, SyslogMessage
| order by TimeGenerated desc
| take 100`,
    category: 'Infrastructure'
  },
  {
    name: 'Azure Activity Log',
    description: 'Recent Azure resource operations',
    query: `// Azure Activity Log
AzureActivity
| where TimeGenerated > ago(24h)
| where ActivityStatus == "Failed" or Level == "Error" or Level == "Warning"
| project TimeGenerated, OperationNameValue, ActivityStatusValue, Level, Caller, ResourceGroup
| order by TimeGenerated desc
| take 50`,
    category: 'Azure'
  }
];

// Time range options
const TIME_RANGES = [
  { label: 'Last 15 minutes', value: 'PT15M' },
  { label: 'Last 30 minutes', value: 'PT30M' },
  { label: 'Last 1 hour', value: 'PT1H' },
  { label: 'Last 4 hours', value: 'PT4H' },
  { label: 'Last 12 hours', value: 'PT12H' },
  { label: 'Last 24 hours', value: 'P1D' },
  { label: 'Last 7 days', value: 'P7D' },
];

interface QueryResult {
  columns: Array<{ name: string; type: string }>;
  rows: any[][];
}

interface LogAnalyticsQueryProps {
  defaultWorkspaceId?: string;
  onClose?: () => void;
}

export function LogAnalyticsQuery({ defaultWorkspaceId, onClose }: LogAnalyticsQueryProps) {
  const { workspaces, defaultWorkspaceId: savedDefaultWorkspace, isLoading: resourcesLoading } = useAzureResources();
  
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(defaultWorkspaceId || '');
  const [query, setQuery] = useState<string>(DEFAULT_KQL_TEMPLATES[0].query);
  const [timeRange, setTimeRange] = useState<string>('PT1H');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showFullScreen, setShowFullScreen] = useState(false);

  // Set default workspace when resources load
  useEffect(() => {
    if (!selectedWorkspaceId && savedDefaultWorkspace) {
      setSelectedWorkspaceId(savedDefaultWorkspace);
    } else if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [savedDefaultWorkspace, workspaces, selectedWorkspaceId]);

  const executeQuery = useCallback(async () => {
    if (!selectedWorkspaceId || !query.trim()) {
      setError('Please select a workspace and enter a query');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const data = await executeLogAnalyticsQuery(selectedWorkspaceId, query, timeRange);
      setResult({
        columns: data.columns || [],
        rows: data.rows || []
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Query execution failed';
      setError(errorMsg);
      setResult(null);
    } finally {
      setIsExecuting(false);
    }
  }, [selectedWorkspaceId, query, timeRange]);

  const handleCopyQuery = async () => {
    await navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTemplateSelect = (template: typeof DEFAULT_KQL_TEMPLATES[0]) => {
    setQuery(template.query);
    setShowTemplates(false);
  };

  const categories = ['All', ...Array.from(new Set(DEFAULT_KQL_TEMPLATES.map(t => t.category)))];
  const filteredTemplates = selectedCategory === 'All' 
    ? DEFAULT_KQL_TEMPLATES 
    : DEFAULT_KQL_TEMPLATES.filter(t => t.category === selectedCategory);

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Log Analytics Query</h2>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/80 hover:text-white">×</button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Workspace & Time Selection */}
        <div className="flex flex-wrap gap-4">
          {/* Workspace Dropdown */}
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Workspace</label>
            {resourcesLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading workspaces...
              </div>
            ) : workspaces.length === 0 ? (
              <div className="px-3 py-2 bg-amber-900/30 border border-amber-700/50 rounded-lg text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                No workspaces configured. Go to Azure Setup to select workspaces.
              </div>
            ) : (
              <select
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select workspace...</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} {ws.id === savedDefaultWorkspace ? '(default)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Time Range */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Time Range</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            >
              {TIME_RANGES.map((tr) => (
                <option key={tr.value} value={tr.value}>{tr.label}</option>
              ))}
            </select>
          </div>

          {/* Templates Button */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">&nbsp;</label>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              Templates
              <ChevronDown className={clsx('w-4 h-4 transition-transform', showTemplates && 'rotate-180')} />
            </button>
          </div>
        </div>

        {/* Templates Panel */}
        {showTemplates && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={clsx(
                    'px-3 py-1 text-xs rounded-full transition-colors',
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {filteredTemplates.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTemplateSelect(template)}
                  className="text-left p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 hover:border-blue-500 transition-colors"
                >
                  <div className="font-medium text-white text-sm">{template.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{template.description}</div>
                  <span className="inline-block mt-2 px-2 py-0.5 text-[10px] bg-slate-700 text-slate-300 rounded">
                    {template.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Query Editor */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-400">KQL Query</label>
            <button
              onClick={handleCopyQuery}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your KQL query here..."
            className="w-full h-48 px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            spellCheck={false}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedWorkspace && (
              <span className="text-xs text-slate-500">
                <Database className="w-3 h-3 inline mr-1" />
                {selectedWorkspace.name}
              </span>
            )}
          </div>
          <button
            onClick={executeQuery}
            disabled={isExecuting || !selectedWorkspaceId || !query.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Query
              </>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
            <div className="flex items-start gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Query Error</div>
                <div className="text-sm mt-1 text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300">
                <Table className="w-4 h-4" />
                <span className="font-medium">Results</span>
                <span className="text-xs text-slate-500">({result.rows.length} rows)</span>
              </div>
              <button
                onClick={() => setShowFullScreen(true)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                <Maximize2 className="w-3 h-3" />
                Full Screen
              </button>
            </div>
            
            {result.rows.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Info className="w-8 h-8 mx-auto mb-2" />
                No results found for this query
              </div>
            ) : (
              <div className="overflow-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50 sticky top-0">
                    <tr>
                      {result.columns.map((col, i) => (
                        <th key={i} className="px-4 py-2 text-left font-medium text-slate-400 border-b border-slate-700">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 100).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-800/50 border-b border-slate-800">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-2 text-slate-300 max-w-md truncate">
                            {cell === null ? <span className="text-slate-600">null</span> : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.rows.length > 100 && (
                  <div className="p-2 text-center text-xs text-slate-500 bg-slate-800/30">
                    Showing 100 of {result.rows.length} rows
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Screen Modal */}
      <FullScreenModal
        isOpen={showFullScreen}
        onClose={() => setShowFullScreen(false)}
        title="Query Results"
        showCopyButton
        contentToCopy={result ? JSON.stringify(result, null, 2) : ''}
      >
        {result && result.rows.length > 0 ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                <tr>
                  {result.columns.map((col, i) => (
                    <th key={i} className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-2 text-slate-700 dark:text-slate-300">
                        {cell === null ? <span className="text-slate-400">null</span> : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">No results</div>
        )}
      </FullScreenModal>
    </div>
  );
}

export default LogAnalyticsQuery;
