import React from 'react'
import clsx from 'clsx'
import { RotateCcw, Users, AlertTriangle, ExternalLink } from 'lucide-react'
import type { QualityWorkItemDto } from '../services/qualityService'

function ageLabelLocal(dateStr?: string): string {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d'
  return `${days}d`
}

export default function WorkItemCard({ item, onOpen }: { item: QualityWorkItemDto; onOpen?: (i: QualityWorkItemDto) => void }) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpen) return onOpen(item)
    if (item.devOpsUrl) window.open(item.devOpsUrl, '_blank')
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group" onClick={handleClick}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">{item.workItemType}</span>
        {item.priority && (
          <span className={clsx('px-2 py-1 text-xs font-bold rounded',
            item.priority === 1 ? 'bg-red-100 text-red-700' :
            item.priority === 2 ? 'bg-orange-100 text-orange-700' :
            item.priority === 3 ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          )}>P{item.priority}</span>
        )}
        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">{item.state}</span>
        {item.reopenCount > 0 && (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            {item.reopenCount}x
          </span>
        )}
        {item.ageDays > 30 && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded">{item.ageDays} days old</span>
        )}
      </div>

      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{item.title}</h3>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className={clsx('font-medium', item.assignedTo ? 'text-gray-700' : 'text-red-600')}>
          {item.assignedTo ? (
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{item.assignedTo}</span>
          ) : (
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Unassigned</span>
          )}
        </span>
        <span>•</span>
        <span>{ageLabelLocal(item.createdDate)}</span>
        {item.ageDays > 0 && (
          <>
            <span>•</span>
            <span className={clsx(item.ageDays > 60 ? 'text-red-600 font-semibold' : item.ageDays > 30 ? 'text-orange-600 font-semibold' : 'text-gray-500')}>{item.ageDays} days</span>
          </>
        )}
      </div>

      {item.tags && item.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.tags.slice(0, 5).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded">{tag}</span>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Click for details</span>
        {!item.assignedTo && (
          <span className="text-xs text-orange-600 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Needs assignment</span>
        )}
      </div>
    </div>
  )
}
