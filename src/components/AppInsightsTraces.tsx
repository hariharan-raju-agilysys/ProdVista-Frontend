import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Search, RefreshCw,
  Clock, ChevronRight, ChevronDown, Zap, AlertTriangle,
  CheckCircle, XCircle, Loader2, MapPin, Copy
} from 'lucide-react'
import { getDistributedTraces, getTraceDetails } from '../services/api'

interface TraceSpan {
  timestamp: string
  itemType: string
  id: string
  operationId: string
  parentId?: string
  name: string
  duration: number
  success?: boolean
  resultCode?: string
  target?: string
  type?: string
  message?: string
  severityLevel?: number
  cloudRoleName: string
  cloudRoleInstance: string
}

interface TraceOperation {
  operationId: string
  operationName: string
  name: string
  totalDuration: number
  timestamp: string
  status: 'success' | 'error' | 'warning'
  url?: string
  cloudRoleName: string
  cloudRoleInstance: string
  clientCity?: string
  clientCountry?: string
  resultCode: string
  spans?: TraceSpan[]
  spanCount?: number
}

interface Props {
  workspaceId?: string
  resourceId?: string
  onClose?: () => void
}

const statusColors = {
  success: 'text-green-400 bg-green-400/10',
  error: 'text-red-400 bg-red-400/10',
  warning: 'text-yellow-400 bg-yellow-400/10',
}

const statusIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
}

