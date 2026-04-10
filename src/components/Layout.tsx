import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  LayoutDashboard, 
  Code2, 
  Package, 
  Bug, 
  Server, 
  Users,
  Settings,
  Bell,
  LogOut,
  LogIn,
  Shield,
  FileText,
  Cog,
  UserCog,
  Cloud,
  Workflow,
  User,
  ChevronDown,
  PanelTop,
  X,
  Building2,
  Loader2,
  Rocket,
  ShieldCheck,
  Activity,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Moon,
  Sun,
  Monitor,
  Keyboard,
  Zap,
  Crown,
  Bot,
  Menu,
  Search,
  UserCheck,
  AlertTriangle,
  Info,
  XCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { useMenuStore } from '../store/menuStore'
import { useFeatureStore } from '../store/featureStore'
import { AzureStatusIndicator } from './AzureStatusIndicator'
import { getProfilePictureUrl, getInitials } from '../utils/gravatar'
import CommandPalette from './CommandPalette'
import FloatingAIButton from './FloatingAIButton'
import PersistentChatWidget from './PersistentChatWidget'
import FunLoader from './FunLoader'
import { getTodayNotifications, markAsRead, markAllAsRead, dismissNotification, getUnreadCount, type UserNotification } from '../services/notificationService'
import { useSettingsStore } from '../store/settingsStore'
import { authService } from '../services/authService'

// Icon mapping for dynamic icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Code2, Package, Bug, Server, Users, FileText, Cloud,
  PanelTop, UserCog, Cog, Shield, Rocket, ShieldCheck, Workflow, UserCheck, Zap,
}

function getIcon(iconName?: string): React.ComponentType<{ className?: string }> {
  if (!iconName) return LayoutDashboard
  return iconMap[iconName] || LayoutDashboard
}

