// ============================================================================
// DataSourceSelector — Step 1: Pick data source + fetch sample data
// ============================================================================
import { useState, useCallback, useRef } from 'react'
import {
  Cloud, Server, Globe, Database, FileText, Terminal,
  Cpu, BarChart3, Zap, Loader2, CheckCircle, Upload,
  Play, AlertTriangle
} from 'lucide-react'
import clsx from 'clsx'
import { DataSourceConfig, FieldInfo, DATA_SOURCE_OPTIONS } from './types'
import { testDataProvider } from '../../services/dynamicDashboardService'

const ICON_MAP: Record<string, any> = {
  Cloud, Server, Globe, Database, FileText, Terminal, Cpu, BarChart3, Zap
}

interface Props {
  config: DataSourceConfig
  onChange: (config: DataSourceConfig) => void
}

export default function DataSourceSelector({ config, onChange }: Props) {
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const setType = (type: string) => {
    onChange({ ...config, type: type as any, provider: {}, sampleData: null, sampleFields: [] })
    setTestError(null)
  }

  const updateProvider = (key: string, value: unknown) => {
    onChange({ ...config, provider: { ...config.provider, [key]: value } })
  }

  // Extract fields from sample data
  const extractFields = useCallback((data: unknown): FieldInfo[] => {
    if (!data) return []
    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row !== 'object') return []
    const fields: FieldInfo[] = []
    const extract = (obj: Record<string, unknown>, prefix: string) => {
      for (const [key, val] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key
        const type = val === null ? 'string'
          : Array.isArray(val) ? 'array'
          : typeof val === 'number' ? 'number'
          : typeof val === 'boolean' ? 'boolean'
          : typeof val === 'string' && !isNaN(Date.parse(val)) && val.includes('-') ? 'date'
          : typeof val === 'object' ? 'object'
          : 'string'
        fields.push({ name: key, path, type: type as FieldInfo['type'], sample: val })
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          extract(val as Record<string, unknown>, path)
        }
      }
    }
    extract(row as Record<string, unknown>, '')
    return fields
  }, [])

  // Test / fetch sample data from data source
  const handleTest = async () => {
    setTesting(true)
    setTestError(null)
    try {
      // Map extended types to standard provider types for the backend
      let providerType = config.type
      if (config.type === 'AzureDevOps') providerType = 'ApiEndpoint' as any
      if (config.type === 'Jenkins') providerType = 'ApiEndpoint' as any
      if (config.type === 'Excel') {
        // Excel uses uploaded file data directly
        const fileData = config.provider.parsedData
        if (fileData) {
          const fields = extractFields(fileData)
          onChange({ ...config, sampleData: fileData, sampleFields: fields })
        }
        setTesting(false)
        return
      }

      const response = await testDataProvider({
        dataProviderType: providerType as string,
        dataProviderConfig: JSON.stringify(config.provider),
      })
      const data = response.data
      const fields = extractFields(data)
      onChange({ ...config, sampleData: data, sampleFields: fields })
    } catch (err: any) {
      setTestError(err?.response?.data?.message || err?.message || 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  // Handle Excel file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        // For CSV, parse manually. For JSON files, parse JSON.
        const text = evt.target?.result as string
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text)
          const arr = Array.isArray(parsed) ? parsed : [parsed]
          const fields = extractFields(arr)
          onChange({ ...config, provider: { ...config.provider, fileName: file.name, parsedData: arr }, sampleData: arr, sampleFields: fields })
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(l => l.trim())
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
          const rows = lines.slice(1, 20).map(line => {
            const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
            const row: Record<string, unknown> = {}
            headers.forEach((h, i) => { row[h] = vals[i] || '' })
            return row
          })
          const fields = extractFields(rows)
          onChange({ ...config, provider: { ...config.provider, fileName: file.name, parsedData: rows }, sampleData: rows, sampleFields: fields })
        }
      } catch {
        setTestError('Failed to parse file')
      }
    }
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Static JSON parse
  const handleStaticJson = (json: string) => {
    try {
      const parsed = JSON.parse(json)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      const fields = extractFields(arr)
      onChange({ ...config, provider: { ...config.provider, data: parsed }, sampleData: arr, sampleFields: fields })
      setTestError(null)
    } catch {
      setTestError('Invalid JSON')
    }
  }

  return (
    <div className="space-y-5">
      {/* Source Type Grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Data Source</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {DATA_SOURCE_OPTIONS.map(opt => {
            const Icon = ICON_MAP[opt.icon] || Globe
            const isSelected = config.type === opt.type
            return (
              <button key={opt.type} onClick={() => setType(opt.type)}
                className={clsx(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-all',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-400/30'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}>
                <Icon className="w-5 h-5" style={{ color: opt.color }} />
                <span className="text-xs font-medium text-gray-800">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Source-specific configuration */}
      {config.type === 'AzureDevOps' && (
        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700">Azure DevOps Connection</h4>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Organization" value={(config.provider.organization as string) || ''}
              onChange={v => updateProvider('organization', v)} placeholder="my-org" />
            <Input label="Project" value={(config.provider.project as string) || ''}
              onChange={v => updateProvider('project', v)} placeholder="my-project" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data Type</label>
            <select value={(config.provider.dataType as string) || 'workitems'}
              onChange={e => updateProvider('dataType', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
              <option value="workitems">Work Items</option>
              <option value="builds">Builds / Pipelines</option>
              <option value="pullrequests">Pull Requests</option>
              <option value="releases">Releases</option>
              <option value="commits">Commits</option>
            </select>
          </div>
          <Input label="PAT Token (optional)" type="password"
            value={(config.provider.pat as string) || ''}
            onChange={v => updateProvider('pat', v)} placeholder="Azure DevOps PAT" />
        </div>
      )}

      {config.type === 'Jenkins' && (
        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700">Jenkins Connection</h4>
          <Input label="Server URL" value={(config.provider.serverUrl as string) || ''}
            onChange={v => updateProvider('serverUrl', v)} placeholder="https://jenkins.example.com" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Username" value={(config.provider.username as string) || ''}
              onChange={v => updateProvider('username', v)} placeholder="admin" />
            <Input label="API Token" type="password" value={(config.provider.apiToken as string) || ''}
              onChange={v => updateProvider('apiToken', v)} placeholder="API token" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data Type</label>
            <select value={(config.provider.dataType as string) || 'jobs'}
              onChange={e => updateProvider('dataType', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
              <option value="jobs">Job List</option>
              <option value="builds">Build History</option>
              <option value="nodes">Nodes / Agents</option>
              <option value="queue">Build Queue</option>
            </select>
          </div>
          <Input label="Job Name (for builds)" value={(config.provider.jobName as string) || ''}
            onChange={v => updateProvider('jobName', v)} placeholder="my-pipeline" />
        </div>
      )}

      {config.type === 'ApiEndpoint' && (
        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700">REST API</h4>
          <Input label="URL" value={(config.provider.url as string) || ''}
            onChange={v => updateProvider('url', v)} placeholder="https://api.example.com/data" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
              <select value={(config.provider.method as string) || 'GET'}
                onChange={e => updateProvider('method', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
            <Input label="Data Path" value={(config.provider.dataPath as string) || ''}
              onChange={v => updateProvider('dataPath', v)} placeholder="$.data.items" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Headers (JSON)</label>
            <textarea value={(config.provider.headers as string) || ''} rows={2}
              onChange={e => updateProvider('headers', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white font-mono"
              placeholder='{ "Authorization": "Bearer ..." }' />
          </div>
        </div>
      )}

      {config.type === 'DatabaseQuery' && (
        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700">Database Query</h4>
          <Input label="Connection Name" value={(config.provider.connectionName as string) || ''}
            onChange={v => updateProvider('connectionName', v)} placeholder="my-database" />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">SQL Query</label>
            <textarea value={(config.provider.query as string) || ''} rows={4}
              onChange={e => updateProvider('query', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white font-mono"
              placeholder="SELECT TOP 100 * FROM ..." />
          </div>
        </div>
      )}

      {(config.type === 'Excel') && (
        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700">Excel / CSV Upload</h4>
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <Upload className="w-4 h-4" /> Upload File
            </button>
            {typeof config.provider.fileName === 'string' && config.provider.fileName && (
              <span className="text-sm text-gray-600">{String(config.provider.fileName)}</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".csv,.json,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <p className="text-xs text-gray-500">Supports CSV and JSON files. Excel files will be parsed server-side.</p>
        </div>
      )}

      {config.type === 'Static' && (
        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700">Static JSON Data</h4>
          <textarea rows={8}
            onChange={e => handleStaticJson(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white font-mono"
            placeholder={'[\n  { "name": "Item 1", "value": 42 },\n  { "name": "Item 2", "value": 87 }\n]'} />
        </div>
      )}

      {/* Fetch / Test Button */}
      {(() => {
        if (!config.type || config.type === 'Static' || config.type === 'Excel') return null
        return (
        <div className="flex items-center gap-3">
          <button onClick={handleTest} disabled={testing}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              testing ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'
            )}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {testing ? 'Fetching...' : 'Fetch Sample Data'}
          </button>
          {config.sampleData ? (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              {config.sampleFields.length} fields detected
              {Array.isArray(config.sampleData) && ` (${(config.sampleData as unknown[]).length} rows)`}
            </span>
          ) : null}
        </div>
        )
      })()}

      {testError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4" />
          {testError}
        </div>
      )}

      {/* Sample Data Preview */}
      {config.sampleData ? (
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Detected Fields</h4>
          <div className="flex flex-wrap gap-1.5">
            {config.sampleFields.filter(f => f.type !== 'object').map(f => (
              <span key={f.path}
                className={clsx(
                  'px-2 py-1 rounded text-xs font-medium border',
                  f.type === 'number' ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : f.type === 'date' ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : f.type === 'boolean' ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : f.type === 'array' ? 'bg-pink-50 text-pink-700 border-pink-200'
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                )}>
                {f.name} <span className="opacity-50">({f.type})</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// Simple input helper
function Input({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
        placeholder={placeholder} />
    </div>
  )
}
