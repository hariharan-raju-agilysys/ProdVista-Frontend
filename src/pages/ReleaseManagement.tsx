import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Rocket, GitBranch, Tag, Calendar, Clock, User,
  RefreshCw, CheckCircle, XCircle, AlertTriangle, Plus, ChevronDown,
  ChevronRight, FileText, Search, Loader2, Check,
  MessageSquare, Send, Sparkles, Box,
  History, Shield, Play, Pause,
  Server, Database, Globe, Smartphone, Terminal,
  Download, Upload, FileSpreadsheet, ClipboardList, X
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import apiClient from '../services/api'

// ============================================================================
// Types
// ============================================================================

interface Service {
  id: string
  name: string
  displayName: string
  repository: string
  currentVersion: string
  previousVersion?: string
  deployedEnvironments: EnvironmentDeployment[]
  lastDeployedAt?: string
  lastDeployedBy?: string
  icon: 'Server' | 'Database' | 'Globe' | 'Smartphone' | 'Terminal' | 'Box'
  status: 'healthy' | 'warning' | 'error' | 'deploying'
  branches: Branch[]
}

interface EnvironmentDeployment {
  environment: 'development' | 'staging' | 'production'
  version: string
  deployedAt: string
  deployedBy: string
  commitHash: string
  status: 'running' | 'stopped' | 'error'
}

interface Branch {
  name: string
  type: 'main' | 'release' | 'feature' | 'hotfix' | 'develop'
  lastCommit: string
  lastCommitAuthor: string
  lastCommitDate: string
  aheadBehind: { ahead: number; behind: number }
  prs?: number
  buildStatus?: 'success' | 'failure' | 'pending' | 'none'
  isProtected: boolean
}

interface Release {
  id: string
  version: string
  name: string
  description?: string
  status: 'draft' | 'pending' | 'approved' | 'released' | 'rollback'
  targetDate: string
  releaseDate?: string
  services: ReleaseService[]
  signOffs: SignOff[]
  tags: string[]
  releaseNotes?: string
  commits: number
  pullRequests: number
  createdBy: string
  createdAt: string
}

interface ReleaseService {
  serviceId: string
  serviceName: string
  fromVersion: string
  toVersion: string
  changes: number
}

interface SignOff {
  id: string
  userId: string
  userName: string
  userRole: string
  signedAt: string
  comment?: string
  type: 'qa' | 'dev' | 'lead' | 'manager' | 'security'
}

interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isLoading?: boolean
}

interface FormSubmission {
  formId: string
  data: Record<string, any>
  submittedBy: string
  submittedAt: string
}

// Excel Export Types
interface ExcelExportConfig {
  sheetName: string
  columns: { key: string; header: string; width?: number }[]
  data: Record<string, any>[]
}

type TabId = 'services' | 'releases' | 'branches' | 'timeline' | 'forms' | 'ai'

// ============================================================================
// Icon Mapping
// ============================================================================

const serviceIconMap = {
  Server: Server,
  Database: Database,
  Globe: Globe,
  Smartphone: Smartphone,
  Terminal: Terminal,
  Box: Box
}

// ============================================================================
// Main Component
// ============================================================================

