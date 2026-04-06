import { useState } from 'react'
import { 
  X, ExternalLink, GitBranch, GitMerge, User, 
  Check, FileText, Code, Calendar, Tag, Copy, CheckCircle2, XCircle,
  Eye, ThumbsUp, HelpCircle, Timer
} from 'lucide-react'

export interface PRReviewer {
  name: string
  vote: number
  id?: string
  imageUrl?: string
}

export interface PullRequestDetail {
  id: number
  title: string
  description?: string
  status: string
  createdBy: string
  createdByEmail?: string
  creationDate: string
  sourceBranch: string
  targetBranch: string
  repository: string
  project?: string
  isDraft: boolean
  reviewers?: PRReviewer[]
  url: string
  webUrl?: string
  // Extended fields
  mergeStatus?: string
  autoComplete?: boolean
  labels?: string[]
  workItemRefs?: { id: number; title: string; url: string }[]
  commits?: { id: string; message: string; author: string; date: string }[]
  comments?: number
  iterations?: number
}

interface PRDetailModalProps {
  pr: PullRequestDetail | null
  isOpen: boolean
  onClose: () => void
}

const getVoteInfo = (vote: number): { icon: React.ReactNode; label: string; color: string } => {
  switch (vote) {
    case 10:
      return { 
        icon: <CheckCircle2 className="w-4 h-4" />, 
        label: 'Approved', 
        color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' 
      }
    case 5:
      return { 
        icon: <ThumbsUp className="w-4 h-4" />, 
        label: 'Approved with suggestions', 
        color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' 
      }
    case -5:
      return { 
        icon: <Timer className="w-4 h-4" />, 
        label: 'Waiting for author', 
        color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400' 
      }
    case -10:
      return { 
        icon: <XCircle className="w-4 h-4" />, 
        label: 'Rejected', 
        color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' 
      }
    default:
      return { 
        icon: <HelpCircle className="w-4 h-4" />, 
        label: 'No vote yet', 
        color: 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400' 
      }
  }
}

const getStatusBadge = (status: string, isDraft: boolean) => {
  if (isDraft) {
    return { label: 'Draft', color: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' }
  }
  switch (status?.toLowerCase()) {
    case 'active':
      return { label: 'Active', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' }
    case 'completed':
      return { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' }
    case 'abandoned':
      return { label: 'Abandoned', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' }
    default:
      return { label: status || 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' }
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
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

const getBranchName = (fullBranch: string) => {
  return fullBranch?.replace('refs/heads/', '') || fullBranch
}

export function PRDetailModal({ pr, isOpen, onClose }: PRDetailModalProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'reviewers' | 'commits'>('overview')

  if (!isOpen || !pr) return null

  const statusBadge = getStatusBadge(pr.status, pr.isDraft)
  const approvedCount = pr.reviewers?.filter(r => r.vote >= 5).length || 0
  const rejectedCount = pr.reviewers?.filter(r => r.vote === -10).length || 0
  const waitingCount = pr.reviewers?.filter(r => r.vote === 0).length || 0

  const copyPRLink = () => {
    navigator.clipboard.writeText(pr.webUrl || pr.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Analysis summary
  const getHealthScore = () => {
    let score = 50 // Base score
    
    // Approval status
    if (approvedCount > 0) score += 20
    if (approvedCount >= 2) score += 15
    if (rejectedCount > 0) score -= 30
    
    // Draft status
    if (pr.isDraft) score -= 10
    
    // Age penalty
    const ageInDays = Math.floor((Date.now() - new Date(pr.creationDate).getTime()) / 86400000)
    if (ageInDays > 7) score -= 10
    if (ageInDays > 14) score -= 15
    
    return Math.max(0, Math.min(100, score))
  }

  const healthScore = getHealthScore()
  const healthColor = healthScore >= 70 ? 'text-green-500' : healthScore >= 40 ? 'text-yellow-500' : 'text-red-500'

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
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between p-4 md:p-6">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge.color}`}>
                  {statusBadge.label}
                </span>
                {pr.project && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 rounded-full">
                    {pr.project}
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  #{pr.id}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {pr.title}
              </h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {pr.createdBy}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatTimeAgo(pr.creationDate)}
                </span>
                <span className="flex items-center gap-1">
                  <Code className="w-4 h-4" />
                  {pr.repository}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyPRLink}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Copy link"
              >
                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </button>
              <a
                href={pr.webUrl || pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Open in Azure DevOps"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 md:px-6">
            {(['overview', 'reviewers', 'commits'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-b-2 border-blue-500'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'reviewers' && pr.reviewers && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded-full">
                    {pr.reviewers.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column - Main info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Branch Info */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    Branch Information
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Source</p>
                      <code className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-sm font-mono">
                        {getBranchName(pr.sourceBranch)}
                      </code>
                    </div>
                    <GitMerge className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Target</p>
                      <code className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-sm font-mono">
                        {getBranchName(pr.targetBranch)}
                      </code>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Description
                  </h3>
                  {pr.description ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {pr.description}
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500 italic">No description provided</p>
                  )}
                </div>

                {/* Labels */}
                {pr.labels && pr.labels.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Labels
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {pr.labels.map((label, i) => (
                        <span key={i} className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-sm">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column - Stats & Analysis */}
              <div className="space-y-6">
                {/* Health Score */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    PR Health Score
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className={`text-4xl font-bold ${healthColor}`}>
                      {healthScore}%
                    </div>
                    <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          healthScore >= 70 ? 'bg-green-500' : healthScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${healthScore}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Based on approvals, age, and draft status
                  </p>
                </div>

                {/* Review Status Summary */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Review Summary
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{approvedCount}</div>
                      <div className="text-xs text-green-700 dark:text-green-300">Approved</div>
                    </div>
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{waitingCount}</div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-300">Waiting</div>
                    </div>
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{rejectedCount}</div>
                      <div className="text-xs text-red-700 dark:text-red-300">Rejected</div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Details
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Created</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(pr.creationDate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Repository</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{pr.repository}</span>
                    </div>
                    {pr.iterations && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Iterations</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{pr.iterations}</span>
                      </div>
                    )}
                    {pr.comments !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Comments</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{pr.comments}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviewers' && (
            <div className="space-y-3">
              {pr.reviewers && pr.reviewers.length > 0 ? (
                pr.reviewers.map((reviewer, idx) => {
                  const voteInfo = getVoteInfo(reviewer.vote)
                  return (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                          {reviewer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{reviewer.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Reviewer</p>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${voteInfo.color}`}>
                        {voteInfo.icon}
                        <span className="text-sm font-medium">{voteInfo.label}</span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No reviewers assigned yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'commits' && (
            <div className="space-y-3">
              {pr.commits && pr.commits.length > 0 ? (
                pr.commits.map((commit, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <Code className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {commit.message}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span>{commit.author}</span>
                        <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">
                          {commit.id.substring(0, 7)}
                        </code>
                        <span>{formatTimeAgo(commit.date)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Code className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Commit details not available in this view</p>
                  <p className="text-sm mt-1">Open in Azure DevOps to see full commit history</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PRDetailModal
