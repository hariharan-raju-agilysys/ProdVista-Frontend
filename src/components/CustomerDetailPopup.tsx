import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Building2, Server, Cloud, HardDrive, Users, MapPin, Calendar,
  Shield, Headphones, UserCheck, Ticket, Activity, Globe, Package,
  ChevronRight, ExternalLink, Clock, Bug, AlertTriangle, Loader2,
  ArrowRight, Copy, Check
} from 'lucide-react'
import { CustomerDetailDto, SubPropertyDto, getStatusColor, getPriorityColor, formatDate } from '../services/customerService'
import { getCustomerIssues } from '../services/qualityService'

interface CustomerBugStats {
  total: number
  open: number
  closed: number
  critical: number
  olderThan7Days: number
  avgAge: number
}

function CopyableField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!value || value === 'N/A') return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      title={`Copy ${label}`}
      className="group relative flex items-center gap-1.5 px-2 py-1 -mx-2 rounded-lg hover:bg-white/20 transition-all cursor-pointer"
    >
      <span className={mono ? 'font-mono' : ''}>{value || 'N/A'}</span>
      <span className={`inline-flex items-center transition-all duration-300 ${
        copied
          ? 'text-emerald-300 scale-110'
          : 'text-white/40 opacity-0 group-hover:opacity-100 scale-100'
      }`}>
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </span>
      {copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-medium rounded-md shadow-lg animate-bounce whitespace-nowrap">
          Copied!
        </span>
      )}
    </button>
  )
}

interface Props {
  customer: CustomerDetailDto
  onClose: () => void
}

