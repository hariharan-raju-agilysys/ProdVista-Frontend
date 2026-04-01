import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MetricCard } from '../components/MetricCard'
import { ChartCard } from '../components/Charts'
import {
  Users, Building2, Cloud, Server, Bug, AlertTriangle, CheckCircle, 
  XCircle, Search, Filter, ChevronDown, ChevronUp, ExternalLink,
  Phone, Mail, Calendar, Tag, Activity, 
  Globe, Zap, MoreVertical, Eye, RefreshCw, Download,
  AlertCircle, Settings
} from 'lucide-react'
import clsx from 'clsx'
import apiClient from '../services/api'
import { useAuth } from '../context/AuthContext'

// Types
interface Customer {
  id: string
  name: string
  code: string
  logo?: string
  deploymentType: 'saas' | 'on-premise' | 'hybrid'
  status: 'active' | 'inactive' | 'maintenance' | 'onboarding'
  tier: 'enterprise' | 'professional' | 'starter' | 'trial'
  region: string
  version: string
  lastDeployed: string
  contract: {
    startDate: string
    endDate: string
    value: number
  }
  contacts: {
    primary: { name: string; email: string; phone?: string }
    technical?: { name: string; email: string }
  }
  metrics: {
    users: number
    storage: number // GB
    apiCalls: number // last 30 days
    uptime: number // percentage
  }
  issues: {
    critical: number
    high: number
    medium: number
    low: number
  }
  health: 'healthy' | 'warning' | 'critical'
}

interface CustomerIssue {
  id: string
  customerId: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  type: 'bug' | 'incident' | 'request' | 'task'
  createdAt: string
  assignee?: string
}

type ViewMode = 'cards' | 'table' | 'issues'
type FilterType = 'all' | 'saas' | 'on-premise' | 'hybrid'
type StatusFilter = 'all' | 'active' | 'inactive' | 'maintenance'

