import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, ArrowRight, LayoutDashboard, Code2, Package, Server, Users,
  Settings, FileText, Cloud, Workflow, Bot, Database, Activity, Zap, Shield,
  Rocket, BarChart3, Eye, Terminal, Sparkles, Clock, Command, Wrench,
  GitPullRequest, Lock, UserCog, Palette, Bell, Key,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'

// All navigable pages
interface CommandItem {
  id: string
  label: string
  description: string
  icon: LucideIcon
  path: string
  category: 'navigation' | 'ai' | 'tools' | 'admin' | 'developer'
  keywords: string[]
  shortcut?: string
  requiredRole?: 'manager' | 'admin' // Only show to users with this role
}

const allCommands: CommandItem[] = [
  // Navigation
  { id: 'home', label: 'Dashboard', description: 'Main overview dashboard', icon: LayoutDashboard, path: '/', category: 'navigation', keywords: ['home', 'overview', 'main', 'kpi'] },
  { id: 'engineering', label: 'Engineering', description: 'Engineering metrics & velocity', icon: Code2, path: '/engineering', category: 'navigation', keywords: ['dev', 'code', 'velocity', 'sprint'] },
  { id: 'releases', label: 'Releases', description: 'Release management', icon: Package, path: '/releases', category: 'navigation', keywords: ['deploy', 'version', 'ship'] },
  { id: 'quality', label: 'Quality', description: 'Quality & testing dashboard', icon: Shield, path: '/quality', category: 'navigation', keywords: ['test', 'bugs', 'coverage'] },
  { id: 'production', label: 'Production', description: 'Production monitoring', icon: Server, path: '/production', category: 'navigation', keywords: ['prod', 'live', 'monitor'] },
  { id: 'customers', label: 'Customers', description: 'Customer analytics', icon: Users, path: '/customers', category: 'navigation', keywords: ['client', 'user', 'crm'] },
  { id: 'logs', label: 'Logs', description: 'System logs explorer', icon: Terminal, path: '/logs', category: 'navigation', keywords: ['log', 'trace', 'debug'] },

  // Developer Tools (NEW CATEGORY)
  { id: 'developer-toolkit', label: 'Developer Toolkit', description: 'Your personal dev dashboard: PRs, commits, work items', icon: Wrench, path: '/developer-toolkit', category: 'developer', keywords: ['dev', 'my', 'work', 'pr', 'commit', 'personal'], shortcut: 'Ctrl+Shift+D' },
  { id: 'devops-overview', label: 'DevOps Overview', description: 'Azure DevOps work items & PRs', icon: GitPullRequest, path: '/devops', category: 'developer', keywords: ['devops', 'azure', 'work', 'item', 'pr'] },

  // AI Tools  
  { id: 'ai-chat', label: 'AI Assistant', description: 'Chat with AI assistant', icon: Bot, path: '/ai-chat', category: 'ai', keywords: ['chat', 'ask', 'help', 'gpt'], shortcut: 'Ctrl+Shift+A' },
  { id: 'ai-query', label: 'AI Query', description: 'Natural language to SQL', icon: Database, path: '/ai-query', category: 'ai', keywords: ['sql', 'query', 'data', 'nlq'] },

  // Tools
  { id: 'tools', label: 'Tools', description: 'All engineering tools in one place', icon: Zap, path: '/tools', category: 'tools', keywords: ['tools', 'utilities', 'all'] },
  { id: 'command-center', label: 'Command Center', description: 'App Insights & observability', icon: Activity, path: '/command-center', category: 'tools', keywords: ['insights', 'azure', 'monitor'] },
  { id: 'observability', label: 'Observability', description: 'System observability dashboard', icon: Eye, path: '/observability', category: 'tools', keywords: ['metrics', 'health', 'slo'] },
  { id: 'observability-query', label: 'Query Explorer', description: 'KQL query explorer', icon: Zap, path: '/observability-query', category: 'tools', keywords: ['kql', 'kusto', 'app insights'] },
  { id: 'jenkins', label: 'Jenkins Pipelines', description: 'CI/CD pipeline management', icon: Workflow, path: '/jenkins', category: 'tools', keywords: ['ci', 'cd', 'build', 'pipeline'] },
  { id: 'azure', label: 'Azure Dashboard', description: 'Azure resources & services', icon: Cloud, path: '/azure', category: 'tools', keywords: ['cloud', 'resource', 'subscription'] },
  { id: 'internal', label: 'Internal Dashboard', description: 'System internals & API catalog', icon: Rocket, path: '/internal', category: 'tools', keywords: ['api', 'system', 'health'] },
  { id: 'hr-setup', label: 'HR Integration', description: 'Configure HR provider connections', icon: Users, path: '/hr-setup', category: 'tools', keywords: ['hr', 'employee', 'birthday', 'greythr', 'setup'] },

  // Admin (Basic)
  { id: 'dashboard-builder', label: 'Dashboard Builder', description: 'Create custom dashboards', icon: BarChart3, path: '/dashboard', category: 'admin', keywords: ['widget', 'layout', 'custom'] },
  { id: 'settings', label: 'Settings', description: 'Application settings', icon: Settings, path: '/settings', category: 'admin', keywords: ['config', 'preferences'] },

  // Admin (Manager/Admin Only)
  { id: 'users', label: 'User Management', description: 'Manage users, roles & permissions', icon: UserCog, path: '/users', category: 'admin', keywords: ['user', 'role', 'permission', 'access'], requiredRole: 'manager' },
  { id: 'menu-management', label: 'Menu Management', description: 'Customize navigation menu', icon: Palette, path: '/menu-management', category: 'admin', keywords: ['nav', 'sidebar', 'menu'], requiredRole: 'admin' },
  { id: 'tenant-settings', label: 'Tenant Settings', description: 'Organization-wide settings', icon: Settings, path: '/tenant-settings', category: 'admin', keywords: ['org', 'tenant', 'organization'], requiredRole: 'admin' },
  { id: 'api-keys', label: 'API Keys', description: 'Manage API keys & integrations', icon: Key, path: '/api-keys', category: 'admin', keywords: ['api', 'key', 'token', 'integration'], requiredRole: 'admin' },
  { id: 'audit-logs', label: 'Audit Logs', description: 'View system audit logs', icon: FileText, path: '/audit', category: 'admin', keywords: ['audit', 'log', 'history', 'activity'], requiredRole: 'manager' },
  { id: 'notifications', label: 'Notification Settings', description: 'Configure alerts & notifications', icon: Bell, path: '/notifications', category: 'admin', keywords: ['alert', 'notify', 'email'], requiredRole: 'manager' },
]

