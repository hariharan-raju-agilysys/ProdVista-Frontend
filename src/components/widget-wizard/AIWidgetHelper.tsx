// ============================================================================
// AIWidgetHelper — Advanced AI-assisted widget configuration panel
// Dynamic pipeline loader, contextual prompts, multi-step advisors
// ============================================================================
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Sparkles, Send, Wand2, CheckCircle, AlertTriangle,
  Lightbulb, Code, BrainCircuit, LayoutDashboard,
  Table2, BarChart3, Gauge, Puzzle, Zap, ArrowRight,
  ChevronDown, ChevronUp, Copy, RotateCcw, X
} from 'lucide-react'
import clsx from 'clsx'
import aiService from '../../services/aiService'
import type { FieldMapping, WidgetDesignConfig, DataSourceConfig, WidgetColumn } from './types'

// ── Types ───────────────────────────────────────────────────────────────────
interface Props {
  dataSource: DataSourceConfig
  mappings: FieldMapping[]
  design: WidgetDesignConfig
  onApplyMappings: (mappings: FieldMapping[]) => void
  onApplyDesign: (design: Partial<WidgetDesignConfig>) => void
}

type TaskStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

interface PipelineTask {
  id: string
  label: string
  detail: string
  status: TaskStatus
  result?: string
}

interface AISuggestion {
  type: 'widget-type' | 'mappings' | 'design' | 'html' | 'info'
  label: string
  detail?: string
  applied: boolean
  onApply?: () => void
}

// ── Constants ───────────────────────────────────────────────────────────────
const PROMPT_CATEGORIES = [
  {
    category: 'Quick Setup',
    icon: Zap,
    color: 'from-amber-500 to-orange-500',
    prompts: [
      { label: 'Auto-configure all', prompt: 'Analyze this data and create the best widget configuration automatically. Choose the optimal widget type, map all fields, and suggest the best layout.', icon: Sparkles },
      { label: 'Suggest best widget', prompt: 'Based on this data, what widget type would be best? Explain why.', icon: Lightbulb },
      { label: 'Map fields for me', prompt: 'Auto-map the data fields to the current widget type slots. Use the best matching fields.', icon: Puzzle },
    ],
  },
  {
    category: 'Widget Types',
    icon: LayoutDashboard,
    color: 'from-blue-500 to-indigo-500',
    prompts: [
      { label: 'KPI metric card', prompt: 'Configure this as a clean KPI metric card showing the most important value with trend indicator.', icon: Gauge },
      { label: 'Data table', prompt: 'Configure as a table showing all important columns with proper formatting and alignment.', icon: Table2 },
      { label: 'Chart layout', prompt: 'Set up the best chart type for visualizing this data over time.', icon: BarChart3 },
    ],
  },
  {
    category: 'Advanced',
    icon: BrainCircuit,
    color: 'from-purple-500 to-pink-500',
    prompts: [
      { label: 'Custom HTML widget', prompt: 'Generate a custom HTML template to display this data in a visually appealing way inside the widget div.', icon: Code },
      { label: 'Optimize layout', prompt: 'Analyze the current config and suggest improvements to the layout, colors, and field mappings.', icon: Wand2 },
    ],
  },
]

const SOURCE_LABELS: Record<string, string> = {
  AzureDevOps: 'Azure DevOps',
  Jenkins: 'Jenkins CI',
  ApiEndpoint: 'REST API',
  DatabaseQuery: 'Database',
  Excel: 'Excel/CSV',
  AzureLogAnalytics: 'Log Analytics',
  AppInsights: 'App Insights',
  AzureMetrics: 'Azure Metrics',
  Static: 'Static JSON',
  SignalR: 'Real-time Stream',
}

