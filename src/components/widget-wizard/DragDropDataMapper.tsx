// ============================================================================
// DragDropDataMapper — Step 2: Magnetic drag-and-drop field mapping
// ============================================================================
import { useState, useCallback, useRef } from 'react'
import {
  GripVertical, ArrowRight, Sparkles, Trash2, Plus,
  Hash, Calendar, ToggleLeft, Type, List, Eye, EyeOff
} from 'lucide-react'
import clsx from 'clsx'
import { FieldMapping, FieldInfo, DropZone } from './types'

const TYPE_ICONS: Record<string, any> = {
  string: Type, number: Hash, date: Calendar, boolean: ToggleLeft, array: List, object: GripVertical,
}
const TYPE_COLORS: Record<string, string> = {
  string: 'bg-gray-100 text-gray-700 border-gray-300',
  number: 'bg-blue-50 text-blue-700 border-blue-300',
  date: 'bg-purple-50 text-purple-700 border-purple-300',
  boolean: 'bg-amber-50 text-amber-700 border-amber-300',
  array: 'bg-pink-50 text-pink-700 border-pink-300',
}

interface Props {
  fields: FieldInfo[]
  mappings: FieldMapping[]
  onChange: (mappings: FieldMapping[]) => void
  widgetType: string
  sampleData: unknown
}

// Target slots based on widget type
function getTargetSlots(widgetType: string): DropZone[] {
  const base: DropZone[] = [
    { id: 'title', label: 'Title / Label', fieldType: 'text', accepts: ['string', 'number'], currentField: null },
    { id: 'value', label: 'Primary Value', fieldType: 'metric', accepts: ['number', 'string'], currentField: null },
  ]
  switch (widgetType) {
    case 'metric-card': case 'kpi': case 'gauge':
      return [
        ...base,
        { id: 'change', label: 'Change / Trend', fieldType: 'metric', accepts: ['number'], currentField: null },
        { id: 'target', label: 'Target Value', fieldType: 'metric', accepts: ['number'], currentField: null },
        { id: 'subtitle', label: 'Subtitle', fieldType: 'text', accepts: ['string'], currentField: null },
      ]
    case 'line-chart': case 'area-chart':
      return [
        { id: 'x', label: 'X Axis (Time)', fieldType: 'axis', accepts: ['date', 'string', 'number'], currentField: null },
        { id: 'y', label: 'Y Axis (Value)', fieldType: 'axis', accepts: ['number'], currentField: null },
        { id: 'series', label: 'Series Group', fieldType: 'group', accepts: ['string'], currentField: null },
      ]
    case 'bar-chart': case 'doughnut-chart':
      return [
        { id: 'category', label: 'Category', fieldType: 'axis', accepts: ['string'], currentField: null },
        { id: 'value', label: 'Value', fieldType: 'metric', accepts: ['number'], currentField: null },
        { id: 'series', label: 'Series', fieldType: 'group', accepts: ['string'], currentField: null },
      ]
    case 'data-table':
      return [
        { id: 'col1', label: 'Column 1', fieldType: 'any', accepts: ['string', 'number', 'date', 'boolean'], currentField: null },
        { id: 'col2', label: 'Column 2', fieldType: 'any', accepts: ['string', 'number', 'date', 'boolean'], currentField: null },
        { id: 'col3', label: 'Column 3', fieldType: 'any', accepts: ['string', 'number', 'date', 'boolean'], currentField: null },
        { id: 'col4', label: 'Column 4', fieldType: 'any', accepts: ['string', 'number', 'date', 'boolean'], currentField: null },
        { id: 'col5', label: 'Column 5', fieldType: 'any', accepts: ['string', 'number', 'date', 'boolean'], currentField: null },
      ]
    case 'status-list': case 'timeline':
      return [
        { id: 'name', label: 'Name', fieldType: 'text', accepts: ['string'], currentField: null },
        { id: 'status', label: 'Status', fieldType: 'text', accepts: ['string'], currentField: null },
        { id: 'message', label: 'Message / Desc', fieldType: 'text', accepts: ['string'], currentField: null },
        { id: 'timestamp', label: 'Timestamp', fieldType: 'time', accepts: ['date', 'string'], currentField: null },
      ]
    default:
      return base
  }
}

