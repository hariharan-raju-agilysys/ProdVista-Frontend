import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, Sparkles, Database, Table2, Zap, Settings, Pencil,
  RefreshCw, Clock, X, Save, TestTube,
  CheckCircle2, XCircle, Info, BarChart3, Grid3X3,
  ChevronRight, Terminal, ToggleLeft, ToggleRight,
  Search, Loader2, Server, Rocket, Wifi, WifiOff, Download, Shield, ShieldAlert,
  Copy, Check, Code, AlertCircle, ChevronDown
} from 'lucide-react';
import clsx from 'clsx';
import api from '../services/api';
import aiQueryService, {
  AiQueryResponse,
  SqlValidationResult,
  AiQuerySettings,
  UpdateAiQuerySettingsRequest,
  AutoConfigureResult
} from '../services/aiQueryService';
import userPreferencesService, { AIQueryUserPreferences } from '../services/userPreferencesService';
import { AzureOpenAISelector, DatabaseSelector } from '../components/shared';
import { useAuth } from '../context/AuthContext';
import { useAIChatHub, DatabaseQueryStreamToken } from '../hooks/useAIChatHub';
import type { DatabaseConnection as AzureDatabaseConnection } from '../types/azure';

// ============================================================================
// Types
// ============================================================================

// Local database connection (from DatabaseConnections table)
interface LocalDatabaseConnection {
  id: string;  // GUID
  name: string;
  databaseType: string;
  databaseName?: string;
  serverName?: string;
}

type ViewMode = 'table' | 'json' | 'chart';

// ============================================================================
// Thinking Indicator — Multi-step pipeline visualization
// ============================================================================
const PIPELINE_STEPS = [
  { id: 'understanding', label: 'Understanding', icon: '🧠' },
  { id: 'starting',      label: 'Schema Analysis', icon: '🔍' },
  { id: 'generating',    label: 'SQL Generation', icon: '⚡' },
  { id: 'validating',    label: 'Safety Check', icon: '🛡️' },
  { id: 'executing',     label: 'Executing', icon: '🚀' },
];

