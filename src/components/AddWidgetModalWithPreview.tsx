import { useState, useEffect } from 'react'
import { X, Link, FileSpreadsheet, FileText, Database, Globe, Server, LucideIcon, Loader2, CheckCircle, AlertCircle, RefreshCw, Eye, Table, BarChart3, Settings } from 'lucide-react'
import clsx from 'clsx'
import {
  DATA_SOURCE_TYPES,
  AUTH_TYPES,
  LABELS,
  PLACEHOLDERS,
  DATA_SOURCE_OPTIONS,
  AUTH_OPTIONS,
  REFRESH_INTERVALS,
  SIZE_OPTIONS,
  TOTAL_STEPS,
  DataSourceType,
  AuthType,
  WidgetSize,
} from '../constants/widgetModal.constants'
import { ApiEndpointConfig, ApiEndpointConfiguration, ApiTestResult, getDefaultApiConfig } from './ApiEndpointConfig'
import { databaseQueryApi, DatabaseConnection, DatabaseQueryConfig } from '../services/databaseQueryService'
import { DataMappingEditor, DataMappingEntry } from './widget-configs/DataMappingEditor'

// Props interface
interface AddWidgetModalProps {
  onClose: () => void
  onAdd: (widget: WidgetConfig) => void
  widgetTypes: { type: string; label: string }[]
  dataKeys: string[]
}

// Widget configuration interface
export interface WidgetConfig {
  type: string
  title: string
  dataKey: string
  size: WidgetSize
  dataSource: {
    type: DataSourceType
    url?: string
    path?: string
    sheetName?: string
    cellRange?: string
    refreshIntervalSeconds: number
    authType: AuthType
    authCredentials?: string
    // New API endpoint config
    apiConfig?: ApiEndpointConfiguration
    // Database query config
    databaseConnectionId?: string
    databaseQueryConfigId?: string
    sqlQuery?: string
    // Data mappings for transforming response to widget format
    dataMappings?: DataMappingEntry[]
  }
}

// Preview data interface
interface PreviewData {
  success: boolean
  data?: unknown[]
  columns?: string[]
  rowCount?: number
  error?: string
  loadedAt?: Date
}

// Icon map for data sources
const iconMap: Record<string, LucideIcon> = {
  Server,
  Globe,
  Link,
  FileSpreadsheet,
  FileText,
  Database,
}

