import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Rocket, GitBranch, Tag, Calendar, Settings, Upload, Link2, Database,
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Plus, Trash2,
  FileSpreadsheet, Cloud, Save, Search,
  Filter, MoreVertical, PlayCircle, Copy, Check
} from 'lucide-react'
import { MetricCard, ProgressBar } from '../components/MetricCard'
import { ChartCard } from '../components/Charts'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'
import apiClient from '../services/api'

// Types
interface Release {
  id: string
  version: string
  name: string
  status: 'planning' | 'development' | 'testing' | 'staging' | 'released' | 'hotfix'
  targetDate: string
  actualDate?: string
  bugs: { fixed: number; total: number }
  features: string[]
  owner: string
  branch: string
}

interface AzureDevOpsConfig {
  organizationUrl: string
  projectName: string
  isConnected: boolean
  lastSync?: string
}

interface DataSourceConfig {
  id: string
  name: string
  type: 'url' | 'excel' | 'azuredevops' | 'api'
  url?: string
  refreshInterval: number
  mapping: Record<string, string>
  isActive: boolean
  lastFetch?: string
  status: 'connected' | 'error' | 'pending'
}

interface ExcelMapping {
  sheetName: string
  columnMappings: { source: string; target: string; type: string }[]
}

// Tab types
type TabId = 'overview' | 'pipeline' | 'settings' | 'datasources'

