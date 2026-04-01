// ============================================================================
// WidgetConfigWizard — Main 4-step orchestrator for widget configuration
// Steps: Source → Mapper → Design → Preview
// Includes optional AI helper panel on any step
// ============================================================================
import { useState, useMemo, useCallback } from 'react'
import {
  X, ChevronLeft, ChevronRight, Save, Sparkles,
  Database as DbIcon, GitMerge, Paintbrush, Eye,
  Loader2, CheckCircle, AlertTriangle
} from 'lucide-react'
import clsx from 'clsx'
import DataSourceSelector from './DataSourceSelector'
import DragDropDataMapper from './DragDropDataMapper'
import WidgetDesigner from './WidgetDesigner'
import AIWidgetHelper from './AIWidgetHelper'
import { addWidget, updateWidget } from '../../services/dynamicDashboardService'
import type { DashboardWidget } from '../../services/dynamicDashboardService'
import type {
  WizardStep, DataSourceConfig, FieldMapping, WidgetDesignConfig
} from './types'

interface Props {
  /** If editing, pass existing widget; for new widgets leave undefined */
  widget?: DashboardWidget
  /** The page to add the widget to */
  pageId: string
  /** Close the wizard */
  onClose: () => void
  /** Called after save with the updated/new widget */
  onSaved?: (widget: DashboardWidget) => void
}

const STEPS: { key: WizardStep; label: string; icon: any; desc: string }[] = [
  { key: 'source', label: 'Data Source', icon: DbIcon, desc: 'Choose and configure your data source' },
  { key: 'mapper', label: 'Map Fields', icon: GitMerge, desc: 'Drag fields to widget slots' },
  { key: 'design', label: 'Design', icon: Paintbrush, desc: 'Customize layout, colors, icons' },
  { key: 'preview', label: 'Preview & Save', icon: Eye, desc: 'Review and save your widget' },
]

const DEFAULT_DESIGN: WidgetDesignConfig = {
  widgetType: 'metric-card',
  title: '',
  subtitle: '',
  icon: 'LayoutDashboard',
  gridWidth: 4,
  gridHeight: 3,
  refreshInterval: 60,
  columns: [],
  alignment: 'left',
  headerPosition: 'top',
  showBorder: true,
  compactMode: false,
  bgColor: '#ffffff',
  textColor: '#1f2937',
  accentColor: '#3b82f6',
  fontSize: 'sm',
  customHtml: '',
}

const DEFAULT_SOURCE: DataSourceConfig = {
  type: 'Static',
  provider: {},
  sampleData: null,
  sampleFields: [],
}

