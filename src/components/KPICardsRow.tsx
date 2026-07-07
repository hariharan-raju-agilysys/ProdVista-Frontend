// ============================================================================
// KPICardsRow — Dashboard KPI metrics row
// ============================================================================
import clsx from 'clsx'

interface KPIMetric {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  sub: string
  loading?: boolean
  onClick?: () => void
}

interface KPICardsRowProps {
  metrics: KPIMetric[]
}

function KPICard({
  label,
  value,
  icon: Icon,
  gradient,
  sub,
  loading,
  onClick,
}: KPIMetric) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'p-4 rounded-xl border border-gray-200 bg-white hover:shadow-lg hover:border-indigo-200 transition-all',
        onClick && 'cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">{label}</span>
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', gradient)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>

      <div className="mb-2">
        {loading ? (
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
      </div>

      <p className="text-xs text-gray-500">{sub}</p>
    </button>
  )
}

export default function KPICardsRow({ metrics }: KPICardsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, idx) => (
        <KPICard key={idx} {...metric} />
      ))}
    </div>
  )
}
