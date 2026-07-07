// ============================================================================
// BirthdayWidget — User birthday notification & celebration
// ============================================================================
import { ChevronLeft } from 'lucide-react'
import clsx from 'clsx'

interface UserBirthday {
  days: number
  isToday: boolean
}

interface BirthdayWidgetProps {
  birthday?: UserBirthday | null
  isMinimized?: boolean
  onToggleMinimize?: () => void
}

export default function BirthdayWidget({
  birthday,
  isMinimized = false,
  onToggleMinimize,
}: BirthdayWidgetProps) {
  if (!birthday || birthday.days < 0) {
    return null
  }

  if (isMinimized) {
    return (
      <button
        onClick={onToggleMinimize}
        className="p-4 rounded-xl border-2 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎂</span>
          <span className="text-xs font-semibold text-blue-700 group-hover:text-blue-800">
            {birthday.isToday ? 'Happy Birthday! 🎉' : `${birthday.days}d`}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div
      className={clsx(
        'p-4 rounded-xl border-2',
        birthday.isToday
          ? 'bg-gradient-to-br from-pink-50 to-rose-50 border-pink-300'
          : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0',
            birthday.isToday ? 'bg-pink-100' : 'bg-blue-100'
          )}
        >
          🎂
        </div>
        <div className="flex-1">
          <p className={clsx('text-sm font-bold', birthday.isToday ? 'text-pink-800' : 'text-blue-800')}>
            {birthday.isToday ? '🎉 Happy Birthday!' : `Birthday in ${birthday.days} days`}
          </p>
          <p className={clsx('text-xs', birthday.isToday ? 'text-pink-600' : 'text-blue-600')}>
            Have a great day! 🎈
          </p>
        </div>
        <button
          onClick={onToggleMinimize}
          className={clsx(
            'p-2 rounded-lg hover:bg-white/50 transition-colors flex-shrink-0',
            birthday.isToday ? 'text-pink-500' : 'text-blue-500'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
