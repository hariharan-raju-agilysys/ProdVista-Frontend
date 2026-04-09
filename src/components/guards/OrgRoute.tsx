import { useAuth } from '../../context/AuthContext'
import { Navigate, useLocation } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import FunLoader from '../FunLoader'

interface OrgRouteProps {
  children: React.ReactNode
}

/**
 * Route guard that requires a valid authenticated session.
 * If the user is not authenticated, redirect to /login where
 * auto-SSO can handle re-authentication seamlessly.
 * The stored org code (localStorage) will pre-fill the tenant input.
 *
 * IMPORTANT: We must wait for MSAL to finish processing any redirect
 * before deciding to navigate to /login. Otherwise the redirect hash
 * (containing the auth code) gets cleared before MSAL reads it,
 * causing a login loop.
 */
export function OrgRoute({ children }: OrgRouteProps) {
  const { isLoading, isAuthenticated } = useAuth()
  const { inProgress } = useMsal()
  const location = useLocation()

  // Wait for auth context AND MSAL redirect processing to finish
  if (isLoading || inProgress !== InteractionStatus.None) {
    return <FunLoader fullPage context="auth" />
  }

  // No valid token — redirect to login for SSO / manual login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default OrgRoute
