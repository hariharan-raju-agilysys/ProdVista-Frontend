import React from 'react'
import clsx from 'clsx'

export interface SectionCardProps {
  title: string
  icon?: React.ComponentType<{ className?: string }>
  iconColor?: string
  action?: string
  onAction?: () => void
  children: React.ReactNode
  className?: string
}

export default function SectionCard({
  title,
  icon: Icon,
  iconColor,
  action,
  onAction,
  children,
  className,
}: SectionCardProps) {
  return (
    <div className={clsx('bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={clsx('w-5 h-5', iconColor)} />}
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        </div>
        {action && (
          <button
            onClick={onAction}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            {action}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}
