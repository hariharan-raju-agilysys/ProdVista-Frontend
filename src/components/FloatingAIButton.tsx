import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bot, Database, Sparkles, X, ChevronUp,
  Zap, Search, Activity, FileText, Rocket,
  MessageCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { usePersistentChat } from '../context/PersistentChatContext'

// Check if chat panel is open (not minimized)
function useChatPanelOpen() {
  const { isMinimized } = usePersistentChat()
  return !isMinimized // Chat panel is visible when not minimized
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

// Fun idle messages for the FAB
const idleMessages = [
  '✨ Need help?',
  '🚀 Quick access',
  '🤖 AI ready',
  '⚡ Ctrl+K',
  '🎯 Go anywhere',
]

interface FloatingAIButtonProps {
  onOpenCommandPalette: () => void
}

export default function FloatingAIButton({ onOpenCommandPalette }: FloatingAIButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [idleIndex, setIdleIndex] = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { openChat } = usePersistentChat()
  const chatPanelOpen = useChatPanelOpen()

  // Rotate idle messages
  useEffect(() => {
    const interval = setInterval(() => {
      setIdleIndex(prev => (prev + 1) % idleMessages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Show tooltip after delay
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(true), 3000)
    const hide = setTimeout(() => setShowTooltip(false), 8000)
    return () => { clearTimeout(timer); clearTimeout(hide) }
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!isExpanded) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isExpanded])

  const handleAction = (action: QuickAction) => {
    setIsExpanded(false)
    // Open persistent chat widget instead of navigating for ai-chat
    if (action.id === 'ai-chat') {
      openChat()
    } else {
      navigate(action.path)
    }
  }

  // When chat panel is open, move FAB further right to avoid overlap
  const fabPosition = chatPanelOpen ? 'right-[420px]' : 'right-6'

  return (
    <div ref={panelRef} className={clsx('fixed bottom-6 z-[90] flex flex-col items-end gap-3 transition-all duration-300', fabPosition)}>
      {/* Expanded Panel */}
      {isExpanded && (
        <div className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-semibold">AI Toolbox</span>
              </div>
              <button onClick={() => setIsExpanded(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-white/70 mt-0.5">Quick access to all AI-powered tools</p>
          </div>

          {/* Search shortcut */}
          <button
            onClick={() => { setIsExpanded(false); onOpenCommandPalette() }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <Search className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 flex-1 text-left">Search everything...</span>
            <kbd className="px-2 py-0.5 text-[10px] text-gray-400 bg-white border rounded font-mono">Ctrl+K</kbd>
          </button>

          {/* Quick Actions Grid */}
          <div className="p-3 grid grid-cols-2 gap-2">
            {quickActions.map(action => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  className="group flex flex-col items-start p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200 text-left"
                >
                  <div className={clsx('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2 group-hover:scale-110 transition-transform', action.color)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-800">{action.label}</span>
                  <span className="text-[10px] text-gray-400">{action.description}</span>
                </button>
              )
            })}
          </div>

          {/* Footer tip */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-[10px] text-gray-400">
              Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[9px] font-mono">Ctrl+K</kbd> for full command palette
            </p>
          </div>
        </div>
      )}

      {/* Tooltip bubble */}
      {showTooltip && !isExpanded && (
        <div className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
          {idleMessages[idleIndex]}
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          'group relative w-14 h-14 rounded-2xl shadow-lg transition-all duration-300 flex items-center justify-center',
          isExpanded
            ? 'bg-gray-800 rotate-0 shadow-xl'
            : 'bg-gradient-to-br from-violet-500 to-indigo-600 hover:shadow-xl hover:scale-105'
        )}
      >
        {isExpanded ? (
          <ChevronUp className="w-6 h-6 text-white" />
        ) : (
          <>
            <Sparkles className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-2xl bg-violet-400 opacity-0 group-hover:opacity-20 animate-ping pointer-events-none" />
          </>
        )}
      </button>
    </div>
  )
}
