import { useState, useEffect, useMemo } from 'react'
import { 
  Lock, Key, FileText, Link as LinkIcon, Settings, Plus, Search, 
  Tag, Filter, Star, Clock, Edit2, Trash2, Copy, ExternalLink,
  Shield, FolderOpen, BookOpen, Code2, Database, Terminal, Check, X
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import vaultService, { VaultItem, CreateVaultItemDto } from '../services/vaultService'

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

type VaultItemType = 'credential' | 'document' | 'url' | 'app-config' | 'note'

interface CredentialData {
  username?: string
  password?: string
  url?: string
  notes?: string
}

interface DocumentData {
  content: string
  fileType?: string
  fileUrl?: string
}

interface UrlData {
  url: string
  category?: string
  notes?: string
}

interface AppConfigData {
  appName: string
  environment: string
  config: Record<string, any>
  apiKeys?: string[]
  connectionStrings?: string[]
}

const ITEM_TYPES = [
  { value: 'credential', label: 'Credential', icon: Key, color: 'text-red-600', bg: 'bg-red-50' },
  { value: 'document', label: 'Document', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'url', label: 'URL/Link', icon: LinkIcon, color: 'text-green-600', bg: 'bg-green-50' },
  { value: 'app-config', label: 'App Config', icon: Settings, color: 'text-purple-600', bg: 'bg-purple-50' },
  { value: 'note', label: 'Note', icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
] as const

const CATEGORIES = [
  'Development', 'Production', 'Staging', 'Testing', 'Personal', 
  'Team Shared', 'API Keys', 'Database', 'Cloud Services', 'Documentation', 'Other'
]

// ═══════════════════════════════════════════════════════════════════
// Search Algorithm - Fuzzy + Relevance Ranking
// ═══════════════════════════════════════════════════════════════════

function fuzzyMatch(text: string, query: string): number {
  const textLower = text.toLowerCase()
  const queryLower = query.toLowerCase()
  
  // Exact match - highest score
  if (textLower === queryLower) return 100
  
  // Starts with - very high score
  if (textLower.startsWith(queryLower)) return 90
  
  // Contains as substring - high score
  if (textLower.includes(queryLower)) return 80
  
  // Fuzzy character matching - medium score
  let queryIndex = 0
  let matchCount = 0
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matchCount++
      queryIndex++
    }
  }
  
  if (queryIndex === queryLower.length) {
    return 50 + (matchCount / textLower.length) * 30
  }
  
  return 0
}

