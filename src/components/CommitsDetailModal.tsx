import { useState, useMemo } from 'react'
import { 
  X, ExternalLink, User, GitCommit, 
  Copy, Check, Search, ArrowUpDown,
  Plus, Minus, Edit2,
  ChevronDown, Columns
} from 'lucide-react'

export interface CommitDetail {
  commitId: string
  shortId: string
  comment: string
  authorName: string
  authorEmail?: string
  authorDate: string
  committer?: string
  repository: string
  repositoryId?: string
  project?: string
  url: string
  // Extended fields from API
  addedFiles?: number
  editedFiles?: number
  deletedFiles?: number
  changeCounts?: {
    add: number
    edit: number
    delete: number
  }
}

interface ColumnConfig {
  key: keyof CommitDetail | 'changes' | 'actions'
  label: string
  visible: boolean
  width?: string
}

interface CommitsDetailModalProps {
  commits: CommitDetail[]
  isOpen: boolean
  onClose: () => void
  title?: string
  project?: string
  repository?: string
}

const defaultColumns: ColumnConfig[] = [
  { key: 'shortId', label: 'ID', visible: true, width: '80px' },
  { key: 'comment', label: 'Message', visible: true },
  { key: 'authorName', label: 'Author', visible: true, width: '150px' },
  { key: 'authorDate', label: 'Date', visible: true, width: '140px' },
  { key: 'changes', label: 'Changes', visible: true, width: '120px' },
  { key: 'repository', label: 'Repository', visible: false, width: '150px' },
  { key: 'actions', label: '', visible: true, width: '60px' }
]

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffHours < 1) return 'just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

const getFirstLine = (message: string) => {
  return message?.split('\n')[0] || message
}

