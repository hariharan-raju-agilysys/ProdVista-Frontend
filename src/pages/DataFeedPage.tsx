import { useState, useEffect, useCallback } from 'react'
import {
  Database, FileText, Cog, Book, Code, Folder, Search, Plus, Edit, Trash2, 
  Download, Upload, RefreshCw, Loader2, CheckCircle, XCircle, Sparkles,
  ChevronLeft, Tag, Clock, User, Eye, EyeOff, Zap, Settings, ChevronDown, ChevronUp
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as dataFeedService from '../services/dataFeedService'
import type { DataFeedEntry, CreateDataFeedRequest, UpdateDataFeedRequest, DataFeedSuggestion } from '../services/dataFeedService'

const CATEGORY_ICONS: Record<string, JSX.Element> = {
  Database: <Database className="w-4 h-4" />,
  Service: <Cog className="w-4 h-4" />,
  Api: <Code className="w-4 h-4" />,
  Schema: <FileText className="w-4 h-4" />,
  Documentation: <Book className="w-4 h-4" />,
  BusinessRules: <FileText className="w-4 h-4" />,
  Glossary: <Book className="w-4 h-4" />,
  Other: <Folder className="w-4 h-4" />,
}

interface EntryFormData {
  category: string;
  title: string;
  description: string;
  content: string;
  tags: string;
  autoIncludeInAI: boolean;
  priority: number;
}

const defaultFormData: EntryFormData = {
  category: 'Other',
  title: '',
  description: '',
  content: '',
  tags: '',
  autoIncludeInAI: true,
  priority: 100,
}

export default function DataFeedPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<DataFeedEntry[]>([])
  const [_categories, setCategories] = useState<string[]>([]) // Backend-provided categories (for future use)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showInactive, setShowInactive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<DataFeedEntry | null>(null)
  const [formData, setFormData] = useState<EntryFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)

  // Preview state
  const [previewEntry, setPreviewEntry] = useState<DataFeedEntry | null>(null)

  // Import/Export
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Suggestions state
  const [suggestions, setSuggestions] = useState<DataFeedSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [applyingSuggestion, setApplyingSuggestion] = useState<string | null>(null)
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(true)
  const [refreshingEntry, setRefreshingEntry] = useState<string | null>(null)

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await dataFeedService.getDataFeeds(
        selectedCategory || undefined,
        !showInactive
      )
      setEntries(response.entries)
      setCategories(response.categories)
    } catch (err) {
      console.error('Failed to load data feeds:', err)
    }
    setLoading(false)
  }, [selectedCategory, showInactive])

  // Load suggestions from configured sources
  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true)
    try {
      const response = await dataFeedService.getSuggestions()
      setSuggestions(response.suggestions)
    } catch (err) {
      console.error('Failed to load suggestions:', err)
    }
    setLoadingSuggestions(false)
  }, [])

  useEffect(() => { loadData(); loadSuggestions() }, [loadData, loadSuggestions])

  // Filter by search
  const filteredEntries = searchQuery
    ? entries.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.tags?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries

  // Open create modal
  const handleCreate = () => {
    setEditingEntry(null)
    setFormData(defaultFormData)
    setShowModal(true)
  }

  // Open edit modal
  const handleEdit = (entry: DataFeedEntry) => {
    setEditingEntry(entry)
    setFormData({
      category: entry.category,
      title: entry.title,
      description: entry.description || '',
      content: entry.content,
      tags: entry.tags || '',
      autoIncludeInAI: entry.autoIncludeInAI,
      priority: entry.priority,
    })
    setShowModal(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return
    setSaving(true)
    try {
      if (editingEntry) {
        const request: UpdateDataFeedRequest = {
          category: formData.category,
          title: formData.title,
          description: formData.description || undefined,
          content: formData.content,
          tags: formData.tags || undefined,
          autoIncludeInAI: formData.autoIncludeInAI,
          priority: formData.priority,
        }
        await dataFeedService.updateDataFeed(editingEntry.id, request)
      } else {
        const request: CreateDataFeedRequest = {
          category: formData.category,
          title: formData.title,
          description: formData.description || undefined,
          content: formData.content,
          tags: formData.tags || undefined,
          autoIncludeInAI: formData.autoIncludeInAI,
          priority: formData.priority,
        }
        await dataFeedService.createDataFeed(request)
      }
      setShowModal(false)
      loadData()
    } catch (err) {
      console.error('Failed to save:', err)
    }
    setSaving(false)
  }

  // Delete
  const handleDelete = async (entry: DataFeedEntry) => {
    if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return
    try {
      await dataFeedService.deleteDataFeed(entry.id)
      loadData()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  // Toggle active
  const handleToggleActive = async (entry: DataFeedEntry) => {
    try {
      await dataFeedService.updateDataFeed(entry.id, { isActive: !entry.isActive })
      loadData()
    } catch (err) {
      console.error('Failed to toggle:', err)
    }
  }

  // Export
  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await dataFeedService.exportDataFeeds()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `data-feed-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export:', err)
    }
    setExporting(false)
  }

  // Import
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (data.entries && Array.isArray(data.entries)) {
        await dataFeedService.importDataFeeds(data.entries)
        loadData()
      }
    } catch (err) {
      console.error('Failed to import:', err)
    }
    setImporting(false)
    e.target.value = ''
  }

  // Apply a suggestion (adds to data feed)
  const handleApplySuggestion = async (suggestion: DataFeedSuggestion, editFirst: boolean = false) => {
    if (editFirst) {
      // Pre-fill form with suggestion data and open modal
      setEditingEntry(null)
      setFormData({
        category: suggestion.suggestedCategory,
        title: suggestion.suggestedTitle,
        description: suggestion.suggestedDescription || '',
        content: suggestion.suggestedContent,
        tags: suggestion.suggestedTags || '',
        autoIncludeInAI: true,
        priority: suggestion.suggestedPriority,
      })
      setShowModal(true)
      return
    }

    setApplyingSuggestion(suggestion.sourceType + '-' + suggestion.sourceId)
    try {
      await dataFeedService.applySuggestion({
        sourceType: suggestion.sourceType,
        sourceId: suggestion.sourceId,
        category: suggestion.suggestedCategory,
        title: suggestion.suggestedTitle,
        description: suggestion.suggestedDescription,
        content: suggestion.suggestedContent,
        tags: suggestion.suggestedTags,
      })
      loadData()
      loadSuggestions() // Refresh suggestions to remove applied one
    } catch (err) {
      console.error('Failed to apply suggestion:', err)
    }
    setApplyingSuggestion(null)
  }

  // Refresh entry content from source
  const handleRefreshFromSource = async (entry: DataFeedEntry) => {
    if (!entry.sourceType || !entry.sourceId) return
    setRefreshingEntry(entry.id)
    try {
      await dataFeedService.refreshFromSource(entry.id)
      loadData()
    } catch (err) {
      console.error('Failed to refresh from source:', err)
    }
    setRefreshingEntry(null)
  }

  // Get icon for suggestion source type
  const getSuggestionIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'Database': return <Database className="w-5 h-5 text-blue-400" />
      case 'DevOps': return <Code className="w-5 h-5 text-purple-400" />
      case 'AISettings': return <Sparkles className="w-5 h-5 text-amber-400" />
      case 'HRPortal': return <User className="w-5 h-5 text-green-400" />
      default: return <Folder className="w-5 h-5 text-slate-400" />
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40 rounded-lg mb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/tools')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700/50 rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-white" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Data Feed</h1>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Context for AI Assistant</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <label className="p-2 hover:bg-slate-700/50 rounded-lg transition cursor-pointer">
                <Upload className={`w-5 h-5 ${importing ? 'animate-pulse' : ''}`} />
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition disabled:opacity-50"
              >
                <Download className={`w-5 h-5 ${exporting ? 'animate-pulse' : ''}`} />
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-medium transition"
              >
                <Plus className="w-4 h-4" />
                Add Entry
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Info Banner */}
        <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-300">AI Context Knowledge Base</h3>
              <p className="text-sm text-slate-400 mt-1">
                Store service documentation, database schemas, API details, and business rules here.
                The AI Assistant will use this context to provide more accurate, project-specific answers.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="">All Categories</option>
            {dataFeedService.DATA_FEED_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>

          {/* Show Inactive Toggle */}
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
              showInactive ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800/50 text-slate-400'
            }`}
          >
            {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showInactive ? 'Showing All' : 'Active Only'}
          </button>

          {/* Stats */}
          <div className="text-sm text-slate-400">
            {filteredEntries.length} entries
          </div>
        </div>

        {/* Suggested Sources Section */}
        {suggestions.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
              className="w-full flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 hover:border-purple-500/50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-purple-300">Suggested Sources</h3>
                  <p className="text-xs text-slate-400">
                    {suggestions.length} configured source{suggestions.length !== 1 ? 's' : ''} can be added as AI context
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {loadingSuggestions && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
                {suggestionsExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </button>

            {suggestionsExpanded && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {suggestions.map((suggestion) => {
                  const suggestionKey = suggestion.sourceType + '-' + suggestion.sourceId
                  const isApplying = applyingSuggestion === suggestionKey

                  return (
                    <div
                      key={suggestionKey}
                      className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-purple-500/30 transition"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-slate-700/50 rounded-lg">
                          {getSuggestionIcon(suggestion.sourceType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-200 truncate">{suggestion.suggestedTitle}</h4>
                          <p className="text-xs text-slate-400 line-clamp-2">{suggestion.suggestedDescription}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-0.5 bg-slate-700/50 rounded text-xs text-slate-400">
                          {suggestion.suggestedCategory}
                        </span>
                        <span className="px-2 py-0.5 bg-purple-500/20 rounded text-xs text-purple-300">
                          {suggestion.sourceType}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApplySuggestion(suggestion)}
                          disabled={isApplying}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm transition disabled:opacity-50"
                        >
                          {isApplying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          Add
                        </button>
                        <button
                          onClick={() => handleApplySuggestion(suggestion, true)}
                          disabled={isApplying}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition disabled:opacity-50"
                          title="Edit before adding"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Entries List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-20">
            <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-400">No entries found</h3>
            <p className="text-sm text-slate-500 mt-1">
              {searchQuery ? 'Try a different search term' : 'Add your first data feed entry'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreate}
                className="mt-4 px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create Entry
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredEntries.map(entry => (
              <div
                key={entry.id}
                className={`p-4 rounded-lg border transition ${
                  entry.isActive
                    ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600/50'
                    : 'bg-slate-900/50 border-slate-800/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`p-1.5 rounded ${
                        entry.isActive ? 'bg-slate-700/50' : 'bg-slate-800/50'
                      }`}>
                        {CATEGORY_ICONS[entry.category] || <Folder className="w-4 h-4" />}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        {entry.category}
                      </span>
                      {entry.autoIncludeInAI && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                          <Sparkles className="w-3 h-3" />
                          AI Context
                        </span>
                      )}
                      {entry.sourceType && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                          <Zap className="w-3 h-3" />
                          {entry.sourceType}
                        </span>
                      )}
                      {!entry.isActive && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs">
                          Inactive
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-lg mb-1">{entry.title}</h3>
                    {entry.description && (
                      <p className="text-sm text-slate-400 mb-2">{entry.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      {entry.tags && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {entry.tags}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString()}
                      </span>
                      {entry.createdBy && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.createdBy}
                        </span>
                      )}
                      <span className="text-slate-600">
                        Priority: {entry.priority}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewEntry(entry)}
                      className="p-2 hover:bg-slate-700/50 rounded-lg transition"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-2 hover:bg-slate-700/50 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(entry)}
                      className="p-2 hover:bg-slate-700/50 rounded-lg transition"
                      title={entry.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {entry.isActive ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-400" />
                      )}
                    </button>
                    {entry.sourceType && (
                      <button
                        onClick={() => handleRefreshFromSource(entry)}
                        disabled={refreshingEntry === entry.id}
                        className="p-2 hover:bg-purple-500/20 rounded-lg transition disabled:opacity-50"
                        title="Refresh from Source"
                      >
                        <RefreshCw className={`w-4 h-4 text-purple-400 ${refreshingEntry === entry.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(entry)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl border border-slate-700/50 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingEntry ? 'Edit Entry' : 'Create Entry'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)] space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {dataFeedService.DATA_FEED_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label} - {cat.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., PMS Database Schema, Folio Service API..."
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this entry..."
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Content (Markdown) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Content (Markdown) *</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="# Service Overview\n\nDescribe your service, database tables, API endpoints, etc.\n\n## Tables\n- `table_name` - description\n\n## Endpoints\n- `GET /api/resource` - description"
                  rows={12}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use Markdown to format content. This will be included in AI context.
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., pms, folio, payment, database"
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Comma-separated tags for categorization and search
                </p>
              </div>

              {/* Auto-include in AI */}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoIncludeInAI}
                    onChange={(e) => setFormData({ ...formData, autoIncludeInAI: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <div>
                  <span className="text-sm font-medium text-slate-300">Auto-include in AI Context</span>
                  <p className="text-xs text-slate-500">When enabled, AI Assistant will use this entry</p>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Priority (lower = higher priority)
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                  min={1}
                  max={1000}
                  className="w-24 px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-700/50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.title.trim() || !formData.content.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {editingEntry ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl border border-slate-700/50 w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-slate-700/50 rounded">
                  {CATEGORY_ICONS[previewEntry.category] || <Folder className="w-4 h-4" />}
                </span>
                <div>
                  <h2 className="font-semibold">{previewEntry.title}</h2>
                  <p className="text-xs text-slate-400">{previewEntry.category}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewEntry(null)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {previewEntry.description && (
                <p className="text-slate-400 mb-4 italic">{previewEntry.description}</p>
              )}
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono bg-slate-900/50 p-4 rounded-lg">
                  {previewEntry.content}
                </pre>
              </div>
              {previewEntry.tags && (
                <div className="mt-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-400">{previewEntry.tags}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
