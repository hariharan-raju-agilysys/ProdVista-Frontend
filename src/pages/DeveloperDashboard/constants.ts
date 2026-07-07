import { Bot, Terminal, Activity, FileText, GitMerge, Cpu } from 'lucide-react'

export const AI_TOOLS = [
  { label: 'AI Chat',       sub: 'Ask anything',    icon: Bot,        path: '/ai-chat',           gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',  key: '⇧A' },
  { label: 'AI Query',      sub: 'Natural → SQL',   icon: Terminal,   path: '/ai-query',          gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',    key: '⇧Q' },
  { label: 'Observability', sub: 'KQL & logs',      icon: Activity,   path: '/observability',     gradient: 'bg-gradient-to-br from-teal-500 to-cyan-600',        key: '⇧O' },
  { label: 'Release Notes', sub: 'Auto-generate',   icon: FileText,   path: 'release-notes-redirect',     gradient: 'bg-gradient-to-br from-green-500 to-emerald-600',    key: '⇧R' },
  { label: 'DevOps',        sub: 'Pipelines & PRs', icon: GitMerge,   path: '/devops',            gradient: 'bg-gradient-to-br from-blue-500 to-indigo-600',      key: '⇧G' },
  { label: 'Dev Toolkit',   sub: 'Advanced tools',  icon: Cpu,        path: '/developer-toolkit', gradient: 'bg-gradient-to-br from-pink-500 to-rose-600',        key: '⇧D' },
]

export const PRIORITY_CFG = [
  { p: 1, label: 'P1 · Critical', short: 'P1', bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500',    flame: true  },
  { p: 2, label: 'P2 · High',     short: 'P2', bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400', flame: false },
  { p: 3, label: 'P3 · Medium',   short: 'P3', bar: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', flame: false },
  { p: 4, label: 'P4 · Low',      short: 'P4', bar: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-300',   flame: false },
]
