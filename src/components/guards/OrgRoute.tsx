import { useAuth } from '../../context/AuthContext'
import { Navigate, useLocation } from 'react-router-dom'
import FunLoader from '../FunLoader'

interface OrgRouteProps {
  children: React.ReactNode
}

/**
 * Route guard that requires a valid authenticated session.
 * If the user is not authenticated, redirect to /login where
 * auto-SSO can handle re-authentication seamlessly.
 * The stored org code (localStorage) will pre-fill the tenant input.
 */
export function OrgRoute({ children }: OrgRouteProps) {
  const { isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <FunLoader fullPage context="auth" />
  }

  // No valid token — redirect to login for SSO / manual login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default OrgRoute
