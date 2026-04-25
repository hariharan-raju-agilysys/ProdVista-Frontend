import { useState, useCallback } from 'react'
import { GitBranch, GitCommit, RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Server } from 'lucide-react'
import clsx from 'clsx'
import devIntelligenceService, { type BranchTenantDetail, type BuildHealthSnapshotDto } from '../../services/devIntelligenceService'
import { timeAgo } from '@/utils'

interface BranchTenantPanelProps {
  className?: string
}

export default function BranchTenantPanel({ className }: BranchTenantPanelProps) {
  const [tenantId, setTenantId] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [detail, setDetail] = useState<BranchTenantDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = useCallback(async () => {
    if (!tenantId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await devIntelligenceService.getBranchForTenant(tenantId.trim(), propertyId.trim() || undefined)
      setDetail(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Not found'
      setError(msg)
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId, propertyId])

  return (
    <div className={clsx('bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-green-500" />
          Branch-to-Tenant Lookup
        </h3>
      </div>

      {/* Input Row */}
      <div className="p-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tenant ID</label>
          <input
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="e.g. 1105"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Property ID <span className="text-gray-400">(optional)</span></label>
          <input
            value={propertyId}
            onChange={e => setPropertyId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="e.g. 201"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={lookup}
          disabled={loading || !tenantId.trim()}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
          Lookup
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Detail */}
      {detail && (
        <div className="px-4 pb-4 space-y-4">
          {/* Mapping Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCell label="Branch" value={detail.mapping.branchName} icon={<GitBranch className="w-3.5 h-3.5 text-green-500" />} />
            <InfoCell label="Environment" value={detail.mapping.environment} icon={<Server className="w-3.5 h-3.5 text-blue-500" />} />
            <InfoCell label="Repository" value={detail.mapping.repositoryName || '—'} />
            <InfoCell label="Last Deployed" value={detail.mapping.lastDeployedAt ? timeAgo(detail.mapping.lastDeployedAt) : '—'} icon={<Clock className="w-3.5 h-3.5 text-gray-400" />} />
          </div>

          {/* Build Health */}
          {detail.buildHealth && <BuildHealthBar health={detail.buildHealth} />}

          {/* Recent Commits */}
          {detail.recentCommits.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Last 5 Commits</h4>
              <div className="space-y-1.5">
                {detail.recentCommits.map(c => (
                  <div key={c.commitId} className="flex items-start gap-2.5 py-1.5">
                    <GitCommit className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">{c.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{c.author} • {timeAgo(c.date)} • <span className="font-mono">{c.shortId}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────

function InfoCell({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
        {icon} {value}
      </p>
    </div>
  )
}

function BuildHealthBar({ health }: { health: BuildHealthSnapshotDto }) {
  const riskColor = health.riskScore >= 60 ? 'text-red-600 dark:text-red-400' :
    health.riskScore >= 30 ? 'text-amber-600 dark:text-amber-400' :
    'text-green-600 dark:text-green-400'

  const riskBg = health.riskScore >= 60 ? 'bg-red-500' :
    health.riskScore >= 30 ? 'bg-amber-500' :
    'bg-green-500'

  // Parse recent build results
  let recentResults: string[] = []
  try {
    recentResults = JSON.parse(health.recentBuildResultsJson)
  } catch { /* empty */ }

  return (
    <div className="bg-gray-50 dark:bg-slate-700/40 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Build Health</h4>
          {health.buildDefinitionName && (
            <span className="text-xs text-gray-400 dark:text-gray-500">({health.buildDefinitionName})</span>
          )}
        </div>
        <span className={clsx('text-sm font-bold', riskColor)}>
          Risk: {health.riskScore.toFixed(0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden mb-2">
        <div
          className={clsx('h-full rounded-full transition-all', riskBg)}
          style={{ width: `${Math.min(100, health.riskScore)}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> {health.successCount}</span>
        <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> {health.failureCount}</span>
        <span>of {health.totalBuildsAnalyzed} builds</span>
        {health.avgDurationMs > 0 && <span>• avg {(health.avgDurationMs / 60000).toFixed(1)}m</span>}
      </div>

      {/* Recent build dots */}
      {recentResults.length > 0 && (
        <div className="flex items-center gap-1 mt-2">
          <span className="text-[10px] text-gray-400 mr-1">Recent:</span>
          {recentResults.map((r, i) => (
            <span
              key={i}
              className={clsx(
                'w-3 h-3 rounded-full',
                r === 'succeeded' ? 'bg-green-500' : r === 'failed' ? 'bg-red-500' : 'bg-gray-300 dark:bg-slate-500'
              )}
              title={r}
            />
          ))}
        </div>
      )}

      {/* Recommendation */}
      {health.recommendation && (
        <div className="mt-2 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">{health.recommendation}</p>
        </div>
      )}
    </div>
  )
}
