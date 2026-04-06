import { useState, useMemo } from 'react'
import { 
  X, ExternalLink, GitPullRequest, GitBranch, User, Calendar, 
  Search, Clock, Download, BarChart3, PieChart, Users,
  Eye, ThumbsUp, CheckCircle2,
  XCircle, Maximize2, Minimize2, RefreshCw,
  ChevronDown, ChevronUp, Settings2, Columns, LayoutGrid, List,
  GitMerge, FileCode, TrendingUp, AlertTriangle
} from 'lucide-react'
import { PRDetailModal, PullRequestDetail, PRReviewer } from './PRDetailModal'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface PRItem {
  pullRequestId: number
  title: string
  description?: string
  createdBy: string
  creationDate: string
  sourceBranch: string
  targetBranch: string
  repositoryName: string
  url: string
  webUrl?: string
  isApproved?: boolean
  isDraft?: boolean
  status?: string
  reviewers?: { displayName: string; vote: number }[]
  mergeStatus?: string
}

interface AdvancedPRListModalProps {
  prs: PRItem[]
  isOpen: boolean
  onClose: () => void
  title?: string
  onRefresh?: () => void
  isLoading?: boolean
}

type ViewMode = 'table' | 'cards' | 'compact' | 'report'
type SortField = 'date' | 'title' | 'author' | 'repository' | 'status'

// Author Report Data
interface AuthorStats {
  author: string
  total: number
  draft: number
  waiting: number
  approved: number
  rejected: number
  avgAge: number
  avgHealth: number
  repos: string[]
}
type SortOrder = 'asc' | 'desc'
type FilterStatus = 'all' | 'active' | 'draft' | 'approved' | 'waiting' | 'rejected'

// ─────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────

const getBranchName = (fullBranch: string) => fullBranch?.replace('refs/heads/', '') || fullBranch

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