export default function CustomerDetailPopup({ customer, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Bug stats
  const [bugStats, setBugStats] = useState<CustomerBugStats | null>(null)
  const [bugStatsLoading, setBugStatsLoading] = useState(true)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Fetch bug stats for this customer
  useEffect(() => {
    let cancelled = false
    const fetchBugStats = async () => {
      setBugStatsLoading(true)
      try {
        // Try customer issues endpoint first (lightweight)
        const issues = await getCustomerIssues()
        const match = issues.find(
          (ci) => ci.customerName.toLowerCase() === customer.customerName.toLowerCase()
        )
        if (!cancelled && match) {
          // Calculate aging from the issues list
          const now = Date.now()
          const olderThan7 = (match.issues || []).filter(
            (b) => b.createdDate && (now - new Date(b.createdDate).getTime()) > 7 * 24 * 60 * 60 * 1000 && (b.state === 'Active' || b.state === 'New')
          ).length
          const activeBugs = (match.issues || []).filter((b) => b.state === 'Active' || b.state === 'New')
          const avgAge = activeBugs.length > 0
            ? activeBugs.reduce((sum, b) => sum + (b.ageDays || 0), 0) / activeBugs.length
            : 0

          setBugStats({
            total: match.totalIssues,
            open: match.activeIssues,
            closed: match.resolvedIssues,
            critical: match.criticalIssues,
            olderThan7Days: olderThan7,
            avgAge: Math.round(avgAge),
          })
        } else if (!cancelled) {
          setBugStats({ total: 0, open: 0, closed: 0, critical: 0, olderThan7Days: 0, avgAge: 0 })
        }
      } catch {
        if (!cancelled) setBugStats({ total: 0, open: 0, closed: 0, critical: 0, olderThan7Days: 0, avgAge: 0 })
      }
      if (!cancelled) setBugStatsLoading(false)
    }
    fetchBugStats()
    return () => { cancelled = true }
  }, [customer.customerName])

  const navigateToQuality = (filter?: string) => {
    const params = new URLSearchParams({ customer: customer.customerName })
    if (filter) params.set('filter', filter)
    onClose()
    navigate(`/quality?${params.toString()}`)
  }

  const deployIcon = customer.deploymentType === 'SaaS' ? Cloud
    : customer.deploymentType === 'OnPremise' ? HardDrive : Server
  const deployLabel = customer.deploymentType === 'SaaS' ? 'Cloud SaaS'
    : customer.deploymentType === 'OnPremise' ? 'On-Premise' : 'Hybrid'
  const deployColor = customer.deploymentType === 'SaaS' ? 'text-blue-600 bg-blue-50 border-blue-200'
    : customer.deploymentType === 'OnPremise' ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-purple-600 bg-purple-50 border-purple-200'

  const healthColor = customer.healthScore === 'Good' ? 'bg-emerald-500'
    : customer.healthScore === 'Warning' ? 'bg-amber-500' : 'bg-red-500'
  const healthBg = customer.healthScore === 'Good' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : customer.healthScore === 'Warning' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200'

  const serviceDuration = customer.onboardingStartDate
    ? (() => {
        const start = new Date(customer.onboardingStartDate)
        const now = new Date()
        const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        const months = Math.floor(((now.getTime() - start.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000))
        return years > 0 ? `${years}y ${months}m` : `${months}m`
      })()
    : 'N/A'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-8 py-6 text-white">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-bold">
              {customer.customerName.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{customer.customerName}</h2>
                <CopyableField label="Customer Name" value={customer.customerName} />
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-white/70">
                <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> {customer.region}</span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {customer.city || 'N/A'}, {customer.state || ''} {customer.country || ''}</span>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>{customer.status}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(customer.priority)}`}>{customer.priority} Priority</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${deployColor}`}>
                  {deployLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiMiniCopyable icon={Building2} label="Tenant ID" value={customer.tenantId || 'N/A'} color="blue" copyable />
            <KpiMiniCopyable icon={Building2} label="Property ID" value={customer.propertyId || 'N/A'} color="indigo" copyable />
            <KpiMiniCopyable icon={Users} label="Active Users" value={String(customer.activeUsers ?? 0)} color="green" />
            <KpiMiniCopyable icon={Ticket} label="Open Tickets" value={String(customer.openTickets ?? 0)}
              color={customer.openTickets && customer.openTickets > 5 ? 'red' : customer.openTickets && customer.openTickets > 0 ? 'amber' : 'green'} />
          </div>

          {/* Bug Intelligence */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Bug className="w-4 h-4" /> Bug Intelligence
              {bugStatsLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
            </h3>
            {bugStatsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">Loading bug data...</span>
              </div>
            ) : bugStats && bugStats.total > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <button
                  onClick={() => navigateToQuality()}
                  className="group rounded-xl border border-blue-100 bg-blue-50 p-3 text-left hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Bug className="w-4 h-4 text-blue-500 opacity-60" />
                    <ArrowRight className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-2xl font-bold text-blue-700">{bugStats.total}</div>
                  <div className="text-[10px] font-medium text-blue-500 uppercase tracking-wider">Total Bugs</div>
                </button>

                <button
                  onClick={() => navigateToQuality('open')}
                  className="group rounded-xl border border-red-100 bg-red-50 p-3 text-left hover:border-red-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-500 opacity-60" />
                    <ArrowRight className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-2xl font-bold text-red-700">{bugStats.open}</div>
                  <div className="text-[10px] font-medium text-red-500 uppercase tracking-wider">Open Bugs</div>
                </button>

                <button
                  onClick={() => navigateToQuality('closed')}
                  className="group rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-left hover:border-emerald-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Shield className="w-4 h-4 text-emerald-500 opacity-60" />
                    <ArrowRight className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">{bugStats.closed}</div>
                  <div className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Resolved</div>
                </button>

                <button
                  onClick={() => navigateToQuality('critical')}
                  className="group rounded-xl border border-orange-100 bg-orange-50 p-3 text-left hover:border-orange-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <AlertTriangle className="w-4 h-4 text-orange-500 opacity-60" />
                    <ArrowRight className="w-3 h-3 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-2xl font-bold text-orange-700">{bugStats.critical}</div>
                  <div className="text-[10px] font-medium text-orange-500 uppercase tracking-wider">Critical</div>
                </button>

                <button
                  onClick={() => navigateToQuality('aging')}
                  className="group rounded-xl border border-amber-100 bg-amber-50 p-3 text-left hover:border-amber-300 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Clock className="w-4 h-4 text-amber-500 opacity-60" />
                    <ArrowRight className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-2xl font-bold text-amber-700">{bugStats.olderThan7Days}</div>
                  <div className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">&gt;7 Days Old</div>
                </button>
              </div>
            ) : bugStats ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
                <Shield className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                <div className="text-sm font-medium text-emerald-700">No bugs found for this customer</div>
                <div className="text-xs text-emerald-500 mt-0.5">Clean record!</div>
              </div>
            ) : null}
            {bugStats && bugStats.total > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>Avg age of open bugs: <strong className="text-gray-600">{bugStats.avgAge}d</strong></span>
                <button
                  onClick={() => navigateToQuality()}
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-700 font-medium transition-colors"
                >
                  View all in Quality Center <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Health + Deployment */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`rounded-xl border p-4 ${healthBg}`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${healthColor} animate-pulse`} />
                <div>
                  <div className="text-xs font-medium opacity-70 uppercase tracking-wider">Health Score</div>
                  <div className="text-lg font-bold">{customer.healthScore || 'N/A'}</div>
                </div>
              </div>
            </div>
            <div className={`rounded-xl border p-4 ${deployColor}`}>
              <div className="flex items-center gap-3">
                {(() => { const DIcon = deployIcon; return <DIcon className="w-6 h-6" /> })()}
                <div>
                  <div className="text-xs font-medium opacity-70 uppercase tracking-wider">Current State</div>
                  <div className="text-lg font-bold">{deployLabel}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub Properties */}
          {customer.subProperties && customer.subProperties.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Sub Properties ({customer.subProperties.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {customer.subProperties.map((sp: SubPropertyDto, idx: number) => (
                  <SubPropertyCard key={idx} sp={sp} idx={idx} />
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" /> Products ({customer.products?.length || 0})
            </h3>
            <div className="flex flex-wrap gap-2">
              {(customer.products || []).map((p, i) => (
                <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Timeline / Key Dates */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Service Timeline
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DateCard label="Service Started" date={customer.onboardingStartDate} duration={serviceDuration} />
              <DateCard label="Go-Live Date" date={customer.goLiveDate} />
              <DateCard label="Contract Start" date={customer.contractStartDate} />
              <DateCard label="Contract End" date={customer.contractEndDate}
                isExpiring={customer.contractEndDate ? new Date(customer.contractEndDate).getTime() - Date.now() < 90 * 24 * 60 * 60 * 1000 : false} />
            </div>
          </div>

          {/* Contacts */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Key Contacts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ContactCard
                role="Customer Manager"
                name={customer.customerManager}
                email={customer.customerManagerEmail}
                icon={UserCheck}
                color="blue"
              />
              <ContactCard
                role="Support Manager"
                name={customer.supportManager}
                email={customer.supportManagerEmail}
                icon={Headphones}
                color="green"
              />
              <ContactCard
                role="Onboarded By"
                name={customer.onboardedBy}
                email={customer.onboardedByEmail}
                icon={Shield}
                color="purple"
              />
            </div>
          </div>

          {/* System Info */}
          <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-4">
            <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Version: {customer.currentVersion || 'N/A'}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last Activity: {customer.lastActivityDate ? formatDate(customer.lastActivityDate) : 'N/A'}</span>
            <CopyableFieldLight label="Customer ID" value={customer.customerId} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Mini KPI card with optional copy
function KpiMiniCopyable({ icon: Icon, label, value, color, copyable }: { icon: any; label: string; value: string; color: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  }
  const handleCopy = async () => {
    if (!copyable || !value || value === 'N/A') return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div
      onClick={handleCopy}
      className={`relative rounded-xl border p-3 transition-all ${
        colors[color] || colors.blue
      } ${copyable ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-xs font-medium opacity-70 uppercase tracking-wider">{label}</span>
        {copyable && (
          <span className={`ml-auto transition-all duration-300 ${copied ? 'text-emerald-500 scale-110' : 'opacity-0 group-hover:opacity-40'}`}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 opacity-40" />}
          </span>
        )}
      </div>
      <div className="text-xl font-bold font-mono truncate">{value}</div>
      {copied && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-emerald-500/90 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Check className="w-5 h-5" /> Copied!
          </div>
        </div>
      )}
    </div>
  )
}

// Light-themed copyable field for system info section
function CopyableFieldLight({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!value || value === 'N/A') return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      title={`Copy ${label}`}
      className="group relative flex items-center gap-1 px-1.5 py-0.5 -mx-1 rounded hover:bg-gray-100 transition-all cursor-pointer"
    >
      <span className="font-mono">{label}: {value}</span>
      <span className={`transition-all duration-300 ${copied ? 'text-emerald-500 scale-110' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}>
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </span>
      {copied && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-medium rounded shadow-lg whitespace-nowrap">
          Copied!
        </span>
      )}
    </button>
  )
}

// Sub-property card with copyable ID
function SubPropertyCard({ sp, idx }: { sp: SubPropertyDto; idx: number }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(sp.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div
      onClick={copy}
      className="group flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition cursor-pointer"
    >
      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
        {idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{sp.name}</div>
        <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
          {sp.id}
          <span className={`transition-all duration-300 ${copied ? 'text-emerald-500' : 'opacity-0 group-hover:opacity-60'}`}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </span>
        </div>
      </div>
      {copied ? (
        <span className="text-xs font-medium text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Copied</span>
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-400" />
      )}
    </div>
  )
}

// Date card
function DateCard({ label, date, duration, isExpiring }: { label: string; date?: string | null; duration?: string; isExpiring?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${isExpiring ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-semibold ${isExpiring ? 'text-red-700' : 'text-gray-800'}`}>
        {date ? formatDate(date) : 'Not set'}
      </div>
      {duration && <div className="text-xs text-gray-400 mt-1">{duration}</div>}
      {isExpiring && <div className="text-xs text-red-600 font-medium mt-1">Expiring soon</div>}
    </div>
  )
}

// Contact card
function ContactCard({ role, name, email, icon: Icon, color }: { role: string; name?: string | null; email?: string | null; icon: any; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
  }
  return (
    <div className={`rounded-xl border p-3 ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-xs font-medium opacity-70 uppercase tracking-wider">{role}</span>
      </div>
      <div className="text-sm font-semibold">{name || 'Not assigned'}</div>
      {email && (
        <a href={`mailto:${email}`} className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1 mt-1">
          {email} <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  )
}