export function CommitsDetailModal({ 
  commits, 
  isOpen, 
  onClose,
  title = 'Recent Commits',
  project,
  repository
}: CommitsDetailModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'authorDate' | 'authorName'>('authorDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns)
  const [showColumnConfig, setShowColumnConfig] = useState(false)
  const [selectedCommit, setSelectedCommit] = useState<CommitDetail | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  const filteredAndSortedCommits = useMemo(() => {
    let result = [...commits]
    
    // Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(c => 
        c.comment?.toLowerCase().includes(query) ||
        c.authorName?.toLowerCase().includes(query) ||
        c.shortId?.toLowerCase().includes(query) ||
        c.authorEmail?.toLowerCase().includes(query)
      )
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0
      if (sortField === 'authorDate') {
        comparison = new Date(a.authorDate).getTime() - new Date(b.authorDate).getTime()
      } else {
        comparison = (a[sortField] || '').localeCompare(b[sortField] || '')
      }
      return sortOrder === 'desc' ? -comparison : comparison
    })
    
    return result
  }, [commits, searchQuery, sortField, sortOrder])

  const copyCommitId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const toggleColumn = (key: string) => {
    setColumns(cols => cols.map(c => 
      c.key === key ? { ...c, visible: !c.visible } : c
    ))
  }

  const toggleSort = (field: 'authorDate' | 'authorName') => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // Stats
  const stats = useMemo(() => {
    const authors = new Set(commits.map(c => c.authorName))
    const totalAdded = commits.reduce((sum, c) => sum + (c.addedFiles || c.changeCounts?.add || 0), 0)
    const totalEdited = commits.reduce((sum, c) => sum + (c.editedFiles || c.changeCounts?.edit || 0), 0)
    const totalDeleted = commits.reduce((sum, c) => sum + (c.deletedFiles || c.changeCounts?.delete || 0), 0)
    
    return { authors: authors.size, totalAdded, totalEdited, totalDeleted }
  }, [commits])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-4 md:inset-8 lg:inset-12 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <GitCommit className="w-6 h-6 text-blue-500" />
                {title}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                {project && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">
                    {project}
                  </span>
                )}
                {repository && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                    {repository}
                  </span>
                )}
                <span>{commits.length} commits</span>
                <span>•</span>
                <span>{stats.authors} authors</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{commits.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Commits</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">+{stats.totalAdded}</div>
              <div className="text-xs text-green-700 dark:text-green-300">Lines Added</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">~{stats.totalEdited}</div>
              <div className="text-xs text-blue-700 dark:text-blue-300">Files Changed</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">-{stats.totalDeleted}</div>
              <div className="text-xs text-red-700 dark:text-red-300">Lines Removed</div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search commits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 text-sm ${viewMode === 'cards' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}
              >
                Cards
              </button>
            </div>

            {/* Column Config */}
            <div className="relative">
              <button
                onClick={() => setShowColumnConfig(!showColumnConfig)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Columns className="w-4 h-4" />
                <span className="text-sm">Columns</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showColumnConfig ? 'rotate-180' : ''}`} />
              </button>
              
              {showColumnConfig && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                  <div className="p-2">
                    {columns.filter(c => c.key !== 'actions').map((col) => (
                      <label 
                        key={col.key} 
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleColumn(col.key)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                  <tr>
                    {columns.filter(c => c.visible).map((col) => (
                      <th 
                        key={col.key}
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        style={{ width: col.width }}
                      >
                        {col.key === 'authorDate' || col.key === 'authorName' ? (
                          <button
                            onClick={() => toggleSort(col.key as 'authorDate' | 'authorName')}
                            className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100"
                          >
                            {col.label}
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredAndSortedCommits.map((commit) => (
                    <tr 
                      key={commit.commitId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {columns.filter(c => c.visible).map((col) => (
                        <td key={col.key} className="px-3 py-3 text-sm">
                          {col.key === 'shortId' && (
                            <button
                              onClick={() => copyCommitId(commit.commitId)}
                              className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              title="Click to copy full ID"
                            >
                              {copied === commit.commitId ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                              )}
                              {commit.shortId || commit.commitId.substring(0, 7)}
                            </button>
                          )}
                          {col.key === 'comment' && (
                            <button
                              onClick={() => setSelectedCommit(commit)}
                              className="text-left text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-md block"
                              title={commit.comment}
                            >
                              {getFirstLine(commit.comment)}
                            </button>
                          )}
                          {col.key === 'authorName' && (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                {commit.authorName?.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-gray-900 dark:text-gray-100 truncate">
                                {commit.authorName}
                              </span>
                            </div>
                          )}
                          {col.key === 'authorDate' && (
                            <span className="text-gray-500 dark:text-gray-400" title={formatDate(commit.authorDate)}>
                              {formatTimeAgo(commit.authorDate)}
                            </span>
                          )}
                          {col.key === 'changes' && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-600 dark:text-green-400">
                                +{commit.addedFiles || commit.changeCounts?.add || 0}
                              </span>
                              <span className="text-blue-600 dark:text-blue-400">
                                ~{commit.editedFiles || commit.changeCounts?.edit || 0}
                              </span>
                              <span className="text-red-600 dark:text-red-400">
                                -{commit.deletedFiles || commit.changeCounts?.delete || 0}
                              </span>
                            </div>
                          )}
                          {col.key === 'repository' && (
                            <span className="text-gray-500 dark:text-gray-400 truncate">
                              {commit.repository}
                            </span>
                          )}
                          {col.key === 'actions' && (
                            <a
                              href={commit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                              title="View in Azure DevOps"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAndSortedCommits.map((commit) => (
                <div 
                  key={commit.commitId}
                  className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 hover:ring-2 hover:ring-blue-500/20 transition-all cursor-pointer"
                  onClick={() => setSelectedCommit(commit)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <code className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-mono">
                      {commit.shortId || commit.commitId.substring(0, 7)}
                    </code>
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-blue-600"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium mb-2 line-clamp-2">
                    {getFirstLine(commit.comment)}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <User className="w-3.5 h-3.5" />
                      <span>{commit.authorName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-green-600">+{commit.addedFiles || 0}</span>
                      <span className="text-blue-600">~{commit.editedFiles || 0}</span>
                      <span className="text-red-600">-{commit.deletedFiles || 0}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {formatTimeAgo(commit.authorDate)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredAndSortedCommits.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <GitCommit className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No commits found</p>
              {searchQuery && <p className="text-sm mt-1">Try a different search term</p>}
            </div>
          )}
        </div>

        {/* Commit Detail Drawer */}
        {selectedCommit && (
          <div 
            className="absolute inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Commit Details</h3>
              <button
                onClick={() => setSelectedCommit(null)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Commit ID</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm text-gray-800 dark:text-gray-200 truncate">
                    {selectedCommit.commitId}
                  </code>
                  <button
                    onClick={() => copyCommitId(selectedCommit.commitId)}
                    className="p-1 text-gray-500 hover:text-gray-700"
                  >
                    {copied === selectedCommit.commitId ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Message</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {selectedCommit.comment}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Author</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{selectedCommit.authorName}</p>
                  {selectedCommit.authorEmail && (
                    <p className="text-xs text-gray-500">{selectedCommit.authorEmail}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Date</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(selectedCommit.authorDate)}</p>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Repository</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{selectedCommit.repository}</p>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Changes</label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1 text-green-600">
                    <Plus className="w-4 h-4" />
                    <span>{selectedCommit.addedFiles || 0} added</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-600">
                    <Edit2 className="w-4 h-4" />
                    <span>{selectedCommit.editedFiles || 0} modified</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-600">
                    <Minus className="w-4 h-4" />
                    <span>{selectedCommit.deletedFiles || 0} deleted</span>
                  </div>
                </div>
              </div>

              <a
                href={selectedCommit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View in Azure DevOps
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommitsDetailModal
