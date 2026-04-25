import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, AlertCircle, Info, RefreshCw, ExternalLink, Clock } from 'lucide-react'
import clsx from 'clsx'
import devIntelligenceService, { type AttentionQueueResult, type AttentionItem } from '../../services/devIntelligenceService'

interface AttentionQueueProps {
  devOpsUniqueName?: string
  className?: string
}

const PRIORITY_CONFIG: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
  critical: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
  },
  warning: {
    icon: <AlertCircle className="w-4 h-4" />,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
  },
}

export default function AttentionQueue({ devOpsUniqueName, className }: AttentionQueueProps) {
  const [data, setData] = useState<AttentionQueueResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!devOpsUniqueName) return
    setLoading(true)
    setError(null)
    try {
      const { data: result } = await devIntelligenceService.getAttentionQueue(devOpsUniqueName)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attention queue')
    } finally {
      setLoading(false)
    }
  }, [devOpsUniqueName])

  useEffect(() => { fetch() }, [fetch])

  if (!devOpsUniqueName) {
    return (
      <div className={clsx('bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6', className)}>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Select a team member to view their attention queue.</p>
      </div>
    )
  }

  return (
    <div className={clsx('bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Attention Queue</h3>
          {data && (
            <div className="flex items-center gap-2">
              {data.criticalCount > 0 && <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-medium">{data.criticalCount} critical</span>}
              {data.warningCount > 0 && <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium">{data.warningCount} warning</span>}
            </div>
          )}
        </div>
        <button onClick={fetch} disabled={loading} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{error}</div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            ✅ All clear — nothing needs attention right now.
          </div>
        )}

        {data?.items.map((item, i) => (
          <AttentionItemCard key={i} item={item} />
        ))}
      </div>
    </div>
  )
}

function AttentionItemCard({ item }: { item: AttentionItem }) {
  const config = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.info

  return (
    <div className={clsx('flex items-start gap-3 p-3 rounded-lg border', config.bg, config.border)}>
      <span className={clsx('mt-0.5 shrink-0', config.text)}>{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium', config.text)}>{item.title}</p>
        {item.subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.subtitle}</p>}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 font-medium">{item.category}</span>
          {item.ageDays != null && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" /> {item.ageDays}d
            </span>
          )}
        </div>
      </div>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={clsx('shrink-0 p-1 rounded hover:bg-white/50 dark:hover:bg-slate-600/50 transition-colors', config.text)}>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
}
