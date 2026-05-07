import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Loader2, Shield } from 'lucide-react'
import './Login.css'

/**
 * Login page - Currently disabled (auto-login mode)
 * TODO: Re-enable when Azure AD authentication is configured
 * 
 * This page now just shows a loading spinner and redirects to home.
 * The AuthContext handles auto-login with a default user.
 */
export default function Login() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()

  // Redirect to home when authenticated or after loading
  useEffect(() => {
    if (!isLoading) {
      navigate('/', { replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Logo/Brand */}
        <div className="login-header">
          <div className="login-logo">
            <Shield className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="login-title">
            <span className="text-blue-600">ProdVista</span> Dashboard
          </h1>
          <p className="login-subtitle">ProdVista</p>
        </div>

        {/* Loading indicator */}
        <div className="login-card">
          <div className="login-loader" style={{ padding: '2rem' }}>
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p style={{ color: '#64748b', textAlign: 'center' }}>Signing in automatically...</p>
          </div>
        </div>
      </div>
    </div>
  )
}
