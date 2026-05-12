// ============================================================================
// DeveloperDashboardPage — Role-based home dashboard
//   Manager / Admin → Team Efficiency Command Center
//   Developer       → Productivity Hub (bug flow, PR queue, live tech feed, AI tools)
// ============================================================================
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
// TODO: Uncomment after Azure DevOps approval for Calendar API
// import { useMsal } from '@azure/msal-react'
import {
  Bug, GitPullRequest, Rocket, AlertTriangle, Activity, Users,
  Clock, ExternalLink, RefreshCw, ChevronRight, Code2,
  BarChart3, Layers, MessageSquare, BookOpen,
  CheckCircle2, Circle, AlertCircle, ArrowUpRight, TrendingUp,
  Zap, Bot, FileText, Terminal,
  Flame, RotateCcw, Target, Award,
  Rss, Star, Crown, Timer, GitMerge,
  Cpu, Radio, Upload, Link2, Image, FileType,
  ChevronLeft, Video, Cake,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import {
  getSummary, getPRSummaryWithFallback,
  type DashboardSummary, type PRInfo, type PRSummaryResponse,
} from '../services/overviewService'
import {
  getQualitySummary, getBugs, getMyBugs, getOwnerEfficiency, getIterations,
  type QualitySummaryDto, type QualityWorkItemDto, type OwnerEfficiencyDto, type QualityIteration,
} from '../services/qualityService'
// TODO: Uncomment after Azure DevOps approval for Calendar API
// import { CalendarService, type CalendarEvent } from '../services/calendarService'
import { type CalendarEvent } from '../services/calendarService'
import { birthdaysService, type Birthday } from '../services/birthdaysService'

// ── types ────────────────────────────────────────────────────────────────────
interface HnItem {
  objectID: string
  title: string
  url?: string
  author: string
  points: number
  num_comments: number
  created_at_i: number
}

interface TechByte {
  id: string
  title: string
  description: string
  type: 'image' | 'document' | 'text' | 'url'
  content: string // URL or text
  uploadedBy: string
  uploadedAt: Date
  tags: string[]
}

// ── helpers ───────────────────────────────────────────────────────────────────
function greeting(name: string): string {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name} 🌤️`
  if (h < 17) return `Good afternoon, ${name} ☀️`
  return `Good evening, ${name} 🌙`
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function ageLabel(dateStr?: string): string {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d'
  return `${days}d`
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() / 1000 - ts) / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function daysUntilBirthday(birthMonth?: number, birthDay?: number): { days: number; isToday: boolean } {
  if (!birthMonth || !birthDay) return { days: -1, isToday: false }
  const today = new Date()
  const thisYear = today.getFullYear()
  const nextBirthday = new Date(thisYear, birthMonth - 1, birthDay)
  if (nextBirthday < today) nextBirthday.setFullYear(thisYear + 1)
  const diff = Math.floor((nextBirthday.getTime() - today.getTime()) / 86_400_000)
  return { days: diff, isToday: diff === 0 }
}

function formatCalendarDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PRIORITY_CFG = [
  { p: 1, label: 'P1 · Critical', short: 'P1', bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500',    flame: true  },
  { p: 2, label: 'P2 · High',     short: 'P2', bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400', flame: false },
  { p: 3, label: 'P3 · Medium',   short: 'P3', bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', flame: false },
  { p: 4, label: 'P4 · Low',      short: 'P4', bar: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-300',   flame: false },
]

// ── sub-components ────────────────────────────────────────────────────────────
function MiniCalendar({ events, selectedDate, onSelectDate, teamBirthdays, onEventClick }: {
  events: CalendarEvent[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  teamBirthdays: Birthday[]
  onEventClick?: (event: CalendarEvent | null, birthday?: Birthday) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  
  const isBirthdayToday = (day: number) => {
    return teamBirthdays.some(b => 
      currentMonth.getMonth() === b.month - 1 && day === b.day
    )
  }

  const getEventsForDay = (day: number) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString()
    return events.filter(e => new Date(e.date).toDateString() === dateStr)
  }

  const hasEvent = (day: number) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString()
    return events.some(e => new Date(e.date).toDateString() === dateStr) || isBirthdayToday(day)
  }

  const isSelected = (day: number) => {
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString()
    return selectedDate.toDateString() === dateStr
  }

  const isToday = (day: number) => {
    const today = new Date().toDateString()
    const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString()
    return today === dateStr
  }

  const getEventIndicators = (day: number) => {
    const dayEvents = getEventsForDay(day)
    const types = new Set(dayEvents.map(e => e.type))
    if (isBirthdayToday(day)) types.add('birthday')
    return Array.from(types)
  }

  const indicatorColor = (type: string) => {
    switch (type) {
      case 'birthday': return 'bg-pink-500'
      case 'release-notes': return 'bg-green-500'
      case 'call': return 'bg-purple-500'
      case 'meeting': return 'bg-blue-500'
      case 'todo': return 'bg-amber-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <h3 className="text-sm font-bold text-gray-700">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-3 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-[10px] font-bold text-gray-400 uppercase py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const selected = isSelected(day)
          const today = isToday(day)
          const hasevt = hasEvent(day)
          const isBirthday = isBirthdayToday(day)
          const indicators = getEventIndicators(day)
          return (
            <div
              key={day}
              className={clsx(
                'relative aspect-square rounded-lg transition-all group',
                selected ? 'ring-2 ring-indigo-500' : ''
              )}
            >
              <button
                onClick={() => onSelectDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
                className={clsx(
                  'relative w-full h-full text-xs font-semibold rounded-lg transition-all',
                  selected ? 'bg-indigo-600 text-white' : isBirthday ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-300' : today ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
                )}
                title={hasevt ? `${indicators.length} event${indicators.length > 1 ? 's' : ''}` : ''}
              >
                {day}
              </button>
              
              {/* Event indicators - Clickable */}
              {hasevt && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5 z-10">
                  {indicators.slice(0, 3).map((type, idx) => {
                    const dayEvents = getEventsForDay(day)
                    const event = dayEvents.find(e => e.type === type)
                    const birthday = isBirthday && type === 'birthday' ? teamBirthdays.find(b => 
                      currentMonth.getMonth() === b.month - 1 && day === b.day
                    ) : null
                    
                    return (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (event) onEventClick?.(event)
                          else if (birthday) onEventClick?.(null, birthday)
                        }}
                        className={clsx('w-2 h-2 rounded-full hover:scale-150 transition-transform cursor-pointer', indicatorColor(type))}
                        title={event?.title || birthday?.userName}
                      />
                    )
                  })}
                  {indicators.length > 3 && (
                    <span className="text-[6px] text-gray-400 ml-0.5">+{indicators.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-[9px]">
        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-pink-500" /><span>Birthday</span></div>
        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /><span>Release</span></div>
        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" /><span>Call</span></div>
        <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /><span>Meeting</span></div>
      </div>
    </div>
  )
}

// ── Event Detail Modal ─────────────────────────────────────────────────────
function EventDetailModal({ event, birthday, isOpen, onClose, tenantCode }: {
  event?: CalendarEvent | null
  birthday?: Birthday | null
  isOpen: boolean
  onClose: () => void
  tenantCode?: string
}) {
  if (!isOpen || (!event && !birthday)) return null

  const isBirthdayEvent = !!birthday

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className={clsx(
          'p-6 border-b sticky top-0',
          isBirthdayEvent ? 'bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200' :
          event?.type === 'release-notes' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' :
          event?.type === 'call' ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200' :
          'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
        )}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={clsx('p-2 rounded-lg', 
                isBirthdayEvent ? 'bg-pink-200' :
                event?.type === 'release-notes' ? 'bg-green-200' :
                event?.type === 'call' ? 'bg-purple-200' :
                'bg-blue-200'
              )}>
                {isBirthdayEvent ? <Cake className="w-6 h-6 text-pink-700" /> :
                 event?.type === 'release-notes' ? <FileText className="w-6 h-6 text-green-700" /> :
                 event?.type === 'call' ? <Video className="w-6 h-6 text-purple-700" /> :
                 <Users className="w-6 h-6 text-blue-700" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {isBirthdayEvent ? `🎂 ${birthday?.userName}'s Birthday` : event?.title}
                </h2>
                <p className="text-sm opacity-75">
                  {new Date(event?.date || new Date()).toLocaleDateString('en-US', { 
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
                  })}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Birthday Details */}
          {isBirthdayEvent && birthday && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Name</p>
                  <p className="text-lg font-semibold text-gray-800">{birthday.userName}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Email</p>
                  <p className="text-sm text-blue-600 hover:underline cursor-pointer">{birthday.email}</p>
                </div>
              </div>
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <p className="text-center text-pink-700 font-semibold text-lg">🎉 Happy Birthday! 🎂</p>
                <p className="text-center text-sm text-pink-600 mt-2">Today is a special day!</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => window.location.href = `mailto:${birthday.email}`}
                  className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                  Send Birthday Wishes
                </button>
              </div>
            </>
          )}

          {/* Release Notes Details */}
          {event && event.type === 'release-notes' && (
            <>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Description</p>
                  <p className="text-gray-700">{event.details || 'No details provided'}</p>
                </div>
              </div>
              {event.releaseNotesSchedule && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-1">Release Owner</p>
                    <p className="font-semibold text-gray-800">{event.releaseNotesSchedule.ownerName}</p>
                    <p className="text-sm text-gray-600">{event.releaseNotesSchedule.ownerEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-1">Release Notes</p>
                    <p className="text-gray-700">{event.releaseNotesSchedule.notes}</p>
                  </div>
                </div>
              )}
              <button onClick={() => window.open(getReleaseNotesUrl(tenantCode), '_blank')}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" />
                View Release Notes
              </button>
            </>
          )}

          {/* Call/Meeting Details */}
          {event && (event.type === 'call' || event.type === 'meeting') && (
            <>
              {event.time && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-1">Time</p>
                  <p className="text-lg font-semibold text-gray-800">{event.time}</p>
                </div>
              )}
              {event.details && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Description</p>
                  <p className="text-gray-700">{event.details}</p>
                </div>
              )}
              {event.attendees && event.attendees.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">Attendees ({event.attendees.length})</p>
                  <div className="space-y-2">
                    {event.attendees.map((attendee, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-gray-700">{attendee}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                  Add to Calendar
                </button>
                <button className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                  Join Meeting
                </button>
              </div>
            </>
          )}

          {/* Other Events */}
          {event && !['call', 'meeting', 'release-notes'].includes(event.type) && (
            <>
              {event.details && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Details</p>
                  <p className="text-gray-700">{event.details}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex gap-3">
          <button onClick={onClose}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label, value, icon: Icon, gradient, sub, loading, onClick,
}: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>;
  gradient: string; sub?: string; loading?: boolean; onClick?: () => void;
}) {
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
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
          {loading ? (
            <div className="h-8 w-14 bg-gray-100 animate-pulse rounded-lg" />
          ) : (
            <p className="text-3xl font-black text-gray-900 leading-none">{value}</p>
          )}
          {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
        </div>
        <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', gradient)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </button>
  )
}

function SectionCard({ title, icon: Icon, iconColor, action, onAction, children, className }: {
  title: string; icon?: React.ComponentType<{ className?: string }>; iconColor?: string;
  action?: string; onAction?: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={clsx('bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={clsx('w-4 h-4', iconColor ?? 'text-gray-400')} />}
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">{title}</h2>
        </div>
        {action && (
          <button onClick={onAction} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
            {action} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Tech Pulse fetch (direct to HN Algolia — no backend needed) ───────────────
async function fetchTechPulse(): Promise<HnItem[]> {
  const topics = ['angular dotnet typescript', 'react AI developer', 'csharp nodejs tooling']
  try {
    const results = await Promise.allSettled(
      topics.map(q =>
        fetch(`https://hn.algolia.com/api/v1/search?tags=story&query=${encodeURIComponent(q)}&hitsPerPage=5&numericFilters=points%3E3`)
          .then(r => r.json() as Promise<{ hits: HnItem[] }>)
      )
    )
    const seen = new Set<string>()
    const items: HnItem[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const hit of r.value?.hits ?? []) {
          if (!seen.has(hit.objectID) && hit.url) {
            seen.add(hit.objectID)
            items.push(hit)
          }
        }
      }
    }
    return items.sort((a, b) => b.points - a.points).slice(0, 9)
  } catch {
    return []
  }
}

// ── AI Productivity shortcuts ─────────────────────────────────────────────────
const AI_TOOLS = [
  { label: 'AI Chat',       sub: 'Ask anything',    icon: Bot,        path: '/ai-chat',           gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',  key: '⇧A' },
  { label: 'AI Query',      sub: 'Natural → SQL',   icon: Terminal,   path: '/ai-query',          gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',    key: '⇧Q' },
  { label: 'Observability', sub: 'KQL & logs',      icon: Activity,   path: '/observability',     gradient: 'bg-gradient-to-br from-teal-500 to-cyan-600',        key: '⇧O' },
  { label: 'Release Notes', sub: 'Auto-generate',   icon: FileText,   path: 'release-notes-redirect',     gradient: 'bg-gradient-to-br from-green-500 to-emerald-600',    key: '⇧R' },
  { label: 'DevOps',        sub: 'Pipelines & PRs', icon: GitMerge,   path: '/devops',            gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600',      key: '⇧G' },
  { label: 'Dev Toolkit',   sub: 'Advanced tools',  icon: Cpu,        path: '/developer-toolkit', gradient: 'bg-gradient-to-br from-pink-500 to-rose-600',        key: '⇧D' },
]

// ── Release Notes URL builder ──────────────────────────────────────────────────
function getReleaseNotesUrl(tenantCode?: string): string {
  const code = tenantCode || 'versa'
  const domain = 'https://aks-v1-dev.hospitalityrevolution.com'
  return `${domain}/${code}releasenote`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function DeveloperDashboardPage() {
  const { user, isManager, isAdmin } = useAuth()
  // TODO: Uncomment after Azure DevOps approval (Build 436, 437) for Calendar & OnlineMeetings scopes
  // const { instance: msalInstance } = useMsal()
  const navigate = useNavigate()
  const [view, setView] = useState<'mine' | 'team'>('mine')
  const [prView, setPrView] = useState<'pending' | 'all'>('pending')
  const [viewOverride, setViewOverride] = useState<'auto' | 'dev'>('auto')
  const tenantCode = localStorage.getItem('prodvista_org_code') || 'versa'
  const canOverrideView = isManager || isAdmin
  const isDevView = viewOverride === 'dev' ? true : (!isManager && !isAdmin)

  // shared state
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [prData, setPrData] = useState<PRSummaryResponse | null>(null)
  const [qualitySummary, setQualitySummary] = useState<QualitySummaryDto | null>(null)
  const [myBugs, setMyBugs] = useState<QualityWorkItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // manager-only
  const [ownerEfficiency, setOwnerEfficiency] = useState<OwnerEfficiencyDto[]>([])
  const [iterations, setIterations] = useState<QualityIteration[]>([])
  const [selectedIteration, setSelectedIteration] = useState<string | undefined>(() => {
    // Load from localStorage on init
    return localStorage.getItem('prodvista_manager_iteration') || undefined
  })
  
  // Birthday widget state
  const [birthdaysMinimized, setBirthdaysMinimized] = useState<boolean>(() => {
    return localStorage.getItem('prodvista_birthdays_minimized') === 'true'
  })
  
  // Work item modal state
  const [showWorkItemModal, setShowWorkItemModal] = useState(false)
  const [modalWorkItems, setModalWorkItems] = useState<QualityWorkItemDto[]>([])
  const [modalTitle, setModalTitle] = useState('')
  const [modalSubtitle, setModalSubtitle] = useState('')
  const [showAIInsightModal, setShowAIInsightModal] = useState(false)
  const [aiInsightWorkItems, setAIInsightWorkItems] = useState<QualityWorkItemDto[]>([])
  const [aiInsightTitle, setAIInsightTitle] = useState('')
  const [aiInsightDescription, setAIInsightDescription] = useState('')
  const [searchAssignee, setSearchAssignee] = useState('')

  // dev-only
  const [techPulse, setTechPulse] = useState<HnItem[]>([])
  const [techLoading, setTechLoading] = useState(false)
  const [reopenedBugs, setReopenedBugs] = useState<QualityWorkItemDto[]>([])
  
  // New: Tech bytes & Calendar
  const [techBytes, setTechBytes] = useState<TechByte[]>([])
  const [techBytesLoading, setTechBytesLoading] = useState(false)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date())
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [selectedBirthday, setSelectedBirthday] = useState<Birthday | null>(null)
  
  // Team birthdays (current month only)
  const [teamBirthdays, setTeamBirthdays] = useState<Birthday[]>([])
  const [teamBirthdaysLoading, setTeamBirthdaysLoading] = useState(false)
  const [_releaseNotesLoading, _setReleaseNotesLoading] = useState(false)

  const displayName = user?.displayName || user?.email?.split('@')[0] || (isManager ? 'Manager' : 'Developer')
  const userBirthday = user?.birthMonth && user?.birthDay ? daysUntilBirthday(user.birthMonth, user.birthDay) : null

  // Handle iteration selection with localStorage persistence
  const handleIterationChange = (iterationPath: string) => {
    setSelectedIteration(iterationPath)
    localStorage.setItem('prodvista_manager_iteration', iterationPath)
    // Reload data with new iteration
    load()
  }
  
  // Handle birthday widget minimize/maximize
  const toggleBirthdaysMinimized = () => {
    const newState = !birthdaysMinimized
    setBirthdaysMinimized(newState)
    localStorage.setItem('prodvista_birthdays_minimized', String(newState))
    // Fetch birthdays if expanding
    if (!newState && teamBirthdays.length === 0) {
      fetchBirthdays()
    }
  }
  
  // Fetch team birthdays (current month only)
  const fetchBirthdays = async () => {
    if (birthdaysMinimized) return // Don't call endpoint if minimized
    setTeamBirthdaysLoading(true)
    try {
      const birthdays = await birthdaysService.getCurrentMonthBirthdays()
      setTeamBirthdays(birthdays)
    } catch (error) {
      console.error('Failed to fetch birthdays:', error)
      setTeamBirthdays([])
    } finally {
      setTeamBirthdaysLoading(false)
    }
  }
  
  // Open work item modal with filtered data
  const openWorkItemModal = (title: string, subtitle: string, items: QualityWorkItemDto[]) => {
    setModalTitle(title)
    setModalSubtitle(subtitle)
    setModalWorkItems(items)
    setShowWorkItemModal(true)
  }

  const openAIInsightModal = (title: string, description: string, items: QualityWorkItemDto[]) => {
    setAIInsightTitle(title)
    setAIInsightDescription(description)
    setAIInsightWorkItems(items)
    setSearchAssignee('')
    setShowAIInsightModal(true)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, prRes] = await Promise.allSettled([
        getSummary(),
        getPRSummaryWithFallback(undefined, view === 'mine' ? 'mine' : 'all'),
      ])
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value)
      if (prRes.status === 'fulfilled') setPrData(prRes.value)

      // Quality data (shared) - with iteration filter for manager view
      try {
        const iterationFilter = !isDevView ? selectedIteration : undefined
        const [qsRes, bugsRes, reopenRes] = await Promise.allSettled([
          getQualitySummary(undefined, iterationFilter),
          view === 'mine'
            ? getMyBugs(undefined, undefined, 'Active')
            : getBugs({ state: 'Active' }),
          getBugs({ state: 'Active' }),
        ])
        if (qsRes.status === 'fulfilled') setQualitySummary(qsRes.value)
        if (bugsRes.status === 'fulfilled') setMyBugs((bugsRes.value as QualityWorkItemDto[]).slice(0, 12))
        if (reopenRes.status === 'fulfilled') {
          const all = reopenRes.value as QualityWorkItemDto[]
          setReopenedBugs(
            all.filter(b => b.reopenCount > 0)
              .sort((a, b) => b.reopenCount - a.reopenCount)
              .slice(0, 6)
          )
        }
      } catch { /* quality not configured */ }

      // Manager-only: owner efficiency with iteration filter + iterations list
      if (isManager || isAdmin) {
        const iterationFilter = selectedIteration
        Promise.allSettled([
          getOwnerEfficiency(undefined, iterationFilter),
          getIterations(),
        ]).then(([effRes, iterRes]) => {
          if (effRes.status === 'fulfilled') setOwnerEfficiency(effRes.value)
          if (iterRes.status === 'fulfilled') {
            const iters = iterRes.value
            setIterations(iters)
            // Auto-select "Current" iteration if no selection stored
            if (!selectedIteration) {
              const current = iters.find(it => it.state === 'Current')
              if (current) {
                setSelectedIteration(current.path)
                localStorage.setItem('prodvista_manager_iteration', current.path)
              }
            }
          }
        }).catch(() => {})
        
        // Fetch birthdays if not minimized
        fetchBirthdays()
      }
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [view, isManager, isAdmin])

  useEffect(() => { load() }, [load])

  // Tech Pulse — load once per session
  useEffect(() => {
    if (!isDevView) return
    setTechLoading(true)
    fetchTechPulse().then(setTechPulse).finally(() => setTechLoading(false))
  }, [isDevView])

  // Calendar Events — fetch from Microsoft Graph
  // TODO: Uncomment after Azure DevOps approval (Build 436, 437) for Calendar & OnlineMeetings scopes
  // useEffect(() => {
  //   if (!isAuthenticated || !isDevView) return

  //   const fetchCalendarEvents = async () => {
  //     try {
  //       const calendarService = new CalendarService(msalInstance as any)
  //       const events = await calendarService.getCalendarEvents()
  //       setCalendarEvents(events)
  //     } catch (error) {
  //       console.error('Failed to fetch calendar events:', error)
  //       // Fallback to empty array so component still renders
  //     }
  //   }

  //   fetchCalendarEvents()
  // }, [isAuthenticated, isDevView, msalInstance])

  // Tech Bytes — fetch from backend API
  useEffect(() => {
    if (!isDevView) return

    const fetchTechBytes = async () => {
      setTechBytesLoading(true)
      try {
        // TODO: Replace with actual API endpoint
        // const response = await fetch('/api/tech-bytes?limit=10')
        // const bytes = await response.json()
        // setTechBytes(bytes)
        
        // For now, start with empty array until backend is ready
        setTechBytes([])
      } catch (error) {
        console.error('Failed to fetch tech bytes:', error)
        setTechBytes([])
      } finally {
        setTechBytesLoading(false)
      }
    }

    fetchTechBytes()
  }, [isDevView])

  // Team Birthdays — fetch current month birthdays for all team members
  useEffect(() => {
    if (!isDevView) return

    const fetchTeamBirthdays = async () => {
      setTeamBirthdaysLoading(true)
      try {
        const birthdays = await birthdaysService.getCurrentMonthBirthdays()
        setTeamBirthdays(birthdays)
      } catch (error) {
        console.error('Failed to fetch team birthdays:', error)
        setTeamBirthdays([])
      } finally {
        setTeamBirthdaysLoading(false)
      }
    }

    fetchTeamBirthdays()
  }, [isDevView])

  // Release Notes & Team Calls — combine into unified calendar events
  useEffect(() => {
    if (!isDevView) return

    const buildCalendarEvents = async () => {
      _setReleaseNotesLoading(true)
      try {
        const allEvents: CalendarEvent[] = []

        // 🎂 Add team birthdays as calendar events
        teamBirthdays.forEach(birthday => {
          const bdayDate = new Date(new Date().getFullYear(), birthday.month - 1, birthday.day)
          allEvents.push({
            id: `birthday-${birthday.userId}`,
            date: bdayDate,
            title: `${birthday.userName}'s Birthday`,
            type: 'call',
            time: 'All Day',
            details: `${birthday.email}`,
            attendees: [birthday.userName],
          })
        })

        // 📝 Mock release notes with schedule dates (replace with API call)
        const now = new Date()
        const releaseSchedules = [
          {
            id: 'release-1',
            date: new Date(now.getFullYear(), now.getMonth(), 15),
            title: 'Version 2.1 Release',
            ownerName: 'DevOps Team',
            ownerEmail: 'devops@company.com',
            notes: 'Major feature release with performance improvements',
          },
          {
            id: 'release-2',
            date: new Date(now.getFullYear(), now.getMonth(), 22),
            title: 'Patch Release 2.0.5',
            ownerName: 'Backend Team',
            ownerEmail: 'backend@company.com',
            notes: 'Critical security fixes and bug patches',
          },
        ]

        releaseSchedules.forEach(release => {
          allEvents.push({
            id: release.id,
            date: release.date,
            title: release.title,
            type: 'release-notes',
            isAllDay: true,
            details: release.notes,
            releaseNotesSchedule: {
              ownerName: release.ownerName,
              ownerEmail: release.ownerEmail,
              notes: release.notes,
            },
          })
        })

        // 📞 Mock team calls (replace with actual API)
        const teamCalls = [
          {
            id: 'call-1',
            date: new Date(now.getFullYear(), now.getMonth(), 10),
            title: 'Team Standup',
            time: '9:00 AM - 9:30 AM',
            attendees: ['Dev Team', 'QA Team'],
          },
          {
            id: 'call-2',
            date: new Date(now.getFullYear(), now.getMonth(), 17),
            title: 'Sprint Planning',
            time: '2:00 PM - 3:30 PM',
            attendees: ['Product Owner', 'Scrum Master', 'Development Team'],
          },
          {
            id: 'call-3',
            date: new Date(now.getFullYear(), now.getMonth(), 25),
            title: 'Architecture Review',
            time: '10:00 AM - 11:00 AM',
            attendees: ['Tech Lead', 'Architects', 'Senior Devs'],
          },
        ]

        teamCalls.forEach(call => {
          allEvents.push({
            id: call.id,
            date: call.date,
            title: call.title,
            type: 'call',
            time: call.time,
            attendees: call.attendees,
          })
        })

        setCalendarEvents(allEvents)
      } catch (error) {
        console.error('Failed to build calendar events:', error)
        setCalendarEvents([])
      } finally {
        _setReleaseNotesLoading(false)
      }
    }

    buildCalendarEvents()
  }, [isDevView, teamBirthdays])

  // ── Role-view shortcut: Ctrl+Shift+V (Admin/Manager only) ──────────────────
  useEffect(() => {
    if (!canOverrideView) return
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault()
        setViewOverride(v => v === 'dev' ? 'auto' : 'dev')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [canOverrideView])

  // ── derived ────────────────────────────────────────────────────────────────
  const openBugs         = qualitySummary?.activeBugs ?? 0
  const criticalBugs     = qualitySummary?.criticalBugs ?? 0
  const prsAwaitingReview = prData?.waitingApproval ?? prData?.totalActive ?? 0
  const openPRs          = prData?.totalActive ?? summary?.devops?.openPRs ?? 0
  const buildSuccessRate = summary?.devops?.buildSuccessRate ?? null
  const activePipelines  = summary?.devops?.activePipelines ?? 0
  const prsToReview      = (prData?.prs ?? []).filter((p: PRInfo) => p.needsMyReview || p.status === 'active')

  // bug priority breakdown
  const bugsByPriority: Record<number, QualityWorkItemDto[]> = { 1: [], 2: [], 3: [], 4: [] }
  myBugs.forEach(b => {
    const p = b.priority ?? 4
    ;(bugsByPriority[p] ?? bugsByPriority[4]).push(b)
  })
  const maxBugCount = Math.max(...Object.values(bugsByPriority).map(a => a.length), 1)

  // Build feed
  const buildFeed = ((summary?.devops as any)?.todayBuilds?.builds ?? []).slice(0, 5)

  // ── Shared header bar ──────────────────────────────────────────────────────
  const header = (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-black text-gray-900">{greeting(displayName)}</h1>
        <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {todayLabel()}
          {lastRefresh && (
            <span className="ml-2 text-gray-300">
              · refreshed {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isDevView && (
          <div className="flex items-center bg-gray-100 rounded-xl p-1 text-sm">
            {(['mine', 'team'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={clsx('px-3 py-1.5 rounded-lg font-medium transition-all capitalize',
                  view === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                )}
              >{v === 'mine' ? 'My View' : 'Team View'}</button>
            ))}
          </div>
        )}
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
        {canOverrideView && (
          <button
            onClick={() => setViewOverride(v => v === 'dev' ? 'auto' : 'dev')}
            title="Ctrl+Shift+V — toggle role view"
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all',
              viewOverride === 'dev'
                ? 'bg-violet-100 text-violet-700 border-violet-300 shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            )}
          >
            {viewOverride === 'dev'
              ? <><Code2 className="w-3.5 h-3.5" /><span>Dev Preview</span></>
              : <><Crown className="w-3.5 h-3.5" /><span>Mgr View</span></>
            }
          </button>
        )}
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // ── MANAGER / ADMIN VIEW — TEAM COMMAND CENTER ────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  if (!isDevView) {
    const topOwners = ownerEfficiency.slice(0, 15) // Show top 15 team members

    // Calculate work item type breakdowns from real Azure DevOps data
    const workItemStats = {
      bugs: {
        active: qualitySummary?.activeBugs ?? 0,
        resolved: qualitySummary?.resolvedBugs ?? 0,
        critical: qualitySummary?.criticalBugs ?? 0,
        reopened: qualitySummary?.reopenedBugs ?? 0,
      },
      features: qualitySummary?.totalFeatures ?? 0,
      userStories: qualitySummary?.totalUserStories ?? 0,
      tasks: qualitySummary?.totalTasks ?? 0,
      totalActive: qualitySummary?.activeItems ?? 0,
      totalCompleted: qualitySummary?.completedItems ?? 0,
    }

    // Calculate team velocity metrics
    const totalWorkItems = qualitySummary?.totalWorkItems ?? 0
    const completionRate = totalWorkItems > 0 
      ? Math.round((workItemStats.totalCompleted / totalWorkItems) * 100) 
      : 0

    // Calculate daily progress (approximation based on recent data)
    const avgDailyResolution = qualitySummary?.avgResolutionDays 
      ? Math.round(workItemStats.bugs.resolved / Math.max(qualitySummary.avgResolutionDays, 1))
      : 0

    // Find current iteration details for display
    const currentIterationInfo = iterations.find(it => it.path === selectedIteration)

    // AI-driven insights based on data patterns
    const aiInsights: { type: 'success' | 'warning' | 'info'; message: string; onClick?: () => void }[] = []
    if (completionRate < 50 && totalWorkItems > 0) {
      aiInsights.push({ type: 'warning', message: `Team velocity at ${completionRate}% - Consider reducing WIP or adding resources` })
    } else if (completionRate >= 80) {
      aiInsights.push({ type: 'success', message: `Excellent velocity! ${completionRate}% completion rate` })
    }
    if (workItemStats.bugs.critical > 5) {
      const criticalBugs = myBugs.filter(b => b.priority === 1 || b.severity === 'Critical')
      aiInsights.push({ 
        type: 'warning', 
        message: `${workItemStats.bugs.critical} critical bugs require immediate attention`,
        onClick: () => openAIInsightModal(
          'Critical Bugs',
          `${criticalBugs.length} critical priority bugs need immediate action. Assign resources to resolve these issues quickly.`,
          criticalBugs
        )
      })
    }
    if (qualitySummary?.reopenedBugs && qualitySummary.reopenedBugs > 10) {
      const reopenRate = (qualitySummary.reopenedBugs / Math.max(qualitySummary.resolvedBugs, 1)) * 100
      aiInsights.push({ 
        type: 'warning', 
        message: `High reopen rate (${reopenRate.toFixed(0)}%) - Review testing processes`,
        onClick: () => openAIInsightModal(
          'Reopened Bugs',
          `${reopenedBugs.length} bugs have been reopened after resolution. Review testing quality and root cause analysis.`,
          reopenedBugs
        )
      })
    }
    if (workItemStats.bugs.active > workItemStats.bugs.resolved) {
      aiInsights.push({ type: 'info', message: `Active bugs (${workItemStats.bugs.active}) exceed resolved (${workItemStats.bugs.resolved}) - Prioritize bug fixes` })
    }
    if (qualitySummary?.avgResolutionDays && qualitySummary.avgResolutionDays > 7) {
      const longRunningBugs = myBugs.filter(b => b.ageDays > 30 && (b.state === 'Active' || b.state === 'New'))
      aiInsights.push({ 
        type: 'info', 
        message: `Avg resolution time is ${qualitySummary.avgResolutionDays}d - Consider breaking down complex issues`,
        onClick: () => openAIInsightModal(
          'Long-Running Bugs',
          `${longRunningBugs.length} bugs have been active for over 30 days. Consider breaking them down into smaller tasks or reassigning.`,
          longRunningBugs
        )
      })
    }

    return (
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {header}

        {/* Top Row: Iteration Filter + Birthday Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Iteration Filter - Stored in localStorage */}
          {iterations.length > 0 && (
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-indigo-600" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">Iteration / Sprint</div>
                  <div className="text-xs text-gray-500">Filter team metrics by release cycle</div>
                </div>
              </div>
              <select
                value={selectedIteration || ''}
                onChange={(e) => handleIterationChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
              >
                <option value="">All Iterations</option>
                {iterations
                  .filter(it => it.state === 'Current' || it.state === 'Future' || it.state === 'Past')
                  .map(it => (
                    <option key={it.id} value={it.path}>
                      {it.name} {it.state === 'Current' ? '(Current)' : it.state === 'Future' ? '(Upcoming)' : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}
          
          {/* Team Birthdays Widget - Minimizable with localStorage */}
          <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl shadow-sm border-2 border-pink-200 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cake className="w-5 h-5 text-pink-600" />
                  <h3 className="text-sm font-bold text-gray-900">Team Birthdays</h3>
                </div>
                <button
                  onClick={toggleBirthdaysMinimized}
                  className="p-1 hover:bg-pink-100 rounded-lg transition-colors"
                  title={birthdaysMinimized ? 'Expand' : 'Minimize'}
                >
                  {birthdaysMinimized ? (
                    <ChevronRight className="w-4 h-4 text-pink-600" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 text-pink-600" />
                  )}
                </button>
              </div>
              
              {!birthdaysMinimized && (
                <div className="space-y-2">
                  {teamBirthdaysLoading ? (
                    <div className="text-xs text-gray-500 italic">Loading...</div>
                  ) : teamBirthdays.length === 0 ? (
                    <div className="text-xs text-gray-600 italic bg-white rounded-lg p-3 border border-pink-100">
                      🎉 No birthdays this month
                    </div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1.5">
                      {teamBirthdays.map(birthday => (
                        <div key={birthday.userId} className="bg-white rounded-lg p-2 border border-pink-100 hover:border-pink-200 transition-colors">
                          <div className="text-xs font-semibold text-gray-800">{birthday.userName}</div>
                          <div className="text-[10px] text-pink-600 font-medium">
                            {new Date(2024, birthday.month - 1, birthday.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced KPI Row - Developer Effectiveness Focus (removed Build Success & Team Count) */}
        {/* KPI cards are now clickable and show detailed work items in modal */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Team Velocity"   value={`${completionRate}%`}
            icon={TrendingUp}    gradient="bg-blue-500"    sub={`${workItemStats.totalCompleted} completed`}  loading={loading} 
            onClick={() => {
              // Show completed work items
              const completedItems = myBugs.filter(b => b.state === 'Resolved' || b.state === 'Closed')
              openWorkItemModal('Completed Work Items', `${completedItems.length} items resolved in ${currentIterationInfo?.name || 'current iteration'}`, completedItems)
            }} />
          <KpiCard label="Active Work"   value={workItemStats.totalActive}
            icon={Activity}      gradient="bg-indigo-500"  sub={`${workItemStats.bugs.active} bugs active`}    loading={loading} 
            onClick={() => {
              // Show active bugs
              const activeBugs = myBugs.filter(b => b.state === 'Active' || b.state === 'New')
              openWorkItemModal('Active Work Items', `${activeBugs.length} active bugs requiring attention`, activeBugs)
            }} />
          <KpiCard label="Critical Issues"  value={workItemStats.bugs.critical}
            icon={AlertTriangle} gradient="bg-red-500"     sub={workItemStats.bugs.critical > 0 ? 'needs attention 🔥' : 'all clear ✓'} loading={loading} 
            onClick={() => {
              // Show critical bugs (priority 1)
              const criticalBugs = myBugs.filter(b => b.priority === 1)
              openWorkItemModal('Critical Priority Bugs', `${criticalBugs.length} critical issues requiring immediate action`, criticalBugs)
            }} />
          <KpiCard label="Resolution Quality" value={qualitySummary?.reopenedBugs ? `${(100 - (qualitySummary.reopenedBugs / Math.max(qualitySummary.resolvedBugs, 1)) * 100).toFixed(0)}%` : '100%'}
            icon={Award}         gradient="bg-purple-500"  sub={`${qualitySummary?.reopenedBugs ?? 0} reopened`}  loading={loading} 
            onClick={() => {
              // Show reopened bugs
              openWorkItemModal('Reopened Bugs', `${reopenedBugs.length} bugs reopened after resolution`, reopenedBugs)
            }} />
        </div>

        {/* AI-Driven Insights - Smart Recommendations */}
        {aiInsights.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-xl border-2 border-indigo-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Bot className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">AI-Powered Insights</h3>
                <p className="text-xs text-gray-600">Smart recommendations based on {currentIterationInfo?.name || 'current'} data</p>
              </div>
            </div>
            <div className="space-y-2">
              {aiInsights.map((insight, idx) => (
                <div 
                  key={idx} 
                  onClick={insight.onClick}
                  className={clsx(
                    'flex items-start gap-3 p-3 rounded-lg border transition-all',
                    insight.type === 'success' ? 'bg-green-50 border-green-200' :
                    insight.type === 'warning' ? 'bg-orange-50 border-orange-200' :
                    'bg-blue-50 border-blue-200',
                    insight.onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.01]'
                  )}
                >
                  <Zap className={clsx('w-4 h-4 mt-0.5 flex-shrink-0',
                    insight.type === 'success' ? 'text-green-600' :
                    insight.type === 'warning' ? 'text-orange-600' :
                    'text-blue-600'
                  )} />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-700">{insight.message}</p>
                    {insight.onClick && (
                      <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        Click to view details and assign resources
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Work Item Type Breakdown - Real Azure DevOps Data */}
        <SectionCard title="Work Item Distribution" icon={Layers} iconColor="text-indigo-600"
          action="Quality Center" onAction={() => navigate('/quality')}
        >
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Bugs', active: workItemStats.bugs.active, resolved: workItemStats.bugs.resolved, icon: Bug, color: 'bg-red-50 border-red-200', textColor: 'text-red-700', iconColor: 'text-red-500' },
                { label: 'Features', active: workItemStats.features, resolved: 0, icon: Star, color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700', iconColor: 'text-blue-500' },
                { label: 'User Stories', active: workItemStats.userStories, resolved: 0, icon: BookOpen, color: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700', iconColor: 'text-purple-500' },
                { label: 'Tasks', active: workItemStats.tasks, resolved: 0, icon: CheckCircle2, color: 'bg-green-50 border-green-200', textColor: 'text-green-700', iconColor: 'text-green-500' },
              ].map(({ label, active, resolved, icon: Icon, color, textColor, iconColor }) => (
                <div key={label} className={clsx('p-4 rounded-xl border-2', color)}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={clsx('w-5 h-5', iconColor)} />
                    <span className={clsx('text-xs font-bold uppercase tracking-wider', textColor)}>{label}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-800">{active}</span>
                      <span className="text-xs text-gray-500">active</span>
                    </div>
                    {resolved > 0 && (
                      <div className="text-xs text-gray-500">
                        <span className="font-semibold text-green-600">{resolved}</span> resolved
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Daily Progress & Quality Metrics */}
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">Avg Resolution</div>
                <div className="text-lg font-bold text-gray-800">{qualitySummary?.avgResolutionDays?.toFixed(1) ?? '—'}<span className="text-sm text-gray-500">d</span></div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">Bug Escape Rate</div>
                <div className={clsx('text-lg font-bold', 
                  (qualitySummary?.bugEscapeRate ?? 0) > 15 ? 'text-red-600' : 
                  (qualitySummary?.bugEscapeRate ?? 0) > 10 ? 'text-orange-500' : 'text-green-600'
                )}>
                  {qualitySummary?.bugEscapeRate?.toFixed(1) ?? '—'}<span className="text-sm">%</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase mb-1">Daily Avg</div>
                <div className="text-lg font-bold text-blue-600">{avgDailyResolution}<span className="text-sm text-gray-500"> resolved/day</span></div>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2/3 - Team Performance Tracking */}
          <div className="lg:col-span-2 space-y-6">

            {/* Enhanced Team Performance Table with Hierarchical View */}
            <SectionCard title="Team Performance Tracker" icon={Users} iconColor="text-blue-600"
              action="Detailed View" onAction={() => navigate('/engineering')}
            >
              <div className="overflow-x-auto">
                {loading || ownerEfficiency.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    {loading ? (
                      <div className="space-y-3 px-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <>
                        <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                        <p className="font-semibold text-gray-500">No team data available</p>
                        <p className="text-xs mt-1">Connect Azure DevOps to track team performance</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <div className="col-span-3">Team Member</div>
                      <div className="col-span-1 text-center">Assigned</div>
                      <div className="col-span-1 text-center">Resolved</div>
                      <div className="col-span-1 text-center">Active</div>
                      <div className="col-span-2 text-center">Quality</div>
                      <div className="col-span-2 text-center">Avg Days</div>
                      <div className="col-span-2 text-center">Efficiency</div>
                    </div>
                    
                    {/* Table Body */}
                    {topOwners.map((o, i) => {
                      const isTopPerformer = i < 3
                      const needsAttention = o.reopenRate > 15 || o.avgResolutionDays > 7
                      
                      return (
                        <div key={o.ownerName} className={clsx(
                          'grid grid-cols-12 gap-2 px-4 py-3 hover:bg-blue-50 transition-colors cursor-pointer',
                          isTopPerformer && 'bg-gradient-to-r from-amber-50 to-orange-50'
                        )}
                        onClick={() => navigate('/engineering')}
                        >
                          {/* Name with rank */}
                          <div className="col-span-3 flex items-center gap-2.5">
                            <div className={clsx(
                              'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 shadow-sm',
                              i === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 
                              i === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' : 
                              i === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-800' : 
                              'bg-gradient-to-br from-gray-300 to-gray-500'
                            )}>
                              {isTopPerformer ? (i + 1) : o.ownerName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-gray-800 truncate text-sm">{o.ownerName}</span>
                                {i === 0 && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                                {needsAttention && <AlertCircle className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                              </div>
                              <div className="text-[10px] text-gray-400">{o.ownerType}</div>
                            </div>
                          </div>
                          
                          {/* Assigned */}
                          <div className="col-span-1 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">{o.totalAssigned}</span>
                          </div>
                          
                          {/* Resolved */}
                          <div className="col-span-1 flex items-center justify-center">
                            <span className="text-sm font-bold text-green-600">{o.resolved}</span>
                          </div>
                          
                          {/* Active */}
                          <div className="col-span-1 flex items-center justify-center">
                            <span className={clsx('text-sm font-semibold', 
                              o.active > 10 ? 'text-orange-600' : 'text-blue-600'
                            )}>{o.active}</span>
                          </div>
                          
                          {/* Resolution Quality (100 - reopenRate) */}
                          <div className="col-span-2 flex items-center justify-center">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-100 rounded-full h-2">
                                <div className={clsx('h-2 rounded-full transition-all',
                                  o.reopenRate < 5 ? 'bg-green-500' : 
                                  o.reopenRate < 15 ? 'bg-yellow-400' : 
                                  'bg-red-500'
                                )} style={{ width: `${Math.max(0, 100 - o.reopenRate)}%` }} />
                              </div>
                              <span className={clsx('text-xs font-bold',
                                o.reopenRate < 5 ? 'text-green-600' : 
                                o.reopenRate < 15 ? 'text-yellow-600' : 
                                'text-red-600'
                              )}>
                                {(100 - o.reopenRate).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          
                          {/* Avg Days */}
                          <div className="col-span-2 flex items-center justify-center">
                            <span className={clsx('text-sm font-semibold',
                              (o.avgResolutionDays ?? 0) > 7 ? 'text-red-600' :
                              (o.avgResolutionDays ?? 0) > 3 ? 'text-orange-500' :
                              'text-green-600'
                            )}>
                              {o.avgResolutionDays?.toFixed(1) ?? '—'}d
                            </span>
                          </div>
                          
                          {/* Efficiency Score */}
                          <div className="col-span-2 flex items-center justify-center">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-100 rounded-full h-2">
                                <div className={clsx('h-2 rounded-full transition-all',
                                  o.efficiencyScore >= 80 ? 'bg-gradient-to-r from-green-400 to-green-600' : 
                                  o.efficiencyScore >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                                  'bg-gradient-to-r from-red-400 to-red-600'
                                )} style={{ width: `${Math.min(o.efficiencyScore, 100)}%` }} />
                              </div>
                              <span className="text-sm font-bold text-gray-800">{Math.round(o.efficiencyScore)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              
              {/* Legend */}
              {!loading && ownerEfficiency.length > 0 && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span className="text-gray-600">Top Performer</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3 text-orange-500" />
                      <span className="text-gray-600">Needs Attention</span>
                    </div>
                  </div>
                  <div className="text-gray-400">
                    <strong className="text-gray-700">{ownerEfficiency.length}</strong> team members tracked
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Bug Priority & Severity Distribution */}
            <SectionCard title="Bug Priority & Severity" icon={Bug} iconColor="text-red-500"
              action="Full Report" onAction={() => navigate('/quality')}
            >
              <div className="p-5 space-y-4">
                {/* Priority breakdown */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">By Priority</div>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-gray-50 animate-pulse rounded-lg" />)
                  ) : (
                    PRIORITY_CFG.map(({ p, label, bar, badge }) => {
                      const counts = [
                        qualitySummary?.criticalBugs ?? 0,
                        qualitySummary?.highBugs ?? 0,
                        qualitySummary?.mediumBugs ?? 0,
                        qualitySummary?.lowBugs ?? 0,
                      ]
                      const val  = counts[p - 1]
                      const total = qualitySummary?.activeBugs ?? 1
                      const pct  = Math.round((val / Math.max(total, 1)) * 100)
                      return (
                        <div key={p} className="flex items-center gap-3">
                          <span className={clsx('px-2.5 py-1 text-[10px] font-bold rounded-lg flex-shrink-0 w-20 text-center', badge)}>
                            {label}
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-3">
                            <div className={clsx('h-3 rounded-full transition-all duration-700', bar)}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-bold text-gray-700 w-8 text-right">{val}</span>
                          <span className="text-xs text-gray-400 w-12 text-right">{pct}%</span>
                        </div>
                      )
                    })
                  )}
                </div>
                
                {/* Summary footer */}
                <div className="pt-3 border-t border-gray-100 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Total</div>
                    <div className="text-lg font-bold text-gray-800">{qualitySummary?.activeBugs ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Resolved</div>
                    <div className="text-lg font-bold text-green-600">{qualitySummary?.resolvedBugs ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Reopened</div>
                    <div className="text-lg font-bold text-orange-600">{qualitySummary?.reopenedBugs ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Closed</div>
                    <div className="text-lg font-bold text-blue-600">{qualitySummary?.closedBugs ?? 0}</div>
                  </div>
                </div>
              </div>
            </SectionCard>

          </div>

          {/* Right 1/3 - Operations Dashboard & Quick Actions */}
          <div className="space-y-5">
            {/* Operations Dashboard - Developer Focus (removed Pipelines & Team Count) */}
            <SectionCard title="Operations Dashboard" icon={Activity} iconColor="text-indigo-600">
              <div className="p-4 space-y-2">
                {[
                  { label: 'Open PRs',          value: summary?.devops?.openPRs ?? 0, icon: <GitMerge className="w-4 h-4 text-purple-500" />, color: 'text-purple-700', action: () => navigate('/pull-requests') },
                  { label: 'Active Incidents',  value: (summary?.support as any)?.openIncidents ?? 0, icon: <AlertTriangle className="w-4 h-4 text-orange-500" />, color: 'text-orange-700', action: () => navigate('/production') },
                  { label: 'Repositories',      value: summary?.devops?.totalRepositories ?? '—', icon: <Layers className="w-4 h-4 text-indigo-500" />, color: 'text-indigo-700', action: () => navigate('/engineering') },
                  { label: 'Customers',         value: (summary?.customers as any)?.total ?? '—', icon: <BarChart3 className="w-4 h-4 text-cyan-500" />, color: 'text-cyan-700', action: () => navigate('/customers') },
                ].map(({ label, value, icon, color, action }) => (
                  <button key={label} onClick={action}
                    className="w-full flex items-center justify-between py-2 px-1 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-600">{icon}{label}</div>
                    <div className="flex items-center gap-1">
                      <span className={clsx('text-sm font-bold', color)}>{loading ? '…' : value}</span>
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>

            {/* Top Reopened Bugs Alert */}
            {reopenedBugs.length > 0 && (
              <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <RotateCcw className="w-5 h-5 text-orange-600" />
                  <h3 className="text-sm font-bold text-orange-900 uppercase tracking-wider">Needs Review</h3>
                </div>
                <div className="space-y-2.5">
                  {reopenedBugs.slice(0, 4).map(bug => (
                    <div key={bug.id} className="bg-white rounded-lg p-3 border border-orange-100 hover:border-orange-200 transition-colors cursor-pointer"
                      onClick={() => window.open(bug.devOpsUrl, '_blank')}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-800 line-clamp-2 flex-1">{bug.title}</span>
                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded">
                          {bug.reopenCount}x
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span className="font-medium text-gray-600">{bug.assignedTo || 'Unassigned'}</span>
                        <span>•</span>
                        <span>{ageLabel(bug.createdDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/quality')}
                  className="w-full mt-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  View All Reopened Bugs
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <SectionCard title="Quick Actions" icon={Zap} iconColor="text-amber-500">
              <div className="p-3 space-y-2">
                {[
                  { label: 'Quality Dashboard',   path: '/quality',       icon: Bug,            color: 'bg-red-50 text-red-600 border-red-100' },
                  { label: 'Engineering Metrics', path: '/engineering',   icon: Code2,          color: 'bg-blue-50 text-blue-600 border-blue-100' },
                  { label: 'Release Management',  path: '/releases',      icon: Rocket,         color: 'bg-green-50 text-green-600 border-green-100' },
                  { label: 'Team Management',     path: '/users',         icon: Users,          color: 'bg-purple-50 text-purple-600 border-purple-100' },
                  { label: 'Bug Analytics',       path: '/bug-analytics', icon: BarChart3,      color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                ].map(({ label, path, icon: Icon, color }) => (
                  <button key={path} onClick={() => navigate(path)}
                    className={clsx('w-full flex items-center gap-2.5 p-3 rounded-xl border hover:shadow-sm transition-all text-sm font-semibold', color)}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-50" />
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
        
        {/* AI Insight Modal with Assignee Selection */}
        {showAIInsightModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAIInsightModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Gradient header */}
              <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Bot className="w-7 h-7" />
                    {aiInsightTitle}
                  </h2>
                  <button onClick={() => setShowAIInsightModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </button>
                </div>
                <p className="text-sm text-orange-100">{aiInsightDescription}</p>
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
                  {ownerEfficiency
                    .filter(owner => owner.ownerName.toLowerCase().includes(searchAssignee.toLowerCase()))
                    .slice(0, 20)
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

              {/* Scrollable content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-360px)]">
                {aiInsightWorkItems.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-gray-700">No items found</p>
                    <p className="text-sm text-gray-500 mt-1">All work items have been addressed</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {aiInsightWorkItems.map(item => (
                      <div 
                        key={item.id} 
                        className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                        onClick={() => window.open(item.devOpsUrl, '_blank')}
                      >
                        {/* Type, Priority, State, Reopen badges */}
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
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded">
                              {item.ageDays} days old
                            </span>
                          )}
                        </div>
                        
                        {/* Title */}
                        <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                        
                        {/* Assignee and metadata */}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className={clsx(
                            'font-medium',
                            item.assignedTo ? 'text-gray-700' : 'text-red-600'
                          )}>
                            {item.assignedTo ? (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {item.assignedTo}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Unassigned
                              </span>
                            )}
                          </span>
                          <span>•</span>
                          <span>{ageLabel(item.createdDate)}</span>
                          {item.ageDays > 0 && (
                            <>
                              <span>•</span>
                              <span className={clsx(
                                item.ageDays > 60 ? 'text-red-600 font-semibold' :
                                item.ageDays > 30 ? 'text-orange-600 font-semibold' :
                                'text-gray-500'
                              )}>{item.ageDays} days</span>
                            </>
                          )}
                        </div>
                        
                        {/* Tags */}
                        {item.tags && item.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.tags.slice(0, 5).map(tag => (
                              <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Click hint */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            Click to open in Azure DevOps and assign
                          </span>
                          {!item.assignedTo && (
                            <span className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Needs assignment
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <strong className="text-gray-900">{aiInsightWorkItems.length}</strong> work items • 
                  <strong className="text-orange-600">{aiInsightWorkItems.filter(i => !i.assignedTo).length}</strong> unassigned
                </div>
                <button 
                  onClick={() => setShowAIInsightModal(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Work Item Details Modal */}
        {showWorkItemModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWorkItemModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold text-white">{modalTitle}</h2>
                  <button onClick={() => setShowWorkItemModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </button>
                </div>
                <p className="text-sm text-indigo-100">{modalSubtitle}</p>
              </div>
              
              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                {modalWorkItems.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-gray-700">No items found</p>
                    <p className="text-sm text-gray-500 mt-2">All work items in this category have been resolved</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {modalWorkItems.map(item => (
                      <div key={item.id} className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => window.open(item.devOpsUrl, '_blank')}
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
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
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="font-medium text-gray-700">{item.assignedTo || 'Unassigned'}</span>
                              <span>•</span>
                              <span>{ageLabel(item.createdDate)}</span>
                              {item.ageDays > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{item.ageDays} days old</span>
                                </>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </div>
                        
                        {item.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.tags.map((tag, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <strong className="text-gray-900">{modalWorkItems.length}</strong> work items
                </div>
                <button onClick={() => setShowWorkItemModal(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── DEVELOPER PRODUCTIVITY HUB ────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {header}

      {/* Admin/Manager Dev Preview mode indicator */}
      {canOverrideView && viewOverride === 'dev' && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700 font-medium">
          <Code2 className="w-4 h-4 flex-shrink-0" />
          <span>Dev Preview — you are viewing the <strong>developer perspective</strong></span>
          <button
            onClick={() => setViewOverride('auto')}
            className="ml-auto text-xs text-violet-500 hover:text-violet-700 underline underline-offset-2"
          >
            Exit preview
          </button>
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Bugs"    value={openBugs}
          icon={Bug}           gradient="bg-red-500"
          sub={criticalBugs > 0 ? `${criticalBugs} critical 🔥` : '0 critical ✓'}
          loading={loading}    onClick={() => navigate('/quality')} />
        <KpiCard label="PRs to Review" value={prsAwaitingReview}
          icon={GitPullRequest} gradient="bg-purple-500"
          sub={openPRs > 0 ? `${openPRs} open total` : 'all clear'}
          loading={loading}    onClick={() => navigate('/pull-requests')} />
        <KpiCard label="Critical Bugs" value={criticalBugs}
          icon={Flame}         gradient="bg-orange-500"
          sub={criticalBugs > 0 ? 'needs immediate fix' : 'clean slate ✓'}
          loading={loading}    onClick={() => navigate('/quality')} />
        <KpiCard label="Build Rate"    value={buildSuccessRate != null ? `${Math.round(buildSuccessRate)}%` : '—'}
          icon={TrendingUp}    gradient="bg-green-500"
          sub={`${activePipelines} pipeline${activePipelines !== 1 ? 's' : ''} active`}
          loading={loading}    onClick={() => navigate('/devops')} />
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────────── */}
      {/* ── AI Productivity Hub (FULL WIDTH TOP) ─────────────────────────── */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-6 shadow-lg shadow-indigo-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-white/80" />
          <h2 className="text-base font-bold text-white uppercase tracking-widest">AI Productivity Hub</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {AI_TOOLS.map(({ label, sub, icon: Icon, path, gradient, key }) => (
            <button key={path} onClick={() => {
              if (path === 'release-notes-redirect') {
                window.open(getReleaseNotesUrl(tenantCode), '_blank')
              } else {
                navigate(path)
              }
            }}
              className="group flex flex-col gap-1.5 p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur transition-all text-left hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', gradient)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-[9px] text-white/40 font-mono">^{key}</span>
              </div>
              <span className="text-xs font-bold text-white leading-tight">{label}</span>
              <span className="text-[10px] text-white/60 leading-tight">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content Grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left 2/3 ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* ────────────── Bug Priority Flow Chart ────────────────────── */}
          <SectionCard title="Today's Fix Priority" icon={Target} iconColor="text-red-500"
            action="Quality Center" onAction={() => navigate('/quality')}
          >
            <div className="p-5">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 bg-gray-50 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : myBugs.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-2" />
                  <p className="font-semibold text-gray-500">No active bugs!</p>
                  <p className="text-xs mt-1">Connect Azure DevOps quality to see your bug queue.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {PRIORITY_CFG.map(({ p, label, bar, badge, dot, flame }) => {
                    const bugs = bugsByPriority[p] ?? []
                    const count = bugs.length
                    if (count === 0) return null
                    const barPct = Math.round((count / maxBugCount) * 100)
                    const oldest = bugs.reduce((acc, b) => {
                      const d = b.ageDays ?? 0
                      return d > acc ? d : acc
                    }, 0)
                    const topBug = bugs[0]
                    return (
                      <button
                        key={p}
                        onClick={() => navigate('/quality')}
                        className="w-full group rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all p-3.5 text-left bg-white hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {flame && <Flame className="w-4 h-4 text-red-500 animate-pulse" />}
                            <span className={clsx('px-2 py-0.5 text-[11px] font-black rounded', badge)}>
                              {label}
                            </span>
                          </div>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className={clsx('h-2 rounded-full transition-all duration-700', bar)}
                              style={{ width: `${barPct}%` }} />
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-lg font-black text-gray-900">{count}</span>
                            <span className="text-[10px] text-gray-400 font-mono">oldest {oldest}d</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </div>
                        {topBug && (
                          <p className="text-xs text-gray-500 truncate pl-1">
                            <span className={clsx('inline-block w-1.5 h-1.5 rounded-full mr-1.5 mb-0.5', dot)} />
                            Top: {topBug.title}
                          </p>
                        )}
                      </button>
                    )
                  })}
                  <div className="pt-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-50">
                    <span>Fix P1 → P2 → P3 → P4 order · <strong className="text-gray-600">{myBugs.length}</strong> total active</span>
                    <button onClick={() => navigate('/quality')} className="text-blue-500 hover:text-blue-700 flex items-center gap-1">
                      View all <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ────────────── Reopened Issues ──────────────────────────────── */}
          {(reopenedBugs.length > 0 || loading) && (
            <SectionCard title="Reopened Issues" icon={RotateCcw} iconColor="text-orange-500"
              action="View All" onAction={() => navigate('/quality')}
            >
              <div className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-4 bg-gray-100 animate-pulse rounded" />
                      <div className="flex-1 h-4 bg-gray-100 animate-pulse rounded" />
                    </div>
                  ))
                ) : (
                  reopenedBugs.map(bug => {
                    const pCfg = PRIORITY_CFG.find(c => c.p === (bug.priority ?? 4)) ?? PRIORITY_CFG[3]
                    return (
                      <div key={bug.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 group">
                        <span className={clsx('flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded flex-shrink-0', pCfg.badge)}>
                          <RotateCcw className="w-2.5 h-2.5" />
                          {bug.reopenCount}×
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{bug.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                            <span>{pCfg.label}</span>
                            {bug.assignedTo && <><span>·</span><span>{bug.assignedTo}</span></>}
                            <span>·</span><span>{bug.ageDays}d old</span>
                          </div>
                        </div>
                        {bug.devOpsUrl && (
                          <a href={bug.devOpsUrl} target="_blank" rel="noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500" />
                          </a>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </SectionCard>
          )}

          {/* ────────────── PR Review Queue ──────────────────────────────── */}
          <SectionCard title="PR Review Queue" icon={GitPullRequest} iconColor="text-purple-500"
            action="All PRs" onAction={() => navigate('/pull-requests')}
          >
            <div className="border-b border-gray-50 px-5 py-2 flex items-center gap-2">
              <div className="flex items-center bg-gray-100 rounded-lg p-1 text-xs">
                {(['pending', 'all'] as const).map(v => (
                  <button key={v} onClick={() => setPrView(v)}
                    className={clsx('px-2.5 py-1 rounded font-medium transition-all capitalize',
                      prView === v ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    )}
                  >{v === 'pending' ? 'My Pending' : 'All PRs'}</button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 h-4 bg-gray-100 animate-pulse rounded" />
                    <div className="w-16 h-4 bg-gray-100 animate-pulse rounded" />
                  </div>
                ))
              ) : prsToReview.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 text-green-300 mx-auto mb-2" />
                  <p>No PRs waiting for review</p>
                  {!prData && <p className="text-xs mt-1">Connect Azure DevOps to see PRs</p>}
                </div>
              ) : (
                prsToReview.slice(0, 6).map((pr: PRInfo) => (
                  <div key={pr.pullRequestId} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 group">
                    <div className={clsx(
                      'mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
                      pr.needsMyReview ? 'bg-purple-100' : 'bg-gray-100'
                    )}>
                      <GitPullRequest className={clsx('w-3.5 h-3.5', pr.needsMyReview ? 'text-purple-600' : 'text-gray-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate font-medium">{pr.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                        <span className="font-mono text-gray-500">{pr.repositoryName}</span>
                        <span>·</span><span>{pr.createdBy}</span>
                        <span>·</span><span>{ageLabel(pr.creationDate)}</span>
                        {pr.needsMyReview && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">NEEDS REVIEW</span>
                        )}
                      </div>
                    </div>
                    {pr.webUrl && (
                      <a href={pr.webUrl} target="_blank" rel="noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Open <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* ────────────── Build Pipeline Status ──────────────────────── */}
          {buildFeed.length > 0 && (
            <SectionCard title="Build Pipeline Status" icon={Rocket} iconColor="text-green-500"
              action="Jenkins" onAction={() => navigate('/jenkins')}
            >
              <div className="divide-y divide-gray-50">
                {buildFeed.map((b: any) => {
                  const ok   = b.result === 'succeeded'
                  const fail = b.result === 'failed'
                  return (
                    <div key={b.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                      {ok   ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : fail ? <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        : <Circle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">{b.definitionName}</p>
                        <p className="text-xs text-gray-400 font-mono">{b.buildNumber}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={clsx('px-2 py-0.5 text-[10px] font-bold rounded uppercase',
                          ok ? 'bg-green-100 text-green-700' : fail ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        )}>
                          {b.result ?? b.status ?? 'running'}
                        </span>
                        <span className="text-xs text-gray-400">{ageLabel(b.startTime)}</span>
                        {b.webUrl && (
                          <a href={b.webUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3 h-3 text-gray-300 hover:text-blue-500" />
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}
        </div>

        {/* ── Right 1/3 ──────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* ── Tech Pulse (live HN feed) ─────────────────────────────────── */}
          <SectionCard title="Tech Pulse & Learning" icon={Radio} iconColor="text-blue-500">
            <div className="border-b border-gray-50 px-5 py-3 flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 text-xs text-gray-500">
                <Rss className="w-3 h-3" />
                <span className="font-semibold">Community Feed + Team Bytes</span>
              </div>
              <button
                title="Upload tech resource"
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-blue-600"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
            <div className="px-1 py-1 max-h-[600px] overflow-y-auto">
              {/* Team Tech Bytes Loading */}
              {techBytesLoading && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Team Bytes</p>
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
                    ))}
                  </div>
                </div>
              )}

              {/* Team Tech Bytes */}
              {!techBytesLoading && techBytes.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Team Bytes</p>
                  <div className="space-y-2">
                    {techBytes.map(byte => (
                      <a
                        key={byte.id}
                        href={byte.type === 'url' ? byte.content : '#'}
                        target={byte.type === 'url' ? '_blank' : undefined}
                        rel={byte.type === 'url' ? 'noreferrer' : undefined}
                        className="block p-2.5 rounded-lg hover:bg-indigo-50 transition-colors group border border-indigo-100"
                      >
                        <div className="flex items-start gap-2">
                          <div className="p-1.5 rounded-md flex-shrink-0 bg-indigo-100 text-indigo-600">
                            {byte.type === 'image' && <Image className="w-3.5 h-3.5" />}
                            {byte.type === 'document' && <FileType className="w-3.5 h-3.5" />}
                            {byte.type === 'text' && <FileText className="w-3.5 h-3.5" />}
                            {byte.type === 'url' && <Link2 className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-indigo-700">{byte.title}</p>
                            <p className="text-[10px] text-gray-500 truncate mt-0.5">{byte.description}</p>
                            <div className="flex items-center gap-1 mt-1.5 text-[9px] text-gray-400">
                              <span>{byte.uploadedBy}</span>
                              <span>·</span>
                              <span>{formatCalendarDate(byte.uploadedAt)}</span>
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-indigo-500 flex-shrink-0 mt-0.5" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* HN Feed */}
              {techLoading ? (
                <div className="space-y-1 px-3 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-50 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : techPulse.length === 0 ? (
                <div className="px-5 py-6 text-center text-gray-400 text-sm">
                  <Rss className="w-6 h-6 mx-auto mb-2 text-gray-200" />
                  <p>No feed data</p>
                  <p className="text-xs text-gray-300 mt-1">Check internet connectivity</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  <p className="px-4 py-2 text-xs font-bold text-gray-500 uppercase bg-gray-50">Trending</p>
                  {techPulse.map(item => (
                    <a
                      key={item.objectID}
                      href={item.url ?? `https://news.ycombinator.com/item?id=${item.objectID}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-2.5 px-4 py-3 hover:bg-blue-50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 line-clamp-2 group-hover:text-blue-600 transition-colors leading-snug">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                          <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5" />{item.points}</span>
                          <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" />{item.num_comments}</span>
                          <span>{timeAgo(item.created_at_i)}</span>
                        </div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-50 flex items-center justify-between bg-gray-50">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Rss className="w-2.5 h-2.5" /> Hacker News · live
              </span>
              <button
                onClick={() => { setTechLoading(true); fetchTechPulse().then(setTechPulse).finally(() => setTechLoading(false)) }}
                className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" /> refresh
              </button>
            </div>
          </SectionCard>

          {/* ── Calendar & Events ──────────────────────────────────────── */}
          <MiniCalendar 
            events={calendarEvents} 
            selectedDate={selectedCalendarDate} 
            onSelectDate={setSelectedCalendarDate} 
            teamBirthdays={teamBirthdays}
            onEventClick={(event, birthday) => {
              if (birthday) setSelectedBirthday(birthday)
              if (event) setSelectedEvent(event)
            }}
          />

          {/* ── Event Detail Modal ────────────────────────────────────────────*/}
          <EventDetailModal 
            event={selectedEvent} 
            birthday={selectedBirthday}
            isOpen={!!selectedEvent || !!selectedBirthday}
            onClose={() => {
              setSelectedEvent(null)
              setSelectedBirthday(null)
            }}
            tenantCode={tenantCode}
          />

          {/* ── Team Birthdays (Current Month) ────────────────────────────── */}
          {isDevView && (
            <SectionCard title="Team Birthdays" icon={Cake} iconColor="text-pink-500">
              <div className="px-5 py-3 divide-y divide-gray-50">
                {teamBirthdaysLoading ? (
                  <div className="px-5 py-6 text-center text-gray-400 text-sm">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-gray-400 animate-spin mx-auto mb-2" />
                    Loading team birthdays...
                  </div>
                ) : teamBirthdays.length === 0 ? (
                  <div className="px-5 py-6 text-center text-gray-400 text-sm">
                    <Cake className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                    <p>No birthdays this month</p>
                  </div>
                ) : (
                  teamBirthdays
                    .sort((a, b) => a.day - b.day)
                    .map(birthday => (
                      <div key={birthday.userId} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{birthday.userName}</p>
                          <p className="text-xs text-gray-500">{birthday.email}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-2 py-1 rounded">
                            {new Date(new Date().getFullYear(), birthday.month - 1, birthday.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-lg">🎂</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </SectionCard>
          )}

          {/* ── Quick Snapshot ────────────────────────────────────────────── */}
          <SectionCard title="Snapshot" icon={BarChart3} iconColor="text-gray-400">
            <div className="p-4 space-y-2">
              {[
                { label: 'Reopened bugs',  value: qualitySummary?.reopenedBugs ?? 0,
                  icon: <RotateCcw className="w-3.5 h-3.5 text-orange-400" />, color: 'text-orange-600' },
                { label: 'Avg fix days',
                  value: qualitySummary?.avgResolutionDays != null ? `${qualitySummary.avgResolutionDays.toFixed(1)}d` : '—',
                  icon: <Timer className="w-3.5 h-3.5 text-blue-400" />, color: 'text-blue-600' },
                { label: 'Team members',   value: (summary?.team as any)?.totalMembers ?? '—',
                  icon: <Users className="w-3.5 h-3.5 text-indigo-400" />, color: 'text-indigo-600' },
                { label: 'Repositories',   value: summary?.devops?.totalRepositories ?? '—',
                  icon: <Layers className="w-3.5 h-3.5 text-purple-400" />, color: 'text-purple-600' },
                { label: 'Open incidents', value: (summary?.support as any)?.openIncidents ?? 0,
                  icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />, color: 'text-red-600' },
                ...(userBirthday && userBirthday.days >= 0 ? [{
                  label: userBirthday.isToday ? '🎂 Birthday today!' : 'Days to birthday',
                  value: userBirthday.isToday ? '🎉' : `${userBirthday.days}d`,
                  icon: <Cake className="w-3.5 h-3.5 text-pink-400" />,
                  color: userBirthday.isToday ? 'text-pink-700 font-bold' : 'text-pink-600'
                }] : []),
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500">{icon}{label}</div>
                  <span className={clsx('text-sm font-bold', color)}>{loading ? '…' : value}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── Resources ─────────────────────────────────────────────────── */}
          <SectionCard title="Resources" icon={BookOpen} iconColor="text-amber-500">
            <div className="p-3 space-y-1">
              {[
                { label: 'Knowledge Base',  path: '/knowledge-center', icon: BookOpen,        color: 'text-amber-600 bg-amber-50' },
                { label: 'API Catalog',     path: '/tools',            icon: Code2,           color: 'text-blue-600 bg-blue-50' },
                { label: 'MCP Tools',       path: '/mcp-tools',        icon: Cpu,             color: 'text-violet-600 bg-violet-50' },
                { label: 'Automation Jobs', path: '/automation',       icon: Zap,             color: 'text-green-600 bg-green-50' },
                { label: 'Observability',   path: '/observability',    icon: Activity,        color: 'text-teal-600 bg-teal-50' },
              ].map(({ label, path, icon: Icon, color }) => (
                <button key={path} onClick={() => navigate(path)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={clsx('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{label}</span>
                  <ChevronRight className="w-3 h-3 text-gray-300 ml-auto" />
                </button>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  )
}
