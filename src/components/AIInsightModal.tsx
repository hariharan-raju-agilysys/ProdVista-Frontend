import { Bot, AlertCircle, Users, CheckCircle2 } from 'lucide-react'
import WorkItemCard from './WorkItemCard'
import type { QualityWorkItemDto, OwnerEfficiencyDto } from '../services/qualityService'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  workItems: QualityWorkItemDto[]
  ownerEfficiency: OwnerEfficiencyDto[]
  searchAssignee: string
  setSearchAssignee: (v: string) => void
  sortBugsBy: 'priority' | 'age' | 'state' | 'reopens'
  setSortBugsBy: (v: any) => void
  filterPriority: 'all' | '1' | '2' | '3' | '4'
  setFilterPriority: (v: any) => void
  filterState: 'all' | 'active' | 'resolved'
  setFilterState: (v: any) => void
  filterAssigned: 'all' | 'assigned' | 'unassigned'
  setFilterAssigned: (v: any) => void
  onCardClick?: (item: QualityWorkItemDto) => void
}

export default function AIInsightModal({
  open, onClose, title, description, workItems, ownerEfficiency,
  searchAssignee, setSearchAssignee,
  sortBugsBy, setSortBugsBy,
  filterPriority, setFilterPriority,
  filterState, setFilterState,
  filterAssigned, setFilterAssigned,
  onCardClick,
}: Props) {
  if (!open) return null

  // Compute filtered + sorted list
  let filtered = [...workItems]
  if (filterPriority !== 'all') filtered = filtered.filter(item => String(item.priority) === filterPriority)
  if (filterState === 'active') filtered = filtered.filter(item => item.state === 'Active' || item.state === 'New')
  else if (filterState === 'resolved') filtered = filtered.filter(item => item.state === 'Resolved' || item.state === 'Closed')
  if (filterAssigned === 'assigned') filtered = filtered.filter(item => item.assignedTo)
  else if (filterAssigned === 'unassigned') filtered = filtered.filter(item => !item.assignedTo)

  if (sortBugsBy === 'priority') filtered.sort((a, b) => (a.priority || 99) - (b.priority || 99))
  else if (sortBugsBy === 'age') filtered.sort((a, b) => b.ageDays - a.ageDays)
  else if (sortBugsBy === 'state') filtered.sort((a, b) => a.state.localeCompare(b.state))
  else if (sortBugsBy === 'reopens') filtered.sort((a, b) => b.reopenCount - a.reopenCount)

  const topOwners = ownerEfficiency.slice(0, 20)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bot className="w-7 h-7" />
              {title}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <AlertCircle className="w-5 h-5 text-white" />
            </button>
          </div>
          {description && <p className="text-sm text-orange-100">{description}</p>}
        </div>

        {/* Available Team Members - Searchable */}
        <div className="px-6 pt-4 pb-2 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-gray-900">Available Team Members</h3>
            <span className="text-xs text-gray-500">({ownerEfficiency.length} members)</span>
          </div>
          <input
            type="text"
            placeholder="Search by name..."
            value={searchAssignee}
            onChange={(e) => setSearchAssignee(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
          <div className="mt-3 max-h-24 overflow-y-auto flex flex-wrap gap-2">
            {topOwners
              .filter(owner => owner.ownerName.toLowerCase().includes(searchAssignee.toLowerCase()))
              .map(owner => (
                <div
                  key={owner.ownerName}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors cursor-default"
                  title={`Active: ${owner.active} | Resolved: ${owner.resolved} | Efficiency: ${owner.efficiencyScore.toFixed(0)}%`}
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {owner.ownerName}
                  <span className="text-[10px] text-indigo-500">({owner.active} active)</span>
                </div>
            ))}
          </div>
        </div>

        {/* Sort & Filter Controls */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Sort By</label>
              <select value={sortBugsBy} onChange={(e) => setSortBugsBy(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="priority">Priority (High → Low)</option>
                <option value="age">Age (Oldest First)</option>
                <option value="state">State</option>
                <option value="reopens">Reopen Count</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Priority</label>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="all">All Priorities</option>
                <option value="1">P1 - Critical</option>
                <option value="2">P2 - High</option>
                <option value="3">P3 - Medium</option>
                <option value="4">P4 - Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">State</label>
              <select value={filterState} onChange={(e) => setFilterState(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="all">All States</option>
                <option value="active">Active/New</option>
                <option value="resolved">Resolved/Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Assignment</label>
              <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="all">All Items</option>
                <option value="assigned">Assigned Only</option>
                <option value="unassigned">Unassigned Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-360px)]">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-700">No items match filters</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or sort options</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(item => (
                <WorkItemCard key={item.id} item={item} onOpen={onCardClick} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing <strong className="text-gray-900">{filtered.length}</strong> of <strong className="text-gray-900">{workItems.length}</strong> work items • <strong className="text-orange-600">{workItems.filter(i => !i.assignedTo).length}</strong> unassigned
          </div>
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors">Close</button>
        </div>
      </div>
    </div>
  )
}