function searchVaultItems(items: VaultItem[], query: string): VaultItem[] {
  if (!query.trim()) return items
  
  const scored = items.map(item => {
    const titleScore = fuzzyMatch(item.title, query) * 2 // Title is most important
    const descScore = fuzzyMatch(item.description || '', query) * 1.5
    const categoryScore = fuzzyMatch(item.category, query) * 1.2
    const tagScore = Math.max(...item.tags.map(tag => fuzzyMatch(tag, query))) * 1.3
    const contentScore = fuzzyMatch(item.content, query) * 0.5 // Content is least important
    
    const totalScore = titleScore + descScore + categoryScore + tagScore + contentScore
    
    return { item, score: totalScore }
  })
  
  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

export default function PersonalVaultPage() {
  const { user } = useAuth()
  
  // State
  const [items, setItems] = useState<VaultItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<VaultItemType | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'type'>('recent')
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null)
  const [editMode, setEditMode] = useState(false)
  
  // Form state
  const [formType, setFormType] = useState<VaultItemType>('note')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('Personal')
  const [formTags, setFormTags] = useState<string[]>([])
  const [formContent, setFormContent] = useState('')
  const [formIsSecure, setFormIsSecure] = useState(false)
  
  // Load items
  useEffect(() => {
    loadItems()
  }, [])
  
  const loadItems = async () => {
    setLoading(true)
    try {
      const response = await vaultService.getAllItems()
      setItems(response.data)
    } catch (error) {
      console.error('Failed to load vault items:', error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  
  // Filtered and searched items
  const filteredItems = useMemo(() => {
    let result = items
    
    // Filter by type
    if (selectedType !== 'all') {
      result = result.filter(item => item.type === selectedType)
    }
    
    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(item => item.category === selectedCategory)
    }
    
    // Filter favorites
    if (showFavoritesOnly) {
      result = result.filter(item => item.isFavorite)
    }
    
    // Search
    if (searchQuery.trim()) {
      result = searchVaultItems(result, searchQuery)
    }
    
    // Sort
    if (sortBy === 'recent') {
      result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } else if (sortBy === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortBy === 'type') {
      result = [...result].sort((a, b) => a.type.localeCompare(b.type))
    }
    
    return result
  }, [items, selectedType, selectedCategory, showFavoritesOnly, searchQuery, sortBy])
  
  // Stats
  const stats = useMemo(() => ({
    total: items.length,
    credentials: items.filter(i => i.type === 'credential').length,
    documents: items.filter(i => i.type === 'document').length,
    urls: items.filter(i => i.type === 'url').length,
    configs: items.filter(i => i.type === 'app-config').length,
    favorites: items.filter(i => i.isFavorite).length,
  }), [items])
  
  const handleAddItem = async () => {
    try {
      const dto: CreateVaultItemDto = {
        type: formType,
        title: formTitle,
        description: formDescription || undefined,
        content: formContent,
        category: formCategory,
        tags: formTags,
        isSecure: formIsSecure
      }
      
      await vaultService.createItem(dto)
      setShowAddModal(false)
      resetForm()
      loadItems()
    } catch (error) {
      console.error('Failed to add vault item:', error)
      // TODO: Show error toast
    }
  }
  
  const handleToggleFavorite = async (itemId: string) => {
    try {
      await vaultService.toggleFavorite(itemId)
      setItems(items.map(item => 
        item.id === itemId ? { ...item, isFavorite: !item.isFavorite } : item
      ))
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }
  
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    
    try {
      await vaultService.deleteItem(itemId)
      setShowDetailModal(false)
      loadItems()
    } catch (error) {
      console.error('Failed to delete vault item:', error)
    }
  }
  
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // TODO: Show toast notification
  }
  
  const resetForm = () => {
    setFormType('note')
    setFormTitle('')
    setFormDescription('')
    setFormCategory('Personal')
    setFormTags([])
    setFormContent('')
    setFormIsSecure(false)
  }
  
  const getTypeConfig = (type: VaultItemType) => {
    return ITEM_TYPES.find(t => t.value === type) || ITEM_TYPES[0]
  }
  
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600" />
            Personal Vault
          </h1>
          <p className="text-gray-500 mt-1">Secure storage for credentials, docs, URLs, and configs</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl">
          <p className="text-xs text-indigo-600 font-semibold uppercase">Total Items</p>
          <p className="text-2xl font-black text-indigo-900 mt-1">{stats.total}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-xl">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-red-600" />
            <p className="text-xs text-red-600 font-semibold">Credentials</p>
          </div>
          <p className="text-2xl font-black text-red-900 mt-1">{stats.credentials}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-xl">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <p className="text-xs text-blue-600 font-semibold">Documents</p>
          </div>
          <p className="text-2xl font-black text-blue-900 mt-1">{stats.documents}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-600 font-semibold">URLs</p>
          </div>
          <p className="text-2xl font-black text-green-900 mt-1">{stats.urls}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-purple-600" />
            <p className="text-xs text-purple-600 font-semibold">Configs</p>
          </div>
          <p className="text-2xl font-black text-purple-900 mt-1">{stats.configs}</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100 rounded-xl">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-600" />
            <p className="text-xs text-amber-600 font-semibold">Favorites</p>
          </div>
          <p className="text-2xl font-black text-amber-900 mt-1">{stats.favorites}</p>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, description, tags, content..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
          
          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as VaultItemType | 'all')}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All Types</option>
              {ITEM_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Additional Filters */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              showFavoritesOnly 
                ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            )}
          >
            <Star className={clsx('w-4 h-4', showFavoritesOnly && 'fill-amber-600')} />
            Favorites Only
          </button>
          
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">Sort by:</span>
            {(['recent', 'title', 'type'] as const).map(sort => (
              <button
                key={sort}
                onClick={() => setSortBy(sort)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
                  sortBy === sort
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                )}
              >
                {sort}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-50 animate-pulse rounded-2xl" />
          ))
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-semibold">No items found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? 'Try a different search query' : 'Add your first item to get started'}
            </p>
          </div>
        ) : (
          filteredItems.map(item => {
            const typeConfig = getTypeConfig(item.type)
            const Icon = typeConfig.icon
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedItem(item)
                  setShowDetailModal(true)
                }}
                className="group p-5 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:border-indigo-200 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', typeConfig.bg)}>
                    <Icon className={clsx('w-5 h-5', typeConfig.color)} />
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isSecure && (
                      <Lock className="w-4 h-4 text-red-500" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleFavorite(item.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Star className={clsx('w-5 h-5', item.isFavorite ? 'fill-amber-500 text-amber-500' : 'text-gray-300 hover:text-amber-500')} />
                    </button>
                  </div>
                </div>
                
                <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                {item.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{item.description}</p>
                )}
                
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
                    {item.category}
                  </span>
                  {item.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded">
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 2 && (
                    <span className="text-[10px] text-gray-400">+{item.tags.length - 2}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
                </div>
              </button>
            )
          })
        )}
      </div>
      
      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Add New Item</h3>
              <button onClick={() => setShowAddModal(false)} className="text-white hover:bg-white/20 rounded-lg p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-4">
                {/* Type Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {ITEM_TYPES.map(type => {
                      const Icon = type.icon
                      return (
                        <button
                          key={type.value}
                          onClick={() => setFormType(type.value)}
                          className={clsx(
                            'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                            formType === type.value
                              ? `${type.bg} border-current ${type.color}`
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <Icon className={clsx('w-5 h-5', formType === type.value ? type.color : 'text-gray-400')} />
                          <span className={clsx('text-xs font-medium', formType === type.value ? type.color : 'text-gray-600')}>
                            {type.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Enter title..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Enter description..."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                
                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                {/* Content */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Content *</label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="Enter content, credentials, URL, config JSON..."
                    rows={6}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-sm"
                  />
                </div>
                
                {/* Secure Flag */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="secure"
                    checked={formIsSecure}
                    onChange={(e) => setFormIsSecure(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="secure" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-500" />
                    Mark as secure (contains sensitive data)
                  </label>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={!formTitle.trim() || !formContent.trim()}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className={clsx('px-6 py-4 flex items-center justify-between', getTypeConfig(selectedItem.type).bg)}>
              <div className="flex items-center gap-3">
                {React.createElement(getTypeConfig(selectedItem.type).icon, {
                  className: clsx('w-6 h-6', getTypeConfig(selectedItem.type).color)
                })}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedItem.title}</h3>
                  <p className="text-sm text-gray-600">{selectedItem.description}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="hover:bg-white/50 rounded-lg p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg">
                    {selectedItem.category}
                  </span>
                  {selectedItem.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-sm rounded-lg flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                  {selectedItem.isSecure && (
                    <span className="px-3 py-1 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Secure
                    </span>
                  )}
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-600">CONTENT</span>
                    <button
                      onClick={() => handleCopyToClipboard(selectedItem.content)}
                      className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded text-xs text-gray-600 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap break-all font-mono">
                    {selectedItem.content}
                  </pre>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {new Date(selectedItem.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Last Updated</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {new Date(selectedItem.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between">
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDeleteItem(selectedItem.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors">
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
