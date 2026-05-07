import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Cake, Trophy, RefreshCw, AlertCircle, Users, Calendar,
  Star, Gift, Briefcase, Filter, ChevronLeft, ChevronRight
} from 'lucide-react'
import { getBirthdays, getEmployees, type HrBirthday, type HrEmployee } from '../services/hrPortalService'
import { DataFreshnessBadge } from '../components/DataFreshnessBadge'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkAnniversary {
  employee: HrEmployee
  yearsCompleted: number
  anniversaryDate: Date
  daysUntil: number
  isToday: boolean
  isMilestone: boolean
}

type ViewTab = 'all' | 'birthdays' | 'anniversaries'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MILESTONE_YEARS = [1, 2, 3, 5, 10, 15, 20, 25]

function isMilestoneYear(years: number) {
  return MILESTONE_YEARS.includes(years)
}

function getMilestoneLabel(years: number) {
  if (years === 1) return '1 Year'
  if (years === 2) return '2 Years'
  if (years === 3) return '3 Years'
  if (years === 5) return '5 Years'
  if (years === 10) return '10 Years'
  if (years === 15) return '15 Years'
  if (years === 20) return '20 Years'
  if (years === 25) return '25 Years'
  return `${years} Years`
}

function getMilestoneColor(years: number) {
  if (years >= 20) return 'bg-purple-100 text-purple-700 border-purple-200'
  if (years >= 10) return 'bg-indigo-100 text-indigo-700 border-indigo-200'
  if (years >= 5) return 'bg-blue-100 text-blue-700 border-blue-200'
  if (years >= 3) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}

function daysUntilLabel(days: number, isToday: boolean) {
  if (isToday) return 'Today! 🎉'
  if (days === 1) return 'Tomorrow'
  if (days <= 7) return `In ${days} days`
  if (days <= 14) return `Next week`
  return `In ${days} days`
}

function urgencyBg(days: number, isToday: boolean) {
  if (isToday) return 'bg-green-50 border-green-200'
  if (days <= 3) return 'bg-yellow-50 border-yellow-200'
  if (days <= 7) return 'bg-blue-50 border-blue-100'
  return 'bg-white border-gray-100'
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function avatarColor(name: string) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
    'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  ]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0x7fffffff
  return colors[hash % colors.length]
}

