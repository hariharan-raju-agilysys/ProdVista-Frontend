import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Loader2, AlertCircle, X, Copy, Check, Clock,
  ChevronDown, ChevronRight, ChevronUp, Play, Download,
  Table, Zap, RefreshCw, ArrowUpDown, Maximize2,
  Activity, ExternalLink, Terminal,
  GitBranch, Server, AlertTriangle, Info, Database,
  Fingerprint, Link2, FileSearch, Hash, Layers, Network
} from 'lucide-react'
import clsx from 'clsx'
import {
  interpretQuery,
  executeQuery as executeKql,
  getTraceDetails,
  getFilteredResources,
  KQL_TEMPLATES,
  SEVERITY_LEVELS,
  type TraceSpan,
  type QueryResult,
  type AzureResource,
  type AiQueryInterpretation,
} from '../services/appInsightsService'

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'search' | 'results' | 'traces' | 'custom-kql'
type TelemetryTab = 'all' | 'requests' | 'traces' | 'dependencies' | 'exceptions'

interface SortState {
  column: number
  direction: 'asc' | 'desc'
}

interface DrillDownResult {
  interpretation: AiQueryInterpretation
  queryResult: QueryResult
  searchId: string
  timestamp: Date
}

// Time range presets
const TIME_RANGES = [
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '12h', value: '12h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
]

// Quick search templates
const QUICK_SEARCHES = [
  { label: 'Recent Errors (500)', icon: AlertTriangle, query: 'status code 500', color: 'text-red-400' },
  { label: 'Slow Requests (>5s)', icon: Clock, query: 'slow requests duration > 5000', color: 'text-yellow-400' },
  { label: 'All Exceptions', icon: AlertCircle, query: 'exceptions', color: 'text-orange-400' },
  { label: 'Dependency Failures', icon: Database, query: 'failed dependencies', color: 'text-purple-400' },
]

// ============================================================================
// Component
// ============================================================================

