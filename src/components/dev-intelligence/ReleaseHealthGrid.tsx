import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, TrendingUp, Clock } from 'lucide-react'
import clsx from 'clsx'
import devIntelligenceService, { type BuildHealthSnapshotDto } from '../../services/devIntelligenceService'

interface ReleaseHealthGridProps {
  className?: string
}

export default function ReleaseHealthGrid({ className }: ReleaseHealthGridProps) {
  const [snapshots, setSnapshots] = useState<BuildHealthSnapshotDto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingBranch, setRefreshingBranch] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await devIntelligenceService.getBuildHealth()
      setSnapshots(data)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleRefresh = async (branchName: string) => {
    setRefreshingBranch(branchName)
    try {
      const { data } = await devIntelligenceService.refreshBuildHealth(branchName)
      setSnapshots(prev => prev.map(s => s.branchName === branchName ? data : s))
    } catch { /* silent */ } finally {
      setRefreshingBranch(null)
    }
  }

  if (loading) {
    return (
      <div className={clsx('flex items-center justify-center py-12', className)}>
        <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (snapshots.length === 0) {
    return (
      <div className={clsx('bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center', className)}>
        <TrendingUp className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No build health snapshots yet.</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Use Branch-to-Tenant lookup to trigger build analysis.</p>
      </div>
    )
  }

  return (
    <div className={clsx('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          Release Pipeline Health
        </h3>
        <button onClick={fetchAll} disabled={loading} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1">
          <RefreshCw className={clsx('w-3 h-3', loading && 'animate-spin')} /> Refresh All
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {snapshots.map(s => (
          <BuildHealthCard key={s.id} snapshot={s} refreshing={refreshingBranch === s.branchName} onRefresh={() => handleRefresh(s.branchName)} />
        ))}
      </div>
    </div>
  )
}

function BuildHealthCard({ snapshot: s, refreshing, onRefresh }: { snapshot: BuildHealthSnapshotDto; refreshing: boolean; onRefresh: () => void }) {
  const riskColor = s.riskScore >= 60 ? 'border-red-300 dark:border-red-700' :
    s.riskScore >= 30 ? 'border-amber-300 dark:border-amber-700' :
    'border-green-300 dark:border-green-700'

  const riskBadge = s.riskScore >= 60 ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' :
    s.riskScore >= 30 ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' :
    'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'

  const riskBg = s.riskScore >= 60 ? 'bg-red-500' :
    s.riskScore >= 30 ? 'bg-amber-500' :
    'bg-green-500'

  let recentResults: string[] = []
  try { recentResults = JSON.parse(s.recentBuildResultsJson) } catch { /* empty */ }

  return (
    <div className={clsx('bg-white dark:bg-slate-800 rounded-xl border-2 p-4 transition-colors', riskColor)}>
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.branchName}</p>
          {s.buildDefinitionName && <p className="text-xs text-gray-400 truncate">{s.buildDefinitionName}</p>}
        </div>
        <button onClick={onRefresh} disabled={refreshing} className="p-1 text-gray-400 hover:text-blue-500 rounded disabled:opacity-50">
          <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Risk bar */}
      <div className="h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden mb-2">
        <div className={clsx('h-full rounded-full', riskBg)} style={{ width: `${Math.min(100, s.riskScore)}%` }} />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-0.5"><CheckCircle className="w-3 h-3 text-green-500" /> {s.successCount}</span>
          <span className="flex items-center gap-0.5"><XCircle className="w-3 h-3 text-red-500" /> {s.failureCount}</span>
        </div>
        <span className={clsx('px-2 py-0.5 text-xs font-bold rounded-full', riskBadge)}>
          {s.riskScore.toFixed(0)}%
        </span>
      </div>

      {/* Recent build dots */}
      {recentResults.length > 0 && (
        <div className="flex items-center gap-1 mt-2.5">
          {recentResults.map((r, i) => (
            <span key={i} className={clsx('w-2.5 h-2.5 rounded-full',
              r === 'succeeded' ? 'bg-green-500' : r === 'failed' ? 'bg-red-500' : 'bg-gray-300 dark:bg-slate-500'
            )} title={r} />
          ))}
        </div>
      )}

      {/* Last build */}
      {s.lastBuildAt && (
        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> Last: {s.lastBuildResult} • {new Date(s.lastBuildAt).toLocaleDateString()}
        </p>
      )}

      {/* Recommendation */}
      {s.recommendation && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {s.recommendation}
        </p>
      )}
    </div>
  )
}
