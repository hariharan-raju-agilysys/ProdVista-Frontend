import { useAuth } from '../../context/AuthContext'
import { Navigate, useLocation } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'

const basePath = import.meta.env.VITE_BASE_PATH || '';

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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <div className="flex items-center gap-3 mb-10">
          <img src={`${basePath}/favicon.svg`} alt="ProdVista" className="w-10 h-10 rounded-xl shadow-md" />
          <span className="text-xl font-bold text-gray-900 tracking-tight">ProdVista</span>
        </div>
        <div className="w-12 h-12 rounded-full border-[3px] border-blue-100 animate-spin" style={{ borderTopColor: '#3b82f6' }} />
        <p className="mt-6 text-sm text-gray-400">Loading workspace...</p>
      </div>
    );
  }

  // No valid token — redirect to login for SSO / manual login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

export default OrgRoute
