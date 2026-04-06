import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { 
  Settings, Bell, LogOut, LogIn, User, ChevronDown, X, Building2,
  LayoutDashboard, Code2, Package, Bug, Server, Users, FileText, Cloud,
  PanelTop, UserCog, Cog, Shield, Home, Folder, BarChart3, Table, Gauge, 
  Activity, ScrollText, Globe, Image, Type, Rocket, ShieldCheck, Loader2
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'
import { useMenuStore, SideMenuItemDto, DashboardPageDto } from '../../store/menuStore'
import { AzureAuthButton } from '../AzureLoginPrompt'
import { getProfilePictureUrl, getInitials } from '../../utils/gravatar'

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Home, Folder, Settings, Users, Code2, Package, Bug, Server,
  FileText, Cloud, PanelTop, UserCog, Cog, Shield, BarChart3, Table, Gauge,
  Activity, ScrollText, Globe, Image, Type, Rocket, ShieldCheck,
}

function getIcon(iconName?: string): React.ComponentType<{ className?: string }> {
  if (!iconName) return LayoutDashboard
  return iconMap[iconName] || LayoutDashboard
}

export default function DynamicLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isManager, isGuest, isAuthenticated, orgInfo, logout, exitOrg } = useAuth()
  const { 
    menuItems, 
    pages, 
    isLoading, 
    loadNavigation,
    initializeMenuItems 
  } = useMenuStore()
  
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Load navigation on mount
  useEffect(() => {
    const tenantCode = orgInfo?.code || 'default'
    const userRole = isManager ? 'manager' : isGuest ? undefined : user?.role
    loadNavigation(tenantCode, userRole)
  }, [orgInfo, isManager, isGuest, user?.role, loadNavigation])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/org')
  }

  const handleInitializeMenu = async () => {
    setIsInitializing(true)
    await initializeMenuItems()
    setIsInitializing(false)
  }

  const userInitial = getInitials(user?.displayName || user?.email || '')
  const profilePicUrl = getProfilePictureUrl({
    profilePictureUrl: (user as any)?.profilePictureUrl,
    email: user?.email,
    displayName: user?.displayName,
    size: 80
  })

  // Determine current path
  const currentPath = location.pathname

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col">
        <div className="flex items-center h-16 px-4 border-b border-slate-800">
          <img src={`${import.meta.env.VITE_BASE_PATH || ''}/logo.svg`} alt="ProdVista" className="w-10 h-10 mr-3" />
          <div>
            <h1 className="text-lg font-bold">
              <span className="text-purple-400">Prod</span><span className="text-blue-400">Vista</span>
            </h1>
            <p className="text-[10px] text-slate-400 -mt-0.5">{orgInfo?.name || 'Engineering Command Center'}</p>
          </div>
        </div>
        
        {/* Role Badge */}
        {isManager && (
          <div className="mx-3 mt-3 px-3 py-1.5 bg-purple-500/20 rounded-lg flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-purple-300">Manager Access</span>
          </div>
        )}

        {/* Guest/Organization Badge */}
        {isGuest && orgInfo && (
          <div className="mx-3 mt-3 px-3 py-1.5 bg-blue-500/20 rounded-lg flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-blue-300 truncate">{orgInfo.name}</span>
          </div>
        )}

        {/* Dynamic Navigation */}
        <nav className="mt-6 px-3 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : menuItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm mb-3">No menu items configured</p>
              {isManager && (
                <button
                  onClick={handleInitializeMenu}
                  disabled={isInitializing}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {isInitializing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    'Initialize Menu'
                  )}
                </button>
              )}
            </div>
          ) : (
            menuItems.map((item: SideMenuItemDto) => {
              // Find the associated page
              const page = item.linkedTemplateId 
                ? pages.find((p: DashboardPageDto) => p.id === item.linkedTemplateId)
                : pages.find((p: DashboardPageDto) => `/p/${p.slug}` === item.href)
              
              const Icon = getIcon(item.icon)
              const isActive = currentPath === item.href || 
                (page && currentPath === `/p/${page.slug}`) ||
                (currentPath === '/dashboard' && item.href === '/p/overview')
              
              return (
                <NavLink
                  key={item.id}
                  to={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              )
            })
          )}
          
          {/* Manager-only: Page Builder & Menu Manager */}
          {isManager && (
            <>
              <div className="my-3 border-t border-slate-700" />
              <p className="px-3 py-1 text-xs text-slate-500 uppercase tracking-wider">Manager Tools</p>
              <NavLink
                to="/manage/pages"
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors',
                    isActive
                      ? 'bg-purple-600 text-white'
                      : 'text-purple-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <PanelTop className="w-5 h-5" />
                Page Builder
              </NavLink>
              <NavLink
                to="/manage/menu"
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors',
                    isActive
                      ? 'bg-purple-600 text-white'
                      : 'text-purple-300 hover:bg-slate-800 hover:text-white'
                  )
                }
              >
                <Settings className="w-5 h-5" />
                Menu Manager
              </NavLink>
            </>
          )}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 space-y-2 border-t border-slate-800">
          {/* For guests, show login button */}
          {isGuest && (
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-blue-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogIn className="w-5 h-5" />
              Manager Login
            </button>
          )}
          
          {/* Switch Organization button */}
          <button
            onClick={() => { exitOrg(); navigate('/org') }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Building2 className="w-5 h-5" />
            Switch Organization
          </button>
          
          {/* For authenticated users, show logout */}
          {isAuthenticated && !isGuest && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="pl-64">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {orgInfo?.name || 'ProdVista'}
          </h2>
          <div className="flex items-center gap-3">
            {/* Show Login button for guests */}
            {isGuest && (
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <LogIn className="w-4 h-4" />
                Manager Login
              </button>
            )}
            
            {isAuthenticated && !isGuest && <AzureAuthButton />}

            {/* Notifications - only for authenticated */}
            {isAuthenticated && !isGuest && (
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false) }}
                  className="relative p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                >
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                      <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No new notifications
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profile Dropdown */}
            {isAuthenticated && !isGuest && (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false) }}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <img
                    src={profilePicUrl}
                    alt={user?.displayName || 'User'}
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                  <div className="w-8 h-8 rounded-full bg-primary-500 hidden items-center justify-center text-white font-medium text-sm">
                    {userInitial}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-700 leading-tight">
                      {user?.displayName || 'User'}
                    </p>
                    <p className="text-xs text-gray-400 leading-tight">
                      {(user as any)?.tenantName || user?.role || ''}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <img
                          src={profilePicUrl}
                          alt={user?.displayName || 'User'}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                        <div className="w-10 h-10 rounded-full bg-primary-500 hidden items-center justify-center text-white font-bold">
                          {userInitial}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{user?.displayName || 'User'}</p>
                          <p className="text-xs text-gray-500">{user?.email || ''}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                            {user?.role || 'User'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => { setShowProfileMenu(false); navigate('/settings') }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        My Profile
                      </button>
                      <button
                        onClick={() => { setShowProfileMenu(false); navigate('/settings') }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Settings className="w-4 h-4 text-gray-400" />
                        Settings
                      </button>
                    </div>

                    <div className="border-t border-gray-100 pt-1">
                      <button
                        onClick={() => { setShowProfileMenu(false); handleLogout() }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
