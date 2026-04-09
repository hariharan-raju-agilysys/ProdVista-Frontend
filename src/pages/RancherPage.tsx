import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box, RefreshCw, Search, AlertTriangle, CheckCircle2, XCircle,
  Loader2, Server, Activity, Layers, ChevronDown, Filter
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  rancherService,
  type RancherConnection,
  type RancherPod,
  type RancherDeployment,
  type RancherPodAlert
} from '../services/rancherService'

type Tab = 'pods' | 'deployments' | 'alerts'

export default function RancherPage() {
  const { isManager } = useAuth()
  const [connections, setConnections] = useState<RancherConnection[]>([])
  const [selectedConnId, setSelectedConnId] = useState<string>('')
  const [selectedConn, setSelectedConn] = useState<RancherConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pods')

  // Data
  const [pods, setPods] = useState<RancherPod[]>([])
  const [deployments, setDeployments] = useState<RancherDeployment[]>([])
  const [alerts, setAlerts] = useState<RancherPodAlert[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [nsOverride, setNsOverride] = useState('')

  // Load connections on mount
  useEffect(() => {
    (async () => {
      try {
        const conns = await rancherService.getConnections()
        setConnections(conns)
        const active = conns.find(c => c.isActive)
        if (active) {
          setSelectedConnId(active.id)
          setSelectedConn(active)
        }
      } catch { /* no-op */ } finally {
        setLoading(false)
      }
    })()
  }, [])

  const ns = nsOverride || selectedConn?.defaultNamespace || undefined

  // Load tab data
  const loadData = useCallback(async () => {
    if (!selectedConnId) return
    setLoadingData(true)
    try {
      if (tab === 'pods') {
        const data = await rancherService.getPods(selectedConnId, ns, 100)
        setPods(data)
      } else if (tab === 'deployments') {
        const data = await rancherService.getDeployments(selectedConnId, ns)
        setDeployments(data)
      } else {
        const data = await rancherService.getAlerts(selectedConnId, ns)
        setAlerts(data)
      }
    } catch { /* show empty */ } finally {
      setLoadingData(false)
    }
  }, [selectedConnId, tab, ns])

  useEffect(() => { loadData() }, [loadData])

  // Also load all alerts for badge count
  const [allAlertCount, setAllAlertCount] = useState(0)
  useEffect(() => {
    if (!selectedConnId) return
    rancherService.getAlerts(selectedConnId, ns).then(a => setAllAlertCount(a.length)).catch(() => {})
  }, [selectedConnId, ns])

  const handleConnectionChange = (id: string) => {
    setSelectedConnId(id)
    setSelectedConn(connections.find(c => c.id === id) || null)
    setPods([])
    setDeployments([])
    setAlerts([])
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedConnId) return
    setSearching(true)
    try {
      const results = await rancherService.searchPods(selectedConnId, searchQuery, ns)
      setPods(results)
      setTab('pods')
    } catch { /* no-op */ } finally {
      setSearching(false)
    }
  }

  const podStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running': return 'text-green-400 bg-green-500/10'
      case 'succeeded': return 'text-blue-400 bg-blue-500/10'
      case 'pending': return 'text-yellow-400 bg-yellow-500/10'
      case 'failed': return 'text-red-400 bg-red-500/10'
      default: return 'text-gray-400 bg-gray-500/10'
    }
  }

  const deploymentStatusColor = (status: string) => {
    if (status === 'Available') return 'text-green-400'
    if (status === 'Progressing') return 'text-yellow-400'
    return 'text-red-400'
  }

  const alertTypeColor = (type: string) => {
    switch (type) {
      case 'oom': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'crash': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'restart': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    )
  }

  if (connections.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-lg">No Rancher connections</p>
          <p className="text-gray-500 text-sm mt-1">Ask your admin to configure Rancher connections</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Read-only banner for non-managers */}
        {!isManager && (
          <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>You have <strong>read-only</strong> access. Contact a Manager or Admin to configure connections or manage settings.</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Box className="w-7 h-7 text-orange-400" />
              Rancher Monitoring
            </h1>
            <p className="text-gray-400 text-sm mt-1">Pods, deployments, and alerts across environments</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection Selector */}
            <div className="relative">
              <select value={selectedConnId} onChange={e => handleConnectionChange(e.target.value)}
                className="appearance-none px-4 py-2 pr-8 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none">
                {connections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.connectionName} ({c.environment.toUpperCase()})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button onClick={loadData} disabled={loadingData}
              className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition">
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search + Namespace */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search pods by name or image..." className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none text-sm" />
          </div>
          <div className="relative flex items-center gap-1">
            <Filter className="w-4 h-4 text-gray-500" />
            <input value={nsOverride} onChange={e => setNsOverride(e.target.value)}
              placeholder={selectedConn?.defaultNamespace || 'namespace'}
              className="w-36 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none text-sm" />
          </div>
          <button onClick={handleSearch} disabled={searching || !searchQuery}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition text-sm disabled:opacity-50">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 mb-6">
          {([
            { key: 'pods' as Tab, label: 'Pods', icon: Activity, count: pods.length },
            { key: 'deployments' as Tab, label: 'Deployments', icon: Layers, count: deployments.length },
            { key: 'alerts' as Tab, label: 'Alerts', icon: AlertTriangle, count: allAlertCount },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
                tab === t.key ? 'border-orange-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.key === 'alerts' && allAlertCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-bold">{allAlertCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* ======== PODS ======== */}
            {tab === 'pods' && (
              <motion.div key="pods" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {pods.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">No pods found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-left border-b border-gray-800">
                          <th className="pb-2 px-3 font-medium">Pod</th>
                          <th className="pb-2 px-3 font-medium">Status</th>
                          <th className="pb-2 px-3 font-medium">Ready</th>
                          <th className="pb-2 px-3 font-medium">Restarts</th>
                          <th className="pb-2 px-3 font-medium">Node</th>
                          <th className="pb-2 px-3 font-medium">Image</th>
                          <th className="pb-2 px-3 font-medium">Age</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pods.map((pod, i) => (
                          <tr key={pod.name + i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="py-2.5 px-3">
                              <span className="text-white font-mono text-xs">{pod.name}</span>
                              {pod.namespace && <span className="text-gray-600 text-xs ml-2">({pod.namespace})</span>}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${podStatusColor(pod.status)}`}>{pod.status}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              {pod.isReady ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-xs ${pod.restartCount > 0 ? pod.restartCount >= 5 ? 'text-red-400 font-bold' : 'text-yellow-400' : 'text-gray-500'}`}>
                                {pod.restartCount}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-400 text-xs">{pod.nodeName || '—'}</td>
                            <td className="py-2.5 px-3 text-gray-400 text-xs font-mono max-w-[200px] truncate" title={pod.image || ''}>
                              {pod.image ? pod.image.split('/').pop() : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 text-xs">
                              {pod.createdAt ? getAge(pod.createdAt) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-600 mt-3">Showing {pods.length} pods</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ======== DEPLOYMENTS ======== */}
            {tab === 'deployments' && (
              <motion.div key="deployments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {deployments.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">No deployments found</div>
                ) : (
                  <div className="grid gap-3">
                    {deployments.map((dep, i) => (
                      <div key={dep.name + i} className="bg-gray-900/70 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-white font-medium text-sm">{dep.name}</h3>
                              <span className={`text-xs font-medium ${deploymentStatusColor(dep.status)}`}>{dep.status}</span>
                            </div>
                            <p className="text-gray-500 text-xs mt-1 font-mono">{dep.image || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <span className={`text-lg font-bold ${dep.readyReplicas === dep.replicas ? 'text-green-400' : 'text-yellow-400'}`}>
                                {dep.readyReplicas}
                              </span>
                              <span className="text-gray-500 text-sm">/ {dep.replicas}</span>
                            </div>
                            <p className="text-gray-600 text-xs">replicas ready</p>
                          </div>
                        </div>
                        {dep.conditions.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {dep.conditions.map((c, ci) => (
                              <span key={ci} className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs">{c}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-gray-600">
                          {dep.createdAt && <span>Created: {new Date(dep.createdAt).toLocaleDateString()}</span>}
                          {dep.lastUpdated && <span>Updated: {new Date(dep.lastUpdated).toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ======== ALERTS ======== */}
            {tab === 'alerts' && (
              <motion.div key="alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {alerts.length === 0 ? (
                  <div className="text-center py-16">
                    <CheckCircle2 className="w-10 h-10 text-green-500/50 mx-auto mb-2" />
                    <p className="text-green-400 font-medium">All Clear</p>
                    <p className="text-gray-500 text-sm mt-1">No pod alerts detected</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {alerts.map((alert, i) => (
                      <div key={alert.podName + i} className={`border rounded-lg p-4 ${alertTypeColor(alert.alertType)}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{alert.podName}</span>
                                <span className="px-1.5 py-0.5 bg-gray-900/50 rounded text-xs uppercase font-bold">{alert.alertType}</span>
                              </div>
                              <p className="text-sm mt-1 opacity-80">{alert.message}</p>
                              <div className="flex gap-4 mt-2 text-xs opacity-60">
                                <span>Namespace: {alert.namespace}</span>
                                <span>Restarts: {alert.restartCount}</span>
                                <span>Env: {alert.environment}</span>
                                <span>Detected: {new Date(alert.detectedAt).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

function getAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}