const categoryLabels: Record<string, string> = {
  developer: '👨‍💻 Developer Tools',
  navigation: '📊 Pages',
  ai: '🤖 AI Tools',
  tools: '🔧 Tools & Utilities',
  admin: '⚙️ Administration',
}

const categoryOrder = ['developer', 'ai', 'navigation', 'tools', 'admin']

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentCommands, setRecentCommands] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { isManager, isAdmin } = useAuth()

  // Filter commands based on user role
  const availableCommands = useMemo(() => {
    return allCommands.filter(cmd => {
      if (!cmd.requiredRole) return true
      if (cmd.requiredRole === 'admin') return isAdmin
      if (cmd.requiredRole === 'manager') return isManager || isAdmin
      return true
    })
  }, [isManager, isAdmin])

  // Load recents from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('prodvista-recent-commands')
      if (saved) setRecentCommands(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Filter commands
  const filtered = useMemo(() => {
    if (!query.trim()) {
      // Show recents first, then all
      const recentItems = recentCommands
        .map(id => availableCommands.find(c => c.id === id))
        .filter(Boolean) as CommandItem[]
      const others = availableCommands.filter(c => !recentCommands.includes(c.id))
      return [...recentItems, ...others]
    }
    const q = query.toLowerCase()
    return availableCommands
      .filter(cmd =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.keywords.some(k => k.includes(q))
      )
      .sort((a, b) => {
        // Exact label match first
        const aMatch = a.label.toLowerCase().startsWith(q) ? 0 : 1
        const bMatch = b.label.toLowerCase().startsWith(q) ? 0 : 1
        return aMatch - bMatch
      })
  }, [query, recentCommands, availableCommands])

  // Group filtered by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    for (const cmd of filtered) {
      if (!groups[cmd.category]) groups[cmd.category] = []
      groups[cmd.category].push(cmd)
    }
    return categoryOrder
      .filter(cat => groups[cat]?.length)
      .map(cat => ({ category: cat, label: categoryLabels[cat], items: groups[cat] }))
  }, [filtered])

  // Flat list for keyboard nav
  const flatItems = useMemo(() => grouped.flatMap(g => g.items), [grouped])

  const executeCommand = useCallback((cmd: CommandItem) => {
    // Save to recents
    const newRecents = [cmd.id, ...recentCommands.filter(id => id !== cmd.id)].slice(0, 5)
    setRecentCommands(newRecents)
    localStorage.setItem('prodvista-recent-commands', JSON.stringify(newRecents))

    onClose()
    navigate(cmd.path)
  }, [navigate, onClose, recentCommands])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatItems[selectedIndex]) {
          executeCommand(flatItems[selectedIndex])
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }, [flatItems, selectedIndex, executeCommand, onClose])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  let itemCounter = -1

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, AI tools, or type a command..."
            className="flex-1 text-base text-gray-800 placeholder-gray-400 bg-transparent outline-none"
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-gray-100 rounded-md font-mono">
            ESC
          </kbd>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 sm:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {flatItems.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No results for "{query}"</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.category}>
                <div className="px-5 pt-3 pb-1.5">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                {group.items.map(cmd => {
                  itemCounter++
                  const idx = itemCounter
                  const Icon = cmd.icon
                  const isRecent = !query && recentCommands.includes(cmd.id) && recentCommands.indexOf(cmd.id) < 3
                  const isRestricted = !!cmd.requiredRole
                  return (
                    <button
                      key={cmd.id}
                      data-index={idx}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors',
                        selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                      )}
                    >
                      <div className={clsx(
                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                        cmd.category === 'developer' ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white' :
                        cmd.category === 'ai' ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' :
                        cmd.category === 'tools' ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white' :
                        cmd.category === 'admin' ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={clsx('text-sm font-medium', selectedIndex === idx ? 'text-blue-700' : 'text-gray-800')}>
                            {cmd.label}
                          </span>
                          {isRestricted && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 rounded font-medium">
                              <Lock className="w-2.5 h-2.5" />
                              {cmd.requiredRole === 'admin' ? 'Admin' : 'Manager'}
                            </span>
                          )}
                          {isRecent && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-600 rounded font-medium">
                              <Clock className="w-2.5 h-2.5" />
                              Recent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{cmd.description}</p>
                      </div>
                      {cmd.shortcut && (
                        <kbd className="hidden sm:block px-2 py-0.5 text-[10px] text-gray-400 bg-gray-100 rounded font-mono">
                          {cmd.shortcut}
                        </kbd>
                      )}
                      <ArrowRight className={clsx(
                        'w-4 h-4 shrink-0 transition-opacity',
                        selectedIndex === idx ? 'opacity-60 text-blue-500' : 'opacity-0'
                      )} />
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">↵</kbd> Open</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] font-mono">Esc</kbd> Close</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Command className="w-3 h-3" />
            <span>ProdVista Command</span>
          </div>
        </div>
      </div>
    </div>
  )
}