// Main Component
export default function Releases() {
  const { isManager } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [releases, setReleases] = useState<Release[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  
  // Settings state
  const [azureConfig, setAzureConfig] = useState<AzureDevOpsConfig>({
    organizationUrl: '',
    projectName: '',
    isConnected: false
  })
  const [dataSources, setDataSources] = useState<DataSourceConfig[]>([])
  const [showAddDataSource, setShowAddDataSource] = useState(false)
  const [showExcelImport, setShowExcelImport] = useState(false)

  // Load data
  useEffect(() => {
    loadReleases()
    loadDataSources()
  }, [])

  const loadReleases = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.get('/releases')
      setReleases(response.data)
    } catch {
      // Mock data for demo
      setReleases([
        { id: '1', version: 'v2.5.1', name: 'Security Patch', status: 'released', targetDate: '2024-03-08', bugs: { fixed: 12, total: 12 }, features: ['Auth fix', 'SQL injection prevention'], owner: 'john.doe', branch: 'release/2.5.1' },
        { id: '2', version: 'v2.6.0', name: 'Feature Release', status: 'testing', targetDate: '2024-03-15', bugs: { fixed: 45, total: 52 }, features: ['New dashboard', 'API improvements'], owner: 'jane.smith', branch: 'release/2.6' },
        { id: '3', version: 'v2.7.0', name: 'Q2 Release', status: 'development', targetDate: '2024-04-01', bugs: { fixed: 10, total: 35 }, features: ['Mobile support', 'Notifications'], owner: 'bob.wilson', branch: 'develop' },
        { id: '4', version: 'v3.0.0', name: 'Major Update', status: 'planning', targetDate: '2024-06-01', bugs: { fixed: 0, total: 0 }, features: ['Complete redesign'], owner: 'alice.johnson', branch: 'main' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadDataSources = useCallback(async () => {
    try {
      const response = await apiClient.get('/datasources')
      setDataSources(response.data)
    } catch {
      setDataSources([
        { id: '1', name: 'Azure DevOps API', type: 'azuredevops', refreshInterval: 300, mapping: {}, isActive: true, status: 'connected', lastFetch: new Date().toISOString() },
        { id: '2', name: 'Customer Deployments Excel', type: 'excel', refreshInterval: 3600, mapping: {}, isActive: true, status: 'connected' },
      ])
    }
  }, [])

  const tabs = [
    { id: 'overview' as TabId, label: 'Overview', icon: Rocket },
    { id: 'pipeline' as TabId, label: 'Pipeline', icon: GitBranch },
    ...(isManager ? [
      { id: 'settings' as TabId, label: 'Settings', icon: Settings },
      { id: 'datasources' as TabId, label: 'Data Sources', icon: Database },
    ] : [])
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Release Management</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Track releases, manage Azure DevOps integration, and configure data sources</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadReleases}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
                Refresh
              </button>
              {isManager && (
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md">
                  <Plus className="w-4 h-4" />
                  New Release
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 -mb-px">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-3 rounded-t-lg font-medium transition-all',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <OverviewTab releases={releases} />
          )}
          {activeTab === 'pipeline' && (
            <PipelineTab 
              releases={releases} 
              selectedRelease={selectedRelease}
              onSelectRelease={setSelectedRelease}
            />
          )}
          {activeTab === 'settings' && isManager && (
            <SettingsTab 
              config={azureConfig}
              onConfigChange={setAzureConfig}
              onShowExcelImport={() => setShowExcelImport(true)}
            />
          )}
          {activeTab === 'datasources' && isManager && (
            <DataSourcesTab 
              dataSources={dataSources}
              onAddNew={() => setShowAddDataSource(true)}
              onRefresh={loadDataSources}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      {showAddDataSource && (
        <AddDataSourceModal
          onClose={() => setShowAddDataSource(false)}
          onSave={(ds) => {
            setDataSources([...dataSources, ds])
            setShowAddDataSource(false)
          }}
        />
      )}
      {showExcelImport && (
        <ExcelImportModal onClose={() => setShowExcelImport(false)} />
      )}
    </div>
  )
}

// Overview Tab
function OverviewTab({ releases }: { releases: Release[] }) {
  const releaseTimelineData = {
    labels: releases.map(r => r.version),
    datasets: [{
      label: 'Bug Progress (%)',
      data: releases.map(r => r.bugs.total > 0 ? Math.round(r.bugs.fixed / r.bugs.total * 100) : 0),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
      borderRadius: 8,
    }],
  }

  const statusDistribution = {
    labels: ['Released', 'Testing', 'Development', 'Planning'],
    datasets: [{
      data: [
        releases.filter(r => r.status === 'released').length,
        releases.filter(r => r.status === 'testing').length,
        releases.filter(r => r.status === 'development').length,
        releases.filter(r => r.status === 'planning').length,
      ],
      backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#6b7280'],
    }],
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Releases" value={releases.length.toString()} change={33} changeLabel="vs last quarter" trend="up" icon={<Rocket size={20} />} />
        <MetricCard title="In Progress" value={releases.filter(r => ['development', 'testing'].includes(r.status)).length.toString()} trend="neutral" icon={<GitBranch size={20} />} />
        <MetricCard title="Latest Version" value={releases.find(r => r.status === 'released')?.version || 'N/A'} icon={<Tag size={20} />} />
        <MetricCard title="Next Release" value={(() => { const next = releases.find(r => r.status === 'testing'); if (!next) return 'TBD'; const days = Math.ceil((new Date(next.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)); return `${days} days`; })()} icon={<Calendar size={20} />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ChartCard title="Bug Resolution by Release" type="bar" data={releaseTimelineData} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ChartCard title="Release Status Distribution" type="doughnut" data={statusDistribution} />
        </div>
      </div>

      {/* Releases Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Releases</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search releases..." className="pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><Filter className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Version</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Target</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Progress</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Owner</th>
                <th className="text-right py-3 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {releases.map(release => (
                <tr key={release.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-4 px-6"><span className="font-mono font-medium text-blue-600 dark:text-blue-400">{release.version}</span></td>
                  <td className="py-4 px-6 text-gray-900 dark:text-white">{release.name}</td>
                  <td className="py-4 px-6"><ReleaseStatusBadge status={release.status} /></td>
                  <td className="py-4 px-6 text-gray-500">{release.targetDate}</td>
                  <td className="py-4 px-6"><div className="flex items-center gap-2"><div className="w-24"><ProgressBar value={release.bugs.fixed} max={release.bugs.total || 1} color={release.bugs.fixed === release.bugs.total ? 'green' : 'blue'} /></div><span className="text-xs text-gray-500">{release.bugs.fixed}/{release.bugs.total}</span></div></td>
                  <td className="py-4 px-6 text-gray-500">{release.owner}</td>
                  <td className="py-4 px-6 text-right"><button className="p-1 text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}

// Pipeline Tab
function PipelineTab({ releases, selectedRelease, onSelectRelease }: { releases: Release[]; selectedRelease: Release | null; onSelectRelease: (r: Release | null) => void }) {
  const stages = ['planning', 'development', 'testing', 'staging', 'released']
  
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-6">Release Pipeline</h3>
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {stages.map((stage, index) => {
            const stageReleases = releases.filter(r => r.status === stage)
            return (
              <div key={stage} className="flex-shrink-0 w-64">
                <div className="flex items-center gap-2 mb-4">
                  <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm', stage === 'released' ? 'bg-green-500' : stage === 'testing' ? 'bg-yellow-500' : stage === 'staging' ? 'bg-purple-500' : stage === 'development' ? 'bg-blue-500' : 'bg-gray-500')}>{index + 1}</div>
                  <span className="font-medium capitalize text-gray-900 dark:text-white">{stage}</span>
                  <span className="ml-auto text-sm text-gray-500">{stageReleases.length}</span>
                </div>
                <div className="space-y-3 min-h-[200px] p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                  {stageReleases.map(release => (
                    <div key={release.id} onClick={() => onSelectRelease(release)} className={clsx('p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border cursor-pointer transition-all hover:shadow-md', selectedRelease?.id === release.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-700')}>
                      <div className="flex items-center justify-between mb-2"><span className="font-mono font-medium text-blue-600 dark:text-blue-400">{release.version}</span><GitBranch className="w-4 h-4 text-gray-400" /></div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{release.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500"><Calendar className="w-3 h-3" />{release.targetDate}</div>
                    </div>
                  ))}
                  {stageReleases.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No releases</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700"><h3 className="font-semibold text-gray-900 dark:text-white">Branch Status</h3></div>
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50"><tr><th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Branch</th><th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Last Commit</th><th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Author</th><th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">PRs</th><th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Build</th></tr></thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {[{ name: 'main', lastCommit: '2 hours ago', author: 'john.doe', prs: 3, build: 'passing' }, { name: 'release/2.6', lastCommit: '1 day ago', author: 'jane.smith', prs: 1, build: 'passing' }, { name: 'feature/dashboard', lastCommit: '3 hours ago', author: 'bob.wilson', prs: 2, build: 'failing' }, { name: 'hotfix/auth', lastCommit: '30 min ago', author: 'alice.johnson', prs: 1, build: 'passing' }].map((branch, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="py-3 px-6 font-mono text-sm text-blue-600 dark:text-blue-400">{branch.name}</td>
                <td className="py-3 px-6 text-gray-500">{branch.lastCommit}</td>
                <td className="py-3 px-6 text-gray-500">{branch.author}</td>
                <td className="py-3 px-6">{branch.prs}</td>
                <td className="py-3 px-6"><span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', branch.build === 'passing' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400')}>{branch.build === 'passing' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}{branch.build}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

// Settings Tab
function SettingsTab({ config, onConfigChange, onShowExcelImport }: { config: AzureDevOpsConfig; onConfigChange: (c: AzureDevOpsConfig) => void; onShowExcelImport: () => void }) {
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  const handleSave = async () => { setIsSaving(true); try { await apiClient.post('/adapters/azuredevops/configure', config); } catch {} finally { setIsSaving(false); } }
  const handleTestConnection = async () => { setIsTesting(true); try { await new Promise(r => setTimeout(r, 2000)); onConfigChange({ ...config, isConnected: true, lastSync: new Date().toISOString() }); } finally { setIsTesting(false); } }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Azure DevOps */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
          <div><h3 className="font-semibold text-gray-900 dark:text-white">Azure DevOps Integration</h3><p className="text-sm text-gray-500">Connect to your Azure DevOps organization</p></div>
          {config.isConnected && <span className="ml-auto flex items-center gap-1 text-green-600 text-sm"><CheckCircle className="w-4 h-4" />Connected</span>}
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Organization URL</label><input type="url" value={config.organizationUrl} onChange={e => onConfigChange({ ...config, organizationUrl: e.target.value })} placeholder="https://dev.azure.com/yourorg" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Name</label><input type="text" value={config.projectName} onChange={e => onConfigChange({ ...config, projectName: e.target.value })} placeholder="MyProject" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" /></div>
          <div className="flex gap-3 pt-4">
            <button onClick={handleTestConnection} disabled={isTesting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">{isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}Test Connection</button>
            <button onClick={handleSave} disabled={isSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">{isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Settings</button>
          </div>
        </div>
      </div>

      {/* Excel Import */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg"><FileSpreadsheet className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
          <div><h3 className="font-semibold text-gray-900 dark:text-white">Excel Import</h3><p className="text-sm text-gray-500">Import data from Excel files</p></div>
        </div>
        <div className="p-6">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600 dark:text-gray-400 mb-4">Drag & drop an Excel file here, or click to browse</p>
            <button onClick={onShowExcelImport} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">Import Excel File</button>
          </div>
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Imports</h4>
            <div className="space-y-2">
              {[{ name: 'customers_q1_2024.xlsx', date: '2024-03-01', rows: 1250 }, { name: 'deployments.xlsx', date: '2024-02-28', rows: 45 }].map((file, i) => (
                <div key={i} className="flex items-center justify-between text-sm"><span className="text-gray-600 dark:text-gray-400">{file.name}</span><span className="text-gray-500">{file.rows} rows • {file.date}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Data Sources Tab
function DataSourcesTab({ dataSources, onAddNew, onRefresh }: { dataSources: DataSourceConfig[]; onAddNew: () => void; onRefresh: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Data Sources</h3><p className="text-sm text-gray-500">Configure URLs and APIs to pull data into widgets</p></div>
        <div className="flex gap-3">
          <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"><RefreshCw className="w-4 h-4" />Refresh All</button>
          <button onClick={onAddNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus className="w-4 h-4" />Add Data Source</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dataSources.map(ds => <DataSourceCard key={ds.id} dataSource={ds} />)}
        <button onClick={onAddNew} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
          <Plus className="w-8 h-8 mb-2" /><span className="font-medium">Add Data Source</span>
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">How to use Data Sources</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
          <li>• <strong>URL/API:</strong> Enter a REST API endpoint that returns JSON data</li>
          <li>• <strong>Excel:</strong> Upload Excel files with customer or deployment data</li>
          <li>• <strong>Azure DevOps:</strong> Connect to pull work items, releases, and builds</li>
          <li>• <strong>Mapping:</strong> Configure how data maps to widget fields</li>
        </ul>
      </div>
    </motion.div>
  )
}

// Data Source Card
function DataSourceCard({ dataSource }: { dataSource: DataSourceConfig }) {
  const [copied, setCopied] = useState(false)
  const copyUrl = () => { if (dataSource.url) { navigator.clipboard.writeText(dataSource.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } }
  const typeIcons = { url: Link2, api: Database, excel: FileSpreadsheet, azuredevops: Cloud }
  const Icon = typeIcons[dataSource.type]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={clsx('p-2 rounded-lg', dataSource.status === 'connected' ? 'bg-green-100 dark:bg-green-900/30' : dataSource.status === 'error' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700')}>
              <Icon className={clsx('w-5 h-5', dataSource.status === 'connected' ? 'text-green-600 dark:text-green-400' : dataSource.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400')} />
            </div>
            <div><h4 className="font-medium text-gray-900 dark:text-white">{dataSource.name}</h4><span className="text-xs text-gray-500 capitalize">{dataSource.type}</span></div>
          </div>
          <div className="flex items-center gap-1">{dataSource.isActive ? <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> : <span className="w-2 h-2 bg-gray-400 rounded-full" />}</div>
        </div>
        {dataSource.url && <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg mb-3"><code className="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{dataSource.url}</code><button onClick={copyUrl} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">{copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</button></div>}
        <div className="flex items-center justify-between text-xs text-gray-500"><span>Refresh: {dataSource.refreshInterval / 60}m</span>{dataSource.lastFetch && <span>Last: {new Date(dataSource.lastFetch).toLocaleTimeString()}</span>}</div>
      </div>
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
        <button className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Edit</button>
        <button className="text-xs text-blue-600 hover:text-blue-700">Test</button>
        <button className="text-xs text-red-600 hover:text-red-700">Delete</button>
      </div>
    </div>
  )
}

// Add Data Source Modal
function AddDataSourceModal({ onClose, onSave }: { onClose: () => void; onSave: (ds: DataSourceConfig) => void }) {
  const [type, setType] = useState<'url' | 'excel' | 'azuredevops' | 'api'>('url')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [refreshInterval, setRefreshInterval] = useState(300)

  const handleSave = () => { onSave({ id: Date.now().toString(), name: name || 'New Data Source', type, url: type === 'url' || type === 'api' ? url : undefined, refreshInterval, mapping: {}, isActive: true, status: 'pending' }); }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Data Source</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XCircle className="w-5 h-5" /></button></div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Source Type</label>
            <div className="grid grid-cols-2 gap-3">
              {[{ id: 'url', label: 'URL/Endpoint', icon: Link2 }, { id: 'api', label: 'REST API', icon: Database }, { id: 'excel', label: 'Excel File', icon: FileSpreadsheet }, { id: 'azuredevops', label: 'Azure DevOps', icon: Cloud }].map(t => (
                <button key={t.id} onClick={() => setType(t.id as any)} className={clsx('p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3', type === t.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500')}>
                  <t.icon className={clsx('w-5 h-5', type === t.id ? 'text-blue-600' : 'text-gray-500')} /><span className={clsx('font-medium', type === t.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300')}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="My Data Source" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500" /></div>
          {(type === 'url' || type === 'api') && <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{type === 'url' ? 'URL' : 'API Endpoint'}</label><input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.example.com/data" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500" /><p className="mt-1 text-xs text-gray-500">Enter a URL that returns JSON data</p></div>}
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Refresh Interval</label><select value={refreshInterval} onChange={e => setRefreshInterval(Number(e.target.value))} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"><option value={60}>Every minute</option><option value={300}>Every 5 minutes</option><option value={900}>Every 15 minutes</option><option value={1800}>Every 30 minutes</option><option value={3600}>Every hour</option></select></div>
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Data Source</button>
        </div>
      </motion.div>
    </div>
  )
}

// Excel Import Modal
function ExcelImportModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [mappings, setMappings] = useState<ExcelMapping[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setMappings([{ sheetName: 'Sheet1', columnMappings: [{ source: 'CustomerName', target: 'displayName', type: 'string' }, { source: 'Version', target: 'version', type: 'string' }, { source: 'DeployDate', target: 'deployedAt', type: 'date' }] }]); } }
  const handleImport = async () => { if (!file) return; setIsUploading(true); await new Promise(r => setTimeout(r, 2000)); setIsUploading(false); onClose(); }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"><div className="flex items-center gap-3"><FileSpreadsheet className="w-5 h-5 text-green-600" /><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Import Excel File</h3></div><button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><XCircle className="w-5 h-5" /></button></div>
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
            {file ? <div className="flex items-center justify-center gap-3"><FileSpreadsheet className="w-8 h-8 text-green-600" /><div className="text-left"><p className="font-medium text-gray-900 dark:text-white">{file.name}</p><p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p></div><button onClick={() => setFile(null)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>
            : <><Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600 dark:text-gray-400 mb-4">Drag & drop an Excel file here</p><label className="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">Browse Files<input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" /></label></>}
          </div>
          {mappings.length > 0 && <div className="space-y-4"><h4 className="font-medium text-gray-900 dark:text-white">Column Mappings</h4><div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3"><p className="text-sm text-gray-500 mb-4">Map Excel columns to widget data fields:</p>{mappings[0].columnMappings.map((mapping, i) => (<div key={i} className="flex items-center gap-3"><input type="text" value={mapping.source} readOnly className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" /><span className="text-gray-400">→</span><select value={mapping.target} className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"><option value="displayName">Display Name</option><option value="version">Version</option><option value="status">Status</option><option value="deployedAt">Deploy Date</option><option value="count">Count</option><option value="value">Value</option></select></div>))}<button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Mapping</button></div></div>}
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
          <button onClick={handleImport} disabled={!file || isUploading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Import Data</button>
        </div>
      </motion.div>
    </div>
  )
}

// Release Status Badge
function ReleaseStatusBadge({ status }: { status: Release['status'] }) {
  const config: Record<Release['status'], { bg: string; text: string; icon: typeof Calendar }> = {
    planning: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', icon: Calendar },
    development: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: GitBranch },
    testing: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: AlertTriangle },
    staging: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', icon: Cloud },
    released: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
    hotfix: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: AlertTriangle },
  }
  const { bg, text, icon: Icon } = config[status]
  return <span className={clsx('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium capitalize', bg, text)}><Icon className="w-3 h-3" />{status}</span>
}
