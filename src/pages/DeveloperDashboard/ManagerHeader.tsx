import { RefreshCw, Eye, EyeOff } from 'lucide-react'
import clsx from 'clsx'
import { greeting, todayLabel } from './utils'

export interface ManagerHeaderProps {
  displayName: string
  lastRefresh: Date
  onRefresh: () => void
  isDevView: boolean
  canOverrideView: boolean
  onToggleViewOverride: () => void
  loading?: boolean
}

export default function ManagerHeader({
  displayName,
  lastRefresh,
  onRefresh,
  isDevView,
  canOverrideView,
  onToggleViewOverride,
  loading,
}: ManagerHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          {greeting(displayName)}
        </h1>
        <p className="text-sm text-gray-600">
          {todayLabel()} · refreshed {lastRefresh.toLocaleTimeString()}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {/* View Override Toggle (Managers only) */}
        {canOverrideView && (
          <button
            onClick={onToggleViewOverride}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              isDevView
                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            )}
            title={`Currently viewing as ${isDevView ? 'Developer' : 'Manager'} (Ctrl+Shift+V)`}
          >
            {isDevView ? <EyeOff className="w-4 h-4 inline mr-1" /> : <Eye className="w-4 h-4 inline mr-1" />}
            {isDevView ? 'Dev View' : 'Manager View'}
          </button>
        )}
        
        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className={clsx(
            'px-4 py-2 rounded-lg border-2 font-semibold transition-all flex items-center gap-2',
            loading
              ? 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
              : 'border-blue-200 text-blue-600 bg-blue-50 hover:border-blue-300 hover:bg-blue-100 cursor-pointer'
          )}
        >
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>
    </div>
  )
}
