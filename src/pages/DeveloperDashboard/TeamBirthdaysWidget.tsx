import { Cake } from 'lucide-react'
import clsx from 'clsx'
import { Birthday } from './types'

export interface TeamBirthdaysWidgetProps {
  birthdays: Birthday[]
  loading?: boolean
  className?: string
}

export default function TeamBirthdaysWidget({ 
  birthdays = [], 
  loading = false,
  className 
}: TeamBirthdaysWidgetProps) {
  return (
    <div className={clsx(' max-h-64 overflow-y-auto space-y-1.5 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl shadow-sm border-2 border-pink-200 overflow-hidden', className)}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cake className="w-5 h-5 text-pink-600" />
          <h3 className="text-sm font-bold text-gray-900">Team Birthdays</h3>
        </div>
        
        <div className="space-y-2">
          {loading ? (
            <div className="text-xs text-gray-500 italic">Loading...</div>
          ) : birthdays.length === 0 ? (
            <div className="text-xs text-gray-600 italic bg-white rounded-lg p-3 border border-pink-100">
              🎉 No birthdays this month
            </div>
          ) : (
            <div className="max-h-32 overflow-y-auto space-y-1.5">
              {birthdays.map(birthday => (
                <div 
                  key={birthday.userId} 
                  className="bg-white rounded-lg p-2 border border-pink-100 hover:border-pink-200 transition-colors"
                >
                  <div className="text-xs font-semibold text-gray-800">{birthday.userName}</div>
                  <div className="text-[10px] text-pink-600 font-medium">
                    {new Date(2024, birthday.month - 1, birthday.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