const getStatusInfo = (pr: PRItem) => {
  if (pr.isDraft) {
    return { label: 'Draft', color: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300', icon: FileCode }
  }
  
  const approvedCount = pr.reviewers?.filter(r => r.vote >= 5).length || 0
  const rejectedCount = pr.reviewers?.filter(r => r.vote === -10).length || 0
  
  if (rejectedCount > 0) {
    return { label: 'Changes Requested', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300', icon: XCircle }
  }
  if (approvedCount >= 2 || pr.isApproved) {
    return { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', icon: CheckCircle2 }
  }
  if (approvedCount > 0) {
    return { label: 'Partially Approved', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', icon: ThumbsUp }
  }
  
  return { label: 'Awaiting Review', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300', icon: Clock }
}

const getPRHealth = (pr: PRItem) => {
  let score = 50
  const approvedCount = pr.reviewers?.filter(r => r.vote >= 5).length || 0
  const rejectedCount = pr.reviewers?.filter(r => r.vote === -10).length || 0
  
  if (approvedCount > 0) score += 20
  if (approvedCount >= 2) score += 15
  if (rejectedCount > 0) score -= 30
  if (pr.isDraft) score -= 10
  
  const ageInDays = Math.floor((Date.now() - new Date(pr.creationDate).getTime()) / 86400000)
  if (ageInDays > 7) score -= 10
  if (ageInDays > 14) score -= 15
  
  return Math.max(0, Math.min(100, score))
}

// ─────────────────────────────────────────
// Column Configuration
// ─────────────────────────────────────────

interface ColumnConfig {
  id: string
  label: string
  visible: boolean
}

const defaultColumns: ColumnConfig[] = [
  { id: 'id', label: 'ID', visible: true },
  { id: 'title', label: 'Title', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'author', label: 'Author', visible: true },
  { id: 'repository', label: 'Repository', visible: true },
  { id: 'branch', label: 'Branch', visible: true },
  { id: 'date', label: 'Created', visible: true },
  { id: 'health', label: 'Health', visible: true },
  { id: 'reviewers', label: 'Reviewers', visible: true },
]

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────

export function AdvancedPRListModal({ 
  prs, 
  isOpen, 
  onClose, 
  title = 'Pull Requests',
  onRefresh,
  isLoading = false
}: AdvancedPRListModalProps) {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterRepo, setFilterRepo] = useState<string>('all')
  const [filterAuthor, setFilterAuthor] = useState<string>('all')
  
  // Sort state
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
  // Column config
  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns)
  const [showColumnConfig, setShowColumnConfig] = useState(false)
  
  // Detail modal
  const [selectedPR, setSelectedPR] = useState<PullRequestDetail | null>(null)
  
  // Derived data
  const repositories = useMemo(() => 
    [...new Set(prs.map(pr => pr.repositoryName))].sort(),
  [prs])
  
  const authors = useMemo(() => 
    [...new Set(prs.map(pr => pr.createdBy))].sort(),
  [prs])
  
  // Filtered and sorted PRs
  const filteredPRs = useMemo(() => {
    let result = [...prs]
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(pr => 
        pr.title.toLowerCase().includes(q) ||
        pr.pullRequestId.toString().includes(q) ||
        pr.createdBy.toLowerCase().includes(q) ||
        pr.repositoryName.toLowerCase().includes(q) ||
        getBranchName(pr.sourceBranch).toLowerCase().includes(q)
      )
    }
    
    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(pr => {
        const status = getStatusInfo(pr)
        switch (filterStatus) {
          case 'draft': return pr.isDraft
          case 'approved': return status.label.includes('Approved')
          case 'waiting': return status.label === 'Awaiting Review'
          case 'rejected': return status.label === 'Changes Requested'
          case 'active': return !pr.isDraft && pr.status !== 'completed'
          default: return true
        }
      })
    }
    
    // Repo filter
    if (filterRepo !== 'all') {
      result = result.filter(pr => pr.repositoryName === filterRepo)
    }
    
    // Author filter
    if (filterAuthor !== 'all') {
      result = result.filter(pr => pr.createdBy === filterAuthor)
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'date':
          comparison = new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime()
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'author':
          comparison = a.createdBy.localeCompare(b.createdBy)
          break
        case 'repository':
          comparison = a.repositoryName.localeCompare(b.repositoryName)
          break
        case 'status':
          comparison = getStatusInfo(a).label.localeCompare(getStatusInfo(b).label)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
    
    return result
  }, [prs, searchQuery, filterStatus, filterRepo, filterAuthor, sortField, sortOrder])
  
  // Stats
  const stats = useMemo(() => ({
    total: prs.length,
    active: prs.filter(pr => !pr.isDraft && pr.status !== 'completed').length,
    draft: prs.filter(pr => pr.isDraft).length,
    approved: prs.filter(pr => pr.isApproved || pr.reviewers?.some(r => r.vote >= 5)).length,
    waiting: prs.filter(pr => !pr.isDraft && !pr.isApproved && !pr.reviewers?.some(r => r.vote !== 0)).length,
  }), [prs])
  
  // Author Report Data
  const authorReport = useMemo((): AuthorStats[] => {
    const authorMap = new Map<string, PRItem[]>()
    
    prs.forEach(pr => {
      const existing = authorMap.get(pr.createdBy) || []
      existing.push(pr)
      authorMap.set(pr.createdBy, existing)
    })
    
    return Array.from(authorMap.entries()).map(([author, authorPRs]) => {
      const draft = authorPRs.filter(pr => pr.isDraft).length
      const approved = authorPRs.filter(pr => {
        const status = getStatusInfo(pr)
        return status.label.includes('Approved')
      }).length
      const rejected = authorPRs.filter(pr => {
        const status = getStatusInfo(pr)
        return status.label === 'Changes Requested'
      }).length
      const waiting = authorPRs.filter(pr => {
        const status = getStatusInfo(pr)
        return status.label === 'Awaiting Review'
      }).length
      
      const ages = authorPRs.map(pr => 
        Math.floor((Date.now() - new Date(pr.creationDate).getTime()) / 86400000)
      )
      const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0
      
      const healths = authorPRs.map(pr => getPRHealth(pr))
      const avgHealth = healths.length > 0 ? Math.round(healths.reduce((a, b) => a + b, 0) / healths.length) : 0
      
      const repos = [...new Set(authorPRs.map(pr => pr.repositoryName))]
      
      return {
        author,
        total: authorPRs.length,
        draft,
        waiting,
        approved,
        rejected,
        avgAge,
        avgHealth,
        repos,
      }
    }).sort((a, b) => b.total - a.total)
  }, [prs])
  
  // Download Report as CSV
  const downloadReport = () => {
    const headers = ['Author', 'Total PRs', 'Draft', 'Awaiting Review', 'Approved', 'Changes Requested', 'Avg Age (days)', 'Avg Health %', 'Repositories']
    const rows = authorReport.map(a => [
      a.author,
      a.total,
      a.draft,
      a.waiting,
      a.approved,
      a.rejected,
      a.avgAge,
      a.avgHealth,
      a.repos.join('; ')
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `pr-report-by-author-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }
  
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }
  
  const toggleColumn = (columnId: string) => {
    setColumns(cols => cols.map(c => 
      c.id === columnId ? { ...c, visible: !c.visible } : c
    ))
  }
  
  const openPRDetail = (pr: PRItem) => {
    setSelectedPR({
      id: pr.pullRequestId,
      title: pr.title,
      description: pr.description,
      status: pr.status || 'active',
      createdBy: pr.createdBy,
      creationDate: pr.creationDate,
      sourceBranch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
      repository: pr.repositoryName,
      isDraft: pr.isDraft || false,
      url: pr.url,
      webUrl: pr.webUrl,
      reviewers: pr.reviewers?.map(r => ({ name: r.displayName, vote: r.vote })) as PRReviewer[] | undefined,
    })
  }
  
  const clearFilters = () => {
    setSearchQuery('')
    setFilterStatus('all')
    setFilterRepo('all')
    setFilterAuthor('all')
  }
  
  const hasActiveFilters = searchQuery || filterStatus !== 'all' || filterRepo !== 'all' || filterAuthor !== 'all'
  
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        
        {/* Modal */}
        <div className={`absolute bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
          isFullscreen ? 'inset-0 rounded-none' : 'inset-4 md:inset-6 lg:inset-8'
        }`}>
          {/* Header */}
          <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-indigo-600">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <GitPullRequest className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{title}</h2>
                  <p className="text-xs text-white/70">
                    {filteredPRs.length} of {prs.length} PRs • 
                    {stats.active} active • {stats.approved} approved • {stats.waiting} waiting
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <input
                  type="text"
                  placeholder="Search PRs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
              
              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="all" className="text-gray-900">All Status</option>
                <option value="active" className="text-gray-900">Active</option>
                <option value="draft" className="text-gray-900">Draft</option>
                <option value="approved" className="text-gray-900">Approved</option>
                <option value="waiting" className="text-gray-900">Waiting</option>
                <option value="rejected" className="text-gray-900">Changes Requested</option>
              </select>
              
              {/* Repo Filter */}
              <select
                value={filterRepo}
                onChange={(e) => setFilterRepo(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 max-w-[150px]"
              >
                <option value="all" className="text-gray-900">All Repos</option>
                {repositories.map(repo => (
                  <option key={repo} value={repo} className="text-gray-900">{repo}</option>
                ))}
              </select>
              
              {/* Author Filter */}
              <select
                value={filterAuthor}
                onChange={(e) => setFilterAuthor(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 max-w-[150px]"
              >
                <option value="all" className="text-gray-900">All Authors</option>
                {authors.map(author => (
                  <option key={author} value={author} className="text-gray-900">{author}</option>
                ))}
              </select>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm text-white font-medium transition-colors"
                >
                  Clear Filters
                </button>
              )}
              
              {/* View Mode */}
              <div className="flex items-center gap-1 ml-auto bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
                  title="Table view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded transition-colors ${viewMode === 'cards' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
                  title="Card view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-1.5 rounded transition-colors ${viewMode === 'compact' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
                  title="Compact view"
                >
                  <Columns className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/30" />
                <button
                  onClick={() => setViewMode('report')}
                  className={`p-1.5 rounded transition-colors ${viewMode === 'report' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}`}
                  title="Author Report"
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              </div>
              
              {/* Download Report */}
              {viewMode === 'report' && (
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              )}
              
              {/* Column Config */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnConfig(!showColumnConfig)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
                  title="Configure columns"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                
                {showColumnConfig && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-10">
                    <p className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Columns</p>
                    {columns.map(col => (
                      <label key={col.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Stats Bar */}
          <div className="flex-shrink-0 flex items-center gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <StatPill label="Total" value={stats.total} color="gray" />
            <StatPill label="Active" value={stats.active} color="blue" />
            <StatPill label="Draft" value={stats.draft} color="gray" />
            <StatPill label="Approved" value={stats.approved} color="green" />
            <StatPill label="Waiting" value={stats.waiting} color="yellow" />
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-auto">
            {filteredPRs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <GitPullRequest className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">No PRs found</p>
                <p className="text-sm">Try adjusting your filters</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : viewMode === 'table' ? (
              <TableView 
                prs={filteredPRs} 
                columns={columns} 
                sortField={sortField} 
                sortOrder={sortOrder} 
                toggleSort={toggleSort}
                onSelect={openPRDetail}
              />
            ) : viewMode === 'cards' ? (
              <CardView prs={filteredPRs} onSelect={openPRDetail} />
            ) : viewMode === 'report' ? (
              <ReportView authorStats={authorReport} totalPRs={prs.length} />
            ) : (
              <CompactView prs={filteredPRs} onSelect={openPRDetail} />
            )}
          </div>
        </div>
      </div>
      
      {/* PR Detail Modal */}
      <PRDetailModal
        pr={selectedPR}
        isOpen={!!selectedPR}
        onClose={() => setSelectedPR(null)}
      />
    </>
  )
}

// ─────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  }
  
  return (
    <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <span>{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}

function TableView({ 
  prs, 
  columns, 
  sortField, 
  sortOrder, 
  toggleSort,
  onSelect 
}: { 
  prs: PRItem[]
  columns: ColumnConfig[]
  sortField: SortField
  sortOrder: SortOrder
  toggleSort: (field: SortField) => void
  onSelect: (pr: PRItem) => void
}) {
  const visibleCols = columns.filter(c => c.visible)
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }
  
  return (
    <table className="w-full">
      <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
        <tr>
          {visibleCols.map(col => (
            <th 
              key={col.id}
              className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              onClick={() => {
                const sortableFields: Record<string, SortField> = {
                  id: 'date', title: 'title', author: 'author', repository: 'repository', status: 'status', date: 'date'
                }
                if (sortableFields[col.id]) toggleSort(sortableFields[col.id])
              }}
            >
              <span className="flex items-center gap-1">
                {col.label}
                <SortIcon field={col.id as SortField} />
              </span>
            </th>
          ))}
          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {prs.map(pr => {
          const status = getStatusInfo(pr)
          const health = getPRHealth(pr)
          const StatusIcon = status.icon
          
          return (
            <tr 
              key={pr.pullRequestId}
              className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
              onClick={() => onSelect(pr)}
            >
              {visibleCols.some(c => c.id === 'id') && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm font-mono text-purple-600 dark:text-purple-400">
                    #{pr.pullRequestId}
                  </span>
                </td>
              )}
              {visibleCols.some(c => c.id === 'title') && (
                <td className="px-4 py-3 max-w-md">
                  <div className="flex items-center gap-2">
                    {pr.isDraft && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded font-medium">
                        DRAFT
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {pr.title}
                    </span>
                  </div>
                </td>
              )}
              {visibleCols.some(c => c.id === 'status') && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </td>
              )}
              {visibleCols.some(c => c.id === 'author') && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{pr.createdBy}</span>
                </td>
              )}
              {visibleCols.some(c => c.id === 'repository') && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">{pr.repositoryName}</span>
                </td>
              )}
              {visibleCols.some(c => c.id === 'branch') && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                    <span className="text-blue-600 dark:text-blue-400">{getBranchName(pr.sourceBranch)}</span>
                    <GitMerge className="w-3 h-3" />
                    <span className="text-green-600 dark:text-green-400">{getBranchName(pr.targetBranch)}</span>
                  </div>
                </td>
              )}
              {visibleCols.some(c => c.id === 'date') && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{formatTimeAgo(pr.creationDate)}</span>
                </td>
              )}
              {visibleCols.some(c => c.id === 'health') && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          health >= 70 ? 'bg-green-500' : health >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${health}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-500">{health}%</span>
                  </div>
                </td>
              )}
              {visibleCols.some(c => c.id === 'reviewers') && (
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex -space-x-1">
                    {pr.reviewers?.slice(0, 3).map((r, i) => (
                      <div
                        key={i}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium border-2 border-white dark:border-gray-900 ${
                          r.vote >= 5 ? 'bg-green-500 text-white' : 
                          r.vote < 0 ? 'bg-red-500 text-white' : 
                          'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                        title={`${r.displayName}: ${r.vote >= 5 ? 'Approved' : r.vote < 0 ? 'Rejected' : 'Pending'}`}
                      >
                        {r.displayName.charAt(0)}
                      </div>
                    ))}
                    {pr.reviewers && pr.reviewers.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-medium text-gray-600 dark:text-gray-400 border-2 border-white dark:border-gray-900">
                        +{pr.reviewers.length - 3}
                      </div>
                    )}
                  </div>
                </td>
              )}
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(pr) }}
                    className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <a
                    href={pr.webUrl || pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Open in DevOps"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function CardView({ prs, onSelect }: { prs: PRItem[]; onSelect: (pr: PRItem) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {prs.map(pr => {
        const status = getStatusInfo(pr)
        const health = getPRHealth(pr)
        const StatusIcon = status.icon
        
        return (
          <div 
            key={pr.pullRequestId}
            onClick={() => onSelect(pr)}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-600 transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </span>
              <span className="text-xs font-mono text-purple-600 dark:text-purple-400">#{pr.pullRequestId}</span>
            </div>
            
            {/* Title */}
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2">
              {pr.title}
            </h3>
            
            {/* Branch */}
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-mono mb-3">
              <GitBranch className="w-3 h-3" />
              <span className="text-blue-600 dark:text-blue-400 truncate">{getBranchName(pr.sourceBranch)}</span>
              <GitMerge className="w-3 h-3 shrink-0" />
              <span className="text-green-600 dark:text-green-400 truncate">{getBranchName(pr.targetBranch)}</span>
            </div>
            
            {/* Health Bar */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    health >= 70 ? 'bg-green-500' : health >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${health}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-gray-500">{health}%</span>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{pr.createdBy}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatTimeAgo(pr.creationDate)}</span>
              </div>
            </div>
            
            {/* Reviewers */}
            {pr.reviewers && pr.reviewers.length > 0 && (
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-[10px] text-gray-400 mr-1">Reviewers:</span>
                <div className="flex -space-x-1">
                  {pr.reviewers.slice(0, 4).map((r, i) => (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium border border-white dark:border-gray-800 ${
                        r.vote >= 5 ? 'bg-green-500 text-white' : 
                        r.vote < 0 ? 'bg-red-500 text-white' : 
                        'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {r.displayName.charAt(0)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CompactView({ prs, onSelect }: { prs: PRItem[]; onSelect: (pr: PRItem) => void }) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {prs.map(pr => {
        const status = getStatusInfo(pr)
        const StatusIcon = status.icon
        
        return (
          <div 
            key={pr.pullRequestId}
            onClick={() => onSelect(pr)}
            className="flex items-center gap-4 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
          >
            <span className="font-mono text-xs text-purple-600 dark:text-purple-400 w-16">
              #{pr.pullRequestId}
            </span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${status.color} w-28`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
            <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">
              {pr.title}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-24 truncate">
              {pr.createdBy}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono w-32 truncate">
              {pr.repositoryName}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-16">
              {formatTimeAgo(pr.creationDate)}
            </span>
            <a
              href={pr.webUrl || pr.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )
      })}
    </div>
  )
}