export function AddWidgetModalAdvanced({ onClose, onAdd, widgetTypes, dataKeys }: AddWidgetModalProps) {
  // Step state
  const [step, setStep] = useState(1)
  
  // Widget configuration state
  const [selectedType, setSelectedType] = useState(widgetTypes[0]?.type ?? '')
  const [title, setTitle] = useState('')
  const [size, setSize] = useState<WidgetSize>('medium')
  
  // Data source state
  const [dataSourceType, setDataSourceType] = useState<DataSourceType>(DATA_SOURCE_TYPES.STATIC)
  const [selectedDataKey, setSelectedDataKey] = useState(dataKeys[0] ?? '')
  const [dataSourceUrl, setDataSourceUrl] = useState('')
  const [dataSourcePath, setDataSourcePath] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [cellRange, setCellRange] = useState('')
  const [refreshInterval, setRefreshInterval] = useState(0)
  const [authType, setAuthType] = useState<AuthType>(AUTH_TYPES.NONE)
  const [authCredentials, setAuthCredentials] = useState('')
  
  // API Endpoint configuration
  const [apiConfig, setApiConfig] = useState<ApiEndpointConfiguration>(getDefaultApiConfig())
  
  // Database Query state
  const [dbConnections, setDbConnections] = useState<DatabaseConnection[]>([])
  const [dbQueryConfigs, setDbQueryConfigs] = useState<DatabaseQueryConfig[]>([])
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [selectedQueryConfigId, setSelectedQueryConfigId] = useState<string>('')
  const [customSqlQuery, setCustomSqlQuery] = useState('')
  const [queryMode, setQueryMode] = useState<'existing' | 'new'>('existing')
  const [isLoadingConnections, setIsLoadingConnections] = useState(false)
  
  // Preview state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  
  // Data mapping state
  const [dataMappings, setDataMappings] = useState<DataMappingEntry[]>([])
  const [rawResponseData, setRawResponseData] = useState<unknown>(null)
  const [, setMappedPreviewData] = useState<unknown>(null)

  // Load database connections when database source is selected
  useEffect(() => {
    if (dataSourceType === DATA_SOURCE_TYPES.DATABASE_QUERY) {
      loadDatabaseConnections()
    }
  }, [dataSourceType])

  // Load query configs when connection is selected
  useEffect(() => {
    if (selectedConnectionId) {
      loadQueryConfigs()
    }
  }, [selectedConnectionId])

  const loadDatabaseConnections = async () => {
    setIsLoadingConnections(true)
    try {
      const connections = await databaseQueryApi.getConnections()
      setDbConnections(connections)
      if (connections.length > 0 && !selectedConnectionId) {
        setSelectedConnectionId(connections[0].id)
      }
    } catch (error) {
      console.error('Failed to load database connections:', error)
    } finally {
      setIsLoadingConnections(false)
    }
  }

  const loadQueryConfigs = async () => {
    try {
      const configs = await databaseQueryApi.getQueryConfigs()
      // Filter by connection if needed
      setDbQueryConfigs(configs.filter(c => c.databaseConnectionId === selectedConnectionId))
    } catch (error) {
      console.error('Failed to load query configs:', error)
    }
  }

  // Test API endpoint
  const handleTestApi = async (config: ApiEndpointConfiguration): Promise<ApiTestResult> => {
    const startTime = Date.now()
    try {
      // Build headers
      const headers: Record<string, string> = {}
      config.headers.filter(h => h.enabled && h.key).forEach(h => {
        headers[h.key] = h.value
      })

      // Add auth headers
      if (config.auth.mode === 'bearer' && config.auth.bearer?.token) {
        headers['Authorization'] = `Bearer ${config.auth.bearer.token}`
      } else if (config.auth.mode === 'basic' && config.auth.basic) {
        const encoded = btoa(`${config.auth.basic.username}:${config.auth.basic.password}`)
        headers['Authorization'] = `Basic ${encoded}`
      } else if (config.auth.mode === 'apikey' && config.auth.apiKey?.addTo === 'header') {
        headers[config.auth.apiKey.key] = config.auth.apiKey.value
      }

      // Build URL with query params
      let url = config.url
      const params = new URLSearchParams()
      config.queryParams.filter(p => p.enabled && p.key).forEach(p => {
        params.append(p.key, p.value)
      })
      if (config.auth.mode === 'apikey' && config.auth.apiKey?.addTo === 'query') {
        params.append(config.auth.apiKey.key, config.auth.apiKey.value)
      }
      if (params.toString()) {
        url += (url.includes('?') ? '&' : '?') + params.toString()
      }

      // Build request options
      const options: RequestInit = {
        method: config.method,
        headers,
      }

      // Add body for non-GET requests
      if (config.method !== 'GET' && config.bodyType !== 'none') {
        if (config.bodyType === 'json') {
          headers['Content-Type'] = 'application/json'
          options.body = config.body
        } else if (config.bodyType === 'form-data') {
          const formData = new FormData()
          config.formData.filter(f => f.enabled && f.key).forEach(f => {
            formData.append(f.key, f.value)
          })
          options.body = formData
        } else if (config.bodyType === 'x-www-form-urlencoded') {
          headers['Content-Type'] = 'application/x-www-form-urlencoded'
          const body = new URLSearchParams()
          config.formData.filter(f => f.enabled && f.key).forEach(f => {
            body.append(f.key, f.value)
          })
          options.body = body.toString()
        } else if (config.bodyType === 'raw') {
          options.body = config.body
        }
      }

      const response = await fetch(url, options)
      const data = await response.json()
      const duration = Date.now() - startTime

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        duration,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      }
    }
  }

  // Load preview data based on data source type
  const loadPreviewData = async () => {
    setIsLoadingPreview(true)
    setPreviewData(null)

    try {
      let result: PreviewData = { success: false }

      switch (dataSourceType) {
        case DATA_SOURCE_TYPES.STATIC:
          // Mock static data preview
          result = {
            success: true,
            data: [{ id: 1, value: 100 }, { id: 2, value: 200 }],
            columns: ['id', 'value'],
            rowCount: 2,
            loadedAt: new Date(),
          }
          break

        case DATA_SOURCE_TYPES.API:
          if (apiConfig.url) {
            const apiResult = await handleTestApi(apiConfig)
            if (apiResult.success && apiResult.data) {
              // Store raw response for data mapping
              setRawResponseData(apiResult.data)
              const extractedData = extractJsonPath(apiResult.data, apiConfig.jsonPath)
              const dataArray = Array.isArray(extractedData) ? extractedData : [extractedData]
              result = {
                success: true,
                data: dataArray.slice(0, 10), // Preview first 10 rows
                columns: dataArray.length > 0 ? Object.keys(dataArray[0] || {}) : [],
                rowCount: dataArray.length,
                loadedAt: new Date(),
              }
            } else {
              result = { success: false, error: apiResult.error || 'Failed to fetch data' }
            }
          }
          break

        case DATA_SOURCE_TYPES.DATABASE_QUERY:
          if (selectedQueryConfigId) {
            try {
              const cached = await databaseQueryApi.getCachedResult(selectedQueryConfigId)
              // Store raw response for data mapping
              setRawResponseData(cached.data)
              result = {
                success: true,
                data: cached.data.slice(0, 10),
                columns: cached.columns.map(c => c.name),
                rowCount: cached.rowCount,
                loadedAt: new Date(cached.generatedAt),
              }
            } catch {
              // Try executing the query
              const execResult = await databaseQueryApi.executeQuery(selectedQueryConfigId)
              if (execResult.success) {
                // Store raw response for data mapping
                setRawResponseData(execResult.data)
                result = {
                  success: true,
                  data: execResult.data.slice(0, 10),
                  columns: execResult.columns.map(c => c.name),
                  rowCount: execResult.rowCount,
                  loadedAt: new Date(),
                }
              } else {
                result = { success: false, error: execResult.error }
              }
            }
          } else {
            result = { success: false, error: 'No query configuration selected' }
          }
          break

        case DATA_SOURCE_TYPES.URL:
          if (dataSourceUrl) {
            try {
              const response = await fetch(dataSourceUrl)
              const data = await response.json()
              // Store raw response for data mapping
              setRawResponseData(data)
              const extractedData = extractJsonPath(data, dataSourcePath)
              const dataArray = Array.isArray(extractedData) ? extractedData : [extractedData]
              result = {
                success: true,
                data: dataArray.slice(0, 10),
                columns: dataArray.length > 0 ? Object.keys(dataArray[0] || {}) : [],
                rowCount: dataArray.length,
                loadedAt: new Date(),
              }
            } catch (error) {
              result = { success: false, error: error instanceof Error ? error.message : 'Failed to fetch' }
            }
          }
          break

        default:
          result = { success: false, error: 'Preview not available for this data source type' }
      }

      setPreviewData(result)
    } catch (error) {
      setPreviewData({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error loading preview',
      })
    } finally {
      setIsLoadingPreview(false)
    }
  }

  // Simple JSON path extraction
  const extractJsonPath = (data: unknown, path?: string): unknown => {
    if (!path) return data
    const parts = path.replace(/^\$\.?/, '').split('.')
    let result: unknown = data
    for (const part of parts) {
      if (result && typeof result === 'object') {
        result = (result as Record<string, unknown>)[part]
      } else {
        break
      }
    }
    return result
  }

  // Handlers
  const handleSubmit = () => {
    const widget: WidgetConfig = {
      type: selectedType,
      title: title || selectedDataKey || 'Untitled Widget',
      dataKey: dataSourceType === DATA_SOURCE_TYPES.STATIC ? selectedDataKey : `custom-${Date.now()}`,
      size,
      dataSource: {
        type: dataSourceType,
        url: dataSourceUrl || undefined,
        path: dataSourcePath || undefined,
        sheetName: sheetName || undefined,
        cellRange: cellRange || undefined,
        refreshIntervalSeconds: refreshInterval,
        authType,
        authCredentials: authCredentials || undefined,
        apiConfig: dataSourceType === DATA_SOURCE_TYPES.API ? apiConfig : undefined,
        databaseConnectionId: dataSourceType === DATA_SOURCE_TYPES.DATABASE_QUERY ? selectedConnectionId : undefined,
        databaseQueryConfigId: dataSourceType === DATA_SOURCE_TYPES.DATABASE_QUERY ? selectedQueryConfigId : undefined,
        sqlQuery: dataSourceType === DATA_SOURCE_TYPES.DATABASE_QUERY && queryMode === 'new' ? customSqlQuery : undefined,
        // Include data mappings if configured
        dataMappings: dataMappings.length > 0 ? dataMappings : undefined,
      }
    }
    onAdd(widget)
    onClose()
  }

  const handleStepNavigation = (direction: 'next' | 'back') => {
    if (direction === 'next' && step < TOTAL_STEPS) {
      setStep(step + 1)
      // Auto-load preview when entering data mapping step (step 3) or preview step (step 4)
      if (step + 1 >= 3 && !previewData?.success) {
        loadPreviewData()
      }
    } else if (direction === 'back' && step > 1) {
      setStep(step - 1)
    } else if (direction === 'back' && step === 1) {
      onClose()
    } else if (direction === 'next' && step === TOTAL_STEPS) {
      handleSubmit()
    }
  }

  const canProceedToNext = (): boolean => {
    switch (step) {
      case 1: return !!selectedType
      case 2: 
        if (dataSourceType === DATA_SOURCE_TYPES.STATIC) return !!selectedDataKey
        if (dataSourceType === DATA_SOURCE_TYPES.API) return !!apiConfig.url
        if (dataSourceType === DATA_SOURCE_TYPES.DATABASE_QUERY) return !!selectedConnectionId && (!!selectedQueryConfigId || !!customSqlQuery)
        if (dataSourceType === DATA_SOURCE_TYPES.URL) return !!dataSourceUrl
        return true
      case 3: return true
      case 4: return true
      default: return true
    }
  }

  // Get step title
  const getStepTitle = (): string => {
    switch (step) {
      case 1: return LABELS.STEP_1_TITLE
      case 2: return LABELS.STEP_2_TITLE
      case 3: return LABELS.STEP_3_TITLE
      case 4: return LABELS.STEP_4_TITLE
      default: return ''
    }
  }

  // Render Step 1: Widget Configuration
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Widget Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{LABELS.WIDGET_TYPE}</label>
        <div className="grid grid-cols-2 gap-3">
          {widgetTypes.map(wt => (
            <button
              key={wt.type}
              onClick={() => setSelectedType(wt.type)}
              className={clsx(
                'p-4 rounded-lg border-2 text-left transition-all',
                selectedType === wt.type 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
              )}
            >
              <span className="font-medium text-gray-700 dark:text-gray-300">{wt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Widget Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS.WIDGET_TITLE}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={PLACEHOLDERS.WIDGET_TITLE}
          className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Widget Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{LABELS.WIDGET_SIZE}</label>
        <div className="flex gap-2">
          {SIZE_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={clsx(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize',
                size === s 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // Render Step 2: Data Source Selection
  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Data Source Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{LABELS.DATA_SOURCE_TYPE}</label>
        <div className="grid grid-cols-2 gap-3">
          {DATA_SOURCE_OPTIONS.map(ds => {
            const Icon = iconMap[ds.iconName]
            return (
              <button
                key={ds.type}
                onClick={() => setDataSourceType(ds.type)}
                className={clsx(
                  'p-4 rounded-lg border-2 text-left transition-all',
                  dataSourceType === ds.type 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <span className="block font-medium text-gray-700 dark:text-gray-300">{ds.label}</span>
                    <span className="text-xs text-gray-500">{ds.description}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Static Data Source */}
      {dataSourceType === DATA_SOURCE_TYPES.STATIC && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS.DATA_KEY}</label>
          <select
            value={selectedDataKey}
            onChange={(e) => setSelectedDataKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
          >
            {dataKeys.map(dk => (
              <option key={dk} value={dk}>{dk}</option>
            ))}
          </select>
        </div>
      )}

      {/* API Endpoint Configuration */}
      {dataSourceType === DATA_SOURCE_TYPES.API && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            API Endpoint Configuration
          </h3>
          <ApiEndpointConfig
            config={apiConfig}
            onChange={setApiConfig}
            onTest={handleTestApi}
          />
        </div>
      )}

      {/* Database Query Configuration */}
      {dataSourceType === DATA_SOURCE_TYPES.DATABASE_QUERY && (
        <div className="space-y-4">
          {isLoadingConnections ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Loading connections...</span>
            </div>
          ) : dbConnections.length === 0 ? (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-yellow-700 dark:text-yellow-300">
              <AlertCircle className="w-5 h-5 inline mr-2" />
              {LABELS.NO_CONNECTIONS}. Please create a database connection first.
            </div>
          ) : (
            <>
              {/* Connection Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {LABELS.DATABASE_CONNECTION}
                </label>
                <select
                  value={selectedConnectionId}
                  onChange={(e) => setSelectedConnectionId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">{LABELS.SELECT_CONNECTION}</option>
                  {dbConnections.map(conn => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name} ({conn.databaseType})
                    </option>
                  ))}
                </select>
              </div>

              {/* Query Mode Toggle */}
              <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => setQueryMode('existing')}
                  className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                    queryMode === 'existing'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {LABELS.USE_EXISTING_QUERY}
                </button>
                <button
                  type="button"
                  onClick={() => setQueryMode('new')}
                  className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                    queryMode === 'new'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {LABELS.CREATE_NEW_QUERY}
                </button>
              </div>

              {/* Existing Query Selection */}
              {queryMode === 'existing' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {LABELS.QUERY_CONFIG}
                  </label>
                  {dbQueryConfigs.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">{LABELS.NO_QUERIES}</p>
                  ) : (
                    <select
                      value={selectedQueryConfigId}
                      onChange={(e) => setSelectedQueryConfigId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="">{LABELS.SELECT_QUERY}</option>
                      {dbQueryConfigs.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.name} {q.description ? `- ${q.description}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* New Query Input */}
              {queryMode === 'new' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {LABELS.SQL_QUERY}
                  </label>
                  <textarea
                    value={customSqlQuery}
                    onChange={(e) => setCustomSqlQuery(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
                    placeholder="SELECT column1, column2 FROM table WHERE condition..."
                  />
                  <p className="text-xs text-gray-500 mt-1">{LABELS.SQL_QUERY_HINT}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* URL (JSON) */}
      {dataSourceType === DATA_SOURCE_TYPES.URL && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS.JSON_URL}</label>
            <input
              type="url"
              value={dataSourceUrl}
              onChange={(e) => setDataSourceUrl(e.target.value)}
              placeholder={PLACEHOLDERS.API_URL}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS.JSON_PATH}</label>
            <input
              type="text"
              value={dataSourcePath}
              onChange={(e) => setDataSourcePath(e.target.value)}
              placeholder={PLACEHOLDERS.JSON_PATH}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">{LABELS.JSON_PATH_HINT}</p>
          </div>
        </>
      )}

      {/* Excel */}
      {dataSourceType === DATA_SOURCE_TYPES.EXCEL && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS.EXCEL_FILE_URL}</label>
            <input
              type="url"
              value={dataSourceUrl}
              onChange={(e) => setDataSourceUrl(e.target.value)}
              placeholder={PLACEHOLDERS.EXCEL_URL}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS.SHEET_NAME}</label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder={PLACEHOLDERS.SHEET_NAME}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS.CELL_RANGE}</label>
              <input
                type="text"
                value={cellRange}
                onChange={(e) => setCellRange(e.target.value)}
                placeholder={PLACEHOLDERS.CELL_RANGE}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )

  // Render Step 3: Settings & Data Mapping
  const renderStep3 = () => (
    <div className="space-y-6">
      {dataSourceType !== DATA_SOURCE_TYPES.STATIC && (
        <>
          {/* Auto Refresh */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS.AUTO_REFRESH}</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
            >
              {REFRESH_INTERVALS.map(ri => (
                <option key={ri.value} value={ri.value}>{ri.label}</option>
              ))}
            </select>
          </div>

          {/* Authentication for non-API sources */}
          {dataSourceType !== DATA_SOURCE_TYPES.API && dataSourceType !== DATA_SOURCE_TYPES.DATABASE_QUERY && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{LABELS.AUTHENTICATION}</label>
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as AuthType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                >
                  {AUTH_OPTIONS.map(at => (
                    <option key={at.value} value={at.value}>{at.label}</option>
                  ))}
                </select>
              </div>

              {authType !== AUTH_TYPES.NONE && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {authType === AUTH_TYPES.BEARER ? LABELS.BEARER_TOKEN : 
                     authType === AUTH_TYPES.API_KEY ? LABELS.API_KEY_LABEL : 
                     LABELS.BASIC_AUTH}
                  </label>
                  <input
                    type="password"
                    value={authCredentials}
                    onChange={(e) => setAuthCredentials(e.target.value)}
                    placeholder={PLACEHOLDERS.CREDENTIALS}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Data Mapping Section - for non-static data sources */}
      {dataSourceType !== DATA_SOURCE_TYPES.STATIC && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-gray-500" />
            <h3 className="font-medium text-gray-700 dark:text-gray-300">Data Field Mapping</h3>
          </div>
          
          {/* Load data button if no data yet */}
          {!rawResponseData && !isLoadingPreview ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-500 mb-4">Load data from your source to configure field mappings</p>
              <button
                type="button"
                onClick={loadPreviewData}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Load Data
              </button>
            </div>
          ) : null}
          
          {/* Loading indicator */}
          {isLoadingPreview && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Loading data...</span>
            </div>
          )}
          
          {/* Data Mapping Editor */}
          {!!rawResponseData && !isLoadingPreview && (
            <DataMappingEditor
              widgetType={selectedType}
              responseData={rawResponseData}
              mappings={dataMappings}
              onChange={setDataMappings}
              onPreviewMapped={setMappedPreviewData}
            />
          )}
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">{LABELS.SUMMARY_TITLE}</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">{LABELS.SUMMARY_TYPE}</dt>
            <dd className="font-medium text-gray-700 dark:text-gray-300">
              {widgetTypes.find(w => w.type === selectedType)?.label}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{LABELS.SUMMARY_TITLE_LABEL}</dt>
            <dd className="font-medium text-gray-700 dark:text-gray-300">{title || selectedDataKey || LABELS.UNTITLED}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{LABELS.SUMMARY_SIZE}</dt>
            <dd className="font-medium text-gray-700 dark:text-gray-300 capitalize">{size}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{LABELS.SUMMARY_DATA_SOURCE}</dt>
            <dd className="font-medium text-gray-700 dark:text-gray-300">
              {DATA_SOURCE_OPTIONS.find(d => d.type === dataSourceType)?.label}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )

  // Render Step 4: Preview & Confirm
  const renderStep4 = () => (
    <div className="space-y-6">
      {/* Preview Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          {LABELS.PREVIEW_TITLE}
        </h3>
        <button
          type="button"
          onClick={loadPreviewData}
          disabled={isLoadingPreview}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {isLoadingPreview ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </button>
      </div>

      {/* Preview Content */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
        {isLoadingPreview ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-500">{LABELS.PREVIEW_LOADING}</span>
          </div>
        ) : previewData ? (
          previewData.success ? (
            <div>
              {/* Success Header */}
              <div className="bg-green-50 dark:bg-green-900/30 px-4 py-2 border-b border-green-200 dark:border-green-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">{LABELS.PREVIEW_SUCCESS}</span>
                </div>
                <span className="text-xs text-green-600">
                  {previewData.rowCount} {LABELS.PREVIEW_ROWS} × {previewData.columns?.length} {LABELS.PREVIEW_COLUMNS}
                </span>
              </div>

              {/* Data Table */}
              {previewData.data && previewData.data.length > 0 ? (
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                      <tr>
                        {previewData.columns?.map((col, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {previewData.data.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          {previewData.columns?.map((col, j) => (
                            <td key={j} className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {String((row as Record<string, unknown>)[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">{LABELS.PREVIEW_NO_DATA}</div>
              )}

              {/* Preview Footer */}
              {previewData.rowCount && previewData.rowCount > 10 && (
                <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 text-xs text-gray-500 text-center">
                  Showing first 10 of {previewData.rowCount} rows
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-600 dark:text-red-400 font-medium">{LABELS.PREVIEW_ERROR}</p>
              <p className="text-sm text-gray-500 mt-1">{previewData.error}</p>
              <button
                type="button"
                onClick={loadPreviewData}
                className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700"
              >
                {LABELS.RETRY_PREVIEW}
              </button>
            </div>
          )
        ) : (
          <div className="py-12 text-center text-gray-500">
            <Table className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Click "Refresh" to load preview data</p>
          </div>
        )}
      </div>

      {/* Widget Preview Card */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Widget Preview
        </h4>
        <div className={clsx(
          'border border-dashed border-gray-300 dark:border-gray-500 rounded-lg p-4 bg-white dark:bg-gray-800',
          size === 'small' && 'h-24',
          size === 'medium' && 'h-32',
          size === 'large' && 'h-48',
          size === 'full' && 'h-64',
        )}>
          <div className="text-center text-gray-400 h-full flex items-center justify-center">
            <div>
              <p className="font-medium">{title || 'Widget Title'}</p>
              <p className="text-xs mt-1">
                {widgetTypes.find(w => w.type === selectedType)?.label} • {size}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Render Step Indicator
  const renderStepIndicator = () => (
    <div className="mb-6">
      <div className="flex items-center justify-center">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(s => (
          <div key={s} className="flex items-center">
            <button
              onClick={() => s <= step && setStep(s)}
              disabled={s > step}
              className={clsx(
                'w-8 h-8 rounded-full text-sm font-medium transition-colors',
                step === s && 'bg-blue-600 text-white',
                step > s && 'bg-green-500 text-white cursor-pointer',
                step < s && 'bg-gray-200 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
              )}
            >
              {step > s ? '✓' : s}
            </button>
            {s < TOTAL_STEPS && (
              <div className={clsx(
                'w-12 h-1 mx-1',
                step > s ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'
              )} />
            )}
          </div>
        ))}
      </div>
      <div className="text-center mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        {getStepTitle()}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{LABELS.MODAL_TITLE}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4">
          {renderStepIndicator()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleStepNavigation('back')}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            {step === 1 ? LABELS.CANCEL : LABELS.BACK}
          </button>
          <button
            onClick={() => handleStepNavigation('next')}
            disabled={!canProceedToNext()}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {step < TOTAL_STEPS ? LABELS.NEXT : LABELS.ADD_WIDGET}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddWidgetModalAdvanced
