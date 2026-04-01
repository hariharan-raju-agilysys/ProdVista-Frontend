import { useState } from 'react'
import {
  X,
  Database,
  Cloud,
  FileJson,
  RefreshCw,
  Settings,
  Zap,
  Filter,
  Save,
  Trash2,
  TestTube
} from 'lucide-react'
import clsx from 'clsx'
import {
  DashboardWidget,
  WidgetDataSourceConfig,
  DATA_SOURCES
} from '../store/dashboardStore'

interface WidgetConfigEditorProps {
  widget: DashboardWidget
  onSave: (widget: DashboardWidget) => void
  onDelete?: (widgetId: string) => void
  onClose: () => void
}

export default function WidgetConfigEditor({
  widget,
  onSave,
  onDelete,
  onClose
}: WidgetConfigEditorProps) {
  const [editedWidget, setEditedWidget] = useState<DashboardWidget>({ ...widget })
  const [activeTab, setActiveTab] = useState<'basic' | 'datasource' | 'processing' | 'display'>('basic')
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const dataSourceConfig = editedWidget.dataSourceConfig || { type: 'none' as const }

  const updateDataSourceConfig = (updates: Partial<WidgetDataSourceConfig>) => {
    setEditedWidget({
      ...editedWidget,
      dataSourceConfig: { ...dataSourceConfig, ...updates }
    })
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    setTestResult(null)

    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      if (dataSourceConfig.type === 'none' || dataSourceConfig.type === 'static') {
        setTestResult({ success: true, message: 'Static data configured successfully' })
      } else if (dataSourceConfig.endpoint) {
        setTestResult({ success: true, message: 'Connection successful! Data source is accessible.' })
      } else {
        setTestResult({ success: false, message: 'Please configure the data source endpoint' })
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Connection failed. Please check your configuration.' })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleSave = () => {
    onSave(editedWidget)
    onClose()
  }

  const tabs = [
    { id: 'basic', label: 'Basic', icon: Settings },
    { id: 'datasource', label: 'Data Source', icon: Database },
    { id: 'processing', label: 'Processing', icon: Filter },
    { id: 'display', label: 'Display', icon: Zap }
  ] as const

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configure Widget</h2>
            <p className="text-sm text-gray-500 mt-1">
              Customize data source and display settings
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Title
                </label>
                <input
                  type="text"
                  value={editedWidget.title}
                  onChange={(e) => setEditedWidget({ ...editedWidget, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter widget title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Type
                </label>
                <select
                  value={editedWidget.type}
                  onChange={(e) => setEditedWidget({ ...editedWidget, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="metric">Metric Card</option>
                  <option value="chart-line">Line Chart</option>
                  <option value="chart-bar">Bar Chart</option>
                  <option value="chart-doughnut">Doughnut Chart</option>
                  <option value="table">Data Table</option>
                  <option value="list">List</option>
                  <option value="status">Status Grid</option>
                  <option value="logs">Log Stream</option>
                  <option value="ai-insights">AI Insights</option>
                  <option value="ai-predictions">AI Predictions</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Key
                </label>
                <input
                  type="text"
                  value={editedWidget.dataKey}
                  onChange={(e) => setEditedWidget({ ...editedWidget, dataKey: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., errorCount, revenue, logs..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Unique identifier for this widget's data
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Width (Grid Units)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={editedWidget.position.w}
                    onChange={(e) => setEditedWidget({
                      ...editedWidget,
                      position: { ...editedWidget.position, w: parseInt(e.target.value) || 4 }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Height (Grid Units)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editedWidget.position.h}
                    onChange={(e) => setEditedWidget({
                      ...editedWidget,
                      position: { ...editedWidget.position, h: parseInt(e.target.value) || 3 }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'datasource' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Data Source Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => updateDataSourceConfig({ type: 'none' })}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      dataSourceConfig.type === 'none'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <FileJson className="w-5 h-5 mb-2 text-gray-600" />
                    <div className="font-medium">None / Default</div>
                    <div className="text-xs text-gray-500">Use built-in data</div>
                  </button>

                  <button
                    onClick={() => updateDataSourceConfig({ type: 'static' })}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      dataSourceConfig.type === 'static'
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <FileJson className="w-5 h-5 mb-2 text-gray-600" />
                    <div className="font-medium">Static Data</div>
                    <div className="text-xs text-gray-500">Enter data manually</div>
                  </button>

                  {DATA_SOURCES.map(source => (
                      <button
                        key={source.type}
                        onClick={() => updateDataSourceConfig({ type: source.type })}
                        className={clsx(
                          'p-4 rounded-lg border-2 text-left transition-all',
                          dataSourceConfig.type === source.type
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <span className="text-2xl mb-2 block">{source.icon}</span>
                        <div className="font-medium">{source.name}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{source.description}</div>
                      </button>
                    ))}
                </div>
              </div>

              {/* Static Data Entry */}
              {dataSourceConfig.type === 'static' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Static Data (JSON)
                  </label>
                  <textarea
                    value={JSON.stringify(dataSourceConfig.staticData || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        updateDataSourceConfig({ staticData: parsed })
                      } catch {
                        // Keep as string if invalid JSON
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm h-40 focus:ring-2 focus:ring-primary-500"
                    placeholder='{ "value": 123, "label": "Example" }'
                  />
                </div>
              )}

              {/* API Configuration */}
              {dataSourceConfig.type === 'custom-api' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800">API Configuration</h4>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                      <select
                        value={dataSourceConfig.method || 'GET'}
                        onChange={(e) => updateDataSourceConfig({ method: e.target.value as 'GET' | 'POST' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Endpoint URL</label>
                      <input
                        type="url"
                        value={dataSourceConfig.endpoint || ''}
                        onChange={(e) => updateDataSourceConfig({ endpoint: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="https://api.example.com/data"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Headers (JSON)</label>
                    <textarea
                      value={JSON.stringify(dataSourceConfig.headers || {}, null, 2)}
                      onChange={(e) => {
                        try {
                          updateDataSourceConfig({ headers: JSON.parse(e.target.value) })
                        } catch {}
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs h-20"
                      placeholder='{ "Authorization": "Bearer token" }'
                    />
                  </div>

                  {dataSourceConfig.method === 'POST' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Request Body (JSON)</label>
                      <textarea
                        value={JSON.stringify(dataSourceConfig.body || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            updateDataSourceConfig({ body: JSON.parse(e.target.value) })
                          } catch {}
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs h-20"
                        placeholder='{ "query": "value" }'
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Azure Configuration */}
              {(dataSourceConfig.type === 'azure-logs') && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 flex items-center gap-2">
                    <Cloud className="w-4 h-4" /> Azure Configuration
                  </h4>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Workspace ID</label>
                    <input
                      type="text"
                      value={dataSourceConfig.workspaceId || ''}
                      onChange={(e) => updateDataSourceConfig({ workspaceId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Log Analytics Workspace ID"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">KQL Query</label>
                    <textarea
                      value={dataSourceConfig.kustoQuery || ''}
                      onChange={(e) => updateDataSourceConfig({ kustoQuery: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs h-32"
                      placeholder="AppRequests | summarize count() by bin(TimeGenerated, 1h)"
                    />
                  </div>
                </div>
              )}

              {/* Database Configuration */}
              {(dataSourceConfig.type === 'elastic' || dataSourceConfig.type === 'splunk') && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800">Query Configuration</h4>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Query</label>
                    <textarea
                      value={dataSourceConfig.query || ''}
                      onChange={(e) => updateDataSourceConfig({ query: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs h-32"
                      placeholder="Enter your query..."
                    />
                  </div>
                </div>
              )}

              {/* Test Connection */}
              {dataSourceConfig.type !== 'none' && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {isTestingConnection ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                    Test Connection
                  </button>

                  {testResult && (
                    <div className={clsx(
                      'flex-1 px-4 py-2 rounded-lg text-sm',
                      testResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    )}>
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'processing' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Field Mappings
                </label>
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Value Field</label>
                    <input
                      type="text"
                      value={dataSourceConfig.fieldMappings?.valueField || ''}
                      onChange={(e) => updateDataSourceConfig({
                        fieldMappings: { ...dataSourceConfig.fieldMappings, valueField: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="e.g., count, value, total"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Label Field</label>
                    <input
                      type="text"
                      value={dataSourceConfig.fieldMappings?.labelField || ''}
                      onChange={(e) => updateDataSourceConfig({
                        fieldMappings: { ...dataSourceConfig.fieldMappings, labelField: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="e.g., name, category, label"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Timestamp Field</label>
                    <input
                      type="text"
                      value={dataSourceConfig.fieldMappings?.timestampField || ''}
                      onChange={(e) => updateDataSourceConfig({
                        fieldMappings: { ...dataSourceConfig.fieldMappings, timestampField: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="e.g., timestamp, created_at"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Group By Field</label>
                    <input
                      type="text"
                      value={dataSourceConfig.fieldMappings?.groupByField || ''}
                      onChange={(e) => updateDataSourceConfig({
                        fieldMappings: { ...dataSourceConfig.fieldMappings, groupByField: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="e.g., service, component"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aggregation
                  </label>
                  <select
                    value={dataSourceConfig.aggregation || 'none'}
                    onChange={(e) => updateDataSourceConfig({ aggregation: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="none">None</option>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="min">Minimum</option>
                    <option value="max">Maximum</option>
                    <option value="count">Count</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Result Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={dataSourceConfig.limit || ''}
                    onChange={(e) => updateDataSourceConfig({ limit: parseInt(e.target.value) || undefined })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="No limit"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort By
                  </label>
                  <input
                    type="text"
                    value={dataSourceConfig.sortBy || ''}
                    onChange={(e) => updateDataSourceConfig({ sortBy: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Field name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort Order
                  </label>
                  <select
                    value={dataSourceConfig.sortOrder || 'desc'}
                    onChange={(e) => updateDataSourceConfig({ sortOrder: e.target.value as 'asc' | 'desc' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Refresh Interval (seconds)
                </label>
                <input
                  type="number"
                  min={0}
                  value={dataSourceConfig.refreshIntervalSeconds || ''}
                  onChange={(e) => updateDataSourceConfig({ refreshIntervalSeconds: parseInt(e.target.value) || undefined })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="0 = No auto-refresh"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set to 0 or leave empty to disable auto-refresh
                </p>
              </div>
            </div>
          )}

          {activeTab === 'display' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Size
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {(['small', 'medium', 'large', 'full'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => setEditedWidget({ ...editedWidget, size })}
                      className={clsx(
                        'px-4 py-3 rounded-lg border-2 capitalize transition-all',
                        editedWidget.size === size
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Configuration (JSON)
                </label>
                <textarea
                  value={JSON.stringify(editedWidget.config || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      setEditedWidget({ ...editedWidget, config: JSON.parse(e.target.value) })
                    } catch {}
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm h-40 focus:ring-2 focus:ring-primary-500"
                  placeholder='{ "theme": "dark", "showLegend": true }'
                />
                <p className="text-xs text-gray-500 mt-1">
                  Custom display options specific to this widget type
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div>
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Delete this widget?')) {
                    onDelete(widget.id)
                    onClose()
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Widget
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
