import { ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'
import { AI_TOOLS } from './constants'

export interface AIProductivityHubProps {
  expanded: boolean
  onToggleExpand: () => void
  onToolClick?: (path: string) => void
}

export default function AIProductivityHub({
  expanded,
  onToggleExpand,
  onToolClick,
}: AIProductivityHubProps) {
  return (
    <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-2xl shadow-lg overflow-hidden">
      {/* Header Button */}
      <button
        onClick={onToggleExpand}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-black/10 transition-colors"
      >
        <div>
          <h3 className="text-white font-bold text-lg">AI Productivity Hub</h3>
          <p className="text-indigo-100 text-xs">{AI_TOOLS.length} tools available</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-white" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Expanded Grid */}
      {expanded && (
        <div className="px-6 pb-6 pt-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {AI_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.label}
                  onClick={() => {
                    onToolClick?.(tool.path)
                    if (tool.path === 'release-notes-redirect') {
                      window.open('https://localhost:5173/releases', '_blank')
                    }
                  }}
                  className={clsx(
                    'group p-3 rounded-xl transition-all hover:-translate-y-1 hover:shadow-lg',
                    tool.gradient
                  )}
                >
                  <Icon className="w-6 h-6 text-white mb-2" />
                  <div className="text-left">
                    <div className="text-xs font-bold text-white">{tool.label}</div>
                    <div className="text-[10px] text-white/80">{tool.sub}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
