// ============================================================================
// WidgetDesigner — Step 3: In-widget text, icon, column, alignment editor
// with live real-time data preview
// ============================================================================
import { useState, useMemo } from 'react'
import {
  AlignLeft, AlignCenter, AlignRight, ArrowUp, ArrowDown,
  Eye, EyeOff,
  LayoutDashboard, Activity,
  BarChart3, LineChart, PieChart, Database, Cloud,
  Globe, Server, Users, Shield, Zap, Bug, Clock,
  GitPullRequest, Bell, Target, Hash, TrendingUp,
  AlertTriangle, Cpu, Terminal, Package, Layers,
  Monitor, Heart, Star, Bookmark, CheckCircle,
  XCircle, Info, FileText, Folder, Download,
  Upload, RefreshCw, Search, Filter, Headphones,
  Building2, Ticket, UserCheck, DollarSign, Settings,
  GripVertical, Plus, Trash2
} from 'lucide-react'
import clsx from 'clsx'
import { WidgetDesignConfig, WidgetColumn, FieldMapping, WIDGET_ICONS } from './types'

const LUCIDE_ICONS: Record<string, any> = {
  LayoutDashboard, Activity, BarChart3, LineChart, PieChart,
  Database, Cloud, Globe, Server, Users, Shield, Zap,
  Bug, Clock, GitPullRequest, Bell, Settings, Target,
  Hash, TrendingUp, AlertTriangle, Cpu, Terminal,
  Package, Layers, Monitor, Heart, Star, Bookmark,
  CheckCircle, XCircle, Info, FileText, Folder,
  Download, Upload, RefreshCw, Search, Filter,
  Headphones, Building2, Ticket, UserCheck, DollarSign,
}

interface Props {
  design: WidgetDesignConfig
  onChange: (design: WidgetDesignConfig) => void
  mappings: FieldMapping[]
  sampleData: unknown
}

