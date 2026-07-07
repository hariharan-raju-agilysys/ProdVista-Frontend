// Helper text formatting functions
export function greeting(name: string): string {
  const h = new Date().getHours()
  if (h < 12) return `Good morning, ${name} 🌤️`
  if (h < 17) return `Good afternoon, ${name} ☀️`
  return `Good evening, ${name} 🌙`
}

export function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function ageLabel(dateStr?: string): string {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d'
  return `${days}d`
}

export function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() / 1000 - ts) / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatCalendarDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getReleaseNotesUrl(tenantCode?: string): string {
  const code = tenantCode || 'versa'
  const domain = 'https://aks-v1-dev.hospitalityrevolution.com'
  return `${domain}/${code}releasenote`
}