export function AppInsightsTraces({ workspaceId, onClose }: Props) {
  const [traces, setTraces] = useState<TraceOperation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null)
  const [selectedTrace, setSelectedTrace] = useState<TraceOperation | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [timeRange, setTimeRange] = useState('1h')
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (workspaceId) {
      fetchTraces()
    }
  }, [workspaceId, timeRange])

  const fetchTraces = async () => {
    if (!workspaceId) {
      setError('No workspace selected. Please select a Log Analytics Workspace.')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const { data } = await getDistributedTraces(workspaceId, undefined, timeRange, 100)
      const formattedTraces = (data.traces || []).map((t: any) => ({
        ...t,
        status: t.success ? 'success' : 'error',
        totalDuration: t.duration || 0,
      }))
      setTraces(formattedTraces)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch traces')
      setTraces([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTraceDetails = async (operationId: string) => {
    if (!workspaceId) return

    setLoadingDetails(operationId)
    try {
      const { data } = await getTraceDetails(operationId, workspaceId)
      const updatedTraces = traces.map(t => 
        t.operationId === operationId 
          ? { ...t, spans: data.spans, spanCount: data.spanCount, totalDuration: data.totalDuration }
          : t
      )
      setTraces(updatedTraces)
      const updated = updatedTraces.find(t => t.operationId === operationId)
      if (updated) setSelectedTrace(updated)
    } catch (err: any) {
      console.error('Failed to fetch trace details:', err)
    } finally {
      setLoadingDetails(null)
    }
  }

  const handleTraceSelect = async (trace: TraceOperation) => {
    if (selectedTrace?.operationId === trace.operationId) {
      setSelectedTrace(null)
      return
    }
    setSelectedTrace(trace)
    if (!trace.spans) {
      await fetchTraceDetails(trace.operationId)
    }
  }

  const toggleSpanExpanded = (spanId: string) => {
    setExpandedSpans(prev => {
      const next = new Set(prev)
      if (next.has(spanId)) {
        next.delete(spanId)
      } else {
        next.add(spanId)
      }
      return next
    })
  }

  const copyOperationId = (id: string) => {
    navigator.clipboard.writeText(id)
  }

  const filteredTraces = traces.filter(trace => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return trace.operationName?.toLowerCase().includes(query) ||
             trace.name?.toLowerCase().includes(query) ||
             trace.operationId?.toLowerCase().includes(query)
    }
    return true
  })

  const getDurationColor = (duration: number) => {
    if (duration > 1000) return 'text-red-400'
    if (duration > 500) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'request': return '🌐'
      case 'dependency': return '🔗'
      case 'trace': return '📝'
      case 'exception': return '⚠️'
      default: return '📌'
    }
  }

  if (!workspaceId) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
        <Activity className="w-12 h-12 mx-auto mb-4 text-gray-500" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">No Workspace Selected</h3>
        <p className="text-gray-500 text-sm">Select a Log Analytics Workspace from Azure Cloud Setup to view distributed traces.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-xl p-4 border border-gray-700"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Distributed Traces
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTraces}
              disabled={isLoading}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search operations..."
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 outline-none"
            />
          </div>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-cyan-500 outline-none"
          >
            <option value="5m">Last 5 min</option>
            <option value="15m">Last 15 min</option>
            <option value="30m">Last 30 min</option>
            <option value="1h">Last 1 hour</option>
            <option value="4h">Last 4 hours</option>
            <option value="12h">Last 12 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </motion.div>

      {/* Traces List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : filteredTraces.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No traces found</p>
            <p className="text-sm mt-2">Try adjusting the time range or search query</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            <AnimatePresence>
              {filteredTraces.map((trace, idx) => {
                const StatusIcon = statusIcons[trace.status]
                const isSelected = selectedTrace?.operationId === trace.operationId
                const isLoadingThis = loadingDetails === trace.operationId

                return (
                  <motion.div
                    key={trace.operationId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`transition-colors ${isSelected ? 'bg-gray-700/50' : 'hover:bg-gray-700/30'}`}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => handleTraceSelect(trace)}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${statusColors[trace.status]}`}>
                          <StatusIcon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white">{trace.operationName || trace.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                copyOperationId(trace.operationId)
                              }}
                              className="p-1 hover:bg-gray-600 rounded text-gray-500 hover:text-gray-300"
                              title="Copy operation ID"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                              {trace.resultCode}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(trace.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`flex items-center gap-1 ${getDurationColor(trace.totalDuration)}`}>
                              <Zap className="w-3 h-3" />
                              {trace.totalDuration.toFixed(0)}ms
                            </span>
                            {trace.cloudRoleName && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {trace.cloudRoleName}
                              </span>
                            )}
                            {trace.spanCount && <span>{trace.spanCount} spans</span>}
                          </div>

                          {trace.url && (
                            <p className="text-xs text-gray-500 mt-2 truncate">{trace.url}</p>
                          )}
                        </div>

                        {isLoadingThis && (
                          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Trace Details */}
                    <AnimatePresence>
                      {isSelected && trace.spans && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-gray-700"
                        >
                          <div className="p-4 bg-gray-900/50">
                            <h4 className="text-sm font-medium text-gray-300 mb-3">
                              Span Waterfall ({trace.spans.length} spans)
                            </h4>
                            
                            <div className="space-y-2">
                              {trace.spans.map((span, spanIdx) => {
                                const isError = span.success === false
                                const spanStatus = isError ? 'error' : 'success'
                                const SpanStatusIcon = statusIcons[spanStatus]
                                const widthPercent = Math.min((span.duration / trace.totalDuration) * 100, 100) || 10
                                
                                return (
                                  <motion.div
                                    key={span.id || spanIdx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: spanIdx * 0.03 }}
                                    className="relative"
                                  >
                                    <div 
                                      className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer"
                                      onClick={() => toggleSpanExpanded(span.id || `${spanIdx}`)}
                                      style={{ paddingLeft: `${Math.min(spanIdx * 8, 64)}px` }}
                                    >
                                      <button className="p-0.5">
                                        {expandedSpans.has(span.id || `${spanIdx}`) ? (
                                          <ChevronDown className="w-3 h-3 text-gray-500" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3 text-gray-500" />
                                        )}
                                      </button>
                                      
                                      <span className="text-lg" title={span.itemType}>
                                        {getItemTypeIcon(span.itemType)}
                                      </span>
                                      
                                      <div className={`p-1 rounded ${statusColors[spanStatus]}`}>
                                        <SpanStatusIcon className="w-3 h-3" />
                                      </div>
                                      
                                      <span className="text-sm text-gray-300 flex-shrink-0 max-w-[150px] truncate">
                                        {span.cloudRoleName || span.itemType}
                                      </span>
                                      
                                      <span className="text-xs text-gray-500 flex-1 truncate">
                                        {span.name}
                                      </span>

                                      <div className="w-32 h-4 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${widthPercent}%` }}
                                          transition={{ delay: 0.1 + spanIdx * 0.03, duration: 0.3 }}
                                          className={`h-full rounded-full ${isError ? 'bg-red-500' : 'bg-cyan-500'}`}
                                        />
                                      </div>

                                      <span className={`text-xs font-mono w-16 text-right ${getDurationColor(span.duration)}`}>
                                        {span.duration?.toFixed(0) || 0}ms
                                      </span>
                                    </div>

                                    <AnimatePresence>
                                      {expandedSpans.has(span.id || `${spanIdx}`) && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          className="overflow-hidden ml-8"
                                        >
                                          <div className="p-3 bg-gray-950 rounded mt-1 text-xs space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <span className="text-gray-500">Type:</span>
                                                <span className="text-gray-300 ml-2">{span.itemType}</span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Result:</span>
                                                <span className={`ml-2 ${isError ? 'text-red-400' : 'text-green-400'}`}>
                                                  {span.resultCode || (span.success ? 'Success' : 'Failed')}
                                                </span>
                                              </div>
                                              {span.target && (
                                                <div className="col-span-2">
                                                  <span className="text-gray-500">Target:</span>
                                                  <span className="text-gray-300 ml-2">{span.target}</span>
                                                </div>
                                              )}
                                              {span.message && (
                                                <div className="col-span-2">
                                                  <span className="text-gray-500">Message:</span>
                                                  <span className="text-gray-300 ml-2">{span.message}</span>
                                                </div>
                                              )}
                                              <div>
                                                <span className="text-gray-500">Instance:</span>
                                                <span className="text-gray-300 ml-2">{span.cloudRoleInstance || 'N/A'}</span>
                                              </div>
                                              <div>
                                                <span className="text-gray-500">Time:</span>
                                                <span className="text-gray-300 ml-2">
                                                  {new Date(span.timestamp).toLocaleString()}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </motion.div>
                                )
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

export default AppInsightsTraces