export default function Production() {
  const { isManager } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [issues, setIssues] = useState<CustomerIssue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [searchQuery, setSearchQuery] = useState('')
  const [deploymentFilter, setDeploymentFilter] = useState<FilterType>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [customersRes, issuesRes] = await Promise.all([
        apiClient.get('/customers/production'),
        apiClient.get('/issues/all')
      ])
      setCustomers(customersRes.data)
      setIssues(issuesRes.data)
    } catch {
      // Mock data for demo
      setCustomers([
        {
          id: '1', name: 'Acme Corporation', code: 'ACME', deploymentType: 'saas', status: 'active', tier: 'enterprise', region: 'US-East',
          version: 'v2.5.1', lastDeployed: '2024-03-15', health: 'healthy',
          contract: { startDate: '2023-01-01', endDate: '2025-12-31', value: 150000 },
          contacts: { primary: { name: 'John Smith', email: 'john@acme.com', phone: '+1-555-0100' }, technical: { name: 'Jane Doe', email: 'jane.tech@acme.com' } },
          metrics: { users: 450, storage: 125, apiCalls: 2500000, uptime: 99.95 },
          issues: { critical: 0, high: 1, medium: 3, low: 8 }
        },
        {
          id: '2', name: 'TechStart Inc', code: 'TECH', deploymentType: 'saas', status: 'active', tier: 'professional', region: 'EU-West',
          version: 'v2.5.1', lastDeployed: '2024-03-14', health: 'healthy',
          contract: { startDate: '2024-01-01', endDate: '2024-12-31', value: 45000 },
          contacts: { primary: { name: 'Sarah Connor', email: 'sarah@techstart.io' } },
          metrics: { users: 85, storage: 28, apiCalls: 450000, uptime: 99.99 },
          issues: { critical: 0, high: 0, medium: 2, low: 5 }
        },
        {
          id: '3', name: 'Global Finance Ltd', code: 'GFL', deploymentType: 'on-premise', status: 'active', tier: 'enterprise', region: 'UK',
          version: 'v2.4.0', lastDeployed: '2024-02-28', health: 'warning',
          contract: { startDate: '2022-06-01', endDate: '2025-05-31', value: 280000 },
          contacts: { primary: { name: 'Michael Brown', email: 'm.brown@gfl.co.uk', phone: '+44-20-5555-0100' }, technical: { name: 'David Lee', email: 'd.lee@gfl.co.uk' } },
          metrics: { users: 1200, storage: 450, apiCalls: 5800000, uptime: 99.85 },
          issues: { critical: 1, high: 3, medium: 7, low: 12 }
        },
        {
          id: '4', name: 'Healthcare Plus', code: 'HCP', deploymentType: 'hybrid', status: 'active', tier: 'enterprise', region: 'US-West',
          version: 'v2.5.0', lastDeployed: '2024-03-10', health: 'healthy',
          contract: { startDate: '2023-03-01', endDate: '2026-02-28', value: 195000 },
          contacts: { primary: { name: 'Dr. Emily Chen', email: 'e.chen@healthcareplus.com' } },
          metrics: { users: 650, storage: 280, apiCalls: 3200000, uptime: 99.97 },
          issues: { critical: 0, high: 2, medium: 4, low: 6 }
        },
        {
          id: '5', name: 'Retail Solutions', code: 'RTLS', deploymentType: 'saas', status: 'maintenance', tier: 'professional', region: 'Asia-Pacific',
          version: 'v2.4.2', lastDeployed: '2024-03-01', health: 'warning',
          contract: { startDate: '2023-07-01', endDate: '2024-06-30', value: 38000 },
          contacts: { primary: { name: 'Kim Park', email: 'kim@retailsol.com' } },
          metrics: { users: 120, storage: 45, apiCalls: 680000, uptime: 98.50 },
          issues: { critical: 0, high: 1, medium: 2, low: 3 }
        },
        {
          id: '6', name: 'Manufacturing Pro', code: 'MFG', deploymentType: 'on-premise', status: 'active', tier: 'enterprise', region: 'Germany',
          version: 'v2.3.5', lastDeployed: '2024-01-15', health: 'critical',
          contract: { startDate: '2021-01-01', endDate: '2024-12-31', value: 320000 },
          contacts: { primary: { name: 'Hans Mueller', email: 'h.mueller@mfgpro.de', phone: '+49-30-5555-0100' }, technical: { name: 'Klaus Weber', email: 'k.weber@mfgpro.de' } },
          metrics: { users: 2100, storage: 890, apiCalls: 8500000, uptime: 97.50 },
          issues: { critical: 2, high: 5, medium: 10, low: 15 }
        },
        {
          id: '7', name: 'StartupXYZ', code: 'SXYZ', deploymentType: 'saas', status: 'onboarding', tier: 'starter', region: 'US-Central',
          version: 'v2.5.1', lastDeployed: '2024-03-18', health: 'healthy',
          contract: { startDate: '2024-03-01', endDate: '2025-02-28', value: 12000 },
          contacts: { primary: { name: 'Alex Johnson', email: 'alex@startupxyz.com' } },
          metrics: { users: 15, storage: 5, apiCalls: 25000, uptime: 100 },
          issues: { critical: 0, high: 0, medium: 0, low: 1 }
        },
        {
          id: '8', name: 'Education Network', code: 'EDUN', deploymentType: 'saas', status: 'inactive', tier: 'professional', region: 'Canada',
          version: 'v2.4.0', lastDeployed: '2024-01-20', health: 'warning',
          contract: { startDate: '2023-01-01', endDate: '2024-03-31', value: 28000 },
          contacts: { primary: { name: 'Marie Dubois', email: 'marie@edunet.ca' } },
          metrics: { users: 0, storage: 35, apiCalls: 0, uptime: 0 },
          issues: { critical: 0, high: 0, medium: 1, low: 2 }
        },
      ])
      setIssues([
        { id: 'BUG-1001', customerId: '3', title: 'Database connection timeout during peak hours', severity: 'critical', status: 'in-progress', type: 'bug', createdAt: '2024-03-18', assignee: 'John D.' },
        { id: 'BUG-1002', customerId: '6', title: 'Memory leak in batch processing module', severity: 'critical', status: 'open', type: 'bug', createdAt: '2024-03-19', assignee: 'Sarah K.' },
        { id: 'INC-2001', customerId: '6', title: 'API response time exceeded SLA', severity: 'critical', status: 'in-progress', type: 'incident', createdAt: '2024-03-20', assignee: 'Mike R.' },
        { id: 'BUG-1003', customerId: '1', title: 'Report export formatting issue', severity: 'high', status: 'open', type: 'bug', createdAt: '2024-03-17' },
        { id: 'REQ-3001', customerId: '4', title: 'Custom SSO integration needed', severity: 'high', status: 'in-progress', type: 'request', createdAt: '2024-03-15' },
        { id: 'BUG-1004', customerId: '3', title: 'Dashboard widget not loading for specific role', severity: 'high', status: 'open', type: 'bug', createdAt: '2024-03-16' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           c.code.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesDeployment = deploymentFilter === 'all' || c.deploymentType === deploymentFilter
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter
      return matchesSearch && matchesDeployment && matchesStatus
    })
  }, [customers, searchQuery, deploymentFilter, statusFilter])

  // Summary metrics
  const summary = useMemo(() => {
    const active = customers.filter(c => c.status === 'active').length
    const saas = customers.filter(c => c.deploymentType === 'saas').length
    const onPrem = customers.filter(c => c.deploymentType === 'on-premise').length
    const totalIssues = customers.reduce((sum, c) => sum + c.issues.critical + c.issues.high + c.issues.medium + c.issues.low, 0)
    const criticalIssues = customers.reduce((sum, c) => sum + c.issues.critical, 0)
    const avgUptime = customers.filter(c => c.status === 'active').reduce((sum, c) => sum + c.metrics.uptime, 0) / active || 0
    const totalUsers = customers.reduce((sum, c) => sum + c.metrics.users, 0)
    return { active, saas, onPrem, totalIssues, criticalIssues, avgUptime, totalUsers, total: customers.length }
  }, [customers])

  // Chart data
  const deploymentDistribution = {
    labels: ['SaaS', 'On-Premise', 'Hybrid'],
    datasets: [{
      data: [
        customers.filter(c => c.deploymentType === 'saas').length,
        customers.filter(c => c.deploymentType === 'on-premise').length,
        customers.filter(c => c.deploymentType === 'hybrid').length,
      ],
      backgroundColor: ['#3b82f6', '#6366f1', '#8b5cf6'],
    }]
  }

  const issuesByCustomer = {
    labels: customers.filter(c => c.issues.critical + c.issues.high > 0).slice(0, 5).map(c => c.code),
    datasets: [
      { label: 'Critical', data: customers.filter(c => c.issues.critical + c.issues.high > 0).slice(0, 5).map(c => c.issues.critical), backgroundColor: '#ef4444' },
      { label: 'High', data: customers.filter(c => c.issues.critical + c.issues.high > 0).slice(0, 5).map(c => c.issues.high), backgroundColor: '#f97316' },
    ]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            Production Customers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage all production customers, deployments, and issues</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {isManager && (
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard title="Total Customers" value={summary.total.toString()} icon={<Users size={20} />} />
        <MetricCard title="Active" value={summary.active.toString()} icon={<CheckCircle size={20} />} />
        <MetricCard title="SaaS" value={summary.saas.toString()} icon={<Cloud size={20} />} />
        <MetricCard title="On-Premise" value={summary.onPrem.toString()} icon={<Server size={20} />} />
        <MetricCard title="Critical Issues" value={summary.criticalIssues.toString()} trend={summary.criticalIssues > 0 ? 'down' : 'up'} icon={<AlertTriangle size={20} />} />
        <MetricCard title="Avg Uptime" value={`${summary.avgUptime.toFixed(2)}%`} trend="up" icon={<Activity size={20} />} />
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers..."
                className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg w-64 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Deployment Filter */}
            <select
              value={deploymentFilter}
              onChange={(e) => setDeploymentFilter(e.target.value as FilterType)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg"
            >
              <option value="all">All Deployments</option>
              <option value="saas">SaaS Only</option>
              <option value="on-premise">On-Premise Only</option>
              <option value="hybrid">Hybrid Only</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { id: 'cards', icon: Building2, label: 'Cards' },
              { id: 'table', icon: Activity, label: 'Table' },
              { id: 'issues', icon: Bug, label: 'Issues' },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id as ViewMode)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors',
                  viewMode === v.id
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <v.icon className="w-4 h-4" />
                <span className="text-sm">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      <AnimatePresence mode="wait">
        {viewMode === 'cards' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredCustomers.map(customer => (
              <CustomerCard 
                key={customer.id} 
                customer={customer} 
                isExpanded={expandedCustomer === customer.id}
                onToggle={() => setExpandedCustomer(expandedCustomer === customer.id ? null : customer.id)}
                onViewDetails={() => setSelectedCustomer(customer)}
              />
            ))}
          </motion.div>
        )}

        {viewMode === 'table' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <CustomerTable customers={filteredCustomers} onSelectCustomer={setSelectedCustomer} />
          </motion.div>
        )}

        {viewMode === 'issues' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <IssuesByCustomerView customers={customers} issues={issues} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ChartCard title="Deployment Distribution" type="doughnut" data={deploymentDistribution} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <ChartCard title="Issues by Customer (Critical & High)" type="bar" data={issuesByCustomer} />
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerDetailModal 
          customer={selectedCustomer} 
          issues={issues.filter(i => i.customerId === selectedCustomer.id)}
          onClose={() => setSelectedCustomer(null)} 
        />
      )}
    </div>
  )
}

