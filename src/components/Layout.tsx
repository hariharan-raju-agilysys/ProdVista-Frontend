import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
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
  ChevronRight,
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
  GitBranch,
  CalendarDays,
  Clock,
  Layers,
  ListFilter,
  BarChart3,
  Globe,
  TrendingUp,
  BookOpen,
  Trophy,
  MessageSquare,
  Share2,
  Lightbulb,
  Radio,
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
import { getTodayNotifications, markAsRead, markAllAsRead, dismissNotification, getUnreadCount, type UserNotification } from '../services/notificationService'

// ── Team Updates data (extend with API calls to getKnowledgeShares later)
const TEAM_UPDATES = [
  { id: 1, type: 'knowledge', icon: <Lightbulb className="w-4 h-4 text-amber-500" />, title: 'Shift4 ZIP code race condition fix', author: 'Hariharan', time: '1h ago', body: 'Always include ZIP for external gift card methods. See PaymentBusinessLogicHandler line 1372.' },
  { id: 2, type: 'share', icon: <Share2 className="w-4 h-4 text-blue-500" />, title: 'New API pattern: Refit async variants', author: 'Deepika', time: '3h ago', body: 'Use *ServiceAsync variants everywhere. Never mix sync/async patterns in the payment flow.' },
  { id: 3, type: 'update', icon: <Radio className="w-4 h-4 text-green-500" />, title: 'Release 26.2.0.92 deployed to AKS', author: 'Pipeline', time: '4h ago', body: 'Tools-Activities-API-CICD build #92 deployed successfully to agys-v1 namespace.' },
  { id: 4, type: 'knowledge', icon: <Lightbulb className="w-4 h-4 text-amber-500" />, title: 'EF Core global query filter tip', author: 'Ravi', time: '6h ago', body: 'All TenantAwareEntity queries are auto-filtered. No need to add .Where(e => e.TenantId == id).' },
  { id: 5, type: 'share', icon: <Share2 className="w-4 h-4 text-blue-500" />, title: 'PR Review: Folio payment null ref fix', author: 'Srinidhi', time: 'Yesterday', body: 'Added null guard on response.Result.Items before .First(). PR #344 — please review.' },
]

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
  const { menuItems, loadNavigation } = useMenuStore()
  const { features, loadFeatures } = useFeatureStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showTeamUpdates, setShowTeamUpdates] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['releases', 'quality', 'engineering', 'customers']))

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Enterprise light nav item
  const navItem = (to: string, icon: React.ReactNode, label: string, badge?: string) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all group',
          isActive
            ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-l-2 border-transparent'
        )
      }
    >
      <span className="flex-shrink-0 opacity-80 group-hover:opacity-100">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold shrink-0 uppercase tracking-wide">
          {badge}
        </span>
      )}
    </NavLink>
  )

  // ── Enterprise light nav group header
  const navGroup = (key: string, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => toggleGroup(key)}
      className="w-full flex items-center gap-2 px-2 py-2 mt-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors rounded-md hover:bg-gray-50"
    >
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className={clsx('w-3.5 h-3.5 transition-transform duration-200 text-gray-300', expandedGroups.has(key) && 'rotate-90')} />
    </button>
  )

  // Theme — light mode only (dark mode disabled)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  // Notification state
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifLoading, setNotifLoading] = useState(false)

  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const teamUpdatesRef = useRef<HTMLDivElement>(null)

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
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setShowProfileMenu(false)
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifications(false)
      if (teamUpdatesRef.current && !teamUpdatesRef.current.contains(event.target as Node)) setShowTeamUpdates(false)
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
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm",
        "transition-transform duration-300 ease-out will-change-transform",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center h-14 px-4 border-b border-gray-200 shrink-0 gap-3">
          <img src={`${import.meta.env.VITE_BASE_PATH || ''}/logo.svg`} alt="ProdVista" className="w-8 h-8" />
          <div>
            <h1 className="text-sm font-bold text-gray-900">
              <span className="text-blue-600">Prod</span><span className="text-indigo-600">Vista</span>
            </h1>
            <p className="text-[10px] text-gray-400 -mt-0.5 leading-tight">Engineering Command Center</p>
          </div>
        </div>
        
        {/* Role Badge */}
        {isManager && (
          <div className="mx-3 mt-2 px-3 py-1.5 bg-blue-50 rounded-lg flex items-center gap-2 shrink-0">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-blue-700">Manager Access</span>
          </div>
        )}

        {/* Guest/Organization Badge */}
        {isGuest && orgInfo && (
          <div className="mx-3 mt-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-600 truncate">{orgInfo.name}</span>
          </div>
        )}
        

        {/* Quick Search Bar in Sidebar */}
        <div className="mx-3 mt-3 shrink-0">
          <button
            onClick={openCommandPalette}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-all text-sm"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left text-xs">Search...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-200 text-gray-400 rounded font-mono">Ctrl+K</kbd>
          </button>
        </div>

        {/* Scrollable nav section */}
        <nav className="mt-2 px-3 flex-1 overflow-y-auto min-h-0 pb-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>

          {/* Home */}
          {navItem('/', <Rocket className="w-4 h-4" />, 'Home')}

          {/* --- Release Intelligence --- */}
          {navGroup('releases', 'Release', <Layers className="w-3.5 h-3.5" />)}
          {expandedGroups.has('releases') && (
            <div className="pl-1 space-y-0.5 mb-1">
              {navItem('/releases', <Package className="w-4 h-4" />, 'Releases')}
              {navItem('/release-status', <TrendingUp className="w-4 h-4" />, 'Release Status', 'New')}
              {navItem('/work-items-by-release', <ListFilter className="w-4 h-4" />, 'Work Items by Release', 'New')}
              {isManager && navItem('/release-branches', <GitBranch className="w-4 h-4" />, 'Branch Setup')}
            </div>
          )}

          {/* --- Quality Center --- */}
          {navGroup('quality', 'Quality', <ShieldCheck className="w-3.5 h-3.5" />)}
          {expandedGroups.has('quality') && (
            <div className="pl-1 space-y-0.5 mb-1">
              {navItem('/quality', <Bug className="w-4 h-4" />, 'Bug Command Center')}
              {navItem('/aging-work-items', <Clock className="w-4 h-4" />, 'Aging Work Items', 'New')}
              {navItem('/bug-analytics', <BarChart3 className="w-4 h-4" />, 'Bug Analytics')}
              {navItem('/quality-team', <Users className="w-4 h-4" />, 'Team View')}
            </div>
          )}

          {/* --- Engineering --- */}
          {navGroup('engineering', 'Engineering', <Code2 className="w-3.5 h-3.5" />)}
          {expandedGroups.has('engineering') && (
            <div className="pl-1 space-y-0.5 mb-1">
              {navItem('/engineering', <Code2 className="w-4 h-4" />, 'Engineering')}
              {navItem('/pull-requests', <GitBranch className="w-4 h-4" />, 'Pull Requests')}
              {navItem('/devops-overview', <Workflow className="w-4 h-4" />, 'DevOps Overview')}
              {navItem('/observability', <Activity className="w-4 h-4" />, 'Observability')}
              {features.enableJenkins && navItem('/jenkins', <Zap className="w-4 h-4" />, 'Jenkins')}
            </div>
          )}

          {/* --- Customers --- */}
          {navGroup('customers', 'Customers', <Globe className="w-3.5 h-3.5" />)}
          {expandedGroups.has('customers') && (
            <div className="pl-1 space-y-0.5 mb-1">
              {navItem('/upcoming-go-lives', <CalendarDays className="w-4 h-4" />, 'Upcoming Go Lives', 'New')}
              {navItem('/customers', <Users className="w-4 h-4" />, 'Customer Dashboard')}
              {navItem('/knowledge-center', <BookOpen className="w-4 h-4" />, 'Knowledge Center', 'New')}
              {navItem('/career-milestones', <Trophy className="w-4 h-4" />, 'Career Milestones', 'New')}
            </div>
          )}

          {/* --- AI Intelligence --- */}
          {features.enableAI && (
            <>
              {navGroup('ai', 'AI Intelligence', <Bot className="w-3.5 h-3.5" />)}
              {expandedGroups.has('ai') && (
                <div className="pl-1 space-y-0.5 mb-1">
                  {navItem('/ai-chat', <Bot className="w-4 h-4" />, 'AI Chat')}
                  {navItem('/ai-query', <Search className="w-4 h-4" />, 'Smart Query')}
                </div>
              )}
            </>
          )}

          {/* --- Azure & Observability --- */}
          {navGroup('azure', 'Azure & Cloud', <Cloud className="w-3.5 h-3.5" />)}
          {expandedGroups.has('azure') && (
            <div className="pl-1 space-y-0.5 mb-1">
              {navItem('/azure', <Cloud className="w-4 h-4" />, 'Azure Cloud')}
              {navItem('/observability-query', <FileText className="w-4 h-4" />, 'KQL Query')}
              {navItem('/logs', <FileText className="w-4 h-4" />, 'Logs & Traces')}
            </div>
          )}

          {/* --- Tools & Admin --- */}
          {navGroup('admin', 'Tools & Admin', <Cog className="w-3.5 h-3.5" />)}
          {expandedGroups.has('admin') && (
            <div className="pl-1 space-y-0.5 mb-1">
              {navItem('/tools', <Zap className="w-4 h-4" />, 'Tools Hub')}
              {navItem('/mcp-tools', <Cog className="w-4 h-4" />, 'MCP Tools')}
              {navItem('/automation', <Workflow className="w-4 h-4" />, 'Automation')}
              {isManager && navItem('/settings', <Settings className="w-4 h-4" />, 'Settings')}
              {isManager && navItem('/tenant-admin', <Shield className="w-4 h-4" />, 'Tenant Admin')}
              {isManager && navItem('/users', <UserCog className="w-4 h-4" />, 'Users')}
              {isManager && navItem('/menu-management', <PanelTop className="w-4 h-4" />, 'Menu Setup')}
            </div>
          )}

          {/* Custom dynamic pages (from DB) */}
          {menuItems.filter(m => m.href.startsWith('/p/')).length > 0 && (
            <>
              {navGroup('custom', 'Custom Pages', <PanelTop className="w-3.5 h-3.5" />)}
              {expandedGroups.has('custom') && (
                <div className="pl-1 space-y-0.5 mb-1">
                  {menuItems
                    .filter(m => m.href.startsWith('/p/'))
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map(item => {
                      const Icon = getIcon(item.icon)
                      return navItem(item.href, <Icon className="w-4 h-4" />, item.name)
                    })}
                </div>
              )}
            </>
          )}

        </nav>

        {/* Bottom Actions — clean, minimal */}
        <div className="shrink-0 px-2 py-2 space-y-0.5 border-t border-gray-100">
          {isGuest && (
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Manager Login
            </button>
          )}
          <button
            onClick={() => { exitOrg(); navigate('/org') }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Building2 className="w-4 h-4 text-gray-400" />
            Switch Organization
          </button>
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 truncate leading-tight">
                {location.pathname === '/' ? 'Developer Home' :
                 location.pathname.startsWith('/quality') ? 'Bug Command Center' :
                 location.pathname.startsWith('/engineering') ? 'Engineering' :
                 location.pathname.startsWith('/releases') ? 'Releases' :
                 location.pathname.startsWith('/customers') ? 'Customers' :
                 location.pathname.startsWith('/azure') ? 'Azure Cloud' :
                 location.pathname.startsWith('/ai-chat') ? 'AI Chat' :
                 location.pathname.startsWith('/ai-query') ? 'Smart Query' :
                 location.pathname.startsWith('/tools') ? 'Tools Hub' :
                 location.pathname.startsWith('/settings') ? 'Settings' :
                 location.pathname.startsWith('/users') ? 'User Management' :
                 location.pathname.startsWith('/pull-requests') ? 'Pull Requests' :
                 location.pathname.startsWith('/jenkins') ? 'Jenkins CI/CD' :
                 location.pathname.startsWith('/observability') ? 'Observability' :
                 location.pathname.startsWith('/release-notes') ? 'Release Notes' :
                 location.pathname.startsWith('/knowledge-center') ? 'Knowledge Center' :
                 location.pathname.startsWith('/career-milestones') ? 'Career Milestones' :
                 location.pathname.startsWith('/upcoming-go-lives') ? 'Upcoming Go-Lives' :
                 location.pathname.startsWith('/bug-analytics') ? 'Bug Analytics' :
                 location.pathname.startsWith('/devops') ? 'DevOps Overview' :
                 (orgInfo?.name || 'ProdVista')}
              </h2>
              {orgInfo?.name && (
                <p className="text-[10px] text-gray-400 leading-tight">{orgInfo.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Quick Search Button in Header */}
            <button
              onClick={openCommandPalette}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="text-xs text-gray-400">Search...</span>
              <kbd className="px-1 py-0.5 text-[10px] bg-white border border-gray-200 rounded text-gray-400 font-mono">Ctrl+K</kbd>
            </button>
            {/* Show Login button for guests */}
            {isGuest && (
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-semibold"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login
              </button>
            )}
            
            {isAuthenticated && <AzureStatusIndicator />}

            {/* Team Updates button — knowledge shares + group chat */}
            {isAuthenticated && (
              <div className="relative" ref={teamUpdatesRef}>
                <button
                  onClick={() => { setShowTeamUpdates(!showTeamUpdates); setShowNotifications(false); setShowProfileMenu(false) }}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border',
                    showTeamUpdates
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                  )}
                  title="Team Updates"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Team Updates</span>
                  <span className="w-4 h-4 flex items-center justify-center bg-blue-600 text-white text-[9px] font-bold rounded-full ml-0.5">5</span>
                </button>
                {showTeamUpdates && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-[520px] flex flex-col">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Team Updates</h3>
                        <p className="text-[11px] text-gray-400">Latest knowledge & team activity</p>
                      </div>
                      <button onClick={() => setShowTeamUpdates(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
                      {TEAM_UPDATES.map(update => (
                        <div key={update.id} className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 shrink-0">{update.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-gray-900 truncate">{update.title}</p>
                                <span className="text-[11px] text-gray-400 whitespace-nowrap">{update.time}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{update.body}</p>
                              <p className="text-[11px] text-gray-400 mt-1">by {update.author}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-xl">
                      <button
                        onClick={() => { setShowTeamUpdates(false); navigate('/knowledge-center') }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Knowledge Center →
                      </button>
                      <button
                        onClick={() => { setShowTeamUpdates(false); navigate('/ai-chat') }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Open AI Chat →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notifications Dropdown - only show for authenticated users */}
            {isAuthenticated && (
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); setShowTeamUpdates(false) }}
                className="relative p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
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

            {/* Profile Dropdown - only for authenticated users */}
            {isAuthenticated && (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); setShowTeamUpdates(false) }}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all duration-200"
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
                      <div className="text-lg font-bold text-blue-600">12</div>
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

                  {/* Theme toggle removed — light mode only */}

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
                      ProdVista v2.0 · <span className="text-blue-500">What's new?</span>
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
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <Outlet />
          </Suspense>
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
