import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Loader2, Copy, Check, X,
  ChevronRight, Table, Download,
  Search, RefreshCw, Wrench, Database, Globe, GitBranch,
  Terminal, Code, History,
  ArrowLeft, Maximize2, Minimize2, Info, Zap, Layers,
  CheckCircle2, XCircle, BarChart3
} from 'lucide-react'
import clsx from 'clsx'
import {
  getTools, getTool, executeTool, getHistory, getConnections,
  parseOptions, parseTags,
  type McpTool, type McpToolParameter, type McpToolListResponse,
  type McpToolExecutionResult, type McpExecutionHistory, type ConnectionPickerItem
} from '../services/mcpToolService'

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_META: Record<string, { icon: typeof Database; color: string; label: string }> = {
  Database:    { icon: Database,   color: 'text-blue-400',    label: 'Database' },
  Azure:       { icon: Globe,      color: 'text-cyan-400',    label: 'Azure' },
  DevOps:      { icon: GitBranch,  color: 'text-purple-400',  label: 'DevOps' },
  Analytics:   { icon: BarChart3,  color: 'text-green-400',   label: 'Analytics' },
  Automation:  { icon: Zap,        color: 'text-yellow-400',  label: 'Automation' },
  Integration: { icon: Layers,     color: 'text-orange-400',  label: 'Integration' },
  Utility:     { icon: Wrench,     color: 'text-slate-400',   label: 'Utility' },
  Custom:      { icon: Code,       color: 'text-pink-400',    label: 'Custom' },
}

type ViewState = 'catalog' | 'execute' | 'history'

// ============================================================================
// Param Input Components
// ============================================================================

function ParamInput({
  param,
  value,
  onChange,
  connections
}: {
  param: McpToolParameter
  value: string
  onChange: (v: string) => void
  connections: ConnectionPickerItem[]
}) {
  const opts = parseOptions(param.options) as Record<string, unknown> | null

  switch (param.parameterType) {
    case 'TextArea':
    case 'Json':
      return (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={param.parameterType === 'Json' ? 6 : 4}
          placeholder={param.description || param.displayName}
          className={clsx(
            'w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm',
            'border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            param.parameterType === 'Json' && 'font-mono text-xs'
          )}
        />
      )

    case 'Boolean':
      return (
        <button
          type="button"
          onClick={() => onChange(value === 'true' ? 'false' : 'true')}
          className={clsx(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            value === 'true' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'
          )}
        >
          <span
            className={clsx(
              'inline-block h-4 w-4 rounded-full bg-white transition-transform',
              value === 'true' ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      )

    case 'Select': {
      const selectItems = (opts as Record<string, unknown>)?.items as string[] ?? []
      return (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select --</option>
          {selectItems.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }

    case 'MultiSelect': {
      const multiItems = (opts as Record<string, unknown>)?.items as string[] ?? []
      const selected = value ? value.split(',') : []
      return (
        <div className="flex flex-wrap gap-2">
          {multiItems.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => {
                const next = selected.includes(item)
                  ? selected.filter(s => s !== item)
                  : [...selected, item]
                onChange(next.join(','))
              }}
              className={clsx(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                selected.includes(item)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600'
              )}
            >
              {item}
            </button>
          ))}
        </div>
      )
    }

    case 'Number': {
      const min = (opts as Record<string, unknown>)?.min as number | undefined
      const max = (opts as Record<string, unknown>)?.max as number | undefined
      return (
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          min={min}
          max={max}
          placeholder={param.description || param.displayName}
          className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500"
        />
      )
    }

    case 'DateTime':
      return (
        <input
          type="datetime-local"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500"
        />
      )

    case 'ConnectionPicker':
      return (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select Connection --</option>
          {connections.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} {c.serverName ? `(${c.serverName}/${c.databaseName})` : `(${c.provider})`}
            </option>
          ))}
        </select>
      )

    case 'Secret':
      return (
        <input
          type="password"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={param.description || param.displayName}
          className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500"
        />
      )

    default: // String, ResourcePicker, etc.
      return (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={param.description || param.displayName}
          className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm border-gray-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500"
        />
      )
  }
}

