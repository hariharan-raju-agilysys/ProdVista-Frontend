import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, RefreshCw, CheckCircle2, XCircle, Link2, Server,
  Zap, Eye, EyeOff, Sparkles, ArrowRight, Loader2, Globe, Shield, Info,
  Wrench, Activity, HardDrive, GitBranch, ChevronRight, ExternalLink, Trash2, Pencil
} from 'lucide-react'
import clsx from 'clsx'
import jenkinsService, {
  type JenkinsConnection,
  type JenkinsUrlValidation,
  type JenkinsDiscoveryResult,
  type JenkinsTestResult,
  type JenkinsSyncResult
} from '../services/jenkinsService'

type ViewMode = 'list' | 'add' | 'edit' | 'detail'

interface AISuggestion {
  field: string
  value: string
  confidence: 'high' | 'medium' | 'low'
}

export default function JenkinsSetupPage() {
  // Connection list
  const [connections, setConnections] = useState<JenkinsConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null)

  // Add connection form
  const [serverUrl, setServerUrl] = useState('')
  const [connectionName, setConnectionName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [useCrumbIssuer, setUseCrumbIssuer] = useState(true)
  const [verifySsl, setVerifySsl] = useState(true)

  // AI validation state
  const [urlValidation, setUrlValidation] = useState<JenkinsUrlValidation | null>(null)
  const [validating, setValidating] = useState(false)
  const [discovery, setDiscovery] = useState<JenkinsDiscoveryResult | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [testResult, setTestResult] = useState<JenkinsTestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<JenkinsSyncResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])

  // Load connections
  const loadConnections = useCallback(async () => {
    try {
      setLoading(true)
      const data = await jenkinsService.getConnections()
      setConnections(data)
    } catch {
      setError('Failed to load Jenkins connections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConnections() }, [loadConnections])

  // AI-powered URL validation (debounced)
  useEffect(() => {
    if (!serverUrl || serverUrl.length < 8) {
      setUrlValidation(null)
      setAiSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setValidating(true)
        const result = await jenkinsService.validateUrl(serverUrl, username || undefined, password || undefined, apiToken || undefined)
        setUrlValidation(result)

        // Build AI suggestions from validation
        const suggestions: AISuggestion[] = []
        if (result.suggestedConnectionName && !connectionName) {
          suggestions.push({
            field: 'connectionName',
            value: result.suggestedConnectionName,
            confidence: 'high'
          })
        }
        if (result.normalizedUrl !== serverUrl) {
          suggestions.push({
            field: 'serverUrl',
            value: result.normalizedUrl,
            confidence: 'medium'
          })
        }
        setAiSuggestions(suggestions)
      } catch {
        // Silent fail - validation is best-effort
      } finally {
        setValidating(false)
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [serverUrl, username, password, apiToken, connectionName])

  // Apply AI suggestion
  const applySuggestion = (suggestion: AISuggestion) => {
    switch (suggestion.field) {
      case 'connectionName':
        setConnectionName(suggestion.value)
        break
      case 'serverUrl':
        setServerUrl(suggestion.value)
        break
    }
    setAiSuggestions(prev => prev.filter(s => s.field !== suggestion.field))
  }

  const buildConnectionPayload = () => ({
    connectionName,
    serverUrl,
    username: username || undefined,
    password: password || undefined,
    apiToken: apiToken || undefined,
    useCrumbIssuer,
    verifySsl
  })

  // Test connection
  const handleTest = async () => {
    if (!serverUrl) return
    try {
      setTesting(true)
      setTestResult(null)
      const result = await jenkinsService.testConnection({
        serverUrl,
        username: username || undefined,
        password: password || undefined,
        apiToken: apiToken || undefined
      })
      setTestResult(result)
    } catch {
      setTestResult({ success: false, message: 'Test request failed' })
    } finally {
      setTesting(false)
    }
  }

  // Full AI discovery
  const handleDiscover = async () => {
    if (!serverUrl) return
    try {
      setDiscovering(true)
      setDiscovery(null)
      const result = await jenkinsService.discover(serverUrl, username || undefined, password || undefined, apiToken || undefined)
      setDiscovery(result)

      // Auto-fill from discovery
      if (result.connectionValid && !connectionName) {
        const uri = new URL(result.serverInfo?.description ? serverUrl : serverUrl)
        setConnectionName(`Jenkins - ${uri.hostname}`)
      }
    } catch {
      setError('Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  // Save connection
  const handleSave = async () => {
    if (!serverUrl || !connectionName) return
    try {
      setSaving(true)
      setError(null)
      const payload = buildConnectionPayload()
      const isEditMode = viewMode === 'edit'

      if (isEditMode) {
        if (!editingConnectionId) {
          throw new Error('Missing connection ID for edit operation')
        }
        await jenkinsService.updateConnection(editingConnectionId, payload)
      } else {
        await jenkinsService.createConnection(payload)
      }
      resetForm()
      setViewMode('list')
      await loadConnections()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save connection')
    } finally {
      setSaving(false)
    }
  }

  // Edit existing connection
  const handleEdit = async (connId: string) => {
    try {
      setLoading(true)
      setError(null)
      const detail = await jenkinsService.getConnection(connId)
      resetForm()
      setEditingConnectionId(connId)
      setConnectionName(detail.connectionName)
      setServerUrl(detail.serverUrl)
      setUsername(detail.username || '')
      setUseCrumbIssuer(detail.useCrumbIssuer)
      setVerifySsl(detail.verifySsl)
      // Keep secret fields empty on edit so users can retain existing secrets unless they provide new ones.
      setPassword('')
      setApiToken('')
      setViewMode('edit')
    } catch {
      setError('Failed to load Jenkins connection details')
    } finally {
      setLoading(false)
    }
  }

  // Sync connection
  const handleSync = async (connId: string) => {
    try {
      setSyncing(connId)
      setSyncResult(null)
      const result = await jenkinsService.syncConnection(connId)
      setSyncResult(result)
      await loadConnections()
    } catch {
      setSyncResult({ success: false, jobCount: 0, viewCount: 0, nodeCount: 0, pluginCount: 0, error: 'Sync failed' })
    } finally {
      setSyncing(null)
    }
  }

  // Test saved connection
  const handleTestSaved = async (connId: string) => {
    try {
      setSyncing(connId)
      const result = await jenkinsService.testSavedConnection(connId)
      setTestResult(result)
      await loadConnections()
    } catch {
      setTestResult({ success: false, message: 'Test failed' })
    } finally {
      setSyncing(null)
    }
  }

  // Delete connection
  const handleDelete = async (connId: string, connName: string) => {
    if (!confirm(`Delete connection "${connName}"? This will also remove all associated pipeline configs.`)) return
    try {
      setDeleting(connId)
      await jenkinsService.deleteConnection(connId)
      await loadConnections()
    } catch {
      setError('Failed to delete connection')
    } finally {
      setDeleting(null)
    }
  }

  const resetForm = () => {
    setEditingConnectionId(null)
    setServerUrl('')
    setConnectionName('')
    setUsername('')
    setPassword('')
    setApiToken('')
    setShowToken(false)
    setShowPassword(false)
    setUseCrumbIssuer(true)
    setVerifySsl(true)
    setUrlValidation(null)
    setDiscovery(null)
    setTestResult(null)
    setAiSuggestions([])
    setError(null)
  }

  const getStatusColor = (status?: string) => {
    if (!status) return 'text-gray-400'
    if (status === 'Connected' || status === 'Synced') return 'text-emerald-400'
    if (status.startsWith('Failed')) return 'text-red-400'
    return 'text-amber-400'
  }

  const getStatusIcon = (status?: string) => {
    if (!status) return <Info className="w-4 h-4 text-gray-400" />
    if (status === 'Connected' || status === 'Synced') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    if (status.startsWith('Failed')) return <XCircle className="w-4 h-4 text-red-400" />
    return <Info className="w-4 h-4 text-amber-400" />
  }

  const isEditMode = viewMode === 'edit' && !!editingConnectionId

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jenkins Integration</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Connect your Jenkins servers to track pipelines, builds, and deployments</p>
              </div>
            </div>
            {viewMode === 'list' && (
              <button
                onClick={() => { resetForm(); setViewMode('add') }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-orange-500/20"
              >
                <Plus className="w-4 h-4" />
                Add Connection
              </button>
            )}
            {viewMode !== 'list' && (
              <button
                onClick={() => { resetForm(); setViewMode('list') }}
                className="flex items-center gap-2 px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back to List
              </button>
            )}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ==========================================
              CONNECTION LIST
             ========================================== */}
          {viewMode === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
              ) : connections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-gray-900 rounded-2xl border-2 border-dashed border-gray-700">
                  <Server className="w-16 h-16 text-gray-600 mb-4" />
                  <h3 className="text-lg font-bold text-gray-300">No Jenkins Connections</h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-md text-center">
                    Add your first Jenkins server connection. AI will help you auto-fill the details.
                  </p>
                  <button
                    onClick={() => setViewMode('add')}
                    className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Connection
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.map((conn) => (
                    <motion.div
                      key={conn.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors"
                    >
                      <div className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={clsx(
                            'flex items-center justify-center w-10 h-10 rounded-lg',
                            conn.lastSyncStatus === 'Connected' || conn.lastSyncStatus === 'Synced'
                              ? 'bg-emerald-500/10'
                              : 'bg-gray-800'
                          )}>
                            <Server className={clsx(
                              'w-5 h-5',
                              conn.lastSyncStatus === 'Connected' || conn.lastSyncStatus === 'Synced'
                                ? 'text-emerald-400'
                                : 'text-gray-500'
                            )} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-white">{conn.connectionName}</h3>
                              {conn.jenkinsVersion && (
                                <span className="px-2 py-0.5 text-[10px] font-mono bg-gray-800 text-gray-400 rounded">
                                  v{conn.jenkinsVersion}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-500">{conn.serverUrl}</span>
                              <span className="flex items-center gap-1 text-xs">
                                {getStatusIcon(conn.lastSyncStatus)}
                                <span className={getStatusColor(conn.lastSyncStatus)}>
                                  {conn.lastSyncStatus || 'Not tested'}
                                </span>
                              </span>
                              {conn.lastSyncAt && (
                                <span className="text-xs text-gray-600">
                                  Last sync: {new Date(conn.lastSyncAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestSaved(conn.id)}
                            disabled={syncing === conn.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {syncing === conn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                            Test
                          </button>
                          <button
                            onClick={() => handleSync(conn.id)}
                            disabled={syncing === conn.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {syncing === conn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Sync
                          </button>
                          <a
                            href={conn.serverUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open
                          </a>
                          <button
                            onClick={() => handleEdit(conn.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(conn.id, conn.connectionName)}
                            disabled={deleting === conn.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-300 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {deleting === conn.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Delete
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Sync result toast */}
              {syncResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={clsx(
                    'mt-4 p-4 rounded-xl border',
                    syncResult.success
                      ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                      : 'bg-red-950/30 border-red-800/40 text-red-300'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {syncResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span className="font-medium">
                      {syncResult.success
                        ? `Synced: ${syncResult.jobCount} jobs, ${syncResult.viewCount} views, ${syncResult.nodeCount} nodes, ${syncResult.pluginCount} plugins`
                        : `Sync failed: ${syncResult.error}`}
                    </span>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ==========================================
              ADD / EDIT CONNECTION (AI-powered)
             ========================================== */}
          {(viewMode === 'add' || viewMode === 'edit') && (
            <motion.div key={viewMode} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                {/* AI Header */}
                <div className="p-6 bg-gradient-to-r from-orange-950/40 to-red-950/40 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {isEditMode ? 'Edit Jenkins Connection' : 'AI-Powered Setup'}
                      </h2>
                      <p className="text-sm text-gray-400">
                        {isEditMode
                          ? 'Update your Jenkins settings. Leave password/token blank to keep existing secrets.'
                          : 'Enter your Jenkins URL and AI will auto-detect & fill everything'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Server URL with AI validation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Globe className="w-4 h-4 inline mr-1.5" />
                      Jenkins Server URL
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        placeholder="https://jenkins.yourcompany.com or http://localhost:8080"
                        className="w-full p-3 pr-10 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {validating && <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />}
                        {!validating && urlValidation?.isReachable && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {!validating && urlValidation && !urlValidation.isReachable && urlValidation.isValid && <XCircle className="w-4 h-4 text-red-400" />}
                      </div>
                    </div>

                    {/* AI Validation Feedback */}
                    {urlValidation && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
                        {urlValidation.suggestions.map((suggestion, i) => (
                          <div key={i} className="flex items-start gap-2 mt-1">
                            <Sparkles className="w-3 h-3 text-orange-400 mt-0.5 shrink-0" />
                            <span className="text-xs text-gray-400">{suggestion}</span>
                          </div>
                        ))}
                        {urlValidation.jenkinsVersion && (
                          <div className="mt-2 px-3 py-1.5 bg-emerald-950/30 border border-emerald-800/30 rounded-lg inline-flex items-center gap-2">
                            <Shield className="w-3 h-3 text-emerald-400" />
                            <span className="text-xs text-emerald-300">Jenkins {urlValidation.jenkinsVersion} detected</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* AI Suggestions Banner */}
                  {aiSuggestions.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-orange-950/20 border border-orange-800/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-medium text-orange-300">AI Suggestions</span>
                      </div>
                      <div className="space-y-2">
                        {aiSuggestions.map((s, i) => (
                          <div key={i} className="flex items-center justify-between bg-gray-900/50 p-2 rounded-lg">
                            <div>
                              <span className="text-xs text-gray-500 capitalize">{s.field.replace(/([A-Z])/g, ' $1')}: </span>
                              <span className="text-sm text-white">{s.value}</span>
                            </div>
                            <button
                              onClick={() => applySuggestion(s)}
                              className="px-2 py-1 text-xs bg-orange-600 hover:bg-orange-500 text-white rounded-md transition-colors"
                            >
                              Apply
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Connection Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Link2 className="w-4 h-4 inline mr-1.5" />
                      Connection Name
                    </label>
                    <input
                      type="text"
                      value={connectionName}
                      onChange={(e) => setConnectionName(e.target.value)}
                      placeholder="e.g., Production Jenkins, CI/CD Server"
                      className="w-full p-3 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors"
                    />
                  </div>

                  {/* Auth Section */}
                  <div className="p-4 bg-gray-950 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-300">Authentication</span>
                      {urlValidation?.requiresAuth && (
                        <span className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded font-medium">Required</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Username</label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Jenkins username"
                          className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-sm focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Password</label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Jenkins password"
                            className="w-full p-2.5 pr-10 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-sm focus:border-orange-500 outline-none"
                          />
                          <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">Fallback if API token not provided</p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">API Token <span className="text-orange-400">(preferred)</span></label>
                        <div className="relative">
                          <input
                            type={showToken ? 'text' : 'password'}
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            placeholder="Jenkins API token"
                            className="w-full p-2.5 pr-10 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-600 text-sm focus:border-orange-500 outline-none"
                          />
                          <button
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          >
                            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">
                          Jenkins → User → Configure → API Token → Add new Token
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                      <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                      Advanced Options
                    </summary>
                    <div className="mt-3 grid grid-cols-2 gap-4 pl-6">
                      <label className="flex items-center gap-3 p-3 bg-gray-950 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useCrumbIssuer}
                          onChange={(e) => setUseCrumbIssuer(e.target.checked)}
                          className="w-4 h-4 accent-orange-500"
                        />
                        <div>
                          <span className="text-sm text-gray-300">CSRF Protection</span>
                          <p className="text-[10px] text-gray-600">Use crumb issuer (recommended)</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-gray-950 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={verifySsl}
                          onChange={(e) => setVerifySsl(e.target.checked)}
                          className="w-4 h-4 accent-orange-500"
                        />
                        <div>
                          <span className="text-sm text-gray-300">Verify SSL</span>
                          <p className="text-[10px] text-gray-600">Validate SSL certificates</p>
                        </div>
                      </label>
                    </div>
                  </details>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleTest}
                      disabled={!serverUrl || testing}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors disabled:opacity-40"
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-400" />}
                      Test Connection
                    </button>
                    <button
                      onClick={handleDiscover}
                      disabled={!serverUrl || discovering}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-600/20 to-red-600/20 hover:from-orange-600/30 hover:to-red-600/30 text-orange-300 border border-orange-800/40 rounded-xl transition-colors disabled:opacity-40"
                    >
                      {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      AI Auto-Discover
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={handleSave}
                      disabled={!serverUrl || !connectionName || saving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:shadow-none"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isEditMode ? 'Update Connection' : 'Save Connection'}
                    </button>
                  </div>

                  {/* Test Result */}
                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={clsx(
                        'p-4 rounded-xl border',
                        testResult.success
                          ? 'bg-emerald-950/20 border-emerald-800/30'
                          : 'bg-red-950/20 border-red-800/30'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {testResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                        <span className={testResult.success ? 'text-emerald-300 font-medium' : 'text-red-300 font-medium'}>
                          {testResult.message}
                        </span>
                      </div>
                      {testResult.jenkinsVersion && (
                        <div className="mt-2 text-sm text-gray-400">
                          Version: <span className="text-white">{testResult.jenkinsVersion}</span>
                          {testResult.serverDescription && <> — {testResult.serverDescription}</>}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Discovery Results */}
                  {discovery && discovery.connectionValid && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-medium text-orange-300">Discovery Results</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 text-center">
                          <GitBranch className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                          <div className="text-xl font-bold text-white">{discovery.stats?.totalJobs ?? 0}</div>
                          <div className="text-xs text-gray-500">Jobs</div>
                        </div>
                        <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 text-center">
                          <Eye className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                          <div className="text-xl font-bold text-white">{discovery.stats?.totalViews ?? 0}</div>
                          <div className="text-xs text-gray-500">Views</div>
                        </div>
                        <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 text-center">
                          <HardDrive className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                          <div className="text-xl font-bold text-white">{discovery.stats?.totalNodes ?? 0}</div>
                          <div className="text-xs text-gray-500">Nodes</div>
                        </div>
                        <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 text-center">
                          <Activity className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                          <div className="text-xl font-bold text-white">{discovery.stats?.onlineNodes ?? 0}</div>
                          <div className="text-xs text-gray-500">Online</div>
                        </div>
                      </div>

                      {/* Job list preview */}
                      {discovery.jobs && discovery.jobs.length > 0 && (
                        <div className="bg-gray-950 rounded-xl border border-gray-800 p-4">
                          <h4 className="text-sm font-medium text-gray-300 mb-3">Discovered Pipelines & Jobs</h4>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {discovery.jobs.slice(0, 20).map((job, i) => (
                              <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-gray-900">
                                <div className="flex items-center gap-2">
                                  <div className={clsx(
                                    'w-2 h-2 rounded-full',
                                    job.color?.startsWith('blue') ? 'bg-emerald-400' :
                                    job.color?.startsWith('red') ? 'bg-red-400' :
                                    job.color?.startsWith('yellow') ? 'bg-amber-400' :
                                    job.color === 'disabled' ? 'bg-gray-600' :
                                    job.color?.includes('_anime') ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'
                                  )} />
                                  <span className="text-sm text-gray-200">{job.fullName || job.name}</span>
                                </div>
                                {job.lastBuild && (
                                  <span className="text-xs text-gray-500">
                                    #{job.lastBuild.number} — {job.lastBuild.result || 'BUILDING'}
                                  </span>
                                )}
                              </div>
                            ))}
                            {discovery.jobs.length > 20 && (
                              <div className="text-xs text-gray-500 text-center py-1">
                                + {discovery.jobs.length - 20} more jobs
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="p-3 rounded-xl bg-red-950/20 border border-red-800/30 text-sm text-red-300">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