function ThinkingIndicator({ phase, progress = 0 }: { phase: string; progress?: number }) {
  const currentIdx = PIPELINE_STEPS.findIndex(s => s.id === phase);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5 space-y-4">
      {/* Pipeline Steps */}
      <div className="flex items-center justify-between gap-1">
        {PIPELINE_STEPS.map((step, i) => {
          const isComplete = i < activeIdx;
          const isActive = i === activeIdx;
          const isPending = i > activeIdx;
          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={clsx(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all duration-500',
                  isComplete && 'bg-green-100 dark:bg-green-900/40 ring-2 ring-green-400',
                  isActive && 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500 animate-pulse',
                  isPending && 'bg-gray-100 dark:bg-slate-700'
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <span>{step.icon}</span>
                  )}
                </div>
                <span className={clsx(
                  'text-[10px] font-medium whitespace-nowrap',
                  isComplete && 'text-green-600 dark:text-green-400',
                  isActive && 'text-blue-600 dark:text-blue-400',
                  isPending && 'text-gray-400 dark:text-gray-500'
                )}>
                  {step.label}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div className={clsx(
                  'flex-1 h-0.5 mx-2 rounded-full transition-all duration-500 mt-[-18px]',
                  i < activeIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-slate-600'
                )} />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Smooth progress bar */}
      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1">
        <div
          className="h-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700 ease-out"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// First Time Setup Wizard
// ============================================================================
interface FirstTimeSetupProps {
  connections: LocalDatabaseConnection[];
  onComplete: (selectedIds: string[]) => void;
  onSkip: () => void;
}

function FirstTimeSetup({ connections, onComplete, onSkip }: FirstTimeSetupProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'welcome' | 'select'>('welcome');

  const toggleConnection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleComplete = () => {
    const ids = Array.from(selectedIds);
    userPreferencesService.setSelectedDatabaseIds(ids);
    userPreferencesService.markAIQuerySetupComplete();
    onComplete(ids);
  };

  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to AI Query Assistant</h2>
            <p className="text-blue-100">Let's set up your database connections</p>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Database className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Select Your Databases</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose which databases AI Query Assistant can access
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Ask in Natural Language</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Query your data using plain English questions
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Settings className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Your Personal Settings</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Preferences are saved locally for your account
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={onSkip}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 
                         hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Skip for Now
              </button>
              <button
                onClick={() => setStep('select')}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 
                         hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Get Started
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-500" />
            Select Your Databases
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose the databases you want to query with AI
          </p>
        </div>

        <div className="p-4 max-h-[50vh] overflow-y-auto">
          {connections.length === 0 ? (
            <div className="text-center py-8">
              <Server className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No database connections found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Add connections in Database Query first
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map(conn => (
                <label
                  key={conn.id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border-2',
                    selectedIds.has(conn.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-700'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(conn.id)}
                    onChange={() => toggleConnection(conn.id)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white">{conn.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {conn.databaseType} {conn.serverName && `• ${conn.serverName}`}
                    </div>
                  </div>
                  {selectedIds.has(conn.id) && (
                    <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedIds.size} database{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 
                         hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={selectedIds.size === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         rounded-lg transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SQL Code Block
// ============================================================================
function SqlCodeBlock({ sql, validation }: { sql: string; validation?: SqlValidationResult }) {
  const [copied, setCopied] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden bg-slate-900 dark:bg-slate-950 border border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Code className="w-3.5 h-3.5" />
          <span>Generated SQL</span>
          {validation && (
            <span className={clsx(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              validation.isValid 
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            )}>
              {validation.isValid ? 'Valid' : 'Issues Found'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {validation && (
            <button
              onClick={() => setShowValidation(!showValidation)}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Toggle validation details"
            >
              <ChevronDown className={clsx('w-4 h-4 transition-transform', showValidation && 'rotate-180')} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title={copied ? 'Copied!' : 'Copy SQL'}
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      <pre className="p-4 text-sm text-slate-100 overflow-x-auto font-mono max-h-64 overflow-y-auto">
        <code>{sql}</code>
      </pre>
      
      {showValidation && validation && (
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50 space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3 h-3" />
            <span>Query Type: <span className="text-white">{validation.queryType}</span></span>
          </div>
          {validation.tablesReferenced.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Table2 className="w-3 h-3" />
              <span>Tables: <span className="text-white">{validation.tablesReferenced.join(', ')}</span></span>
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="space-y-1">
              {validation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-yellow-400">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          {validation.errors.length > 0 && (
            <div className="space-y-1">
              {validation.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                  <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Data Results Table
// ============================================================================
function DataResultsTable({ data, viewMode, rowCount, executionTimeMs }: { 
  data: Record<string, unknown>[]; 
  viewMode: ViewMode;
  rowCount: number;
  executionTimeMs: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
        <Table2 className="w-8 h-8 mb-2 opacity-50" />
        <p>No data returned</p>
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  if (viewMode === 'json') {
    return (
      <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-96">
        <pre className="text-xs text-slate-100 font-mono whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Grid3X3 className="w-4 h-4" />
            {rowCount} rows
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {executionTimeMs}ms
          </span>
        </div>
      </div>
      
      <div className="overflow-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead className="bg-gray-50 dark:bg-slate-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
            {data.slice(0, 100).map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap"
                  >
                    {formatCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {data.length > 100 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Showing first 100 of {data.length} rows
        </p>
      )}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ============================================================================
// Query Result Card
// ============================================================================
function QueryResultCard({ 
  response, 
  validation 
}: { 
  response: AiQueryResponse; 
  validation?: SqlValidationResult;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showSql, setShowSql] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExportCsv = async () => {
    if (!response.data || response.data.length === 0) return;
    setExporting(true);
    try {
      await aiQueryService.exportCsv(
        response.data as Record<string, unknown>[],
        response.suggestedCsvName
      );
    } catch {
      // Silently fail — user will see no file downloaded
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={clsx(
        'flex items-center gap-3 p-3 rounded-lg',
        response.success 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
      )}>
        {response.success ? (
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        )}
        <div className="flex-1">
          <p className={clsx(
            'text-sm font-medium',
            response.success 
              ? 'text-green-700 dark:text-green-300'
              : 'text-red-700 dark:text-red-300'
          )}>
            {response.success 
              ? `Query executed successfully - ${response.rowCount} row${response.rowCount !== 1 ? 's' : ''} returned`
              : response.errorMessage || 'Query execution failed'
            }
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {/* Validation Status Badge */}
          {response.validationStatus && (
            <span className={clsx(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              response.validationStatus === 'SAFE'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
            )}>
              {response.validationStatus === 'SAFE' ? (
                <Shield className="w-3 h-3" />
              ) : (
                <ShieldAlert className="w-3 h-3" />
              )}
              {response.validationStatus}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {response.provider}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {response.executionTimeMs}ms
          </span>
        </div>
      </div>

      {/* Explanation */}
      {response.explanation && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Explanation</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{response.explanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Notes */}
      {response.performanceNotes && response.performanceNotes !== 'N/A' && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Performance Notes</p>
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">{response.performanceNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* SQL Section */}
      {response.generatedSql && (
        <div className="space-y-2">
          <button 
            onClick={() => setShowSql(!showSql)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ChevronRight className={clsx('w-4 h-4 transition-transform', showSql && 'rotate-90')} />
            <Code className="w-4 h-4" />
            Generated SQL
          </button>
          {showSql && (
            <SqlCodeBlock sql={response.generatedSql} validation={validation} />
          )}
        </div>
      )}

      {/* Data Results */}
      {response.success && response.data && response.data.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Table2 className="w-4 h-4" />
              Results
            </h4>
            <div className="flex items-center gap-2">
              {/* CSV Export Button */}
              <button
                onClick={handleExportCsv}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                  bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400
                  hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={clsx(
                    'px-2 py-1 text-xs rounded transition-colors',
                    viewMode === 'table' 
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('json')}
                  className={clsx(
                    'px-2 py-1 text-xs rounded transition-colors',
                    viewMode === 'json' 
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  <Terminal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          <DataResultsTable 
            data={response.data} 
            viewMode={viewMode}
            rowCount={response.rowCount}
            executionTimeMs={response.executionTimeMs}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Settings Modal with Auto-Discovery
// ============================================================================
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AiQuerySettings | null;
  onSave: (settings: UpdateAiQuerySettingsRequest) => Promise<void>;
}

function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const [formData, setFormData] = useState<UpdateAiQuerySettingsRequest>({
    isEnabled: settings?.isEnabled ?? true,
    provider: settings?.provider ?? 'Azure',
    azureEndpoint: settings?.azureEndpoint ?? '',
    azureDeploymentName: settings?.azureDeploymentName ?? '',
    useAzureManagedIdentity: settings?.useAzureManagedIdentity ?? true,
    maxQueryRows: settings?.maxQueryRows ?? 100,
    queryTimeoutSeconds: settings?.queryTimeoutSeconds ?? 30,
    defaultConnectionId: settings?.defaultConnectionId ?? undefined,
    allowedTables: settings?.allowedTables ?? '',
    selectedDatabaseIds: settings?.selectedDatabaseIds ?? [],
    enableCrossDatabaseJoins: settings?.enableCrossDatabaseJoins ?? false,
    // Azure SQL database selections
    selectedAzureDatabaseIds: settings?.selectedAzureDatabaseIds ?? [],
    defaultAzureDatabaseId: settings?.defaultAzureDatabaseId ?? undefined,
    // RAG settings
    enableRagCache: settings?.enableRagCache ?? true,
    embeddingDeploymentName: settings?.embeddingDeploymentName ?? undefined,
    ragSimilarityThreshold: settings?.ragSimilarityThreshold ?? 0.85,
    ragAutoStore: settings?.ragAutoStore ?? true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Auto-discovery state (used for AI settings discovery)
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [autoConfigResult, setAutoConfigResult] = useState<AutoConfigureResult | null>(null);
  
  // Azure database selections
  const [selectedAzureDatabases, setSelectedAzureDatabases] = useState<AzureDatabaseConnection[]>([]);
  
  // Local database connections
  const [localConnections, setLocalConnections] = useState<LocalDatabaseConnection[]>([]);
  const [isLoadingLocalConnections, setIsLoadingLocalConnections] = useState(false);
  
  // Load local connections when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadLocalConnections = async () => {
        setIsLoadingLocalConnections(true);
        try {
          const res = await api.get<LocalDatabaseConnection[]>('/databasequeries/connections');
          setLocalConnections(res.data);
        } catch (err) {
          console.error('Failed to load local connections:', err);
        } finally {
          setIsLoadingLocalConnections(false);
        }
      };
      loadLocalConnections();
    }
  }, [isOpen]);

  useEffect(() => {
    if (settings) {
      setFormData({
        isEnabled: settings.isEnabled,
        provider: settings.provider,
        azureEndpoint: settings.azureEndpoint ?? '',
        azureDeploymentName: settings.azureDeploymentName ?? '',
        useAzureManagedIdentity: settings.useAzureManagedIdentity,
        maxQueryRows: settings.maxQueryRows,
        queryTimeoutSeconds: settings.queryTimeoutSeconds,
        defaultConnectionId: settings.defaultConnectionId ?? undefined,
        allowedTables: settings.allowedTables ?? '',
        selectedDatabaseIds: settings.selectedDatabaseIds ?? [],
        enableCrossDatabaseJoins: settings.enableCrossDatabaseJoins ?? false,
        // Azure SQL database selections
        selectedAzureDatabaseIds: settings.selectedAzureDatabaseIds ?? [],
        defaultAzureDatabaseId: settings.defaultAzureDatabaseId ?? undefined,
        // RAG settings
        enableRagCache: settings.enableRagCache ?? true,
        embeddingDeploymentName: settings.embeddingDeploymentName ?? undefined,
        ragSimilarityThreshold: settings.ragSimilarityThreshold ?? 0.85,
        ragAutoStore: settings.ragAutoStore ?? true,
      });
    }
  }, [settings]);

  const handleAutoDiscover = async () => {
    setIsDiscovering(true);
    setAutoConfigResult(null);
    try {
      // Auto-configure gets everything in one call
      const result = await aiQueryService.autoConfigureSettings();
      setAutoConfigResult(result);
      
      // Auto-populate form if recommendations found
      if (result.recommendedEndpoint) {
        setFormData(f => ({
          ...f,
          azureEndpoint: result.recommendedEndpoint || f.azureEndpoint,
          azureDeploymentName: result.recommendedDeployment || f.azureDeploymentName
        }));
      }
    } catch (err) {
      console.error('Auto-discovery failed:', err);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await aiQueryService.testProvider();
      setTestResult({ success: result.success, message: result.message });
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            AI Query Settings
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoDiscover}
              disabled={isDiscovering}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50"
            >
              {isDiscovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Auto-Discover
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Auto-Config Result Banner */}
        {autoConfigResult && (
          <div className={clsx(
            'mx-6 mt-4 p-3 rounded-lg text-sm',
            autoConfigResult.isReadyToEnable
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
          )}>
            <div className="flex items-center gap-2 font-medium mb-1">
              {autoConfigResult.isReadyToEnable ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
              {autoConfigResult.isReadyToEnable ? 'Ready to Enable!' : 'Partially Configured'}
            </div>
            <div className="text-xs space-y-0.5 opacity-80">
              <p>Found {autoConfigResult.discoveredOpenAIResources} Azure OpenAI resource(s), {autoConfigResult.discoveredDeployments} deployment(s)</p>
              <p>Found {autoConfigResult.discoveredDatabases} Azure SQL database(s)</p>
              {autoConfigResult.recommendedModel && <p>Recommended model: {autoConfigResult.recommendedModel}</p>}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable AI Query Assistant</label>
              <p className="text-xs text-gray-500 dark:text-gray-400">Allow natural language queries to your database</p>
            </div>
            <button
              onClick={() => setFormData(f => ({ ...f, isEnabled: !f.isEnabled }))}
              className={clsx(
                'p-1 rounded-lg transition-colors',
                formData.isEnabled ? 'text-green-600' : 'text-gray-400'
              )}
            >
              {formData.isEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
            </button>
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">AI Provider</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData(f => ({ ...f, provider: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
            >
              <option value="Azure">Azure OpenAI</option>
              <option value="Aws">AWS Bedrock</option>
              <option value="Ollama">Ollama (Local)</option>
            </select>
          </div>

          {/* Azure Settings */}
          {formData.provider === 'Azure' && (
            <>
              {/* Azure OpenAI Resource Selection - Using Shared Component */}
              <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                <AzureOpenAISelector
                  initialEndpoint={formData.azureEndpoint}
                  initialDeploymentName={formData.azureDeploymentName}
                  showAutoDiscover={false} // We have our own auto-discover button in the header
                  onSelectionChange={({ endpoint, deploymentName }) => {
                    setFormData(f => ({
                      ...f,
                      azureEndpoint: endpoint,
                      azureDeploymentName: deploymentName
                    }));
                  }}
                  className="!space-y-3"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useManagedIdentity"
                  checked={formData.useAzureManagedIdentity}
                  onChange={(e) => setFormData(f => ({ ...f, useAzureManagedIdentity: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="useManagedIdentity" className="text-sm text-gray-700 dark:text-gray-300">
                  Use Managed Identity (recommended for Azure-hosted apps)
                </label>
              </div>
            </>
          )}

          {/* Local Database Connections */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Server className="w-4 h-4" />
                Local Database Connections
              </label>
              {isLoadingLocalConnections && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
            
            {localConnections.length === 0 ? (
              <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No database connections configured. 
                  <br />
                  <span className="text-xs">Add connections in the Database Query page first.</span>
                </p>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 space-y-2 max-h-48 overflow-y-auto">
                {localConnections.map(conn => {
                  const isSelected = formData.selectedDatabaseIds?.includes(conn.id) ?? false;
                  return (
                    <label
                      key={conn.id}
                      className={clsx(
                        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800' 
                          : 'hover:bg-gray-100 dark:hover:bg-slate-800 border border-transparent'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          setFormData(f => {
                            const currentIds = f.selectedDatabaseIds ?? [];
                            if (e.target.checked) {
                              return { 
                                ...f, 
                                selectedDatabaseIds: [...currentIds, conn.id],
                                defaultConnectionId: f.defaultConnectionId ?? conn.id
                              };
                            } else {
                              const newIds = currentIds.filter(id => id !== conn.id);
                              return { 
                                ...f, 
                                selectedDatabaseIds: newIds,
                                defaultConnectionId: f.defaultConnectionId === conn.id 
                                  ? newIds[0] 
                                  : f.defaultConnectionId 
                              };
                            }
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{conn.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {conn.databaseType} {conn.serverName && `• ${conn.serverName}`} {conn.databaseName && `• ${conn.databaseName}`}
                        </div>
                      </div>
                      {formData.defaultConnectionId === conn.id && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            
            {(formData.selectedDatabaseIds?.length ?? 0) > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formData.selectedDatabaseIds?.length} database(s) selected for AI queries
              </p>
            )}
          </div>

          {/* Azure Database Selection - Fetches from Azure Subscriptions */}
          <DatabaseSelector
            selectedDatabases={selectedAzureDatabases}
            onSelectionChange={(databases) => {
              setSelectedAzureDatabases(databases);
              // Update formData with Azure database IDs (these are resource IDs, not GUIDs)
              setFormData(f => ({
                ...f,
                selectedAzureDatabaseIds: databases.map(db => db.id),
                defaultAzureDatabaseId: databases.length > 0 ? databases[0].id : undefined
              }));
            }}
            maxSelections={10}
            enableCrossJoins={formData.enableCrossDatabaseJoins ?? false}
            onCrossJoinChange={(enabled) => setFormData(f => ({ ...f, enableCrossDatabaseJoins: enabled }))}
            showTestConnection={true}
          />

          {/* Query Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Rows</label>
              <input
                type="number"
                value={formData.maxQueryRows}
                onChange={(e) => setFormData(f => ({ ...f, maxQueryRows: parseInt(e.target.value) || 100 }))}
                min={1}
                max={1000}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timeout (seconds)</label>
              <input
                type="number"
                value={formData.queryTimeoutSeconds}
                onChange={(e) => setFormData(f => ({ ...f, queryTimeoutSeconds: parseInt(e.target.value) || 30 }))}
                min={5}
                max={300}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-600 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={clsx(
              'flex items-center gap-2 p-3 rounded-lg text-sm',
              testResult.success 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            )}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
          <button
            onClick={handleTest}
            disabled={isTesting || !formData.isEnabled}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-50"
          >
            {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            Test Connection
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================
export default function AiQueryAssistantPage() {
  // Role-based access
  const { isManager } = useAuth();
  
  // SignalR connection for real-time query execution (avoids HTTP timeouts)
  const { isConnected: signalRConnected, executeDatabaseQuery } = useAIChatHub({});
  
  const [question, setQuestion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState('thinking');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [response, setResponse] = useState<AiQueryResponse | null>(null);
  const [validation, setValidation] = useState<SqlValidationResult | null>(null);
  const [settings, setSettings] = useState<AiQuerySettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Local database connections (GUIDs from DatabaseConnections table)
  const [localConnections, setLocalConnections] = useState<LocalDatabaseConnection[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<Set<string>>(new Set());
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  
  // Azure database connections (from settings.selectedAzureDatabaseIds)
  const [selectedAzureDbIds, setSelectedAzureDbIds] = useState<Set<string>>(new Set());
  
  // User preferences (stored in localStorage)
  const [userPrefs, setUserPrefs] = useState<AIQueryUserPreferences | null>(null);
  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  
  // Parse Azure database resource IDs to get display names
  const configuredAzureDatabases = useMemo(() => {
    const azureIds = settings?.selectedAzureDatabaseIds ?? [];
    return azureIds.map(id => {
      // Parse resource ID: /subscriptions/.../servers/serverName/databases/dbName
      const parts = id.split('/');
      const dbIndex = parts.indexOf('databases');
      const serverIndex = parts.indexOf('servers');
      const dbName = dbIndex > 0 ? parts[dbIndex + 1] : 'Unknown DB';
      const serverName = serverIndex > 0 ? parts[serverIndex + 1] : 'Azure SQL';
      return { id, name: dbName, serverName, isAzure: true };
    });
  }, [settings?.selectedAzureDatabaseIds]);
  
  // Get selected connections as array
  const selectedConnections = localConnections.filter(conn => selectedConnectionIds.has(conn.id));
  
  // Check if ANY databases are configured (local OR Azure)
  const hasAnyConfiguredDatabases = useMemo(() => {
    const hasLocalDbs = (settings?.selectedDatabaseIds?.length ?? 0) > 0 || 
                        !!settings?.defaultConnectionId ||
                        (userPrefs?.selectedDatabaseIds?.length ?? 0) > 0;
    const hasAzureDbs = (settings?.selectedAzureDatabaseIds?.length ?? 0) > 0;
    return hasLocalDbs || hasAzureDbs;
  }, [settings, userPrefs]);
  
  // Get only configured connections (from user preferences or DB settings) to display in header
  const configuredConnections = useMemo(() => {
    // First check user preferences (localStorage)
    const userSelectedIds = userPrefs?.selectedDatabaseIds ?? [];
    if (userSelectedIds.length > 0) {
      const configuredIds = new Set(userSelectedIds);
      return localConnections.filter(c => configuredIds.has(c.id));
    }
    
    // Fall back to DB settings (tenant-level defaults)
    if (!settings?.selectedDatabaseIds || settings.selectedDatabaseIds.length === 0) {
      if (settings?.defaultConnectionId) {
        return localConnections.filter(c => c.id === settings.defaultConnectionId);
      }
      return [];
    }
    const configuredIds = new Set(settings.selectedDatabaseIds);
    return localConnections.filter(c => configuredIds.has(c.id));
  }, [localConnections, userPrefs?.selectedDatabaseIds, settings?.selectedDatabaseIds, settings?.defaultConnectionId]);

  // Load user preferences from localStorage on mount
  useEffect(() => {
    const prefs = userPreferencesService.getAIQueryPreferences();
    setUserPrefs(prefs);
  }, []);

  // Load local database connections
  const loadLocalConnections = useCallback(async () => {
    setIsLoadingConnections(true);
    try {
      const res = await api.get<LocalDatabaseConnection[]>('/databasequeries/connections');
      const connections = res.data;
      setLocalConnections(connections);
      
      // Get user preferences from localStorage first
      const prefs = userPreferencesService.getAIQueryPreferences();
      const userSelectedIds = prefs?.selectedDatabaseIds ?? [];
      
      if (userSelectedIds.length > 0) {
        // Use user's localStorage preferences
        const validIds = connections
          .filter(c => userSelectedIds.includes(c.id))
          .map(c => c.id);
        setSelectedConnectionIds(new Set(validIds));
      } else if (settings?.selectedDatabaseIds && settings.selectedDatabaseIds.length > 0) {
        // Fall back to DB settings (tenant-level)
        const configuredIds = new Set(settings.selectedDatabaseIds);
        const validIds = connections
          .filter(c => configuredIds.has(c.id))
          .map(c => c.id);
        setSelectedConnectionIds(new Set(validIds));
      } else if (settings?.defaultConnectionId) {
        // Fall back to default connection if no explicit selections
        const defaultExists = connections.find(c => c.id === settings.defaultConnectionId);
        if (defaultExists) {
          setSelectedConnectionIds(new Set([settings.defaultConnectionId]));
        } else {
          setSelectedConnectionIds(new Set());
        }
      } else {
        // No configured selections - don't auto-show first-time setup
        // User can manually open setup from the settings button instead
        setSelectedConnectionIds(new Set());
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setIsLoadingConnections(false);
    }
  }, [settings?.selectedDatabaseIds, settings?.defaultConnectionId]);
  
  // Toggle connection selection
  const toggleConnection = (connId: string) => {
    setSelectedConnectionIds(prev => {
      const next = new Set(prev);
      if (next.has(connId)) {
        next.delete(connId);
      } else {
        next.add(connId);
      }
      return next;
    });
  };

  // Load settings and connections on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const settingsData = await aiQueryService.getSettings();
        setSettings(settingsData);
        
        // Auto-select Azure databases if configured
        if (settingsData?.selectedAzureDatabaseIds?.length) {
          setSelectedAzureDbIds(new Set(settingsData.selectedAzureDatabaseIds));
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadInitialData();
  }, []);
  
  // Load connections when settings change
  useEffect(() => {
    loadLocalConnections();
  }, [loadLocalConnections]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!question.trim() || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setResponse(null);
    setValidation(null);
    setProcessingProgress(0);

    // Determine which database to use: local connection first, then Azure
    const selectedLocalConnection = selectedConnections.length > 0 ? selectedConnections[0].id : undefined;
    const selectedAzureDb = selectedAzureDbIds.size > 0 ? Array.from(selectedAzureDbIds)[0] : undefined;

    // Use SignalR if connected (avoids HTTP timeout issues), otherwise fall back to REST
    if (signalRConnected && executeDatabaseQuery) {
      try {
        const result = await executeDatabaseQuery(
          {
            question: question.trim(),
            connectionId: selectedLocalConnection,
            azureDatabaseId: !selectedLocalConnection ? selectedAzureDb : undefined,
            executeQuery: true,
            maxRows: settings?.maxQueryRows || 100
          },
          {
            onPhaseChange: (phase, message, progress) => {
              setProcessingPhase(phase);
              setProcessingProgress(progress);
              console.log(`[AI Query] ${phase}: ${message} (${progress}%)`);
            },
            onSqlGenerated: (sql) => {
              console.log('[AI Query] SQL generated:', sql);
            },
            onComplete: async (token: DatabaseQueryStreamToken) => {
              // Convert SignalR token to AiQueryResponse format
              const responseData: AiQueryResponse = {
                success: token.success ?? false,
                generatedSql: token.generatedSql,
                data: token.data,
                rowCount: token.rowCount ?? 0,
                executionTimeMs: token.executionTimeMs ?? 0,
                errorMessage: token.error,
                errorCode: undefined,
                provider: 'signalr' as any,
                executedAt: new Date().toISOString()
              };
              setResponse(responseData);

              // Validate SQL if generated
              if (token.generatedSql) {
                try {
                  const validationResult = await aiQueryService.validateSql(token.generatedSql);
                  setValidation(validationResult);
                } catch (e) {
                  console.warn('Failed to validate SQL:', e);
                }
              }

              // Scroll to results
              setTimeout(() => {
                resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);

              setIsProcessing(false);
              setProcessingPhase('thinking');
              setProcessingProgress(0);
            },
            onError: (errorMsg) => {
              setError(errorMsg);
              setIsProcessing(false);
              setProcessingPhase('thinking');
              setProcessingProgress(0);
            }
          }
        );

        // If result is null (stream completed without calling onComplete), handle it
        if (!result && !response) {
          // Query completed in callbacks
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsProcessing(false);
        setProcessingPhase('thinking');
        setProcessingProgress(0);
      }
    } else {
      // Fall back to REST API (may timeout for long queries)
      try {
        // Phase 1: Understanding
        setProcessingPhase('understanding');
        setProcessingProgress(15);
        await new Promise(r => setTimeout(r, 300));

        // Phase 2: Generating
        setProcessingPhase('generating');
        setProcessingProgress(30);
        
        const result = await aiQueryService.askQuestion({
          question: question.trim(),
          connectionId: selectedLocalConnection,
          azureDatabaseId: !selectedLocalConnection ? selectedAzureDb : undefined,
          executeQuery: true,
          maxRows: settings?.maxQueryRows || 100
        });

        // Phase 3: Validating
        if (result.generatedSql) {
          setProcessingPhase('validating');
          setProcessingProgress(70);
          const validationResult = await aiQueryService.validateSql(result.generatedSql);
          setValidation(validationResult);
        }

        setResponse(result);
        setProcessingProgress(100);

        // Scroll to results
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsProcessing(false);
        setProcessingPhase('thinking');
        setProcessingProgress(0);
      }
    }
  }, [question, selectedConnections, selectedAzureDbIds, settings, isProcessing, signalRConnected, executeDatabaseQuery]);

  const handleSaveSettings = async (newSettings: UpdateAiQuerySettingsRequest) => {
    // Save to database (tenant-level settings)
    const updated = await aiQueryService.updateSettings(newSettings);
    setSettings(updated);
    
    // Also save user preferences to localStorage
    const userPrefsUpdate = userPreferencesService.saveAIQueryPreferences({
      selectedDatabaseIds: newSettings.selectedDatabaseIds ?? [],
      defaultConnectionId: newSettings.defaultConnectionId,
      maxQueryRows: newSettings.maxQueryRows,
      queryTimeoutSeconds: newSettings.queryTimeoutSeconds,
      enableCrossDatabaseJoins: newSettings.enableCrossDatabaseJoins,
      selectedAzureDatabaseIds: newSettings.selectedAzureDatabaseIds ?? [],
      defaultAzureDatabaseId: newSettings.defaultAzureDatabaseId,
    });
    setUserPrefs(userPrefsUpdate);
    
    // Update selected connections based on new preferences
    if (newSettings.selectedDatabaseIds && newSettings.selectedDatabaseIds.length > 0) {
      setSelectedConnectionIds(new Set(newSettings.selectedDatabaseIds));
    }
    
    // Mark setup as complete if databases are configured
    if ((newSettings.selectedDatabaseIds?.length ?? 0) > 0) {
      userPreferencesService.markAIQuerySetupComplete();
    }
  };

  const handleFirstTimeSetupComplete = (selectedIds: string[]) => {
    setSelectedConnectionIds(new Set(selectedIds));
    setShowFirstTimeSetup(false);
    const updatedPrefs = userPreferencesService.getAIQueryPreferences();
    setUserPrefs(updatedPrefs);
  };

  const handleFirstTimeSetupSkip = () => {
    userPreferencesService.markAIQuerySetupComplete();
    setShowFirstTimeSetup(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-900">
      {/* First Time Setup Wizard */}
      {showFirstTimeSetup && (
        <FirstTimeSetup
          connections={localConnections}
          onComplete={handleFirstTimeSetupComplete}
          onSkip={handleFirstTimeSetupSkip}
        />
      )}
      
      {/* Compact Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shrink-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">AI Query Assistant</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Natural language &rarr; SQL &rarr; Results
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Database Chips */}
              <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                {configuredConnections.map(conn => (
                  <button
                    key={conn.id}
                    onClick={() => toggleConnection(conn.id)}
                    className={clsx(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all',
                      selectedConnectionIds.has(conn.id)
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-400 border border-transparent'
                    )}
                    title={`${conn.serverName || 'Server'} / ${conn.databaseName || conn.name}`}
                  >
                    <Server className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{conn.name}</span>
                  </button>
                ))}
                {configuredAzureDatabases.map(db => (
                  <button
                    key={db.id}
                    onClick={() => {
                      setSelectedAzureDbIds(prev => {
                        const next = new Set(prev);
                        if (next.has(db.id)) next.delete(db.id);
                        else next.add(db.id);
                        return next;
                      });
                    }}
                    className={clsx(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all',
                      selectedAzureDbIds.has(db.id)
                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-400 border border-transparent'
                    )}
                    title={`Azure: ${db.serverName}.database.windows.net / ${db.name}`}
                  >
                    <Zap className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{db.name}</span>
                  </button>
                ))}
                {!hasAnyConfiguredDatabases && (localConnections.length > 0 || isManager) && (
                  <button
                    onClick={() => localConnections.length > 0 ? setShowFirstTimeSetup(true) : setShowSettings(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-400 
                             bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 
                             rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Setup DB
                  </button>
                )}
              </div>

              {isLoadingConnections && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}

              {/* SignalR Status Dot */}
              <div 
                className={clsx(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium',
                  signalRConnected 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                )}
                title={signalRConnected ? 'Real-time connection active' : 'Using REST API'}
              >
                {signalRConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {signalRConnected ? 'Live' : 'REST'}
              </div>

              {/* Settings (managers only) */}
              {isManager && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto" ref={resultsRef}>
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
          {/* Status Banner */}
          {settings && !settings.isEnabled && (
            <div className="flex items-center justify-between gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {isManager 
                    ? 'AI Query Assistant is not enabled. Configure your AI provider to get started.' 
                    : 'AI Query Assistant is not yet configured. Please contact your manager.'}
                </p>
              </div>
              {isManager && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 text-sm font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Enable Now
                </button>
              )}
            </div>
          )}

          {/* Empty State — shown when no query has been submitted */}
          {!response && !isProcessing && !error && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-blue-500 dark:text-blue-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center ring-4 ring-gray-50 dark:ring-slate-900">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Ask anything about your data
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-center max-w-lg mb-6 text-sm leading-relaxed">
                Type a question in natural language. The AI generates safe, read-only SQL with 
                <span className="font-mono text-xs bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mx-1">WITH (NOLOCK)</span> 
                on every table, validates it, then executes against your database.
              </p>
              
              {/* Quick prompts as cards */}
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {[
                  { label: 'Show all tables', prompt: 'List all tables in the database with row counts', icon: <Table2 className="w-4 h-4" />, color: 'blue' },
                  { label: 'Recent records', prompt: 'Show the 10 most recent records from the main table', icon: <Clock className="w-4 h-4" />, color: 'green' },
                  { label: 'Record counts', prompt: 'How many records are in each table?', icon: <BarChart3 className="w-4 h-4" />, color: 'amber' },
                  { label: 'DB performance', prompt: 'Show currently running queries and their duration', icon: <Zap className="w-4 h-4" />, color: 'purple' },
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuestion(q.prompt); inputRef.current?.focus(); }}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 
                             hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all text-left group"
                  >
                    <div className={clsx(
                      'p-2 rounded-lg',
                      q.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                      q.color === 'green' && 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
                      q.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                      q.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                    )}>
                      {q.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {q.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Processing Pipeline */}
          {isProcessing && (
            <ThinkingIndicator phase={processingPhase} progress={processingProgress} />
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Query Failed</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Results Card */}
          {response && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <QueryResultCard response={response} validation={validation || undefined} />
            </div>
          )}
        </div>
      </main>

      {/* Sticky Bottom Input Bar */}
      <div className="shrink-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about your data..."
                disabled={isProcessing}
                className="w-full px-4 py-3 pr-12 text-gray-900 dark:text-white bg-gray-50 dark:bg-slate-900 
                         border border-gray-200 dark:border-slate-600 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         placeholder:text-gray-400 dark:placeholder:text-slate-500
                         disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!question.trim() || isProcessing}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-600
                       text-white rounded-xl transition-colors disabled:cursor-not-allowed shadow-sm"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