const genId = () => `fm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// ── Dynamic Pipeline Loader ─────────────────────────────────────────────────
function PipelineLoader({ tasks, sourceLabel }: { tasks: PipelineTask[]; sourceLabel: string }) {
  const completedCount = tasks.filter(t => t.status === 'done').length
  const totalCount = tasks.filter(t => t.status !== 'skipped').length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className="rounded-xl border border-purple-200/60 bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/80 p-4 space-y-3 backdrop-blur-sm">
      {/* Header with animated gradient */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <BrainCircuit className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-ping" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800">ProdVista AI Processing</div>
          <div className="text-xs text-purple-600/80 truncate">
            Analyzing {sourceLabel} data pipeline...
          </div>
        </div>
        <div className="text-xs font-mono text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full">
          {completedCount}/{totalCount}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(progress, 5)}%` }}
        />
      </div>

      {/* Task list */}
      <div className="space-y-1">
        {tasks.map(task => (
          <div key={task.id} className={clsx(
            'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-300',
            task.status === 'running' && 'bg-purple-100/60 border border-purple-200/60',
            task.status === 'done' && 'opacity-70',
            task.status === 'error' && 'bg-red-50 border border-red-200/60',
            task.status === 'pending' && 'opacity-40',
          )}>
            {/* Status indicator */}
            {task.status === 'running' && (
              <div className="relative flex items-center justify-center w-4 h-4">
                <div className="absolute inset-0 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin" />
              </div>
            )}
            {task.status === 'done' && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
            {task.status === 'error' && <X className="w-4 h-4 text-red-500 flex-shrink-0" />}
            {task.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
            {task.status === 'skipped' && <div className="w-4 h-4 rounded-full bg-gray-200 flex-shrink-0" />}

            <div className="flex-1 min-w-0">
              <span className={clsx(
                'font-medium',
                task.status === 'running' && 'text-purple-800',
                task.status === 'done' && 'text-gray-600',
                task.status === 'error' && 'text-red-700',
                task.status === 'pending' && 'text-gray-400',
              )}>
                {task.label}
              </span>
              {task.status === 'running' && (
                <span className="ml-1.5 text-purple-500 animate-pulse">{task.detail}</span>
              )}
              {task.status === 'done' && task.result && (
                <span className="ml-1.5 text-emerald-600">{task.result}</span>
              )}
              {task.status === 'error' && task.result && (
                <span className="ml-1.5 text-red-500">{task.result}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function AIWidgetHelper({ dataSource, mappings, design, onApplyMappings, onApplyDesign }: Props) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<PipelineTask[]>([])
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Quick Setup')
  const [showHtmlEditor, setShowHtmlEditor] = useState(false)

  const promptRef = useRef<HTMLInputElement>(null)

  // Contextual source label for dynamic loader messages
  const sourceLabel = SOURCE_LABELS[dataSource.type] || dataSource.type || 'data'

  // Update a task in the pipeline
  const updateTask = useCallback((id: string, updates: Partial<PipelineTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }, [])

  // Run AI analysis with dynamic pipeline
  const handleAnalyze = useCallback(async (userPrompt?: string) => {
    const finalPrompt = userPrompt || prompt
    if (!finalPrompt.trim()) return

    setLoading(true)
    setError(null)
    setResponse(null)
    setSuggestions([])

    // Build pipeline tasks based on what we're doing
    const wantsHtml = finalPrompt.toLowerCase().includes('html') || finalPrompt.toLowerCase().includes('custom')
    const wantsAuto = finalPrompt.toLowerCase().includes('auto') || finalPrompt.toLowerCase().includes('best') || finalPrompt.toLowerCase().includes('configure')
    const wantsMap = finalPrompt.toLowerCase().includes('map') || wantsAuto
    const wantsTable = finalPrompt.toLowerCase().includes('table') || finalPrompt.toLowerCase().includes('column')

    const pipeline: PipelineTask[] = [
      { id: 'analyze', label: 'Analyzing data structure', detail: `Reading ${sourceLabel} fields...`, status: 'pending' },
      { id: 'suggest', label: 'Detecting best widget type', detail: 'Evaluating patterns...', status: 'pending' },
      { id: 'mapping', label: 'Mapping data fields', detail: `Matching ${sourceLabel} fields to widget slots...`, status: dataSource.sampleData ? 'pending' : 'skipped' },
      { id: 'describe', label: 'Generating data insights', detail: 'Building recommendations...', status: dataSource.sampleData ? 'pending' : 'skipped' },
      { id: 'design', label: 'Configuring widget design', detail: 'Optimizing layout...', status: 'pending' },
      { id: 'html', label: 'Generating HTML template', detail: 'Building dynamic template...', status: wantsHtml ? 'pending' : 'skipped' },
    ]
    setTasks(pipeline)

    const newSuggestions: AISuggestion[] = []

    try {
      // ── Task 1: Analyze data ──────────────────────────────────────
      updateTask('analyze', { status: 'running', detail: `Scanning ${sourceLabel} schema...` })
      const analysis = await aiService.analyzeData(dataSource.sampleData, design.widgetType)
      updateTask('analyze', {
        status: 'done',
        result: analysis.detectedFields ? `${analysis.detectedFields.length} fields detected` : 'Done',
      })

      // ── Task 2: Suggest widget type ───────────────────────────────
      updateTask('suggest', { status: 'running', detail: `Evaluating ${sourceLabel} data shape...` })
      // Small delay to make each step visible
      await new Promise(r => setTimeout(r, 300))

      if (analysis.success && analysis.suggestedWidgetType) {
        const suggestedType = analysis.suggestedWidgetType
        const alreadyApplied = wantsAuto
        if (wantsAuto) onApplyDesign({ widgetType: suggestedType })

        newSuggestions.push({
          type: 'widget-type',
          label: `Recommended: ${suggestedType}`,
          detail: analysis.widgetTypeSuggestions?.[0]?.reason,
          applied: alreadyApplied,
          onApply: () => { onApplyDesign({ widgetType: suggestedType }) },
        })
        updateTask('suggest', { status: 'done', result: suggestedType })
      } else {
        updateTask('suggest', { status: 'done', result: 'Using current type' })
      }

      // ── Task 3: Map fields ────────────────────────────────────────
      let mappingResult: Awaited<ReturnType<typeof aiService.suggestMappings>> | null = null
      if (dataSource.sampleData) {
        updateTask('mapping', { status: 'running', detail: `Matching ${dataSource.sampleFields.length} fields from ${sourceLabel}...` })
        mappingResult = await aiService.suggestMappings(dataSource.sampleData, design.widgetType)

        if (mappingResult.success && mappingResult.mappings) {
          const aiMappings: FieldMapping[] = Object.entries(mappingResult.mappings).map(([target, source]) => ({
            id: genId(),
            sourceField: source,
            targetField: target,
            transform: 'none',
            label: source.split('.').pop() || source,
          }))

          const alreadyApplied = wantsMap
          if (wantsMap) onApplyMappings(aiMappings)

          newSuggestions.push({
            type: 'mappings',
            label: `${aiMappings.length} field mappings ready`,
            detail: mappingResult.explanation || undefined,
            applied: alreadyApplied,
            onApply: () => onApplyMappings(aiMappings),
          })
          updateTask('mapping', { status: 'done', result: `${aiMappings.length} mapped` })
        } else {
          updateTask('mapping', { status: 'done', result: 'No mappings found' })
        }

        // ── Task 4: Describe data ─────────────────────────────────────
        updateTask('describe', { status: 'running', detail: `Summarizing ${sourceLabel} data...` })
        const desc = await aiService.describeData(dataSource.sampleData)
        let fullResponse = ''
        if (desc.description) {
          fullResponse = desc.description
          if (mappingResult?.explanation) fullResponse += '\n\n' + mappingResult.explanation
        }
        setResponse(fullResponse || null)
        updateTask('describe', { status: 'done', result: desc.isAIGenerated ? 'AI-powered' : 'Heuristic' })
      }

      // ── Task 5: Design suggestions ────────────────────────────────
      updateTask('design', { status: 'running', detail: 'Optimizing widget layout...' })
      await new Promise(r => setTimeout(r, 200))

      if (analysis.detectedFields && analysis.detectedFields.length > 0) {
        const columns: WidgetColumn[] = analysis.detectedFields.slice(0, 6).map((f, i) => ({
          id: `col_ai_${i}`,
          field: f.fieldName,
          label: f.fieldName.replace(/([A-Z])/g, ' $1').trim(),
          width: 'auto',
          align: f.dataType === 'number' ? 'right' as const : 'left' as const,
          format: f.dataType === 'number' ? 'number' as const : f.dataType === 'date' ? 'date' as const : 'text' as const,
          visible: true,
        }))

        const shouldApplyColumns = wantsTable || wantsAuto
        if (shouldApplyColumns) onApplyDesign({ columns })

        newSuggestions.push({
          type: 'design',
          label: `${columns.length} columns configured`,
          applied: shouldApplyColumns,
          onApply: () => onApplyDesign({ columns }),
        })
        updateTask('design', { status: 'done', result: `${columns.length} columns` })
      } else {
        updateTask('design', { status: 'done', result: 'Done' })
      }

      // ── Task 6: HTML template (optional) ──────────────────────────
      if (wantsHtml) {
        updateTask('html', { status: 'running', detail: 'Building dynamic template...' })
        await new Promise(r => setTimeout(r, 400))
        const fields = dataSource.sampleFields.map(f => f.name).join(', ')
        const htmlTemplate = generateWidgetHtml(fields, design.title)
        onApplyDesign({ customHtml: htmlTemplate, widgetType: 'custom-html' })
        newSuggestions.push({ type: 'html', label: 'Custom HTML template generated', applied: true })
        updateTask('html', { status: 'done', result: 'Template ready' })
        setShowHtmlEditor(true)
      }

      if (newSuggestions.length === 0) {
        newSuggestions.push({ type: 'info', label: 'Analysis complete — no changes needed', applied: false })
      }
      setSuggestions(newSuggestions)
    } catch (err: any) {
      // Mark current running task as error
      setTasks(prev => prev.map(t => t.status === 'running' ? { ...t, status: 'error' as const, result: 'Failed' } : t))
      setError(err?.message || 'AI processing failed. You can configure the widget manually or check AI settings.')
      newSuggestions.push({
        type: 'info',
        label: 'AI unavailable — use Auto-Map in the Mapper tab or configure manually',
        applied: false,
      })
      setSuggestions(newSuggestions)
    } finally {
      setLoading(false)
    }
  }, [prompt, dataSource, design, mappings, sourceLabel, onApplyMappings, onApplyDesign, updateTask])

  const handleQuickPrompt = (p: string) => {
    setPrompt(p)
    handleAnalyze(p)
  }

  // Focus prompt input on mount
  useEffect(() => { promptRef.current?.focus() }, [])

  // Context advisor tips
  const advisorTips = getAdvisorTips(dataSource, design, mappings)

  return (
    <div className="space-y-4">
      {/* ── Header with gradient ───────────────────────────────────── */}
      <div className="flex items-center gap-3 pb-3 border-b border-purple-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-500/20">
          <BrainCircuit className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-800">AI Widget Assistant</h3>
          <p className="text-[11px] text-gray-400 truncate">Intelligent configuration for {sourceLabel}</p>
        </div>
      </div>

      {/* ── Contextual Advisor Tips ────────────────────────────────── */}
      {advisorTips.length > 0 && !loading && (
        <div className="space-y-1.5">
          {advisorTips.map((tip, i) => (
            <div key={i}
              className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/60 text-blue-700">
              <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Prompt Categories (Accordion) ──────────────────────────── */}
      {!loading && (
        <div className="space-y-1.5">
          {PROMPT_CATEGORIES.map(cat => {
            const CatIcon = cat.icon
            const isOpen = expandedCategory === cat.category
            return (
              <div key={cat.category} className="rounded-lg border border-gray-200/80 overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(isOpen ? null : cat.category)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50/80 transition-colors"
                >
                  <div className={clsx('w-5 h-5 rounded flex items-center justify-center bg-gradient-to-br', cat.color)}>
                    <CatIcon className="w-3 h-3 text-white" />
                  </div>
                  <span className="flex-1 text-left">{cat.category}</span>
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="px-2 pb-2 flex flex-wrap gap-1.5">
                    {cat.prompts.map(p => {
                      const PIcon = p.icon
                      return (
                        <button key={p.label} onClick={() => handleQuickPrompt(p.prompt)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-white text-gray-700 rounded-md border border-gray-200 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-all duration-150 shadow-sm hover:shadow">
                          <PIcon className="w-3 h-3 text-purple-500" />
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Custom Prompt Input ─────────────────────────────────────── */}
      {!loading && (
        <div className="relative">
          <input ref={promptRef} type="text" value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleAnalyze()}
            placeholder={`Describe your widget... e.g. "KPI for ${sourceLabel} build rate"`}
            className="w-full pl-3 pr-20 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 bg-white shadow-sm" />
          <button onClick={() => handleAnalyze()} disabled={loading || !prompt.trim()}
            className={clsx(
              'absolute right-1.5 top-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              !prompt.trim()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-500/20'
            )}>
            <Send className="w-3 h-3" />
            Ask AI
          </button>
        </div>
      )}

      {/* ── No Data Warning ────────────────────────────────────────── */}
      {!dataSource.sampleData && !loading && (
        <div className="flex items-center gap-2.5 text-xs text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-3">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <span className="font-semibold">No data loaded yet.</span>{' '}
            Go to Step 1 and fetch sample data so AI can analyze fields and suggest the best configuration.
          </div>
        </div>
      )}

      {/* ── Dynamic Pipeline Loader ────────────────────────────────── */}
      {loading && <PipelineLoader tasks={tasks} sourceLabel={sourceLabel} />}

      {/* ── Error ──────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="flex items-start gap-2.5 text-sm text-red-700 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/60 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <div className="font-semibold text-xs mb-0.5">Processing Error</div>
            <div className="text-xs text-red-600">{error}</div>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded">
            <X className="w-3 h-3 text-red-400" />
          </button>
        </div>
      )}

      {/* ── AI Response ────────────────────────────────────────────── */}
      {response && !loading && (
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Wand2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-indigo-700">AI Insights</span>
            <button onClick={() => { navigator.clipboard.writeText(response) }}
              className="ml-auto p-1 hover:bg-indigo-100 rounded text-indigo-400 hover:text-indigo-600" title="Copy">
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
            {response}
          </div>
        </div>
      )}

      {/* ── Suggestions / Actions ──────────────────────────────────── */}
      {suggestions.length > 0 && !loading && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Actions & Results</div>
          {suggestions.map((s, i) => (
            <div key={i} className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs border transition-all',
              s.applied
                ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200/60 text-emerald-800'
                : 'bg-white border-gray-200/80 text-gray-700 hover:border-purple-200 hover:bg-purple-50/30'
            )}>
              {s.applied
                ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : <ArrowRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.label}</div>
                {s.detail && <div className="text-[10px] text-gray-500 mt-0.5 truncate">{s.detail}</div>}
              </div>
              {s.applied ? (
                <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-100 px-1.5 py-0.5 rounded">Applied</span>
              ) : s.onApply ? (
                <button onClick={() => { s.onApply!(); s.applied = true; setSuggestions([...suggestions]) }}
                  className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded hover:bg-purple-200 transition-colors">
                  Apply
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* ── Custom HTML Editor (only when customHtml has content) ─── */}
      {design.customHtml && design.customHtml.trim().length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowHtmlEditor(!showHtmlEditor)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-purple-600 transition-colors">
            <Code className="w-3.5 h-3.5" />
            Custom HTML Template
            {showHtmlEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showHtmlEditor && (
            <>
              <textarea value={design.customHtml} rows={6}
                onChange={e => onApplyDesign({ customHtml: e.target.value })}
                className="w-full px-3 py-2 text-[11px] border border-gray-200 rounded-lg font-mono bg-gray-900 text-green-400 focus:ring-2 focus:ring-purple-400" />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400">
                  Use {'{{field_name}}'} placeholders. Rendered dynamically inside the widget.
                </p>
                <button onClick={() => { onApplyDesign({ customHtml: '' }); setShowHtmlEditor(false) }}
                  className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1">
                  <RotateCcw className="w-2.5 h-2.5" /> Clear
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Quick Restart ──────────────────────────────────────────── */}
      {(suggestions.length > 0 || response) && !loading && (
        <button onClick={() => { setResponse(null); setSuggestions([]); setTasks([]); setError(null); setPrompt(''); promptRef.current?.focus() }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors w-full justify-center">
          <RotateCcw className="w-3 h-3" />
          Start new AI analysis
        </button>
      )}
    </div>
  )
}

// ── Advisor Tips (contextual) ───────────────────────────────────────────────
function getAdvisorTips(dataSource: DataSourceConfig, design: WidgetDesignConfig, mappings: FieldMapping[]): string[] {
  const tips: string[] = []
  if (!dataSource.sampleData) {
    tips.push('Load sample data first for best AI recommendations.')
  } else if (dataSource.sampleFields.length > 8) {
    tips.push(`${dataSource.sampleFields.length} fields detected — AI can help pick the most relevant ones.`)
  }
  if (mappings.length === 0 && dataSource.sampleData) {
    tips.push('Try "Map fields for me" to auto-wire fields into your widget.')
  }
  if (design.widgetType === 'metric-card' && dataSource.sampleFields.some(f => f.type === 'array')) {
    tips.push('Array data detected — consider a Table or Chart widget for better visualization.')
  }
  if (dataSource.type === 'AzureDevOps') {
    tips.push('Azure DevOps data works great with KPI cards (build rate) or tables (work items).')
  }
  if (dataSource.type === 'Jenkins') {
    tips.push('Jenkins data is ideal for build status cards or pipeline timeline charts.')
  }
  return tips.slice(0, 2)
}

// ── HTML Template Generator ─────────────────────────────────────────────────
function generateWidgetHtml(fields: string, title: string): string {
  const fieldList = fields.split(',').map(f => f.trim()).filter(Boolean)
  const rows = fieldList.slice(0, 6).map(f =>
    `  <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0">
    <span style="color:#6b7280;font-size:12px">${f}</span>
    <span style="font-weight:600;font-size:13px">{{${f}}}</span>
  </div>`
  ).join('\n')

  return `<div style="padding:12px;font-family:system-ui">
  <h3 style="font-size:15px;font-weight:700;margin-bottom:12px;color:#1f2937">${title || 'Widget'}</h3>
${rows}
</div>`
}