export default function ObservabilityQueryPage() {
  // Search state
  const [searchInput, setSearchInput] = useState('')
  const [timeRange, setTimeRange] = useState('24h')
  const [searching, setSearching] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('search')

  // Resource selector
  const [resources, setResources] = useState<{ workspaces: AzureResource[]; appInsights: AzureResource[] }>({ workspaces: [], appInsights: [] })
  const [selectedResource, setSelectedResource] = useState<string>('')
  const [loadingResources, setLoadingResources] = useState(true)
  const [showResourcePicker, setShowResourcePicker] = useState(false)

  // Drill-down results
  const [drillDown, setDrillDown] = useState<DrillDownResult | null>(null)
  const [activeTab, setActiveTab] = useState<TelemetryTab>('all')
  const [error, setError] = useState<string | null>(null)

  // Trace view
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null)
  const [traceSpans, setTraceSpans] = useState<TraceSpan[]>([])
  const [loadingTrace, setLoadingTrace] = useState(false)
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set())

  // Custom KQL editor
  const [customKql, setCustomKql] = useState('')
  const [customResult, setCustomResult] = useState<QueryResult | null>(null)
  const [executingCustom, setExecutingCustom] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  // Results table
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [filterText, setFilterText] = useState('')
  const [copied, setCopied] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  // Search history
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Load Azure resources on mount ──
  useEffect(() => {
    loadResources()
  }, [])

  const loadResources = async () => {
    setLoadingResources(true)
    try {
      const data = await getFilteredResources()
      setResources({ workspaces: data.workspaces, appInsights: data.appInsights })
      // Auto-select first App Insights or workspace
      if (data.appInsights.length > 0) {
        setSelectedResource(data.appInsights[0].id)
      } else if (data.workspaces.length > 0) {
        setSelectedResource(data.workspaces[0].id)
      }
    } catch {
      // Resources not available - user can still use without
    } finally {
      setLoadingResources(false)
    }
  }

  // ── Main search / drill-down ──
  const handleSearch = useCallback(async (input?: string) => {
    const query = (input ?? searchInput).trim()
    if (!query) return

    setSearching(true)
    setError(null)
    setDrillDown(null)
    setActiveTab('all')
    setSortState(null)
    setFilterText('')

    try {
      const interpretation = await interpretQuery(query)
      const kql = interpretation.suggestedKql

      const result = await executeKql(
        kql,
        timeRange,
        selectedResource?.startsWith('/subscriptions/') ? undefined : selectedResource,
        selectedResource?.startsWith('/subscriptions/') ? selectedResource : undefined
      )

      setDrillDown({
        interpretation,
        queryResult: result,
        searchId: query,
        timestamp: new Date(),
      })
      setViewMode('results')

      // Add to history
      setSearchHistory(prev => {
        const filtered = prev.filter(h => h !== query)
        return [query, ...filtered].slice(0, 15)
      })
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Search failed'
      setError(msg)
    } finally {
      setSearching(false)
    }
  }, [searchInput, timeRange, selectedResource])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  // ── Load trace details ──
  const loadTrace = async (operationId: string) => {
    setLoadingTrace(true)
    setSelectedOperationId(operationId)
    setExpandedSpans(new Set())
    try {
      const data = await getTraceDetails(operationId, selectedResource || undefined)
      setTraceSpans(data.spans)
      setViewMode('traces')
    } catch (err: any) {
      setError(`Failed to load trace: ${err.message}`)
    } finally {
      setLoadingTrace(false)
    }
  }

  // ── Execute custom KQL ──
  const executeCustomKql = async () => {
    if (!customKql.trim()) return
    setExecutingCustom(true)
    setError(null)
    setCustomResult(null)
    try {
      const result = await executeKql(
        customKql,
        timeRange,
        selectedResource?.startsWith('/subscriptions/') ? undefined : selectedResource,
        selectedResource?.startsWith('/subscriptions/') ? selectedResource : undefined
      )
      setCustomResult(result)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Query failed')
    } finally {
      setExecutingCustom(false)
    }
  }

  // ── Results helpers ──
  const getActiveResult = (): QueryResult | null => {
    if (viewMode === 'custom-kql') return customResult
    return drillDown?.queryResult ?? null
  }

  const getColumns = (result: QueryResult): string[] => {
    if (!result?.data?.length) return []
    return Object.keys(result.data[0])
  }

  const getFilteredRows = (result: QueryResult) => {
    if (!result?.data?.length) return []
    const cols = getColumns(result)

    // Convert data array to row arrays
    let rows: any[][] = result.data.map((row: Record<string, unknown>) =>
      cols.map(c => row[c])
    )

    // Filter by telemetry tab
    if (activeTab !== 'all' && viewMode === 'results') {
      const typeColIdx = cols.findIndex(c => c === 'itemType' || c === 'type')
      if (typeColIdx >= 0) {
        const typeMap: Record<string, string[]> = {
          requests: ['request'],
          traces: ['trace'],
          dependencies: ['dependency'],
          exceptions: ['exception'],
        }
        const allowed = typeMap[activeTab] || []
        if (allowed.length > 0) {
          rows = rows.filter(r => {
            const val = String(r[typeColIdx] ?? '').toLowerCase()
            return allowed.some(a => val.includes(a))
          })
        }
      }
    }

    // Text filter
    if (filterText) {
      const lower = filterText.toLowerCase()
      rows = rows.filter(r => r.some((cell: any) => String(cell ?? '').toLowerCase().includes(lower)))
    }

    // Sort
    if (sortState) {
      rows.sort((a, b) => {
        const aVal = a[sortState.column]
        const bVal = b[sortState.column]
        const aNum = Number(aVal), bNum = Number(bVal)
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortState.direction === 'asc' ? aNum - bNum : bNum - aNum
        }
        return sortState.direction === 'asc'
          ? String(aVal ?? '').localeCompare(String(bVal ?? ''))
          : String(bVal ?? '').localeCompare(String(aVal ?? ''))
      })
    }
    return rows
  }

  const handleSort = (colIndex: number) => {
    setSortState(prev => {
      if (prev?.column === colIndex) {
        return prev.direction === 'asc' ? { column: colIndex, direction: 'desc' } : null
      }
      return { column: colIndex, direction: 'asc' }
    })
  }

  const exportCsv = (result: QueryResult) => {
    if (!result?.data?.length) return
    const cols = getColumns(result)
    const header = cols.join(',')
    const csvRows = result.data.map((row: Record<string, unknown>) =>
      cols.map(c => {
        const val = String(row[c] ?? '')
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"`
          : val
      }).join(',')
    )
    const csv = [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kql-results-${new Date().toISOString().slice(0, 19)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedResourceName = [...resources.appInsights, ...resources.workspaces].find(r => r.id === selectedResource)?.name || 'No resource selected'

  // ── Get telemetry tab counts ──
  const getTabCounts = () => {
    const result = drillDown?.queryResult
    if (!result?.data?.length) return { all: 0, requests: 0, traces: 0, dependencies: 0, exceptions: 0 }
    const cols = getColumns(result)
    const rows: any[][] = result.data.map((row: Record<string, unknown>) =>
      cols.map(c => row[c])
    )
    const typeColIdx = cols.findIndex(c => c === 'itemType' || c === 'type')
    if (typeColIdx < 0) return { all: rows.length, requests: 0, traces: 0, dependencies: 0, exceptions: 0 }

    const counts = { all: rows.length, requests: 0, traces: 0, dependencies: 0, exceptions: 0 }
    rows.forEach(r => {
      const t = String(r[typeColIdx] ?? '').toLowerCase()
      if (t.includes('request')) counts.requests++
      else if (t.includes('trace')) counts.traces++
      else if (t.includes('dependency')) counts.dependencies++
      else if (t.includes('exception')) counts.exceptions++
    })
    return counts
  }

  // ════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-950">
      {/* ═══════════ Header ═══════════ */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-white/90" />
          <h1 className="text-lg font-semibold text-white">Observability Query Explorer</h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-blue-500/20 text-blue-200 border-blue-400/30">
            KQL
          </span>
          <span className="text-white/60 text-sm">— Azure Application Insights</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Resource selector */}
          <div className="relative">
            <button
              onClick={() => setShowResourcePicker(!showResourcePicker)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white/80 hover:text-white transition-colors max-w-[300px]"
            >
              <Server className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{loadingResources ? 'Loading...' : selectedResourceName}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>

            <AnimatePresence>
              {showResourcePicker && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute right-0 top-full mt-1 w-96 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  {resources.appInsights.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-[10px] uppercase text-gray-500 dark:text-slate-500 font-semibold bg-gray-50 dark:bg-slate-800/80">
                        Application Insights
                      </div>
                      {resources.appInsights.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedResource(r.id); setShowResourcePicker(false) }}
                          className={clsx(
                            'w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2',
                            selectedResource === r.id ? 'text-blue-400 bg-gray-100 dark:bg-slate-700/50' : 'text-gray-700 dark:text-slate-300'
                          )}
                        >
                          <Activity className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{r.name}</span>
                          {selectedResource === r.id && <Check className="w-3.5 h-3.5 ml-auto text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                  {resources.workspaces.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-[10px] uppercase text-slate-500 font-semibold bg-slate-800/80 border-t border-slate-700">
                        Log Analytics Workspaces
                      </div>
                      {resources.workspaces.map(r => (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedResource(r.id); setShowResourcePicker(false) }}
                          className={clsx(
                            'w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2',
                            selectedResource === r.id ? 'text-blue-400 bg-slate-700/50' : 'text-slate-300'
                          )}
                        >
                          <Database className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{r.name}</span>
                          {selectedResource === r.id && <Check className="w-3.5 h-3.5 ml-auto text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={loadResources}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
            title="Refresh resources"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ═══════════ Search Bar ═══════════ */}
      <div className="bg-slate-900 border-b border-slate-700/50 px-5 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            {/* Main search input */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                ref={searchInputRef}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Paste any ID (correlation, operation, request) or describe what you're looking for..."
                className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                autoFocus
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Time range */}
            <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              {TIME_RANGES.map(tr => (
                <button
                  key={tr.value}
                  onClick={() => setTimeRange(tr.value)}
                  className={clsx(
                    'px-3 py-3 text-xs font-medium transition-colors',
                    timeRange === tr.value
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  )}
                >
                  {tr.label}
                </button>
              ))}
            </div>

            {/* Search button */}
            <button
              onClick={() => handleSearch()}
              disabled={searching || !searchInput.trim()}
              className={clsx(
                'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all',
                searching
                  ? 'bg-slate-700 text-slate-400 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
              )}
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Quick action chips */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-slate-500">Quick:</span>
            {QUICK_SEARCHES.map((qs, i) => (
              <button
                key={i}
                onClick={() => { setSearchInput(qs.query); handleSearch(qs.query) }}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 rounded-full text-xs text-slate-400 hover:text-white transition-colors"
              >
                <qs.icon className={clsx('w-3 h-3', qs.color)} />
                {qs.label}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => { setViewMode('custom-kql'); setCustomResult(null) }}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors border',
                viewMode === 'custom-kql'
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white border-slate-700/50 hover:bg-slate-700/60'
              )}
            >
              <Terminal className="w-3 h-3" />
              Custom KQL
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ Error Banner ═══════════ */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-950/50 border-b border-red-800/50 px-5 py-3 flex items-start gap-3"
          >
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-300 font-medium">Error</p>
              <p className="text-xs text-red-400/80 mt-0.5 font-mono">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ Main Content ═══════════ */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Custom KQL Editor Mode */}
        {viewMode === 'custom-kql' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* KQL Editor */}
            <div className="border-b border-slate-700/50">
              <div className="flex items-center justify-between px-3 py-1 bg-slate-800/30 border-b border-slate-700/30">
                <span className="text-xs text-slate-500 font-mono">KQL Query Editor</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyToClipboard(customKql)}
                    className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={executeCustomKql}
                    disabled={executingCustom || !customKql.trim()}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ml-2',
                      executingCustom
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    )}
                  >
                    {executingCustom ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Run
                    <span className="text-[10px] opacity-60">Ctrl+Enter</span>
                  </button>
                </div>
              </div>
              <textarea
                ref={editorRef}
                value={customKql}
                onChange={e => setCustomKql(e.target.value)}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); executeCustomKql() } }}
                placeholder={`Enter KQL query here...\n\nExamples:\n  requests | where duration > 5000 | take 100\n  exceptions | summarize count() by type | order by count_ desc`}
                className="w-full h-[180px] px-4 py-3 bg-slate-950 text-green-300 font-mono text-sm resize-none focus:outline-none focus:ring-0 border-none placeholder-slate-600"
                spellCheck={false}
              />
              <div className="px-3 py-1 bg-slate-900/50 border-t border-slate-700/30 flex items-center justify-between">
                <span className="text-[10px] text-slate-600">{customKql.split('\n').length} lines · {customKql.length} chars</span>
                {/* Quick KQL templates */}
                <div className="flex gap-1">
                  {[
                    { label: 'Requests', kql: KQL_TEMPLATES.operations('1h', 100) },
                    { label: 'Exceptions', kql: KQL_TEMPLATES.exceptions('1h') },
                    { label: 'Slow Requests', kql: KQL_TEMPLATES.slowRequests('1h', 5000) },
                    { label: 'Slow Deps', kql: KQL_TEMPLATES.slowDependencies('1h', 3000) },
                    { label: 'Dep Health', kql: KQL_TEMPLATES.dependencyHealth('1h') },
                  ].map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setCustomKql(t.kql.trim())}
                      className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom KQL Results */}
            {executingCustom ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Executing KQL query...</p>
                </div>
              </div>
            ) : customResult ? (
              <ResultsTable
                result={customResult}
                filterText={filterText}
                setFilterText={setFilterText}
                sortState={sortState}
                handleSort={handleSort}
                processedRows={getFilteredRows(customResult)}
                onExport={() => exportCsv(customResult)}
                onFullscreen={() => setFullscreen(true)}
                onOperationClick={loadTrace}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md">
                  <Terminal className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-2">Custom KQL Editor</h3>
                  <p className="text-sm text-slate-400">
                    Write custom KQL queries against your Azure Application Insights.
                    Use the templates above to get started.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search / Landing View */}
        {viewMode === 'search' && (
          <div className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto px-6 py-10">
              {/* Hero */}
              <div className="text-center mb-10">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
                  <Fingerprint className="w-10 h-10 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Investigation Hub</h2>
                <p className="text-slate-400 leading-relaxed max-w-lg mx-auto">
                  Paste any identifier to get a complete drill-down of all related telemetry —
                  requests, dependencies, traces, and exceptions — from Azure Application Insights.
                </p>
              </div>

              {/* Investigation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                {/* Correlation ID */}
                <InvestigationCard
                  icon={Link2}
                  label="Correlation ID"
                  description="Find all telemetry linked to a single user action across services"
                  placeholder="e.g. abc12345-def6-7890-..."
                  color="blue"
                  onSearch={(id) => { setSearchInput(`correlation_id: ${id}`); handleSearch(`correlation_id: ${id}`) }}
                />

                {/* Operation ID */}
                <InvestigationCard
                  icon={Network}
                  label="Operation ID"
                  description="Trace a distributed request through the entire service chain"
                  placeholder="e.g. 4f8a2b3c-1d2e-3f4a-..."
                  color="indigo"
                  onSearch={(id) => { setSearchInput(`operation_id: ${id}`); handleSearch(`operation_id: ${id}`) }}
                />

                {/* Request ID */}
                <InvestigationCard
                  icon={FileSearch}
                  label="Request ID"
                  description="Look up a specific HTTP request and its dependencies"
                  placeholder="e.g. 9e8d7c6b-5a4f-3e2d-..."
                  color="cyan"
                  onSearch={(id) => { setSearchInput(`request_id: ${id}`); handleSearch(`request_id: ${id}`) }}
                />
              </div>

              {/* Quick Investigation Templates */}
              <div className="mb-10">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  Quick Investigations
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Failed Requests (5xx)', query: 'status code 500', icon: AlertTriangle, color: 'red' },
                    { label: 'Slow Requests (>5s)', query: 'slow requests duration > 5000', icon: Clock, color: 'yellow' },
                    { label: 'All Exceptions', query: 'exceptions', icon: AlertCircle, color: 'orange' },
                    { label: 'Dependency Failures', query: 'failed dependencies', icon: Database, color: 'purple' },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={() => { setSearchInput(item.query); handleSearch(item.query) }}
                      className="flex items-center gap-3 px-4 py-3 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/50 hover:border-slate-600/50 rounded-xl text-left transition-all group"
                    >
                      <item.icon className={clsx('w-4 h-4 shrink-0', `text-${item.color}-400`)} />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* What This Finds */}
              <div className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-6 mb-10">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  What Gets Returned
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  {[
                    { type: 'Requests', desc: 'HTTP requests with status, duration, URL', color: 'green' },
                    { type: 'Dependencies', desc: 'SQL, HTTP, Redis calls with target & timing', color: 'purple' },
                    { type: 'Traces', desc: 'Log messages with severity and custom data', color: 'cyan' },
                    { type: 'Exceptions', desc: 'Stack traces, types, problem IDs', color: 'red' },
                  ].map((item, i) => (
                    <div key={i} className="space-y-1">
                      <div className={`text-${item.color}-400 font-semibold`}>{item.type}</div>
                      <div className="text-slate-500 leading-relaxed">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent searches */}
              {searchHistory.length > 0 && (
                <div>
                  <h4 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Recent Searches</h4>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.slice(0, 8).map((h, i) => (
                      <button
                        key={i}
                        onClick={() => { setSearchInput(h); handleSearch(h) }}
                        className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 rounded-lg text-xs text-slate-400 hover:text-white transition-colors font-mono truncate max-w-[250px]"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Drill-Down Results View */}
        {viewMode === 'results' && drillDown && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Interpretation Banner + Key Identifiers */}
            <div className="bg-slate-900/80 border-b border-slate-700/50 px-5 py-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-sm text-slate-300">{drillDown.interpretation.explanation}</span>
                  <span className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold',
                    drillDown.interpretation.confidence >= 0.9 ? 'bg-green-500/20 text-green-400' :
                    drillDown.interpretation.confidence >= 0.7 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-slate-500/20 text-slate-400'
                  )}>
                    {Math.round(drillDown.interpretation.confidence * 100)}% confidence
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(drillDown.interpretation.suggestedKql)}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
                    title="Copy generated KQL"
                >
                  <Copy className="w-3 h-3" />
                  KQL
                </button>
                {drillDown.queryResult.portalLink && (
                  <a
                    href={drillDown.queryResult.portalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Azure Portal
                  </a>
                )}
              </div>
            </div>

              {/* Key Identifiers extracted from results */}
              <IdentifiersSummary
                result={drillDown.queryResult}
                searchId={drillDown.searchId}
                onIdClick={(id) => { setSearchInput(id); handleSearch(id) }}
                onTraceClick={loadTrace}
                onCopy={copyToClipboard}
                copied={copied}
              />
            </div>

            {/* Telemetry Type Tabs */}
            {(() => {
              const counts = getTabCounts()
              const tabs: { key: TelemetryTab; label: string; count: number; color: string }[] = [
                { key: 'all', label: 'All Telemetry', count: counts.all, color: 'blue' },
                { key: 'requests', label: 'Requests', count: counts.requests, color: 'green' },
                { key: 'traces', label: 'Traces', count: counts.traces, color: 'cyan' },
                { key: 'dependencies', label: 'Dependencies', count: counts.dependencies, color: 'purple' },
                { key: 'exceptions', label: 'Exceptions', count: counts.exceptions, color: 'red' },
              ]
              return (
                <div className="flex items-center gap-1 px-5 py-2 bg-slate-900/50 border-b border-slate-700/30">
                  {tabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => { setActiveTab(tab.key); setSortState(null) }}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        activeTab === tab.key
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      )}
                    >
                      {tab.label}
                      {tab.count > 0 && (
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-[10px]',
                          activeTab === tab.key ? 'bg-blue-500/20' : 'bg-slate-700'
                        )}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )
            })()}

            {/* Results Table */}
            <ResultsTable
              result={drillDown.queryResult}
              filterText={filterText}
              setFilterText={setFilterText}
              sortState={sortState}
              handleSort={handleSort}
              processedRows={getFilteredRows(drillDown.queryResult)}
              onExport={() => exportCsv(drillDown.queryResult)}
              onFullscreen={() => setFullscreen(true)}
              onOperationClick={loadTrace}
            />
          </div>
        )}

        {/* Trace Waterfall View */}
        {viewMode === 'traces' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Trace Header */}
            <div className="bg-slate-900/80 border-b border-slate-700/50 px-5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode(drillDown ? 'results' : 'search')}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  ← Back to results
                </button>
                <span className="text-slate-600">|</span>
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-white font-medium">Distributed Trace</span>
                <span className="text-xs text-slate-500 font-mono">{selectedOperationId}</span>
                <button
                  onClick={() => selectedOperationId && copyToClipboard(selectedOperationId)}
                  className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <span className="text-xs text-slate-500">{traceSpans.length} spans</span>
            </div>

            {/* Trace Waterfall */}
            {loadingTrace ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4">
                {traceSpans.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No trace spans found for this operation</div>
                ) : (
                  <TraceWaterfall
                    spans={traceSpans}
                    expandedSpans={expandedSpans}
                    toggleSpan={(id) => setExpandedSpans(prev => {
                      const next = new Set(prev)
                      if (next.has(id)) {
                        next.delete(id);
                      } else {
                        next.add(id);
                      }
                      return next
                    })}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════ Fullscreen Modal ═══════════ */}
      <AnimatePresence>
        {fullscreen && getActiveResult() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950 flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Table className="w-5 h-5 text-slate-400" />
                <span className="text-white font-medium">
                  Query Results — {getFilteredRows(getActiveResult()!).length.toLocaleString()} rows
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    placeholder="Filter results..."
                    className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 w-56 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => exportCsv(getActiveResult()!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={() => setFullscreen(false)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <RawTable
                result={getActiveResult()!}
                rows={getFilteredRows(getActiveResult()!)}
                sortState={sortState}
                handleSort={handleSort}
                onOperationClick={loadTrace}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Sub-Components
// ════════════════════════════════════════════════════════════════════════════

function ResultsTable({
  result,
  filterText,
  setFilterText,
  sortState,
  handleSort,
  processedRows,
  onExport,
  onFullscreen,
  onOperationClick,
}: {
  result: QueryResult
  filterText: string
  setFilterText: (v: string) => void
  sortState: SortState | null
  handleSort: (col: number) => void
  processedRows: any[][]
  onExport: () => void
  onFullscreen: () => void
  onOperationClick: (id: string) => void
}) {
  const totalRows = result?.data?.length ?? 0
  return (
    <>
      {/* Results Header Bar */}
      <div className="flex items-center justify-between px-5 py-2 bg-slate-900/50 border-b border-slate-700/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-white font-medium">
              {processedRows.length.toLocaleString()} rows
              {filterText && ` (filtered from ${totalRows.toLocaleString()})`}
            </span>
          </div>
          {result.executionTimeMs != null && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {result.executionTimeMs.toFixed(0)}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Filter results..."
              className="pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-600 w-48 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={onFullscreen}
            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Actual Table */}
      <div className="flex-1 overflow-auto">
        <RawTable
          result={result}
          rows={processedRows}
          sortState={sortState}
          handleSort={handleSort}
          onOperationClick={onOperationClick}
        />
        {processedRows.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            {filterText ? 'No rows match the filter' : 'Query returned 0 results'}
          </div>
        )}
      </div>
    </>
  )
}

function RawTable({
  result,
  rows,
  sortState,
  handleSort,
  onOperationClick,
}: {
  result: QueryResult
  rows: any[][]
  sortState: SortState | null
  handleSort: (col: number) => void
  onOperationClick: (id: string) => void
}) {
  const columns = result?.data?.length ? Object.keys(result.data[0]) : []
  const opIdColIdx = columns.findIndex(c =>
    c === 'operation_Id' || c === 'operationId'
  )

  return (
    <table className="w-full text-left">
      <thead className="sticky top-0 z-10">
        <tr className="bg-slate-800/95 backdrop-blur">
          <th className="px-3 py-2 text-[10px] text-slate-500 font-medium border-b border-slate-700 w-10">#</th>
          {columns.map((col, i) => (
            <th
              key={i}
              onClick={() => handleSort(i)}
              className="px-3 py-2 text-xs text-slate-400 font-medium border-b border-slate-700 cursor-pointer hover:bg-slate-700/50 transition-colors select-none"
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate">{col}</span>
                {sortState?.column === i ? (
                  sortState.direction === 'asc'
                    ? <ChevronUp className="w-3 h-3 text-blue-400" />
                    : <ChevronDown className="w-3 h-3 text-blue-400" />
                ) : (
                  <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />
                )}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx} className="hover:bg-slate-800/40 transition-colors border-b border-slate-800/30">
            <td className="px-3 py-1.5 text-[10px] text-slate-600 font-mono">{rowIdx + 1}</td>
            {row.map((cell: any, colIdx: number) => {
              const isOpId = colIdx === opIdColIdx && cell
              return (
                <td key={colIdx} className="px-3 py-1.5 text-xs text-slate-300 font-mono max-w-[400px] truncate">
                  {cell == null ? (
                    <span className="text-slate-600 italic">null</span>
                  ) : isOpId ? (
                    <button
                      onClick={() => onOperationClick(String(cell))}
                      className="text-blue-400 hover:text-blue-300 hover:underline truncate"
                      title="View distributed trace"
                    >
                      {String(cell)}
                    </button>
                  ) : typeof cell === 'boolean' ? (
                    <span className={cell ? 'text-green-400' : 'text-red-400'}>{String(cell)}</span>
                  ) : typeof cell === 'number' ? (
                    <span className="text-cyan-400">{cell.toLocaleString()}</span>
                  ) : String(cell).length > 100 ? (
                    <span title={String(cell)}>{String(cell).slice(0, 100)}...</span>
                  ) : (
                    formatCellValue(String(cell))
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Trace Waterfall ──

function TraceWaterfall({
  spans,
  expandedSpans,
  toggleSpan,
}: {
  spans: TraceSpan[]
  expandedSpans: Set<string>
  toggleSpan: (id: string) => void
}) {
  const rootSpans = spans.filter(s => !s.parentId || !spans.some(p => p.id === s.parentId))
  const childrenMap = new Map<string, TraceSpan[]>()
  spans.forEach(s => {
    if (s.parentId) {
      const list = childrenMap.get(s.parentId) || []
      list.push(s)
      childrenMap.set(s.parentId, list)
    }
  })

  const totalDuration = Math.max(...spans.map(s => s.duration), 1)

  const renderSpan = (span: TraceSpan, depth: number = 0): JSX.Element => {
    const children = childrenMap.get(span.id) || []
    const hasChildren = children.length > 0
    const isExpanded = expandedSpans.has(span.id)
    const pct = (span.duration / totalDuration) * 100

    const durationColor = span.duration < 500
      ? 'bg-green-500'
      : span.duration < 1000
        ? 'bg-yellow-500'
        : 'bg-red-500'

    const typeColors: Record<string, string> = {
      request: 'text-green-400 bg-green-500/10',
      dependency: 'text-purple-400 bg-purple-500/10',
      trace: 'text-cyan-400 bg-cyan-500/10',
      exception: 'text-red-400 bg-red-500/10',
      customEvent: 'text-amber-400 bg-amber-500/10',
    }

    return (
      <div key={span.id}>
        <div
          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800/60 rounded-lg transition-colors group cursor-pointer"
          style={{ paddingLeft: `${12 + depth * 24}px` }}
          onClick={() => toggleSpan(span.id)}
        >
          <div className="w-4 shrink-0">
            {hasChildren && (
              isExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0', typeColors[span.type] || 'text-slate-400 bg-slate-500/10')}>
            {span.type}
          </span>

          <span className="text-sm text-slate-200 truncate flex-1" title={span.name}>
            {span.name}
          </span>

          {span.resultCode && (
            <span className={clsx(
              'px-1.5 py-0.5 rounded text-[10px] font-mono',
              span.success ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
            )}>
              {span.resultCode}
            </span>
          )}

          <div className="w-32 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={clsx('h-full rounded-full', durationColor)} style={{ width: `${Math.max(pct, 2)}%` }} />
              </div>
              <span className="text-[10px] text-slate-500 w-14 text-right font-mono">
                {span.duration >= 1000 ? `${(span.duration / 1000).toFixed(1)}s` : `${span.duration.toFixed(0)}ms`}
              </span>
            </div>
          </div>

          <span className="text-[10px] text-slate-600 truncate max-w-[120px]" title={span.cloudRoleName}>
            {span.cloudRoleName}
          </span>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="ml-16 mr-4 mb-2 p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 text-xs space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-slate-500">Timestamp:</span> <span className="text-slate-300 font-mono">{new Date(span.timestamp).toLocaleString()}</span></div>
                  <div><span className="text-slate-500">Duration:</span> <span className="text-slate-300 font-mono">{span.duration.toFixed(2)}ms</span></div>
                  {span.target && <div><span className="text-slate-500">Target:</span> <span className="text-slate-300 font-mono">{span.target}</span></div>}
                  {span.message && <div className="col-span-2"><span className="text-slate-500">Message:</span> <span className="text-slate-300">{span.message}</span></div>}
                  {span.severityLevel != null && (
                    <div>
                      <span className="text-slate-500">Severity:</span>{' '}
                      <span className={SEVERITY_LEVELS[span.severityLevel]?.color || 'text-slate-300'}>
                        {SEVERITY_LEVELS[span.severityLevel]?.label || span.severityLevel}
                      </span>
                    </div>
                  )}
                </div>
                {span.customDimensions && Object.keys(span.customDimensions).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider">Custom Dimensions</span>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      {Object.entries(span.customDimensions).slice(0, 10).map(([k, v]) => (
                        <div key={k} className="truncate">
                          <span className="text-slate-500">{k}:</span> <span className="text-slate-300 font-mono">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {children
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map(child => renderSpan(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-4 mb-3 px-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Duration:</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full bg-green-500" /> &lt;500ms</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 500ms-1s</span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500" /> &gt;1s</span>
      </div>

      {rootSpans
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(span => renderSpan(span, 0))}
    </div>
  )
}

// ── Helpers ──

function formatCellValue(value: string): JSX.Element | string {
  if (/^(Verbose|Information|Warning|Error|Critical)$/i.test(value)) {
    const colors: Record<string, string> = {
      verbose: 'text-gray-400',
      information: 'text-blue-400',
      warning: 'text-yellow-400',
      error: 'text-red-400',
      critical: 'text-red-600 font-bold',
    }
    return <span className={colors[value.toLowerCase()] || ''}>{value}</span>
  }

  if (value === 'True' || value === 'true') return <span className="text-green-400">true</span>
  if (value === 'False' || value === 'false') return <span className="text-red-400">false</span>

  if (/^\d{3}$/.test(value)) {
    const code = parseInt(value)
    const color = code >= 500 ? 'text-red-400' : code >= 400 ? 'text-orange-400' : code >= 300 ? 'text-yellow-400' : 'text-green-400'
    return <span className={color}>{value}</span>
  }

  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
    return <span className="text-blue-300/80">{value}</span>
  }

  return value
}

// ── Investigation Card (Landing page) ──

function InvestigationCard({
  icon: Icon,
  label,
  description,
  placeholder,
  color,
  onSearch,
}: {
  icon: React.ElementType
  label: string
  description: string
  placeholder: string
  color: string
  onSearch: (id: string) => void
}) {
  const [value, setValue] = useState('')

  const colorMap: Record<string, { border: string; bg: string; text: string; ring: string }> = {
    blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'focus:ring-blue-500/50' },
    indigo: { border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-400', ring: 'focus:ring-indigo-500/50' },
    cyan: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-400', ring: 'focus:ring-cyan-500/50' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className={clsx('rounded-xl border bg-slate-900/60 p-5 space-y-3 transition-all hover:bg-slate-900/80', c.border)}>
      <div className="flex items-center gap-2.5">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', c.bg)}>
          <Icon className={clsx('w-4 h-4', c.text)} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
        </div>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onSearch(value.trim()) }}
          placeholder={placeholder}
          className={clsx(
            'flex-1 px-3 py-2 bg-slate-800/80 border border-slate-700/50 rounded-lg text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-1',
            c.ring
          )}
        />
        <button
          onClick={() => value.trim() && onSearch(value.trim())}
          disabled={!value.trim()}
          className={clsx(
            'px-3 py-2 rounded-lg text-xs font-medium transition-all',
            value.trim()
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          )}
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Identifiers Summary (Results view) ──

function IdentifiersSummary({
  result,
  onIdClick,
  onTraceClick,
  onCopy,
  copied,
}: {
  result: QueryResult
  searchId: string
  onIdClick: (id: string) => void
  onTraceClick: (operationId: string) => void
  onCopy: (text: string) => void
  copied: boolean
}) {
  if (!result?.data?.length) return null

  // Extract unique identifiers from results
  const ids = {
    operationIds: new Set<string>(),
    correlationIds: new Set<string>(),
    requestIds: new Set<string>(),
    cloudRoles: new Set<string>(),
    resultCodes: new Map<string, number>(),
    types: new Map<string, number>(),
  }

  result.data.forEach((row: Record<string, unknown>) => {
    const opId = row['operation_Id'] || row['operationId']
    if (opId && typeof opId === 'string') ids.operationIds.add(opId)

    const dims = row['customDimensions']
    if (dims && typeof dims === 'string') {
      try {
        const parsed = JSON.parse(dims) as Record<string, string>
        if (parsed.CorrelationId) ids.correlationIds.add(parsed.CorrelationId)
        if (parsed.RequestId) ids.requestIds.add(parsed.RequestId)
      } catch { /* ignore */ }
    } else if (dims && typeof dims === 'object') {
      const d = dims as Record<string, string>
      if (d.CorrelationId) ids.correlationIds.add(d.CorrelationId)
      if (d.RequestId) ids.requestIds.add(d.RequestId)
    }

    const role = row['cloud_RoleName'] || row['cloudRoleName']
    if (role && typeof role === 'string') ids.cloudRoles.add(role)

    const code = row['resultCode'] || row['result_code']
    if (code) {
      const key = String(code)
      ids.resultCodes.set(key, (ids.resultCodes.get(key) || 0) + 1)
    }

    const type = row['itemType'] || row['type']
    if (type) {
      const key = String(type)
      ids.types.set(key, (ids.types.get(key) || 0) + 1)
    }
  })

  const hasIdentifiers = ids.operationIds.size > 0 || ids.correlationIds.size > 0 || ids.requestIds.size > 0

  if (!hasIdentifiers && ids.cloudRoles.size === 0) return null

  return (
    <div className="flex flex-wrap items-start gap-3 pt-2">
      {/* Operation IDs */}
      {ids.operationIds.size > 0 && (
        <IdChipGroup
          label="Operation IDs"
          icon={Network}
          ids={[...ids.operationIds]}
          color="indigo"
          maxShow={3}
          onCopy={onCopy}
          onClick={(id) => onTraceClick(id)}
          clickLabel="View Trace"
          copied={copied}
        />
      )}

      {/* Correlation IDs */}
      {ids.correlationIds.size > 0 && (
        <IdChipGroup
          label="Correlation IDs"
          icon={Link2}
          ids={[...ids.correlationIds]}
          color="blue"
          maxShow={3}
          onCopy={onCopy}
          onClick={(id) => onIdClick(`correlation_id: ${id}`)}
          clickLabel="Search"
          copied={copied}
        />
      )}

      {/* Cloud Roles */}
      {ids.cloudRoles.size > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Server className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Services:</span>
          {[...ids.cloudRoles].map(role => (
            <span key={role} className="px-2 py-0.5 bg-slate-800 border border-slate-700/50 rounded text-[10px] text-slate-300 font-mono">
              {role}
            </span>
          ))}
        </div>
      )}

      {/* Status Codes */}
      {ids.resultCodes.size > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Hash className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Status:</span>
          {[...ids.resultCodes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, count]) => {
            const num = parseInt(code)
            const color = num >= 500 ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : num >= 400 ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
              : 'text-green-400 bg-green-500/10 border-green-500/20'
            return (
              <span key={code} className={clsx('px-2 py-0.5 border rounded text-[10px] font-mono', color)}>
                {code} <span className="opacity-60">x{count}</span>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function IdChipGroup({
  label,
  icon: Icon,
  ids,
  color,
  maxShow,
  onCopy,
  onClick,
  clickLabel,
  copied,
}: {
  label: string
  icon: React.ElementType
  ids: string[]
  color: string
  maxShow: number
  onCopy: (text: string) => void
  onClick: (id: string) => void
  clickLabel: string
  copied: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? ids : ids.slice(0, maxShow)
  const remaining = ids.length - maxShow

  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  }
  const chipColor = colorMap[color] || colorMap.blue

  return (
    <div className="flex items-start gap-1.5 flex-wrap">
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        <Icon className={clsx('w-3 h-3', `text-${color}-400`)} />
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}:</span>
      </div>
      {shown.map(id => (
        <span key={id} className={clsx('inline-flex items-center gap-1 px-2 py-0.5 border rounded text-[10px] font-mono', chipColor)}>
          <span className="truncate max-w-[140px]" title={id}>{id.slice(0, 8)}...{id.slice(-4)}</span>
          <button
            onClick={() => onCopy(id)}
            className="opacity-50 hover:opacity-100 transition-opacity"
            title="Copy full ID"
          >
            {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
          </button>
          <button
            onClick={() => onClick(id)}
            className="opacity-50 hover:opacity-100 transition-opacity"
            title={clickLabel}
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      {remaining > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="px-2 py-0.5 text-[10px] text-slate-500 hover:text-white bg-slate-800 rounded transition-colors"
        >
          +{remaining} more
        </button>
      )}
    </div>
  )
}
