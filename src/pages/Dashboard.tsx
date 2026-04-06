import { useEffect, useState } from 'react'
import { GitPullRequest, RefreshCw, User, Clock, Layers, Calendar, Eye } from 'lucide-react'
import PRDashboardWidget from '../components/PRDashboardWidget'
import { useAuth } from '../context/AuthContext'
import { getPRSummary, getCommitStats, PRSummaryResponse, CommitStatsResponse } from '../services/internalDashboardService'

export default function Dashboard() {
  const { user } = useAuth()
  const [prData, setPrData] = useState<PRSummaryResponse | null>(null)
  const [commitData, setCommitData] = useState<CommitStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [timeFilter, setTimeFilter] = useState<'week' | 'all'>('all')

  // Fetch PR and Commit stats using internal dashboard API
  const fetchStats = async () => {
    setLoading(true)
    try {
      // Fetch PRs - hoursBack=168 for last week
      const hoursBack = timeFilter === 'week' ? 168 : undefined
      const [prResult, commitResult] = await Promise.all([
        getPRSummary(undefined, false), // Get all PRs, API returns myCreatedCount
        getCommitStats(undefined, 7, false) // Get commits from last 7 days
      ])
      
      setPrData(prResult)
      setCommitData(commitResult)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [user?.email, timeFilter])

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never'
    const diff = Date.now() - lastUpdated.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min ago`
    return lastUpdated.toLocaleTimeString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          {user?.email && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              <User className="w-4 h-4" />
              {user.email}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Time Filter Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeFilter === 'week' 
                  ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3 h-3 inline mr-1" />
              Last Week
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeFilter === 'all' 
                  ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All Active
            </button>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatLastUpdated()}
          </span>
          <button 
            onClick={fetchStats}
            disabled={loading}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* PR Stats Cards - Real API Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Total Open PRs</p>
              <p className="text-3xl font-bold mt-1">{loading ? '...' : prData?.totalActiveAll || 0}</p>
            </div>
            <GitPullRequest className="w-10 h-10 text-purple-200" />
          </div>
          <p className="text-purple-200 text-xs mt-2">Across all projects</p>
        </div>

        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">My Pull Requests</p>
              <p className="text-3xl font-bold mt-1">{loading ? '...' : prData?.myCreatedCount || 0}</p>
            </div>
            <User className="w-10 h-10 text-blue-200" />
          </div>
          <p className="text-blue-200 text-xs mt-2">Created by {prData?.currentUserEmail?.split('@')[0] || 'you'}</p>
        </div>

        <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">To Review</p>
              <p className="text-3xl font-bold mt-1">{loading ? '...' : prData?.toReviewCount || 0}</p>
            </div>
            <Eye className="w-10 h-10 text-orange-200" />
          </div>
          <p className="text-orange-200 text-xs mt-2">Waiting for your review</p>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">My Commits</p>
              <p className="text-3xl font-bold mt-1">{loading ? '...' : commitData?.myCommitsCount || 0}</p>
            </div>
            <Layers className="w-10 h-10 text-green-200" />
          </div>
          <p className="text-green-200 text-xs mt-2">Last {commitData?.daysBack || 7} days</p>
        </div>
      </div>

      {/* User Info Banner - Show when no PRs found */}
      {!loading && prData?.myCreatedCount === 0 && prData?.toReviewCount === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-blue-800 dark:text-blue-200 font-medium">No PRs found for your account</p>
              <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
                Looking for PRs by: <span className="font-mono">{prData?.currentUserEmail}</span>
              </p>
              <p className="text-blue-500 dark:text-blue-500 text-xs mt-2">
                Showing all {prData?.totalActiveAll || 0} active PRs from the team below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pull Requests Widget - Full Width */}
      <div className="grid grid-cols-1 gap-6">
        <PRDashboardWidget 
          currentUserEmail={user?.email} 
          maxItems={15}
        />
      </div>
    </div>
  )
}
