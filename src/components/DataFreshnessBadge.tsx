import { useState, useEffect } from 'react'
import { Clock, RefreshCw } from 'lucide-react'

interface DataFreshnessBadgeProps {
  /** The timestamp when data was last fetched. Null means never loaded. */
  lastRefreshed: Date | null
  /** Called when the refresh button is clicked. If omitted, no button is shown. */
  onRefresh?: () => void
  /** Whether a refresh is currently in progress. */
  isRefreshing?: boolean
  /** Additional CSS classes for the wrapper. */
  className?: string
}

function formatAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}

function staleness(date: Date): 'fresh' | 'aging' | 'stale' {
  const minutes = (Date.now() - date.getTime()) / 60000
  if (minutes < 5) return 'fresh'
  if (minutes < 15) return 'aging'
  return 'stale'
}

const COLORS = {
  fresh: 'text-green-600 bg-green-50 border-green-100',
  aging: 'text-amber-600 bg-amber-50 border-amber-100',
  stale: 'text-red-600 bg-red-50 border-red-100',
}

export function DataFreshnessBadge({
  lastRefreshed,
  onRefresh,
  isRefreshing = false,
  className = '',
}: DataFreshnessBadgeProps) {
  const [, tick] = useState(0)

  // Re-render every 30 seconds so "2m ago" updates automatically
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!lastRefreshed) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-gray-400 ${className}`}>
        <Clock className="w-3.5 h-3.5" />
        Not loaded
      </span>
    )
  }

  const level = staleness(lastRefreshed)
  const colorClass = COLORS[level]

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${colorClass} ${className}`}>
      <Clock className="w-3 h-3 shrink-0" />
      <span title={lastRefreshed.toLocaleString()}>
        {formatAgo(lastRefreshed)}
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh data"
          className="ml-0.5 hover:opacity-70 transition-opacity disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </span>
  )
}
