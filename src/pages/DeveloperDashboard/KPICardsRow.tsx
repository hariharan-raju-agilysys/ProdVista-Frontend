import { TrendingUp, AlertTriangle, CheckCircle2, Activity } from 'lucide-react'
import clsx from 'clsx'

export interface KpiCardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  sub?: string
  loading?: boolean
  onClick?: () => void
}

export function KpiCard({
  label, value, icon: Icon, gradient, sub, loading, onClick,
}: KpiCardProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-200',
        'bg-white border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5',
        onClick ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      <div className={clsx('absolute inset-0 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity', gradient)} />
      <div className="relative space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
          <Icon className="w-5 h-5 text-gray-400 group-hover:text-gray-500 transition-colors" />
        </div>
        <div className={clsx('text-2xl font-bold', gradient + ' bg-clip-text text-transparent')}>
          {loading ? '…' : value}
        </div>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
      </div>
    </button>
  )
}

export interface KPICardsRowProps {
  completionRate: number
  avgDailyResolution: number
  openBugs: number
  criticalBugs: number
  loading?: boolean
  onCompletionClick?: () => void
  onCriticalClick?: () => void
  onVelocityClick?: () => void
}

export function KPICardsRow({
  completionRate,
  avgDailyResolution,
  openBugs,
  criticalBugs,
  loading,
  onCompletionClick,
  onCriticalClick,
  onVelocityClick,
}: KPICardsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard 
        label="Team Velocity"
        value={`${completionRate}%`}
        icon={TrendingUp}
        gradient="bg-blue-500"
        sub={`${avgDailyResolution} resolved daily`}
        loading={loading}
        onClick={onVelocityClick}
      />
      <KpiCard 
        label="Critical Bugs"
        value={criticalBugs}
        icon={AlertTriangle}
        gradient="bg-red-500"
        sub="Requires attention"
        loading={loading}
        onClick={onCriticalClick}
      />
      <KpiCard 
        label="Active Bugs"
        value={openBugs}
        icon={Activity}
        gradient="bg-amber-500"
        sub="In progress"
        loading={loading}
      />
      <KpiCard 
        label="Completion Rate"
        value={`${completionRate}%`}
        icon={CheckCircle2}
        gradient="bg-green-500"
        sub="Sprint progress"
        loading={loading}
        onClick={onCompletionClick}
      />
    </div>
  )
}
