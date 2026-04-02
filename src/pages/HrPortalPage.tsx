import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, Building2, Cake, MapPin, Briefcase, Search, Plus, Settings, UserPlus,
  ChevronRight, Calendar, Phone, Mail, Star, TrendingUp, X, Save,
  Globe, RefreshCw, CheckCircle, XCircle, Upload, Download,
  Zap, ArrowRightLeft, FileText, Loader2, Trash2, History
} from 'lucide-react'
import * as hrService from '../services/hrPortalService'
import type {
  HrConnection, HrDepartment, HrEmployee, HrBirthday, DepartmentSummary, HrStats,
  HrSyncLog, SyncSettings, FieldMapping, TestConnectionResult, CsvImportResult
} from '../services/hrPortalService'

type ViewMode = 'overview' | 'directory' | 'birthdays' | 'department' | 'settings'

export default function HrPortalPage() {
  const [view, setView] = useState<ViewMode>('overview')
  const [stats, setStats] = useState<HrStats | null>(null)
  const [departments, setDepartments] = useState<HrDepartment[]>([])
  const [employees, setEmployees] = useState<HrEmployee[]>([])
  const [birthdays, setBirthdays] = useState<HrBirthday[]>([])
  const [connections, setConnections] = useState<HrConnection[]>([])
  const [selectedDept, setSelectedDept] = useState<string>('')
  const [deptSummary, setDeptSummary] = useState<DepartmentSummary | null>(null)
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [employeesTotal, setEmployeesTotal] = useState(0)
  const [employeesPage, setEmployeesPage] = useState(1)
  const [selectedEmployee, setSelectedEmployee] = useState<HrEmployee | null>(null)
  const [birthdayDays, setBirthdayDays] = useState(30)

  // Settings state
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [connForm, setConnForm] = useState({ connectionName: '', providerType: 'GreytHR', baseUrl: '', clientId: '', apiKey: '', useSso: false })
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [empForm, setEmpForm] = useState<Partial<HrEmployee> & { employeeId: string; name: string }>({
    employeeId: '', name: '', email: '', department: '', departmentCode: '', designation: '',
    location: '', extensionNo: '', reportingTo: '', reportingToId: '', status: 'Active'
  })
  const [showAddDept, setShowAddDept] = useState(false)
  const [deptForm, setDeptForm] = useState({ departmentCode: '', departmentName: '', location: '', managerName: '', managerEmployeeId: '' })

  // Integration settings state
  const [settingsTab, setSettingsTab] = useState<'connections' | 'sync' | 'import' | 'mapping' | 'logs'>('connections')
  const [activeConnId, setActiveConnId] = useState<string>('')
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null)
  const [syncLogs, setSyncLogs] = useState<HrSyncLog[]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})
  const [savingSync, setSavingSync] = useState(false)
  const [savingMapping, setSavingMapping] = useState(false)
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [connectionDepts, setConnectionDepts] = useState<HrDepartment[]>([])
  const [fetchingDepts, setFetchingDepts] = useState(false)

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, d, c] = await Promise.allSettled([
        hrService.getStats(),
        hrService.getDepartments(),
        hrService.getConnections()
      ])
      if (s.status === 'fulfilled') setStats(s.value)
      if (d.status === 'fulfilled') setDepartments(d.value)
      if (c.status === 'fulfilled') setConnections(c.value)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Load employees when viewing directory
  const loadEmployees = useCallback(async (deptCode?: string, search?: string, page = 1) => {
    try {
      const result = await hrService.getEmployees({
        departmentCode: deptCode || undefined,
        search: search || undefined,
        page,
        pageSize: 50
      })
      setEmployees(result.employees)
      setEmployeesTotal(result.total)
      setEmployeesPage(page)
    } catch { /* ignore */ }
  }, [])

  // Load birthdays
  const loadBirthdays = useCallback(async (deptCode?: string, days = 30) => {
    try {
      const result = await hrService.getBirthdays({ departmentCode: deptCode || undefined, daysAhead: days })
      setBirthdays(result.birthdays)
    } catch { /* ignore */ }
  }, [])

  // Load department summary
  const loadDeptSummary = useCallback(async (deptCode: string) => {
    try {
      const summary = await hrService.getDepartmentSummary(deptCode)
      setDeptSummary(summary)
    } catch { /* ignore */ }
  }, [])

  // Handle department selection
  const handleDeptSelect = (deptCode: string) => {
    setSelectedDept(deptCode)
    setView('department')
    loadDeptSummary(deptCode)
  }

  // Handle view changes
  useEffect(() => {
    if (view === 'directory') loadEmployees(selectedDept || undefined, searchText || undefined)
    if (view === 'birthdays') loadBirthdays(selectedDept || undefined, birthdayDays)
  }, [view, selectedDept, loadEmployees, loadBirthdays, birthdayDays, searchText])

  const handleSaveConnection = async () => {
    try {
      await hrService.createConnection(connForm)
      setShowConnectionForm(false)
      setConnForm({ connectionName: '', providerType: 'GreytHR', baseUrl: '', clientId: '', apiKey: '', useSso: false })
      loadData()
    } catch { /* ignore */ }
  }

  const handleSaveEmployee = async () => {
    try {
      await hrService.createEmployee(empForm)
      setShowAddEmployee(false)
      setEmpForm({ employeeId: '', name: '', email: '', department: '', departmentCode: '', designation: '', location: '', extensionNo: '', reportingTo: '', reportingToId: '', status: 'Active' })
      loadEmployees(selectedDept || undefined, searchText || undefined)
      loadData()
    } catch { /* ignore */ }
  }

  const handleSaveDept = async () => {
    try {
      await hrService.createDepartment(deptForm)
      setShowAddDept(false)
      setDeptForm({ departmentCode: '', departmentName: '', location: '', managerName: '', managerEmployeeId: '' })
      loadData()
    } catch { /* ignore */ }
  }

  // ========================================
  // Integration Handlers
  // ========================================

  // Auto-select first connection when entering settings
  useEffect(() => {
    if (view === 'settings' && connections.length > 0 && !activeConnId)
      setActiveConnId(connections[0].id)
  }, [view, connections, activeConnId])

  // Load sync settings when connection changes
  useEffect(() => {
    if (!activeConnId) return
    hrService.getSyncSettings(activeConnId).then(setSyncSettings).catch(() => {})
    hrService.getSyncLogs({ connectionId: activeConnId, count: 20 }).then(setSyncLogs).catch(() => {})
    hrService.getFieldMapping(activeConnId).then(setFieldMapping).catch(() => {})
    // Auto-load departments for active connection
    hrService.getDepartments(activeConnId).then(depts => {
      setConnectionDepts(depts)
      setDepartments(depts)
    }).catch(() => {})
  }, [activeConnId])

  const handleTestConnection = async () => {
    if (!activeConnId) return
    setTesting(true)
    setTestResult(null)
    setConnectionDepts([])
    try {
      const result = await hrService.testConnection(activeConnId)
      setTestResult(result)
      // On success, auto-fetch departments for this connection
      if (result.success) {
        setFetchingDepts(true)
        try {
          const depts = await hrService.getDepartments(activeConnId)
          setConnectionDepts(depts)
          // Also refresh the global departments list
          setDepartments(depts)
        } catch { /* ignore */ }
        setFetchingDepts(false)
      }
    } catch { setTestResult({ success: false, message: 'Request failed' }) }
    setTesting(false)
  }

  // State for sync operation
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<hrService.SyncResult | null>(null)

  // Sync data from HR provider (e.g., GreytHR API)
  const handleSyncFromProvider = async () => {
    if (!activeConnId) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await hrService.syncFromProvider(activeConnId)
      setSyncResult(result)
      // Refresh data on success
      if (result.success) {
        loadData()
        hrService.getSyncLogs({ connectionId: activeConnId, count: 20 }).then(setSyncLogs).catch(() => {})
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Sync request failed'
      setSyncResult({ success: false, message: errMsg, departmentsCreated: 0, departmentsUpdated: 0, employeesCreated: 0, employeesUpdated: 0, departmentErrors: [], employeeErrors: [], errors: [errMsg] })
    }
    setSyncing(false)
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
      // Refresh logs
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

  const handleDeleteConnection = async (connId: string) => {
    if (!confirm('Delete this connection?')) return
    try {
      await hrService.deleteConnection(connId)
      setConnections(prev => prev.filter(c => c.id !== connId))
      if (activeConnId === connId) setActiveConnId(connections.find(c => c.id !== connId)?.id ?? '')
      loadData()
    } catch { /* ignore */ }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Loading HR Portal...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> HR Portal
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Employee directory, birthdays, department overview</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Department Filter — Global */}
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.departmentCode} value={d.departmentCode}>
                {d.departmentName} ({d.actualCount})
              </option>
            ))}
          </select>
          <button onClick={() => setView('settings')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-1">
        {([
          { key: 'overview', label: 'Overview', icon: TrendingUp },
          { key: 'directory', label: 'Employee Directory', icon: Users },
          { key: 'birthdays', label: 'Birthdays', icon: Cake },
          { key: 'settings', label: 'Settings', icon: Settings },
        ] as { key: ViewMode; label: string; icon: any }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors ${
              view === tab.key ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
        {selectedDept && view === 'department' && (
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border-b-2 border-blue-600 rounded-t-lg">
            <Building2 className="w-3.5 h-3.5" />
            {departments.find(d => d.departmentCode === selectedDept)?.departmentName || selectedDept}
          </button>
        )}
      </div>

      {/* ================================================================
          OVERVIEW VIEW
          ================================================================ */}
      {view === 'overview' && (
        <div className="space-y-4">
          {/* Active department filter banner */}
          {selectedDept && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-800">
                  Filtered by: {departments.find(d => d.departmentCode === selectedDept)?.departmentName || selectedDept}
                </span>
                <span className="text-[10px] text-blue-600">({departments.find(d => d.departmentCode === selectedDept)?.actualCount ?? 0} employees)</span>
              </div>
              <button onClick={() => setSelectedDept('')} className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1">
                <X className="w-3 h-3" /> Clear Filter
              </button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard icon={Users} label="Total Employees" value={stats?.totalEmployees ?? 0} color="blue" />
            <StatCard icon={Building2} label="Departments" value={stats?.departments ?? 0} color="purple" />
            <StatCard icon={Cake} label="Birthdays Today" value={stats?.birthdaysToday ?? 0} color="green" />
            <StatCard icon={Cake} label="Birthdays This Week" value={stats?.birthdaysThisWeek ?? 0} color="amber" />
            <StatCard icon={UserPlus} label="New Joiners (Month)" value={stats?.newJoinersThisMonth ?? 0} color="cyan" />
          </div>

          {/* Department Cards Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-900">Departments</h2>
              <button onClick={() => setShowAddDept(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <Plus className="w-3 h-3" /> Add Department
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {departments.map(dept => (
                <button
                  key={dept.departmentCode}
                  onClick={() => handleDeptSelect(dept.departmentCode)}
                  className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{dept.departmentName}</h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">Code: {dept.departmentCode}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 mt-0.5" />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{dept.actualCount}</span>
                    {dept.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{dept.location}</span>}
                    {dept.managerName && <span className="flex items-center gap-1"><Star className="w-3 h-3" />{dept.managerName}</span>}
                  </div>
                </button>
              ))}
              {departments.length === 0 && (
                <div className="col-span-3 text-center py-12 text-gray-400">
                  <Building2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No departments configured</p>
                  <p className="text-xs mt-1">Add departments in Settings or use the button above</p>
                </div>
              )}
            </div>
          </div>

          {/* Location Distribution */}
          {stats?.byLocation && stats.byLocation.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-red-500" /> By Location
              </h2>
              <div className="flex flex-wrap gap-2">
                {stats.byLocation.map(loc => (
                  <div key={loc.location} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs">
                    <span className="font-medium text-gray-900">{loc.location}</span>
                    <span className="text-gray-500 ml-2">{loc.count} employees</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          EMPLOYEE DIRECTORY VIEW
          ================================================================ */}
      {view === 'directory' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or employee ID..."
                value={searchText}
                onChange={e => { setSearchText(e.target.value); loadEmployees(selectedDept || undefined, e.target.value) }}
                className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={() => setShowAddEmployee(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
              <Plus className="w-3.5 h-3.5" /> Add Employee
            </button>
          </div>

          <p className="text-[10px] text-gray-400">{employeesTotal} employees found{selectedDept ? ` in department ${selectedDept}` : ''}</p>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">ID</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Designation</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Department</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Location</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Reporting To</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Joined</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">DOB</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map(emp => (
                  <tr key={emp.employeeId} className="hover:bg-blue-50/30 cursor-pointer" onClick={() => setSelectedEmployee(emp)}>
                    <td className="px-3 py-2 font-mono text-gray-500">#{emp.employeeId}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{emp.name}</div>
                      {emp.email && <div className="text-[10px] text-gray-400">{emp.email}</div>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{emp.designation || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{emp.department ? emp.department.split(':').pop()?.trim() : '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{emp.location || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{emp.reportingTo || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{emp.joiningDate || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{emp.dateOfBirth || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400">No employees found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {employeesTotal > 50 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={employeesPage <= 1} onClick={() => loadEmployees(selectedDept || undefined, searchText, employeesPage - 1)}
                className="px-3 py-1 text-xs border rounded disabled:opacity-40">Previous</button>
              <span className="text-xs text-gray-500">Page {employeesPage} of {Math.ceil(employeesTotal / 50)}</span>
              <button disabled={employeesPage >= Math.ceil(employeesTotal / 50)} onClick={() => loadEmployees(selectedDept || undefined, searchText, employeesPage + 1)}
                className="px-3 py-1 text-xs border rounded disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          BIRTHDAYS VIEW
          ================================================================ */}
      {view === 'birthdays' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Cake className="w-4 h-4 text-pink-500" /> Upcoming Birthdays
            </h2>
            <select
              value={birthdayDays}
              onChange={e => setBirthdayDays(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded px-2 py-1"
            >
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
            </select>
            <span className="text-xs text-gray-400">{birthdays.length} upcoming</span>
          </div>

          {/* Today's Birthdays Highlight */}
          {birthdays.some(b => b.isToday) && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-green-800 mb-2">🎉 Happy Birthday Today!</h3>
              <div className="flex flex-wrap gap-3">
                {birthdays.filter(b => b.isToday).map(b => (
                  <div key={b.employeeId} className="bg-white rounded-lg border border-green-200 p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                      {b.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                      <p className="text-[10px] text-gray-500">{b.designation} • {b.department?.split(':').pop()?.trim()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {birthdays.filter(b => !b.isToday).map(b => (
              <div key={b.employeeId} className="bg-white border border-gray-200 rounded-xl p-3 hover:border-pink-200 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-pink-50 flex items-center justify-center text-pink-600 font-bold text-sm flex-shrink-0">
                    {b.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
                    <p className="text-[10px] text-gray-500">{b.designation}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                      {b.department && <span>{b.department.split(':').pop()?.trim()}</span>}
                      {b.location && <span>• {b.location}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold text-pink-600">{b.birthday}</div>
                    <div className="text-[10px] text-gray-400">{b.daysUntil}d away</div>
                  </div>
                </div>
              </div>
            ))}
            {birthdays.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-400">
                <Cake className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No upcoming birthdays in the selected period</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          DEPARTMENT DRILL-DOWN VIEW
          ================================================================ */}
      {view === 'department' && deptSummary && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setView('overview')} className="text-xs text-blue-600 hover:underline">&larr; Back</button>
            <h2 className="text-sm font-bold text-gray-900">{deptSummary.departmentName}</h2>
            {deptSummary.managerName && <span className="text-xs text-gray-500">Manager: {deptSummary.managerName}</span>}
          </div>

          {/* Dept Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Total" value={deptSummary.totalEmployees} color="blue" />
            <StatCard icon={Cake} label="Upcoming Birthdays" value={deptSummary.upcomingBirthdays.length} color="pink" />
            <StatCard icon={UserPlus} label="New Joiners (90d)" value={deptSummary.newJoiners.length} color="green" />
            <StatCard icon={Briefcase} label="Designations" value={deptSummary.byDesignation.length} color="purple" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Upcoming Birthdays */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-pink-50/50">
                <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <Cake className="w-3.5 h-3.5 text-pink-500" /> Upcoming Birthdays
                </h3>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto space-y-1">
                {deptSummary.upcomingBirthdays.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">None in next 30 days</p>
                ) : deptSummary.upcomingBirthdays.map(b => (
                  <div key={b.employeeId} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${b.isToday ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'}`}>
                    <div>
                      <span className="font-medium text-gray-900">{b.isToday && '🎉 '}{b.name}</span>
                      {b.designation && <span className="text-gray-400 ml-1.5 text-[10px]">{b.designation}</span>}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${b.isToday ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-500'}`}>
                      {b.isToday ? 'Today!' : `${b.daysUntil}d`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* New Joiners */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-green-50/50">
                <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-green-500" /> New Joiners
                </h3>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto space-y-1">
                {deptSummary.newJoiners.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No recent joiners</p>
                ) : deptSummary.newJoiners.map(j => (
                  <div key={j.employeeId} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-gray-50">
                    <div>
                      <span className="font-medium text-gray-900">{j.name}</span>
                      {j.designation && <span className="text-gray-400 ml-1.5 text-[10px]">{j.designation}</span>}
                    </div>
                    <span className="text-[10px] text-gray-500">{j.joiningDate}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Designation Breakdown */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-purple-50/50">
                <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-purple-500" /> By Designation
                </h3>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto space-y-1">
                {deptSummary.byDesignation.map(d => (
                  <div key={d.designation} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-gray-50">
                    <span className="text-gray-700">{d.designation}</span>
                    <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full Employee List */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-900">All Employees ({deptSummary.employees.length})</h3>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Designation</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Location</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Reporting To</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">DOB</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deptSummary.employees.map(emp => (
                  <tr key={emp.employeeId} className="hover:bg-blue-50/30">
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-900">{emp.name}</span>
                      {emp.email && <span className="text-gray-400 text-[10px] ml-1.5">{emp.email}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{emp.designation || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{emp.location || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{emp.reportingTo || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{emp.dateOfBirth || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{emp.joiningDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================
          SETTINGS VIEW — REDESIGNED BY PROVIDER TYPE
          ================================================================ */}
      {view === 'settings' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">HR Portal Connections</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {settingsTab === 'connections' ? 'Connect to HR providers to sync employee data' : 
                 settingsTab === 'mapping' ? 'Configure field mappings for data import' :
                 'View sync history and logs'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {settingsTab !== 'connections' && (
                <button onClick={() => setSettingsTab('connections')}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  ← Back to Connections
                </button>
              )}
              {settingsTab === 'connections' && (
                <button onClick={() => setShowConnectionForm(true)}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                  <Plus className="w-3.5 h-3.5" /> Add Connection
                </button>
              )}
            </div>
          </div>

          {/* ---- CONNECTIONS VIEW ---- */}
          {settingsTab === 'connections' && (
            <div className="space-y-4">
              {connections.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
                  <Globe className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">No connections configured</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Add GreytHR, Workday, or BambooHR for auto-sync. Use Manual for CSV import.
                  </p>
                  <button onClick={() => setShowConnectionForm(true)}
                    className="mt-4 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                    Add Your First Connection
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {connections.map(conn => {
                    const isExpanded = activeConnId === conn.id
                    const isApiProvider = conn.providerType !== 'Manual'
                    
                    return (
                      <div key={conn.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${
                        isExpanded ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        {/* Connection Header */}
                        <div className="p-4 cursor-pointer" onClick={() => setActiveConnId(isExpanded ? '' : conn.id)}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                                isApiProvider 
                                  ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white' 
                                  : 'bg-gradient-to-br from-gray-400 to-gray-500 text-white'
                              }`}>
                                {isApiProvider ? <RefreshCw className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-gray-900">{conn.connectionName}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    isApiProvider ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {isApiProvider ? 'API Sync' : 'Manual Import'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-0.5">{conn.providerType} • {conn.baseUrl || 'No URL'}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <Users className="w-3 h-3" /> {conn.employeeCount} employees
                                  </span>
                                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> {conn.departmentCount} departments
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {conn.lastSyncStatus && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  conn.lastSyncStatus === 'Success' ? 'bg-green-100 text-green-700' :
                                  conn.lastSyncStatus === 'Failed' ? 'bg-red-100 text-red-700' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                  {conn.lastSyncStatus}
                                </span>
                              )}
                              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                        </div>

                        {/* Expanded Panel - Different for API vs Manual */}
                        {isExpanded && (
                          <div className="border-t border-gray-100">
                            {isApiProvider ? (
                              /* =========== API PROVIDER (GreytHR, Workday, BambooHR) =========== */
                              <div className="p-4 space-y-4">
                                {/* Sync Actions */}
                                <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <h5 className="text-xs font-semibold text-violet-900 flex items-center gap-1.5">
                                        <RefreshCw className="w-3.5 h-3.5" /> Real-time Sync from {conn.providerType}
                                      </h5>
                                      <p className="text-[10px] text-violet-600 mt-0.5">
                                        Pull employees & departments from {conn.providerType} API
                                      </p>
                                    </div>
                                    <button 
                                      onClick={handleSyncFromProvider} 
                                      disabled={syncing}
                                      className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 shadow-sm"
                                    >
                                      {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                      Sync Now
                                    </button>
                                  </div>
                                  
                                  {/* Test + Sync Result */}
                                  <div className="flex items-center gap-3 pt-2 border-t border-violet-200/50">
                                    <button onClick={handleTestConnection} disabled={testing}
                                      className="flex items-center gap-1.5 text-[10px] text-violet-700 hover:bg-violet-100 px-2 py-1 rounded disabled:opacity-50">
                                      {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                      Test Connection
                                    </button>
                                    {testResult && (
                                      <span className={`text-[10px] flex items-center gap-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                        {testResult.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                        {testResult.message}
                                      </span>
                                    )}
                                  </div>

                                  {syncResult && (
                                    <div className={`mt-3 p-3 rounded-lg text-xs ${syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                      <div className={`font-medium flex items-center gap-1.5 ${syncResult.success ? 'text-green-700' : 'text-red-700'}`}>
                                        {syncResult.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                        {syncResult.message}
                                      </div>
                                      {syncResult.success && (
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                                          <div className="bg-white rounded px-2 py-1 border border-green-200">
                                            <span className="text-green-700 font-semibold">{syncResult.departmentsCreated}</span> depts created,{' '}
                                            <span className="text-blue-700 font-semibold">{syncResult.departmentsUpdated}</span> updated
                                          </div>
                                          <div className="bg-white rounded px-2 py-1 border border-green-200">
                                            <span className="text-green-700 font-semibold">{syncResult.employeesCreated}</span> employees created,{' '}
                                            <span className="text-blue-700 font-semibold">{syncResult.employeesUpdated}</span> updated
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Quick Actions */}
                                <div className="grid grid-cols-3 gap-3">
                                  <button onClick={() => setSettingsTab('mapping')}
                                    className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-gray-300 hover:bg-gray-50 transition-colors">
                                    <ArrowRightLeft className="w-4 h-4 text-purple-500 mb-1" />
                                    <p className="text-xs font-medium text-gray-800">Field Mapping</p>
                                    <p className="text-[10px] text-gray-400">Configure mappings</p>
                                  </button>
                                  <button onClick={() => setSettingsTab('logs')}
                                    className="bg-white border border-gray-200 rounded-lg p-3 text-left hover:border-gray-300 hover:bg-gray-50 transition-colors">
                                    <History className="w-4 h-4 text-blue-500 mb-1" />
                                    <p className="text-xs font-medium text-gray-800">Sync History</p>
                                    <p className="text-[10px] text-gray-400">{syncLogs.length} logs</p>
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn.id) }}
                                    className="bg-white border border-red-200 rounded-lg p-3 text-left hover:border-red-300 hover:bg-red-50 transition-colors">
                                    <Trash2 className="w-4 h-4 text-red-500 mb-1" />
                                    <p className="text-xs font-medium text-red-700">Delete</p>
                                    <p className="text-[10px] text-red-400">Remove</p>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* =========== MANUAL PROVIDER =========== */
                              <div className="p-4 space-y-4">
                                {/* CSV Import */}
                                <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4">
                                  <h5 className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 mb-3">
                                    <Upload className="w-3.5 h-3.5" /> Import Employees from CSV
                                  </h5>
                                  
                                  <div
                                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                                      dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'
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
                                        <p className="text-sm text-gray-600">Drag & drop CSV here</p>
                                        <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
                                          onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvImport(f) }} />
                                        <button onClick={() => fileInputRef.current?.click()}
                                          className="mt-3 text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700">
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
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Manual Entry & Export */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                                    <h6 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                                      <UserPlus className="w-3.5 h-3.5 text-green-500" /> Manual Entry
                                    </h6>
                                    <div className="space-y-1.5">
                                      <button onClick={() => setShowAddEmployee(true)}
                                        className="w-full text-left text-xs px-3 py-1.5 rounded bg-green-50 hover:bg-green-100 text-green-700 flex items-center gap-1.5">
                                        <Plus className="w-3 h-3" /> Add Employee
                                      </button>
                                      <button onClick={() => setShowAddDept(true)}
                                        className="w-full text-left text-xs px-3 py-1.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 flex items-center gap-1.5">
                                        <Plus className="w-3 h-3" /> Add Department
                                      </button>
                                    </div>
                                  </div>
                                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                                    <h6 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                                      <Download className="w-3.5 h-3.5 text-blue-500" /> Export & Templates
                                    </h6>
                                    <div className="space-y-1.5">
                                      <a href={hrService.getExportCsvUrl()} download
                                        className="w-full text-left text-xs px-3 py-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center gap-1.5">
                                        <Download className="w-3 h-3" /> Export Employees
                                      </a>
                                      <a href={hrService.downloadCsvTemplate()} download
                                        className="w-full text-left text-xs px-3 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center gap-1.5">
                                        <FileText className="w-3 h-3" /> Download Template
                                      </a>
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                  <button onClick={() => setSettingsTab('mapping')}
                                    className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1">
                                    <ArrowRightLeft className="w-3 h-3" /> Field Mapping
                                  </button>
                                  <span className="text-gray-300">|</span>
                                  <button onClick={() => setSettingsTab('logs')}
                                    className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1">
                                    <History className="w-3 h-3" /> Import History
                                  </button>
                                  <span className="text-gray-300">|</span>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn.id) }}
                                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1">
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- FIELD MAPPING VIEW ---- */}
          {settingsTab === 'mapping' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-500" /> Field Mapping
                </h3>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-3">Map provider fields to ProdVista fields</p>
                <div className="space-y-2">
                  {Object.entries(fieldMapping).map(([field, label]) => (
                    <div key={field} className="flex items-center gap-3">
                      <code className="bg-gray-100 px-2 py-1 rounded text-[10px] text-gray-700 w-32">{field}</code>
                      <span className="text-gray-400">→</span>
                      <input type="text" value={label}
                        onChange={e => setFieldMapping(prev => ({ ...prev, [field]: e.target.value }))}
                        className="flex-1 text-xs border border-gray-200 rounded px-3 py-1.5" />
                    </div>
                  ))}
                </div>
                <button onClick={handleSaveFieldMapping} disabled={savingMapping}
                  className="mt-4 flex items-center gap-1.5 text-xs bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {savingMapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Mapping
                </button>
              </div>
            </div>
          )}

          {/* ---- SYNC HISTORY VIEW ---- */}
          {settingsTab === 'logs' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-blue-500" /> Sync History
                </h3>
              </div>
              {syncLogs.length === 0 ? (
                <div className="p-8 text-center">
                  <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs text-gray-500">No sync history yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Records</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Started</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {syncLogs.map(log => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">{log.syncType}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              log.status === 'Success' ? 'bg-green-100 text-green-700' :
                              log.status === 'Failed' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            <span className="text-green-600">+{log.recordsCreated}</span>{' / '}
                            <span className="text-blue-600">~{log.recordsUpdated}</span>
                          </td>
                          <td className="px-4 py-2 text-gray-500">{new Date(log.startedAt).toLocaleString()}</td>
                          <td className="px-4 py-2 text-gray-500">{log.duration ? `${log.duration.toFixed(1)}s` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          MODALS
          ================================================================ */}

      {/* Connection Form Modal */}
      {showConnectionForm && (
        <Modal title="Add HR Portal Connection" onClose={() => setShowConnectionForm(false)}>
          <div className="space-y-3">
            <FormField label="Connection Name" value={connForm.connectionName} onChange={v => setConnForm(p => ({ ...p, connectionName: v }))} placeholder="e.g. Agilysys GreytHR" />
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
            <FormField label="Base URL" value={connForm.baseUrl} onChange={v => setConnForm(p => ({ ...p, baseUrl: v }))} placeholder="https://agilysys.greythr.com" />
            <FormField label="Client ID (optional)" value={connForm.clientId} onChange={v => setConnForm(p => ({ ...p, clientId: v }))} />
            <FormField label="API Key (optional)" value={connForm.apiKey} onChange={v => setConnForm(p => ({ ...p, apiKey: v }))} type="password" />
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={connForm.useSso} onChange={e => setConnForm(p => ({ ...p, useSso: e.target.checked }))} className="rounded" />
              Use SSO Authentication
            </label>
            <button onClick={handleSaveConnection} className="w-full bg-blue-600 text-white text-xs py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Save Connection
            </button>
          </div>
        </Modal>
      )}

      {/* Add Employee Modal */}
      {showAddEmployee && (
        <Modal title="Add Employee" onClose={() => setShowAddEmployee(false)}>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Employee ID *" value={empForm.employeeId} onChange={v => setEmpForm(p => ({ ...p, employeeId: v }))} placeholder="e.g. 3022" />
              <FormField label="Name *" value={empForm.name} onChange={v => setEmpForm(p => ({ ...p, name: v }))} placeholder="Full name" />
            </div>
            <FormField label="Email" value={empForm.email || ''} onChange={v => setEmpForm(p => ({ ...p, email: v }))} placeholder="email@company.com" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Department Code" value={empForm.departmentCode || ''} onChange={v => setEmpForm(p => ({ ...p, departmentCode: v }))} placeholder="e.g. 2630" />
              <FormField label="Department Name" value={empForm.department || ''} onChange={v => setEmpForm(p => ({ ...p, department: v }))} placeholder="e.g. 2630: R&D" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Designation" value={empForm.designation || ''} onChange={v => setEmpForm(p => ({ ...p, designation: v }))} />
              <FormField label="Location" value={empForm.location || ''} onChange={v => setEmpForm(p => ({ ...p, location: v }))} placeholder="e.g. Chennai" />
            </div>
            <FormField label="Extension No" value={empForm.extensionNo || ''} onChange={v => setEmpForm(p => ({ ...p, extensionNo: v }))} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Date of Birth</label>
                <input type="date" value={empForm.dateOfBirth ? String(empForm.dateOfBirth).substring(0, 10) : ''}
                  onChange={e => setEmpForm(p => ({ ...p, dateOfBirth: e.target.value || undefined }))}
                  className="w-full text-xs border border-gray-200 rounded px-3 py-1.5" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Joining Date</label>
                <input type="date" value={empForm.joiningDate ? String(empForm.joiningDate).substring(0, 10) : ''}
                  onChange={e => setEmpForm(p => ({ ...p, joiningDate: e.target.value || undefined }))}
                  className="w-full text-xs border border-gray-200 rounded px-3 py-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Reporting To" value={empForm.reportingTo || ''} onChange={v => setEmpForm(p => ({ ...p, reportingTo: v }))} placeholder="Manager name [ID]" />
              <FormField label="Reporting To ID" value={empForm.reportingToId || ''} onChange={v => setEmpForm(p => ({ ...p, reportingToId: v }))} placeholder="e.g. 1060" />
            </div>
            <button onClick={handleSaveEmployee} className="w-full bg-green-600 text-white text-xs py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Save Employee
            </button>
          </div>
        </Modal>
      )}

      {/* Add Department Modal */}
      {showAddDept && (
        <Modal title="Add Department" onClose={() => setShowAddDept(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Department Code *" value={deptForm.departmentCode} onChange={v => setDeptForm(p => ({ ...p, departmentCode: v }))} placeholder="e.g. 2630" />
              <FormField label="Department Name *" value={deptForm.departmentName} onChange={v => setDeptForm(p => ({ ...p, departmentName: v }))} placeholder="e.g. Reserve Activities R&D" />
            </div>
            <FormField label="Location" value={deptForm.location} onChange={v => setDeptForm(p => ({ ...p, location: v }))} placeholder="e.g. Chennai" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Manager Name" value={deptForm.managerName} onChange={v => setDeptForm(p => ({ ...p, managerName: v }))} />
              <FormField label="Manager Employee ID" value={deptForm.managerEmployeeId} onChange={v => setDeptForm(p => ({ ...p, managerEmployeeId: v }))} />
            </div>
            <button onClick={handleSaveDept} className="w-full bg-purple-600 text-white text-xs py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Save Department
            </button>
          </div>
        </Modal>
      )}

      {/* Employee Detail Popup */}
      {selectedEmployee && (
        <Modal title={`Employee #${selectedEmployee.employeeId}`} onClose={() => setSelectedEmployee(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                {selectedEmployee.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{selectedEmployee.name}</h3>
                <p className="text-xs text-gray-500">{selectedEmployee.designation}</p>
                <p className="text-[10px] text-gray-400">#{selectedEmployee.employeeId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <InfoRow icon={Mail} label="Email" value={selectedEmployee.email} />
              <InfoRow icon={Phone} label="Extension" value={selectedEmployee.extensionNo} />
              <InfoRow icon={Building2} label="Department" value={selectedEmployee.department} />
              <InfoRow icon={MapPin} label="Location" value={selectedEmployee.location} />
              <InfoRow icon={Briefcase} label="Designation" value={selectedEmployee.designation} />
              <InfoRow icon={Calendar} label="DOB" value={selectedEmployee.dateOfBirth} />
              <InfoRow icon={Calendar} label="Joined" value={selectedEmployee.joiningDate} />
              <InfoRow icon={Users} label="Reporting To" value={selectedEmployee.reportingTo} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ================================================================
// Reusable Components
// ================================================================

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <div className={`border rounded-xl p-3 ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-[10px] mt-0.5 opacity-80">{label}</p>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-xs border border-gray-200 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-gray-400 uppercase">{label}</p>
        <p className="text-xs text-gray-900">{value || '—'}</p>
      </div>
    </div>
  )
}
