import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, RefreshCw, CheckCircle2, XCircle, Server, Eye, EyeOff,
  Loader2, Globe, Trash2, ArrowLeft, Save, TestTube, Box, ShieldAlert
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { rancherService, type RancherConnection, type RancherCluster, type RancherTestResult } from '../services/rancherService'

type ViewMode = 'list' | 'add' | 'edit'

export default function RancherSetupPage() {
  const { isManager } = useAuth()
  const [connections, setConnections] = useState<RancherConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form
  const [connectionName, setConnectionName] = useState('')
  const [serverUrl, setServerUrl] = useState('')
  const [bearerToken, setBearerToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [defaultClusterId, setDefaultClusterId] = useState('')
  const [defaultNamespace, setDefaultNamespace] = useState('agys-v1')
  const [environment, setEnvironment] = useState('dev')

  // State
  const [clusters, setClusters] = useState<RancherCluster[]>([])
  const [testResult, setTestResult] = useState<RancherTestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true)
      const data = await rancherService.getConnections()
      setConnections(data)
    } catch {
      setError('Failed to load Rancher connections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConnections() }, [loadConnections])

  const resetForm = () => {
    setConnectionName('')
    setServerUrl('')
    setBearerToken('')
    setShowToken(false)
    setDefaultClusterId('')
    setDefaultNamespace('agys-v1')
    setEnvironment('dev')
    setTestResult(null)
    setClusters([])
    setError(null)
    setEditingId(null)
  }

  const handleTestConnection = async () => {
    if (!serverUrl || !bearerToken) return
    try {
      setTesting(true)
      setTestResult(null)
      const result = await rancherService.testConnection({ serverUrl, bearerToken })
      setTestResult(result)
      if (result.success) {
        // Load clusters after successful test
        try {
          // Create a temp connection to fetch clusters — use saved if editing
          if (editingId) {
            const c = await rancherService.getClusters(editingId)
            setClusters(c)
          }
        } catch { /* clusters are optional */ }
      }
    } catch {
      setTestResult({ success: false, message: 'Connection failed — check URL and token' })
    } finally {
      setTesting(false)
    }
  }

  const handleTestSaved = async (id: string) => {
    try {
      setTesting(true)
      const result = await rancherService.testSavedConnection(id)
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!connectionName || !serverUrl || (!bearerToken && !editingId)) {
      setError('Name, URL, and token are required')
      return
    }
    try {
      setSaving(true)
      setError(null)
      if (editingId) {
        await rancherService.updateConnection(editingId, {
          connectionName, serverUrl,
          bearerToken: bearerToken || undefined,
          defaultClusterId: defaultClusterId || undefined,
          defaultNamespace, environment
        })
      } else {
        await rancherService.createConnection({
          connectionName, serverUrl, bearerToken,
          defaultClusterId: defaultClusterId || undefined,
          defaultNamespace, environment
        })
      }
      resetForm()
      setViewMode('list')
      await loadConnections()
    } catch {
      setError('Failed to save connection')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (conn: RancherConnection) => {
    setEditingId(conn.id)
    setConnectionName(conn.connectionName)
    setServerUrl(conn.serverUrl)
    setBearerToken('')
    setDefaultClusterId(conn.defaultClusterId || '')
    setDefaultNamespace(conn.defaultNamespace)
    setEnvironment(conn.environment)
    setTestResult(null)
    setViewMode('edit')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this Rancher connection?')) return
    try {
      setDeleting(id)
      await rancherService.deleteConnection(id)
      await loadConnections()
    } catch {
      setError('Failed to delete connection')
    } finally {
      setDeleting(null)
    }
  }

  const envBadge = (env: string) => {
    const colors = env === 'prod'
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors}`}>{env.toUpperCase()}</span>
  }

  // ==========================================
  // List View
  // ==========================================
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
        <div className="max-w-5xl mx-auto">
          {!isManager && (
            <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>You have <strong>read-only</strong> access. Contact a Manager or Admin to modify Rancher connections.</span>
            </div>
          )}

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Box className="w-7 h-7 text-orange-400" />
                Rancher Connections
              </h1>
              <p className="text-gray-400 text-sm mt-1">Configure Rancher environments for pod & deployment monitoring</p>
            </div>
            <div className="flex gap-3">
              <button onClick={loadConnections} className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              {isManager && (
                <button onClick={() => { resetForm(); setViewMode('add') }} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Connection
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-20 bg-gray-900/50 rounded-xl border border-gray-800">
              <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-lg">No Rancher connections configured</p>
              <p className="text-gray-500 text-sm mt-1">Add a connection to start monitoring your clusters</p>
              {isManager && (
                <button onClick={() => { resetForm(); setViewMode('add') }} className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition">
                  Add First Connection
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence mode="popLayout">
                {connections.map(conn => (
                  <motion.div key={conn.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-gray-900/70 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${conn.isActive ? 'bg-green-500/10' : 'bg-gray-800'}`}>
                          <Server className={`w-5 h-5 ${conn.isActive ? 'text-green-400' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-medium">{conn.connectionName}</h3>
                            {envBadge(conn.environment)}
                            {conn.lastStatus && (
                              conn.lastStatus === 'Connected' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )
                            )}
                          </div>
                          <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1">
                            <Globe className="w-3 h-3" /> {conn.serverUrl}
                          </p>
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            <span>Namespace: {conn.defaultNamespace}</span>
                            {conn.lastCheckedAt && <span>Last checked: {new Date(conn.lastCheckedAt).toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isManager && (
                          <>
                            <button onClick={() => handleTestSaved(conn.id)} disabled={testing}
                              className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition flex items-center gap-1">
                              <TestTube className="w-3 h-3" /> Test
                            </button>
                            <button onClick={() => handleEdit(conn)}
                              className="px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition">
                              Edit
                            </button>
                            <button onClick={() => handleDelete(conn.id)} disabled={deleting === conn.id}
                              className="p-1.5 text-gray-500 hover:text-red-400 transition">
                              {deleting === conn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Test result toast */}
          <AnimatePresence>
            {testResult && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                className={`fixed bottom-6 right-6 p-4 rounded-xl border shadow-xl ${testResult.success ? 'bg-green-900/90 border-green-700' : 'bg-red-900/90 border-red-700'}`}>
                <div className="flex items-center gap-2 text-sm">
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="text-white">{testResult.message}</span>
                </div>
                {testResult.serverVersion && <p className="text-xs text-gray-400 mt-1">Version: {testResult.serverVersion}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  // ==========================================
  // Add / Edit Form (Manager/Admin only)
  // ==========================================
  if (!isManager) {
    // Non-managers should never reach this view, but guard anyway
    setViewMode('list')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => { resetForm(); setViewMode('list') }}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to connections
        </button>

        <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Box className="w-5 h-5 text-orange-400" />
            {editingId ? 'Edit Connection' : 'New Rancher Connection'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <div className="space-y-4">
            {/* Connection Name */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Connection Name</label>
              <input value={connectionName} onChange={e => setConnectionName(e.target.value)}
                placeholder="e.g. Rancher Dev" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none" />
            </div>

            {/* Environment */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Environment</label>
              <div className="flex gap-3">
                {['dev', 'prod'].map(env => (
                  <button key={env} onClick={() => setEnvironment(env)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${environment === env
                      ? env === 'prod' ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                    {env.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Server URL */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Rancher Server URL</label>
              <input value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                placeholder="https://rancher-dev.hospitalityrevolution.com" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none" />
            </div>

            {/* Bearer Token */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Bearer Token {editingId && <span className="text-gray-600">(leave blank to keep existing)</span>}
              </label>
              <div className="relative">
                <input type={showToken ? 'text' : 'password'} value={bearerToken} onChange={e => setBearerToken(e.target.value)}
                  placeholder="token-xxxxx:xxxxxxxxxx" className="w-full px-3 py-2 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none" />
                <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Cluster ID */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Default Cluster ID</label>
              {clusters.length > 0 ? (
                <select value={defaultClusterId} onChange={e => setDefaultClusterId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:outline-none">
                  <option value="">Select cluster...</option>
                  {clusters.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.state}) — {c.nodeCount} nodes</option>
                  ))}
                </select>
              ) : (
                <input value={defaultClusterId} onChange={e => setDefaultClusterId(e.target.value)}
                  placeholder="c-xxxxx (test connection to discover clusters)" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none" />
              )}
            </div>

            {/* Namespace */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Default Namespace</label>
              <input value={defaultNamespace} onChange={e => setDefaultNamespace(e.target.value)}
                placeholder="agys-v1" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-orange-500 focus:outline-none" />
            </div>

            {/* Test Result */}
            <AnimatePresence>
              {testResult && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`p-3 rounded-lg border ${testResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <div className="flex items-center gap-2 text-sm">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    <span className={testResult.success ? 'text-green-400' : 'text-red-400'}>{testResult.message}</span>
                  </div>
                  {testResult.serverVersion && <p className="text-xs text-gray-400 mt-1">Server Version: {testResult.serverVersion}</p>}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleTestConnection} disabled={testing || !serverUrl || !bearerToken}
                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                Test Connection
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Update' : 'Save'} Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
