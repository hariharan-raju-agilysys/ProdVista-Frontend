import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, X, Loader2, FileText, GitBranch, HardDrive, User, Hash } from 'lucide-react'
import clsx from 'clsx'
import devIntelligenceService, { type GlobalSearchResult, type SearchHit } from '../../services/devIntelligenceService'

interface CommandBarProps {
  className?: string
}

const HIT_ICONS: Record<string, React.ReactNode> = {
  BranchMapping: <GitBranch className="w-4 h-4 text-green-500" />,
  TeamMember: <User className="w-4 h-4 text-blue-500" />,
  BuildHealth: <HardDrive className="w-4 h-4 text-orange-500" />,
  WorkItem: <Hash className="w-4 h-4 text-purple-500" />,
}

export default function CommandBar({ className }: CommandBarProps) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<GlobalSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      const { data } = await devIntelligenceService.globalSearch(q)
      setResult(data)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    setOpen(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  const handleHitClick = (hit: SearchHit) => {
    if (hit.url) {
      window.open(hit.url, '_blank')
    }
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (query) setOpen(true) }}
          placeholder="Search Tenant ID, Property ID, Work Item ID, branch…  ⌘K"
          className="w-full pl-10 pr-10 py-2.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />}
        {!loading && query && (
          <button onClick={() => { setQuery(''); setResult(null); setOpen(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {open && (query.trim().length > 0) && (
        <div className="absolute z-50 top-full mt-2 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl max-h-[420px] overflow-y-auto">
          {result && result.hits.length > 0 ? (
            <div className="p-2 space-y-1">
              <p className="px-3 py-1 text-xs text-gray-400 dark:text-gray-500">{result.totalCount} result{result.totalCount !== 1 ? 's' : ''}</p>
              {result.hits.map((hit, i) => (
                <button
                  key={i}
                  onClick={() => handleHitClick(hit)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/60 text-left transition-colors"
                >
                  <span className="mt-0.5 shrink-0">{HIT_ICONS[hit.hitType] || <FileText className="w-4 h-4 text-gray-400" />}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{hit.title}</p>
                    {hit.subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{hit.subtitle}</p>}
                  </div>
                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
                    {hit.hitType}
                  </span>
                </button>
              ))}
            </div>
          ) : result && result.hits.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No results for "{query}"
            </div>
          ) : !loading ? (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Type to search…
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
