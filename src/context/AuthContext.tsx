import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback, 
  useMemo,
  ReactNode 
} from 'react'
import { authApi, type User, type LoginResponse } from '../services/authApi'
import { authService, TenantInfo } from '../services/authService'

// Organization storage keys
const ORG_CODE_KEY = 'prodvista_org_code'
const ORG_INFO_KEY = 'prodvista_org_info'

export function getStoredOrgCode(): string | null {
  return localStorage.getItem(ORG_CODE_KEY)
}

export function getStoredOrgInfo(): TenantInfo | null {
  const info = localStorage.getItem(ORG_INFO_KEY)
  if (!info) return null
  try {
    return JSON.parse(info)
  } catch {
    return null
  }
}

export function setOrgInfo(code: string, info: TenantInfo) {
  localStorage.setItem(ORG_CODE_KEY, code)
  localStorage.setItem(ORG_INFO_KEY, JSON.stringify(info))
}

export function clearOrgInfo() {
  localStorage.removeItem(ORG_CODE_KEY)
  localStorage.removeItem(ORG_INFO_KEY)
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isManager: boolean
  isAdmin: boolean
  isGuest: boolean // True if user entered org code but not logged in
  orgCode: string | null
  orgInfo: TenantInfo | null
  hasOrgAccess: boolean // True if either authenticated or has org code
  // Session state
  isSessionExpired: boolean
  isAccessDenied: boolean
  accessDeniedMessage: string | null
  clearSessionExpired: () => void
  clearAccessDenied: () => void
  login: (email: string, displayName: string) => Promise<LoginResponse>
  logout: () => void
  logoutToOrg: () => void // Logout but keep org code (stay as guest)
  exitOrg: () => void // Exit org completely (clear org code too)
  refreshUser: () => Promise<void>
  setUserFromLocal: (user: User) => void
  updateOrgInfo: (code: string, info: TenantInfo) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const AUTH_STORAGE_KEY = 'ProdVista_auth_user'

function loadUserFromStorage(): User | null {
  // Try primary key first
  const stored = sessionStorage.getItem(AUTH_STORAGE_KEY)
  if (stored) {
    try { return JSON.parse(stored) } catch { /* ignore */ }
  }
  // Fallback: read from authService's key (set by LoginPage)
  const localUser = authService.getUser()
  if (localUser) {
    // Normalize to User shape for AuthContext
    return {
      id: localUser.id,
      azureObjectId: '',
      email: localUser.email,
      displayName: localUser.displayName,
      role: (localUser.role as 'User' | 'Manager' | 'Admin') || 'User',
      isActive: true,
      createdAt: new Date().toISOString(),
      department: localUser.department,
      jobTitle: localUser.jobTitle,
      username: localUser.username,
      firstName: localUser.firstName,
      lastName: localUser.lastName,
      tenantCode: localUser.tenantCode,
      tenantName: localUser.tenantName,
      profilePictureUrl: localUser.profilePictureUrl,
    } as User & Record<string, unknown> as User
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUserFromStorage)
  // User & org state are loaded synchronously from storage in useState —
  // no async work needed, so start with isLoading = false to avoid a
  // flash of the FunLoader before the real page renders.
  const [isLoading, setIsLoading] = useState(false)
  const [orgCode, setOrgCode] = useState<string | null>(getStoredOrgCode)
  const [orgInfo, setOrgInfoState] = useState<TenantInfo | null>(getStoredOrgInfo)
  // Session state
  const [isSessionExpired, setIsSessionExpired] = useState(false)
  const [isAccessDenied, setIsAccessDenied] = useState(false)
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null)

  const isAuthenticated = !!user
  const userRole = user?.role?.toLowerCase()
  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'manager' || userRole === 'admin'
  const isGuest = !isAuthenticated && !!orgCode
  const hasOrgAccess = isAuthenticated || !!orgCode

  useEffect(() => {
    const userData = loadUserFromStorage()
    if (userData) {
      setUser(userData)
      // Sync to primary key
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData))
    }
    // Load org info
    setOrgCode(getStoredOrgCode())
    setOrgInfoState(getStoredOrgInfo())
    setIsLoading(false)
  }, [])

  // Listen for storage changes (e.g. LoginPage setting user)
  useEffect(() => {
    const handleStorage = () => {
      const userData = loadUserFromStorage()
      if (userData) {
        setUser(userData)
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData))
      }
      // Also update org info
      setOrgCode(getStoredOrgCode())
      setOrgInfoState(getStoredOrgInfo())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Listen for auth:unauthorized events (API returns 401)
  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('Session expired - showing modal')
      // Clear user state but keep org info so they can log back in
      setUser(null)
      sessionStorage.removeItem(AUTH_STORAGE_KEY)
      sessionStorage.removeItem('prodvista_auth_token')
      sessionStorage.removeItem('prodvista_auth_user')
      sessionStorage.removeItem('ProdVista_auth_token')
      sessionStorage.clear()
      authApi.clearToken()
      authService.logout()
      // Show session expired modal (no jarring redirect)
      setIsSessionExpired(true)
    }
    
    const handleForbidden = (event: CustomEvent) => {
      console.warn('Access denied - showing message')
      setAccessDeniedMessage(event.detail?.message || 'You do not have permission to access this resource.')
      setIsAccessDenied(true)
    }
    
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    window.addEventListener('auth:forbidden', handleForbidden as EventListener)
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
      window.removeEventListener('auth:forbidden', handleForbidden as EventListener)
    }
  }, [])

  /**
   * Login with email and display name
   */
  const login = useCallback(async (email: string, displayName: string): Promise<LoginResponse> => {
    setIsLoading(true)
    try {
      const response = await authApi.loginWithProfile({
        azureObjectId: `local-${email.replace(/[^a-z0-9]/gi, '-')}`,
        email,
        displayName,
        tenantId: 'local',
      })
      
      setUser(response.user)
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.user))
      return response
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Logout - clears all session data AND org info (full logout)
   */
  const logout = useCallback(() => {
    setUser(null)
    setOrgCode(null)
    setOrgInfoState(null)
    // Clear all auth-related session keys
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem('prodvista_auth_token')
    sessionStorage.removeItem('prodvista_auth_user')
    sessionStorage.removeItem('prodvista_auth_tenant')
    sessionStorage.removeItem('ProdVista_auth_token')
    // Clear UI preferences from localStorage
    localStorage.removeItem('ProdVista-azure-auth')
    localStorage.removeItem('ProdVista-user-role')
    localStorage.removeItem('ProdVista-user-id')
    localStorage.removeItem('ProdVista-selected-template')
    localStorage.removeItem('ProdVista-custom-widgets')
    localStorage.removeItem('ProdVista-dashboard-store')
    localStorage.removeItem('selectedTemplate')
    localStorage.removeItem('isManager')
    // Clear org info
    clearOrgInfo()
    sessionStorage.clear()
    authApi.clearToken()
    authService.logout()
  }, [])

  /**
   * Logout but keep org code - user stays as guest viewing dashboard
   */
  const logoutToOrg = useCallback(() => {
    setUser(null)
    // Clear only auth-related session keys, keep org info
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem('prodvista_auth_token')
    sessionStorage.removeItem('prodvista_auth_user')
    sessionStorage.removeItem('prodvista_auth_tenant')
    sessionStorage.removeItem('ProdVista_auth_token')
    localStorage.removeItem('ProdVista-azure-auth')
    localStorage.removeItem('ProdVista-user-role')
    localStorage.removeItem('ProdVista-user-id')
    localStorage.removeItem('isManager')
    sessionStorage.clear()
    authApi.clearToken()
    authService.logout()
  }, [])

  /**
   * Exit org completely - clears org code and redirects to org entry
   */
  const exitOrg = useCallback(() => {
    setUser(null)
    setOrgCode(null)
    setOrgInfoState(null)
    clearOrgInfo()
    // Clear all auth data
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem('prodvista_auth_token')
    sessionStorage.removeItem('prodvista_auth_user')
    sessionStorage.removeItem('prodvista_auth_tenant')
    sessionStorage.removeItem('ProdVista_auth_token')
    sessionStorage.clear()
    authApi.clearToken()
    authService.logout()
  }, [])

  /**
   * Set user from local auth (called by LoginPage after successful login)
   */
  const setUserFromLocal = useCallback((userData: User) => {
    setUser(userData)
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData))
  }, [])

  /**
   * Update org info in both React state and localStorage
   */
  const updateOrgInfo = useCallback((code: string, info: TenantInfo) => {
    setOrgInfo(code, info)
    setOrgCode(code)
    setOrgInfoState(info)
  }, [])

  /**
   * Refresh user data from backend
   */
  const refreshUser = useCallback(async () => {
    if (!user) return
    try {
      const users = await authApi.getUsers()
      const currentUser = users.find(u => u.id === user.id)
      if (currentUser) {
        setUser(currentUser)
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser))
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
    }
  }, [user])

  /**
   * Clear session expired state (called when user clicks "Log In Again")
   */
  const clearSessionExpired = useCallback(() => {
    setIsSessionExpired(false)
  }, [])

  /**
   * Clear access denied state
   */
  const clearAccessDenied = useCallback(() => {
    setIsAccessDenied(false)
    setAccessDeniedMessage(null)
  }, [])

  const providerValue = useMemo(() => ({
    user,
    isAuthenticated,
    isLoading,
    isManager,
    isAdmin,
    isGuest,
    orgCode,
    orgInfo,
    hasOrgAccess,
    // Session state
    isSessionExpired,
    isAccessDenied,
    accessDeniedMessage,
    clearSessionExpired,
    clearAccessDenied,
    login,
    logout,
    logoutToOrg,
    exitOrg,
    refreshUser,
    setUserFromLocal,
    updateOrgInfo,
  }), [user, isAuthenticated, isLoading, isManager, isAdmin, isGuest, orgCode, orgInfo, hasOrgAccess, isSessionExpired, isAccessDenied, accessDeniedMessage, clearSessionExpired, clearAccessDenied, login, logout, logoutToOrg, exitOrg, refreshUser, setUserFromLocal, updateOrgInfo]);

  return (
    <AuthContext.Provider value={providerValue}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
