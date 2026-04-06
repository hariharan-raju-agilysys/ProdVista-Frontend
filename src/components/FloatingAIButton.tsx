import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Database, Sparkles, X,
  Zap, Search, Activity, FileText, Rocket,
  MessageCircle, Shield
} from 'lucide-react'
import clsx from 'clsx'
import { usePersistentChat } from '../context/PersistentChatContext'

// Check if chat panel is open (not minimized)
function useChatPanelOpen() {
  const { isMinimized } = usePersistentChat()
  return !isMinimized
}

interface QuickAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  color: string
  description: string
}

const quickActions: QuickAction[] = [
  { id: 'ai-chat', label: 'AI Chat', icon: MessageCircle, path: '', color: 'from-violet-500 to-purple-600', description: 'Open chat widget' },
  { id: 'ai-query', label: 'AI Query', icon: Database, path: '/ai-query', color: 'from-blue-500 to-indigo-600', description: 'SQL from text' },
  { id: 'observability-query', label: 'KQL Explorer', icon: Zap, path: '/observability-query', color: 'from-emerald-500 to-teal-600', description: 'Query logs' },
  { id: 'command-center', label: 'Command Center', icon: Activity, path: '/command-center', color: 'from-cyan-500 to-blue-600', description: 'App Insights' },
  { id: 'release-notes', label: 'Release Notes', icon: FileText, path: '/release-notes', color: 'from-amber-500 to-orange-600', description: 'Generate docs' },
  { id: 'internal', label: 'Internal', icon: Rocket, path: '/internal', color: 'from-rose-500 to-pink-600', description: 'System health' },
]

interface FloatingAIButtonProps {
  onOpenCommandPalette: () => void
}

