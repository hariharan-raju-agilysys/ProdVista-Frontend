// ============================================================================
// IterationTreeSelector — Hierarchical iteration selector (Azure DevOps style)
// ============================================================================
import { useState } from 'react'
import clsx from 'clsx'
import { ChevronRight, ChevronDown, Calendar, CheckCircle2, Clock, Lock } from 'lucide-react'
import type { QualityIteration } from '../services/qualityService'

interface IterationTreeSelectorProps {
  iterations: QualityIteration[]
  selectedPath?: string
  onSelect: (path: string) => void
  searchTerm?: string
  onSearchChange?: (term: string) => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

function IterationItemIcon({ state }: { state: string }) {
  switch (state) {
    case 'Past':
      return <CheckCircle2 className="w-4 h-4 text-gray-400" />
    case 'Current':
      return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
    case 'Future':
      return <Calendar className="w-4 h-4 text-amber-500" />
    case 'Unscheduled':
      return <Lock className="w-4 h-4 text-gray-400" />
    default:
      return <Calendar className="w-4 h-4 text-gray-400" />
  }
}

function IterationTreeNode({
  item,
  level,
  isSelected,
  expandedPaths,
  onToggleExpand,
  onSelect,
}: {
  item: QualityIteration
  level: number
  isSelected: boolean
  expandedPaths: Set<string>
  onToggleExpand: (path: string) => void
  onSelect: (path: string) => void
}) {
  const hasChildren = item.children && item.children.length > 0
  const isExpanded = expandedPaths.has(item.path)
  const hasChildCurrent = item.children?.some(c => c.state === 'Current')

  return (
    <div>
      <button
        onClick={() => {
          onSelect(item.path)
        }}
        onDoubleClick={() => {
          if (hasChildren) onToggleExpand(item.path)
        }}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium',
          isSelected 
            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
            : 'text-gray-700 hover:bg-gray-100 border border-transparent'
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(item.path)
            }}
            className="flex-shrink-0 p-0.5 hover:bg-white rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        )}

        {/* Placeholder for no expand button */}
        {!hasChildren && (
          <div className="w-5 flex-shrink-0" />
        )}

        {/* Icon & Status */}
        <IterationItemIcon state={item.state} />

        {/* Name */}
        <span className="flex-1 text-left truncate">{item.name}</span>

        {/* Badge indicators */}
        <div className="flex items-center gap-1">
          {item.state === 'Current' && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">Active</span>
          )}
          {hasChildCurrent && !isSelected && (
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          )}
        </div>
      </button>

      {/* Render Children */}
      {hasChildren && isExpanded && (
        <div>
          {item.children!.map((child) => (
            <IterationTreeNode
              key={child.path}
              item={child}
              level={level + 1}
              isSelected={child.path === child.path}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function filterIterationTree(
  iterations: QualityIteration[],
  searchTerm: string
): QualityIteration[] {
  if (!searchTerm.toLowerCase()) {
    return iterations
  }

  const term = searchTerm.toLowerCase()

  const filterRecursive = (items: QualityIteration[]): QualityIteration[] => {
    return items
      .filter(item => {
        const nameMatches = item.name.toLowerCase().includes(term)
        const pathMatches = item.path.toLowerCase().includes(term)
        const hasMatchingChildren = item.children && filterRecursive(item.children).length > 0

        return nameMatches || pathMatches || hasMatchingChildren
      })
      .map(item => ({
        ...item,
        children: item.children ? filterRecursive(item.children) : undefined,
      }))
  }

  return filterRecursive(iterations)
}

export default function IterationTreeSelector({
  iterations,
  selectedPath,
  onSelect,
  searchTerm = '',
  onSearchChange,
  isOpen = false,
  onOpenChange,
}: IterationTreeSelectorProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    // Auto-expand paths that contain current iteration or are at level 0
    const expanded = new Set<string>()
    const expandRecursive = (items: QualityIteration[]) => {
      items.forEach(item => {
        if (item.state === 'Current' || !item.path.includes('/')) {
          expanded.add(item.path)
        }
        if (item.children) {
          expandRecursive(item.children)
        }
      })
    }
    expandRecursive(iterations)
    return expanded
  })

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedPaths(newExpanded)
  }

  const filteredIterations = filterIterationTree(iterations, searchTerm)
  const currentIteration = iterations.find(i => i.state === 'Current')

  return (
    <div className="relative p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <label className="block text-xs font-semibold text-gray-600 mb-2">Release / Iteration</label>
      
      <div className="relative">
        {/* Trigger Button */}
        <button
          onClick={() => onOpenChange?.(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {currentIteration?.state === 'Current' && (
              <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
            )}
            <span className="text-sm text-gray-800 truncate">
              {selectedPath || currentIteration?.name || 'Select iteration...'}
            </span>
          </div>
          <ChevronDown
            className={clsx('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')}
          />
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden flex flex-col">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-100 sticky top-0 bg-white">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search iterations..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            {/* Tree Items */}
            <div className="overflow-y-auto flex-1">
              {filteredIterations.length > 0 ? (
                <div className="py-2">
                  {filteredIterations.map((item) => (
                    <IterationTreeNode
                      key={item.path}
                      item={item}
                      level={0}
                      isSelected={item.path === selectedPath}
                      expandedPaths={expandedPaths}
                      onToggleExpand={toggleExpand}
                      onSelect={(path) => {
                        onSelect(path)
                        onOpenChange?.(false)
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-gray-500">No iterations found</p>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
              <p>
                Total: <strong>{iterations.length}</strong> iteration{iterations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Current Iteration Quick Info */}
      {currentIteration && selectedPath !== currentIteration.path && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-700">Current Sprint</p>
              <p className="text-xs text-blue-600 truncate">{currentIteration.name}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