function computeAnniversaries(employees: HrEmployee[], daysAhead: number): WorkAnniversary[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const results: WorkAnniversary[] = []

  for (const emp of employees) {
    if (!emp.joiningDate) continue
    const joined = new Date(emp.joiningDate)
    if (isNaN(joined.getTime())) continue

    const totalYears = Math.floor((today.getTime() - joined.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    const nextAnnivYear = totalYears + 1

    // Find this year's anniversary
    const annivThisYear = new Date(today.getFullYear(), joined.getMonth(), joined.getDate())
    annivThisYear.setHours(0, 0, 0, 0)

    let targetDate = annivThisYear
    let yearsCompleted = nextAnnivYear

    // If this year's anniversary already passed, use next year
    if (annivThisYear < today) {
      targetDate = new Date(today.getFullYear() + 1, joined.getMonth(), joined.getDate())
      yearsCompleted = nextAnnivYear + 1
    }

    const diff = targetDate.getTime() - today.getTime()
    const daysUntil = Math.round(diff / (24 * 60 * 60 * 1000))
    const isToday = daysUntil === 0

    if (daysUntil <= daysAhead && daysUntil >= 0) {
      results.push({
        employee: emp,
        yearsCompleted,
        anniversaryDate: targetDate,
        daysUntil,
        isToday,
        isMilestone: isMilestoneYear(yearsCompleted),
      })
    }
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil)
  return results
}

// ---------------------------------------------------------------------------
// Employee Avatar
// ---------------------------------------------------------------------------

function EmployeeAvatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />
  }
  return (
    <div className={`${sizeClass} rounded-full ${avatarColor(name)} flex items-center justify-center font-semibold text-white flex-shrink-0`}>
      {getInitials(name)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Birthday Card
// ---------------------------------------------------------------------------

function BirthdayCard({ b }: { b: HrBirthday }) {
  return (
    <div className={`rounded-xl border p-4 transition-all hover:shadow-sm ${urgencyBg(b.daysUntil, b.isToday)}`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <EmployeeAvatar name={b.name} avatarUrl={b.avatarUrl} />
          <span className="absolute -bottom-1 -right-1 text-sm">🎂</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{b.name}</p>
          {b.designation && <p className="text-xs text-gray-400 truncate">{b.designation}</p>}
          {b.department && <p className="text-xs text-gray-300 truncate">{b.department}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-xs font-semibold px-2 py-1 rounded-full ${b.isToday ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}>
            {daysUntilLabel(b.daysUntil, b.isToday)}
          </p>
          <p className="text-xs text-gray-300 mt-1">
            {new Date(b.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Anniversary Card
// ---------------------------------------------------------------------------

function AnniversaryCard({ a }: { a: WorkAnniversary }) {
  const milestoneColor = a.isMilestone ? getMilestoneColor(a.yearsCompleted) : ''
  return (
    <div className={`rounded-xl border p-4 transition-all hover:shadow-sm ${urgencyBg(a.daysUntil, a.isToday)}`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <EmployeeAvatar name={a.employee.name} avatarUrl={a.employee.avatarUrl} />
          <span className="absolute -bottom-1 -right-1 text-sm">{a.isMilestone ? '🏆' : '⭐'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-800 text-sm truncate">{a.employee.name}</p>
            {a.isMilestone && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${milestoneColor}`}>
                {getMilestoneLabel(a.yearsCompleted)}
              </span>
            )}
          </div>
          {a.employee.designation && <p className="text-xs text-gray-400 truncate">{a.employee.designation}</p>}
          {a.employee.department && <p className="text-xs text-gray-300 truncate">{a.employee.department}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-xs font-semibold px-2 py-1 rounded-full ${a.isToday ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}>
            {daysUntilLabel(a.daysUntil, a.isToday)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{a.yearsCompleted} yr{a.yearsCompleted !== 1 ? 's' : ''}</p>
          <p className="text-xs text-gray-300">
            {a.anniversaryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CareerMilestonesPage() {
  const [birthdays, setBirthdays] = useState<HrBirthday[]>([])
  const [employees, setEmployees] = useState<HrEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [daysAhead, setDaysAhead] = useState(30)
  const [activeTab, setActiveTab] = useState<ViewTab>('all')
  const [milestonesOnly, setMilestonesOnly] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [bdResult, empResult] = await Promise.all([
        getBirthdays({ daysAhead }),
        getEmployees({ status: 'Active', pageSize: 500 }),
      ])
      setBirthdays(bdResult.birthdays)
      setEmployees(empResult.employees)
      setLastRefreshed(new Date())
    } catch {
      setError('Failed to load HR data. Please ensure the HR portal connection is configured.')
    } finally {
      setLoading(false)
    }
  }, [daysAhead])

  useEffect(() => { loadData() }, [loadData])

  const anniversaries = useMemo(
    () => computeAnniversaries(employees, daysAhead),
    [employees, daysAhead]
  )

  const todayBirthdays = birthdays.filter(b => b.isToday)
  const todayAnniversaries = anniversaries.filter(a => a.isToday)
  const milestoneCount = anniversaries.filter(a => a.isMilestone).length

  const displayedBirthdays = birthdays
  const displayedAnniversaries = milestonesOnly ? anniversaries.filter(a => a.isMilestone) : anniversaries

  const allEvents = useMemo(() => {
    const events: Array<{ type: 'birthday'; data: HrBirthday } | { type: 'anniversary'; data: WorkAnniversary }> = []
    for (const b of displayedBirthdays) events.push({ type: 'birthday', data: b })
    for (const a of displayedAnniversaries) events.push({ type: 'anniversary', data: a })
    events.sort((a, b) => {
      const da = a.type === 'birthday' ? a.data.daysUntil : (a.data as WorkAnniversary).daysUntil
      const db = b.type === 'birthday' ? b.data.daysUntil : (b.data as WorkAnniversary).daysUntil
      return da - db
    })
    return events
  }, [displayedBirthdays, displayedAnniversaries])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Career Milestones
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Upcoming birthdays and work anniversaries for your team</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <DataFreshnessBadge lastRefreshed={lastRefreshed} onRefresh={loadData} isRefreshing={loading} />
            <select
              value={daysAhead}
              onChange={e => setDaysAhead(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value={7}>Next 7 days</option>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
            </select>
          </div>
        </div>

        {/* Summary badges */}
        {!loading && !error && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {todayBirthdays.length > 0 && (
              <span className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium border border-green-200 animate-pulse">
                🎂 {todayBirthdays.length} birthday{todayBirthdays.length > 1 ? 's' : ''} today!
              </span>
            )}
            {todayAnniversaries.length > 0 && (
              <span className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full font-medium border border-amber-200 animate-pulse">
                🏆 {todayAnniversaries.length} work anniversary today!
              </span>
            )}
            <span className="text-xs text-gray-400">{birthdays.length} birthdays · {anniversaries.length} anniversaries · {milestoneCount} milestones</span>
          </div>
        )}
      </div>

      {/* Tabs + Filters */}
      <div className="px-6 py-3 border-b border-gray-50 bg-white flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['all', 'birthdays', 'anniversaries'] as ViewTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                activeTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'birthdays' ? '🎂 Birthdays' : tab === 'anniversaries' ? '⭐ Anniversaries' : 'All'}
            </button>
          ))}
        </div>

        {(activeTab === 'all' || activeTab === 'anniversaries') && (
          <button
            onClick={() => setMilestonesOnly(m => !m)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              milestonesOnly ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Milestones only
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-100 p-4 h-24 animate-pulse bg-gray-50" />
            ))}
          </div>
        ) : (
          <>
            {/* All tab — sorted chronologically */}
            {activeTab === 'all' && (
              allEvents.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No milestones in the next {daysAhead} days</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {allEvents.map((e, i) => (
                    e.type === 'birthday'
                      ? <BirthdayCard key={`b-${i}`} b={e.data as HrBirthday} />
                      : <AnniversaryCard key={`a-${i}`} a={e.data as WorkAnniversary} />
                  ))}
                </div>
              )
            )}

            {/* Birthdays tab */}
            {activeTab === 'birthdays' && (
              displayedBirthdays.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Cake className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No upcoming birthdays in the next {daysAhead} days</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayedBirthdays.map((b, i) => <BirthdayCard key={i} b={b} />)}
                </div>
              )
            )}

            {/* Anniversaries tab */}
            {activeTab === 'anniversaries' && (
              displayedAnniversaries.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>{milestonesOnly ? 'No milestone anniversaries' : 'No upcoming anniversaries'} in the next {daysAhead} days</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayedAnniversaries.map((a, i) => <AnniversaryCard key={i} a={a} />)}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}
