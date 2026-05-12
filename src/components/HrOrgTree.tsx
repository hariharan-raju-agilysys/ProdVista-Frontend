/**
 * HrOrgTree — Interactive collapsible org chart tree
 *
 * Features
 * ─────────
 * • Load roots (top-level managers) or start from any employee
 * • Each card shows: name, designation, dept, team, project, activity, location
 * • Expand / collapse children with smooth animation
 * • Click employee name → drill-down: fetch their full sub-tree and push to a stack
 * • Breadcrumb navigation trail to go back up the stack
 * • Inline "Direct Reports" count badge per node
 * • Color-coded activity/project badges for quick scanning
 * • Search to jump directly to any employee
 */

import { useState, useCallback, useEffect } from 'react'
import {
  ChevronRight, ChevronDown, Users, Briefcase, MapPin,
  Zap, ArrowLeft, Search, Loader2, RefreshCw, Network,
  Activity, FolderOpen, GitBranch
} from 'lucide-react'
import type { OrgNode } from '../services/hrPortalService'
import * as hrService from '../services/hrPortalService'

// ──────────────────────────────────────────────────────────
// Small colour helpers for project / team / activity badges
// ──────────────────────────────────────────────────────────
const BADGE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
  'bg-rose-100 text-rose-700',
]
function badgeColor(text: string) {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash)
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length]
}

