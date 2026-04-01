import { useState, useEffect, useCallback, useRef } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { 
  Settings, Plus, Trash2, Edit2, Lock, Unlock, RefreshCw, 
  GripVertical, Save, Database, Zap, Play, Sparkles,
  Maximize2, X, Timer, Download, Upload, Wand2, History, RotateCcw
} from 'lucide-react';
import { ConfigDrivenDashboard } from './ConfigDrivenDashboard';
import clsx from 'clsx';
import { 
  DashboardPageDetail, 
  DashboardWidget, 
  DashboardVersion,
  WidgetPositionUpdate,
  getDashboardPage, 
  updateWidgetPositions, 
  deleteWidget,
  updateWidget,
  fetchWidgetData,
  testWidgetSignalR,
  startWidgetTestStream,
  exportDashboard,
  importDashboard,
  getVersionHistory,
  rollbackToVersion,
} from '../services/dynamicDashboardService';
import { WidgetRenderer } from './widgets/WidgetRenderer';
import { AddWidgetModal } from './AddWidgetModal';
import { WidgetTemplateGallery } from './WidgetTemplateGallery';
import { EditWidgetModal } from './EditWidgetModal';
import WidgetConfigWizard from './widget-wizard/WidgetConfigWizard';
import { useAuth } from '../context/AuthContext';
import { useWidgetHub, WidgetDataUpdate } from '../hooks/useWidgetHub';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DynamicDashboardRendererProps {
  pageSlug: string;
  onPageConfig?: () => void;
  isEditMode?: boolean;
}

