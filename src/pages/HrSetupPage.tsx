import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Settings, Globe, RefreshCw, CheckCircle, XCircle, Upload, Download, Clock,
  Zap, ArrowRightLeft, PlayCircle, AlertTriangle, FileText, Loader2, Trash2, History,
  Plus, Save, Users, Building2, ChevronLeft, Edit2, Search
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as hrService from '../services/hrPortalService'
import type {
  HrConnection, HrStats, HrDepartment,
  HrSyncLog, SyncSettings, FieldMapping, TestConnectionResult, CsvImportResult,
  HrAuthStatus, TestPreviewResult, DepartmentPreview
} from '../services/hrPortalService'

type SettingsTab = 'connections' | 'sync' | 'import' | 'mapping' | 'logs'

export default function HrSetupPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [connections, setConnections] = useState<HrConnection[]>([])
  const [stats, setStats] = useState<HrStats | null>(null)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('connections')
  const [activeConnId, setActiveConnId] = useState('')

  // Connection form
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null)
  const [connForm, setConnForm] = useState({ connectionName: '', providerType: 'GreytHR', baseUrl: '', clientId: '', apiKey: '', useSso: false, defaultDepartmentCode: '', defaultDepartmentName: '' })
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [ssoStatus, setSsoStatus] = useState<HrAuthStatus | null>(null)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [departments, setDepartments] = useState<HrDepartment[]>([])
  const [deptLoading, setDeptLoading] = useState(false)
  // Test preview state
  const [testingPreview, setTestingPreview] = useState(false)
  const [previewResult, setPreviewResult] = useState<TestPreviewResult | null>(null)
  const [previewDepartments, setPreviewDepartments] = useState<DepartmentPreview[]>([])

  // Sync
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null)
  const [syncLogs, setSyncLogs] = useState<HrSyncLog[]>([])
  const [savingSync, setSavingSync] = useState(false)

  // Field mapping
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})
  const [savingMapping, setSavingMapping] = useState(false)

  // Import
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load departments for dropdown
  const loadDepartments = useCallback(async () => {
    setDeptLoading(true)
    try {
      const depts = await hrService.getDepartments()
      setDepartments(depts)
    } catch { /* ignore */ }
    setDeptLoading(false)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.allSettled([
        hrService.getStats(),
        hrService.getConnections()
      ])
      if (s.status === 'fulfilled') setStats(s.value)
      if (c.status === 'fulfilled') setConnections(c.value)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Auto-select first connection
  useEffect(() => {
    if (connections.length > 0 && !activeConnId)
      setActiveConnId(connections[0].id)
  }, [connections, activeConnId])

  // Load sync settings when connection changes
  useEffect(() => {
    if (!activeConnId) return
    hrService.getSyncSettings(activeConnId).then(setSyncSettings).catch(() => {})
    hrService.getSyncLogs({ connectionId: activeConnId, count: 20 }).then(setSyncLogs).catch(() => {})
    hrService.getFieldMapping(activeConnId).then(setFieldMapping).catch(() => {})
  }, [activeConnId])

  // Load departments when showing connection form
  useEffect(() => {
    if (showConnectionForm) loadDepartments()
  }, [showConnectionForm, loadDepartments])

  const handleSaveConnection = async () => {
    try {
      if (editingConnectionId) {
        await hrService.updateConnection(editingConnectionId, connForm)
      } else {
        await hrService.createConnection(connForm)
      }
      setShowConnectionForm(false)
      setEditingConnectionId(null)
      setConnForm({ connectionName: '', providerType: 'GreytHR', baseUrl: '', clientId: '', apiKey: '', useSso: false, defaultDepartmentCode: '', defaultDepartmentName: '' })
      setPreviewResult(null)
      setPreviewDepartments([])
      loadData()
    } catch { /* ignore */ }
  }

  const handleEditConnection = (conn: HrConnection) => {
    setEditingConnectionId(conn.id)
    setConnForm({
      connectionName: conn.connectionName,
      providerType: conn.providerType,
      baseUrl: conn.baseUrl,
      clientId: '',
      apiKey: '',
      useSso: conn.useSso,
      defaultDepartmentCode: conn.defaultDepartmentCode || '',
      defaultDepartmentName: conn.defaultDepartmentName || ''
    })
    setPreviewResult(null)
    setPreviewDepartments([])
    setShowConnectionForm(true)
  }

  const handleTestPreview = async () => {
    if (!connForm.baseUrl.trim()) return
    setTestingPreview(true)
    setPreviewResult(null)
    try {
      const result = await hrService.testConnectionPreview({
        baseUrl: connForm.baseUrl,
        providerType: connForm.providerType,
        useSso: connForm.useSso,
        clientId: connForm.clientId || undefined,
        apiKey: connForm.apiKey || undefined,
        fetchDepartments: true
      })
      setPreviewResult(result)
      if (result.departments?.length) {
        setPreviewDepartments(result.departments)
      }
    } catch (err: any) {
      setPreviewResult({ success: false, message: err?.message || 'Test failed', providerType: connForm.providerType, authMethod: connForm.useSso ? 'SSO' : 'ApiKey' })
    }
    setTestingPreview(false)
  }

  const handleTestConnection = async () => {
    if (!activeConnId) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await hrService.testConnection(activeConnId)
      setTestResult(result)
    } catch { setTestResult({ success: false, message: 'Request failed' }) }
    setTesting(false)
  }

  const fetchSsoStatus = useCallback(async () => {
    setSsoLoading(true)
    try {
      const status = await hrService.getHrAuthStatus()
      setSsoStatus(status)
    } catch { setSsoStatus(null) }
    setSsoLoading(false)
  }, [])

  // Fetch SSO status when SSO checkbox is toggled on
  useEffect(() => {
    if (connForm.useSso && !ssoStatus) fetchSsoStatus()
  }, [connForm.useSso, ssoStatus, fetchSsoStatus])

  const handleDeleteConnection = async (connId: string) => {
    if (!confirm('Delete this connection?')) return
    try {
      await hrService.deleteConnection(connId)
      setConnections(prev => prev.filter(c => c.id !== connId))
      if (activeConnId === connId) setActiveConnId(connections.find(c => c.id !== connId)?.id ?? '')
      loadData()
    } catch { /* ignore */ }
  }

  const handleSaveSyncSettings = async () => {
    if (!activeConnId || !syncSettings) return
    setSavingSync(true)
    try {
      await hrService.updateSyncSettings(activeConnId, {
        autoSyncEnabled: syncSettings.autoSyncEnabled,
        syncIntervalMinutes: syncSettings.syncIntervalMinutes,
        syncEmployees: syncSettings.syncEmployees,
        syncDepartments: syncSettings.syncDepartments,
        syncOnlyActive: syncSettings.syncOnlyActive,
        overwriteManualEdits: syncSettings.overwriteManualEdits,
      })
      const updated = await hrService.getSyncSettings(activeConnId)
      setSyncSettings(updated)
    } catch { /* ignore */ }
    setSavingSync(false)
  }

  const handleSaveFieldMapping = async () => {
    if (!activeConnId) return
    setSavingMapping(true)
    try {
      await hrService.updateFieldMapping(activeConnId, fieldMapping)
    } catch { /* ignore */ }
    setSavingMapping(false)
  }

  const handleCsvImport = async (file: File) => {
    setImporting(true)
    setImportResult(null)
    try {
      const result = await hrService.importCsv(file, activeConnId || undefined)
      setImportResult(result)
      loadData()
      if (activeConnId)
        hrService.getSyncLogs({ connectionId: activeConnId, count: 20 }).then(setSyncLogs).catch(() => {})
    } catch (err: any) {
      setImportResult({ message: err?.response?.data?.message || 'Import failed', created: 0, updated: 0, total: 0, failed: 0, errors: [], syncLogId: '' })
    }
    setImporting(false)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleCsvImport(file)
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Loading HR Setup...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/tools')} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Settings className="w-6 h-6 text-blue-600" /> HR Integration Setup
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Configure HR provider connections to pull employee data for dashboard widgets</p>
          </div>
        </div>
        {stats && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-blue-500" /> {stats.totalEmployees} employees</span>
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-purple-500" /> {stats.departments} departments</span>
          </div>
        )}
      </div>

      {/* Settings Sub-Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { key: 'connections' as SettingsTab, label: 'Connections', icon: Globe },
          { key: 'sync' as SettingsTab, label: 'Sync Settings', icon: RefreshCw },
          { key: 'import' as SettingsTab, label: 'Import / Export', icon: Upload },
          { key: 'mapping' as SettingsTab, label: 'Field Mapping', icon: ArrowRightLeft },
          { key: 'logs' as SettingsTab, label: 'Sync History', icon: History },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setSettingsTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              settingsTab === tab.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- CONNECTIONS TAB ---- */}
      {settingsTab === 'connections' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">HR Portal Connections</h2>
            <button onClick={() => setShowConnectionForm(true)}
              className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
              <Plus className="w-3 h-3" /> Add Connection
            </button>
          </div>

          {connections.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <Globe className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No connections configured</p>
              <p className="text-xs text-gray-400 mt-1">Add an HR provider connection to sync employee data</p>
              <button onClick={() => setShowConnectionForm(true)}
                className="mt-3 text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700">
                Add Connection
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map(conn => (
                <div key={conn.id}
                  className={`bg-white border rounded-xl p-4 transition-all cursor-pointer ${
                    activeConnId === conn.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveConnId(conn.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        conn.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">{conn.connectionName}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-gray-500">{conn.providerType} • {conn.baseUrl}</p>
                          {conn.useSso && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wide">SSO</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Users className="w-3 h-3" /> {conn.employeeCount} employees
                          </span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {conn.departmentCount} departments
                          </span>
                          {conn.lastSyncAt && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Last sync: {new Date(conn.lastSyncAt).toLocaleString()}
                            </span>
                          )}
                        </div>
                        {conn.defaultDepartmentCode && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700 w-fit">
                            <Building2 className="w-3 h-3" />
                            <span>Filter: {conn.defaultDepartmentName || conn.defaultDepartmentCode}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        conn.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {conn.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {conn.lastSyncStatus && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          conn.lastSyncStatus === 'Success' ? 'bg-green-50 text-green-600' :
                          conn.lastSyncStatus === 'Failed' ? 'bg-red-50 text-red-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {conn.lastSyncStatus}
                        </span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleEditConnection(conn) }}
                        className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn.id) }}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {activeConnId === conn.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <button onClick={handleTestConnection} disabled={testing}
                          className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
                          {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          Test Connection
                        </button>
                        {testResult && (
                          <div className={`flex items-center gap-1.5 text-xs ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                            {testResult.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- SYNC SETTINGS TAB ---- */}
      {settingsTab === 'sync' && (
        <div className="space-y-4">
          {!activeConnId ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <Settings className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">Select a connection first</p>
              <p className="text-xs text-gray-400 mt-1">Go to Connections tab to create or select one</p>
            </div>
          ) : syncSettings ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-blue-800">
                  {connections.find(c => c.id === activeConnId)?.connectionName || 'Connection'}
                </span>
                {syncSettings.lastSyncAt && (
                  <span className="text-[10px] text-blue-600 ml-auto">
                    Last synced: {new Date(syncSettings.lastSyncAt).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-blue-500" /> Automatic Sync
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">Enable automatic synchronization</span>
                    <button
                      onClick={() => setSyncSettings(prev => prev ? { ...prev, autoSyncEnabled: !prev.autoSyncEnabled } : prev)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${syncSettings.autoSyncEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                        syncSettings.autoSyncEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </label>
                  {syncSettings.autoSyncEnabled && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700 mb-1 block">Sync Interval</label>
                        <select
                          value={syncSettings.syncIntervalMinutes}
                          onChange={e => setSyncSettings(prev => prev ? { ...prev, syncIntervalMinutes: Number(e.target.value) } : prev)}
                          className="text-xs border border-gray-200 rounded px-3 py-1.5 w-full"
                        >
                          <option value={60}>Every hour</option>
                          <option value={360}>Every 6 hours</option>
                          <option value={720}>Every 12 hours</option>
                          <option value={1440}>Every 24 hours</option>
                          <option value={10080}>Weekly</option>
                        </select>
                      </div>
                      {syncSettings.nextSyncAt && (
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Next sync: {new Date(syncSettings.nextSyncAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                  <PlayCircle className="w-4 h-4 text-green-500" /> Sync Options
                </h3>
                <div className="space-y-2">
                  {[
                    { key: 'syncEmployees' as const, label: 'Sync employees', desc: 'Import employee records from HR provider' },
                    { key: 'syncDepartments' as const, label: 'Sync departments', desc: 'Import department structure' },
                    { key: 'syncOnlyActive' as const, label: 'Active employees only', desc: 'Skip inactive/terminated employees' },
                    { key: 'overwriteManualEdits' as const, label: 'Overwrite manual edits', desc: 'Replace manually edited fields on sync' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-start gap-3 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncSettings[opt.key]}
                        onChange={() => setSyncSettings(prev => prev ? { ...prev, [opt.key]: !prev[opt.key] } : prev)}
                        className="mt-0.5 rounded"
                      />
                      <div>
                        <p className="text-xs font-medium text-gray-700">{opt.label}</p>
                        <p className="text-[10px] text-gray-400">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button onClick={handleSaveSyncSettings} disabled={savingSync}
                className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingSync ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Sync Settings
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
          )}
        </div>
      )}

      {/* ---- IMPORT / EXPORT TAB ---- */}
      {settingsTab === 'import' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-blue-500" /> Import Employees from CSV
            </h3>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
            >
              {importing ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-xs text-gray-500">Importing...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-600">Drag & drop a CSV file here</p>
                  <p className="text-xs text-gray-400 mt-1">or</p>
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvImport(f) }} />
                  <button onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700">
                    Browse Files
                  </button>
                </>
              )}
            </div>

            {importResult && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${
                importResult.failed > 0 ? 'bg-amber-50 border border-amber-200' :
                importResult.created > 0 || importResult.updated > 0 ? 'bg-green-50 border border-green-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <p className="font-medium">{importResult.message}</p>
                {(importResult.created > 0 || importResult.updated > 0) && (
                  <div className="flex gap-4 mt-1.5 text-[10px]">
                    <span className="text-green-700">{importResult.created} created</span>
                    <span className="text-blue-700">{importResult.updated} updated</span>
                    {importResult.failed > 0 && <span className="text-red-700">{importResult.failed} failed</span>}
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <p key={i} className="text-[10px] text-red-600"><AlertTriangle className="w-3 h-3 inline mr-1" />{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-gray-500" /> CSV Template
              </h3>
              <p className="text-[10px] text-gray-400 mb-3">Download a sample CSV with the expected column headers</p>
              <a href={hrService.downloadCsvTemplate()} download
                className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg w-fit">
                <Download className="w-3 h-3" /> Download Template
              </a>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-green-500" /> Export Employees
              </h3>
              <p className="text-[10px] text-gray-400 mb-3">Download all employee data as CSV</p>
              <a href={hrService.getExportCsvUrl()} download
                className="flex items-center gap-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg w-fit">
                <Download className="w-3 h-3" /> Export All Employees
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ---- FIELD MAPPING TAB ---- */}
      {settingsTab === 'mapping' && (
        <div className="space-y-4">
          {!activeConnId ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">Select a connection first</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-blue-800">
                  Field Mapping for: {connections.find(c => c.id === activeConnId)?.connectionName}
                </span>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <span className="text-xs font-semibold text-gray-600">Internal Field</span>
                    <span className="text-xs font-semibold text-gray-600">CSV / Provider Column Label</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {Object.entries(fieldMapping).map(([field, label]) => (
                    <div key={field} className="grid grid-cols-2 gap-4 px-4 py-2 hover:bg-gray-50">
                      <div className="text-xs text-gray-700 flex items-center gap-1.5">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{field}</code>
                      </div>
                      <input
                        type="text"
                        value={label}
                        onChange={e => setFieldMapping(prev => ({ ...prev, [field]: e.target.value }))}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleSaveFieldMapping} disabled={savingMapping}
                className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingMapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Field Mapping
              </button>
            </>
          )}
        </div>
      )}

      {/* ---- SYNC LOGS TAB ---- */}
      {settingsTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <History className="w-4 h-4 text-gray-500" /> Sync History
            </h2>
            <button onClick={() => hrService.getSyncLogs({ connectionId: activeConnId || undefined, count: 50 }).then(setSyncLogs).catch(() => {})}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {syncLogs.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">No sync history yet</p>
              <p className="text-xs text-gray-400 mt-1">Import data or configure auto-sync to see history</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Time</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Records</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Duration</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Triggered By</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {syncLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{new Date(log.startedAt).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{log.syncType}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          log.status === 'Success' ? 'bg-green-50 text-green-700' :
                          log.status === 'Failed' ? 'bg-red-50 text-red-700' :
                          log.status === 'InProgress' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-600">{log.recordsProcessed}</span>
                        <span className="text-[10px] text-gray-400 ml-1">
                          ({log.recordsCreated}+ {log.recordsUpdated}~{log.recordsFailed > 0 ? ` ${log.recordsFailed}!` : ''})
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{log.duration != null ? `${log.duration.toFixed(1)}s` : '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{log.triggeredBy || '—'}</td>
                      <td className="px-3 py-2 text-red-500 truncate max-w-[200px]" title={log.errorMessage || ''}>
                        {log.errorMessage || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Connection Form Modal */}
      {showConnectionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">
                {editingConnectionId ? 'Edit HR Portal Connection' : 'Add HR Portal Connection'}
              </h3>
              <button onClick={() => { setShowConnectionForm(false); setEditingConnectionId(null); setPreviewResult(null); setPreviewDepartments([]) }} className="p-1 rounded hover:bg-gray-100 text-gray-400">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Connection Name</label>
                <input type="text" value={connForm.connectionName} onChange={e => setConnForm(p => ({ ...p, connectionName: e.target.value }))}
                  placeholder="e.g. Agilysys GreytHR" className="w-full text-xs border border-gray-200 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Provider</label>
                <select value={connForm.providerType} onChange={e => setConnForm(p => ({ ...p, providerType: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded px-3 py-1.5">
                  <option value="GreytHR">GreytHR</option>
                  <option value="Workday">Workday</option>
                  <option value="BambooHR">BambooHR</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Base URL</label>
                <div className="flex gap-2">
                  <input type="text" value={connForm.baseUrl} onChange={e => setConnForm(p => ({ ...p, baseUrl: e.target.value }))}
                    placeholder="https://agilysys.greythr.com" className="flex-1 text-xs border border-gray-200 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500" />
                  <button
                    type="button"
                    onClick={handleTestPreview}
                    disabled={testingPreview || !connForm.baseUrl.trim()}
                    className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {testingPreview ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    Test & Fetch
                  </button>
                </div>
                {previewResult && (
                  <div className={`mt-2 p-2 rounded-lg text-xs ${previewResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-1.5">
                      {previewResult.success ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                      <span className={previewResult.success ? 'text-green-700' : 'text-red-700'}>{previewResult.message}</span>
                    </div>
                    {previewResult.statusCode && (
                      <p className="text-[10px] text-gray-500 mt-1">Status: {previewResult.statusCode} • Auth: {previewResult.authMethod}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Default Department Filter */}
              <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/30">
                <label className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  Default Department Filter
                </label>
                <p className="text-[10px] text-gray-500 mb-2">Only sync employees from this department. Leave empty to sync all.</p>
                
                {/* Show fetched preview departments first if available */}
                {previewDepartments.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[10px] text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Found {previewDepartments.length} departments from provider
                    </div>
                    <select
                      value={connForm.defaultDepartmentCode}
                      onChange={e => {
                        const dept = previewDepartments.find(d => d.departmentCode === e.target.value)
                        setConnForm(p => ({
                          ...p,
                          defaultDepartmentCode: e.target.value,
                          defaultDepartmentName: dept?.departmentName || ''
                        }))
                      }}
                      className="w-full text-xs border border-gray-200 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Departments</option>
                      {previewDepartments.map(d => (
                        <option key={d.departmentCode} value={d.departmentCode}>
                          {d.departmentName} ({d.departmentCode})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : deptLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading departments...
                  </div>
                ) : departments.length > 0 ? (
                  <select
                    value={connForm.defaultDepartmentCode}
                    onChange={e => {
                      const dept = departments.find(d => d.departmentCode === e.target.value)
                      setConnForm(p => ({
                        ...p,
                        defaultDepartmentCode: e.target.value,
                        defaultDepartmentName: dept?.departmentName || ''
                      }))
                    }}
                    className="w-full text-xs border border-gray-200 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All Departments</option>
                    {departments.map(d => (
                      <option key={d.departmentCode} value={d.departmentCode}>
                        {d.departmentName} ({d.departmentCode}) — {d.actualCount} employees
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-amber-600 py-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" />
                    No departments found. Upload employees first via CSV import.
                  </div>
                )}
                {connForm.defaultDepartmentCode && (
                  <div className="mt-2 text-[10px] px-2 py-1 rounded bg-blue-100 text-blue-700 inline-flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Only syncing: {connForm.defaultDepartmentName || connForm.defaultDepartmentCode}
                  </div>
                )}
              </div>

              {/* SSO Toggle */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={connForm.useSso} onChange={e => setConnForm(p => ({ ...p, useSso: e.target.checked }))} className="rounded" />
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  Use SSO Authentication
                </label>
                <p className="text-[10px] text-gray-500 ml-6">
                  {connForm.useSso
                    ? 'Uses Azure CLI (dev) or Managed Identity (prod) — no API key needed'
                    : 'Enable to use Azure SSO instead of API key authentication'}
                </p>

                {/* SSO Status Card */}
                {connForm.useSso && (
                  <div className="ml-6 mt-2">
                    {ssoLoading ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking Azure auth...
                      </div>
                    ) : ssoStatus ? (
                      <div className={`rounded-lg p-2.5 text-xs space-y-1.5 ${ssoStatus.authenticated ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {ssoStatus.authenticated
                              ? <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                              : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                            <span className={`font-medium ${ssoStatus.authenticated ? 'text-green-700' : 'text-amber-700'}`}>
                              {ssoStatus.authenticated ? 'Authenticated' : 'Not Authenticated'}
                            </span>
                          </div>
                          <button onClick={fetchSsoStatus} className="p-0.5 rounded hover:bg-white/50 text-gray-400" title="Refresh">
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            ssoStatus.method === 'Azure CLI' ? 'bg-blue-100 text-blue-700'
                            : ssoStatus.method === 'Managed Identity' ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                          }`}>
                            {ssoStatus.method}
                          </span>
                          {ssoStatus.isDevelopment && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">DEV</span>
                          )}
                        </div>
                        {ssoStatus.authenticated && ssoStatus.user?.name && (
                          <p className="text-[10px] text-gray-600">Signed in as: {ssoStatus.user.name}{ssoStatus.user.email ? ` (${ssoStatus.user.email})` : ''}</p>
                        )}
                        {!ssoStatus.authenticated && ssoStatus.instructions && (
                          <div className="mt-1 flex items-start gap-1.5">
                            <Zap className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-[10px] text-amber-700">{ssoStatus.instructions}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button onClick={fetchSsoStatus} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" /> Check Azure auth status
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* API Key fields — hidden when SSO enabled */}
              {!connForm.useSso && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Client ID (optional)</label>
                    <input type="text" value={connForm.clientId} onChange={e => setConnForm(p => ({ ...p, clientId: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">API Key (optional)</label>
                    <input type="password" value={connForm.apiKey} onChange={e => setConnForm(p => ({ ...p, apiKey: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}

              <button onClick={handleSaveConnection} className="w-full bg-blue-600 text-white text-xs py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> {editingConnectionId ? 'Update Connection' : 'Save Connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
