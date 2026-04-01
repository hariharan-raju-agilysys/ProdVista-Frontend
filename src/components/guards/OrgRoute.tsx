import { useAuth } from '../../context/AuthContext'
import { Navigate, useLocation } from 'react-router-dom'
import FunLoader from '../FunLoader'

interface OrgRouteProps {
  children: React.ReactNode
}

/**
 * Route guard that requires organization access
 * Allows both authenticated users AND guests with org code
 * Redirects to org entry if no org code is set
 */
export function OrgRoute({ children }: OrgRouteProps) {
  const { isLoading, hasOrgAccess } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <FunLoader fullPage context="auth" />
  }

  // Redirect to org entry if no org access
  if (!hasOrgAccess) {
    return <Navigate to="/org" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default OrgRoute