// Customer Card Component
function CustomerCard({ customer, isExpanded, onToggle, onViewDetails }: {
  customer: Customer
  isExpanded: boolean
  onToggle: () => void
  onViewDetails: () => void
}) {
  const totalIssues = customer.issues.critical + customer.issues.high + customer.issues.medium + customer.issues.low

  return (
    <div className={clsx(
      'bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden transition-all',
      customer.health === 'critical' ? 'border-red-300 dark:border-red-700' :
      customer.health === 'warning' ? 'border-yellow-300 dark:border-yellow-700' :
      'border-gray-200 dark:border-gray-700'
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg',
              customer.deploymentType === 'saas' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' :
              customer.deploymentType === 'on-premise' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' :
              'bg-gradient-to-br from-violet-500 to-purple-500'
            )}>
              {customer.code.substring(0, 2)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{customer.name}</h3>
              <p className="text-sm text-gray-500">{customer.code}</p>
            </div>
          </div>
          <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <DeploymentBadge type={customer.deploymentType} />
          <StatusBadge status={customer.status} />
          <TierBadge tier={customer.tier} />
          <HealthBadge health={customer.health} />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{customer.metrics.users}</p>
            <p className="text-xs text-gray-500">Users</p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{customer.metrics.uptime}%</p>
            <p className="text-xs text-gray-500">Uptime</p>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{totalIssues}</p>
            <p className="text-xs text-gray-500">Issues</p>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-gray-700"
          >
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Version:</span>
                  <span className="ml-2 font-mono text-blue-600 dark:text-blue-400">{customer.version}</span>
                </div>
                <div>
                  <span className="text-gray-500">Region:</span>
                  <span className="ml-2">{customer.region}</span>
                </div>
                <div>
                  <span className="text-gray-500">Last Deploy:</span>
                  <span className="ml-2">{customer.lastDeployed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Storage:</span>
                  <span className="ml-2">{customer.metrics.storage} GB</span>
                </div>
              </div>

              {/* Issues Breakdown */}
              {totalIssues > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Issues:</span>
                  {customer.issues.critical > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{customer.issues.critical} Critical</span>}
                  {customer.issues.high > 0 && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">{customer.issues.high} High</span>}
                  {customer.issues.medium > 0 && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">{customer.issues.medium} Med</span>}
                </div>
              )}

              {/* Contact */}
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-400" />
                <a href={`mailto:${customer.contacts.primary.email}`} className="text-blue-600 hover:underline">{customer.contacts.primary.email}</a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <button onClick={onViewDetails} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          <Eye className="w-4 h-4" />
          View Details
        </button>
        <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ExternalLink className="w-4 h-4" />
          Open
        </button>
      </div>
    </div>
  )
}

// Customer Table Component
function CustomerTable({ customers, onSelectCustomer }: { customers: Customer[]; onSelectCustomer: (c: Customer) => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Deployment</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Version</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Users</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Uptime</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Issues</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Health</th>
              <th className="text-right py-3 px-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {customers.map(customer => {
              const totalIssues = customer.issues.critical + customer.issues.high + customer.issues.medium + customer.issues.low
              return (
                <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => onSelectCustomer(customer)}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs', customer.deploymentType === 'saas' ? 'bg-blue-500' : customer.deploymentType === 'on-premise' ? 'bg-purple-500' : 'bg-violet-500')}>{customer.code.substring(0, 2)}</div>
                      <div><p className="font-medium text-gray-900 dark:text-white">{customer.name}</p><p className="text-xs text-gray-500">{customer.code}</p></div>
                    </div>
                  </td>
                  <td className="py-3 px-4"><DeploymentBadge type={customer.deploymentType} /></td>
                  <td className="py-3 px-4"><StatusBadge status={customer.status} /></td>
                  <td className="py-3 px-4"><span className="font-mono text-sm text-blue-600 dark:text-blue-400">{customer.version}</span></td>
                  <td className="py-3 px-4">{customer.metrics.users.toLocaleString()}</td>
                  <td className="py-3 px-4"><span className={clsx(customer.metrics.uptime >= 99.9 ? 'text-green-600' : customer.metrics.uptime >= 99 ? 'text-yellow-600' : 'text-red-600')}>{customer.metrics.uptime}%</span></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {customer.issues.critical > 0 && <span className="w-5 h-5 flex items-center justify-center bg-red-100 text-red-700 rounded text-xs font-medium">{customer.issues.critical}</span>}
                      {customer.issues.high > 0 && <span className="w-5 h-5 flex items-center justify-center bg-orange-100 text-orange-700 rounded text-xs font-medium">{customer.issues.high}</span>}
                      <span className="text-gray-500 text-sm ml-1">{totalIssues} total</span>
                    </div>
                  </td>
                  <td className="py-3 px-4"><HealthBadge health={customer.health} /></td>
                  <td className="py-3 px-4 text-right"><button className="p-1 text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Issues by Customer View
function IssuesByCustomerView({ customers, issues }: { customers: Customer[]; issues: CustomerIssue[] }) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  
  const filteredIssues = useMemo(() => {
    if (selectedSeverity === 'all') return issues
    return issues.filter(i => i.severity === selectedSeverity)
  }, [issues, selectedSeverity])

  const groupedByCustomer = useMemo(() => {
    const grouped: Record<string, CustomerIssue[]> = {}
    filteredIssues.forEach(issue => {
      if (!grouped[issue.customerId]) grouped[issue.customerId] = []
      grouped[issue.customerId].push(issue)
    })
    return grouped
  }, [filteredIssues])

  return (
    <>
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">Severity:</span>
        {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
          <button key={sev} onClick={() => setSelectedSeverity(sev)} className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-colors', selectedSeverity === sev ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
            {sev !== 'all' && <span className="ml-1">({issues.filter(i => i.severity === sev).length})</span>}
          </button>
        ))}
      </div>

      {/* Issues grouped by customer */}
      <div className="space-y-4">
        {Object.entries(groupedByCustomer).map(([customerId, customerIssues]) => {
          const customer = customers.find(c => c.id === customerId)
          if (!customer) return null
          return (
            <div key={customerId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs', customer.deploymentType === 'saas' ? 'bg-blue-500' : 'bg-purple-500')}>{customer.code.substring(0, 2)}</div>
                  <div><span className="font-medium text-gray-900 dark:text-white">{customer.name}</span><DeploymentBadge type={customer.deploymentType} /></div>
                </div>
                <span className="text-sm text-gray-500">{customerIssues.length} issue{customerIssues.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {customerIssues.map(issue => (
                  <div key={issue.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-center gap-3">
                      <IssueSeverityIcon severity={issue.severity} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{issue.title}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="font-mono">{issue.id}</span>
                          <span>•</span>
                          <span>{issue.type}</span>
                          <span>•</span>
                          <span>{issue.createdAt}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {issue.assignee && <span className="text-sm text-gray-500">{issue.assignee}</span>}
                      <IssueStatusBadge status={issue.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {Object.keys(groupedByCustomer).length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Bug className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No issues found matching the filter</p>
          </div>
        )}
      </div>
    </>
  )
}

// Customer Detail Modal
function CustomerDetailModal({ customer, issues, onClose }: { customer: Customer; issues: CustomerIssue[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={clsx('w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl', customer.deploymentType === 'saas' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' : customer.deploymentType === 'on-premise' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 'bg-gradient-to-br from-violet-500 to-purple-500')}>{customer.code.substring(0, 2)}</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{customer.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <DeploymentBadge type={customer.deploymentType} />
                <StatusBadge status={customer.status} />
                <TierBadge tier={customer.tier} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="w-6 h-6" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCard icon={Globe} label="Region" value={customer.region} />
            <InfoCard icon={Tag} label="Version" value={customer.version} isMono />
            <InfoCard icon={Calendar} label="Last Deployed" value={customer.lastDeployed} />
            <InfoCard icon={Activity} label="Uptime" value={`${customer.metrics.uptime}%`} valueColor={customer.metrics.uptime >= 99.9 ? 'green' : 'yellow'} />
          </div>

          {/* Metrics */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Usage Metrics</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><p className="text-2xl font-bold text-blue-600">{customer.metrics.users.toLocaleString()}</p><p className="text-sm text-gray-500">Active Users</p></div>
              <div><p className="text-2xl font-bold text-purple-600">{customer.metrics.storage} GB</p><p className="text-sm text-gray-500">Storage Used</p></div>
              <div><p className="text-2xl font-bold text-green-600">{(customer.metrics.apiCalls / 1000000).toFixed(1)}M</p><p className="text-sm text-gray-500">API Calls (30d)</p></div>
              <div><p className="text-2xl font-bold text-gray-900 dark:text-white">${(customer.contract.value / 1000).toFixed(0)}K</p><p className="text-sm text-gray-500">Contract Value</p></div>
            </div>
          </div>

          {/* Issues */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Bug className="w-5 h-5" />Issues ({issues.length})</h3>
            {issues.length > 0 ? (
              <div className="space-y-2">
                {issues.map(issue => (
                  <div key={issue.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <div className="flex items-center gap-3"><IssueSeverityIcon severity={issue.severity} /><div><p className="font-medium">{issue.title}</p><p className="text-xs text-gray-500">{issue.id} • {issue.type}</p></div></div>
                    <IssueStatusBadge status={issue.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No open issues 🎉</p>
            )}
          </div>

          {/* Contacts */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Contacts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-500">Primary Contact</p>
                <p className="font-medium text-gray-900 dark:text-white">{customer.contacts.primary.name}</p>
                <a href={`mailto:${customer.contacts.primary.email}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1"><Mail className="w-3 h-3" />{customer.contacts.primary.email}</a>
                {customer.contacts.primary.phone && <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{customer.contacts.primary.phone}</p>}
              </div>
              {customer.contacts.technical && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-sm text-gray-500">Technical Contact</p>
                  <p className="font-medium text-gray-900 dark:text-white">{customer.contacts.technical.name}</p>
                  <a href={`mailto:${customer.contacts.technical.email}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1"><Mail className="w-3 h-3" />{customer.contacts.technical.email}</a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">Close</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Settings className="w-4 h-4" />Manage Customer</button>
        </div>
      </motion.div>
    </div>
  )
}

// Badge Components
function DeploymentBadge({ type }: { type: Customer['deploymentType'] }) {
  const config = {
    saas: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: Cloud, label: 'SaaS' },
    'on-premise': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', icon: Server, label: 'On-Prem' },
    hybrid: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', icon: Zap, label: 'Hybrid' },
  }
  const { bg, text, icon: Icon, label } = config[type]
  return <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', bg, text)}><Icon className="w-3 h-3" />{label}</span>
}

function StatusBadge({ status }: { status: Customer['status'] }) {
  const config = {
    active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    inactive: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-400' },
    maintenance: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
    onboarding: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  }
  const { bg, text } = config[status]
  return <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize', bg, text)}>{status}</span>
}

function TierBadge({ tier }: { tier: Customer['tier'] }) {
  const config = {
    enterprise: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: '👑' },
    professional: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', icon: '⭐' },
    starter: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-400', icon: '🚀' },
    trial: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400', icon: '🎯' },
  }
  const { bg, text, icon } = config[tier]
  return <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize', bg, text)}>{icon} {tier}</span>
}

function HealthBadge({ health }: { health: Customer['health'] }) {
  const config = {
    healthy: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
    warning: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: AlertTriangle },
    critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: XCircle },
  }
  const { bg, text, icon: Icon } = config[health]
  return <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize', bg, text)}><Icon className="w-3 h-3" />{health}</span>
}

function IssueSeverityIcon({ severity }: { severity: CustomerIssue['severity'] }) {
  const config = {
    critical: { bg: 'bg-red-500', icon: AlertCircle },
    high: { bg: 'bg-orange-500', icon: AlertTriangle },
    medium: { bg: 'bg-yellow-500', icon: AlertCircle },
    low: { bg: 'bg-blue-500', icon: Bug },
  }
  const { bg, icon: Icon } = config[severity]
  return <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', bg)}><Icon className="w-4 h-4 text-white" /></div>
}

function IssueStatusBadge({ status }: { status: CustomerIssue['status'] }) {
  const config = {
    open: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    'in-progress': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
    resolved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    closed: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-400' },
  }
  const { bg, text } = config[status]
  return <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize', bg, text)}>{status}</span>
}

function InfoCard({ icon: Icon, label, value, isMono, valueColor }: { icon: any; label: string; value: string; isMono?: boolean; valueColor?: string }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
      <div className="flex items-center gap-2 text-gray-500 mb-1"><Icon className="w-4 h-4" /><span className="text-xs">{label}</span></div>
      <p className={clsx('font-medium', isMono && 'font-mono text-blue-600 dark:text-blue-400', valueColor === 'green' && 'text-green-600', valueColor === 'yellow' && 'text-yellow-600')}>{value}</p>
    </div>
  )
}
