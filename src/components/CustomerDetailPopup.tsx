import { useEffect, useRef } from 'react'
import {
  X, Building2, Server, Cloud, HardDrive, Users, MapPin, Calendar,
  Shield, Headphones, UserCheck, Ticket, Activity, Globe, Package,
  ChevronRight, ExternalLink, Clock
} from 'lucide-react'
import { CustomerDetailDto, SubPropertyDto, getStatusColor, getPriorityColor, formatDate } from '../services/customerService'

interface Props {
  customer: CustomerDetailDto
  onClose: () => void
}

export default function CustomerDetailPopup({ customer, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

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
              <h2 className="text-2xl font-bold">{customer.customerName}</h2>
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
            <KpiMini icon={Building2} label="Tenant ID" value={customer.tenantId || 'N/A'} color="blue" />
            <KpiMini icon={Package} label="Properties" value={String(customer.totalProperties ?? 0)} color="purple" />
            <KpiMini icon={Users} label="Active Users" value={String(customer.activeUsers ?? 0)} color="green" />
            <KpiMini icon={Ticket} label="Open Tickets" value={String(customer.openTickets ?? 0)}
              color={customer.openTickets && customer.openTickets > 5 ? 'red' : customer.openTickets && customer.openTickets > 0 ? 'amber' : 'green'} />
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
                  <div key={idx}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{sp.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{sp.id}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
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
            <span className="font-mono">ID: {customer.customerId}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mini KPI card
function KpiMini({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  }
  return (
    <div className={`rounded-xl border p-3 ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-xs font-medium opacity-70 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
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
