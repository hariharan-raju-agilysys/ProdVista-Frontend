import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, GitPullRequest, Bug, Star, AlertTriangle,
  Trophy, BarChart3, X, ChevronUp, ChevronDown,
  RefreshCw, TrendingUp, Eye, Filter, ShieldCheck, ChevronRight,
  UsersRound, GitBranch, Clock,
} from 'lucide-react'
import devEfficiencyService, {
  DeveloperEfficiencyDto,
  DevEfficiencyTeamResponse,
  DevOpsConnectionSummary,
} from '../services/devEfficiencyService'
import { useDevHierarchy } from '../hooks/useDevHierarchy'

// ── Helpers ──────────────────────────────────────────────────────────────────

function avatarLetters(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function avatarGradient(name: string): string {
  const gradients = [
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-cyan-500 to-blue-600',
    'from-fuchsia-500 to-pink-600',
    'from-indigo-500 to-violet-600',
    'from-teal-500 to-emerald-600',
    'from-orange-500 to-red-600',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return gradients[Math.abs(hash) % gradients.length]
}

function rankBadgeStyle(rank: number): string {
  if (rank === 1) return 'bg-gradient-to-br from-yellow-300 to-amber-500 text-yellow-900 shadow-lg shadow-yellow-500/30'
  if (rank === 2) return 'bg-gradient-to-br from-gray-200 to-gray-400 text-gray-800 shadow-lg shadow-gray-400/30'
  if (rank === 3) return 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30'
  return 'bg-gray-100 text-gray-600 border border-gray-200'
}

type SortKey = 'rank' | 'name' | 'prsMerged' | 'bugsResolved' | 'reviewsDone' | 'efficiencyScore'

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.92 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

// ── Developer Card (Premium Glass) ────────────────────────────────────────────

function DeveloperCard({ dev, maxScore, index }: { dev: DeveloperEfficiencyDto; maxScore: number; index: number }) {
  const pct = maxScore > 0 ? Math.min((dev.efficiencyScore / maxScore) * 100, 100) : 0
  const isTop3 = dev.rank <= 3

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative group rounded-2xl p-[1px] transition-all duration-300 ${
        isTop3
          ? 'bg-gradient-to-br from-blue-500/40 via-purple-500/20 to-cyan-500/40'
          : 'bg-gradient-to-br from-gray-700/40 to-gray-800/40 hover:from-blue-500/30 hover:to-purple-500/30'
      }`}
    >
      {/* Inner content */}
      <div className="bg-[#0f1729]/90 backdrop-blur-xl rounded-2xl p-4 flex flex-col gap-3 h-full">
        {/* Glow overlay for top 3 */}
        {isTop3 && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none" />
        )}

        {/* Header */}
        <div className="flex items-start gap-3 relative">
          <div className="relative shrink-0">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarGradient(dev.name)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
              {avatarLetters(dev.name)}
            </div>
            <span className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${rankBadgeStyle(dev.rank)}`}>
              {dev.rank <= 3 ? ['🥇','🥈','🥉'][dev.rank - 1] : dev.rank}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate">{dev.name}</p>
            <p className="text-gray-400 text-xs truncate">{dev.designation || dev.department || 'Developer'}</p>
            {dev.department && dev.designation && (
              <p className="text-gray-500 text-[10px] truncate mt-0.5">{dev.department}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <motion.p
              className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-extrabold text-xl leading-none"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.07 + 0.3, type: 'spring', stiffness: 200 }}
            >
              {dev.efficiencyScore}
            </motion.p>
            <p className="text-gray-500 text-[10px] mt-0.5">score</p>
          </div>
        </div>

        {/* Score bar — animated gradient */}
        <div className="w-full bg-gray-800/80 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 relative"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, delay: index * 0.07 + 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </motion.div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <MetricPill value={dev.prsMerged} label="PRs" color="emerald" />
          <MetricPill value={dev.bugsResolved} label="Bugs" color="rose" />
          <MetricPill value={dev.reviewsDone} label="Reviews" color="amber" />
          <MetricPill value={dev.avgDaysToResolve > 0 ? dev.avgDaysToResolve : '—'} label="Days" color="cyan" />
        </div>
      </div>
    </motion.div>
  )
}

function MetricPill({ value, label, color }: { value: number | string; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  }
  return (
    <div className={`rounded-lg p-1.5 border ${colorMap[color]}`}>
      <p className={`font-bold text-sm leading-none ${colorMap[color].split(' ')[0]}`}>{value}</p>
      <p className="text-gray-500 text-[9px] mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ── Needs Attention Card (Warning Glass) ──────────────────────────────────────

function WorstDeveloperCard({ dev, maxScore, index }: { dev: DeveloperEfficiencyDto; maxScore: number; index: number }) {
  const pct = maxScore > 0 ? Math.min((dev.efficiencyScore / maxScore) * 100, 100) : 0

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -3 }}
      className="relative rounded-2xl p-[1px] bg-gradient-to-br from-amber-500/30 via-orange-500/10 to-red-500/30 hover:from-amber-500/50 hover:to-red-500/50 transition-all duration-300"
    >
      <div className="bg-[#0f1729]/90 backdrop-blur-xl rounded-2xl p-4 flex flex-col gap-3 h-full">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(dev.name)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
              {avatarLetters(dev.name)}
            </div>
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[10px] font-bold flex items-center justify-center text-white shadow-md">
              {dev.rank}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate">{dev.name}</p>
            <p className="text-gray-400 text-xs truncate">{dev.designation || dev.department || 'Developer'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-amber-400 font-bold text-lg leading-none">{dev.efficiencyScore}</p>
            <p className="text-gray-500 text-[10px]">score</p>
          </div>
        </div>

        <div className="w-full bg-gray-800/80 rounded-full h-1.5 overflow-hidden">
          <motion.div
            className="bg-gradient-to-r from-amber-500 to-red-500 h-1.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: index * 0.06 + 0.3 }}
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <MetricPill value={dev.prsMerged} label="PRs" color="emerald" />
          <MetricPill value={dev.bugsResolved} label="Bugs" color="rose" />
          <MetricPill value={dev.reviewsDone} label="Reviews" color="amber" />
        </div>
      </div>
    </motion.div>
  )
}

// ── All Developers Modal (Premium) ────────────────────────────────────────────

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
        className="px-3 py-2.5 text-left text-gray-400 text-xs font-medium cursor-pointer hover:text-white select-none transition-colors"
        onClick={() => toggleSort(col)}
      >
        <span className="flex items-center gap-1">{label} <SortIcon col={col} /></span>
      </th>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-[#0a0f1e]/95 backdrop-blur-2xl border border-gray-700/30 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl shadow-blue-900/10 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Gradient border glow */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none" />

          {/* Modal header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800/50 relative">
            <div>
              <h2 className="text-white font-bold text-xl">All Developers</h2>
              <p className="text-gray-400 text-sm mt-0.5">{developers.length} engineers across your organization</p>
            </div>
            <button onClick={onClose} className="p-2.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all border border-transparent hover:border-gray-700/50">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 pt-4 pb-2 relative">
            <input
              type="text"
              placeholder="Search by name, email or department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-700/40 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1 px-6 pb-6">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0a0f1e]/95 backdrop-blur-xl z-10">
                <tr className="border-b border-gray-800/50">
                  <Th col="rank" label="Rank" />
                  <Th col="name" label="Developer" />
                  <th className="px-3 py-2.5 text-left text-gray-400 text-xs font-medium">Department</th>
                  <Th col="prsMerged" label="PRs Merged" />
                  <Th col="bugsResolved" label="Bugs Fixed" />
                  <Th col="reviewsDone" label="Reviews" />
                  <th className="px-3 py-2.5 text-left text-gray-400 text-xs font-medium">Avg Days</th>
                  <Th col="efficiencyScore" label="Score" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((dev, i) => (
                  <motion.tr
                    key={dev.email}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-t border-gray-800/30 hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${rankBadgeStyle(dev.rank)}`}>
                        {dev.rank}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(dev.name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm`}>
                          {avatarLetters(dev.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-xs font-medium truncate group-hover:text-blue-300 transition-colors">{dev.name}</p>
                          <p className="text-gray-500 text-[10px] truncate">{dev.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">{dev.department ?? '—'}</td>
                    <td className="px-3 py-2.5 text-emerald-400 font-semibold">{dev.prsMerged}</td>
                    <td className="px-3 py-2.5 text-rose-400 font-semibold">{dev.bugsResolved}</td>
                    <td className="px-3 py-2.5 text-amber-400 font-semibold">{dev.reviewsDone}</td>
                    <td className="px-3 py-2.5 text-cyan-400 text-xs">{dev.avgDaysToResolve > 0 ? `${dev.avgDaysToResolve}d` : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-bold">{dev.efficiencyScore}</span>
                    </td>
                  </motion.tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-gray-500">No developers found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DevEfficiencyPage() {
  const {
    hierarchyEmails,
    selectedDirector,
    directors,
    isLoading: hierarchyLoading,
    error: hierarchyError,
    isAdmin,
    selectDirector,
    clearSelection,
  } = useDevHierarchy()

  // Filters
  const [days, setDays] = useState(30)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | undefined>(undefined)
  const [targetBranch, setTargetBranch] = useState<string | undefined>(undefined)

  // Repository/Branch data
  const [repositories, setRepositories] = useState<{ id: string; name: string; defaultBranch: string; branches: string[] }[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string | undefined>(undefined)

  // Data
  const [connections, setConnections] = useState<DevOpsConnectionSummary[]>([])
  const [data, setData] = useState<DevEfficiencyTeamResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  // Load connections
  useEffect(() => {
    devEfficiencyService.getConnections()
      .then(res => setConnections(res.data))
      .catch(() => {/* Non-critical */})
  }, [])

  // Load repositories when connection changes
  useEffect(() => {
    devEfficiencyService.getRepositories(selectedConnectionId)
      .then(res => {
        setRepositories(res.data)
        setSelectedRepo(undefined)
        setTargetBranch(undefined)
      })
      .catch(() => setRepositories([]))
  }, [selectedConnectionId])

  // When repo changes, default to its default branch
  useEffect(() => {
    if (selectedRepo) {
      const repo = repositories.find(r => r.id === selectedRepo)
      if (repo) setTargetBranch(repo.defaultBranch || undefined)
    } else {
      setTargetBranch(undefined)
    }
  }, [selectedRepo, repositories])

  const loadData = useCallback(async () => {
    if (isAdmin && !selectedDirector) return

    setLoading(true)
    setError(null)
    try {
      // Try stored snapshots first (instant load, no DevOps API calls)
      const snapRes = await devEfficiencyService.getSnapshots(selectedConnectionId, days)
      if (snapRes.data && !snapRes.data.warning && snapRes.data.developers?.length > 0) {
        setData(snapRes.data)
        return
      }
      // Fall back to real-time DevOps API
      const res = await devEfficiencyService.getTeamEfficiency(
        days,
        selectedConnectionId,
        isAdmin ? selectedDirector?.employeeId : undefined,
        hierarchyEmails.length > 0 ? hierarchyEmails : undefined,
        targetBranch
      )
      setData(res.data)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; title?: string } } })
          ?.response?.data?.message ??
        (err as { response?: { data?: { title?: string } } })?.response?.data?.title ??
        'Failed to load team efficiency data.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [days, selectedConnectionId, selectedDirector, isAdmin, targetBranch, hierarchyEmails])

  // Refresh always hits real-time DevOps API (bypasses stored snapshots)
  const refreshLive = useCallback(async () => {
    if (isAdmin && !selectedDirector) return

    setLoading(true)
    setError(null)
    try {
      const res = await devEfficiencyService.getTeamEfficiency(
        days,
        selectedConnectionId,
        isAdmin ? selectedDirector?.employeeId : undefined,
        hierarchyEmails.length > 0 ? hierarchyEmails : undefined,
        targetBranch
      )
      setData(res.data)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; title?: string } } })
          ?.response?.data?.message ??
        (err as { response?: { data?: { title?: string } } })?.response?.data?.title ??
        'Failed to load team efficiency data.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [days, selectedConnectionId, selectedDirector, isAdmin, targetBranch, hierarchyEmails])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!hierarchyLoading) loadData()
  }, [hierarchyEmails]) // eslint-disable-line react-hooks/exhaustive-deps

  const developers = data?.developers ?? []
  const topDevelopers = data?.topDevelopers ?? []
  const bottomDevelopers = data?.bottomDevelopers ?? []
  const maxScore = developers.length > 0 ? Math.max(...developers.map(d => d.efficiencyScore), 1) : 1
  const rootEmployee = data?.rootEmployee

  const combinedError = error ?? hierarchyError
  const combinedLoading = loading || hierarchyLoading

  const currentBranches = selectedRepo
    ? repositories.find(r => r.id === selectedRepo)?.branches ?? []
    : []

  const DAY_OPTIONS = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '60d', value: 60 },
    { label: '90d', value: 90 },
    { label: '180d', value: 180 },
  ]

  return (
    <div className="px-4 sm:px-6 py-6 max-w-[1600px] mx-auto min-h-screen space-y-6 bg-gradient-to-br from-gray-50 via-white to-blue-50/30">

      {/* Header */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Developer Effectiveness</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1.5 ml-12">
            {isAdmin
              ? selectedDirector
                ? <>Viewing hierarchy under <span className="text-indigo-600 font-medium">{selectedDirector.name}</span></>
                : 'Admin view — select a Director to scope the metrics'
              : 'Bug resolution speed, PRs merged & code reviews for your team'}
            {data?.projectName && <span className="text-blue-600 ml-1">— {data.projectName}</span>}
            {data?.targetBranch && <span className="text-cyan-600 ml-1">({data.targetBranch})</span>}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {DAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  days === opt.value
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={refreshLive}
            disabled={combinedLoading || (isAdmin && !selectedDirector)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0f1729]/80 border border-gray-700/40 hover:border-blue-500/50 rounded-xl text-gray-300 text-xs transition-all disabled:opacity-50 backdrop-blur-sm hover:shadow-md hover:shadow-blue-900/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${combinedLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* ── Branch & Connection Filter Bar ──────────────────────────────────── */}
      <motion.div {...fadeUp} className="flex items-center gap-3 flex-wrap">
        {/* Connection */}
        {connections.length > 0 && (
          <select
            value={selectedConnectionId ?? ''}
            onChange={e => setSelectedConnectionId(e.target.value || undefined)}
            className="bg-[#0f1729]/80 border border-gray-700/40 rounded-xl px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 min-w-[160px] backdrop-blur-sm transition-all"
          >
            <option value="">All connections</option>
            {connections.map(c => (
              <option key={c.id} value={c.id}>{c.connectionName} / {c.projectName}</option>
            ))}
          </select>
        )}

        {/* Repository */}
        {repositories.length > 0 && (
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={selectedRepo ?? ''}
              onChange={e => setSelectedRepo(e.target.value || undefined)}
              className="bg-[#0f1729]/80 border border-gray-700/40 rounded-xl px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 min-w-[140px] backdrop-blur-sm transition-all"
            >
              <option value="">All repos</option>
              {repositories.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Branch */}
        {currentBranches.length > 0 && (
          <select
            value={targetBranch ?? ''}
            onChange={e => setTargetBranch(e.target.value || undefined)}
            className="bg-[#0f1729]/80 border border-gray-700/40 rounded-xl px-3 py-2 text-gray-300 text-xs focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 min-w-[140px] backdrop-blur-sm transition-all"
          >
            <option value="">All branches</option>
            {currentBranches.map(b => (
              <option key={b} value={b}>{b.replace('refs/heads/', '')}</option>
            ))}
          </select>
        )}

        {targetBranch && (
          <span className="bg-cyan-500/20 text-cyan-300 rounded-full px-2 py-0.5 text-xs flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            {targetBranch.replace('refs/heads/', '')}
            <button onClick={() => setTargetBranch(undefined)} className="ml-0.5 hover:text-white"><X className="w-3 h-3" /></button>
          </span>
        )}
      </motion.div>

      {/* ── Admin: Director picker ─────────────────────────────────────────── */}
      {isAdmin && (
        <motion.div {...fadeUp} className="relative rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500/30 via-purple-500/10 to-blue-500/30">
          <div className="bg-[#0a0f1e]/95 backdrop-blur-xl rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-300 text-sm font-medium">Admin — View hierarchy by Director</span>
              {selectedDirector && (
                <button
                  onClick={clearSelection}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

          {directors.length === 0 ? (
            hierarchyLoading ? (
              <div className="flex gap-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-7 w-28 bg-gray-700/50 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <p className="text-gray-500 text-xs">
                No employees with "Director" designation found in HR data. Ensure HR sync is configured.
              </p>
            )
          ) : (
            <div className="flex flex-wrap gap-2">
              {directors.map(dir => (
                <button
                  key={dir.employeeId}
                  onClick={() => selectDirector(dir)}
                  disabled={hierarchyLoading}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all disabled:opacity-60 ${
                    selectedDirector?.employeeId === dir.employeeId
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-500/50 text-white shadow-lg shadow-indigo-600/25'
                      : 'bg-[#0f1729]/80 border-gray-700/40 text-gray-300 hover:border-indigo-400/50 hover:text-white hover:shadow-md hover:shadow-indigo-900/10'
                  }`}
                >
                  {hierarchyLoading && selectedDirector?.employeeId === dir.employeeId ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarGradient(dir.name)} flex items-center justify-center text-[9px] font-bold text-white`}>
                      {avatarLetters(dir.name)}
                    </div>
                  )}
                  {dir.name}
                  {dir.department && <span className="text-gray-400 font-normal">· {dir.department}</span>}
                </button>
              ))}
            </div>
          )}
          </div>
        </motion.div>
      )}

      {/* Admin: no director selected */}
      {isAdmin && !selectedDirector && !hierarchyLoading && (
        <motion.div {...fadeUp} className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
          <UsersRound className="w-16 h-16 opacity-20" />
          <p className="text-xl text-gray-400 font-medium">Select a Director to get started</p>
          <p className="text-sm text-gray-600 max-w-sm text-center">
            Pick a Director above to load their full reporting hierarchy and developer effectiveness metrics.
          </p>
        </motion.div>
      )}

      {/* Root employee banner */}
      {rootEmployee && (
        <motion.div {...fadeUp} className="relative rounded-2xl p-[1px] bg-gradient-to-r from-indigo-500/30 via-purple-500/20 to-blue-500/30">
          <div className="flex items-center gap-3 bg-[#0a0f1e]/95 backdrop-blur-xl rounded-2xl px-5 py-4">
            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(rootEmployee.name)} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg`}>
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
              <p className="text-gray-400 text-xs">Developers</p>
              <p className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 font-bold text-lg">{developers.length}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Warning / Error banners */}
      {data?.warning && (
        <motion.div {...fadeUp} className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-300 text-sm backdrop-blur">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{data.warning}</span>
        </motion.div>
      )}
      {combinedError && (
        <motion.div {...fadeUp} className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm backdrop-blur">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{combinedError}</span>
        </motion.div>
      )}

      {/* Loading skeleton */}
      {combinedLoading && !data && (isAdmin ? !!selectedDirector : true) && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-800/30 rounded-xl h-28 animate-pulse border border-gray-700/30" />
          ))}
        </div>
      )}

      {data && (!isAdmin || selectedDirector) && (
        <>
          {/* Summary stat cards */}
          <motion.div {...fadeUp} className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Developers"
              value={data.totalDevelopers}
              gradient="from-blue-600 to-blue-700"
            />
            <StatCard
              icon={<GitPullRequest className="w-5 h-5" />}
              label="PRs Merged"
              value={data.totalPrsMerged}
              sub={`${days}d`}
              gradient="from-emerald-600 to-emerald-700"
            />
            <StatCard
              icon={<Bug className="w-5 h-5" />}
              label="Bugs Resolved"
              value={data.totalBugsResolved}
              sub={`${days}d`}
              gradient="from-rose-600 to-rose-700"
            />
            <StatCard
              icon={<Star className="w-5 h-5" />}
              label="Code Reviews"
              value={data.totalReviews}
              sub={`${days}d`}
              gradient="from-amber-600 to-amber-700"
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="Avg Resolution"
              value={developers.length > 0
                ? Math.round(developers.reduce((s, d) => s + d.avgDaysToResolve, 0) / Math.max(developers.filter(d => d.avgDaysToResolve > 0).length, 1))
                : 0}
              sub="days"
              gradient="from-cyan-600 to-cyan-700"
            />
          </motion.div>

          {/* Top performers */}
          {topDevelopers.length > 0 ? (
            <motion.div {...fadeUp}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-white font-bold text-lg flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg shadow-amber-500/20">
                    <Trophy className="w-4 h-4 text-white" />
                  </div>
                  Top Performers
                  {selectedDirector && (
                    <span className="text-gray-400 text-sm font-normal">
                      under <span className="text-indigo-300">{selectedDirector.name}</span>
                    </span>
                  )}
                  <span className="text-gray-600 text-xs font-normal hidden md:inline ml-1">PRs×3 + Bugs×4 + Reviews×2</span>
                </h2>
                {developers.length > 8 && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-500/10"
                  >
                    <Eye className="w-4 h-4" />
                    View all {developers.length}
                  </button>
                )}
              </div>

              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {topDevelopers.map((dev, i) => (
                  <DeveloperCard key={dev.email} dev={dev} maxScore={maxScore} index={i} />
                ))}
              </motion.div>

              {developers.length > 8 && (
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={() => setShowAll(true)}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-medium transition-all bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/20"
                  >
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    View all {developers.length} developers
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            !loading && !data.warning && (
              <motion.div {...fadeUp} className="flex flex-col items-center justify-center py-20 gap-4 text-gray-500">
                <Filter className="w-12 h-12 opacity-30" />
                <p className="text-lg text-gray-400">No developer data available</p>
                <p className="text-sm text-gray-600">
                  Try increasing the date range or check your HR sync and Azure DevOps configuration.
                </p>
              </motion.div>
            )
          )}

          {/* Needs Attention — bottom performers */}
          {bottomDevelopers.length > 0 && (
            <motion.div {...fadeUp}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-white font-bold text-lg flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 shadow-lg shadow-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  Needs Attention
                  <span className="text-gray-600 text-xs font-normal hidden md:inline ml-1">
                    rank {bottomDevelopers[bottomDevelopers.length - 1]?.rank}–{bottomDevelopers[0]?.rank}
                  </span>
                </h2>
              </div>
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
              >
                {bottomDevelopers.map((dev, i) => (
                  <WorstDeveloperCard key={dev.email} dev={dev} maxScore={maxScore} index={i} />
                ))}
              </motion.div>
            </motion.div>
          )}
        </>
      )}

      {/* Score formula legend */}
      <motion.div {...fadeUp} className="relative rounded-2xl p-[1px] bg-gradient-to-r from-gray-700/30 via-gray-600/20 to-gray-700/30">
        <div className="bg-[#0a0f1e]/90 backdrop-blur-xl rounded-2xl px-5 py-4 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="font-semibold text-gray-300 uppercase tracking-wider text-[10px]">Score Formula</span>
          <span className="w-px h-4 bg-gray-700/50" />
          <span className="text-emerald-400 font-medium">PRs Merged ×3</span>
          <span className="text-gray-600">+</span>
          <span className="text-rose-400 font-medium">Bugs Resolved ×4</span>
          <span className="text-gray-600">+</span>
          <span className="text-amber-400 font-medium">Code Reviews ×2</span>
          {data?.fromDate && (
            <>
              <span className="w-px h-4 bg-gray-700/50 ml-2" />
              <span className="text-gray-600">
                {new Date(data.fromDate).toLocaleDateString()} – {new Date(data.toDate).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      </motion.div>

      {/* All developers modal */}
      {showAll && developers.length > 0 && (
        <AllDevelopersModal developers={developers} onClose={() => setShowAll(false)} />
      )}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, gradient
}: {
  icon: React.ReactNode
  label: string
  value: number
  sub?: string
  gradient: string
}) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-2xl p-[1px] bg-gradient-to-br from-gray-700/40 to-gray-800/40 hover:from-blue-500/30 hover:to-purple-500/30 transition-all"
    >
      <div className="bg-[#0f1729]/90 backdrop-blur-xl rounded-2xl p-5 relative overflow-hidden h-full">
        {/* Subtle gradient accent */}
        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${gradient} opacity-10 rounded-full -translate-y-10 translate-x-10 blur-md`} />
        <div className="flex items-center gap-2.5 mb-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} shadow-lg`}>
            {icon}
          </div>
          <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</span>
        </div>
        <motion.p
          className="text-white font-extrabold text-3xl leading-none"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {value.toLocaleString()}
        </motion.p>
        {sub && <p className="text-gray-500 text-xs mt-1.5">{sub}</p>}
      </div>
    </motion.div>
  )
}
