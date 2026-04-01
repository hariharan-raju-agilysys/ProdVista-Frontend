import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database, Search, RefreshCw, Cloud,
  AlertCircle, XCircle, Info, ChevronDown, ChevronRight,
  Clock, Layers, Loader2, Terminal, FolderOpen, FileText, HardDrive
} from 'lucide-react'
import { 
  getStorageContainers, 
  getStorageBlobs, 
  getBlobContent,
  searchLogs,
  getResourceGraphSubscriptions,
  getResourceGraphByType
} from '../services/api'
import { SearchableSelect } from './SearchableSelect'

interface LogEntry {
  id: number
  raw: string
  timestamp?: string
  level?: string
  message?: string
  format: 'json' | 'standard' | 'text'
  parsed?: Record<string, unknown>
}

interface Container {
  name: string
  lastModified: string
  publicAccess?: string
}

interface Blob {
  name: string
  size: number
  contentType: string
  lastModified: string
  blobType: string
}

interface Subscription {
  id: string
  subscriptionId: string
  displayName: string
  state: string
}

interface StorageAccount {
  id: string
  name: string
  location: string
  kind: string
  sku: string
  resourceGroup: string
}

interface Props {
  accountName?: string
  onClose?: () => void
  showSelectors?: boolean  // New prop to show subscription/storage account selectors
}

const levelColors: Record<string, string> = {
  INFO: 'text-blue-400 bg-blue-400/10',
  WARN: 'text-yellow-400 bg-yellow-400/10',
  WARNING: 'text-yellow-400 bg-yellow-400/10',
  ERROR: 'text-red-400 bg-red-400/10',
  DEBUG: 'text-gray-400 bg-gray-400/10',
  TRACE: 'text-purple-400 bg-purple-400/10',
  FATAL: 'text-red-600 bg-red-600/10',
}

const levelIcons: Record<string, any> = {
  INFO: Info,
  WARN: AlertCircle,
  WARNING: AlertCircle,
  ERROR: XCircle,
  DEBUG: Terminal,
  TRACE: Layers,
  FATAL: XCircle,
}

