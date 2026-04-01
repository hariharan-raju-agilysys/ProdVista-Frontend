import { useState } from 'react'
import { X, Link, FileSpreadsheet, FileText, Database, Globe, Server, LucideIcon } from 'lucide-react'
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
  }
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

  // Handlers
  const handleSubmit = () => {
    const widget: WidgetConfig = {
      type: selectedType,
      title: title || selectedDataKey,
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
      }
    }
    onAdd(widget)
    onClose()
  }

  const handleStepNavigation = (direction: 'next' | 'back') => {
    if (direction === 'next' && step < TOTAL_STEPS) {
      setStep(step + 1)
    } else if (direction === 'back' && step > 1) {
      setStep(step - 1)
    } else if (direction === 'back' && step === 1) {
      onClose()
    } else if (direction === 'next' && step === TOTAL_STEPS) {
      handleSubmit()
    }
  }

  // Get auth label based on type
  const getAuthLabel = (): string => {
    switch (authType) {
      case AUTH_TYPES.BEARER: return LABELS.BEARER_TOKEN
      case AUTH_TYPES.API_KEY: return LABELS.API_KEY_LABEL
      case AUTH_TYPES.BASIC: return LABELS.BASIC_AUTH
      default: return ''
    }
  }

  // Get step title
  const getStepTitle = (): string => {
    switch (step) {
      case 1: return LABELS.STEP_1_TITLE
      case 2: return LABELS.STEP_2_TITLE
      case 3: return LABELS.STEP_3_TITLE
      default: return ''
    }
  }

  // Render Step 1: Widget Configuration
  const renderStep1 = () => (
    <div className="form-group">
      {/* Widget Type Selection */}
      <div>
        <label className="form-label">{LABELS.WIDGET_TYPE}</label>
        <div className="grid-2-cols">
          {widgetTypes.map(wt => (
            <button
              key={wt.type}
              onClick={() => setSelectedType(wt.type)}
              className={clsx(
                'selection-btn',
                selectedType === wt.type ? 'selection-btn-active' : 'selection-btn-inactive'
              )}
            >
              <span className="selection-btn-text">{wt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Widget Title */}
      <div>
        <label className="form-label">{LABELS.WIDGET_TITLE}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={PLACEHOLDERS.WIDGET_TITLE}
          className="form-input"
        />
      </div>

      {/* Widget Size */}
      <div>
        <label className="form-label">{LABELS.WIDGET_SIZE}</label>
        <div className="flex-gap-2">
          {SIZE_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={clsx(
                'size-btn',
                size === s ? 'selection-btn-active' : 'selection-btn-inactive'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // Render Step 2: Data Source
  const renderStep2 = () => (
    <div className="form-group">
      {/* Data Source Type Selection */}
      <div>
        <label className="form-label">{LABELS.DATA_SOURCE_TYPE}</label>
        <div className="grid-2-cols">
          {DATA_SOURCE_OPTIONS.map(ds => {
            const Icon = iconMap[ds.iconName]
            return (
              <button
                key={ds.type}
                onClick={() => setDataSourceType(ds.type)}
                className={clsx(
                  'selection-btn',
                  dataSourceType === ds.type ? 'selection-btn-active' : 'selection-btn-inactive'
                )}
              >
                <div className="data-source-card">
                  <Icon className="data-source-icon" />
                  <div>
                    <span className="data-source-label">{ds.label}</span>
                    <span className="data-source-desc">{ds.description}</span>
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
          <label className="form-label">{LABELS.DATA_KEY}</label>
          <select
            value={selectedDataKey}
            onChange={(e) => setSelectedDataKey(e.target.value)}
            className="form-select"
          >
            {dataKeys.map(dk => (
              <option key={dk} value={dk}>{dk}</option>
            ))}
          </select>
        </div>
      )}

      {/* URL-based Data Sources (API/URL) */}
      {(dataSourceType === DATA_SOURCE_TYPES.API || dataSourceType === DATA_SOURCE_TYPES.URL) && (
        <>
          <div>
            <label className="form-label">
              {dataSourceType === DATA_SOURCE_TYPES.API ? LABELS.API_ENDPOINT_URL : LABELS.JSON_URL}
            </label>
            <input
              type="url"
              value={dataSourceUrl}
              onChange={(e) => setDataSourceUrl(e.target.value)}
              placeholder={PLACEHOLDERS.API_URL}
              className="form-input"
            />
          </div>
          
          <div>
            <label className="form-label">{LABELS.JSON_PATH}</label>
            <input
              type="text"
              value={dataSourcePath}
              onChange={(e) => setDataSourcePath(e.target.value)}
              placeholder={PLACEHOLDERS.JSON_PATH}
              className="form-input"
            />
            <p className="form-hint">{LABELS.JSON_PATH_HINT}</p>
          </div>
        </>
      )}

      {/* Excel Data Source */}
      {dataSourceType === DATA_SOURCE_TYPES.EXCEL && (
        <>
          <div>
            <label className="form-label">{LABELS.EXCEL_FILE_URL}</label>
            <input
              type="url"
              value={dataSourceUrl}
              onChange={(e) => setDataSourceUrl(e.target.value)}
              placeholder={PLACEHOLDERS.EXCEL_URL}
              className="form-input"
            />
          </div>
          
          <div className="grid-2-cols-gap-3">
            <div>
              <label className="form-label">{LABELS.SHEET_NAME}</label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder={PLACEHOLDERS.SHEET_NAME}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">{LABELS.CELL_RANGE}</label>
              <input
                type="text"
                value={cellRange}
                onChange={(e) => setCellRange(e.target.value)}
                placeholder={PLACEHOLDERS.CELL_RANGE}
                className="form-input"
              />
            </div>
          </div>
        </>
      )}

      {/* Document Data Source */}
      {dataSourceType === DATA_SOURCE_TYPES.DOCUMENT && (
        <div>
          <label className="form-label">{LABELS.DOCUMENT_URL}</label>
          <input
            type="url"
            value={dataSourceUrl}
            onChange={(e) => setDataSourceUrl(e.target.value)}
            placeholder={PLACEHOLDERS.DOCUMENT_URL}
            className="form-input"
          />
        </div>
      )}

      {/* Database Data Source */}
      {dataSourceType === DATA_SOURCE_TYPES.DATABASE && (
        <div>
          <label className="form-label">{LABELS.CONNECTION_STRING}</label>
          <input
            type="text"
            value={dataSourceUrl}
            onChange={(e) => setDataSourceUrl(e.target.value)}
            placeholder={PLACEHOLDERS.DATABASE_CONNECTION}
            className="form-input"
          />
        </div>
      )}
    </div>
  )

  // Render Step 3: Settings & Review
  const renderStep3 = () => (
    <div className="form-group">
      {dataSourceType !== DATA_SOURCE_TYPES.STATIC && (
        <>
          {/* Auto Refresh */}
          <div>
            <label className="form-label">{LABELS.AUTO_REFRESH}</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="form-select"
            >
              {REFRESH_INTERVALS.map(ri => (
                <option key={ri.value} value={ri.value}>{ri.label}</option>
              ))}
            </select>
          </div>

          {/* Authentication */}
          <div>
            <label className="form-label">{LABELS.AUTHENTICATION}</label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
              className="form-select"
            >
              {AUTH_OPTIONS.map(at => (
                <option key={at.value} value={at.value}>{at.label}</option>
              ))}
            </select>
          </div>

          {/* Auth Credentials */}
          {authType !== AUTH_TYPES.NONE && (
            <div>
              <label className="form-label">{getAuthLabel()}</label>
              <input
                type="password"
                value={authCredentials}
                onChange={(e) => setAuthCredentials(e.target.value)}
                placeholder={PLACEHOLDERS.CREDENTIALS}
                className="form-input"
              />
            </div>
          )}
        </>
      )}

      {/* Summary Card */}
      <div className="summary-card">
        <h4 className="summary-title">{LABELS.SUMMARY_TITLE}</h4>
        <dl className="summary-list">
          <div className="summary-row">
            <dt className="summary-label">{LABELS.SUMMARY_TYPE}</dt>
            <dd className="summary-value">
              {widgetTypes.find(w => w.type === selectedType)?.label}
            </dd>
          </div>
          <div className="summary-row">
            <dt className="summary-label">{LABELS.SUMMARY_TITLE_LABEL}</dt>
            <dd className="summary-value">{title || selectedDataKey || LABELS.UNTITLED}</dd>
          </div>
          <div className="summary-row">
            <dt className="summary-label">{LABELS.SUMMARY_SIZE}</dt>
            <dd className="summary-value capitalize">{size}</dd>
          </div>
          <div className="summary-row">
            <dt className="summary-label">{LABELS.SUMMARY_DATA_SOURCE}</dt>
            <dd className="summary-value">
              {DATA_SOURCE_OPTIONS.find(d => d.type === dataSourceType)?.label}
            </dd>
          </div>
          {dataSourceType !== DATA_SOURCE_TYPES.STATIC && dataSourceUrl && (
            <div className="summary-row">
              <dt className="summary-label">{LABELS.SUMMARY_URL}</dt>
              <dd className="summary-value-truncate">{dataSourceUrl}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )

  // Render Step Indicator
  const renderStepIndicator = () => (
    <div className="step-container">
      <div className="step-indicator">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(s => (
          <div key={s} className="flex items-center">
            <button
              onClick={() => setStep(s)}
              className={clsx(
                'step-btn',
                step === s && 'step-btn-active',
                step > s && 'step-btn-completed',
                step < s && 'step-btn-pending'
              )}
            >
              {s}
            </button>
            {s < TOTAL_STEPS && (
              <div className={clsx(
                'step-connector',
                step > s ? 'step-connector-completed' : 'step-connector-pending'
              )} />
            )}
          </div>
        ))}
      </div>
      <div className="step-title">{getStepTitle()}</div>
    </div>
  )

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">{LABELS.MODAL_TITLE}</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Content */}
        <div className="modal-content">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={() => handleStepNavigation('back')} className="btn-nav">
            {step === 1 ? LABELS.CANCEL : LABELS.BACK}
          </button>
          <button onClick={() => handleStepNavigation('next')} className="btn-action">
            {step < TOTAL_STEPS ? LABELS.NEXT : LABELS.ADD_WIDGET}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddWidgetModalAdvanced
