import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Settings, RefreshCw, Download, Upload, Table2,
  Server, Tag, Sparkles, ChevronRight, Plus, Trash2, Edit2,
  CheckCircle, AlertCircle, FileUp, Copy, Eye
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_PATH } from '../services/api'
import clsx from 'clsx'
import releaseNotesService, {
  type ReleaseNoteTemplate,
  type AzureDevOpsConnection,
  type TableMapping,
  type DynamicField,
} from '../services/releaseNotesService'

type ViewMode = 'user' | 'setup'

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function ReleaseNotesPageV2() {
  const { isManager } = useAuth()
  const [viewMode, setViewMode] = useState<ViewMode>('user')
  const [isLoading, setIsLoading] = useState(false)
  
  // Data state
  const [templates, setTemplates] = useState<ReleaseNoteTemplate[]>([])
  const [connections, setConnections] = useState<AzureDevOpsConnection[]>([])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [tpls, conns] = await Promise.all([
        releaseNotesService.getTemplates(),
        releaseNotesService.getConnections()
      ])
      setTemplates(tpls)
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Release Notes Helper</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Generate release documents from templates
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              {isManager && (
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('user')}
                    className={clsx(
                      'px-4 py-2 rounded-md text-sm font-medium transition-all',
                      viewMode === 'user'
                        ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Create Release
                    </span>
                  </button>
                  <button
                    onClick={() => setViewMode('setup')}
                    className={clsx(
                      'px-4 py-2 rounded-md text-sm font-medium transition-all',
                      viewMode === 'setup'
                        ? 'bg-white dark:bg-gray-600 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Setup Manager
                    </span>
                  </button>
                </div>
              )}
              
              <button
                onClick={loadData}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {viewMode === 'user' && (
            <UserReleaseView 
              templates={templates}
              connections={connections}
            />
          )}
          {viewMode === 'setup' && isManager && (
            <SetupManagerView 
              templates={templates}
              connections={connections}
              onRefresh={loadData}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ============================================================================
// USER RELEASE VIEW - Simple data entry and download
// ============================================================================
function UserReleaseView({ 
  templates, 
  connections 
}: { 
  templates: ReleaseNoteTemplate[]
  connections: AzureDevOpsConnection[]
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [releaseData, setReleaseData] = useState<Record<string, unknown[]>>({})
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTable, setActiveTable] = useState<string>('')

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  
  // Get table mappings from template (already parsed as array)
  const tableMappings: TableMapping[] = selectedTemplate?.tableMappings || []

  // Get dynamic fields from template (already parsed as array)
  const templateDynamicFields: DynamicField[] = selectedTemplate?.dynamicFields || []

  const handleGenerateDownload = async () => {
    if (!selectedTemplateId) return
    
    setIsGenerating(true)
    try {
      // Call API to generate DOCX with the data
      const response = await fetch(`${API_BASE_PATH}/release-notes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          tableData: releaseData,
          dynamicFields: dynamicFields
        })
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Release-Notes-${new Date().toISOString().split('T')[0]}.docx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        alert('Failed to generate document')
      }
    } catch (error) {
      console.error('Generation failed:', error)
      alert('Failed to generate document')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Step 1: Select Template */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">1</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Template</h3>
        </div>
        <div className="p-6">
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No templates available. Ask a manager to set up templates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplateId(template.id)
                    setReleaseData({})
                    setDynamicFields({})
                  }}
                  className={clsx(
                    'p-4 rounded-lg border-2 text-left transition-all',
                    selectedTemplateId === template.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium text-gray-900 dark:text-white">{template.name}</span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">{template.description || 'No description'}</p>
                  {selectedTemplateId === template.id && (
                    <CheckCircle className="w-5 h-5 text-emerald-500 mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Fill Dynamic Fields */}
      {selectedTemplate && templateDynamicFields.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">2</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Release Information</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templateDynamicFields.map(field => (
                <div key={field.fieldName}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.displayName || field.fieldName}
                  </label>
                  <input
                    type={field.fieldType === 'Date' || field.fieldType === 'DateTime' ? 'date' : 'text'}
                    value={dynamicFields[field.fieldName] || field.defaultValue || ''}
                    onChange={(e) => setDynamicFields(f => ({ ...f, [field.fieldName]: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder={field.placeholder || `Enter ${field.displayName || field.fieldName}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Table Data Entry */}
      {selectedTemplate && tableMappings.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">3</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Table Data</h3>
          </div>
          
          {/* Table Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-1 px-4 pt-2">
              {tableMappings.map(mapping => (
                <button
                  key={mapping.tableName}
                  onClick={() => setActiveTable(mapping.tableName)}
                  className={clsx(
                    'px-4 py-2 rounded-t-lg text-sm font-medium transition-all flex items-center gap-2',
                    activeTable === mapping.tableName
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  <Table2 className="w-4 h-4" />
                  {mapping.tableName}
                  {releaseData[mapping.tableName]?.length > 0 && (
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs">
                      {releaseData[mapping.tableName].length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Active Table Content */}
          {activeTable && (
            <div className="p-6">
              <TableDataEntry
                tableName={activeTable}
                connections={connections}
                data={releaseData[activeTable] || []}
                onChange={(data) => setReleaseData(r => ({ ...r, [activeTable]: data }))}
              />
            </div>
          )}

          {!activeTable && tableMappings.length > 0 && (
            <div className="p-12 text-center">
              <Table2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select a table above to add data</p>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Generate */}
      {selectedTemplate && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-1">Ready to Generate</h3>
              <p className="text-emerald-100">
                Your document will be created using "{selectedTemplate.name}" template
              </p>
            </div>
            <button
              onClick={handleGenerateDownload}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 disabled:opacity-50 transition-all shadow-lg"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Generate & Download DOCX
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ============================================================================
// TABLE DATA ENTRY - Azure DevOps OR Manual Input
// ============================================================================
function TableDataEntry({
  tableName,
  connections,
  data,
  onChange
}: {
  tableName: string
  connections: AzureDevOpsConnection[]
  data: unknown[]
  onChange: (data: unknown[]) => void
}) {
  const [inputMode, setInputMode] = useState<'azure' | 'manual'>('manual')
  const [manualText, setManualText] = useState('')
  const [selectedConnectionId, setSelectedConnectionId] = useState('')
  const [isFetching, setIsFetching] = useState(false)

  const parseManualData = () => {
    try {
      // Try to parse as tab/newline separated (Excel paste)
      const lines = manualText.trim().split('\n')
      if (lines.length < 2) {
        alert('Please paste at least a header row and one data row')
        return
      }

      const headers = lines[0].split('\t').map(h => h.trim())
      const rows = lines.slice(1).map(line => {
        const values = line.split('\t')
        const row: Record<string, string> = {}
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || ''
        })
        return row
      })

      onChange(rows)
      setManualText('')
    } catch (error) {
      console.error('Failed to parse data:', error)
      alert('Failed to parse data. Make sure it\'s tab-separated (copy from Excel)')
    }
  }

  const fetchFromAzureDevOps = async () => {
    if (!selectedConnectionId) return

    setIsFetching(true)
    try {
      // This would call the API to fetch work items
      const response = await fetch(`${API_BASE_PATH}/release-notes/connections/${selectedConnectionId}/workitems?table=${tableName}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const items = await response.json()
        onChange(items)
      } else {
        alert('Failed to fetch work items')
      }
    } catch (error) {
      console.error('Failed to fetch:', error)
      alert('Failed to fetch work items from Azure DevOps')
    } finally {
      setIsFetching(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">Data Source:</span>
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setInputMode('azure')}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
              inputMode === 'azure'
                ? 'bg-white dark:bg-gray-600 text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Server className="w-4 h-4" />
            Azure DevOps
          </button>
          <button
            onClick={() => setInputMode('manual')}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
              inputMode === 'manual'
                ? 'bg-white dark:bg-gray-600 text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Copy className="w-4 h-4" />
            Paste Data
          </button>
        </div>
      </div>

      {/* Azure DevOps Mode */}
      {inputMode === 'azure' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          {connections.length === 0 ? (
            <div className="text-center py-4">
              <Server className="w-8 h-8 text-blue-300 mx-auto mb-2" />
              <p className="text-blue-700 dark:text-blue-400">No Azure DevOps connections configured</p>
              <p className="text-sm text-blue-600">Ask a manager to set up a connection</p>
            </div>
          ) : (
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                  Select Connection
                </label>
                <select
                  value={selectedConnectionId}
                  onChange={(e) => setSelectedConnectionId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg"
                >
                  <option value="">Choose a connection...</option>
                  {connections.map(conn => (
                    <option key={conn.id} value={conn.id}>
                      {conn.connectionName} ({conn.projectName})
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={fetchFromAzureDevOps}
                disabled={!selectedConnectionId || isFetching}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isFetching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Fetch Work Items
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Paste Mode */}
      {inputMode === 'manual' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Paste Excel/Table Data (Tab-separated)
            </label>
            <span className="text-xs text-gray-400">
              Copy from Excel and paste below
            </span>
          </div>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Copy data from Excel and paste here...&#10;&#10;Example:&#10;ID	Title	Status&#10;123	Fix bug	Done&#10;456	Add feature	Done"
            rows={6}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={parseManualData}
            disabled={!manualText.trim()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add to Table
          </button>
        </div>
      )}

      {/* Data Preview */}
      {data.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {tableName} Data ({data.length} rows)
            </h4>
            <button
              onClick={() => onChange([])}
              className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear All
            </button>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  {Object.keys(data[0] as object).map(key => (
                    <th key={key} className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                      {key}
                    </th>
                  ))}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {Object.values(row as object).map((value, i) => (
                      <td key={i} className="py-2 px-3 text-gray-700 dark:text-gray-300">
                        {String(value || '')}
                      </td>
                    ))}
                    <td>
                      <button
                        onClick={() => onChange(data.filter((_, i) => i !== index))}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SETUP MANAGER VIEW - One-time configuration toolbox
// ============================================================================
function SetupManagerView({
  templates,
  connections,
  onRefresh
}: {
  templates: ReleaseNoteTemplate[]
  connections: AzureDevOpsConnection[]
  onRefresh: () => void
}) {
  const [expandedSection, setExpandedSection] = useState<string>('templates')

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-6 h-6" />
          <h2 className="text-xl font-bold">Setup Manager</h2>
        </div>
        <p className="text-violet-100">
          Configure templates and mappings once. Users will use these to generate release documents.
        </p>
      </div>

      {/* Toolbox Sections */}
      <div className="space-y-3">
        {/* 1. Templates Section */}
        <ToolboxSection
          title="Document Templates"
          description="Upload DOCX templates with placeholders"
          icon={<FileText className="w-5 h-5" />}
          count={templates.length}
          isExpanded={expandedSection === 'templates'}
          onToggle={() => setExpandedSection(expandedSection === 'templates' ? '' : 'templates')}
        >
          <TemplateManager templates={templates} onRefresh={onRefresh} />
        </ToolboxSection>

        {/* 2. Table Mappings Section */}
        <ToolboxSection
          title="Table Mappings"
          description="Define which tables exist in your templates and how data flows"
          icon={<Table2 className="w-5 h-5" />}
          count={templates.reduce((acc, t) => acc + (t.tableMappings?.length || 0), 0)}
          isExpanded={expandedSection === 'mappings'}
          onToggle={() => setExpandedSection(expandedSection === 'mappings' ? '' : 'mappings')}
        >
          <TableMappingsManager templates={templates} onRefresh={onRefresh} />
        </ToolboxSection>

        {/* 3. Azure DevOps Connections */}
        <ToolboxSection
          title="Azure DevOps Connections"
          description="Connect to Azure DevOps for automatic work item fetching"
          icon={<Server className="w-5 h-5" />}
          count={connections.length}
          isExpanded={expandedSection === 'connections'}
          onToggle={() => setExpandedSection(expandedSection === 'connections' ? '' : 'connections')}
        >
          <ConnectionsManager connections={connections} onRefresh={onRefresh} />
        </ToolboxSection>

        {/* 4. Dynamic Fields */}
        <ToolboxSection
          title="Dynamic Fields"
          description="Configure placeholders like {{Version}}, {{ReleaseDate}}, etc."
          icon={<Tag className="w-5 h-5" />}
          count={templates.reduce((acc, t) => acc + (t.dynamicFields?.length || 0), 0)}
          isExpanded={expandedSection === 'fields'}
          onToggle={() => setExpandedSection(expandedSection === 'fields' ? '' : 'fields')}
        >
          <DynamicFieldsManager templates={templates} onRefresh={onRefresh} />
        </ToolboxSection>
      </div>
    </motion.div>
  )
}

// ============================================================================
// TOOLBOX SECTION - Collapsible section component
// ============================================================================
function ToolboxSection({
  title,
  description,
  icon,
  count,
  isExpanded,
  onToggle,
  children
}: {
  title: string
  description: string
  icon: React.ReactNode
  count?: number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-lg">
            {icon}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {title}
              {count !== undefined && count > 0 && (
                <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full text-xs">
                  {count}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        </div>
        <ChevronRight className={clsx(
          'w-5 h-5 text-gray-400 transition-transform',
          isExpanded && 'rotate-90'
        )} />
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-gray-700"
          >
            <div className="p-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// TEMPLATE MANAGER
// ============================================================================
function TemplateManager({ 
  templates, 
  onRefresh 
}: { 
  templates: ReleaseNoteTemplate[]
  onRefresh: () => void 
}) {
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleUpload = async () => {
    if (!selectedFile || !newTemplate.name) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name', newTemplate.name)
      formData.append('description', newTemplate.description)

      await releaseNotesService.createTemplate(formData)
      setShowUpload(false)
      setNewTemplate({ name: '', description: '' })
      setSelectedFile(null)
      onRefresh()
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload template')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Template List */}
      {templates.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <FileUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No templates uploaded yet</p>
          <button
            onClick={() => setShowUpload(true)}
            className="text-violet-600 hover:text-violet-700 font-medium"
          >
            Upload your first template
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(template => (
            <div
              key={template.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-violet-500" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{template.name}</h4>
                  <p className="text-sm text-gray-500">{template.description || 'No description'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {template.templateFileName}
                </span>
                <button className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Form */}
      {!showUpload ? (
        <button
          onClick={() => setShowUpload(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-violet-400 hover:text-violet-600 flex items-center justify-center gap-2"
        >
          <Upload className="w-5 h-5" />
          Upload New Template
        </button>
      ) : (
        <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800 space-y-4">
          <h4 className="font-medium text-violet-800 dark:text-violet-300">Upload DOCX Template</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Template Name *
            </label>
            <input
              type="text"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate(t => ({ ...t, name: e.target.value }))}
              placeholder="e.g., Weekly Release Notes"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={newTemplate.description}
              onChange={(e) => setNewTemplate(t => ({ ...t, description: e.target.value }))}
              placeholder="Brief description of this template"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              DOCX File *
            </label>
            <input
              type="file"
              accept=".docx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowUpload(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !newTemplate.name || uploading}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Template Placeholders
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
          Use these placeholders in your DOCX file:
        </p>
        <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
          <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{{TableName}}'}</code> - Will be replaced with table data</li>
          <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{{Version}}'}</code> - Dynamic field values</li>
          <li><code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{'{{ReleaseDate}}'}</code> - Date fields</li>
        </ul>
      </div>
    </div>
  )
}

// ============================================================================
// TABLE MAPPINGS MANAGER
// ============================================================================
function TableMappingsManager({ 
  templates, 
  onRefresh: _onRefresh 
}: { 
  templates: ReleaseNoteTemplate[]
  onRefresh: () => void 
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const mappings: TableMapping[] = selectedTemplate?.tableMappings || []

  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Upload a template first to configure table mappings</p>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Template to Configure
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Choose a template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {selectedTemplateId && (
            <div className="space-y-4">
              {/* Existing Mappings */}
              {mappings.length > 0 ? (
                <div className="space-y-2">
                  {mappings.map((mapping, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Table2 className="w-5 h-5 text-violet-500" />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">{mapping.tableName}</span>
                          <p className="text-sm text-gray-500">{mapping.tableIdentifier}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                          {mapping.queryType || 'Manual'}
                        </span>
                        <span className="px-2 py-1 rounded text-xs bg-violet-100 text-violet-700">
                          {mapping.columnMappings?.length || 0} columns
                        </span>
                        <button className="p-2 text-gray-400 hover:text-violet-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <Table2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No table mappings configured</p>
                </div>
              )}

              {/* Add New Mapping */}
              <button
                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-violet-400 hover:text-violet-600 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Table Mapping
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// CONNECTIONS MANAGER
// ============================================================================
function ConnectionsManager({
  connections,
  onRefresh: _onRefresh
}: {
  connections: AzureDevOpsConnection[]
  onRefresh: () => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [organizations, setOrganizations] = useState<Array<{ name: string; id: string }>>([])

  const discoverOrganizations = async () => {
    setIsDiscovering(true)
    try {
      const data = await releaseNotesService.discoverOrganizations()
      setOrganizations(data.map(org => ({ name: org.accountName, id: org.accountId })))
    } catch (error) {
      console.error('Discovery failed:', error)
      alert('Failed to discover organizations. Make sure you\'re logged in with Azure CLI.')
    } finally {
      setIsDiscovering(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Connection List */}
      {connections.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <Server className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No Azure DevOps connections</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-violet-600 hover:text-violet-700 font-medium"
          >
            Add your first connection
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map(conn => (
            <div
              key={conn.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Server className="w-8 h-8 text-blue-500" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {conn.connectionName} - {conn.projectName}
                  </h4>
                  <p className="text-sm text-gray-500">{conn.organizationUrl}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'px-2 py-1 rounded text-xs',
                  conn.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}>
                  {conn.isActive ? 'Active' : 'Inactive'}
                </span>
                <button className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Connection */}
      {!showAdd ? (
        <button
          onClick={() => { setShowAdd(true); discoverOrganizations() }}
          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-violet-400 hover:text-violet-600 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Azure DevOps Connection
        </button>
      ) : (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4">
          <h4 className="font-medium text-blue-800 dark:text-blue-300">Add Azure DevOps Connection</h4>
          
          {isDiscovering ? (
            <div className="flex items-center gap-2 text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Discovering organizations...
            </div>
          ) : organizations.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Organization
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg">
                <option value="">Choose an organization...</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No organizations found. Make sure you're logged in with <code className="bg-gray-100 px-1 rounded">az login</code>
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={discoverOrganizations}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// DYNAMIC FIELDS MANAGER
// ============================================================================
function DynamicFieldsManager({
  templates,
  onRefresh: _onRefresh
}: {
  templates: ReleaseNoteTemplate[]
  onRefresh: () => void
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const fields: DynamicField[] = selectedTemplate?.dynamicFields || []

  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Upload a template first to configure dynamic fields</p>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Template to Configure
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="">Choose a template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {selectedTemplateId && (
            <div className="space-y-4">
              {/* Existing Fields */}
              {fields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {fields.map((field, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Tag className="w-4 h-4 text-violet-500" />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {`{{${field.fieldName}}}`}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">{field.fieldType}</span>
                        </div>
                      </div>
                      <button className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No dynamic fields configured</p>
                </div>
              )}

              {/* Add New Field */}
              <button
                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-violet-400 hover:text-violet-600 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Dynamic Field
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