export default function WidgetDesigner({ design, onChange, mappings, sampleData }: Props) {
  const [activeTab, setActiveTab] = useState<'layout' | 'columns' | 'style' | 'icons'>('layout')

  const update = (patch: Partial<WidgetDesignConfig>) => {
    onChange({ ...design, ...patch })
  }

  // Generate preview data from mappings + sample data
  const previewRows = useMemo(() => {
    if (!sampleData) return []
    const rows = Array.isArray(sampleData) ? (sampleData as Record<string, unknown>[]).slice(0, 5) : [sampleData as Record<string, unknown>]
    return rows.map(row => {
      const mapped: Record<string, unknown> = {}
      for (const m of mappings) {
        if (!m.sourceField) continue
        const parts = m.sourceField.split('.')
        let val: unknown = row
        for (const p of parts) {
          if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p]
          else { val = undefined; break }
        }
        mapped[m.targetField] = val
      }
      return mapped
    })
  }, [sampleData, mappings])

  // Icon component resolver
  const WidgetIcon = LUCIDE_ICONS[design.icon] || LayoutDashboard

  // Manage columns from mappings
  const syncColumnsFromMappings = () => {
    const cols: WidgetColumn[] = mappings.map((m) => ({
      id: m.id,
      field: m.targetField,
      label: m.label || m.targetField,
      width: 'auto',
      align: 'left',
      format: 'text',
      visible: true,
    }))
    update({ columns: cols })
  }

  // Add column
  const addColumn = () => {
    const col: WidgetColumn = {
      id: `col_${Date.now()}`,
      field: '',
      label: 'New Column',
      width: 'auto',
      align: 'left',
      format: 'text',
      visible: true,
    }
    update({ columns: [...design.columns, col] })
  }

  // Update column
  const updateColumn = (id: string, patch: Partial<WidgetColumn>) => {
    update({ columns: design.columns.map(c => c.id === id ? { ...c, ...patch } : c) })
  }

  // Move column
  const moveColumn = (id: string, dir: -1 | 1) => {
    const cols = [...design.columns]
    const idx = cols.findIndex(c => c.id === id)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= cols.length) return
    ;[cols[idx], cols[newIdx]] = [cols[newIdx], cols[idx]]
    update({ columns: cols })
  }

  // Remove column
  const removeColumn = (id: string) => {
    update({ columns: design.columns.filter(c => c.id !== id) })
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {(['layout', 'columns', 'style', 'icons'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
              activeTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}>
            {tab}
          </button>
        ))}
      </div>

      {/* Layout Tab */}
      {activeTab === 'layout' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input type="text" value={design.title}
                onChange={e => update({ title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subtitle</label>
              <input type="text" value={design.subtitle}
                onChange={e => update({ subtitle: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Alignment</label>
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                {(['left', 'center', 'right'] as const).map(a => {
                  const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
                  return (
                    <button key={a} onClick={() => update({ alignment: a })}
                      className={clsx('flex-1 py-2 flex justify-center', design.alignment === a ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50')}>
                      <Icon className="w-4 h-4" />
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Header</label>
              <select value={design.headerPosition} onChange={e => update({ headerPosition: e.target.value as any })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Size</label>
              <div className="grid grid-cols-2 gap-1">
                <input type="number" value={design.gridWidth} min={2} max={12}
                  onChange={e => update({ gridWidth: Number(e.target.value) })}
                  className="px-2 py-2 text-sm border border-gray-300 rounded-lg text-center" placeholder="W" />
                <input type="number" value={design.gridHeight} min={2} max={10}
                  onChange={e => update({ gridHeight: Number(e.target.value) })}
                  className="px-2 py-2 text-sm border border-gray-300 rounded-lg text-center" placeholder="H" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={design.showBorder}
                onChange={e => update({ showBorder: e.target.checked })} className="rounded" />
              Show Border
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={design.compactMode}
                onChange={e => update({ compactMode: e.target.checked })} className="rounded" />
              Compact Mode
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Widget Type</label>
            <select value={design.widgetType} onChange={e => update({ widgetType: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="metric-card">Metric Card</option>
              <option value="kpi">KPI</option>
              <option value="gauge">Gauge</option>
              <option value="line-chart">Line Chart</option>
              <option value="bar-chart">Bar Chart</option>
              <option value="doughnut-chart">Doughnut Chart</option>
              <option value="area-chart">Area Chart</option>
              <option value="data-table">Data Table</option>
              <option value="status-list">Status List</option>
              <option value="timeline">Timeline</option>
              <option value="custom-html">Custom HTML</option>
            </select>
          </div>
        </div>
      )}

      {/* Columns Tab */}
      {activeTab === 'columns' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{design.columns.length} columns</span>
            <div className="flex items-center gap-2">
              <button onClick={syncColumnsFromMappings}
                className="text-xs text-blue-600 hover:underline">Sync from Mappings</button>
              <button onClick={addColumn}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 hover:bg-blue-100">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>
          {design.columns.map((col, idx) => (
            <div key={col.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
              <GripVertical className="w-3.5 h-3.5 text-gray-400 cursor-grab" />
              <input value={col.label} onChange={e => updateColumn(col.id, { label: e.target.value })}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white min-w-0" placeholder="Label" />
              <select value={col.format} onChange={e => updateColumn(col.id, { format: e.target.value as any })}
                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-20">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="badge">Badge</option>
                <option value="icon">Icon</option>
                <option value="progress">Progress</option>
              </select>
              <select value={col.align} onChange={e => updateColumn(col.id, { align: e.target.value as any })}
                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-16">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              <button onClick={() => updateColumn(col.id, { visible: !col.visible })}
                className={clsx('p-1 rounded', col.visible ? 'text-gray-600' : 'text-gray-300')}>
                {col.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => moveColumn(col.id, -1)} disabled={idx === 0}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
              <button onClick={() => moveColumn(col.id, 1)} disabled={idx === design.columns.length - 1}
                className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
              <button onClick={() => removeColumn(col.id)}
                className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Style Tab */}
      {activeTab === 'style' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Background</label>
              <input type="color" value={design.bgColor}
                onChange={e => update({ bgColor: e.target.value })}
                className="w-full h-9 rounded-lg border border-gray-300 cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Text Color</label>
              <input type="color" value={design.textColor}
                onChange={e => update({ textColor: e.target.value })}
                className="w-full h-9 rounded-lg border border-gray-300 cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Accent</label>
              <input type="color" value={design.accentColor}
                onChange={e => update({ accentColor: e.target.value })}
                className="w-full h-9 rounded-lg border border-gray-300 cursor-pointer" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Font Size</label>
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              {(['xs', 'sm', 'base', 'lg', 'xl'] as const).map(s => (
                <button key={s} onClick={() => update({ fontSize: s })}
                  className={clsx('flex-1 py-2 text-xs font-medium capitalize', design.fontSize === s ? 'bg-blue-50 text-blue-600' : 'text-gray-500')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Refresh Interval</label>
            <select value={design.refreshInterval} onChange={e => update({ refreshInterval: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value={0}>Manual</option>
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>
        </div>
      )}

      {/* Icons Tab */}
      {activeTab === 'icons' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Widget Icon</label>
          <div className="grid grid-cols-8 gap-1.5 max-h-[200px] overflow-y-auto p-1">
            {WIDGET_ICONS.map(name => {
              const Icon = LUCIDE_ICONS[name]
              if (!Icon) return null
              return (
                <button key={name} onClick={() => update({ icon: name })}
                  className={clsx(
                    'flex items-center justify-center p-2 rounded-lg border transition-all',
                    design.icon === name ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300' : 'border-gray-200 hover:bg-gray-50'
                  )} title={name}>
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Live Preview Panel */}
      <div className="mt-4 border-t pt-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Live Preview</h4>
        <div className={clsx(
          'rounded-xl overflow-hidden transition-all',
          design.showBorder && 'border border-gray-200 shadow-sm'
        )} style={{ backgroundColor: design.bgColor || '#ffffff', color: design.textColor || '#1f2937' }}>
          {/* Header */}
          {design.headerPosition !== 'hidden' && (design.headerPosition === 'top' || !design.headerPosition) && (
            <div className={clsx('px-4 py-3 flex items-center gap-2', design.compactMode && 'px-3 py-2')}>
              <WidgetIcon className="w-5 h-5" style={{ color: design.accentColor || '#3b82f6' }} />
              <div>
                <div className={clsx('font-semibold', `text-${design.fontSize || 'sm'}`)}>{design.title || 'Widget Title'}</div>
                {design.subtitle && <div className="text-xs opacity-60">{design.subtitle}</div>}
              </div>
            </div>
          )}

          {/* Body */}
          <div className={clsx('px-4 pb-3', design.compactMode && 'px-3 pb-2', `text-${design.alignment || 'left'}`)}>
            {previewRows.length > 0 ? (
              design.widgetType === 'data-table' || design.widgetType === 'status-list' ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {design.columns.filter(c => c.visible).map(col => (
                        <th key={col.id} className={clsx('py-1.5 px-2 font-medium', `text-${col.align}`)}>{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {design.columns.filter(c => c.visible).map(col => (
                          <td key={col.id} className={clsx('py-1.5 px-2', `text-${col.align}`)}>
                            {formatCellValue(row[col.field], col.format)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-1">
                  {Object.entries(previewRows[0]).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-500 capitalize">{key}</span>
                      <span className="font-medium">{String(val ?? '—')}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p className="text-xs text-gray-400 py-4 text-center">No data to preview — fetch data and map fields first</p>
            )}
          </div>

          {/* Footer header */}
          {design.headerPosition === 'bottom' && (
            <div className="px-4 py-2 border-t flex items-center gap-2">
              <WidgetIcon className="w-4 h-4" style={{ color: design.accentColor || '#3b82f6' }} />
              <span className="text-xs font-medium">{design.title || 'Widget'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatCellValue(val: unknown, format: string): string {
  if (val === null || val === undefined) return '—'
  switch (format) {
    case 'number': return typeof val === 'number' ? val.toLocaleString() : String(val)
    case 'date': return typeof val === 'string' ? new Date(val).toLocaleDateString() : String(val)
    default: return String(val)
  }
}
