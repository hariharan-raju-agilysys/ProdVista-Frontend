import { useState, useEffect, useCallback } from 'react'
import { Users, RefreshCw, UserCheck, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import devIntelligenceService, { type DevTeamMemberDto } from '../../services/devIntelligenceService'

interface TeamRosterProps {
  onSelectMember?: (member: DevTeamMemberDto) => void
  className?: string
}

export default function TeamRoster({ onSelectMember, className }: TeamRosterProps) {
  const [members, setMembers] = useState<DevTeamMemberDto[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await devIntelligenceService.getTeamMembers()
      setMembers(data)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await devIntelligenceService.syncTeamMembers('')
      await fetchMembers()
    } catch { /* silent */ } finally {
      setSyncing(false)
    }
  }

  const handleSelect = (m: DevTeamMemberDto) => {
    setSelected(m.devOpsUniqueName ?? null)
    onSelectMember?.(m)
  }

  return (
    <div className={clsx('bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700', className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" /> Team Members
          <span className="text-xs text-gray-400 font-normal">({members.length})</span>
        </h3>
        <button onClick={handleSync} disabled={syncing} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-50">
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sync from Entra ID
        </button>
      </div>

      <div className="p-3 max-h-[350px] overflow-y-auto space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
          </div>
        )}

        {!loading && members.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No team members synced yet. Click "Sync" to pull from Azure DevOps.</p>
        )}

        {members.map(m => (
          <button
            key={m.devOpsUniqueName}
            onClick={() => handleSelect(m)}
            className={clsx(
              'w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors',
              selected === m.devOpsUniqueName
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 border border-transparent'
            )}
          >
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                {m.displayName.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.displayName}</p>
              <p className="text-xs text-gray-400 truncate">{m.jobTitle || m.email}</p>
            </div>
            {m.isActive && <UserCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  )
}