export default function ReleaseManagement() {
  const { isManager } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('services')
  const [services, setServices] = useState<Service[]>([])
  const [releases, setReleases] = useState<Release[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null)
  
  // AI Chat State
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [isAILoading, setIsAILoading] = useState(false)

  // Dynamic Form State
  const [showReleaseForm, setShowReleaseForm] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([])

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [servicesRes, releasesRes] = await Promise.all([
        apiClient.get('/release-management/services'),
        apiClient.get('/release-management')
      ])
      setServices(servicesRes.data)
      setReleases(releasesRes.data)
    } catch (error) {
      console.error('Failed to load release management data:', error)
      setServices([])
      setReleases([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const toggleServiceExpanded = (serviceId: string) => {
    setExpandedServices(prev => {
      const next = new Set(prev)
      if (next.has(serviceId)) {
        next.delete(serviceId)
      } else {
        next.add(serviceId)
      }
      return next
    })
  }

  const handleAISubmit = async () => {
    if (!aiInput.trim() || isAILoading) return
    
    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: aiInput,
      timestamp: new Date()
    }
    
    setAiMessages(prev => [...prev, userMessage])
    setAiInput('')
    setIsAILoading(true)
    
    // Add loading message
    const loadingId = Date.now().toString() + '-loading'
    setAiMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    }])
    
    try {
      const response = await apiClient.post('/ai-query/execute', {
        question: `About releases and deployments: ${aiInput}`,
        maxRows: 10
      })
      
      const assistantMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.data.success 
          ? formatAIResponse(response.data)
          : response.data.errorMessage || 'I could not find that information.',
        timestamp: new Date()
      }
      
      setAiMessages(prev => prev.filter(m => m.id !== loadingId).concat(assistantMessage))
    } catch (error) {
      console.error('AI query failed:', error)
      setAiMessages(prev => prev.filter(m => m.id !== loadingId).concat({
        id: Date.now().toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please ensure the release management backend is configured.',
        timestamp: new Date()
      }))
    } finally {
      setIsAILoading(false)
    }
  }

  // Excel Export Function
  const handleExportExcel = async (type: 'releases' | 'services' | 'all') => {
    setIsExporting(true)
    try {
      const exportData: ExcelExportConfig[] = []
      
      if (type === 'releases' || type === 'all') {
        exportData.push({
          sheetName: 'Releases',
          columns: [
            { key: 'version', header: 'Version', width: 15 },
            { key: 'name', header: 'Release Name', width: 30 },
            { key: 'status', header: 'Status', width: 12 },
            { key: 'targetDate', header: 'Target Date', width: 15 },
            { key: 'releaseDate', header: 'Release Date', width: 15 },
            { key: 'services', header: 'Services', width: 40 },
            { key: 'signOffs', header: 'Sign-offs', width: 30 },
            { key: 'commits', header: 'Commits', width: 10 },
            { key: 'pullRequests', header: 'PRs', width: 8 },
            { key: 'createdBy', header: 'Created By', width: 15 },
          ],
          data: releases.map(r => ({
            version: r.version,
            name: r.name,
            status: r.status,
            targetDate: r.targetDate,
            releaseDate: r.releaseDate || 'N/A',
            services: r.services.map(s => `${s.serviceName} (${s.fromVersion} → ${s.toVersion})`).join(', '),
            signOffs: r.signOffs.map(s => `${s.userName} (${s.type})`).join(', '),
            commits: r.commits,
            pullRequests: r.pullRequests,
            createdBy: r.createdBy
          }))
        })
      }
      
      if (type === 'services' || type === 'all') {
        exportData.push({
          sheetName: 'Services',
          columns: [
            { key: 'name', header: 'Service Name', width: 25 },
            { key: 'displayName', header: 'Display Name', width: 30 },
            { key: 'currentVersion', header: 'Current Version', width: 15 },
            { key: 'status', header: 'Status', width: 12 },
            { key: 'devVersion', header: 'Dev Version', width: 15 },
            { key: 'stagingVersion', header: 'Staging Version', width: 15 },
            { key: 'prodVersion', header: 'Prod Version', width: 15 },
            { key: 'repository', header: 'Repository', width: 35 },
          ],
          data: services.map(s => {
            const dev = s.deployedEnvironments.find(e => e.environment === 'development')
            const staging = s.deployedEnvironments.find(e => e.environment === 'staging')
            const prod = s.deployedEnvironments.find(e => e.environment === 'production')
            return {
              name: s.name,
              displayName: s.displayName,
              currentVersion: s.currentVersion,
              status: s.status,
              devVersion: dev?.version || 'N/A',
              stagingVersion: staging?.version || 'N/A',
              prodVersion: prod?.version || 'N/A',
              repository: s.repository
            }
          })
        })
      }
      
      // Call backend API to generate Excel
      const response = await apiClient.post('/release-management/export-excel', { sheets: exportData }, {
        responseType: 'blob'
      })
      
      // Download the file
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `release-report-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      // Fallback: Generate CSV
      generateCSVFallback(type)
    } finally {
      setIsExporting(false)
    }
  }
  
  // CSV Fallback export
  const generateCSVFallback = (type: 'releases' | 'services' | 'all') => {
    let csvContent = ''
    
    if (type === 'releases' || type === 'all') {
      csvContent += 'RELEASES\n'
      csvContent += 'Version,Name,Status,Target Date,Release Date,Commits,PRs,Created By\n'
      releases.forEach(r => {
        csvContent += `${r.version},"${r.name}",${r.status},${r.targetDate},${r.releaseDate || 'N/A'},${r.commits},${r.pullRequests},${r.createdBy}\n`
      })
      csvContent += '\n'
    }
    
    if (type === 'services' || type === 'all') {
      csvContent += 'SERVICES\n'
      csvContent += 'Name,Display Name,Current Version,Status,Repository\n'
      services.forEach(s => {
        csvContent += `${s.name},"${s.displayName}",${s.currentVersion},${s.status},"${s.repository}"\n`
      })
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `release-report-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
  
  // Handle form submission from dynamic form
  const handleFormSubmit = async (data: Record<string, any>) => {
    try {
      await apiClient.post('/release-management/form-submission', data)
      setShowReleaseForm(false)
      setFormSubmissions(prev => [...prev, {
        formId: 'release-request',
        data,
        submittedBy: 'current-user',
        submittedAt: new Date().toISOString()
      }])
      loadData() // Refresh data
    } catch (err) {
      console.error('Form submission failed:', err)
      // Still save locally for demo
      setFormSubmissions(prev => [...prev, {
        formId: 'release-request',
        data,
        submittedBy: 'current-user',
        submittedAt: new Date().toISOString()
      }])
      setShowReleaseForm(false)
    }
  }

  const tabs = [
    { id: 'services' as TabId, label: 'Services', icon: Server, count: services.length },
    { id: 'releases' as TabId, label: 'Releases', icon: Rocket, count: releases.length },
    { id: 'branches' as TabId, label: 'Branches', icon: GitBranch },
    { id: 'timeline' as TabId, label: 'Timeline', icon: History },
    { id: 'forms' as TabId, label: 'Forms & Export', icon: ClipboardList, count: formSubmissions.length > 0 ? formSubmissions.length : undefined },
    { id: 'ai' as TabId, label: 'AI Assistant', icon: Sparkles }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl blur-lg opacity-50" />
                <div className="relative p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg">
                  <Rocket className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Release Management
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Services • Branches • Releases • AI Assistant
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search services, versions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 border-0 rounded-xl text-sm placeholder-slate-400 focus:ring-2 focus:ring-violet-500"
                />
              </div>
              
              <button
                onClick={loadData}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
                Refresh
              </button>
              
              {/* Export Dropdown */}
              <div className="relative group">
                <button
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export
                  <ChevronDown className="w-3 h-3" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30">
                  <button
                    onClick={() => handleExportExcel('releases')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 first:rounded-t-xl"
                  >
                    <Rocket className="w-4 h-4" />
                    Export Releases
                  </button>
                  <button
                    onClick={() => handleExportExcel('services')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Server className="w-4 h-4" />
                    Export Services
                  </button>
                  <button
                    onClick={() => handleExportExcel('all')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 last:rounded-b-xl border-t border-slate-100 dark:border-slate-700"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export All
                  </button>
                </div>
              </div>
              
              {isManager && (
                <>
                  <button 
                    onClick={() => setShowReleaseForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Request Form
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/25">
                    <Plus className="w-4 h-4" />
                    New Release
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all',
                    isActive
                      ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-semibold',
                      isActive
                        ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'services' && (
            <ServicesTab 
              services={services}
              searchQuery={searchQuery}
              expandedServices={expandedServices}
              onToggleExpand={toggleServiceExpanded}
              isLoading={isLoading}
            />
          )}
          {activeTab === 'releases' && (
            <ReleasesTab 
              releases={releases}
              searchQuery={searchQuery}
              selectedRelease={selectedRelease}
              onSelectRelease={setSelectedRelease}
            />
          )}
          {activeTab === 'branches' && (
            <BranchesTab services={services} />
          )}
          {activeTab === 'timeline' && (
            <TimelineTab releases={releases} />
          )}
          {activeTab === 'forms' && (
            <FormsAndExportTab
              services={services}
              releases={releases}
              formSubmissions={formSubmissions}
              onExport={handleExportExcel}
              onOpenForm={() => setShowReleaseForm(true)}
              isExporting={isExporting}
            />
          )}
          {activeTab === 'ai' && (
            <AIAssistantTab
              messages={aiMessages}
              input={aiInput}
              onInputChange={setAiInput}
              onSubmit={handleAISubmit}
              isLoading={isAILoading}
              services={services}
              releases={releases}
            />
          )}
        </AnimatePresence>
      </main>
      
      {/* Dynamic Release Form Modal */}
      {showReleaseForm && (
        <DynamicFormModal
          onClose={() => setShowReleaseForm(false)}
          onSubmit={handleFormSubmit}
          services={services}
        />
      )}
    </div>
  )
}

// ============================================================================
// Services Tab
// ============================================================================

function ServicesTab({ 
  services, 
  searchQuery, 
  expandedServices, 
  onToggleExpand,
  isLoading 
}: { 
  services: Service[]
  searchQuery: string
  expandedServices: Set<string>
  onToggleExpand: (id: string) => void
  isLoading: boolean
}) {
  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.currentVersion.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }}
        className="flex items-center justify-center py-20"
      >
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredServices.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            isExpanded={expandedServices.has(service.id)}
            onToggle={() => onToggleExpand(service.id)}
          />
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Server className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">No services found</p>
        </div>
      )}
    </motion.div>
  )
}

function ServiceCard({ 
  service, 
  isExpanded, 
  onToggle 
}: { 
  service: Service
  isExpanded: boolean
  onToggle: () => void
}) {
  const Icon = serviceIconMap[service.icon] || Box
  
  const statusColors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    deploying: 'bg-blue-500 animate-pulse'
  }

  const envColors = {
    development: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    staging: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    production: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
  }

  return (
    <motion.div
      layout
      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div 
        className="p-5 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start gap-4">
          <div className={clsx(
            'p-3 rounded-xl',
            service.status === 'healthy' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
            service.status === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' :
            service.status === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
            'bg-blue-100 dark:bg-blue-900/30'
          )}>
            <Icon className={clsx(
              'w-6 h-6',
              service.status === 'healthy' ? 'text-emerald-600 dark:text-emerald-400' :
              service.status === 'warning' ? 'text-amber-600 dark:text-amber-400' :
              service.status === 'error' ? 'text-red-600 dark:text-red-400' :
              'text-blue-600 dark:text-blue-400'
            )} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                {service.displayName}
              </h3>
              <div className={clsx('w-2 h-2 rounded-full', statusColors[service.status])} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
              {service.name}
            </p>
            
            {/* Version Info */}
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-lg">
                <Tag className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                  {service.currentVersion}
                </span>
              </div>
              {service.previousVersion && (
                <span className="text-xs text-slate-400 line-through">
                  {service.previousVersion}
                </span>
              )}
            </div>
          </div>
          
          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-transform">
            <ChevronDown className={clsx(
              'w-5 h-5 transition-transform',
              isExpanded && 'rotate-180'
            )} />
          </button>
        </div>

        {/* Environment Pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {service.deployedEnvironments.map(env => (
            <div 
              key={env.environment}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
                envColors[env.environment]
              )}
            >
              {env.status === 'running' ? (
                <Play className="w-3 h-3" />
              ) : env.status === 'error' ? (
                <XCircle className="w-3 h-3" />
              ) : (
                <Pause className="w-3 h-3" />
              )}
              <span className="capitalize">{env.environment}</span>
              <span className="font-mono opacity-75">{env.version}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700 pt-4 space-y-4">
              {/* Deployment History */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Environment Deployments
                </h4>
                <div className="space-y-2">
                  {service.deployedEnvironments.map(env => (
                    <div 
                      key={env.environment}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <span className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium capitalize',
                          envColors[env.environment]
                        )}>
                          {env.environment}
                        </span>
                        <code className="text-sm text-slate-600 dark:text-slate-400">
                          {env.version}
                        </code>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {env.deployedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(env.deployedAt).toLocaleDateString()}
                        </span>
                        <code className="font-mono text-slate-400">
                          {env.commitHash.slice(0, 7)}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Branches */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  Active Branches
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {service.branches.slice(0, 4).map(branch => (
                    <div 
                      key={branch.name}
                      className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-sm"
                    >
                      <GitBranch className={clsx(
                        'w-3.5 h-3.5',
                        branch.type === 'main' ? 'text-emerald-500' :
                        branch.type === 'release' ? 'text-violet-500' :
                        branch.type === 'hotfix' ? 'text-red-500' :
                        'text-blue-500'
                      )} />
                      <span className="font-mono text-slate-600 dark:text-slate-400 truncate">
                        {branch.name}
                      </span>
                      {branch.buildStatus === 'success' && (
                        <CheckCircle className="w-3 h-3 text-emerald-500 ml-auto" />
                      )}
                      {branch.buildStatus === 'failure' && (
                        <XCircle className="w-3 h-3 text-red-500 ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================================================
// Releases Tab
// ============================================================================

function ReleasesTab({ 
  releases, 
  searchQuery,
  selectedRelease,
  onSelectRelease 
}: { 
  releases: Release[]
  searchQuery: string
  selectedRelease: Release | null
  onSelectRelease: (r: Release | null) => void
}) {
  const filteredReleases = releases.filter(r =>
    r.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const statusConfig = {
    draft: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', icon: FileText },
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: Clock },
    approved: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: CheckCircle },
    released: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', icon: Rocket },
    rollback: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: AlertTriangle }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {/* Release List */}
      <div className="lg:col-span-2 space-y-4">
        {filteredReleases.map(release => {
          const StatusIcon = statusConfig[release.status].icon
          return (
            <motion.div
              key={release.id}
              layout
              onClick={() => onSelectRelease(release)}
              className={clsx(
                'bg-white dark:bg-slate-800 rounded-2xl border-2 p-5 cursor-pointer transition-all',
                selectedRelease?.id === release.id
                  ? 'border-violet-500 shadow-lg shadow-violet-500/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-xl">
                    <Tag className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg text-violet-600 dark:text-violet-400">
                        {release.version}
                      </span>
                      <span className={clsx(
                        'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        statusConfig[release.status].bg,
                        statusConfig[release.status].text
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {release.status}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                      {release.name}
                    </p>
                  </div>
                </div>
                
                <div className="text-right text-sm">
                  <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1 justify-end">
                    <Calendar className="w-3.5 h-3.5" />
                    {release.releaseDate || release.targetDate}
                  </p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                    by {release.createdBy}
                  </p>
                </div>
              </div>

              {/* Services Affected */}
              <div className="flex flex-wrap gap-2 mb-4">
                {release.services.map(svc => (
                  <div 
                    key={svc.serviceId}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-xs"
                  >
                    <Box className="w-3 h-3 text-slate-500" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">{svc.serviceName}</span>
                    <span className="text-slate-400">
                      {svc.fromVersion} → {svc.toVersion}
                    </span>
                  </div>
                ))}
              </div>

              {/* Sign-offs */}
              {release.signOffs.length > 0 && (
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Signed by:</span>
                  <div className="flex -space-x-2">
                    {release.signOffs.slice(0, 5).map(signOff => (
                      <div
                        key={signOff.id}
                        title={`${signOff.userName} (${signOff.type})`}
                        className={clsx(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-white dark:border-slate-800',
                          signOff.type === 'qa' ? 'bg-blue-500' :
                          signOff.type === 'dev' ? 'bg-emerald-500' :
                          signOff.type === 'lead' ? 'bg-violet-500' :
                          signOff.type === 'manager' ? 'bg-amber-500' :
                          'bg-red-500'
                        )}
                      >
                        {signOff.userName.split(' ').map(n => n[0]).join('')}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400 ml-auto">
                    {release.signOffs.length} sign-off{release.signOffs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Tags */}
              {release.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {release.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded text-xs font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Release Details Sidebar */}
      <div className="lg:col-span-1">
        {selectedRelease ? (
          <ReleaseDetailPanel release={selectedRelease} onClose={() => onSelectRelease(null)} />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <Rocket className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              Select a release to view details
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ReleaseDetailPanel({ release, onClose }: { release: Release; onClose: () => void }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-24">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono font-bold text-xl text-violet-600 dark:text-violet-400">
            {release.version}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <p className="font-medium text-slate-700 dark:text-slate-300">{release.name}</p>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Dates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Target Date
            </span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {release.targetDate}
            </span>
          </div>
          {release.releaseDate && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Rocket className="w-4 h-4" /> Released
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {release.releaseDate}
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{release.commits}</p>
            <p className="text-xs text-slate-500">Commits</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{release.pullRequests}</p>
            <p className="text-xs text-slate-500">Pull Requests</p>
          </div>
        </div>

        {/* Sign-offs */}
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Sign-off History
          </h4>
          <div className="space-y-2">
            {release.signOffs.map(signOff => (
              <div 
                key={signOff.id}
                className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl"
              >
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0',
                  signOff.type === 'qa' ? 'bg-blue-500' :
                  signOff.type === 'dev' ? 'bg-emerald-500' :
                  signOff.type === 'lead' ? 'bg-violet-500' :
                  signOff.type === 'manager' ? 'bg-amber-500' :
                  'bg-red-500'
                )}>
                  {signOff.userName.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-slate-700 dark:text-slate-300">
                      {signOff.userName}
                    </span>
                    <span className="text-xs text-slate-400 uppercase">
                      {signOff.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(signOff.signedAt).toLocaleString()}
                  </p>
                  {signOff.comment && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 italic">
                      "{signOff.comment}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Release Notes */}
        {release.releaseNotes && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Release Notes
            </h4>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {release.releaseNotes}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Branches Tab
// ============================================================================

function BranchesTab({ services }: { services: Service[] }) {
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set(['pms-api', 'frontend']))
  
  const toggleRepo = (repo: string) => {
    setExpandedRepos(prev => {
      const next = new Set(prev)
      if (next.has(repo)) next.delete(repo)
      else next.add(repo)
      return next
    })
  }

  const branchTypeColors = {
    main: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    release: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400',
    feature: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    hotfix: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    develop: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {services.map(service => (
        <div 
          key={service.id}
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          {/* Repository Header */}
          <div 
            className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            onClick={() => toggleRepo(service.name)}
          >
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <GitBranch className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-white">{service.displayName}</h3>
              <p className="text-sm text-slate-500 font-mono">{service.repository}</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>{service.branches.length} branches</span>
              <ChevronRight className={clsx(
                'w-5 h-5 transition-transform',
                expandedRepos.has(service.name) && 'rotate-90'
              )} />
            </div>
          </div>

          {/* Branches List */}
          <AnimatePresence>
            {expandedRepos.has(service.name) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-slate-100 dark:border-slate-700">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr>
                        <th className="text-left py-3 px-5 text-xs font-medium text-slate-500 uppercase">Branch</th>
                        <th className="text-left py-3 px-5 text-xs font-medium text-slate-500 uppercase">Type</th>
                        <th className="text-left py-3 px-5 text-xs font-medium text-slate-500 uppercase">Last Commit</th>
                        <th className="text-left py-3 px-5 text-xs font-medium text-slate-500 uppercase">Author</th>
                        <th className="text-left py-3 px-5 text-xs font-medium text-slate-500 uppercase">Status</th>
                        <th className="text-left py-3 px-5 text-xs font-medium text-slate-500 uppercase">Ahead/Behind</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {service.branches.map(branch => (
                        <tr key={branch.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-2">
                              {branch.isProtected && (
                                <Shield className="w-3.5 h-3.5 text-amber-500" />
                              )}
                              <code className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {branch.name}
                              </code>
                            </div>
                          </td>
                          <td className="py-3 px-5">
                            <span className={clsx(
                              'px-2 py-0.5 rounded text-xs font-medium capitalize',
                              branchTypeColors[branch.type]
                            )}>
                              {branch.type}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-sm text-slate-500">
                            {branch.lastCommitDate}
                          </td>
                          <td className="py-3 px-5 text-sm text-slate-500">
                            {branch.lastCommitAuthor}
                          </td>
                          <td className="py-3 px-5">
                            {branch.buildStatus === 'success' && (
                              <span className="flex items-center gap-1 text-emerald-600 text-xs">
                                <CheckCircle className="w-3.5 h-3.5" /> Passing
                              </span>
                            )}
                            {branch.buildStatus === 'failure' && (
                              <span className="flex items-center gap-1 text-red-600 text-xs">
                                <XCircle className="w-3.5 h-3.5" /> Failed
                              </span>
                            )}
                            {branch.buildStatus === 'pending' && (
                              <span className="flex items-center gap-1 text-amber-600 text-xs">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-2 text-xs">
                              {branch.aheadBehind.ahead > 0 && (
                                <span className="text-emerald-600">↑{branch.aheadBehind.ahead}</span>
                              )}
                              {branch.aheadBehind.behind > 0 && (
                                <span className="text-red-500">↓{branch.aheadBehind.behind}</span>
                              )}
                              {branch.aheadBehind.ahead === 0 && branch.aheadBehind.behind === 0 && (
                                <span className="text-slate-400">up-to-date</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </motion.div>
  )
}

// ============================================================================
// Timeline Tab
// ============================================================================

function TimelineTab({ releases }: { releases: Release[] }) {
  const sortedReleases = [...releases].sort((a, b) => 
    new Date(b.releaseDate || b.targetDate).getTime() - new Date(a.releaseDate || a.targetDate).getTime()
  )

  const groupedByMonth = sortedReleases.reduce((acc, release) => {
    const date = new Date(release.releaseDate || release.targetDate)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!acc[key]) acc[key] = []
    acc[key].push(release)
    return acc
  }, {} as Record<string, Release[]>)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto"
    >
      {Object.entries(groupedByMonth).map(([month, monthReleases]) => {
        const date = new Date(month + '-01')
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        
        return (
          <div key={month} className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 sticky top-20 bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 py-2 z-10">
              {monthName}
            </h3>
            
            <div className="relative pl-8 border-l-2 border-slate-200 dark:border-slate-700 space-y-6">
              {monthReleases.map((release, index) => (
                <motion.div
                  key={release.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  {/* Timeline Node */}
                  <div className={clsx(
                    'absolute -left-[25px] w-4 h-4 rounded-full border-4 border-white dark:border-slate-900',
                    release.status === 'released' ? 'bg-emerald-500' :
                    release.status === 'approved' ? 'bg-blue-500' :
                    release.status === 'pending' ? 'bg-amber-500' :
                    'bg-slate-400'
                  )} />
                  
                  {/* Content Card */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 ml-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-violet-600 dark:text-violet-400">
                            {release.version}
                          </span>
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-xs font-medium capitalize',
                            release.status === 'released' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            release.status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            release.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          )}>
                            {release.status}
                          </span>
                        </div>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{release.name}</p>
                      </div>
                      <div className="text-right text-sm text-slate-500">
                        <p>{new Date(release.releaseDate || release.targetDate).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Services */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {release.services.map(svc => (
                        <span 
                          key={svc.serviceId}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          {svc.serviceName}: {svc.toVersion}
                        </span>
                      ))}
                    </div>

                    {/* Sign-offs Summary */}
                    {release.signOffs.length > 0 && (
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs text-slate-500">
                          Signed off by{' '}
                          {release.signOffs.map((s, i) => (
                            <span key={s.id}>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{s.userName}</span>
                              {i < release.signOffs.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )
      })}
    </motion.div>
  )
}

// ============================================================================
// AI Assistant Tab
// ============================================================================

function AIAssistantTab({ 
  messages, 
  input, 
  onInputChange, 
  onSubmit, 
  isLoading,
  services,
  releases
}: { 
  messages: AIMessage[]
  input: string
  onInputChange: (v: string) => void
  onSubmit: () => void
  isLoading: boolean
  services: Service[]
  releases: Release[]
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const suggestedQuestions = [
    "What version is currently deployed in production?",
    "Who signed off on the last release?",
    "Which branches have failing builds?",
    "Show me all releases in the last 30 days",
    "What services were updated in v2.6.0?",
    "List all hotfix branches"
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Release AI Assistant</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ask questions about releases, versions, and deployments
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Ask me anything about your releases and deployments
              </p>
              
              {/* Suggested Questions */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {suggestedQuestions.slice(0, 4).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onInputChange(q)}
                    className="p-3 text-left text-sm bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-400 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={clsx(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={clsx(
                    'max-w-[80%] rounded-2xl px-4 py-3',
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-md'
                  )}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <form 
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask about releases, versions, sign-offs..."
              className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-5 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{services.length}</p>
          <p className="text-sm text-slate-500">Services</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">{releases.length}</p>
          <p className="text-sm text-slate-500">Releases</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{releases.filter(r => r.status === 'released').length}</p>
          <p className="text-sm text-slate-500">Deployed</p>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatAIResponse(data: any): string {
  if (data.data && data.data.length > 0) {
    return `Found ${data.rowCount} results:\n\n${JSON.stringify(data.data, null, 2)}`
  }
  return data.generatedSql || 'Query executed successfully.'
}

// ============================================================================
// Forms & Export Tab

function FormsAndExportTab({
  services,
  releases,
  formSubmissions,
  onExport,
  onOpenForm,
  isExporting
}: {
  services: Service[]
  releases: Release[]
  formSubmissions: FormSubmission[]
  onExport: (type: 'releases' | 'services' | 'all') => void
  onOpenForm: () => void
  isExporting: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Export Options */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Export to Excel</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Generate Excel reports for releases and services</p>
            </div>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => onExport('releases')}
              disabled={isExporting}
              className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors group"
            >
              <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-xl group-hover:bg-violet-200 dark:group-hover:bg-violet-900/50 transition-colors">
                <Rocket className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-medium text-slate-900 dark:text-white">Export Releases</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{releases.length} releases with sign-offs and status</p>
              </div>
              <Download className="w-5 h-5 text-slate-400 group-hover:text-violet-500 transition-colors" />
            </button>
            
            <button
              onClick={() => onExport('services')}
              disabled={isExporting}
              className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors group"
            >
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-medium text-slate-900 dark:text-white">Export Services</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{services.length} services with deployment info</p>
              </div>
              <Download className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
            </button>
            
            <button
              onClick={() => onExport('all')}
              disabled={isExporting}
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 hover:from-emerald-100 hover:to-teal-100 dark:hover:from-emerald-900/30 dark:hover:to-teal-900/30 rounded-xl transition-colors group border-2 border-emerald-200 dark:border-emerald-800"
            >
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">Export Everything</h4>
                <p className="text-sm text-emerald-600/70 dark:text-emerald-500/70">Full report with all sheets</p>
              </div>
              {isExporting ? (
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
              ) : (
                <Download className="w-5 h-5 text-emerald-600" />
              )}
            </button>
          </div>
          
          {/* Azure Blob Info */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">Azure Blob Storage</h4>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                  Exported files can be automatically saved to Azure Blob Storage for archival. Configure in Settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Dynamic Forms */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Release Request Forms</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Collect release details from managers</p>
              </div>
            </div>
            <button
              onClick={onOpenForm}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all text-sm font-medium shadow-lg shadow-blue-500/25"
            >
              <Plus className="w-4 h-4" />
              New Request
            </button>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Form Templates */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Available Forms</h4>
            <div className="space-y-2">
              <div 
                onClick={onOpenForm}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors"
              >
                <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                  <Rocket className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-slate-900 dark:text-white">Release Request Form</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Request a new release deployment</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl opacity-50 cursor-not-allowed">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-slate-900 dark:text-white">Sign-off Approval</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Coming soon</p>
                </div>
                <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Soon</span>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl opacity-50 cursor-not-allowed">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-slate-900 dark:text-white">Hotfix Request</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Coming soon</p>
                </div>
                <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">Soon</span>
              </div>
            </div>
          </div>
          
          {/* Recent Submissions */}
          {formSubmissions.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Recent Submissions</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {formSubmissions.map((submission, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {submission.data.releaseName || 'Release Request'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Submitted {new Date(submission.submittedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Dynamic Form Modal
// ============================================================================

function DynamicFormModal({
  onClose,
  onSubmit,
  services
}: {
  onClose: () => void
  onSubmit: (data: Record<string, any>) => void
  services: Service[]
}) {
  const [formData, setFormData] = useState<Record<string, any>>({
    releaseName: '',
    version: '',
    description: '',
    targetDate: '',
    priority: 'normal',
    services: [],
    requiresSignoff: true,
    signoffTypes: ['qa', 'lead'],
    releaseNotes: '',
    tags: [],
    notifyOnApproval: true
  })
  const [currentTag, setCurrentTag] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when field is changed
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }))
      setCurrentTag('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((t: string) => t !== tag)
    }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.releaseName.trim()) {
      newErrors.releaseName = 'Release name is required'
    }
    if (!formData.version.trim()) {
      newErrors.version = 'Version is required'
    } else if (!/^v?\d+\.\d+\.\d+/.test(formData.version)) {
      newErrors.version = 'Version must be in format v1.0.0 or 1.0.0'
    }
    if (!formData.targetDate) {
      newErrors.targetDate = 'Target date is required'
    }
    if (formData.services.length === 0) {
      newErrors.services = 'At least one service must be selected'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    
    setIsSubmitting(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'text-slate-600 bg-slate-100 dark:bg-slate-700' },
    { value: 'normal', label: 'Normal', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
    { value: 'high', label: 'High', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30' },
    { value: 'critical', label: 'Critical', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' }
  ]

  const signoffOptions = [
    { value: 'qa', label: 'QA Lead' },
    { value: 'dev', label: 'Dev Lead' },
    { value: 'lead', label: 'Tech Lead' },
    { value: 'manager', label: 'Manager' },
    { value: 'security', label: 'Security' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Release Request Form</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Fill in the details to request a new release</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Form Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Release Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.releaseName}
                  onChange={(e) => handleFieldChange('releaseName', e.target.value)}
                  placeholder="e.g., Q2 Feature Release"
                  className={clsx(
                    'w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent',
                    errors.releaseName ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                  )}
                />
                {errors.releaseName && <p className="text-xs text-red-500 mt-1">{errors.releaseName}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Version <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => handleFieldChange('version', e.target.value)}
                  placeholder="e.g., v2.7.0"
                  className={clsx(
                    'w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent',
                    errors.version ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                  )}
                />
                {errors.version && <p className="text-xs text-red-500 mt-1">{errors.version}</p>}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Brief description of the release..."
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => handleFieldChange('targetDate', e.target.value)}
                  className={clsx(
                    'w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent',
                    errors.targetDate ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                  )}
                />
                {errors.targetDate && <p className="text-xs text-red-500 mt-1">{errors.targetDate}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Priority
                </label>
                <div className="flex gap-2">
                  {priorityOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleFieldChange('priority', opt.value)}
                      className={clsx(
                        'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        formData.priority === opt.value
                          ? `${opt.color} ring-2 ring-offset-2 ring-current`
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Section 2: Services */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4" />
              Services to Release <span className="text-red-500">*</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              {services.map(service => (
                <label
                  key={service.id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                    formData.services.includes(service.id)
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={formData.services.includes(service.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleFieldChange('services', [...formData.services, service.id])
                      } else {
                        handleFieldChange('services', formData.services.filter((id: string) => id !== service.id))
                      }
                    }}
                    className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {service.displayName}
                    </p>
                    <p className="text-xs text-slate-500">{service.currentVersion}</p>
                  </div>
                </label>
              ))}
            </div>
            {errors.services && <p className="text-xs text-red-500">{errors.services}</p>}
          </div>
          
          {/* Section 3: Sign-offs */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Sign-off Requirements
              </h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.requiresSignoff}
                  onChange={(e) => handleFieldChange('requiresSignoff', e.target.checked)}
                  className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
                />
                <span className="text-slate-600 dark:text-slate-400">Requires sign-off</span>
              </label>
            </div>
            
            {formData.requiresSignoff && (
              <div className="flex flex-wrap gap-2">
                {signoffOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (formData.signoffTypes.includes(opt.value)) {
                        handleFieldChange('signoffTypes', formData.signoffTypes.filter((t: string) => t !== opt.value))
                      } else {
                        handleFieldChange('signoffTypes', [...formData.signoffTypes, opt.value])
                      }
                    }}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      formData.signoffTypes.includes(opt.value)
                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 ring-1 ring-violet-400'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Section 4: Release Notes & Tags */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Release Notes & Tags
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Release Notes
              </label>
              <textarea
                value={formData.releaseNotes}
                onChange={(e) => handleFieldChange('releaseNotes', e.target.value)}
                placeholder="- Feature 1: Description&#10;- Bug fix: Description&#10;- Improvement: Description"
                rows={4}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-mono focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag: string) => (
                    <span 
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-lg text-xs"
                    >
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Notification Toggle */}
            <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={formData.notifyOnApproval}
                onChange={(e) => handleFieldChange('notifyOnApproval', e.target.checked)}
                className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Notify on approval</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Send email notification when all sign-offs are complete</p>
              </div>
            </label>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:from-violet-600 hover:to-purple-700 transition-all text-sm font-medium shadow-lg shadow-violet-500/25 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit Request
          </button>
        </div>
      </motion.div>
    </div>
  )
}
