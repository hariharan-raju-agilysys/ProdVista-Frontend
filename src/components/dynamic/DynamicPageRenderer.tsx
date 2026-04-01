import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Responsive, WidthProvider } from 'react-grid-layout'
import { 
  Plus, Settings, Save, Loader2, AlertCircle, EyeOff
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'
import { useMenuStore, DashboardWidgetDto } from '../../store/menuStore'
import { DynamicWidgetRenderer, WidgetData } from './DynamicWidgetRenderer'
import { AddWidgetModal } from '../AddWidgetModal'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

export function DynamicPageRenderer() {
  const { pageSlug } = useParams<{ pageSlug: string }>()
  const navigate = useNavigate()
  const { isManager } = useAuth()
  const { currentPage, isPageLoading, error, loadPage, addWidget, updateWidget, deleteWidget, updateWidgetPositions } = useMenuStore()
  
  const [isEditMode, setIsEditMode] = useState(false)
  const [showAddWidget, setShowAddWidget] = useState(false)
  const [pendingLayouts, setPendingLayouts] = useState<Record<string, unknown>[] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Load page data
  useEffect(() => {
    if (pageSlug) {
      loadPage(pageSlug)
    }
  }, [pageSlug, loadPage])
  
  // Convert API widget to renderer format
  const toWidgetData = useCallback((widget: DashboardWidgetDto): WidgetData => ({
    id: widget.id,
    widgetType: widget.widgetType,
    title: widget.title,
    subtitle: widget.subtitle,
    gridX: widget.gridX,
    gridY: widget.gridY,
    gridWidth: widget.gridWidth,
    gridHeight: widget.gridHeight,
    dataProviderType: widget.dataProviderType,
    dataProviderConfig: widget.dataProviderConfig,
    widgetConfig: widget.widgetConfig,
    refreshIntervalSeconds: widget.refreshIntervalSeconds,
    isLocked: widget.isLocked,
    cachedData: widget.cachedData,
  }), [])
  
  // Generate grid layouts from widgets
  const generateLayouts = useCallback((widgets: DashboardWidgetDto[]) => {
    const lg = widgets.map(w => ({
      i: w.id,
      x: w.gridX,
      y: w.gridY,
      w: w.gridWidth,
      h: w.gridHeight,
      minW: w.minWidth || 2,
      minH: w.minHeight || 2,
      static: w.isLocked,
    }))
    
    return {
      lg,
      md: lg.map(l => ({ ...l, w: Math.min(l.w, 10), x: l.x % 10 })),
      sm: lg.map(l => ({ ...l, w: Math.min(l.w, 6), x: l.x % 6 })),
      xs: lg.map(l => ({ ...l, w: Math.min(l.w, 4), x: 0 })),
    }
  }, [])
  
  // Handle layout change
  const handleLayoutChange = useCallback((layout: any[], _allLayouts: any) => {
    if (isEditMode && layout.length > 0) {
      setPendingLayouts(layout)
    }
  }, [isEditMode])
  
  // Save layout changes
  const handleSaveLayout = async () => {
    if (!pendingLayouts || !currentPage) return
    
    setIsSaving(true)
    try {
      const positions = pendingLayouts.map((l: any, index: number) => ({
        widgetId: l.i,
        gridX: l.x,
        gridY: l.y,
        gridWidth: l.w,
        gridHeight: l.h,
        displayOrder: index,
      }))
      
      await updateWidgetPositions(currentPage.id, positions)
      setPendingLayouts(null)
    } finally {
      setIsSaving(false)
    }
  }
  
  // Handle widget added via AddWidgetModal
  const handleWidgetAdded = () => {
    setShowAddWidget(false)
    // Reload the page to get the new widget
    if (pageSlug) {
      loadPage(pageSlug)
    }
  }
  
  // Handle widget delete
  const handleDeleteWidget = async (widgetId: string) => {
    if (window.confirm('Delete this widget?')) {
      await deleteWidget(widgetId)
    }
  }
  
  // Handle widget duplicate
  const handleDuplicateWidget = async (widget: WidgetData) => {
    if (!currentPage) return
    
    await addWidget(currentPage.id, {
      widgetType: widget.widgetType,
      title: `${widget.title} (Copy)`,
      subtitle: widget.subtitle,
      gridX: widget.gridX + 1,
      gridY: widget.gridY + 1,
      gridWidth: widget.gridWidth,
      gridHeight: widget.gridHeight,
      dataProviderType: widget.dataProviderType,
      dataProviderConfig: widget.dataProviderConfig,
      widgetConfig: widget.widgetConfig,
      refreshIntervalSeconds: widget.refreshIntervalSeconds,
    })
  }
  
  // Handle widget lock toggle
  const handleToggleLock = async (widgetId: string) => {
    const widget = currentPage?.widgets.find((w: DashboardWidgetDto) => w.id === widgetId)
    if (widget) {
      await updateWidget(widgetId, { isLocked: !widget.isLocked } as any)
    }
  }
  
  // Loading state
  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertCircle className="w-12 h-12 mb-2" />
        <p>{error}</p>
        <button 
          onClick={() => loadPage(pageSlug || '')}
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    )
  }
  
  // No page found
  if (!currentPage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertCircle className="w-12 h-12 mb-2" />
        <p>Page not found</p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
        >
          Go to Dashboard
        </button>
      </div>
    )
  }
  
  const widgets = currentPage.widgets || []
  const layouts = generateLayouts(widgets)
  
  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{currentPage.displayName}</h1>
          {currentPage.description && (
            <p className="text-gray-500 mt-1">{currentPage.description}</p>
          )}
        </div>
        
        {isManager && (
          <div className="flex items-center gap-2">
            {isEditMode && pendingLayouts && (
              <button
                onClick={handleSaveLayout}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Layout
              </button>
            )}
            
            {isEditMode && (
              <button
                onClick={() => setShowAddWidget(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Widget
              </button>
            )}
            
            <button
              onClick={() => { setIsEditMode(!isEditMode); setPendingLayouts(null) }}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg',
                isEditMode 
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              )}
            >
              {isEditMode ? <EyeOff className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
              {isEditMode ? 'Exit Edit' : 'Edit Page'}
            </button>
          </div>
        )}
      </div>
      
      {/* Widgets Grid */}
      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 mb-4">No widgets on this page</p>
          {isManager && (
            <button
              onClick={() => { setIsEditMode(true); setShowAddWidget(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add First Widget
            </button>
          )}
        </div>
      ) : (
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
          rowHeight={80}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".widget-drag-handle"
        >
          {widgets.map((widget: DashboardWidgetDto) => (
            <div key={widget.id} className={clsx(isEditMode && 'widget-drag-handle cursor-move')}>
              <DynamicWidgetRenderer
                widget={toWidgetData(widget)}
                isEditMode={isEditMode}
                onDelete={handleDeleteWidget}
                onDuplicate={handleDuplicateWidget}
                onToggleLock={handleToggleLock}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
      
      {/* Add Widget Modal - Full wizard like Dashboard Builder */}
      {showAddWidget && currentPage && (
        <AddWidgetModal
          pageId={currentPage.id}
          onClose={() => setShowAddWidget(false)}
          onWidgetAdded={handleWidgetAdded}
        />
      )}
    </div>
  )
}

export default DynamicPageRenderer
