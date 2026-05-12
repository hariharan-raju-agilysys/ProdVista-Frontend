import { useState, useEffect, useCallback } from 'react'
import {
  Users, GitPullRequest, GitCommit, Star, AlertTriangle,
  Trophy, BarChart3, X, ChevronUp, ChevronDown,
  RefreshCw, TrendingUp, Eye, Filter, ShieldCheck, ChevronRight
} from 'lucide-react'
import devEfficiencyService, {
  DeveloperEfficiencyDto,
  DevEfficiencyTeamResponse,
  DevOpsConnectionSummary,
  DirectorSummary
} from '../services/devEfficiencyService'
import { useAuth } from '../context/AuthContext'

// ── Helpers ──────────────────────────────────────────────────────────────────

function avatarLetters(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function avatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
    'bg-teal-500', 'bg-orange-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function rankBadgeStyle(rank: number): string {
  if (rank === 1) return 'bg-yellow-400 text-yellow-900 border-yellow-500'
  if (rank === 2) return 'bg-gray-300 text-gray-800 border-gray-400'
  if (rank === 3) return 'bg-amber-600 text-white border-amber-700'
  return 'bg-gray-700 text-gray-300 border-gray-600'
}

type SortKey = 'rank' | 'name' | 'prsMerged' | 'commitsCount' | 'reviewsDone' | 'efficiencyScore'

// ── Developer Card ────────────────────────────────────────────────────────────

