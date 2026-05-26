import React from 'react'
import clsx from 'clsx'
import { X, AlertTriangle, Users, Calendar, RotateCcw, Tag, MapPin, GitBranch, CheckCircle2, Clock } from 'lucide-react'
import type { QualityWorkItemDto } from '../services/qualityService'

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysSince(dateStr?: string): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

interface WorkItemDetailModalProps {
  open: boolean
  onClose: () => void
  item: QualityWorkItemDto | null
}

export default function WorkItemDetailModal({ open, onClose, item }: WorkItemDetailModalProps) {
  if (!open || !item) return null

  const ageInDays = daysSince(item.createdDate)
  const isOpen = item.state === 'Active' || item.state === 'New'
  const isHighPriority = item.priority && item.priority <= 2

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient header with status */}
        <div className={clsx(
          'p-6 text-white',
          isOpen
            ? 'bg-gradient-to-r from-red-500 via-orange-500 to-pink-600'
            : 'bg-gradient-to-r from-green-500 via-teal-500 to-cyan-600'
        )}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={clsx(
                  'px-3 py-1 rounded-lg text-xs font-bold',
                  isOpen ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'
                )}>
                  {item.state}
                </span>
                {item.priority && (
                  <span className={clsx(
                    'px-3 py-1 rounded-lg text-xs font-bold',
                    item.priority === 1 ? 'bg-red-700 text-white' :
                    item.priority === 2 ? 'bg-orange-700 text-white' :
                    item.priority === 3 ? 'bg-yellow-700 text-white' :
                    'bg-gray-700 text-white'
                  )}>
                    Priority {item.priority}
                  </span>
                )}
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-white/20">{item.workItemType}</span>
              </div>
              <h2 className="text-2xl font-bold">{item.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Age */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">Age</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{ageInDays}</p>
              <p className="text-xs text-blue-600">{ageInDays === 1 ? 'day' : 'days'} old</p>
            </div>

            {/* Status */}
            <div className={clsx(
              'rounded-lg p-4 border',
              isOpen
                ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'
                : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
            )}>
              <div className="flex items-center gap-2 mb-1">
                {isOpen ? <AlertTriangle className="w-4 h-4 text-orange-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                <span className={clsx('text-xs font-semibold', isOpen ? 'text-orange-700' : 'text-green-700')}>
                  {isOpen ? 'Active' : 'Resolved'}
                </span>
              </div>
              <p className={clsx('text-2xl font-bold', isOpen ? 'text-orange-900' : 'text-green-900')}>
                {isOpen ? 'Open' : 'Closed'}
              </p>
            </div>

            {/* Reopens */}
            <div className={clsx(
              'rounded-lg p-4 border',
              (item.reopenCount || 0) > 0
                ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'
                : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
            )}>
              <div className="flex items-center gap-2 mb-1">
                <RotateCcw className={clsx('w-4 h-4', (item.reopenCount || 0) > 0 ? 'text-orange-600' : 'text-gray-600')} />
                <span className={clsx('text-xs font-semibold', (item.reopenCount || 0) > 0 ? 'text-orange-700' : 'text-gray-700')}>
                  Reopens
                </span>
              </div>
              <p className={clsx('text-2xl font-bold', (item.reopenCount || 0) > 0 ? 'text-orange-900' : 'text-gray-900')}>
                {item.reopenCount || 0}
              </p>
            </div>

            {/* Assignment */}
            <div className={clsx(
              'rounded-lg p-4 border',
              item.assignedTo
                ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
            )}>
              <div className="flex items-center gap-2 mb-1">
                <Users className={clsx('w-4 h-4', item.assignedTo ? 'text-green-600' : 'text-red-600')} />
                <span className={clsx('text-xs font-semibold', item.assignedTo ? 'text-green-700' : 'text-red-700')}>
                  Assigned
                </span>
              </div>
              <p className={clsx('text-sm font-bold', item.assignedTo ? 'text-green-900' : 'text-red-900')}>
                {item.assignedTo || 'Unassigned'}
              </p>
            </div>
          </div>

          {/* Detailed Information */}
          <div className="space-y-4">
            {/* Timeline */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Timeline
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-semibold text-gray-900">{formatDate(item.createdDate)}</span>
                </div>
                {item.resolvedDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Resolved:</span>
                    <span className="font-semibold text-gray-900">{formatDate(item.resolvedDate)}</span>
                  </div>
                )}
                {item.closedDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Closed:</span>
                    <span className="font-semibold text-gray-900">{formatDate(item.closedDate)}</span>
                  </div>
                )}
                {item.changedDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Changed:</span>
                    <span className="font-semibold text-gray-900">{formatDate(item.changedDate)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* People & Ownership */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                People & Ownership
              </h3>
              <div className="space-y-2 text-sm">
                {item.assignedTo && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Assigned To:</span>
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-semibold text-xs">{item.assignedTo}</span>
                  </div>
                )}
                {item.devOwner && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dev Owner:</span>
                    <span className="font-semibold text-gray-900">{item.devOwner}</span>
                  </div>
                )}
                {item.baOwner && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">BA Owner:</span>
                    <span className="font-semibold text-gray-900">{item.baOwner}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Classification */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                Classification
              </h3>
              <div className="space-y-2 text-sm">
                {item.areaPath && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Area:</span>
                    <span className="font-semibold text-gray-900">{item.areaPath}</span>
                  </div>
                )}
                {item.iterationPath && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Iteration:</span>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-semibold text-xs">
                      {item.iterationPath}
                    </span>
                  </div>
                )}
                {item.severity && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Severity:</span>
                    <span className={clsx(
                      'px-3 py-1 rounded-full font-semibold text-xs',
                      item.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                      item.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                      item.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    )}>
                      {item.severity}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Analysis & Recommendations */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-bold text-blue-900 mb-3">📊 Analysis</h3>
            <div className="space-y-2 text-sm text-blue-800">
              {ageInDays > 60 && (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-600" />
                  <span>This item is <strong>{ageInDays} days old</strong> - consider prioritizing resolution</span>
                </p>
              )}
              {(item.reopenCount || 0) > 2 && (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-600" />
                  <span>Item has been reopened <strong>{item.reopenCount} times</strong> - verify root cause fix</span>
                </p>
              )}
              {!item.assignedTo && (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                  <span><strong>Unassigned</strong> - assign to team member immediately</span>
                </p>
              )}
              {isHighPriority && (
                <p className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                  <span>High priority item (P{item.priority}) - requires immediate attention</span>
                </p>
              )}
              {isOpen && !item.assignedTo && (
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                  <span><strong>Action:</strong> Open in Azure DevOps to assign and start working</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500">Work Item ID: <strong className="text-gray-700">{item.id}</strong></span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
            {item.devOpsUrl && (
              <a
                href={item.devOpsUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                <GitBranch className="w-4 h-4" />
                Open in Azure DevOps
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
