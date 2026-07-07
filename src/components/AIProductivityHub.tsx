// ============================================================================
// AIProductivityHub — Expandable AI tools panel
// ============================================================================
import { Bot, ChevronUp, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

export interface AITool {
  label: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  gradient: string
}

interface AIProductivityHubProps {
  tools: AITool[]
  expanded?: boolean
  onToggleExpand?: () => void
  onToolClick?: (path: string) => void
}

export default function AIProductivityHub({
  tools,
  expanded = false,
  onToggleExpand,
  onToolClick,
}: AIProductivityHubProps) {
  return (
    <div
      className={clsx(
        'bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-2xl shadow-xl border border-indigo-400/20 transition-all duration-300',
        expanded ? 'shadow-indigo-500/30' : 'shadow-indigo-500/10'
      )}
    >
      {/* Header / Toggle */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between p-4 text-white hover:bg-white/5 rounded-2xl transition-all"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 animate-pulse" />
          <h2 className="text-sm font-bold uppercase tracking-wider">AI Productivity Hub</h2>
          <span className="text-xs text-white/60">{tools.length} tools</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Tools Grid (Visible when expanded) */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {tools.map(({ label, sub, icon: Icon, path, gradient }) => (
              <button
                key={path}
                onClick={() => onToolClick?.(path)}
                className="group flex flex-col gap-1.5 p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur transition-all text-left hover:scale-105"
              >
                <div className="flex items-center justify-between">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', gradient)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <span className="text-xs font-bold text-white leading-tight">{label}</span>
                <span className="text-[10px] text-white/60 leading-tight">{sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