function DeveloperCard({ dev, maxScore }: { dev: DeveloperEfficiencyDto; maxScore: number }) {
  const pct = maxScore > 0 ? Math.min((dev.efficiencyScore / maxScore) * 100, 100) : 0

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 hover:border-blue-500/50 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className={`w-11 h-11 rounded-full ${avatarColor(dev.name)} flex items-center justify-center text-white font-bold text-sm`}>
            {avatarLetters(dev.name)}
          </div>
          <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center ${rankBadgeStyle(dev.rank)}`}>
            {dev.rank <= 3 ? ['🥇','🥈','🥉'][dev.rank - 1] : dev.rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-semibold text-sm truncate">{dev.name}</p>
          <p className="text-gray-400 text-xs truncate">{dev.designation || dev.department || 'Developer'}</p>
          {dev.department && dev.designation && (
            <p className="text-gray-500 text-xs truncate">{dev.department}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-blue-400 font-bold text-lg leading-none">{dev.efficiencyScore}</p>
          <p className="text-gray-500 text-[10px]">score</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="w-full bg-gray-700 rounded-full h-1.5">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div className="bg-gray-750 rounded-lg p-1.5">
          <p className="text-emerald-400 font-bold text-base leading-none">{dev.prsMerged}</p>
          <p className="text-gray-500 text-[10px] mt-0.5">PRs</p>
        </div>
        <div className="bg-gray-750 rounded-lg p-1.5">
          <p className="text-violet-400 font-bold text-base leading-none">{dev.commitsCount}</p>
          <p className="text-gray-500 text-[10px] mt-0.5">Commits</p>
        </div>
        <div className="bg-gray-750 rounded-lg p-1.5">
          <p className="text-amber-400 font-bold text-base leading-none">{dev.reviewsDone}</p>
          <p className="text-gray-500 text-[10px] mt-0.5">Reviews</p>
        </div>
      </div>
    </div>
  )
}

// ── All Developers Modal ──────────────────────────────────────────────────────

function AllDevelopersModal({
  developers,
  onClose,
}: {
  developers: DeveloperEfficiencyDto[]
  onClose: () => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortAsc, setSortAsc] = useState(true)
  const [search, setSearch] = useState('')

  const sorted = [...developers]
    .filter(d => d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase()) ||
      (d.department ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let diff = 0
      if (sortKey === 'name') diff = a.name.localeCompare(b.name)
      else if (sortKey === 'rank') diff = a.rank - b.rank
      else diff = (a[sortKey] as number) - (b[sortKey] as number)
      return sortAsc ? diff : -diff
    })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-gray-600" />
    return sortAsc ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />
  }

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="px-3 py-2 text-left text-gray-400 text-xs font-medium cursor-pointer hover:text-white select-none"
        onClick={() => toggleSort(col)}
      >
        <span className="flex items-center gap-1">{label} <SortIcon col={col} /></span>
      </th>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div>
            <h2 className="text-white font-semibold text-lg">All Developers</h2>
            <p className="text-gray-400 text-sm">{developers.length} developers across your team</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2">
          <input
            type="text"
            placeholder="Search by name, email or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 px-5 pb-5">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr>
                <Th col="rank" label="Rank" />
                <Th col="name" label="Developer" />
                <th className="px-3 py-2 text-left text-gray-400 text-xs font-medium">Department</th>
                <Th col="prsMerged" label="PRs Merged" />
                <th className="px-3 py-2 text-left text-gray-400 text-xs font-medium">PRs Open</th>
                <Th col="commitsCount" label="Commits" />
                <Th col="reviewsDone" label="Reviews" />
                <Th col="efficiencyScore" label="Score" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(dev => (
                <tr key={dev.email} className="border-t border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-[10px] font-bold ${rankBadgeStyle(dev.rank)}`}>
                      {dev.rank}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full ${avatarColor(dev.name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                        {avatarLetters(dev.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs font-medium truncate">{dev.name}</p>
                        <p className="text-gray-500 text-[10px] truncate">{dev.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{dev.department ?? '—'}</td>
                  <td className="px-3 py-2 text-emerald-400 font-semibold">{dev.prsMerged}</td>
                  <td className="px-3 py-2 text-gray-400">{dev.prsOpen}</td>
                  <td className="px-3 py-2 text-violet-400 font-semibold">{dev.commitsCount}</td>
                  <td className="px-3 py-2 text-amber-400 font-semibold">{dev.reviewsDone}</td>
                  <td className="px-3 py-2">
                    <span className="text-blue-400 font-bold">{dev.efficiencyScore}</span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">No developers found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DevEfficiencyPage() {
  const { isAdmin } = useAuth()

  // Filters
  const [days, setDays] = useState(30)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | undefined>(undefined)
  const [selectedDirectorId, setSelectedDirectorId] = useState<number | undefined>(undefined)

  // Data
  const [connections, setConnections] = useState<DevOpsConnectionSummary[]>([])
  const [directors, setDirectors] = useState<DirectorSummary[]>([])
  const [data, setData] = useState<DevEfficiencyTeamResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  // Load connections (all roles)
  const loadConnections = useCallback(async () => {
    try {
      const res = await devEfficiencyService.getConnections()
      setConnections(res.data)
    } catch { /* Non-critical */ }
  }, [])

  // Load directors list (admin only)
  const loadDirectors = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await devEfficiencyService.getDirectors()
      setDirectors(res.data)
    } catch { /* Non-critical */ }
  }, [isAdmin])

  // Fetch efficiency data
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await devEfficiencyService.getTeamEfficiency(
        days,
        selectedConnectionId,
        // Admin: pass selected director's employeeId; if none selected yet, don't send (returns own team)
        isAdmin ? selectedDirectorId : undefined
      )
      setData(res.data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string; title?: string } } })
        ?.response?.data?.message
        ?? (err as { response?: { data?: { title?: string } } })?.response?.data?.title
        ?? 'Failed to load team efficiency data.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [days, selectedConnectionId, selectedDirectorId, isAdmin])

  useEffect(() => { loadConnections(); loadDirectors() }, [loadConnections, loadDirectors])
  useEffect(() => { loadData() }, [loadData])

  const developers = data?.developers ?? []
  const topDevelopers = data?.topDevelopers ?? []
  const maxScore = developers.length > 0 ? Math.max(...developers.map(d => d.efficiencyScore), 1) : 1
  const rootEmployee = data?.rootEmployee

  const selectedDirector = directors.find(d => d.employeeId === selectedDirectorId)

  const DAY_OPTIONS = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '60 days', value: 60 },
    { label: '90 days', value: 90 },
    { label: '180 days', value: 180 },
  ]

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-400" />
            Developer Efficiency
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {isAdmin
              ? 'Admin view — select a Director to see their full reporting hierarchy'
              : 'Efficiency metrics for your direct and indirect reports'}
            {data?.projectName && <span className="text-blue-400 ml-1">— {data.projectName}</span>}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Days filter */}
          <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            {DAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  days === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Connection filter */}
          {connections.length > 1 && (
            <select
              value={selectedConnectionId ?? ''}
              onChange={e => setSelectedConnectionId(e.target.value || undefined)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="">All connections</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.connectionName} / {c.projectName}</option>
              ))}
            </select>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg text-gray-300 text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Admin: Director picker ─────────────────────────────────────────── */}
      {isAdmin && (
        <div className="bg-gray-800/60 border border-indigo-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="text-indigo-300 text-sm font-medium">Admin — View hierarchy by Director</span>
          </div>

          {directors.length === 0 ? (
            <p className="text-gray-500 text-xs">
              No employees with "Director" designation found in HR data. Ensure HR sync is configured and designations are set.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* "My Team" chip — clears director selection */}
              <button
                onClick={() => setSelectedDirectorId(undefined)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  selectedDirectorId == null
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-indigo-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                My Team
              </button>

              {directors.map(dir => (
                <button
                  key={dir.employeeId}
                  onClick={() => setSelectedDirectorId(dir.employeeId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedDirectorId === dir.employeeId
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-indigo-400 hover:text-white'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full ${avatarColor(dir.name)} flex items-center justify-center text-[9px] font-bold text-white`}>
                    {avatarLetters(dir.name)}
                  </div>
                  {dir.name}
                  {dir.department && <span className="text-gray-400 font-normal">· {dir.department}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Root employee breadcrumb banner ───────────────────────────────── */}
      {rootEmployee && (
        <div className="flex items-center gap-3 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
          <div className={`w-10 h-10 rounded-full ${avatarColor(rootEmployee.name)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
            {avatarLetters(rootEmployee.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-semibold text-sm">{rootEmployee.name}</p>
              {rootEmployee.designation && (
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] rounded-full border border-indigo-500/30">
                  {rootEmployee.designation}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5 flex-wrap">
              {rootEmployee.department && <span>{rootEmployee.department}</span>}
              {rootEmployee.department && rootEmployee.reportingTo && <ChevronRight className="w-3 h-3" />}
              {rootEmployee.reportingTo && <span>Reports to: {rootEmployee.reportingTo}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-gray-400 text-xs">Hierarchy depth</p>
            <p className="text-white font-bold text-sm">{developers.length} developers</p>
          </div>
        </div>
      )}

      {/* Warning banner */}
      {data?.warning && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{data.warning}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={<Users className="w-5 h-5 text-blue-400" />}
              label="Total Developers"
              value={data.totalDevelopers}
              bg="bg-blue-500/10"
            />
            <StatCard
              icon={<GitPullRequest className="w-5 h-5 text-emerald-400" />}
              label="PRs Merged"
              value={data.totalPrsMerged}
              sub={`last ${days}d`}
              bg="bg-emerald-500/10"
            />
            <StatCard
              icon={<GitCommit className="w-5 h-5 text-violet-400" />}
              label="Total Commits"
              value={data.totalCommits}
              sub={`last ${days}d`}
              bg="bg-violet-500/10"
            />
            <StatCard
              icon={<Star className="w-5 h-5 text-amber-400" />}
              label="Code Reviews"
              value={data.totalReviews}
              sub={`last ${days}d`}
              bg="bg-amber-500/10"
            />
          </div>

          {/* Top performers */}
          {topDevelopers.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Top Performers
                  {selectedDirector && (
                    <span className="text-gray-400 text-sm font-normal">
                      under <span className="text-indigo-300">{selectedDirector.name}</span>
                    </span>
                  )}
                  <span className="text-gray-500 text-sm font-normal hidden md:inline">— score: PRs×3 + Commits×1 + Reviews×2</span>
                </h2>
                {developers.length > 8 && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View all {developers.length}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {topDevelopers.map(dev => (
                  <DeveloperCard key={dev.email} dev={dev} maxScore={maxScore} />
                ))}
              </div>

              {developers.length > 8 && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-xl text-white text-sm font-medium transition-colors"
                  >
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    View all {developers.length} developers
                  </button>
                </div>
              )}
            </div>
          ) : (
            !loading && !data.warning && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-500">
                <Filter className="w-12 h-12 opacity-30" />
                <p className="text-lg">No developer data available</p>
                <p className="text-sm text-gray-600">
                  {isAdmin
                    ? 'Select a Director above to view their team hierarchy'
                    : 'Try increasing the date range or check your HR sync configuration'}
                </p>
              </div>
            )
          )}
        </>
      )}

      {/* Score formula legend */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-xs text-gray-500">
        <span className="font-medium text-gray-400">Efficiency Score formula: </span>
        <span className="text-emerald-400">PRs Merged ×3</span>
        {' + '}
        <span className="text-violet-400">Commits ×1</span>
        {' + '}
        <span className="text-amber-400">Code Reviews ×2</span>
        {data?.fromDate && (
          <span className="ml-4">
            Period: {new Date(data.fromDate).toLocaleDateString()} – {new Date(data.toDate).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* All developers modal */}
      {showAll && developers.length > 0 && (
        <AllDevelopersModal developers={developers} onClose={() => setShowAll(false)} />
      )}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, bg
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub?: string
  bg: string
}) {
  return (
    <div className={`${bg} border border-gray-700 rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-gray-400 text-xs">{label}</span>
      </div>
      <p className="text-white font-bold text-2xl leading-none">{value.toLocaleString()}</p>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
    </div>
  )
}
