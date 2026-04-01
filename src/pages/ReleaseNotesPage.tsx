import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, Settings, RefreshCw, CheckCircle,
  Lock, Unlock, Download, Eye, Edit2, FolderOpen, Upload, Play, 
  Server, Tag, Clock, Sparkles, ListTree, Search
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'
import useAzureHub from '../hooks/useAzureHub'
import releaseNotesService, {
  type ReleaseNote,
  type ReleaseConfiguration,
  type ReleaseNoteTemplate,
  type AzureDevOpsConnection,
  type NextVersionSuggestion,
  type AzureDevOpsUser,
  type AzureDevOpsOrganization,
  type AzureDevOpsProject
} from '../services/releaseNotesService'

type TabId = 'releases' | 'create' | 'templates' | 'settings'

// Main Component
export default function ReleaseNotesPage() {
  const { isManager } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('releases')
  const [isLoading, setIsLoading] = useState(false)
  
  // Data state
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([])
  const [configurations, setConfigurations] = useState<ReleaseConfiguration[]>([])
  const [connections, setConnections] = useState<AzureDevOpsConnection[]>([])

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [notes, configs, conns] = await Promise.all([
        releaseNotesService.getReleaseNotes(),
        releaseNotesService.getConfigurations(),
        releaseNotesService.getConnections()
      ])
      setReleaseNotes(notes)
      setConfigurations(configs)
      setConnections(conns)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const tabs = [
    { id: 'releases' as TabId, label: 'Release Notes', icon: FileText },
    { id: 'create' as TabId, label: 'Create Release', icon: Plus },
    ...(isManager ? [
      { id: 'templates' as TabId, label: 'Templates', icon: FolderOpen },
      { id: 'settings' as TabId, label: 'Azure DevOps', icon: Server }
    ] : [])
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Release Notes Generator</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Create and manage release notes with Azure DevOps integration
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
                Refresh
              </button>
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
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600'
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
          {activeTab === 'releases' && (
            <ReleaseNotesListTab 
              releaseNotes={releaseNotes} 
              onRefresh={loadData}
            />
          )}
          {activeTab === 'create' && (
            <CreateReleaseTab 
              configurations={configurations}
              connections={connections}
              onCreated={loadData}
            />
          )}
          {activeTab === 'templates' && isManager && (
            <TemplatesTab onRefresh={loadData} />
          )}
          {activeTab === 'settings' && isManager && (
            <AzureDevOpsSettingsTab 
              connections={connections}
              onRefresh={loadData}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// Release Notes List Tab
function ReleaseNotesListTab({ releaseNotes, onRefresh: _onRefresh }: { releaseNotes: ReleaseNote[]; onRefresh: () => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedNote, setSelectedNote] = useState<ReleaseNote | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)

  const handleView = (note: ReleaseNote) => {
    setSelectedNote(note)
    setShowViewModal(true)
  }

  const handleEdit = (note: ReleaseNote) => {
    // For now, just show an alert - full edit functionality could be added later
    alert(`Edit functionality for "${note.releaseName}" (v${note.releaseVersion}) coming soon!`)
  }

  const handleDownload = async (note: ReleaseNote) => {
    try {
      // Trigger download via API
      const response = await fetch(`/api/release-notes/${note.id}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${note.releaseName}-v${note.releaseVersion}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        alert('Download not available for this release note')
      }
    } catch (error) {
      console.error('Download failed:', error)
      alert('Download failed. The DOCX file may not be generated yet.')
    }
  }

  const filteredNotes = releaseNotes.filter(note => {
    const matchesSearch = !searchQuery || 
      note.releaseVersion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.releaseName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || note.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusColors: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    InProgress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PendingReview: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Archived: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Release Notes" 
          value={releaseNotes.length.toString()} 
          icon={<FileText className="w-5 h-5" />}
          color="emerald"
        />
        <MetricCard 
          title="In Progress" 
          value={releaseNotes.filter(n => n.status === 'InProgress').length.toString()} 
          icon={<Edit2 className="w-5 h-5" />}
          color="blue"
        />
        <MetricCard 
          title="Pending Review" 
          value={releaseNotes.filter(n => n.status === 'PendingReview').length.toString()} 
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
        />
        <MetricCard 
          title="Published" 
          value={releaseNotes.filter(n => n.status === 'Published').length.toString()} 
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Release Notes</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search releases..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Status</option>
              <option value="Draft">Draft</option>
              <option value="InProgress">In Progress</option>
              <option value="PendingReview">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Published">Published</option>
            </select>
          </div>
        </div>
        
        {filteredNotes.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No release notes found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Create your first release note to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Version</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Release Date</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Lock</th>
                  <th className="text-right py-3 px-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredNotes.map(note => (
                  <tr key={note.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-4 px-6">
                      <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{note.releaseVersion}</span>
                    </td>
                    <td className="py-4 px-6 text-gray-900 dark:text-white">{note.releaseName}</td>
                    <td className="py-4 px-6">
                      <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', statusColors[note.status])}>
                        {note.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {new Date(note.releaseDate).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-gray-500">{note.assignedUserName || '-'}</td>
                    <td className="py-4 px-6">
                      {note.isLocked ? (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Lock className="w-4 h-4" />
                          <span className="text-xs">{note.lockedByUserName}</span>
                        </span>
                      ) : (
                        <Unlock className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleView(note)}
                          title="View details"
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEdit(note)}
                          title="Edit release note"
                          className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDownload(note)}
                          title="Download DOCX"
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Release Note Modal */}
      {showViewModal && selectedNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedNote.releaseName}</h3>
                <p className="text-sm text-gray-500">Version {selectedNote.releaseVersion}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-600">
                <Settings className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Status</span>
                  <span className="text-sm font-medium">{selectedNote.status}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Release Date</span>
                  <span className="text-sm">{selectedNote.releaseDate ? new Date(selectedNote.releaseDate).toLocaleDateString() : 'Not set'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Assigned To</span>
                  <span className="text-sm">{selectedNote.assignedUserName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Created</span>
                  <span className="text-sm">{selectedNote.createdAt ? new Date(selectedNote.createdAt).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
              {selectedNote.templateName && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <span className="text-xs text-gray-500 block mb-1">Template</span>
                  <span className="text-sm font-medium">{selectedNote.templateName}</span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => { setShowViewModal(false); handleEdit(selectedNote) }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// Create Release Tab
function CreateReleaseTab({ 
  configurations, 
  connections: _connections,
  onCreated 
}: { 
  configurations: ReleaseConfiguration[]
  connections: AzureDevOpsConnection[]
  onCreated: () => void 
}) {
  const [selectedConfigId, setSelectedConfigId] = useState<string>('')
  const [nextVersion, setNextVersion] = useState<NextVersionSuggestion | null>(null)
  const [users, setUsers] = useState<AzureDevOpsUser[]>([])
  const [_isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    releaseVersion: '',
    releaseName: '',
    releaseDate: new Date().toISOString().split('T')[0],
    assignedUserName: '',
    buildName: '',
    dockerImageName: '',
    description: ''
  })

  // Load next version when config changes
  useEffect(() => {
    const loadConfigData = async () => {
      if (!selectedConfigId) {
        setNextVersion(null)
        return
      }

      setIsLoading(true)
      try {
        const suggestion = await releaseNotesService.getNextVersion(selectedConfigId)
        setNextVersion(suggestion)
        setFormData(f => ({
          ...f,
          releaseVersion: suggestion.suggestedVersion
        }))

        // Load users from connected Azure DevOps
        const config = configurations.find(c => c.id === selectedConfigId)
        if (config?.azureDevOpsConnectionId) {
          const connectionUsers = await releaseNotesService.getConnectionUsers(config.azureDevOpsConnectionId)
          setUsers(connectionUsers)
        }
      } catch (error) {
        console.error('Failed to load config data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadConfigData()
  }, [selectedConfigId, configurations])

  const handleCreate = async () => {
    if (!selectedConfigId) return

    setIsCreating(true)
    try {
      await releaseNotesService.createReleaseNote({
        configurationId: selectedConfigId,
        releaseVersion: formData.releaseVersion,
        releaseDate: formData.releaseDate,
        releaseName: formData.releaseName || `Release ${formData.releaseVersion}`,
        assignedUserName: formData.assignedUserName,
        buildName: formData.buildName,
        dockerImageName: formData.dockerImageName,
        description: formData.description
      })
      onCreated()
      // Reset form
      setFormData({
        releaseVersion: '',
        releaseName: '',
        releaseDate: new Date().toISOString().split('T')[0],
        assignedUserName: '',
        buildName: '',
        dockerImageName: '',
        description: ''
      })
      setSelectedConfigId('')
    } catch (error) {
      console.error('Failed to create release:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            Create New Release Note
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Select a configuration and fill in the release details
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Configuration Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Release Configuration *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {configurations.length === 0 ? (
                <div className="col-span-full p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-center">
                  <Settings className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No configurations found</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Create a template and configuration first</p>
                </div>
              ) : (
                configurations.map(config => (
                  <button
                    key={config.id}
                    onClick={() => setSelectedConfigId(config.id)}
                    className={clsx(
                      'p-4 rounded-lg border-2 text-left transition-all',
                      selectedConfigId === config.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">{config.name}</span>
                      {selectedConfigId === config.id && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{config.templateName}</p>
                    {config.lastReleaseVersion && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Tag className="w-3 h-3" />
                        <span>Last: {config.lastReleaseVersion}</span>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedConfigId && (
            <>
              {/* Version Info */}
              {nextVersion && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Suggested Version</h4>
                      <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {nextVersion.suggestedVersion}
                      </p>
                    </div>
                    <div className="text-right text-sm text-emerald-700 dark:text-emerald-400">
                      <p>Release #{nextVersion.serialNumber} for {new Date(nextVersion.releaseDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Release Version *
                  </label>
                  <input
                    type="text"
                    value={formData.releaseVersion}
                    onChange={(e) => setFormData(f => ({ ...f, releaseVersion: e.target.value }))}
                    placeholder="e.g., 26.2.0"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Release Date *
                  </label>
                  <input
                    type="date"
                    value={formData.releaseDate}
                    onChange={(e) => setFormData(f => ({ ...f, releaseDate: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Release Name
                  </label>
                  <input
                    type="text"
                    value={formData.releaseName}
                    onChange={(e) => setFormData(f => ({ ...f, releaseName: e.target.value }))}
                    placeholder="e.g., Security Patch Release"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Assigned User
                  </label>
                  <select
                    value={formData.assignedUserName}
                    onChange={(e) => setFormData(f => ({ ...f, assignedUserName: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select user...</option>
                    {users.map((user, i) => (
                      <option key={i} value={user.displayName || ''}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Build Name
                  </label>
                  <input
                    type="text"
                    value={formData.buildName}
                    onChange={(e) => setFormData(f => ({ ...f, buildName: e.target.value }))}
                    placeholder="e.g., build-2026.03.24.001"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Docker Image Name
                  </label>
                  <input
                    type="text"
                    value={formData.dockerImageName}
                    onChange={(e) => setFormData(f => ({ ...f, dockerImageName: e.target.value }))}
                    placeholder="e.g., myapp:v26.2.0"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Brief description of this release..."
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={handleCreate}
            disabled={!selectedConfigId || !formData.releaseVersion || isCreating}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Release Note
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Guide */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          How Release Notes Generation Works
        </h4>
        <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-medium">1</span>
            <span>Select a release configuration (links template + Azure DevOps)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-medium">2</span>
            <span>Fill in release details (version, date, assigned user)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-medium">3</span>
            <span>Fetch work items from Azure DevOps based on selected user</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-medium">4</span>
            <span>Review, edit, and generate the DOCX document</span>
          </li>
        </ol>
      </div>
    </motion.div>
  )
}

// Templates Tab (Manager Only)
function TemplatesTab({ onRefresh: _onRefresh }: { onRefresh: () => void }) {
  const [templates, setTemplates] = useState<ReleaseNoteTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ReleaseNoteTemplate | null>(null)
  const [showMappingEditor, setShowMappingEditor] = useState(false)
  const [showConfigEditor, setShowConfigEditor] = useState(false)

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await releaseNotesService.getTemplates()
        setTemplates(data)
      } catch (error) {
        console.error('Failed to load templates:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadTemplates()
  }, [])

  const handleUpload = async (formData: FormData) => {
    try {
      await releaseNotesService.createTemplate(formData)
      const data = await releaseNotesService.getTemplates()
      setTemplates(data)
      setShowUpload(false)
    } catch (error) {
      console.error('Failed to upload template:', error)
    }
  }

  const handleEditMappings = (template: ReleaseNoteTemplate) => {
    setSelectedTemplate(template)
    setShowMappingEditor(true)
  }

  const handleConfigure = (template: ReleaseNoteTemplate) => {
    setSelectedTemplate(template)
    setShowConfigEditor(true)
  }

  const handleCloseEditor = () => {
    setSelectedTemplate(null)
    setShowMappingEditor(false)
    setShowConfigEditor(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Release Note Templates</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage DOCX templates and configure table mappings
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Upload className="w-4 h-4" />
          Upload Template
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No templates yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Upload a DOCX template to get started</p>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Upload Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  v{template.version}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{template.name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{template.description || 'No description'}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <ListTree className="w-3 h-3" />
                  {template.tableCount || 0} tables
                </span>
                <span className="flex items-center gap-1">
                  <Edit2 className="w-3 h-3" />
                  {template.dynamicFieldCount || 0} fields
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                <button 
                  onClick={() => handleEditMappings(template)}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Edit Mappings
                </button>
                <button 
                  onClick={() => handleConfigure(template)}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                >
                  Configure
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadTemplateModal
          onClose={() => setShowUpload(false)}
          onUpload={handleUpload}
        />
      )}

      {/* Template Mapping Editor Modal */}
      {showMappingEditor && selectedTemplate && (
        <TemplateMappingEditor
          template={selectedTemplate}
          onClose={handleCloseEditor}
          onSave={async () => {
            const data = await releaseNotesService.getTemplates()
            setTemplates(data)
            handleCloseEditor()
          }}
        />
      )}

      {/* Template Config Editor Modal */}
      {showConfigEditor && selectedTemplate && (
        <TemplateConfigEditor
          template={selectedTemplate}
          onClose={handleCloseEditor}
          onSave={async () => {
            const data = await releaseNotesService.getTemplates()
            setTemplates(data)
            handleCloseEditor()
          }}
        />
      )}
    </motion.div>
  )
}

// Azure DevOps Settings Tab
function AzureDevOpsSettingsTab({ 
  connections, 
  onRefresh 
}: { 
  connections: AzureDevOpsConnection[]
  onRefresh: () => void 
}) {
  const [showAddConnection, setShowAddConnection] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  
  // Use SignalR for DevOps discovery (no timeouts)
  const { 
    isConnected: isHubConnected,
    discoverDevOpsOrganizations,
    discoverDevOpsProjects,
    testDevOpsConnection,
    operationProgress
  } = useAzureHub()

  const handleTest = async (connectionId: string) => {
    setTestingId(connectionId)
    try {
      const result = await releaseNotesService.testConnection(connectionId)
      if (result.success) {
        onRefresh()
      }
    } catch (error) {
      console.error('Test failed:', error)
    } finally {
      setTestingId(null)
    }
  }

  const handleSync = async (connectionId: string) => {
    setSyncingId(connectionId)
    try {
      await releaseNotesService.syncConnection(connectionId)
      onRefresh()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncingId(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Azure DevOps Connections</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Connect to Azure DevOps to fetch work items
          </p>
        </div>
        <button
          onClick={() => setShowAddConnection(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Connection
        </button>
      </div>

      {connections.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Server className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No connections configured</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Add an Azure DevOps connection to get started</p>
          <button
            onClick={() => setShowAddConnection(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Connection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map(conn => (
            <div
              key={conn.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'p-2 rounded-lg',
                    conn.lastSyncStatus === 'Connected' || conn.lastSyncStatus === 'Synced'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  )}>
                    <Server className={clsx(
                      'w-5 h-5',
                      conn.lastSyncStatus === 'Connected' || conn.lastSyncStatus === 'Synced'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-600 dark:text-gray-400'
                    )} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{conn.connectionName}</h4>
                    <p className="text-sm text-gray-500">{conn.projectName}</p>
                  </div>
                </div>
                {(conn.lastSyncStatus === 'Connected' || conn.lastSyncStatus === 'Synced') && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                <p className="truncate">{conn.organizationUrl}</p>
                {conn.lastSyncAt && (
                  <p className="text-xs mt-1">Last synced: {new Date(conn.lastSyncAt).toLocaleString()}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleTest(conn.id)}
                  disabled={testingId === conn.id}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  {testingId === conn.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Test
                </button>
                <button
                  onClick={() => handleSync(conn.id)}
                  disabled={syncingId === conn.id}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                >
                  {syncingId === conn.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Sync
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Connection Modal */}
      {showAddConnection && (
        <AddConnectionModal
          onClose={() => setShowAddConnection(false)}
          onSave={async (request) => {
            await releaseNotesService.createConnection(request)
            onRefresh()
            setShowAddConnection(false)
          }}
          useSignalR={isHubConnected}
          discoverOrganizations={discoverDevOpsOrganizations}
          discoverProjects={discoverDevOpsProjects}
          testConnection={testDevOpsConnection}
          operationProgress={operationProgress}
        />
      )}
    </motion.div>
  )
}

// Metric Card Component
function MetricCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
        </div>
        <div className={clsx('p-3 rounded-lg', colors[color])}>
          {icon}
        </div>
      </div>
    </div>
  )
}

// Upload Template Modal
function UploadTemplateModal({ onClose, onUpload }: { onClose: () => void; onUpload: (formData: FormData) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = () => {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('description', description)
    if (file) {
      formData.append('templateFile', file)
    }
    onUpload(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Template</h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Versa Release Notes"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              DOCX Template File
            </label>
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  )
}

// Add Connection Modal
interface AddConnectionModalProps {
  onClose: () => void
  onSave: (request: any) => void
  useSignalR?: boolean
  discoverOrganizations?: () => Promise<{ success: boolean; message?: string; organizations?: Array<{ id: string; name: string; url: string }> }>
  discoverProjects?: (organizationUrl: string) => Promise<{ success: boolean; message?: string; projects?: Array<{ id: string; name: string; description?: string; state?: string }> }>
  testConnection?: (organizationUrl: string, projectName: string) => Promise<{ success: boolean; message: string }>
  operationProgress?: { message: string; current?: number; total?: number } | null
}

function AddConnectionModal({ 
  onClose, 
  onSave,
  useSignalR = false,
  discoverOrganizations,
  discoverProjects,
  testConnection,
  operationProgress
}: AddConnectionModalProps) {
  const [formData, setFormData] = useState({
    connectionName: '',
    organizationUrl: '',
    projectName: ''
  })
  const [organizations, setOrganizations] = useState<AzureDevOpsOrganization[]>([])
  const [projects, setProjects] = useState<AzureDevOpsProject[]>([])
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [useManualEntry, setUseManualEntry] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)

  // Auto-discover organizations on mount
  useEffect(() => {
    if (!useManualEntry) {
      loadOrganizations()
    }
  }, [useManualEntry])

  const loadOrganizations = async () => {
    setIsLoadingOrgs(true)
    setDiscoveryError(null)
    try {
      // Use SignalR if available (no timeouts)
      if (useSignalR && discoverOrganizations) {
        const result = await discoverOrganizations()
        if (result.success && result.organizations) {
          // Map to existing interface format
          const orgs = result.organizations.map(o => ({
            accountId: o.id,
            accountName: o.name,
            accountUri: o.url
          }))
          setOrganizations(orgs)
          if (orgs.length === 0) {
            setDiscoveryError('No organizations found. Make sure you are logged in with Azure CLI (az login).')
          }
        } else {
          setDiscoveryError(result.message || 'Failed to discover organizations.')
          setOrganizations([])
        }
      } else {
        // Fallback to REST API
        const orgs = await releaseNotesService.discoverOrganizations()
        setOrganizations(orgs)
        if (orgs.length === 0) {
          setDiscoveryError('No organizations found. Make sure you are logged in with Azure CLI (az login).')
        }
      }
    } catch (err: any) {
      setDiscoveryError(err.message || 'Failed to discover organizations. Try manual entry.')
      setOrganizations([])
    } finally {
      setIsLoadingOrgs(false)
    }
  }

  const handleOrgChange = async (orgUrl: string) => {
    setFormData(f => ({ ...f, organizationUrl: orgUrl, projectName: '' }))
    setProjects([])
    setTestResult(null)
    
    if (orgUrl) {
      setIsLoadingProjects(true)
      try {
        // Use SignalR if available (no timeouts)
        if (useSignalR && discoverProjects) {
          const result = await discoverProjects(orgUrl)
          if (result.success && result.projects) {
            setProjects(result.projects.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description,
              state: p.state
            })))
          } else {
            setProjects([])
          }
        } else {
          // Fallback to REST API
          const projs = await releaseNotesService.discoverProjects(orgUrl)
          setProjects(projs)
        }
      } catch {
        setProjects([])
      } finally {
        setIsLoadingProjects(false)
      }
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      // Use SignalR if available (no timeouts)
      if (useSignalR && testConnection) {
        const result = await testConnection(formData.organizationUrl, formData.projectName)
        setTestResult({ success: result.success, message: result.message })
      } else {
        // Fallback to REST API
        const result = await releaseNotesService.testDiscoveredConnection(
          formData.organizationUrl,
          formData.projectName
        )
        setTestResult({ success: result.success, message: result.message })
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Test failed' })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Azure DevOps Connection</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {useManualEntry ? 'Enter connection details manually' : 'Auto-discovered from Azure CLI'}
          </p>
        </div>
        <div className="p-6 space-y-4">
          {/* Toggle between auto-discovery and manual entry */}
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {useManualEntry ? 'Switch to auto-discovery' : 'Switch to manual entry'}
            </span>
            <button
              onClick={() => {
                setUseManualEntry(!useManualEntry)
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {useManualEntry ? 'Use Azure CLI' : 'Enter manually'}
            </button>
          </div>

          {discoveryError && !useManualEntry && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-300">{discoveryError}</p>
              <button
                onClick={() => setUseManualEntry(true)}
                className="mt-2 text-sm text-amber-600 hover:underline"
              >
                Try manual entry instead
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Connection Name *
            </label>
            <input
              type="text"
              value={formData.connectionName}
              onChange={(e) => setFormData(f => ({ ...f, connectionName: e.target.value }))}
              placeholder="e.g., VisualOne DevOps"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>

          {useManualEntry ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization URL *
                </label>
                <input
                  type="url"
                  value={formData.organizationUrl}
                  onChange={(e) => setFormData(f => ({ ...f, organizationUrl: e.target.value }))}
                  placeholder="https://dev.azure.com/yourorg"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => setFormData(f => ({ ...f, projectName: e.target.value }))}
                  placeholder="MyProject"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization *
                </label>
                {isLoadingOrgs ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-gray-500">
                      {operationProgress?.message || 'Discovering organizations...'}
                    </span>
                  </div>
                ) : (
                  <select
                    value={formData.organizationUrl}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="">Select an organization</option>
                    {organizations.map(org => (
                      <option key={org.accountId} value={org.accountUri}>
                        {org.accountName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project *
                </label>
                {isLoadingProjects ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-gray-500">Loading projects...</span>
                  </div>
                ) : (
                  <select
                    value={formData.projectName}
                    onChange={(e) => {
                      setFormData(f => ({ ...f, projectName: e.target.value }))
                      setTestResult(null)
                    }}
                    disabled={!formData.organizationUrl}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                  >
                    <option value="">Select a project</option>
                    {projects.map(proj => (
                      <option key={proj.id} value={proj.name}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          {/* Test Connection Button */}
          {formData.organizationUrl && formData.projectName && (
            <div className="pt-2">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Server className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </button>
              {testResult && (
                <div className={clsx(
                  'mt-2 p-3 rounded-lg text-sm',
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                )}>
                  {testResult.success ? <CheckCircle className="w-4 h-4 inline mr-2" /> : null}
                  {testResult.message}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={
              !formData.connectionName || 
              !formData.organizationUrl || 
              !formData.projectName
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Save Connection
          </button>
        </div>
      </div>
    </div>
  )
}

// Template Mapping Editor Modal - Edit table mappings for a template
function TemplateMappingEditor({ 
  template, 
  onClose, 
  onSave 
}: { 
  template: ReleaseNoteTemplate
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [tableName, setTableName] = useState('')
  const [workItemType, setWorkItemType] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const workItemTypes = ['Bug', 'User Story', 'Task', 'Feature', 'Epic', 'Issue', 'Product Backlog Item']

  const handleAddMapping = async () => {
    if (!tableName || !workItemType) {
      setError('Please fill in all fields')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await releaseNotesService.addTableMapping(template.id, {
        tableName,
        workItemTypes: workItemType
      })
      setSuccess(`Added mapping for "${tableName}"`)
      setTableName('')
      setWorkItemType('')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to add mapping')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Table Mappings</h3>
            <p className="text-sm text-gray-500">{template.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Settings className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Current Mappings */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Mappings</h4>
            {template.tableCount === 0 ? (
              <p className="text-sm text-gray-500 italic">No mappings configured</p>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400">{template.tableCount} table(s) mapped</span>
              </div>
            )}
          </div>

          {/* Add New Mapping */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add Table Mapping</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Table Name in DOCX</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="e.g., BugFixesTable, FeaturesTable"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Work Item Type</label>
                <select
                  value={workItemType}
                  onChange={(e) => setWorkItemType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  <option value="">Select work item type...</option>
                  {workItemTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              {error && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>
              )}
              {success && (
                <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {success}
                </div>
              )}
              
              <button
                onClick={handleAddMapping}
                disabled={isSaving || !tableName || !workItemType}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Add Mapping
              </button>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Close
          </button>
          <button
            onClick={async () => { await onSave(); onClose() }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// Template Config Editor Modal - Configure dynamic fields for a template
function TemplateConfigEditor({ 
  template, 
  onClose, 
  onSave 
}: { 
  template: ReleaseNoteTemplate
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [fieldName, setFieldName] = useState('')
  const [placeholder, setPlaceholder] = useState('')
  const [defaultValue, setDefaultValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleAddField = async () => {
    if (!fieldName || !placeholder) {
      setError('Please fill in required fields')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await releaseNotesService.addDynamicField(template.id, {
        fieldName,
        placeholder,
        defaultValue: defaultValue || undefined,
        fieldType: 'Text'
      })
      setSuccess(`Added field "${fieldName}"`)
      setFieldName('')
      setPlaceholder('')
      setDefaultValue('')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to add field')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configure Template</h3>
            <p className="text-sm text-gray-500">{template.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Settings className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Current Fields */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dynamic Fields</h4>
            {template.dynamicFieldCount === 0 ? (
              <p className="text-sm text-gray-500 italic">No dynamic fields configured</p>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400">{template.dynamicFieldCount} field(s) configured</span>
              </div>
            )}
          </div>

          {/* Add New Field */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add Dynamic Field</h4>
            <p className="text-xs text-gray-500 mb-3">
              Dynamic fields are placeholders in your DOCX template that get replaced with values during generation (e.g., {"{{Version}}"}, {"{{ReleaseDate}}"})
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Field Name *</label>
                <input
                  type="text"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="e.g., Version, ReleaseDate, Author"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Placeholder in DOCX *</label>
                <input
                  type="text"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  placeholder="e.g., {{Version}}, {{ReleaseDate}}"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Default Value (optional)</label>
                <input
                  type="text"
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="e.g., 1.0.0"
                  className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
              
              {error && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</div>
              )}
              {success && (
                <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {success}
                </div>
              )}
              
              <button
                onClick={handleAddField}
                disabled={isSaving || !fieldName || !placeholder}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                Add Field
              </button>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Close
          </button>
          <button
            onClick={async () => { await onSave(); onClose() }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