export default function WidgetConfigWizard({ widget, pageId, onClose, onSaved }: Props) {
  const isEditing = !!widget

  // Initialize from existing widget when editing
  const [step, setStep] = useState<WizardStep>('source')
  const [showAI, setShowAI] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Source config
  const [dataSource, setDataSource] = useState<DataSourceConfig>(() => {
    if (widget) {
      return {
        type: (widget.dataProviderType || 'Static') as DataSourceConfig['type'],
        provider: widget.dataProviderConfig || {},
        sampleData: widget.cachedData || null,
        sampleFields: [],
      }
    }
    return { ...DEFAULT_SOURCE }
  })

  // Field mappings
  const [mappings, setMappings] = useState<FieldMapping[]>(() => {
    if (widget?.widgetConfig?.fieldMappings) {
      return widget.widgetConfig.fieldMappings as FieldMapping[]
    }
    return []
  })

  // Design config
  const [design, setDesign] = useState<WidgetDesignConfig>(() => {
    if (widget) {
      return {
        ...DEFAULT_DESIGN,
        widgetType: widget.widgetType || 'metric-card',
        title: widget.title || '',
        subtitle: widget.subtitle || '',
        gridWidth: widget.gridWidth || 4,
        gridHeight: widget.gridHeight || 3,
        refreshInterval: widget.refreshIntervalSeconds || 60,
        ...(widget.widgetConfig?.design as object || {}),
      }
    }
    return { ...DEFAULT_DESIGN }
  })

  // Step navigation
  const stepIdx = STEPS.findIndex(s => s.key === step)

  const canGoNext = useMemo(() => {
    if (step === 'source') return !!dataSource.type
    if (step === 'mapper') return true // mappings are optional
    if (step === 'design') return !!design.title.trim()
    return true
  }, [step, dataSource, design])

  const goNext = () => {
    const next = stepIdx + 1
    if (next < STEPS.length) setStep(STEPS[next].key)
  }
  const goBack = () => {
    const prev = stepIdx - 1
    if (prev >= 0) setStep(STEPS[prev].key)
  }

  // Save handler
  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const widgetPayload: Partial<DashboardWidget> = {
        widgetType: design.widgetType,
        title: design.title,
        subtitle: design.subtitle,
        gridWidth: design.gridWidth,
        gridHeight: design.gridHeight,
        dataProviderType: dataSource.type,
        dataProviderConfig: dataSource.provider as Record<string, unknown>,
        refreshIntervalSeconds: design.refreshInterval,
        widgetConfig: {
          fieldMappings: mappings,
          design: {
            icon: design.icon,
            columns: design.columns,
            alignment: design.alignment,
            headerPosition: design.headerPosition,
            showBorder: design.showBorder,
            compactMode: design.compactMode,
            bgColor: design.bgColor,
            textColor: design.textColor,
            accentColor: design.accentColor,
            fontSize: design.fontSize,
            customHtml: design.customHtml,
          },
        },
      }

      let result: DashboardWidget
      if (isEditing && widget) {
        const resp = await updateWidget(widget.id, widgetPayload)
        result = resp.data
      } else {
        const resp = await addWidget(pageId, widgetPayload)
        result = resp.data
      }
      onSaved?.(result)
      onClose()
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || err?.message || 'Failed to save widget')
    } finally {
      setSaving(false)
    }
  }, [design, dataSource, mappings, isEditing, widget, pageId, onSaved, onClose])

  const applyDesign = (partial: Partial<WidgetDesignConfig>) => {
    setDesign(prev => ({ ...prev, ...partial }))
  }

  // Build JSON preview
  const jsonPreview = useMemo(() => JSON.stringify({
    widgetType: design.widgetType,
    title: design.title,
    subtitle: design.subtitle,
    dataProviderType: dataSource.type,
    dataProviderConfig: dataSource.provider,
    fieldMappings: mappings,
    design: {
      icon: design.icon,
      columns: design.columns,
      alignment: design.alignment,
      bgColor: design.bgColor,
      textColor: design.textColor,
      accentColor: design.accentColor,
      fontSize: design.fontSize,
      customHtml: design.customHtml ? '(HTML template)' : undefined,
    },
  }, null, 2), [design, dataSource, mappings])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: 'min(95vw, 1200px)', height: 'min(92vh, 820px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEditing ? 'Edit Widget' : 'Configure Widget'}
            </h2>
            <p className="text-sm text-gray-500">{STEPS[stepIdx].desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAI(!showAI)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                showAI
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              )}>
              <Sparkles className="w-4 h-4" /> AI Helper
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = i === stepIdx
            const isDone = i < stepIdx
            return (
              <div key={s.key} className="flex items-center">
                {i > 0 && (
                  <div className={clsx(
                    'w-12 h-0.5 mx-1',
                    isDone ? 'bg-blue-500' : 'bg-gray-200'
                  )} />
                )}
                <button onClick={() => setStep(s.key)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive && 'bg-blue-100 text-blue-700',
                    isDone && !isActive && 'text-blue-600',
                    !isActive && !isDone && 'text-gray-400'
                  )}>
                  {isDone
                    ? <CheckCircle className="w-4 h-4 text-blue-500" />
                    : <Icon className={clsx('w-4 h-4', isActive ? 'text-blue-600' : 'text-gray-400')} />}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className={clsx('flex-1 overflow-y-auto p-6', showAI && 'border-r border-gray-200')}>
            {step === 'source' && (
              <DataSourceSelector config={dataSource} onChange={setDataSource} />
            )}

            {step === 'mapper' && (
              <DragDropDataMapper
                fields={dataSource.sampleFields}
                sampleData={dataSource.sampleData}
                widgetType={design.widgetType}
                mappings={mappings}
                onChange={setMappings}
              />
            )}

            {step === 'design' && (
              <WidgetDesigner
                design={design}
                onChange={setDesign}
                mappings={mappings}
                sampleData={dataSource.sampleData}
              />
            )}

            {step === 'preview' && (
              <PreviewStep
                design={design}
                dataSource={dataSource}
                mappings={mappings}
                jsonPreview={jsonPreview}
              />
            )}
          </div>

          {/* AI Panel (collapsible sidebar) */}
          {showAI && (
            <div className="w-[380px] overflow-y-auto p-4 bg-gray-50/30">
              <AIWidgetHelper
                dataSource={dataSource}
                mappings={mappings}
                design={design}
                onApplyMappings={setMappings}
                onApplyDesign={applyDesign}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50">
          <div>
            {saveError && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="w-4 h-4" /> {saveError}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {stepIdx > 0 && (
              <button onClick={goBack}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step !== 'preview' ? (
              <button onClick={goNext} disabled={!canGoNext}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium',
                  canGoNext
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : isEditing ? 'Update Widget' : 'Add Widget'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Preview Step — Final review with live preview + JSON config
// ============================================================================
function PreviewStep({ design, dataSource, mappings, jsonPreview }: {
  design: WidgetDesignConfig
  dataSource: DataSourceConfig
  mappings: FieldMapping[]
  jsonPreview: string
}) {
  const [showJson, setShowJson] = useState(false)

  // Build preview data from sample + mappings
  const previewRow = useMemo(() => {
    if (!dataSource.sampleData) return null
    const src = Array.isArray(dataSource.sampleData) ? dataSource.sampleData[0] : dataSource.sampleData
    if (!src || typeof src !== 'object') return null
    const row: Record<string, unknown> = {}
    mappings.forEach(m => {
      const val = (src as Record<string, unknown>)[m.sourceField]
      row[m.targetField] = val
    })
    return row
  }, [dataSource.sampleData, mappings])

  return (
    <div className="space-y-6">
      {/* Widget Preview Card */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Widget Preview</h3>
        <div className="max-w-lg">
          <div className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: design.bgColor,
              color: design.textColor,
              border: design.showBorder ? '1px solid #e5e7eb' : 'none',
            }}>
            {/* Header */}
            {design.headerPosition !== 'hidden' && design.headerPosition !== 'bottom' && (
              <div className="px-4 py-3 border-b border-gray-100" style={{ textAlign: design.alignment }}>
                <div className="font-semibold" style={{ fontSize: design.fontSize === 'lg' ? 18 : 15 }}>
                  {design.title || 'Untitled Widget'}
                </div>
                {design.subtitle && <div className="text-xs opacity-60 mt-0.5">{design.subtitle}</div>}
              </div>
            )}

            {/* Body */}
            <div className="p-4">
              {design.customHtml ? (
                <div className="text-xs text-gray-500 italic">
                  [Custom HTML Template — rendered at runtime with live data]
                </div>
              ) : previewRow ? (
                <div className="space-y-2">
                  {Object.entries(previewRow).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-semibold">{String(val ?? '—')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 text-center py-6">
                  No preview data — fetch data in Step 1
                </div>
              )}
            </div>

            {/* Footer header */}
            {design.headerPosition === 'bottom' && (
              <div className="px-4 py-3 border-t border-gray-100" style={{ textAlign: design.alignment }}>
                <div className="font-semibold">{design.title || 'Untitled Widget'}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Widget Type" value={design.widgetType} />
        <SummaryCard label="Data Source" value={dataSource.type} />
        <SummaryCard label="Field Mappings" value={`${mappings.length} fields`} />
        <SummaryCard label="Refresh" value={`${design.refreshInterval}s`} />
      </div>

      {/* JSON Toggle */}
      <div>
        <button onClick={() => setShowJson(!showJson)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700">
          {showJson ? 'Hide' : 'Show'} JSON Configuration
        </button>
        {showJson && (
          <pre className="mt-2 p-4 bg-gray-900 text-green-400 text-xs rounded-lg overflow-auto max-h-64 font-mono">
            {jsonPreview}
          </pre>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-800 mt-0.5">{value}</div>
    </div>
  )
}