// ============================================================================
// Result Renderers
// ============================================================================

function ResultTable({ result }: { result: McpToolExecutionResult }) {
  const [copied, setCopied] = useState(false)

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!result.data?.length) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-slate-400">
        <Table className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No data returned</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 dark:text-slate-400">
          {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} · {result.durationMs}ms
        </span>
        <div className="flex gap-2">
          <button onClick={copyJson} className="text-xs flex items-center gap-1 text-gray-500 hover:text-blue-500 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <button
            onClick={() => {
              const csv = [result.columns.join(','), ...result.data.map(r => result.columns.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = 'result.csv'
              a.click()
            }}
            className="text-xs flex items-center gap-1 text-gray-500 hover:text-blue-500 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800">
              {result.columns.map(col => (
                <th key={col} className="px-3 py-2 text-left font-medium text-gray-600 dark:text-slate-300 text-xs whitespace-nowrap border-b border-gray-200 dark:border-slate-700">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
            {result.data.slice(0, 200).map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                {result.columns.map(col => (
                  <td key={col} className="px-3 py-2 text-gray-700 dark:text-slate-300 text-xs max-w-[300px] truncate">
                    {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {result.data.length > 200 && (
          <div className="text-center py-2 text-xs text-gray-500 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
            Showing 200 of {result.data.length} rows
          </div>
        )}
      </div>
    </div>
  )
}

function ResultJson({ result }: { result: McpToolExecutionResult }) {
  const [copied, setCopied] = useState(false)
  const json = result.rawOutput || JSON.stringify(result.data, null, 2)

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-500 dark:text-slate-400">{result.durationMs}ms</span>
        <button
          onClick={() => { navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="text-xs flex items-center gap-1 text-gray-500 hover:text-blue-500"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-gray-50 dark:bg-slate-800/80 rounded-lg p-4 text-xs overflow-auto max-h-[500px] border border-gray-200 dark:border-slate-700 font-mono">
        {json}
      </pre>
    </div>
  )
}

function ResultMarkdown({ result }: { result: McpToolExecutionResult }) {
  const md = result.rawOutput || JSON.stringify(result.data, null, 2)
  return (
    <div className="prose dark:prose-invert prose-sm max-w-none bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
      <pre className="whitespace-pre-wrap text-sm">{md}</pre>
    </div>
  )
}

// ============================================================================
// Tool Card
// ============================================================================

function ToolCard({ tool, onClick }: { tool: McpTool; onClick: () => void }) {
  const meta = CATEGORY_META[tool.category] || CATEGORY_META.Custom
  const CatIcon = meta.icon
  const tags = parseTags(tool.tags)

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-slate-700', meta.color)}>
          <CatIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {tool.displayName}
            </h3>
            {tool.isSystem && (
              <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded">
                System
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{tool.description}</p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.slice(0, 3).map(t => (
                <span key={t} className="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 rounded">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0 mt-1" />
      </div>
    </motion.button>
  )
}

// ============================================================================
// Tool Execution Panel
// ============================================================================

function ToolExecutionPanel({
  tool,
  connections,
  onBack,
  onExecuted
}: {
  tool: McpTool
  connections: ConnectionPickerItem[]
  onBack: () => void
  onExecuted: () => void
}) {
  const [params, setParams] = useState<Record<string, string>>({})
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<McpToolExecutionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultView, setResultView] = useState<'table' | 'json' | 'raw'>('table')
  const [expanded, setExpanded] = useState(false)

  // Initialize defaults
  useEffect(() => {
    const defaults: Record<string, string> = {}
    tool.parameters?.forEach(p => {
      if (p.defaultValue) defaults[p.name] = p.defaultValue
    })
    setParams(defaults)
    setResult(null)
    setError(null)
  }, [tool])

  // Group parameters
  const paramGroups = useMemo(() => {
    const groups: Record<string, McpToolParameter[]> = {}
    ;(tool.parameters || [])
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach(p => {
        const g = p.group || 'Parameters'
        if (!groups[g]) groups[g] = []
        groups[g].push(p)
      })
    return groups
  }, [tool.parameters])

  const handleExecute = async () => {
    setExecuting(true)
    setError(null)
    setResult(null)

    // Convert param values to appropriate types
    const payload: Record<string, unknown> = {}
    tool.parameters?.forEach(p => {
      const val = params[p.name]
      if (val === undefined || val === '') return
      if (p.parameterType === 'Number') payload[p.name] = Number(val)
      else if (p.parameterType === 'Boolean') payload[p.name] = val === 'true'
      else payload[p.name] = val
    })

    try {
      const res = await executeTool(tool.name, payload)
      setResult(res)
      if (!res.success) setError(res.error || 'Execution failed')
      onExecuted()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed'
      setError(msg)
    } finally {
      setExecuting(false)
    }
  }

  const meta = CATEGORY_META[tool.category] || CATEGORY_META.Custom
  const CatIcon = meta.icon

  return (
    <div className={clsx('flex flex-col h-full', expanded && 'fixed inset-0 z-50 bg-white dark:bg-slate-900')}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-slate-300" />
        </button>
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-slate-700', meta.color)}>
          <CatIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 dark:text-white">{tool.displayName}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{tool.description}</p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-5 space-y-5">
          {/* Parameter Groups */}
          {Object.entries(paramGroups).map(([groupName, groupParams]) => (
            <div key={groupName} className="space-y-3">
              {Object.keys(paramGroups).length > 1 && (
                <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{groupName}</h3>
              )}
              {groupParams.map(p => (
                <div key={p.id}>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    {p.displayName || p.name}
                    {p.isRequired && <span className="text-red-500">*</span>}
                    {p.description && (
                      <span title={p.description} className="cursor-help">
                        <Info className="w-3.5 h-3.5 text-gray-400" />
                      </span>
                    )}
                  </label>
                  <ParamInput
                    param={p}
                    value={params[p.name] || ''}
                    onChange={v => setParams(prev => ({ ...prev, [p.name]: v }))}
                    connections={connections}
                  />
                  {p.validationPattern && (
                    <p className="mt-1 text-[10px] text-gray-400">Pattern: {p.validationPattern}</p>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Execute Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleExecute}
              disabled={executing}
              className={clsx(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all',
                executing
                  ? 'bg-gray-300 dark:bg-slate-700 text-gray-500 dark:text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
              )}
            >
              {executing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Executing...</>
              ) : (
                <><Play className="w-4 h-4" /> Execute</>
              )}
            </button>
            {tool.timeoutSeconds > 0 && (
              <span className="text-xs text-gray-400">Timeout: {tool.timeoutSeconds}s</span>
            )}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              >
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400 text-sm">Execution Failed</p>
                  <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result */}
          <AnimatePresence>
            {result && result.success && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {/* Result Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Result</span>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
                    {(['table', 'json', 'raw'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setResultView(v)}
                        className={clsx(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                          resultView === v
                            ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
                        )}
                      >
                        {v === 'table' ? 'Table' : v === 'json' ? 'JSON' : 'Raw'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Result Content */}
                {resultView === 'table' && <ResultTable result={result} />}
                {resultView === 'json' && <ResultJson result={result} />}
                {resultView === 'raw' && <ResultMarkdown result={result} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// History Panel
// ============================================================================

function HistoryPanel({ onSelect }: { onSelect: (toolName: string) => void }) {
  const [history, setHistory] = useState<McpExecutionHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHistory(30).then(setHistory).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!history.length) {
    return (
      <div className="text-center py-16">
        <History className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-slate-400 text-sm">No execution history yet</p>
        <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">Execute a tool to see history here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-4">
      {history.map(h => {
        return (
          <button
            key={h.id}
            onClick={() => onSelect(h.toolName)}
            className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className={clsx(
              'w-2 h-2 rounded-full shrink-0',
              h.status === 'Completed' ? 'bg-green-500' : h.status === 'Failed' ? 'bg-red-500' : 'bg-yellow-500'
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{h.toolDisplayName}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {h.durationMs}ms · {h.rowCount != null ? `${h.rowCount} rows · ` : ''}
                {new Date(h.executedAt).toLocaleString()}
              </p>
              {h.errorMessage && (
                <p className="text-xs text-red-500 truncate mt-0.5">{h.errorMessage}</p>
              )}
            </div>
            <span className={clsx(
              'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
              h.status === 'Completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : h.status === 'Failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
            )}>
              {h.status}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// Main Page
// ============================================================================

export default function McpToolsPage() {
  const [view, setView] = useState<ViewState>('catalog')
  const [toolList, setToolList] = useState<McpToolListResponse | null>(null)
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null)
  const [connections, setConnections] = useState<ConnectionPickerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [historyRefresh, setHistoryRefresh] = useState(0)

  // Load tools + connections
  const loadTools = useCallback(async () => {
    setLoading(true)
    try {
      const [tools, conns] = await Promise.all([getTools(), getConnections()])
      setToolList(tools)
      setConnections(conns)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTools() }, [loadTools])

  // Filter tools
  const filteredTools = useMemo(() => {
    if (!toolList) return []
    let tools = toolList.tools
    if (activeCategory) tools = tools.filter(t => t.category === activeCategory)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      tools = tools.filter(t =>
        t.displayName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.tags && t.tags.toLowerCase().includes(q))
      )
    }
    return tools
  }, [toolList, activeCategory, searchQuery])

  // Categories for filter bar
  const categories = useMemo(() => {
    if (!toolList) return []
    return toolList.categories.map(c => c.category)
  }, [toolList])

  const handleSelectTool = async (toolName: string) => {
    try {
      const tool = await getTool(toolName)
      setSelectedTool(tool)
      setView('execute')
    } catch {
      // fallback — open tool from cached list
      const cached = toolList?.tools.find(t => t.name === toolName)
      if (cached) { setSelectedTool(cached); setView('execute') }
    }
  }

  // ─── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-slate-400">Loading MCP tools...</p>
        </div>
      </div>
    )
  }

  // ─── Execute View ───
  if (view === 'execute' && selectedTool) {
    return (
      <ToolExecutionPanel
        tool={selectedTool}
        connections={connections}
        onBack={() => { setSelectedTool(null); setView('catalog') }}
        onExecuted={() => setHistoryRefresh(p => p + 1)}
      />
    )
  }

  // ─── Catalog / History View ───
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            MCP Tool Registry
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Dynamic tool execution engine — {toolList?.totalCount ?? 0} tools available
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTools}
            className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh tools"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setView('catalog')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              view === 'catalog'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
            )}
          >
            <Wrench className="w-4 h-4" /> Tools
          </button>
          <button
            onClick={() => setView('history')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              view === 'history'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
            )}
          >
            <History className="w-4 h-4" /> History
          </button>
        </div>

        {/* Search (catalog only) */}
        {view === 'catalog' && (
          <div className="flex-1 max-w-sm relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tools..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      {view === 'catalog' ? (
        <>
          {/* Category Filters */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  !activeCategory
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                )}
              >
                All ({toolList?.totalCount ?? 0})
              </button>
              {categories.map(cat => {
                const meta = CATEGORY_META[cat] || CATEGORY_META.Custom
                const CatIcon = meta.icon
                const count = toolList?.categories.find(c => c.category === cat)?.tools.length ?? 0
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      activeCategory === cat
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-blue-300'
                    )}
                  >
                    <CatIcon className="w-3.5 h-3.5" />
                    {meta.label} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Tool Grid */}
          {filteredTools.length === 0 ? (
            <div className="text-center py-16">
              <Wrench className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400 text-sm">
                {searchQuery ? 'No tools match your search' : 'No tools available'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTools.map(tool => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onClick={() => handleSelectTool(tool.name)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <HistoryPanel key={historyRefresh} onSelect={handleSelectTool} />
      )}
    </div>
  )
}
