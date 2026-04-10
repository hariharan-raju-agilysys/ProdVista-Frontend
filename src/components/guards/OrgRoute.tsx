import { useAuth } from '../../context/AuthContext'
import { Navigate, useLocation } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import BrandedSplash from '../BrandedSplash'

interface OrgRouteProps {
  children: React.ReactNode
}

/**
 * Route guard that requires a valid authenticated session.
 * AuthGate (in App.tsx) already blocks during MSAL redirect processing,
 * so this guard mainly handles auth-check and loading states.
 *
 * Uses a branded splash (matching the login ConnectingScreen) instead
 * of FunLoader to prevent jarring visual transitions.
 */
export function OrgRoute({ children }: OrgRouteProps) {
  const { isLoading, isAuthenticated } = useAuth()
  const { inProgress } = useMsal()
  const location = useLocation()

  // Wait for auth context AND any MSAL interaction to finish
  if (isLoading || inProgress !== InteractionStatus.None) {
    return <BrandedSplash message="Loading workspace..." />;
  }

  // No valid token — redirect to login for SSO / manual login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default OrgRoute