function ReportView({ authorStats, totalPRs }: { authorStats: AuthorStats[]; totalPRs: number }) {
  const maxTotal = Math.max(...authorStats.map(a => a.total), 1)
  
  return (
    <div className="p-6 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">Contributors</span>
          </div>
          <div className="text-3xl font-bold">{authorStats.length}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <GitPullRequest className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">Total PRs</span>
          </div>
          <div className="text-3xl font-bold">{totalPRs}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">Awaiting Review</span>
          </div>
          <div className="text-3xl font-bold">{authorStats.reduce((sum, a) => sum + a.waiting, 0)}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">Approved</span>
          </div>
          <div className="text-3xl font-bold">{authorStats.reduce((sum, a) => sum + a.approved, 0)}</div>
        </div>
      </div>
      
      {/* Author Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-500" />
            PR Analysis by Author
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {authorStats.length} contributors
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Author
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Draft
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Awaiting
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Approved
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Changes Req.
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Avg Age
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Health
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Distribution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {authorStats.map((author, idx) => {
                const healthColor = author.avgHealth >= 70 ? 'text-green-600' : author.avgHealth >= 40 ? 'text-yellow-600' : 'text-red-600'
                const barWidth = (author.total / maxTotal) * 100
                
                return (
                  <tr key={author.author} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-900/30'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {author.author.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{author.author}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{author.repos.length} repos</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold text-sm">
                        {author.total}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {author.draft > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium">
                          <FileCode className="w-3 h-3" />
                          {author.draft}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {author.waiting > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 text-xs font-medium">
                          <Clock className="w-3 h-3" />
                          {author.waiting}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {author.approved > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {author.approved}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {author.rejected > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          {author.rejected}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {author.avgAge}d
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className={`w-4 h-4 ${healthColor}`} />
                        <span className={`text-sm font-medium ${healthColor}`}>{author.avgHealth}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-32">
                        <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                          <div 
                            className="bg-green-500 transition-all duration-500" 
                            style={{ width: `${author.total > 0 ? (author.approved / author.total) * barWidth : 0}%` }}
                          />
                          <div 
                            className="bg-yellow-500 transition-all duration-500" 
                            style={{ width: `${author.total > 0 ? (author.waiting / author.total) * barWidth : 0}%` }}
                          />
                          <div 
                            className="bg-gray-400 transition-all duration-500" 
                            style={{ width: `${author.total > 0 ? (author.draft / author.total) * barWidth : 0}%` }}
                          />
                          <div 
                            className="bg-red-500 transition-all duration-500" 
                            style={{ width: `${author.total > 0 ? (author.rejected / author.total) * barWidth : 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Totals Row */}
            <tfoot className="bg-gray-100 dark:bg-gray-900 font-semibold">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                  Total ({authorStats.length} authors)
                </td>
                <td className="px-6 py-4 text-center text-sm text-purple-600 dark:text-purple-400">{totalPRs}</td>
                <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400">{authorStats.reduce((sum, a) => sum + a.draft, 0)}</td>
                <td className="px-6 py-4 text-center text-sm text-yellow-600 dark:text-yellow-400">{authorStats.reduce((sum, a) => sum + a.waiting, 0)}</td>
                <td className="px-6 py-4 text-center text-sm text-green-600 dark:text-green-400">{authorStats.reduce((sum, a) => sum + a.approved, 0)}</td>
                <td className="px-6 py-4 text-center text-sm text-red-600 dark:text-red-400">{authorStats.reduce((sum, a) => sum + a.rejected, 0)}</td>
                <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                  {Math.round(authorStats.reduce((sum, a) => sum + a.avgAge, 0) / authorStats.length)}d
                </td>
                <td className="px-6 py-4 text-center text-sm text-blue-600 dark:text-blue-400">
                  {Math.round(authorStats.reduce((sum, a) => sum + a.avgHealth, 0) / authorStats.length)}%
                </td>
                <td className="px-6 py-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdvancedPRListModal
