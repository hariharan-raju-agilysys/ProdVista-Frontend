import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Activity, Database, BarChart3, RefreshCw,
  Filter, Download, ChevronDown, Clock, AlertCircle,
  CheckCircle, XCircle, Info, Zap, Globe
} from 'lucide-react'
import { AzureLogsViewer } from '../components/AzureLogsViewer'
import { AppInsightsTraces } from '../components/AppInsightsTraces'
import { useSettingsStore } from '../stores/settingsStore'

type ViewMode = 'overview' | 'logs' | 'traces' | 'analytics'

interface LogStats {
  total: number
  errors: number
  warnings: number
  info: number
  lastHour: number
  trend: number
}

// Demo stats - would come from API
const getLogStats = (): LogStats => ({
  total: 12847,
  errors: 234,
  warnings: 891,
  info: 11722,
  lastHour: 1523,
  trend: 12.5,
})

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color,
  subValue,
  delay = 0
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  subValue?: string
  delay?: number
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className={`relative overflow-hidden bg-gray-800 rounded-xl p-6 border border-gray-700`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <motion.p
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.2, type: 'spring' }}
          className="text-3xl font-bold text-white mt-1"
        >
          {value.toLocaleString()}
        </motion.p>
        {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    
    {/* Animated background glow */}
    <motion.div
      className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 ${color}`}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.2, 0.3, 0.2],
      }}
      transition={{ duration: 3, repeat: Infinity }}
    />
  </motion.div>
)

const LiveIndicator = () => (
  <div className="flex items-center gap-2">
    <motion.div
      className="w-2 h-2 bg-green-500 rounded-full"
      animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
    <span className="text-sm text-green-400">Live</span>
  </div>
)

const QuickFilters = ({ 
  selectedFilters, 
  onFilterChange 
}: {
  selectedFilters: string[]
  onFilterChange: (filters: string[]) => void
}) => {
  const filters = [
    { id: 'errors', label: 'Errors', icon: XCircle, color: 'red' },
    { id: 'warnings', label: 'Warnings', icon: AlertCircle, color: 'yellow' },
    { id: 'info', label: 'Info', icon: Info, color: 'blue' },
    { id: 'success', label: 'Success', icon: CheckCircle, color: 'green' },
  ]

  const toggleFilter = (id: string) => {
    if (selectedFilters.includes(id)) {
      onFilterChange(selectedFilters.filter(f => f !== id))
    } else {
      onFilterChange([...selectedFilters, id])
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Filter className="w-4 h-4 text-gray-400" />
      {filters.map((filter) => {
        const Icon = filter.icon
        const isActive = selectedFilters.includes(filter.id)
        
        return (
          <motion.button
            key={filter.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => toggleFilter(filter.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isActive
                ? `bg-${filter.color}-500/20 text-${filter.color}-400 border border-${filter.color}-500/50`
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {filter.label}
          </motion.button>
        )
      })}
    </div>
  )
}

export function LogsDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['errors', 'warnings', 'info'])
  const [timeRange] = useState('1h')
  const { settings } = useSettingsStore()
  
  const stats = getLogStats()

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const enabledRegions = settings.azure.regions.filter(r => r.isEnabled)

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-400" />
                Logs & Traces Dashboard
              </h1>
              <p className="text-gray-400 mt-1">
                Real-time monitoring across {enabledRegions.length} Azure region{enabledRegions.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <LiveIndicator />
              
              {/* Time Range */}
              <div className="relative">
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>Last {timeRange}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Refresh */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
              >
                <motion.div
                  animate={isRefreshing ? { rotate: 360 } : {}}
                  transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0 }}
                >
                  <RefreshCw className="w-5 h-5" />
                </motion.div>
              </motion.button>

              {/* Download */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
              >
                <Download className="w-4 h-4" />
                Export
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* View Mode Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="inline-flex bg-gray-800 rounded-xl p-1 border border-gray-700">
            {([
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'logs', label: 'Storage Logs', icon: Database },
              { id: 'traces', label: 'App Insights', icon: Activity },
              { id: 'analytics', label: 'Analytics', icon: Zap },
            ] as const).map((tab) => {
              const Icon = tab.icon
              const isActive = viewMode === tab.id
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeViewTab"
                      className="absolute inset-0 bg-purple-600 rounded-lg"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {viewMode === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard
                  title="Total Logs"
                  value={stats.total}
                  icon={FileText}
                  color="bg-blue-500"
                  subValue="All time"
                  delay={0}
                />
                <StatCard
                  title="Errors"
                  value={stats.errors}
                  icon={XCircle}
                  color="bg-red-500"
                  subValue={`${((stats.errors / stats.total) * 100).toFixed(1)}% of total`}
                  delay={0.1}
                />
                <StatCard
                  title="Warnings"
                  value={stats.warnings}
                  icon={AlertCircle}
                  color="bg-yellow-500"
                  subValue={`${((stats.warnings / stats.total) * 100).toFixed(1)}% of total`}
                  delay={0.2}
                />
                <StatCard
                  title="Last Hour"
                  value={stats.lastHour}
                  icon={Zap}
                  color="bg-green-500"
                  subValue={`+${stats.trend}% from previous`}
                  delay={0.3}
                />
              </div>

              {/* Regions Overview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-400" />
                    Activity by Region
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {enabledRegions.map((region, index) => (
                    <motion.div
                      key={region.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="relative p-4 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{region.displayName}</span>
                        {region.isDefault && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Primary</span>
                        )}
                      </div>
                      <motion.div
                        className="text-2xl font-bold text-white"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 + index * 0.1 }}
                      >
                        {Math.floor(Math.random() * 5000 + 1000).toLocaleString()}
                      </motion.div>
                      <p className="text-xs text-gray-500 mt-1">logs in last hour</p>
                      
                      {/* Activity indicator */}
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-blue-500"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: Math.random() * 0.5 + 0.5 }}
                        transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
                        style={{ transformOrigin: 'left' }}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Quick Access */}
              <div className="grid grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-gray-800 rounded-xl p-6 border border-gray-700"
                >
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-400" />
                    Storage Accounts
                  </h3>
                  <div className="space-y-3">
                    {settings.azure.storageAccounts.slice(0, 3).map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                      >
                        <span className="text-white">{account.name}</span>
                        <span className="text-sm text-gray-500">{account.resourceGroup}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setViewMode('logs')}
                    className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    View All Logs →
                  </button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-gray-800 rounded-xl p-6 border border-gray-700"
                >
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    Application Insights
                  </h3>
                  <div className="space-y-3">
                    {settings.azure.applicationInsights.slice(0, 3).map((ai) => (
                      <div
                        key={ai.id}
                        className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
                      >
                        <span className="text-white">{ai.name}</span>
                        <span className="text-sm text-gray-500">{ai.region}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setViewMode('traces')}
                    className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    View All Traces →
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}

          {viewMode === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AzureLogsViewer />
            </motion.div>
          )}

          {viewMode === 'traces' && (
            <motion.div
              key="traces"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AppInsightsTraces />
            </motion.div>
          )}

          {viewMode === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Analytics View */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Log Analytics
                </h3>
                
                <QuickFilters
                  selectedFilters={selectedFilters}
                  onFilterChange={setSelectedFilters}
                />

                <div className="mt-6 grid grid-cols-2 gap-6">
                  {/* Log Volume Chart Placeholder */}
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-4">Log Volume Over Time</h4>
                    <div className="h-48 flex items-end justify-between gap-1">
                      {Array.from({ length: 24 }, (_, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.random() * 80 + 20}%` }}
                          transition={{ delay: i * 0.02, duration: 0.5 }}
                          className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                        />
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>00:00</span>
                      <span>12:00</span>
                      <span>Now</span>
                    </div>
                  </div>

                  {/* Error Distribution */}
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-4">Error Distribution</h4>
                    <div className="space-y-4">
                      {[
                        { label: 'Database Errors', value: 45, color: 'bg-red-500' },
                        { label: 'API Timeouts', value: 28, color: 'bg-orange-500' },
                        { label: 'Auth Failures', value: 18, color: 'bg-yellow-500' },
                        { label: 'Other', value: 9, color: 'bg-gray-500' },
                      ].map((item, index) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300">{item.label}</span>
                            <span className="text-white font-medium">{item.value}%</span>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${item.value}%` }}
                              transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                              className={`h-full ${item.color} rounded-full`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent Insights */}
                <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-purple-500/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-purple-400" />
                    <h4 className="text-white font-medium">AI-Generated Insights</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">•</span>
                      Error rate increased by 15% in the last hour, primarily from database connection timeouts
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">•</span>
                      West US 2 region showing higher latency than usual (avg 340ms vs normal 120ms)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">•</span>
                      Authentication service logs show unusual spike in failed attempts from IP range 10.x.x.x
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default LogsDashboard
