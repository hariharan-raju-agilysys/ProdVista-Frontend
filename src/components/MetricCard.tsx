import { ReactNode } from 'react'
import clsx from 'clsx'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  changeLabel, 
  icon, 
  trend = 'neutral',
  className 
}: MetricCardProps) {
  return (
    <div className={clsx('card', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      {change !== undefined && (
        <div className="flex items-center mt-2">
          <span
            className={clsx(
              'text-sm font-medium',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
              trend === 'neutral' && 'text-gray-500'
            )}
          >
            {change > 0 ? '+' : ''}{change}%
          </span>
          {changeLabel && (
            <span className="text-sm text-gray-400 ml-2">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  children: ReactNode
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        status === 'success' && 'bg-green-100 text-green-800',
        status === 'warning' && 'bg-yellow-100 text-yellow-800',
        status === 'error' && 'bg-red-100 text-red-800',
        status === 'info' && 'bg-blue-100 text-blue-800',
        status === 'neutral' && 'bg-gray-100 text-gray-800'
      )}
    >
      {children}
    </span>
  )
}

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

export function ProgressBar({ value, max = 100, label, color = 'blue' }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)
  
  return (
    <div>
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm text-gray-500">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={clsx(
            'h-2.5 rounded-full transition-all duration-300',
            color === 'blue' && 'bg-primary-600',
            color === 'green' && 'bg-green-500',
            color === 'yellow' && 'bg-yellow-500',
            color === 'red' && 'bg-red-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