export default function FloatingAIButton({ onOpenCommandPalette }: FloatingAIButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showToolbox, setShowToolbox] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const navigate = useNavigate()
  const { openChat } = usePersistentChat()
  const chatPanelOpen = useChatPanelOpen()

  // Close toolbox on outside click
  useEffect(() => {
    if (!showToolbox) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowToolbox(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showToolbox])

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 300)
  }

  const handleAction = (action: QuickAction) => {
    setShowToolbox(false)
    setIsHovered(false)
    if (action.id === 'ai-chat') {
      openChat()
    } else {
      navigate(action.path)
    }
  }

  const handleOpenAIAssistant = () => {
    setIsHovered(false)
    openChat()
  }

  const handleOpenTools = () => {
    setIsHovered(false)
    setShowToolbox(true)
  }

  const fabPosition = chatPanelOpen ? 'right-[420px]' : 'right-6'

  return (
    <div 
      ref={panelRef} 
      className={clsx('fixed bottom-6 z-[90] transition-all duration-300', fabPosition)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Toolbox Panel */}
      {showToolbox && (
        <div className="absolute bottom-20 right-0 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-semibold">AI Toolbox</span>
              </div>
              <button onClick={() => setShowToolbox(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-white/70 mt-0.5">Quick access to all AI-powered tools</p>
          </div>

          {/* Search shortcut */}
          <button
            onClick={() => { setShowToolbox(false); onOpenCommandPalette() }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Search className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 text-left">Search everything...</span>
            <kbd className="px-2 py-0.5 text-[10px] text-gray-400 bg-white dark:bg-gray-600 border dark:border-gray-500 rounded font-mono">Ctrl+K</kbd>
          </button>

          {/* Quick Actions Grid */}
          <div className="p-3 grid grid-cols-2 gap-2">
            {quickActions.map((action, idx) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className="group flex flex-col items-start p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-md transition-all duration-200 text-left bg-white dark:bg-gray-800"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className={clsx('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2 group-hover:scale-110 group-hover:rotate-3 transition-transform', action.color)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{action.label}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{action.description}</span>
                </button>
              )
            })}
          </div>

          {/* Footer tip */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-[10px] text-gray-400">
              Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[9px] font-mono">Ctrl+K</kbd> for full command palette
            </p>
          </div>
        </div>
      )}

      {/* Floating Action Buttons Container */}
      <div className="relative flex items-center justify-end">
        
        {/* AI Assistant Button - Flies left on hover */}
        <button
          onClick={handleOpenAIAssistant}
          className={clsx(
            'absolute flex items-center gap-2 h-12 rounded-full shadow-lg transition-all duration-500 ease-out overflow-hidden',
            'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700',
            'hover:shadow-violet-500/40 hover:shadow-xl',
            isHovered && !showToolbox
              ? 'opacity-100 translate-x-0 scale-100 right-[70px] px-4'
              : 'opacity-0 translate-x-8 scale-75 right-0 px-0 pointer-events-none'
          )}
        >
          <div className={clsx(
            'flex items-center justify-center transition-all duration-300',
            isHovered ? 'w-8 h-8' : 'w-0 h-0'
          )}>
            <Bot className="w-5 h-5 text-white animate-pulse" />
          </div>
          <span className={clsx(
            'text-sm font-medium text-white whitespace-nowrap transition-all duration-300',
            isHovered ? 'opacity-100 max-w-24' : 'opacity-0 max-w-0'
          )}>
            AI Chat
          </span>
          {/* Sparkle effect */}
          <div className={clsx(
            'absolute -top-1 -right-1 w-3 h-3 transition-all duration-500',
            isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
          )}>
            <Sparkles className="w-3 h-3 text-yellow-300 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </button>

        {/* Tools Button - Flies up-left on hover */}
        <button
          onClick={handleOpenTools}
          className={clsx(
            'absolute flex items-center gap-2 h-12 rounded-full shadow-lg transition-all duration-500 ease-out overflow-hidden',
            'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700',
            'hover:shadow-blue-500/40 hover:shadow-xl',
            isHovered && !showToolbox
              ? 'opacity-100 translate-y-0 scale-100 right-[70px] bottom-[56px] px-4'
              : 'opacity-0 translate-y-4 scale-75 right-0 bottom-0 px-0 pointer-events-none'
          )}
          style={{ transitionDelay: isHovered ? '50ms' : '0ms' }}
        >
          <div className={clsx(
            'flex items-center justify-center transition-all duration-300',
            isHovered ? 'w-8 h-8' : 'w-0 h-0'
          )}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className={clsx(
            'text-sm font-medium text-white whitespace-nowrap transition-all duration-300',
            isHovered ? 'opacity-100 max-w-16' : 'opacity-0 max-w-0'
          )}>
            Tools
          </span>
          {/* Shield glow effect */}
          <div className={clsx(
            'absolute inset-0 bg-white/10 rounded-full transition-all duration-300',
            isHovered ? 'animate-pulse' : ''
          )} />
        </button>

        {/* Main FAB Button */}
        <button
          className={clsx(
            'relative w-14 h-14 rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center',
            'bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600',
            'hover:shadow-2xl hover:shadow-violet-500/30',
            showToolbox ? 'rotate-45 scale-95' : 'rotate-0 scale-100',
            isHovered && !showToolbox ? 'scale-110' : ''
          )}
          onClick={() => {
            if (showToolbox) {
              setShowToolbox(false)
            }
          }}
        >
          {/* Animated rings */}
          <span className={clsx(
            'absolute inset-0 rounded-2xl border-2 border-violet-400/50 transition-all duration-500',
            isHovered ? 'scale-125 opacity-0' : 'scale-100 opacity-100'
          )} />
          <span className={clsx(
            'absolute inset-0 rounded-2xl border border-purple-300/30 transition-all duration-700',
            isHovered ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
          )} />
          
          {/* Main icon */}
          <Sparkles className={clsx(
            'w-6 h-6 text-white transition-all duration-300',
            showToolbox ? 'rotate-0' : '',
            isHovered && !showToolbox ? 'scale-110' : ''
          )} />
          
          {/* Floating particles on hover */}
          {isHovered && !showToolbox && (
            <>
              <span className="absolute w-1.5 h-1.5 bg-yellow-300 rounded-full animate-bounce" style={{ top: '-4px', right: '8px', animationDelay: '0ms' }} />
              <span className="absolute w-1 h-1 bg-pink-300 rounded-full animate-bounce" style={{ top: '4px', right: '-4px', animationDelay: '100ms' }} />
              <span className="absolute w-1.5 h-1.5 bg-cyan-300 rounded-full animate-bounce" style={{ bottom: '-4px', left: '12px', animationDelay: '200ms' }} />
            </>
          )}
          
          {/* Pulse ring */}
          <span className={clsx(
            'absolute inset-0 rounded-2xl bg-violet-400 pointer-events-none transition-opacity duration-300',
            isHovered ? 'opacity-30 animate-ping' : 'opacity-0'
          )} />
        </button>
      </div>

      {/* Hover hint label */}
      <div className={clsx(
        'absolute -top-8 right-0 whitespace-nowrap transition-all duration-300',
        isHovered && !showToolbox
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2 pointer-events-none'
      )}>
        <span className="px-3 py-1 text-xs font-medium text-white bg-gray-800/90 rounded-full shadow-lg">
          ✨ Choose your path
        </span>
      </div>
    </div>
  )
}
