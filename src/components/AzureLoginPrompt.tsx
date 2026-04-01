/**
 * AzureLoginPrompt Component
 * Minimal login prompt that appears when Azure features are needed
 * Shows if not authenticated, otherwise renders children
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cloud, Play, Loader2, X, LogOut, User } from 'lucide-react'
import { useAzureAuth } from '../hooks/useAzureAuth'
import clsx from 'clsx'

interface AzureLoginPromptProps {
  children: React.ReactNode
  requireAuth?: boolean
  onClose?: () => void
}

// Main component - wraps content that requires Azure auth
export function AzureLoginPrompt({ children, requireAuth = true, onClose }: AzureLoginPromptProps) {
  const { isAuthenticated, isLoading, loginDemo, loginInteractive, error } = useAzureAuth()

  if (!requireAuth || isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-slate-800 rounded-xl shadow-xl p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Cloud className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Connect to Azure</h3>
          <p className="text-slate-400 text-sm">
            Sign in to access Azure resources and logs
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={loginDemo}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-lg text-emerald-300 font-medium flex items-center justify-center gap-2 transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Play className="w-5 h-5" />
                Continue with Demo
              </>
            )}
          </button>

          <button
            onClick={loginInteractive}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-300 font-medium flex items-center justify-center gap-2 transition-all"
          >
            <Cloud className="w-5 h-5" />
            Sign in with Azure
          </button>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full mt-4 py-2 text-slate-500 hover:text-slate-300 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// Compact login button for headers/navbars
export function AzureAuthButton() {
  const { isAuthenticated, user, isLoading, loginDemo, logout } = useAzureAuth()
  const [showMenu, setShowMenu] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span className="text-sm text-slate-300">Connecting...</span>
      </div>
    )
  }

  if (isAuthenticated && user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <User className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm text-white">{user.displayName}</span>
          <Cloud className="w-4 h-4 text-green-400" />
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50"
            >
              <div className="p-3 border-b border-slate-700">
                <p className="text-sm font-medium text-white">{user.displayName}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
              <div className="p-2">
                <button
                  onClick={() => {
                    logout()
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <button
      onClick={loginDemo}
      className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-300 text-sm transition-colors"
    >
      <Cloud className="w-4 h-4" />
      Connect Azure
    </button>
  )
}

// Status badge showing Azure connection state
export function AzureStatusBadge() {
  const { isAuthenticated } = useAzureAuth()

  return (
    <div className={clsx(
      'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs',
      isAuthenticated ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'
    )}>
      <div className={clsx(
        'w-2 h-2 rounded-full',
        isAuthenticated ? 'bg-green-400' : 'bg-slate-500'
      )} />
      {isAuthenticated ? 'Azure Connected' : 'Not Connected'}
    </div>
  )
}

// Full-screen modal for Azure login
export function AzureLoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { isAuthenticated, isLoading, loginDemo, loginInteractive, error } = useAzureAuth()

  // Auto-close when authenticated
  if (isAuthenticated && isOpen) {
    onClose()
    return null
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cloud className="w-7 h-7 text-white" />
                <div>
                  <h2 className="text-lg font-bold text-white">Azure Connection</h2>
                  <p className="text-blue-100 text-xs">One-time login for all features</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Demo Mode */}
              <button
                onClick={loginDemo}
                disabled={isLoading}
                className="w-full p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30">
                    <Play className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Demo Mode</span>
                      <span className="px-1.5 py-0.5 bg-emerald-500/30 text-emerald-300 text-[10px] rounded">
                        Quick Start
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">No credentials needed</p>
                  </div>
                  {isLoading && <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />}
                </div>
              </button>

              {/* Interactive Login */}
              <button
                onClick={loginInteractive}
                disabled={isLoading}
                className="w-full p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/40 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30">
                    <Cloud className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-white">Sign in with Azure</span>
                    <p className="text-xs text-slate-400 mt-0.5">Use your Azure account</p>
                  </div>
                </div>
              </button>

              <p className="text-center text-xs text-slate-500 pt-2">
                Login once, access all Azure features
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AzureLoginPrompt