export default function Layout() {
  const { user, isManager, isGuest, isAuthenticated, orgInfo, logout, exitOrg } = useAuth()
  const { menuItems, isLoading, loadNavigation, initializeMenuItems } = useMenuStore()
  const { features, loadFeatures } = useFeatureStore()
  const navigate = useNavigate()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Theme
  const { settings, updateSettings } = useSettingsStore()
  const currentTheme = settings.theme

  const handleThemeChange = useCallback((theme: 'light' | 'dark' | 'system') => {
    updateSettings({ theme })
    // Persist to backend (fire-and-forget)
    authService.updateProfile({ theme }).catch(() => {})
  }, [updateSettings])

  // Apply dark mode class to <html> based on theme preference
  useEffect(() => {
    const root = document.documentElement
    if (currentTheme === 'dark') {
      root.classList.add('dark')
    } else if (currentTheme === 'light') {
      root.classList.remove('dark')
    } else {
      // system: follow OS preference
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => mq.matches ? root.classList.add('dark') : root.classList.remove('dark')
      apply()
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [currentTheme])

  // Notification state
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifLoading, setNotifLoading] = useState(false)

  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Load navigation from API on mount
  useEffect(() => {
    const tenantCode = orgInfo?.code || 'default'
    const userRole = isManager ? 'manager' : isGuest ? undefined : user?.role
    loadNavigation(tenantCode, userRole)
    loadFeatures()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgInfo?.code, isManager, isGuest, user?.role])

  // Global keyboard shortcuts
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      // Ctrl+K or Cmd+K — open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(prev => !prev)
      }
      // Ctrl+Shift+A — go to AI Chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        navigate('/ai-chat')
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [navigate])

  const openCommandPalette = useCallback(() => setShowCommandPalette(true), [])

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

  // Fetch unread badge count on mount + poll every 30s
  useEffect(() => {
    if (!isAuthenticated) return
    const fetchCount = () => getUnreadCount().then(setUnreadCount).catch(() => {})
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Fetch today's notifications when dropdown opens
  useEffect(() => {
    if (!showNotifications || !isAuthenticated) return
    setNotifLoading(true)
    getTodayNotifications()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setNotifLoading(false))
  }, [showNotifications, isAuthenticated])

  const handleMarkRead = async (notificationId: string) => {
    await markAsRead(notificationId)
    setNotifications(prev => prev.map(n => n.notificationId === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })))
    setUnreadCount(0)
  }

  const handleDismiss = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await dismissNotification(notificationId)
    setNotifications(prev => prev.filter(n => n.notificationId !== notificationId))
  }

  const notifIcon = (type: string) => {
    switch (type) {
      case 'Warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'Error': return <XCircle className="w-4 h-4 text-red-500" />
      case 'Success': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'Action': return <Zap className="w-4 h-4 text-orange-500" />
      default: return <Info className="w-4 h-4 text-blue-500" />
    }
  }


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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col",
        "transition-transform duration-300 ease-out will-change-transform",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center h-16 px-4 border-b border-slate-800 shrink-0">
          <img src={`${import.meta.env.VITE_BASE_PATH || ''}/logo.svg`} alt="ProdVista" className="w-10 h-10 mr-3" />
          <div>
            <h1 className="text-lg font-bold">
              <span className="text-purple-400">Prod</span><span className="text-blue-400">Vista</span>
            </h1>
            <p className="text-[10px] text-slate-400 -mt-0.5">Engineering Command Center</p>
          </div>
        </div>
        
        {/* Role Badge */}
        {isManager && (
          <div className="mx-3 mt-3 px-3 py-1.5 bg-purple-500/20 rounded-lg flex items-center gap-2 shrink-0">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-purple-300">Manager Access</span>
          </div>
        )}

        {/* Guest/Organization Badge */}
        {isGuest && orgInfo && (
          <div className="mx-3 mt-3 px-3 py-1.5 bg-blue-500/20 rounded-lg flex items-center gap-2 shrink-0">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-blue-300 truncate">{orgInfo.name}</span>
          </div>
        )}
        

        {/* Quick Search Bar in Sidebar */}
        <div className="mx-3 mt-3 shrink-0">
          <button
            onClick={openCommandPalette}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition-all text-sm"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left text-xs">Search...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-400 rounded font-mono">Ctrl+K</kbd>
          </button>
        </div>

        {/* Scrollable nav section */}
        <nav className="mt-3 px-3 flex-1 overflow-y-auto min-h-0 pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent hover:scrollbar-thumb-slate-600">
          {isLoading ? (
            <FunLoader inline className="py-8 justify-center w-full flex" />
          ) : menuItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm mb-3">No menu items</p>
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
            (() => {
              // Show only these items in this specific order
              const visibleItems = ['Overview', 'Quality', 'Customers']
              return menuItems
                .filter((item) => visibleItems.includes(item.name))
                .sort((a, b) => visibleItems.indexOf(a.name) - visibleItems.indexOf(b.name))
                .map((item) => {
                  const Icon = getIcon(item.icon)
                  return (
                    <NavLink
                      key={item.id}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors',
                          isActive
                            ? 'bg-primary-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        )
                      }
                    >
                      <Icon className="w-5 h-5" />
                      {item.name}
                    </NavLink>
                  )
                })
            })()
          )}
        </nav>

        {/* Bottom Actions - properly sized with flex */}
        <div className="shrink-0 px-3 py-2 space-y-1 border-t border-slate-800 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          
          {/* Overview — prominent standalone link */}
          <NavLink
            to="/"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1',
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-indigo-300 hover:text-indigo-200 hover:bg-slate-800 border border-slate-700'
              )
            }
          >
            <Rocket className="w-4 h-4" />
            Overview
            <span className="ml-auto text-[8px] font-bold uppercase tracking-wider opacity-70">Hub</span>
          </NavLink>

          {/* AI Assistant — quick access if enabled */}
          {features.enableAI && (
            <NavLink
              to="/ai-chat"
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20'
                    : 'text-violet-300 hover:text-violet-200 hover:bg-slate-800'
                )
              }
            >
              <Bot className="w-4 h-4" />
              AI Assistant
              <kbd className="ml-auto px-1.5 py-0.5 text-[9px] bg-slate-700 text-slate-400 rounded font-mono">Ctrl+Shift+A</kbd>
            </NavLink>
          )}

          {/* Tools Hub — single entry point for all tools */}
          <NavLink
            to="/tools"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-cyan-300 hover:text-cyan-200 hover:bg-slate-800 border border-slate-700'
              )
            }
          >
            <Zap className="w-4 h-4" />
            Tools
            <span className="ml-auto text-[8px] font-bold uppercase tracking-wider opacity-70">All</span>
          </NavLink>

          {/* Separator */}
          <div className="border-t border-slate-800 my-1" />
          
          {/* For guests, show login button */}
          {isGuest && (
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Manager Login
            </button>
          )}
          
          {/* Switch Organization button */}
          <button
            onClick={() => { exitOrg(); navigate('/org') }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Switch Organization
          </button>
          
          {/* For authenticated users, show logout */}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 truncate">
              {orgInfo?.name || 'ProdVista'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Search Button in Header */}
            <button
              onClick={openCommandPalette}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 hover:text-gray-600 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="text-xs">Search...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-200 rounded text-gray-400 font-mono">Ctrl+K</kbd>
            </button>
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
            
            {isAuthenticated && <AzureStatusIndicator />}

            {/* Notifications Dropdown - only show for authenticated users */}
            {isAuthenticated && (
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false) }}
                className="relative p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[480px] flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-800">Today's Notifications</h3>
                    <div className="flex items-center gap-2">
                      {notifications.some(n => !n.isRead) && (
                        <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifLoading ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">
                        <Loader2 className="w-6 h-6 mx-auto mb-2 text-gray-300 animate-spin" />
                        Loading...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        No notifications today
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => { if (!notif.isRead) handleMarkRead(notif.notificationId); if (notif.actionUrl) navigate(notif.actionUrl) }}
                          className={clsx(
                            'px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors group',
                            !notif.isRead && 'bg-blue-50/50'
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex-shrink-0">{notifIcon(notif.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className={clsx('text-sm truncate', !notif.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700')}>
                                  {notif.title}
                                </p>
                                <button
                                  onClick={(e) => handleDismiss(notif.notificationId, e)}
                                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-400">{notif.senderDisplayName}</span>
                                <span className="text-[10px] text-gray-400">
                                  {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {notif.category && (
                                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{notif.category}</span>
                                )}
                              </div>
                            </div>
                            {!notif.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-100 text-center">
                      <button onClick={() => { setShowNotifications(false); navigate('/notifications') }} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        View all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Settings - only for authenticated users */}
            {isAuthenticated && (
            <button 
              onClick={() => navigate('/settings')}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
            >
              <Settings className="w-5 h-5" />
            </button>
            )}

            {/* Profile Dropdown - only for authenticated users */}
            {isAuthenticated && (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false) }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100 transition-all duration-200 border border-transparent hover:border-gray-200"
              >
                <div className="relative">
                  <img
                    src={profilePicUrl}
                    alt={user?.displayName || 'User'}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-offset-2 ring-primary-400"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 hidden items-center justify-center text-white font-semibold text-sm ring-2 ring-offset-2 ring-primary-400">
                    {userInitial}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-gray-800 leading-tight">
                    {user?.displayName || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 leading-tight flex items-center gap-1">
                    {isManager && <Crown className="w-3 h-3 text-amber-500" />}
                    {(user as any)?.tenantName || user?.role || 'Member'}
                  </p>
                </div>
                <ChevronDown className={clsx(
                  "w-4 h-4 text-gray-400 hidden sm:block transition-transform duration-200",
                  showProfileMenu && "rotate-180"
                )} />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Profile Header with Gradient */}
                  <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-primary-500 via-primary-600 to-purple-600">
                    <div className="absolute inset-0 bg-black/10"></div>
                    <div className="relative flex items-start gap-4">
                      <div className="relative">
                        <img
                          src={profilePicUrl}
                          alt={user?.displayName || 'User'}
                          className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white/30 shadow-lg"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur hidden items-center justify-center text-white font-bold text-xl ring-4 ring-white/30 shadow-lg">
                          {userInitial}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 border-2 border-white rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">{user?.displayName || 'User'}</h3>
                        <p className="text-sm text-white/80 truncate">{user?.email || ''}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={clsx(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full",
                            isManager 
                              ? "bg-amber-400/90 text-amber-900"
                              : "bg-white/20 text-white backdrop-blur"
                          )}>
                            {isManager ? <Crown className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {user?.role || 'Member'}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-400/80 text-green-900 rounded-full">
                            <Zap className="w-3 h-3" />
                            Online
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-0.5 p-1 bg-gray-50 border-b border-gray-100">
                    <div className="bg-white rounded-xl p-3 text-center">
                      <div className="text-lg font-bold text-primary-600">12</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">Dashboards</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center">
                      <div className="text-lg font-bold text-green-600">98%</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">Uptime</div>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center">
                      <div className="text-lg font-bold text-purple-600">24</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">Widgets</div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <Activity className="w-3 h-3" />
                      <span className="font-medium uppercase tracking-wide">Recent Activity</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        <span className="flex-1 text-gray-600">Logged in from Windows</span>
                        <span className="text-gray-400">Just now</span>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs transition-colors">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span className="flex-1 text-gray-600">Updated dashboard widgets</span>
                        <span className="text-gray-400">2h ago</span>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="p-2">
                    <button
                      onClick={() => { setShowProfileMenu(false); navigate('/settings') }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">My Profile</div>
                        <div className="text-xs text-gray-400">View and edit profile</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                    </button>
                    
                    <button
                      onClick={() => { setShowProfileMenu(false); navigate('/settings') }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                        <Settings className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Settings</div>
                        <div className="text-xs text-gray-400">Preferences & security</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
                    </button>

                    {isManager && (
                      <button
                        onClick={() => { setShowProfileMenu(false); navigate('/dashboard') }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                          <PanelTop className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium flex items-center gap-2">
                            Dashboard Builder
                            <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded font-semibold">PRO</span>
                          </div>
                          <div className="text-xs text-gray-400">Design custom layouts</div>
                        </div>
                      </button>
                    )}

                    <button
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                        <Keyboard className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Keyboard Shortcuts</div>
                        <div className="text-xs text-gray-400">Learn quick actions</div>
                      </div>
                      <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded font-mono">?</kbd>
                    </button>

                    <button
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                        <HelpCircle className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Help & Support</div>
                        <div className="text-xs text-gray-400">Documentation & FAQ</div>
                      </div>
                    </button>
                  </div>

                  {/* Theme Switcher */}
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium">APPEARANCE</span>
                      <div className="flex items-center gap-1 p-1 bg-gray-200 rounded-lg">
                        <button
                          onClick={() => handleThemeChange('light')}
                          className={`p-1.5 rounded-md transition-all ${currentTheme === 'light' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                          title="Light"
                        >
                          <Sun className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleThemeChange('dark')}
                          className={`p-1.5 rounded-md transition-all ${currentTheme === 'dark' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                          title="Dark"
                        >
                          <Moon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleThemeChange('system')}
                          className={`p-1.5 rounded-md transition-all ${currentTheme === 'system' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                          title="System"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Logout */}
                  <div className="p-2 border-t border-gray-100">
                    <button
                      onClick={() => { setShowProfileMenu(false); handleLogout() }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-[10px] text-gray-400">
                      ProdVista v2.0 · <span className="text-primary-500">What's new?</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* Floating AI Toolbox Button */}
      <FloatingAIButton onOpenCommandPalette={openCommandPalette} />

      {/* Persistent Chat Widget - stays across page navigation */}
      <PersistentChatWidget />
    </div>
  )
}
