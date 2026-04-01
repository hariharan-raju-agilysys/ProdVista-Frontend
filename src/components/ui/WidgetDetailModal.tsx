import { useState, useEffect, useMemo } from 'react'
import {
  X, Maximize2, Minimize2, Calendar, Search, Filter, Download,
  ExternalLink, RefreshCw, ChevronRight, Clock, Settings,
  ArrowLeft, Share2, Pin,
  ChevronDown, AlertTriangle, Info, CheckCircle, XCircle
} from 'lucide-react'
import clsx from 'clsx'

// Types
export interface WidgetDetailData {
  id: string
  title: string
  subtitle?: string
  type: string
  data?: any
  azureResourceId?: string
  azurePortalLink?: string
  lastUpdated?: Date
  refreshInterval?: number
}

interface DateRange {
  label: string
  value: string
  start: Date
  end: Date
}

interface WidgetDetailModalProps {
  widget: WidgetDetailData
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
  children?: React.ReactNode
}

// Date range presets
const DATE_RANGES: DateRange[] = [
  { label: 'Last 30 minutes', value: '30m', start: new Date(Date.now() - 30 * 60 * 1000), end: new Date() },
  { label: 'Last 1 hour', value: '1h', start: new Date(Date.now() - 60 * 60 * 1000), end: new Date() },
  { label: 'Last 4 hours', value: '4h', start: new Date(Date.now() - 4 * 60 * 60 * 1000), end: new Date() },
  { label: 'Last 24 hours', value: '24h', start: new Date(Date.now() - 24 * 60 * 60 * 1000), end: new Date() },
  { label: 'Last 7 days', value: '7d', start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date() },
  { label: 'Last 30 days', value: '30d', start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
]

export default function WidgetDetailModal({
  widget,
  isOpen,
  onClose,
  onRefresh,
  children
}: WidgetDetailModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(DATE_RANGES[3]) // Default: 24h
  const [searchQuery, setSearchQuery] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState<string[]>([])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) {
          setIsFullScreen(false)
        } else {
          onClose()
        }
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'auto'
    }
  }, [isOpen, isFullScreen, onClose])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await onRefresh?.()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const openInAzurePortal = () => {
    if (widget.azurePortalLink) {
      window.open(widget.azurePortalLink, '_blank')
    } else if (widget.azureResourceId) {
      // Construct Azure Portal URL from resource ID
      const portalUrl = `https://portal.azure.com/#@/resource${widget.azureResourceId}`
      window.open(portalUrl, '_blank')
    }
  }

  const severityOptions = [
    { value: 'critical', label: 'Critical', icon: XCircle, color: 'text-red-500' },
    { value: 'error', label: 'Error', icon: AlertTriangle, color: 'text-orange-500' },
    { value: 'warning', label: 'Warning', icon: Info, color: 'text-yellow-500' },
    { value: 'info', label: 'Info', icon: CheckCircle, color: 'text-blue-500' },
  ]

  if (!isOpen) return null

  return (
    <div 
      className={clsx(
        'fixed inset-0 z-50 flex items-center justify-center',
        isFullScreen ? 'p-0' : 'p-4 md:p-6'
      )}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={clsx(
          'relative bg-white dark:bg-slate-900 flex flex-col shadow-2xl',
          'border border-slate-200 dark:border-slate-700',
          isFullScreen 
            ? 'w-full h-full rounded-none' 
            : 'w-full max-w-6xl h-[90vh] rounded-xl'
        )}
      >
        {/* Header - Azure Portal Style */}
        <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  {widget.title}
                  {widget.subtitle && (
                    <span className="text-sm font-normal text-slate-500">
                      - {widget.subtitle}
                    </span>
                  )}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Open in Azure Portal */}
              {(widget.azureResourceId || widget.azurePortalLink) && (
                <button
                  onClick={openInAzurePortal}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Azure Portal
                </button>
              )}

              {/* Action Buttons */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={clsx('w-4 h-4 text-slate-600', isRefreshing && 'animate-spin')} />
              </button>
              <button
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Pin"
              >
                <Pin className="w-4 h-4 text-slate-600" />
              </button>
              <button
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Share"
              >
                <Share2 className="w-4 h-4 text-slate-600" />
              </button>
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-4 h-4 text-slate-600" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-slate-600" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Toolbar - Search, Filters, Date Range */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-64 text-sm border border-slate-300 dark:border-slate-600 rounded-lg 
                    bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    placeholder:text-slate-400"
                />
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors',
                  showFilters || filterSeverity.length > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                )}
              >
                <Filter className="w-4 h-4" />
                Filter
                {filterSeverity.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    {filterSeverity.length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Date Range Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-300 
                    rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-700">{selectedDateRange.label}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {showDatePicker && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 
                    rounded-lg shadow-lg z-10 py-1">
                    {DATE_RANGES.map((range) => (
                      <button
                        key={range.value}
                        onClick={() => {
                          setSelectedDateRange(range)
                          setShowDatePicker(false)
                        }}
                        className={clsx(
                          'w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors',
                          selectedDateRange.value === range.value 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'text-slate-700'
                        )}
                      >
                        {range.label}
                      </button>
                    ))}
                    <div className="border-t border-slate-200 mt-1 pt-1">
                      <button className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-slate-50">
                        Custom range...
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Download */}
              <button
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-300 
                  rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4 text-slate-500" />
                Export
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-600">Severity:</span>
                <div className="flex items-center gap-2">
                  {severityOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilterSeverity(prev => 
                          prev.includes(option.value)
                            ? prev.filter(v => v !== option.value)
                            : [...prev, option.value]
                        )
                      }}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1 text-sm rounded-full border transition-colors',
                        filterSeverity.includes(option.value)
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                      )}
                    >
                      <option.icon className={clsx('w-3.5 h-3.5', !filterSeverity.includes(option.value) && option.color)} />
                      {option.label}
                    </button>
                  ))}
                </div>
                {filterSeverity.length > 0 && (
                  <button
                    onClick={() => setFilterSeverity([])}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {children || (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Widget content will be displayed here</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Last Updated */}
        <div className="flex-shrink-0 px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Last updated: {widget.lastUpdated?.toLocaleString() || 'Just now'}
              </span>
              {widget.refreshInterval && (
                <span>Auto-refresh: {widget.refreshInterval}s</span>
              )}
            </div>
            <span>
              Time range: {selectedDateRange.start.toLocaleDateString()} - {selectedDateRange.end.toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Detail Log Table Component for use inside the modal
export function DetailLogTable({ logs, searchQuery }: { logs: any[]; searchQuery?: string }) {
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs
    const query = searchQuery.toLowerCase()
    return logs.filter(log => 
      log.message?.toLowerCase().includes(query) ||
      log.source?.toLowerCase().includes(query) ||
      log.level?.toLowerCase().includes(query)
    )
  }, [logs, searchQuery])

  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    error: 'bg-orange-100 text-orange-800 border-orange-200',
    warn: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    debug: 'bg-slate-100 text-slate-800 border-slate-200',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Timestamp</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Level</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Source</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Message</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredLogs.map((log, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-xs">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <span className={clsx(
                  'px-2 py-0.5 rounded-full text-xs font-medium border',
                  severityColors[log.level] || 'bg-slate-100 text-slate-600'
                )}>
                  {log.level?.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600 font-medium">{log.source}</td>
              <td className="px-4 py-3 text-slate-700 max-w-md truncate">{log.message}</td>
              <td className="px-4 py-3">
                <button className="text-blue-600 hover:text-blue-800 text-xs">
                  View details <ChevronRight className="w-3 h-3 inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredLogs.length === 0 && (
        <div className="py-12 text-center text-slate-400">
          No logs found matching your criteria
        </div>
      )}
    </div>
  )
}
