import { useState } from 'react'
import { Cloud, CloudOff, Loader2, RefreshCw, Terminal, CheckCircle2, XCircle } from 'lucide-react'
import { useAzureAuth } from '../context/AzureAuthContext'
import clsx from 'clsx'

export function AzureStatusIndicator() {
  const { 
    azureStatus, 
    isAzureAuthenticated, 
    isCheckingAzure, 
    lastChecked,
    isDevelopment,
    refreshAzureStatus 
  } = useAzureAuth()
  
  const [showDropdown, setShowDropdown] = useState(false)

  if (!azureStatus && !isCheckingAzure) {
    return null
  }

  const getStatusIcon = () => {
    if (isCheckingAzure) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
    }
    if (isAzureAuthenticated) {
      return <Cloud className="w-4 h-4 text-green-500" />
    }
    return <CloudOff className="w-4 h-4 text-amber-500" />
  }

  const getStatusColor = () => {
    if (isCheckingAzure) return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
    if (isAzureAuthenticated) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
    return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
  }

  const formatLastChecked = () => {
    if (!lastChecked) return 'Never'
    const diff = Date.now() - lastChecked.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    return `${Math.floor(minutes / 60)}h ago`
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
          getStatusColor(),
          'hover:opacity-80'
        )}
        title={isAzureAuthenticated ? 'Azure: Connected' : 'Azure: Not connected'}
      >
        {getStatusIcon()}
        <span className="text-xs font-medium hidden sm:inline">
          {isCheckingAzure ? 'Checking...' : (isAzureAuthenticated ? 'Azure' : 'Azure')}
        </span>
      </button>

      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setShowDropdown(false)} 
          />
          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[110]">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">Azure Status</h3>
                <button
                  onClick={() => { refreshAzureStatus(); }}
                  disabled={isCheckingAzure}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                  title="Refresh"
                >
                  <RefreshCw className={clsx('w-4 h-4', isCheckingAzure && 'animate-spin')} />
                </button>
              </div>

              {/* Status */}
              <div className={clsx(
                'flex items-center gap-2 p-3 rounded-lg mb-3',
                isAzureAuthenticated 
                  ? 'bg-green-50 dark:bg-green-900/20' 
                  : 'bg-amber-50 dark:bg-amber-900/20'
              )}>
                {isAzureAuthenticated ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={clsx(
                    'text-sm font-medium',
                    isAzureAuthenticated 
                      ? 'text-green-800 dark:text-green-200' 
                      : 'text-amber-800 dark:text-amber-200'
                  )}>
                    {isAzureAuthenticated ? 'Connected' : 'Not Connected'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {azureStatus?.message}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                {azureStatus?.method && azureStatus.method !== 'None' && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Auth Method</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                      {azureStatus.method}
                    </span>
                  </div>
                )}
                
                {azureStatus?.user && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">User</span>
                    <span className="text-gray-900 dark:text-gray-100 truncate ml-2 max-w-[150px]">
                      {azureStatus.user.name || azureStatus.user.email}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Last Check</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {formatLastChecked()}
                  </span>
                </div>

                {isDevelopment && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Environment</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                      Development
                    </span>
                  </div>
                )}
              </div>

              {/* Instructions for non-authenticated */}
              {!isAzureAuthenticated && azureStatus?.instructions && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-start gap-2">
                    <Terminal className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {azureStatus.instructions}
                      </p>
                      {isDevelopment && (
                        <code className="block mt-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                          az login
                        </code>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Note about Azure features */}
              {!isAzureAuthenticated && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Azure features (Log Analytics, App Insights, Metrics) require Azure authentication.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AzureStatusIndicator
