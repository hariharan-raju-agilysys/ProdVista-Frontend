import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ShieldAlert } from 'lucide-react'
import FunLoader from '../FunLoader'

interface ManagerRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Route guard that requires Manager or Admin role
 * Shows access denied or redirects if user doesn't have permission
 */
export function ManagerRoute({ children, fallback }: ManagerRouteProps) {
  const { isAuthenticated, isManager, isLoading, user } = useAuth()

  if (isLoading) {
    return <FunLoader fullPage context="auth" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isManager) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page. Manager or Admin role is required.
          </p>
          <p className="text-sm text-gray-500">
            Current role: <span className="font-medium">{user?.role || 'Unknown'}</span>
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-6 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default ManagerRoute
