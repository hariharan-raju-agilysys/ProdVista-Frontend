import { useState } from 'react'
import { ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import clsx from 'clsx'
import IterationTreeSelector from '../../components/IterationTreeSelector'
import { QualityIteration } from '../../services/qualityService'

export interface CollapsibleIterationSelectorProps {
  iterations: QualityIteration[]
  selectedPath?: string
  onSelect: (path: string) => void
  searchTerm?: string
  onSearchChange?: (term: string) => void
  loading?: boolean
}

export default function CollapsibleIterationSelector({
  iterations,
  selectedPath,
  onSelect,
  searchTerm,
  onSearchChange,
  loading = false,
}: CollapsibleIterationSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  
  // Find selected iteration display info
  const selectedIter = iterations.find(it => it.path === selectedPath)
  const selectedName = selectedIter?.name || 'Select iteration'

  return (
    <div className="space-y-2">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          'w-full flex items-center justify-between gap-3 px-4 py-3',
          'bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl',
          'border-2 border-blue-200 hover:border-blue-300',
          'transition-all duration-200 hover:shadow-md'
        )}
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <div className="text-left">
            <h3 className="text-sm font-bold text-gray-900">Iteration</h3>
            <p className="text-xs text-blue-600">{selectedName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {loading && <div className="text-xs text-gray-500">Loading...</div>}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-blue-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-blue-600" />
          )}
        </div>
      </button>

      {/* Expanded Tree Selector */}
      {isExpanded && (
        <div className="pl-4 pr-4 py-3 bg-white rounded-xl border-2 border-blue-100 shadow-sm">
          <IterationTreeSelector
            iterations={iterations}
            selectedPath={selectedPath}
            onSelect={(path) => {
              onSelect(path)
              // Keep expanded after selection
            }}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            isOpen={true}
            onOpenChange={() => {}}
          />
        </div>
      )}
    </div>
  )
}