const genId = () => `fm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export default function DragDropDataMapper({ fields, mappings, onChange, widgetType, sampleData }: Props) {
  const [dragging, setDragging] = useState<FieldInfo | null>(null)
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [magnetActive, setMagnetActive] = useState(false)
  const dropRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const targetSlots = getTargetSlots(widgetType)

  // Populate slots with current mappings
  const slotState = targetSlots.map(slot => ({
    ...slot,
    currentField: mappings.find(m => m.targetField === slot.id)?.sourceField || null,
  }))

  // Auto-map: match field names to slots
  const autoMap = useCallback(() => {
    const patterns: Record<string, RegExp[] > = {
      title: [/name$/i, /title$/i, /label$/i],
      value: [/value$/i, /count$/i, /total$/i, /amount$/i],
      change: [/change$/i, /trend$/i, /diff$/i, /delta$/i],
      target: [/target$/i, /goal$/i, /threshold$/i],
      subtitle: [/desc/i, /subtitle$/i, /detail$/i],
      x: [/time/i, /date/i, /period$/i, /timestamp$/i],
      y: [/value$/i, /count$/i, /metric$/i],
      series: [/series$/i, /group$/i, /category$/i, /type$/i],
      category: [/category$/i, /name$/i, /label$/i, /group$/i],
      name: [/name$/i, /title$/i],
      status: [/status$/i, /state$/i, /result$/i],
      message: [/message$/i, /text$/i, /desc/i],
      timestamp: [/time/i, /date/i, /created/i],
    }
    const newMappings: FieldMapping[] = []
    const usedFields = new Set<string>()
    for (const slot of targetSlots) {
      const pats = patterns[slot.id] || [new RegExp(slot.id, 'i')]
      for (const field of fields) {
        if (usedFields.has(field.path)) continue
        if (!slot.accepts.includes(field.type)) continue
        if (pats.some(p => p.test(field.name))) {
          newMappings.push({ id: genId(), sourceField: field.path, targetField: slot.id, transform: 'none', label: field.name })
          usedFields.add(field.path)
          break
        }
      }
    }
    // Fill table columns sequentially
    if (widgetType === 'data-table') {
      const leafFields = fields.filter(f => f.type !== 'object')
      leafFields.forEach((f, i) => {
        const slotId = `col${i + 1}`
        if (i < 5 && !newMappings.find(m => m.targetField === slotId)) {
          newMappings.push({ id: genId(), sourceField: f.path, targetField: slotId, transform: 'none', label: f.name })
        }
      })
    }
    onChange(newMappings)
  }, [fields, targetSlots, widgetType, onChange])

  // Handle drag start
  const handleDragStart = (field: FieldInfo) => {
    setDragging(field)
  }

  // Handle drag over a drop zone
  const handleDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault()
    if (!dragging) return
    const slot = targetSlots.find(s => s.id === slotId)
    if (slot && slot.accepts.includes(dragging.type)) {
      setHoverZone(slotId)
      setMagnetActive(true)
    }
  }

  const handleDragLeave = () => {
    setHoverZone(null)
    setMagnetActive(false)
  }

  // Handle drop
  const handleDrop = (e: React.DragEvent, slotId: string) => {
    e.preventDefault()
    if (!dragging) return
    const slot = targetSlots.find(s => s.id === slotId)
    if (!slot || !slot.accepts.includes(dragging.type)) return

    const existing = mappings.filter(m => m.targetField !== slotId)
    existing.push({
      id: genId(),
      sourceField: dragging.path,
      targetField: slotId,
      transform: 'none',
      label: dragging.name,
    })
    onChange(existing)
    setDragging(null)
    setHoverZone(null)
    setMagnetActive(false)
  }

  const handleDragEnd = () => {
    setDragging(null)
    setHoverZone(null)
    setMagnetActive(false)
  }

  const removeMapping = (slotId: string) => {
    onChange(mappings.filter(m => m.targetField !== slotId))
  }

  // Get preview value for a slot
  const getPreviewValue = (slotId: string): string => {
    const mapping = mappings.find(m => m.targetField === slotId)
    if (!mapping || !sampleData) return '—'
    const row = Array.isArray(sampleData) ? (sampleData as Record<string, unknown>[])[0] : sampleData as Record<string, unknown>
    if (!row) return '—'
    const parts = mapping.sourceField.split('.')
    let val: unknown = row
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p]
      else return '—'
    }
    if (val === null || val === undefined) return '—'
    return String(val).slice(0, 40)
  }

  const leafFields = fields.filter(f => f.type !== 'object')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Map Fields</h3>
        <div className="flex items-center gap-2">
          <button onClick={autoMap}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200">
            <Sparkles className="w-3 h-3" /> Auto-Map
          </button>
          <button onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-200">
            {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
      </div>

      {/* Two-panel layout: Source fields → Drop Zones */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 min-h-[280px]">

        {/* Left: Source Fields (draggable) */}
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 overflow-y-auto max-h-[400px]">
          <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase">Source Fields</h4>
          <div className="space-y-1">
            {leafFields.map(field => {
              const Icon = TYPE_ICONS[field.type] || Type
              const colors = TYPE_COLORS[field.type] || TYPE_COLORS.string
              const isMapped = mappings.some(m => m.sourceField === field.path)
              return (
                <div key={field.path} draggable
                  onDragStart={() => handleDragStart(field)}
                  onDragEnd={handleDragEnd}
                  className={clsx(
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all',
                    isMapped ? 'opacity-50 border-dashed' : colors,
                    dragging?.path === field.path && 'ring-2 ring-blue-400 scale-[1.02] shadow-md'
                  )}>
                  <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs font-medium truncate">{field.name}</span>
                  <span className="text-[10px] opacity-50 ml-auto">{field.type}</span>
                </div>
              )
            })}
            {leafFields.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Fetch data first to see fields</p>
            )}
          </div>
        </div>

        {/* Center: Arrow connector */}
        <div className="flex items-center">
          <ArrowRight className={clsx(
            'w-6 h-6 transition-colors',
            magnetActive ? 'text-blue-500' : 'text-gray-300'
          )} />
        </div>

        {/* Right: Target Drop Zones */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase">Widget Slots</h4>
          {slotState.map(slot => {
            const isHover = hoverZone === slot.id
            const isCompatible = dragging ? slot.accepts.includes(dragging.type) : false
            const hasField = !!slot.currentField
            return (
              <div key={slot.id} ref={el => { dropRefs.current[slot.id] = el }}
                onDragOver={e => handleDragOver(e, slot.id)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, slot.id)}
                className={clsx(
                  'relative flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed transition-all',
                  // Magnetic effect
                  isHover && isCompatible && 'border-blue-500 bg-blue-50 scale-[1.02] shadow-lg',
                  isHover && !isCompatible && 'border-red-300 bg-red-50',
                  !isHover && hasField && 'border-solid border-green-300 bg-green-50',
                  !isHover && !hasField && dragging ? (isCompatible ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-gray-50/50 opacity-60') : '',
                  !isHover && !hasField && !dragging && 'border-gray-200 bg-white',
                )}>
                {/* Magnetic indicator */}
                {isHover && isCompatible && (
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{slot.label}</div>
                  {hasField ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-medium text-green-700">{slot.currentField}</span>
                      {showPreview && (
                        <span className="text-[10px] text-gray-400 truncate max-w-[100px]">
                          = {getPreviewValue(slot.id)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {dragging ? (isCompatible ? 'Drop here' : 'Incompatible type') : 'Drag a field here'}
                    </div>
                  )}
                </div>

                {hasField && (
                  <button onClick={() => removeMapping(slot.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}

          {/* Add custom slot for tables */}
          {widgetType === 'data-table' && (
            <button onClick={() => {
              const nextId = `col${slotState.length + 1}`
              // Add to parent by creating empty mapping
              onChange([...mappings, { id: genId(), sourceField: '', targetField: nextId, transform: 'none', label: '' }])
            }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg border border-dashed border-blue-200 w-full justify-center">
              <Plus className="w-3 h-3" /> Add Column
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
