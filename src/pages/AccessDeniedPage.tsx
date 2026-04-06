import { ShieldX, ArrowLeft, Home, LogIn } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface AccessDeniedPageProps {
  requiredRole?: string
  feature?: string
  message?: string
}

/**
 * Full-page Access Denied screen
 * Shown when user lacks permission for a route or feature
 */
export function AccessDeniedPage({ 
  requiredRole,
  feature,
  message 
}: AccessDeniedPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()

  const defaultMessage = requiredRole 
    ? `This page requires ${requiredRole} access or higher.`
    : feature
      ? `You don't have access to the ${feature} feature.`
      : 'You don\'t have permission to access this page.'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-lg w-full">
        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-rose-600 px-8 py-10 text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldX className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-red-100 text-sm">Error 403 - Forbidden</p>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              {message || defaultMessage}
            </p>

            {/* User info card */}
            {isAuthenticated && user && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Logged in as:</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {user.displayName || user.email}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500 dark:text-gray-400">Current role:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    user.role?.toLowerCase() === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                    user.role?.toLowerCase() === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                    user.role?.toLowerCase() === 'lead' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                  }`}>
                    {user.role || 'User'}
                  </span>
                </div>
                {requiredRole && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-gray-500 dark:text-gray-400">Required role:</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      {requiredRole}+
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Requested path */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-6">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Requested page:</p>
              <code className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                {location.pathname}
              </code>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate(-1)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
            </div>

            {/* Not logged in? */}
            {!isAuthenticated && (
              <button
                onClick={() => navigate('/login', { state: { from: location.pathname } })}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl transition-all"
              >
                <LogIn className="w-4 h-4" />
                Log In
              </button>
            )}
          </div>
        </div>

        {/* Help text */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          If you believe you should have access, please contact your administrator.
        </p>
      </div>
    </div>
  )
}

export default AccessDeniedPage