function initials(name: string) {
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

// ──────────────────────────────────────────────────────────
// Avatar
// ──────────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm'
  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${dims} rounded-full object-cover ring-2 ring-white`} />
  // Generate a stable bg color from name
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const bg = colors[Math.abs(hash) % colors.length]
  return (
    <div className={`${dims} ${bg} rounded-full flex items-center justify-center font-semibold text-white ring-2 ring-white shrink-0`}>
      {initials(name)}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Single tree node card
// ──────────────────────────────────────────────────────────
interface NodeCardProps {
  node: OrgNode
  depth: number
  onDrillDown: (node: OrgNode) => void
}

function NodeCard({ node, depth, onDrillDown }: NodeCardProps) {
  const hasChildren = (node.children && node.children.length > 0) || node.hasMore
  const [expanded, setExpanded] = useState(depth === 0) // auto-expand root level

  const childCount = node.children?.length ?? 0

  return (
    <div className="relative">
      {/* Connector line from parent */}
      {depth > 0 && (
        <div className="absolute left-0 top-0 -translate-x-full w-5 h-px bg-gray-300 top-5" />
      )}

      {/* Card */}
      <div className={`group border rounded-xl bg-white shadow-sm hover:shadow-md transition-all ${depth === 0 ? 'border-blue-200' : 'border-gray-200'}`}>
        <div className="flex items-start gap-3 p-3">
          {/* Expand / collapse toggle */}
          {hasChildren ? (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-gray-100 hover:bg-blue-100 flex items-center justify-center transition-colors"
            >
              {expanded
                ? <ChevronDown className="w-3 h-3 text-gray-600" />
                : <ChevronRight className="w-3 h-3 text-gray-600" />
              }
            </button>
          ) : (
            <div className="mt-0.5 shrink-0 w-5 h-5" /> // spacer
          )}

          <Avatar name={node.name} avatarUrl={node.avatarUrl} size="md" />

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <button
                onClick={() => onDrillDown(node)}
                className="text-sm font-semibold text-gray-900 hover:text-blue-600 text-left leading-snug transition-colors"
                title="Click to drill-down into this employee's team"
              >
                {node.name}
              </button>
              {childCount > 0 && (
                <span className="shrink-0 flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">
                  <Users className="w-3 h-3" />
                  {childCount}
                </span>
              )}
            </div>

            {node.designation && (
              <p className="text-xs text-gray-500 truncate">{node.designation}</p>
            )}

            {/* Badge row */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {node.department && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor(node.department)}`}>
                  <Briefcase className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                  {node.department}
                </span>
              )}
              {node.team && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor('t_' + node.team)}`}>
                  <GitBranch className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                  {node.team}
                </span>
              )}
              {node.project && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor('p_' + node.project)}`}>
                  <FolderOpen className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                  {node.project}
                </span>
              )}
              {node.activity && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${badgeColor('a_' + node.activity)}`}>
                  <Activity className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                  {node.activity}
                </span>
              )}
              {node.location && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                  <MapPin className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                  {node.location}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Children — vertical connector */}
      {expanded && node.children && node.children.length > 0 && (
        <div className="ml-6 mt-2 pl-5 border-l-2 border-gray-200 space-y-2">
          {node.children.map(child => (
            <NodeCard key={child.id} node={child} depth={depth + 1} onDrillDown={onDrillDown} />
          ))}
          {node.hasMore && (
            <button
              onClick={() => onDrillDown(node)}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 py-1"
            >
              <Network className="w-3 h-3" /> Drill down to see more levels…
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Analytics summary bar for a tree root
// ──────────────────────────────────────────────────────────
function TeamSummary({ root }: { root: OrgNode }) {
  // Walk tree to count members and aggregate project/activity/team
  const all: OrgNode[] = []
  const walk = (n: OrgNode) => { all.push(n); n.children?.forEach(walk) }
  walk(root)
  const total = all.length

  const byProject = Object.entries(
    all.filter(e => e.project).reduce<Record<string, number>>((acc, e) => { acc[e.project!] = (acc[e.project!] ?? 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const byTeam = Object.entries(
    all.filter(e => e.team).reduce<Record<string, number>>((acc, e) => { acc[e.team!] = (acc[e.team!] ?? 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const byActivity = Object.entries(
    all.filter(e => e.activity).reduce<Record<string, number>>((acc, e) => { acc[e.activity!] = (acc[e.activity!] ?? 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
      <div>
        <p className="text-gray-400 font-medium mb-1 uppercase tracking-wide text-[10px]">
          <Users className="w-3 h-3 inline mr-1 -mt-px" />Team ({total} people)
        </p>
        {byTeam.length ? byTeam.map(([t, c]) => (
          <div key={t} className="flex items-center justify-between mb-0.5">
            <span className={`px-1.5 py-0.5 rounded-full ${badgeColor('t_' + t)}`}>{t}</span>
            <span className="text-gray-500">{c}</span>
          </div>
        )) : <span className="text-gray-400 italic">—</span>}
      </div>
      <div>
        <p className="text-gray-400 font-medium mb-1 uppercase tracking-wide text-[10px]">
          <FolderOpen className="w-3 h-3 inline mr-1 -mt-px" />Projects
        </p>
        {byProject.length ? byProject.map(([p, c]) => (
          <div key={p} className="flex items-center justify-between mb-0.5">
            <span className={`px-1.5 py-0.5 rounded-full ${badgeColor('p_' + p)}`}>{p}</span>
            <span className="text-gray-500">{c}</span>
          </div>
        )) : <span className="text-gray-400 italic">—</span>}
      </div>
      <div>
        <p className="text-gray-400 font-medium mb-1 uppercase tracking-wide text-[10px]">
          <Activity className="w-3 h-3 inline mr-1 -mt-px" />Activities
        </p>
        {byActivity.length ? byActivity.map(([a, c]) => (
          <div key={a} className="flex items-center justify-between mb-0.5">
            <span className={`px-1.5 py-0.5 rounded-full ${badgeColor('a_' + a)}`}>{a}</span>
            <span className="text-gray-500">{c}</span>
          </div>
        )) : <span className="text-gray-400 italic">—</span>}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Main HrOrgTree export
// ──────────────────────────────────────────────────────────
interface HrOrgTreeProps {
  connectionId?: string
}

interface StackEntry {
  label: string        // breadcrumb label
  employeeId?: number  // if set, fetched as org-tree root; if unset = show roots list
}

export default function HrOrgTree({ connectionId }: HrOrgTreeProps) {
  // null = showing root list; OrgNode = showing a sub-tree
  const [rootsList, setRootsList] = useState<OrgNode[]>([])
  const [currentTree, setCurrentTree] = useState<OrgNode | null>(null)
  const [stack, setStack] = useState<StackEntry[]>([{ label: 'All Managers' }])
  const [loading, setLoading] = useState(false)
  const [treeLoading, setTreeLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveMsg, setResolveMsg] = useState<string | null>(null)

  const loadRoots = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const roots = await hrService.getOrgRoots(connectionId)
      setRootsList(roots)
    } catch {
      setError('Failed to load org chart roots. Make sure employees are imported and managers are resolved.')
    } finally {
      setLoading(false)
    }
  }, [connectionId])

  useEffect(() => { loadRoots() }, [loadRoots])

  const drillDown = useCallback(async (node: OrgNode) => {
    setTreeLoading(true)
    setError(null)
    try {
      const tree = await hrService.getOrgTree(node.employeeId, 5)
      setCurrentTree(tree)
      setStack(prev => [...prev, { label: node.name, employeeId: node.employeeId }])
    } catch {
      setError('Failed to load team tree for this employee.')
    } finally {
      setTreeLoading(false)
    }
  }, [])

  const navigateTo = useCallback(async (index: number) => {
    const entry = stack[index]
    const newStack = stack.slice(0, index + 1)
    setStack(newStack)
    if (!entry.employeeId) {
      setCurrentTree(null)
    } else {
      setTreeLoading(true)
      try {
        const tree = await hrService.getOrgTree(entry.employeeId, 5)
        setCurrentTree(tree)
      } finally {
        setTreeLoading(false)
      }
    }
  }, [stack])

  const handleResolve = async () => {
    setResolving(true)
    setResolveMsg(null)
    try {
      const result = await hrService.resolveManagers(connectionId)
      setResolveMsg(`${result.resolved} manager links resolved`)
      await loadRoots()
    } catch {
      setResolveMsg('Resolution failed')
    } finally {
      setResolving(false)
    }
  }

  // Filter root list by search
  const filteredRoots = search.trim()
    ? rootsList.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.department?.toLowerCase().includes(search.toLowerCase()) ||
        r.designation?.toLowerCase().includes(search.toLowerCase())
      )
    : rootsList

  const isAtRoot = stack.length === 1

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {stack.map((entry, i) => (
            <span key={i} className="flex items-center gap-1 text-xs">
              {i > 0 && <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />}
              <button
                onClick={() => navigateTo(i)}
                className={`truncate max-w-[160px] font-medium transition-colors ${
                  i === stack.length - 1
                    ? 'text-blue-700 cursor-default'
                    : 'text-gray-500 hover:text-blue-600'
                }`}
              >
                {entry.label}
              </button>
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search managers…"
            className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
          />
        </div>

        {/* Resolve managers */}
        <button
          onClick={handleResolve}
          disabled={resolving}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
          title="Re-link ReportingToId → ManagerId for all employees"
        >
          {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          Resolve Links
        </button>

        {/* Refresh */}
        <button
          onClick={loadRoots}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {resolveMsg && (
        <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">{resolveMsg}</p>
      )}

      {/* Back button */}
      {!isAtRoot && (
        <button
          onClick={() => navigateTo(stack.length - 2)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
      )}

      {/* Loading */}
      {(loading || treeLoading) && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm">Loading org chart…</span>
        </div>
      )}

      {/* ROOT LIST VIEW */}
      {!loading && !treeLoading && isAtRoot && !currentTree && (
        <>
          {rootsList.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Network className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No org chart data yet</p>
              <p className="text-xs mt-1">Import employees and click <strong>Resolve Links</strong> to build the hierarchy.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredRoots.map(root => (
                <button
                  key={root.id}
                  onClick={() => drillDown(root)}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left group"
                >
                  <Avatar name={root.name} avatarUrl={root.avatarUrl} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 truncate">{root.name}</p>
                    {root.designation && <p className="text-xs text-gray-500 truncate">{root.designation}</p>}
                    {root.department && <p className="text-xs text-gray-400 truncate">{root.department}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {root.team && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${badgeColor('t_' + root.team)}`}>{root.team}</span>
                      )}
                      {root.project && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${badgeColor('p_' + root.project)}`}>{root.project}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-blue-600">
                      {(root as OrgNode & { directReportsCount?: number }).directReportsCount ?? '?'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* DRILL-DOWN TREE VIEW */}
      {!loading && !treeLoading && currentTree && (
        <div className="space-y-3">
          {/* Analytics summary */}
          <TeamSummary root={currentTree} />

          {/* Tree */}
          <div className="space-y-2">
            <NodeCard node={currentTree} depth={0} onDrillDown={drillDown} />
          </div>
        </div>
      )}
    </div>
  )
}