export function AzureLogsViewer({ accountName: propAccountName, onClose, showSelectors = true }: Props) {
  // Subscription and Storage Account Selection
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSubscription, setSelectedSubscription] = useState<string>('')
  const [storageAccounts, setStorageAccounts] = useState<StorageAccount[]>([])
  const [selectedStorageAccount, setSelectedStorageAccount] = useState<string>('')
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false)
  const [isLoadingStorageAccounts, setIsLoadingStorageAccounts] = useState(false)
  
  // Use prop if provided, otherwise use selected storage account
  const accountName = propAccountName || selectedStorageAccount

  const [containers, setContainers] = useState<Container[]>([])
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null)
  const [blobs, setBlobs] = useState<Blob[]>([])
  const [selectedBlob, setSelectedBlob] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState({ containers: false, blobs: false, logs: false })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Load subscriptions on mount if showSelectors is true
  useEffect(() => {
    if (showSelectors && !propAccountName) {
      loadSubscriptions()
    }
  }, [showSelectors, propAccountName])

  // Load storage accounts when subscription changes
  useEffect(() => {
    if (selectedSubscription) {
      loadStorageAccounts(selectedSubscription)
    } else {
      setStorageAccounts([])
      setSelectedStorageAccount('')
    }
  }, [selectedSubscription])

  // Reset containers when storage account changes
  useEffect(() => {
    if (selectedStorageAccount) {
      setSelectedContainer(null)
      setBlobs([])
      setSelectedBlob(null)
      setLogs([])
    }
  }, [selectedStorageAccount])

  useEffect(() => {
    if (accountName) {
      loadContainers()
    }
  }, [accountName])

  useEffect(() => {
    if (accountName && selectedContainer) {
      loadBlobs()
    }
  }, [accountName, selectedContainer])

  useEffect(() => {
    if (accountName && selectedContainer && selectedBlob) {
      loadBlobContent()
    }
  }, [accountName, selectedContainer, selectedBlob])

  const loadSubscriptions = async () => {
    setIsLoadingSubscriptions(true)
    setError(null)
    try {
      // Use Resource Graph for fast subscription discovery
      const { data } = await getResourceGraphSubscriptions()
      const subs = (data.subscriptions || []).map((s: any) => ({
        id: s.id,
        subscriptionId: s.subscriptionId,
        displayName: s.name || s.displayName,
        state: s.state || 'Enabled'
      }))
      setSubscriptions(subs)
      console.log(`Loaded ${subs.length} subscriptions via Resource Graph in ${data.queryTimeMs}ms`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load Azure subscriptions. Please check Azure authentication.')
    } finally {
      setIsLoadingSubscriptions(false)
    }
  }

  const loadStorageAccounts = async (subscriptionId: string) => {
    setIsLoadingStorageAccounts(true)
    setError(null)
    try {
      // Use Resource Graph for fast storage account discovery
      const { data } = await getResourceGraphByType('microsoft.storage/storageaccounts', [subscriptionId])
      const accounts = (data.resources || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        location: s.location,
        kind: s.kind || 'StorageV2',
        sku: s.sku?.name || 'Standard_LRS',
        resourceGroup: s.resourceGroup
      }))
      setStorageAccounts(accounts)
      console.log(`Loaded ${accounts.length} storage accounts via Resource Graph in ${data.queryTimeMs}ms`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load storage accounts')
    } finally {
      setIsLoadingStorageAccounts(false)
    }
  }

  const loadContainers = async () => {
    if (!accountName) return

    setIsLoading(l => ({ ...l, containers: true }))
    setError(null)
    try {
      const { data } = await getStorageContainers(accountName)
      setContainers(data.containers || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load containers')
    } finally {
      setIsLoading(l => ({ ...l, containers: false }))
    }
  }

  const loadBlobs = async () => {
    if (!accountName || !selectedContainer) return

    setIsLoading(l => ({ ...l, blobs: true }))
    try {
      const { data } = await getStorageBlobs(accountName, selectedContainer, undefined, 200)
      setBlobs(data.blobs || [])
      setSelectedBlob(null)
      setLogs([])
    } catch (err: any) {
      console.error('Failed to load blobs:', err)
    } finally {
      setIsLoading(l => ({ ...l, blobs: false }))
    }
  }

  const loadBlobContent = async () => {
    if (!accountName || !selectedContainer || !selectedBlob) return

    setIsLoading(l => ({ ...l, logs: true }))
    setSearchResults(null)
    try {
      const { data } = await getBlobContent(accountName, selectedContainer, selectedBlob, 1000)
      setLogs(data.logs || [])
    } catch (err: any) {
      console.error('Failed to load blob content:', err)
    } finally {
      setIsLoading(l => ({ ...l, logs: false }))
    }
  }

  const handleSearch = async () => {
    if (!accountName || !selectedContainer || !searchQuery.trim()) return

    setIsSearching(true)
    try {
      const { data } = await searchLogs(accountName, selectedContainer, {
        query: searchQuery,
        level: levelFilter !== 'all' ? levelFilter : undefined,
        maxBlobs: 10,
        maxResultsPerBlob: 50,
        maxTotalResults: 200
      })
      setSearchResults(data.results || [])
    } catch (err: any) {
      console.error('Search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }

  const toggleLogExpanded = (logId: number) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getLogLevel = (log: LogEntry) => {
    return log.level?.toUpperCase() || 'INFO'
  }

  const filteredLogs = logs.filter(log => {
    if (levelFilter !== 'all') {
      const logLevel = getLogLevel(log)
      if (logLevel !== levelFilter.toUpperCase()) return false
    }
    if (searchQuery && !searchResults) {
      const text = log.raw.toLowerCase()
      if (!text.includes(searchQuery.toLowerCase())) return false
    }
    return true
  })

  if (!accountName) {
    // Show subscription and storage account selectors
    if (showSelectors && !propAccountName) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Azure Resource Selector */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Cloud className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Azure Logs Browser</h3>
                <p className="text-sm text-gray-400">Select subscription and storage account to view logs</p>
              </div>
              <button
                onClick={loadSubscriptions}
                disabled={isLoadingSubscriptions}
                className="ml-auto p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh subscriptions"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingSubscriptions ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {/* Subscription Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-400" />
                  Azure Subscription
                </label>
                <SearchableSelect
                  options={subscriptions.map(sub => ({
                    value: sub.subscriptionId,
                    label: sub.displayName,
                    description: sub.subscriptionId
                  }))}
                  value={selectedSubscription}
                  onChange={setSelectedSubscription}
                  placeholder={isLoadingSubscriptions ? "Loading subscriptions..." : "Select subscription..."}
                  loading={isLoadingSubscriptions}
                  disabled={isLoadingSubscriptions}
                />
                {subscriptions.length === 0 && !isLoadingSubscriptions && (
                  <p className="mt-2 text-xs text-gray-500">
                    No subscriptions found. Ensure you're logged in with Azure CLI.
                  </p>
                )}
              </div>

              {/* Storage Account Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-green-400" />
                  Storage Account
                </label>
                <SearchableSelect
                  options={storageAccounts.map(acc => ({
                    value: acc.name,
                    label: acc.name,
                    description: `${acc.location} • ${acc.kind}`
                  }))}
                  value={selectedStorageAccount}
                  onChange={setSelectedStorageAccount}
                  placeholder={isLoadingStorageAccounts ? "Loading storage accounts..." : "Select storage account..."}
                  loading={isLoadingStorageAccounts}
                  disabled={!selectedSubscription || isLoadingStorageAccounts}
                />
                {selectedSubscription && storageAccounts.length === 0 && !isLoadingStorageAccounts && (
                  <p className="mt-2 text-xs text-gray-500">
                    No storage accounts found in this subscription.
                  </p>
                )}
              </div>
            </div>

            {/* Storage Accounts List */}
            {selectedSubscription && storageAccounts.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Available Storage Accounts ({storageAccounts.length})</h4>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {storageAccounts.map((account, idx) => (
                    <motion.div
                      key={account.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedStorageAccount(account.name)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedStorageAccount === account.name
                          ? 'bg-green-500/20 border-green-500 ring-1 ring-green-500/50'
                          : 'bg-gray-900 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Database className={`w-4 h-4 ${selectedStorageAccount === account.name ? 'text-green-400' : 'text-gray-400'}`} />
                        <span className="font-medium text-white text-sm truncate">{account.name}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span>{account.location}</span>
                        <span className="mx-1">•</span>
                        <span>{account.kind}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )
    }

    return (
      <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center">
        <Database className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">No Storage Account Selected</h3>
        <p className="text-gray-500 text-sm">Select a Storage Account from Azure Cloud Setup to view logs.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 rounded-xl p-4 border border-gray-700"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Back button when using selectors */}
            {showSelectors && !propAccountName && (
              <button
                onClick={() => {
                  setSelectedStorageAccount('')
                  setContainers([])
                  setSelectedContainer(null)
                  setBlobs([])
                  setSelectedBlob(null)
                  setLogs([])
                }}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors"
                title="Back to storage account selection"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Database className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{accountName}</h3>
              <p className="text-xs text-gray-400">
                {selectedSubscription && subscriptions.find(s => s.subscriptionId === selectedSubscription)?.displayName 
                  ? `${subscriptions.find(s => s.subscriptionId === selectedSubscription)?.displayName} • `
                  : ''
                }
                Azure Blob Storage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadContainers}
              disabled={isLoading.containers}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading.containers ? 'animate-spin' : ''}`} />
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

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </motion.div>

      {/* Container and Blob Browser */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Containers */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="bg-gray-900/50 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h4 className="font-medium text-gray-300 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              Containers
            </h4>
            {isLoading.containers && (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {containers.map((container, idx) => (
              <motion.div
                key={container.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => setSelectedContainer(container.name)}
                className={`px-4 py-3 cursor-pointer border-b border-gray-700/50 last:border-0 transition-colors ${
                  selectedContainer === container.name
                    ? 'bg-blue-500/20 border-l-4 border-l-blue-500'
                    : 'hover:bg-gray-700/30'
                }`}
              >
                <p className="font-medium text-white text-sm truncate">{container.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(container.lastModified).toLocaleDateString()}
                </p>
              </motion.div>
            ))}
            {containers.length === 0 && !isLoading.containers && (
              <p className="px-4 py-6 text-center text-gray-500 text-sm">No containers found</p>
            )}
          </div>
        </div>

        {/* Blobs */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="bg-gray-900/50 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h4 className="font-medium text-gray-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-yellow-400" />
              Files {selectedContainer && `(${blobs.length})`}
            </h4>
            {isLoading.blobs && (
              <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {blobs.map((blob, idx) => (
              <motion.div
                key={blob.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => setSelectedBlob(blob.name)}
                className={`px-4 py-3 cursor-pointer border-b border-gray-700/50 last:border-0 transition-colors ${
                  selectedBlob === blob.name
                    ? 'bg-yellow-500/20 border-l-4 border-l-yellow-500'
                    : 'hover:bg-gray-700/30'
                }`}
              >
                <p className="font-medium text-white text-sm truncate" title={blob.name}>
                  {blob.name.split('/').pop()}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{formatFileSize(blob.size)}</span>
                  <span>•</span>
                  <span>{new Date(blob.lastModified).toLocaleDateString()}</span>
                </div>
              </motion.div>
            ))}
            {!selectedContainer && (
              <p className="px-4 py-6 text-center text-gray-500 text-sm">Select a container</p>
            )}
            {selectedContainer && blobs.length === 0 && !isLoading.blobs && (
              <p className="px-4 py-6 text-center text-gray-500 text-sm">No files found</p>
            )}
          </div>
        </div>

        {/* Search Panel */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="bg-gray-900/50 px-4 py-3 border-b border-gray-700">
            <h4 className="font-medium text-gray-300 flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-400" />
              Search Logs
            </h4>
          </div>
          <div className="p-4 space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search within logs..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-500 outline-none"
            />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 outline-none"
            >
              <option value="all">All Levels</option>
              <option value="ERROR">Error</option>
              <option value="WARN">Warning</option>
              <option value="INFO">Info</option>
              <option value="DEBUG">Debug</option>
            </select>
            <button
              onClick={handleSearch}
              disabled={!selectedContainer || isSearching}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Log Content Viewer */}
      {(selectedBlob || searchResults) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h4 className="font-medium text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-green-400" />
              {searchResults ? `Search Results (${searchResults.length})` : selectedBlob?.split('/').pop()}
            </h4>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {!searchResults && <span>{filteredLogs.length} entries</span>}
              {isLoading.logs && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto font-mono text-sm">
            {searchResults ? (
              searchResults.map((result, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30"
                >
                  <div className="px-4 py-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <FileText className="w-3 h-3" />
                      <span className="truncate">{result.blobName}</span>
                      <span>Line {result.lineNumber}</span>
                    </div>
                    <pre className="text-gray-300 whitespace-pre-wrap break-all text-xs">
                      {result.content}
                    </pre>
                  </div>
                </motion.div>
              ))
            ) : (
              filteredLogs.map((log, idx) => {
                const level = getLogLevel(log)
                const LevelIcon = levelIcons[level] || Info
                const colorClass = levelColors[level] || levelColors.INFO
                const isExpanded = expandedLogs.has(log.id)

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.01, 0.5) }}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30"
                  >
                    <div
                      className="flex items-start gap-3 px-4 py-2 cursor-pointer"
                      onClick={() => log.format !== 'text' && toggleLogExpanded(log.id)}
                    >
                      {log.format !== 'text' && (
                        <button className="p-0.5 mt-1">
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-gray-500" />
                          )}
                        </button>
                      )}

                      <div className={`p-1 rounded ${colorClass} flex-shrink-0`}>
                        <LevelIcon className="w-3 h-3" />
                      </div>

                      {log.timestamp && (
                        <span className="text-xs text-gray-500 flex-shrink-0 w-20">
                          {log.timestamp.slice(11, 19) || log.timestamp}
                        </span>
                      )}

                      <pre className="text-gray-300 flex-1 whitespace-pre-wrap break-all text-xs">
                        {log.message || log.raw}
                      </pre>
                    </div>

                    <AnimatePresence>
                      {isExpanded && log.parsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <pre className="mx-4 mb-2 p-2 bg-gray-900 rounded text-xs text-gray-400 overflow-x-auto">
                            {JSON.stringify(log.parsed, null, 2)}
                          </pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })
            )}

            {!searchResults && filteredLogs.length === 0 && !isLoading.logs && (
              <div className="text-center py-12 text-gray-500">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No log entries found</p>
              </div>
            )}
            <div ref={logsEndRef} />
          </div>

          <div className="p-3 border-t border-gray-700 bg-gray-900/50 flex items-center justify-between text-xs text-gray-500">
            <span>
              {searchResults 
                ? `Found ${searchResults.length} matching entries`
                : `Showing ${filteredLogs.length} of ${logs.length} entries`
              }
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default AzureLogsViewer