export function DynamicDashboardRenderer({ 
  pageSlug, 
  onPageConfig,
  isEditMode: propEditMode 
}: DynamicDashboardRendererProps) {
  const { isManager } = useAuth();
  const [page, setPage] = useState<DashboardPageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only allow edit mode for managers
  const [isEditMode, setIsEditMode] = useState(propEditMode ?? false);
  const canEdit = isManager; // Only managers can edit
  const [layouts, setLayouts] = useState<{ [key: string]: Layout[] }>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [wizardWidget, setWizardWidget] = useState<DashboardWidget | null | 'new'>(null);
  const [widgetData, setWidgetData] = useState<Record<string, unknown>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [testingSignalR, setTestingSignalR] = useState<Record<string, boolean>>({});
  const [streamingWidgets, setStreamingWidgets] = useState<Set<string>>(new Set());
  const [fullscreenWidget, setFullscreenWidget] = useState<DashboardWidget | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'ai'>('grid');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<DashboardVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // SignalR connection for real-time updates
  const handleWidgetUpdate = useCallback((update: WidgetDataUpdate) => {
    console.log('SignalR Widget Update:', update);
    setWidgetData(prev => ({
      ...prev,
      [update.widgetId]: update.data
    }));
  }, []);

  const { isConnected: signalRConnected, subscribeToWidget } = useWidgetHub({
    onWidgetUpdate: handleWidgetUpdate,
    onConnectionChange: (connected) => {
      console.log('SignalR connection status:', connected);
    }
  });

  // Test SignalR for a widget
  const handleTestSignalR = async (widgetId: string) => {
    setTestingSignalR(prev => ({ ...prev, [widgetId]: true }));
    try {
      // Subscribe to this widget's updates
      await subscribeToWidget(widgetId);
      // Trigger test data from backend
      const response = await testWidgetSignalR(widgetId);
      console.log('Test SignalR response:', response.data);
    } catch (err) {
      console.error('Failed to test SignalR:', err);
    } finally {
      setTestingSignalR(prev => ({ ...prev, [widgetId]: false }));
    }
  };

  // Start continuous test stream
  const handleStartTestStream = async (widgetId: string) => {
    try {
      // Subscribe to widget updates
      await subscribeToWidget(widgetId);
      // Start streaming
      await startWidgetTestStream(widgetId, 2000, 30);
      setStreamingWidgets(prev => new Set(prev).add(widgetId));
      // Auto-remove after duration
      setTimeout(() => {
        setStreamingWidgets(prev => {
          const newSet = new Set(prev);
          newSet.delete(widgetId);
          return newSet;
        });
      }, 30000);
    } catch (err) {
      console.error('Failed to start test stream:', err);
    }
  };

  // Fetch page data
  const fetchPage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getDashboardPage(pageSlug);
      setPage(response.data);
      
      // Initialize layouts from widgets
      const initialLayouts = generateLayoutsFromWidgets(response.data.widgets);
      setLayouts(initialLayouts);
      
      // Initialize widget data from cached data
      const initialData: Record<string, unknown> = {};
      response.data.widgets.forEach(widget => {
        if (widget.cachedData) {
          initialData[widget.id] = widget.cachedData;
        }
      });
      setWidgetData(initialData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [pageSlug]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // Auto-refresh widgets that have refreshIntervalSeconds > 0
  const refreshIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  useEffect(() => {
    const intervals = refreshIntervalsRef.current;
    // Clear old intervals
    intervals.forEach((iv) => clearInterval(iv));
    intervals.clear();

    if (!page || isEditMode) return;

    page.widgets.forEach(widget => {
      if (widget.refreshIntervalSeconds > 0) {
        const iv = setInterval(() => {
          handleRefreshWidget(widget.id);
        }, widget.refreshIntervalSeconds * 1000);
        intervals.set(widget.id, iv);
      }
    });

    return () => {
      intervals.forEach((iv) => clearInterval(iv));
      intervals.clear();
    };
  }, [page?.widgets, isEditMode]);

  // Generate react-grid-layout layouts from widgets
  const generateLayoutsFromWidgets = (widgets: DashboardWidget[]): { [key: string]: Layout[] } => {
    const lg = widgets.map(w => ({
      i: w.id,
      x: w.gridX,
      y: w.gridY,
      w: w.gridWidth,
      h: w.gridHeight,
      minW: w.minWidth,
      minH: w.minHeight,
      static: w.isLocked,
    }));
    
    return {
      lg,
      md: lg.map(l => ({ ...l, w: Math.min(l.w, 10) })),
      sm: lg.map(l => ({ ...l, w: Math.min(l.w, 6), x: l.x % 6 })),
      xs: lg.map(l => ({ ...l, w: Math.min(l.w, 4), x: 0 })),
    };
  };

  // Handle layout changes
  const handleLayoutChange = (_currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    if (!isEditMode || !canEdit) return;
    setLayouts(allLayouts);
    setIsDirty(true);
  };

  // Save layout changes
  const saveLayoutChanges = async () => {
    if (!page || !isDirty) return;
    
    const positions: WidgetPositionUpdate[] = layouts.lg.map((l, index) => ({
      widgetId: l.i,
      gridX: l.x,
      gridY: l.y,
      gridWidth: l.w,
      gridHeight: l.h,
      displayOrder: index,
    }));

    try {
      await updateWidgetPositions(page.id, positions);
      setIsDirty(false);
      // Refresh page to get updated data
      await fetchPage();
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  };

  // Delete a widget
  const handleDeleteWidget = async (widgetId: string) => {
    if (!confirm('Are you sure you want to delete this widget?')) return;
    
    try {
      await deleteWidget(widgetId);
      await fetchPage();
    } catch (err) {
      console.error('Failed to delete widget:', err);
    }
  };

  // Toggle widget lock
  const handleToggleLock = async (widget: DashboardWidget) => {
    try {
      await updateWidget(widget.id, { isLocked: !widget.isLocked });
      await fetchPage();
    } catch (err) {
      console.error('Failed to toggle lock:', err);
    }
  };

  // Refresh widget data
  const handleRefreshWidget = async (widgetId: string) => {
    setRefreshing(prev => ({ ...prev, [widgetId]: true }));
    try {
      const response = await fetchWidgetData(widgetId);
      setWidgetData(prev => ({ ...prev, [widgetId]: response.data }));
    } catch (err) {
      console.error('Failed to refresh widget:', err);
    } finally {
      setRefreshing(prev => ({ ...prev, [widgetId]: false }));
    }
  };

  // Handle widget added
  const handleWidgetAdded = () => {
    setShowAddWidget(false);
    fetchPage();
  };

  // Handle widget edited
  const handleWidgetEdited = () => {
    setEditingWidget(null);
    fetchPage();
  };

  // Load version history
  const loadVersions = async () => {
    setLoadingVersions(true);
    try {
      const res = await getVersionHistory(pageSlug);
      setVersions(res.data);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Rollback to a previous version
  const handleRollback = async (versionId: string, versionNumber: number) => {
    if (!confirm(`Rollback to version ${versionNumber}? Current dashboard will be saved as a snapshot first.`)) return;
    setRollingBack(true);
    try {
      await rollbackToVersion(pageSlug, versionId);
      setShowVersionHistory(false);
      await fetchPage();
    } catch (err) {
      console.error('Failed to rollback:', err);
    } finally {
      setRollingBack(false);
    }
  };

  // Export dashboard to JSON file
  const handleExport = async () => {
    try {
      const response = await exportDashboard(pageSlug);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-${pageSlug}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export dashboard:', err);
    }
  };

  // Import dashboard from JSON file
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.widgets || !Array.isArray(data.widgets)) {
          alert('Invalid dashboard file format');
          return;
        }
        if (!confirm(`Import ${data.widgets.length} widgets? This will replace existing widgets.`)) return;
        await importDashboard(pageSlug, { replaceExisting: true, widgets: data.widgets });
        fetchPage();
      } catch (err) {
        console.error('Failed to import dashboard:', err);
        alert('Failed to import dashboard. Check file format.');
      }
    };
    input.click();
  };

  // Get widget data with proper fallback for Static providers
  const getWidgetData = (widget: DashboardWidget): unknown => {
    // First check if we have refreshed/fetched data
    if (widgetData[widget.id] !== undefined) {
      return widgetData[widget.id];
    }
    
    // Then check cached data from backend
    if (widget.cachedData !== undefined && widget.cachedData !== null) {
      return widget.cachedData;
    }
    
    // For Static providers, extract data from dataProviderConfig
    if (widget.dataProviderType === 'Static' && widget.dataProviderConfig) {
      const config = widget.dataProviderConfig as Record<string, unknown>;
      // Check for staticData key (new format from EditWidgetModal)
      if (config.staticData !== undefined) {
        return config.staticData;
      }
      // Check for data key
      if (config.data !== undefined) {
        return config.data;
      }
      // For seeded widgets, the config itself might be the data (check for common data properties)
      if (config.value !== undefined || config.labels !== undefined || config.items !== undefined || config.datasets !== undefined) {
        return config;
      }
    }
    
    return undefined;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <p className="text-lg font-medium">Error loading dashboard</p>
        <p className="text-sm text-gray-500">{error}</p>
        <button 
          onClick={fetchPage}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-lg font-medium text-gray-500">Dashboard not found</p>
      </div>
    );
  }

  // Not configured - show setup prompt
  if (!page.isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
        <Settings className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">
          Dashboard Not Configured
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center max-w-md">
          This dashboard page needs to be configured. Select a template or add widgets manually.
        </p>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowTemplateGallery(true)}
            className="px-6 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-lg hover:from-violet-500 hover:to-cyan-500 transition-all flex items-center gap-2 shadow-lg shadow-violet-500/20"
          >
            <Sparkles className="w-4 h-4" />
            Template Gallery
          </button>
          <button 
            onClick={onPageConfig}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Configure Dashboard
          </button>
        </div>
        {showTemplateGallery && (
          <WidgetTemplateGallery
            pageSlug={pageSlug}
            onClose={() => setShowTemplateGallery(false)}
            onTemplatesApplied={() => { setShowTemplateGallery(false); fetchPage(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {page.displayName}
          </h2>
          {page.description && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              — {page.description}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* SignalR Connection Status */}
          <div 
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
              signalRConnected 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            )}
            title={signalRConnected ? 'SignalR Connected' : 'SignalR Disconnected'}
          >
            <Zap className={clsx('w-3 h-3', signalRConnected && 'animate-pulse')} />
            {signalRConnected ? 'Live' : 'Offline'}
          </div>
          
          {/* Only show edit controls for managers */}
          {canEdit && isEditMode && isDirty && (
            <button
              onClick={saveLayoutChanges}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          )}
          
          {canEdit && isEditMode && (
            <>
              <button
                onClick={() => setShowTemplateGallery(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-lg hover:from-violet-500 hover:to-cyan-500 text-sm shadow-lg shadow-violet-500/20"
              >
                <Sparkles className="w-4 h-4" />
                Template Gallery
              </button>
              <button
                onClick={() => setShowAddWidget(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Widget
              </button>
              <button
                onClick={() => setWizardWidget('new')}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-500 hover:to-purple-500 text-sm shadow-lg shadow-blue-500/20"
              >
                <Wand2 className="w-4 h-4" />
                Widget Wizard
              </button>
            </>
          )}
          
          {/* Only show edit toggle for managers */}
          {canEdit && (
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
              isEditMode 
                ? 'bg-gray-600 text-white hover:bg-gray-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
            )}
          >
            <Edit2 className="w-4 h-4" />
            {isEditMode ? 'Done Editing' : 'Edit'}
          </button>
          )}
          
          {/* AI Build Mode Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'ai' ? 'grid' : 'ai')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              viewMode === 'ai'
                ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
            )}
            title="AI Dashboard Builder"
          >
            <Wand2 className="w-4 h-4" />
            {viewMode === 'ai' ? 'AI Mode' : 'AI Build'}
          </button>

          <button
            onClick={fetchPage}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
            title="Refresh Dashboard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Export/Import/History buttons */}
          {canEdit && (
            <>
              <button
                onClick={handleExport}
                className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                title="Export Dashboard"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleImport}
                className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                title="Import Dashboard"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowVersionHistory(true); loadVersions(); }}
                className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                title="Version History"
              >
                <History className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* AI-Driven Mode */}
      {viewMode === 'ai' && (
        <ConfigDrivenDashboard 
          pageSlug={pageSlug} 
          onApplied={() => { setViewMode('grid'); fetchPage(); }}
        />
      )}

      {/* Standard Grid Layout */}
      {viewMode === 'grid' && (
      <>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: page.gridColumns, md: 10, sm: 6, xs: 4 }}
        rowHeight={80}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditMode && canEdit}
        isResizable={isEditMode && canEdit}
        draggableHandle=".drag-handle"
        margin={[16, 16]}
      >
        {page.widgets.map(widget => (
          <div 
            key={widget.id} 
            className={clsx(
              'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden',
              isEditMode && canEdit && 'ring-2 ring-blue-200 dark:ring-blue-800'
            )}
          >
            {/* Widget Header */}
            <div className={clsx(
              'flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700',
              isEditMode && canEdit && 'bg-gray-50 dark:bg-gray-750'
            )}>
              <div className="flex items-center gap-2 min-w-0">
                {isEditMode && canEdit && (
                  <div className="drag-handle cursor-move p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {widget.title}
                  </h3>
                  {widget.subtitle && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {widget.subtitle}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {refreshing[widget.id] && (
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                )}
                
                {/* Auto-refresh countdown */}
                {!isEditMode && widget.refreshIntervalSeconds > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 tabular-nums" title={`Auto-refresh every ${widget.refreshIntervalSeconds}s`}>
                    <Timer className="w-2.5 h-2.5" />
                    {widget.refreshIntervalSeconds}s
                  </span>
                )}
                
                {!isEditMode && widget.refreshIntervalSeconds > 0 && (
                  <button
                    onClick={() => handleRefreshWidget(widget.id)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Refresh"
                  >
                    <RefreshCw className="w-3 h-3 text-gray-400" />
                  </button>
                )}

                {/* Fullscreen button (non-edit mode) */}
                {!isEditMode && (
                  <button
                    onClick={() => setFullscreenWidget(widget)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                )}
                
                {/* Widget edit controls - only for managers in edit mode */}
                {isEditMode && canEdit && (
                  <>
                    <button
                      onClick={() => handleToggleLock(widget)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title={widget.isLocked ? 'Unlock' : 'Lock'}
                    >
                      {widget.isLocked ? (
                        <Lock className="w-3 h-3 text-amber-500" />
                      ) : (
                        <Unlock className="w-3 h-3 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingWidget(widget)}
                      className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-500"
                      title="Edit Data Provider"
                    >
                      <Database className="w-3 h-3" />
                    </button>
                    {/* SignalR Test Buttons */}
                    <button
                      onClick={() => handleTestSignalR(widget.id)}
                      disabled={testingSignalR[widget.id]}
                      className={clsx(
                        'p-1 rounded',
                        testingSignalR[widget.id] 
                          ? 'bg-yellow-100 text-yellow-600' 
                          : 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-500'
                      )}
                      title="Test SignalR (single update)"
                    >
                      <Zap className={clsx('w-3 h-3', testingSignalR[widget.id] && 'animate-pulse')} />
                    </button>
                    <button
                      onClick={() => handleStartTestStream(widget.id)}
                      disabled={streamingWidgets.has(widget.id)}
                      className={clsx(
                        'p-1 rounded',
                        streamingWidgets.has(widget.id) 
                          ? 'bg-green-100 text-green-600' 
                          : 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-500'
                      )}
                      title={streamingWidgets.has(widget.id) ? 'Streaming (30s)...' : 'Start Test Stream (30s)'}
                    >
                      <Play className={clsx('w-3 h-3', streamingWidgets.has(widget.id) && 'animate-pulse')} />
                    </button>
                    <button
                      onClick={() => handleDeleteWidget(widget.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Widget Content */}
            <div className="p-3 h-[calc(100%-44px)] overflow-auto">
              {refreshing[widget.id] ? (
                <div className="animate-pulse space-y-3 h-full">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </div>
              ) : (
                <WidgetRenderer 
                  widget={widget} 
                  data={getWidgetData(widget)}
                  isLoading={refreshing[widget.id]}
                />
              )}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>

      {/* Empty State */}
      {page.widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <Sparkles className="w-12 h-12 text-violet-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">No widgets yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Choose from 55+ pre-built templates or create your own</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTemplateGallery(true)}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-lg hover:from-violet-500 hover:to-cyan-500 flex items-center gap-2 shadow-lg shadow-violet-500/20"
            >
              <Sparkles className="w-4 h-4" />
              Template Gallery
            </button>
            <button
              onClick={() => setShowAddWidget(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Widget Manually
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {/* Fullscreen Widget Modal */}
      {fullscreenWidget && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-6xl h-[85vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
            {/* Fullscreen header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{fullscreenWidget.title}</h2>
                {fullscreenWidget.subtitle && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{fullscreenWidget.subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRefreshWidget(fullscreenWidget.id)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                  title="Refresh"
                >
                  <RefreshCw className={clsx('w-4 h-4', refreshing[fullscreenWidget.id] && 'animate-spin')} />
                </button>
                <button
                  onClick={() => setFullscreenWidget(null)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Fullscreen content */}
            <div className="flex-1 p-6 overflow-auto">
              <WidgetRenderer 
                widget={fullscreenWidget} 
                data={getWidgetData(fullscreenWidget)}
                isLoading={refreshing[fullscreenWidget.id]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Widget Modal */}
      {showAddWidget && page && (
        <AddWidgetModal
          pageId={page.id}
          onClose={() => setShowAddWidget(false)}
          onWidgetAdded={handleWidgetAdded}
        />
      )}

      {/* Template Gallery Modal */}
      {showTemplateGallery && page && (
        <WidgetTemplateGallery
          pageSlug={pageSlug}
          onClose={() => setShowTemplateGallery(false)}
          onTemplatesApplied={() => { setShowTemplateGallery(false); fetchPage(); }}
        />
      )}

      {/* Edit Widget Modal */}
      {editingWidget && (
        <EditWidgetModal
          widget={editingWidget}
          onClose={() => setEditingWidget(null)}
          onSaved={handleWidgetEdited}
        />
      )}

      {/* Widget Config Wizard */}
      {wizardWidget && page && (
        <WidgetConfigWizard
          widget={wizardWidget === 'new' ? undefined : wizardWidget}
          pageId={page.id}
          onClose={() => setWizardWidget(null)}
          onSaved={() => { setWizardWidget(null); fetchPage(); }}
        />
      )}

      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <History className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Version History</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Rollback to any previous dashboard state</p>
                </div>
              </div>
              <button onClick={() => setShowVersionHistory(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-violet-500" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No versions yet</p>
                  <p className="text-xs opacity-70">Versions are created automatically when you apply templates or build with AI</p>
                </div>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:border-violet-300 dark:hover:border-violet-600 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-bold">
                          {v.versionNumber}
                        </span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {v.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 ml-8">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {v.widgetCount} widget{v.widgetCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {new Date(v.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRollback(v.id, v.versionNumber)}
                      disabled={rollingBack}
                      className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      <RotateCcw className={clsx('w-3 h-3', rollingBack && 'animate-spin')} />
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DynamicDashboardRenderer;
