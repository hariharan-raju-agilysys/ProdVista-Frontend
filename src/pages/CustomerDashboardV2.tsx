import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getCustomerSummary,
  getCustomers,
  updateCustomer,
  syncAliasesFromDevOps,
  CustomerDetailDto,
  CustomerSummaryDto,
  CustomerFilterDto,
  SyncAliasesResult,
  getStatusColor,
  getPriorityColor,
  getHealthScoreColor,
  getDeploymentTypeIcon,
  formatDate,
  formatRelativeTime,
} from '../services/customerService';

// ============================================================================
// Tab Type
// ============================================================================
type TabType = 'all' | 'analytics';

// ============================================================================
// Main Component
// ============================================================================
const CustomerDashboardV2: React.FC = () => {
  const { isManager } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [summary, setSummary] = useState<CustomerSummaryDto | null>(null);
  const [customers, setCustomers] = useState<CustomerDetailDto[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerDetailDto[]>([]);
  const [filters, setFilters] = useState<CustomerFilterDto>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetailDto | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [propertyIdSearch, setPropertyIdSearch] = useState('');
  const [tenantIdSearch, setTenantIdSearch] = useState('');
  const [subPropertySearch, setSubPropertySearch] = useState('');

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<CustomerDetailDto> | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync aliases state
  const [syncingAliases, setSyncingAliases] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncAliasesResult | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Reload customers when filters change
  useEffect(() => {
    if (!loading) {
      loadCustomers();
    }
  }, [filters]);

  // Derive unique filter values from ALL loaded customers (not filtered subset)
  const derivedFilters = useMemo(() => {
    const unique = (arr: (string | undefined | null)[]) =>
      [...new Set(arr.filter((v): v is string => !!v))].sort();
    return {
      statuses: unique(allCustomers.map(c => c.status)),
      regions: unique(allCustomers.map(c => c.region)),
      priorities: unique(allCustomers.map(c => c.priority)),
      deploymentTypes: unique(allCustomers.map(c => c.deploymentType)),
    };
  }, [allCustomers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({
        ...prev,
        searchTerm,
        propertyIdSearch: propertyIdSearch || undefined,
        tenantIdSearch: tenantIdSearch || undefined,
        subPropertySearch: subPropertySearch || undefined,
      }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, propertyIdSearch, tenantIdSearch, subPropertySearch]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, customersData] = await Promise.all([
        getCustomerSummary(),
        getCustomers(),
      ]);
      setSummary(summaryData);
      setCustomers(customersData);
      setAllCustomers(customersData);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await getCustomers(filters);
      setCustomers(data);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
    setPropertyIdSearch('');
    setTenantIdSearch('');
    setSubPropertySearch('');
  };

  // Auto-dismiss success messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleStartEdit = (customer: CustomerDetailDto) => {
    setEditingCustomer({ ...customer });
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditingCustomer(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer?.id) return;
    setSaving(true);
    try {
      const updated = await updateCustomer(editingCustomer.id, editingCustomer);
      setSelectedCustomer(updated);
      setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
      setEditMode(false);
      setEditingCustomer(null);
      setSuccessMessage('Customer updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditingCustomer(prev => prev ? { ...prev, [field]: value } : null);
  };

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderSummaryCards = () => {
    if (!summary) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Customers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Customers</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{summary.totalCustomers}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <span className="text-green-600 dark:text-green-400 font-medium">{summary.activeCustomers}</span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">Active</span>
          </div>
        </div>

        {/* Onboarding */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Onboarding</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{summary.onboardingCustomers}</p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm">
            <span className="text-red-600 dark:text-red-400 font-medium">{summary.suspendedCustomers}</span>
            <span className="text-gray-500 dark:text-gray-400 ml-1">Suspended</span>
          </div>
        </div>

        {/* Deployment Split */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Deployment Types</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">☁️ {summary.saaSCustomers}</p>
            </div>
            <div className="p-3 bg-cyan-100 dark:bg-cyan-900 rounded-full">
              <svg className="w-6 h-6 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center text-sm gap-3">
            <span>🖥️ {summary.onPremiseCustomers}</span>
            <span>🔀 {summary.hybridCustomers}</span>
          </div>
        </div>

        {/* Regions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Regions</p>
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(summary.byRegion).sort((a, b) => b[1] - a[1]).map(([region, count]) => (
              <div key={region} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{region}</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderFilters = () => {
    const hasActiveFilters = filters.status || filters.region || filters.priority || filters.deploymentType || searchTerm || propertyIdSearch || tenantIdSearch || subPropertySearch;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        {/* Main search row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex-1 min-w-64 relative">
            <input
              type="text"
              placeholder="Search by name, tenant ID, property ID, or sub-property..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Advanced Search Toggle */}
          <button
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
            className={`px-3 py-2 text-sm rounded-lg flex items-center gap-1 transition-colors ${
              showAdvancedSearch
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Advanced
            {(propertyIdSearch || tenantIdSearch || subPropertySearch) && (
              <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </button>

          {/* Status Filter */}
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
              className="pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer hover:border-blue-400 transition-colors"
            >
              <option value="">All Statuses</option>
              {derivedFilters.statuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Region Filter */}
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <select
              value={filters.region || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value || undefined }))}
              className="pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer hover:border-blue-400 transition-colors"
            >
              <option value="">All Regions</option>
              {derivedFilters.regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
            </svg>
            <select
              value={filters.priority || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value || undefined }))}
              className="pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer hover:border-blue-400 transition-colors"
            >
              <option value="">All Priorities</option>
              {derivedFilters.priorities.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Deployment Type Filter */}
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <select
              value={filters.deploymentType || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, deploymentType: e.target.value || undefined }))}
              className="pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm appearance-none cursor-pointer hover:border-blue-400 transition-colors"
            >
              <option value="">All Types</option>
              {derivedFilters.deploymentTypes.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Advanced Search Panel */}
        {showAdvancedSearch && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Property ID</label>
                <input
                  type="text"
                  placeholder="Search by property ID..."
                  value={propertyIdSearch}
                  onChange={(e) => setPropertyIdSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tenant ID</label>
                <input
                  type="text"
                  placeholder="Search by tenant ID..."
                  value={tenantIdSearch}
                  onChange={(e) => setTenantIdSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sub-Property</label>
                <input
                  type="text"
                  placeholder="Search by sub-property name or code..."
                  value={subPropertySearch}
                  onChange={(e) => setSubPropertySearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Use advanced search to filter by specific property ID, tenant ID, or sub-property code/name across all customers.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderCustomerTable = () => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tenant / Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Region</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Products</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Health</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{customer.customerName}</div>
                      <div className="text-xs text-gray-500">{customer.customerId}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-gray-900 dark:text-white font-mono text-xs" title="Tenant ID">🏢 {customer.tenantId}</div>
                      <div className="text-gray-500 font-mono text-xs" title="Property ID">🔑 {customer.propertyId}</div>
                      {(customer.subProperties || []).length > 0 && (
                        <div className="text-blue-500 dark:text-blue-400 text-xs mt-0.5" title="Sub-properties">
                          📋 {customer.subProperties!.length} sub-properties
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{customer.region}</td>
                  <td className="px-4 py-3">
                    <span className="text-lg" title={customer.deploymentType}>
                      {getDeploymentTypeIcon(customer.deploymentType)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(customer.status)}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(customer.priority)}`}>
                      {customer.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {customer.products.slice(0, 2).map((product, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                          {product.replace('VisualOne ', '').replace('Management', 'Mgmt')}
                        </span>
                      ))}
                      {customer.products.length > 2 && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 rounded">
                          +{customer.products.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg ${getHealthScoreColor(customer.healthScore)}`}>
                        {customer.healthScore === 'Good' ? '●' : customer.healthScore === 'Warning' ? '◐' : '○'}
                      </span>
                      <span className="text-xs text-gray-500">{customer.healthScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatRelativeTime(customer.lastActivityDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {customers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No customers found matching your filters
          </div>
        )}
      </div>
    );
  };

  const renderAnalytics = () => {
    if (!summary) return null;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Region */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customers by Region</h3>
          <div className="space-y-3">
            {Object.entries(summary.byRegion).sort((a, b) => b[1] - a[1]).map(([region, count]) => (
              <div key={region} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">{region}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(count / summary.totalCustomers) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Priority */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customers by Priority</h3>
          <div className="space-y-3">
            {Object.entries(summary.byPriority).map(([priority, count]) => {
              const colors: Record<string, string> = {
                Critical: 'bg-red-500',
                High: 'bg-orange-500',
                Medium: 'bg-yellow-500',
                Low: 'bg-green-500'
              };
              return (
                <div key={priority} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{priority}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[priority] || 'bg-gray-500'}`}
                        style={{ width: `${(count / summary.totalCustomers) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Product */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Product Adoption</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(summary.byProduct).map(([product, count]) => (
              <div key={product} className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{count}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{product}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCustomerDetailModal = () => {
    if (!selectedCustomer) return null;
    const data = editMode && editingCustomer ? editingCustomer : selectedCustomer;

    const hasAddress = data.address || data.city || data.state || data.country;
    const hasCustomerManager = data.customerManager || data.customerManagerEmail;
    const hasSupportManager = data.supportManager || data.supportManagerEmail;
    const hasOnboardedBy = data.onboardedBy || data.onboardedByEmail;
    const hasDates = data.onboardingStartDate || data.goLiveDate || data.contractStartDate || data.contractEndDate;
    const hasProducts = (data.products || []).length > 0;
    const hasSubProperties = (data.subProperties || []).length > 0;

    const EditField = ({ label, field, type = 'text' }: { label: string; field: string; type?: string }) => {
      const value = (data as any)[field] ?? '';
      return editMode ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
          <input
            type={type}
            value={type === 'date' && value ? new Date(value).toISOString().split('T')[0] : value}
            onChange={(e) => handleFieldChange(field, type === 'number' ? parseInt(e.target.value) || 0 : type === 'date' ? new Date(e.target.value).toISOString() : e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      ) : (
        <div className="flex justify-between items-center py-1">
          <span className="text-gray-500 dark:text-gray-400 text-sm">{label}</span>
          <span className="text-gray-900 dark:text-white text-sm font-medium">{type === 'date' ? formatDate(value) : value || '—'}</span>
        </div>
      );
    };

    const EditSelect = ({ label, field, options }: { label: string; field: string; options: string[] }) => {
      const value = (data as any)[field] ?? '';
      return editMode ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
          <select
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ) : null;
    };

    const InfoRow = ({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value?: string | null; mono?: boolean }) => {
      if (!value && !editMode) return null;
      return (
        <div className="flex items-center gap-2.5 py-1.5">
          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</span>
          <span className="text-gray-500 dark:text-gray-400 text-sm min-w-[90px]">{label}</span>
          <span className={`text-gray-900 dark:text-white text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
        </div>
      );
    };

    const ContactCard = ({ title, name, email, icon }: { title: string; name?: string | null; email?: string | null; icon: React.ReactNode }) => (
      <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name || '—'}</p>
          {email && (
            <a href={`mailto:${email}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block">{email}</a>
          )}
        </div>
      </div>
    );

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setSelectedCustomer(null); handleCancelEdit(); }}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {(selectedCustomer.customerName || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                {editMode ? (
                  <input
                    type="text"
                    value={editingCustomer?.customerName ?? ''}
                    onChange={(e) => handleFieldChange('customerName', e.target.value)}
                    className="text-lg font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                  />
                ) : (
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{selectedCustomer.customerName}</h2>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{selectedCustomer.customerId}</span>
                  {selectedCustomer.customerNameAlias && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">({selectedCustomer.customerNameAlias})</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isManager && !editMode && (
                <button
                  onClick={() => handleStartEdit(selectedCustomer)}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
              {editMode && (
                <>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                onClick={() => { setSelectedCustomer(null); handleCancelEdit(); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Status Badges + Metrics Row */}
            <div className="flex flex-wrap items-center gap-2">
              {editMode ? (
                <div className="flex flex-wrap gap-3">
                  <EditSelect label="Status" field="status" options={['Active', 'Onboarding', 'Suspended', 'Churned']} />
                  <EditSelect label="Priority" field="priority" options={['Critical', 'High', 'Medium', 'Low']} />
                  <EditSelect label="Deployment" field="deploymentType" options={['SaaS', 'OnPremise', 'Hybrid']} />
                  <EditSelect label="Health" field="healthScore" options={['Good', 'Warning', 'Critical']} />
                </div>
              ) : (
                <>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(data.status || '')}`}>{data.status}</span>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getPriorityColor(data.priority || '')}`}>{data.priority}</span>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {getDeploymentTypeIcon(data.deploymentType || '')} {data.deploymentType}
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getHealthScoreColor(data.healthScore || '')} bg-opacity-20`}>
                    {data.healthScore === 'Good' ? '●' : data.healthScore === 'Warning' ? '◐' : '○'} {data.healthScore}
                  </span>
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                    Last active {formatRelativeTime(data.lastActivityDate || '')}
                  </span>
                </>
              )}
            </div>

            {/* Quick Metrics */}
            {!editMode && (
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{data.totalProperties ?? 0}</div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Properties</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-700 dark:text-green-300">{(data.subProperties || []).length}</div>
                  <div className="text-[11px] text-green-600 dark:text-green-400 font-medium">Sub-Properties</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-purple-700 dark:text-purple-300">{data.activeUsers ?? 0}</div>
                  <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Active Users</div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-orange-700 dark:text-orange-300">{data.openTickets ?? 0}</div>
                  <div className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">Open Tickets</div>
                </div>
              </div>
            )}

            {editMode && (
              <div className="grid grid-cols-3 gap-4">
                <EditField label="Active Users" field="activeUsers" type="number" />
                <EditField label="Total Properties" field="totalProperties" type="number" />
                <EditField label="Open Tickets" field="openTickets" type="number" />
              </div>
            )}

            {/* Identification */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Identification</h3>
              {editMode ? (
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Tenant ID" field="tenantId" />
                  <EditField label="Property ID" field="propertyId" />
                  <EditField label="Region" field="region" />
                  <EditField label="Version" field="currentVersion" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1">
                  <InfoRow icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} label="Tenant" value={data.tenantId} mono />
                  <InfoRow icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>} label="Property" value={data.propertyId} mono />
                  <InfoRow icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label="Region" value={data.region} />
                  <InfoRow icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>} label="Version" value={data.currentVersion} />
                </div>
              )}
            </div>

            {/* Sub-Properties — now prominent */}
            {hasSubProperties && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sub-Properties ({data.subProperties!.length})
                  </h3>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/80">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Property Code</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Property Name</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Property ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {(data.subProperties || []).map((sp, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                          <td className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                              {sp.id}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{sp.name}</td>
                          <td className="px-4 py-2">
                            {sp.propertyId ? (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                {sp.propertyId}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Products */}
            {hasProducts && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Products</h3>
                <div className="flex flex-wrap gap-2">
                  {(data.products || []).map((product, idx) => (
                    <span key={idx} className="px-3 py-1 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-medium">
                      {product}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contacts — only show sections with data */}
            {(hasCustomerManager || hasSupportManager || hasOnboardedBy || editMode) && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Contacts</h3>
                {editMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500">Customer Manager</p>
                      <EditField label="Name" field="customerManager" />
                      <EditField label="Email" field="customerManagerEmail" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500">Support Manager</p>
                      <EditField label="Name" field="supportManager" />
                      <EditField label="Email" field="supportManagerEmail" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500">Onboarded By</p>
                      <EditField label="Name" field="onboardedBy" />
                      <EditField label="Email" field="onboardedByEmail" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {hasCustomerManager && (
                      <ContactCard
                        title="Customer Manager"
                        name={data.customerManager}
                        email={data.customerManagerEmail}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                      />
                    )}
                    {hasSupportManager && (
                      <ContactCard
                        title="Support Manager"
                        name={data.supportManager}
                        email={data.supportManagerEmail}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                      />
                    )}
                    {hasOnboardedBy && (
                      <ContactCard
                        title="Onboarded By"
                        name={data.onboardedBy}
                        email={data.onboardedByEmail}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Address — only show if data exists */}
            {(hasAddress || editMode) && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Address</h3>
                {editMode ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><EditField label="Address" field="address" /></div>
                    <EditField label="City" field="city" />
                    <EditField label="State" field="state" />
                    <EditField label="Country" field="country" />
                    <EditField label="Postal Code" field="postalCode" />
                  </div>
                ) : (
                  <p className="text-sm text-gray-900 dark:text-white">
                    {[data.address, data.city, data.state, data.country, data.postalCode].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Key Dates — only show if data exists */}
            {(hasDates || editMode) && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Key Dates</h3>
                {editMode ? (
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="Onboarding Start" field="onboardingStartDate" type="date" />
                    <EditField label="Go Live" field="goLiveDate" type="date" />
                    <EditField label="Contract Start" field="contractStartDate" type="date" />
                    <EditField label="Contract End" field="contractEndDate" type="date" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {data.onboardingStartDate && (
                      <div><div className="text-xs text-gray-500 dark:text-gray-400">Onboarding</div><div className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(data.onboardingStartDate)}</div></div>
                    )}
                    {data.goLiveDate && (
                      <div><div className="text-xs text-gray-500 dark:text-gray-400">Go Live</div><div className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(data.goLiveDate)}</div></div>
                    )}
                    {data.contractStartDate && (
                      <div><div className="text-xs text-gray-500 dark:text-gray-400">Contract Start</div><div className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(data.contractStartDate)}</div></div>
                    )}
                    {data.contractEndDate && (
                      <div><div className="text-xs text-gray-500 dark:text-gray-400">Contract End</div><div className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(data.contractEndDate)}</div></div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
        <button onClick={loadData} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage and monitor all customers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setSyncingAliases(true);
              setSyncResult(null);
              try {
                const result = await syncAliasesFromDevOps();
                setSyncResult(result);
                if (result.updated > 0) await loadData();
              } catch (err: any) {
                setSyncResult({ updated: 0, totalCustomers: 0, totalTags: 0, matchedInDevOps: 0, changes: [], message: err?.response?.data?.error || 'Failed to sync aliases from DevOps' });
              } finally {
                setSyncingAliases(false);
              }
            }}
            disabled={syncingAliases}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            {syncingAliases ? 'Syncing...' : 'Sync Aliases from DevOps'}
          </button>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div className={`mb-4 p-4 rounded-lg border ${syncResult.updated > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-medium ${syncResult.updated > 0 ? 'text-green-800 dark:text-green-300' : 'text-blue-800 dark:text-blue-300'}`}>
                {syncResult.message}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {syncResult.totalTags} unique tags scanned · {syncResult.matchedInDevOps} customers matched in DevOps
              </p>
              {syncResult.changes && syncResult.changes.length > 0 && (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-h-48 overflow-y-auto">
                  {syncResult.changes.map((c: any, i: number) => (
                    <div key={i}>
                      <span className="font-medium">{c.customerName}</span>: {c.oldAlias || '(empty)'} → <span className="font-semibold text-green-700 dark:text-green-400">{c.newAlias}</span>
                      <span className="text-xs ml-2 text-gray-400">(matched by {c.matchedBy}, tag: {c.devOpsTag})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {renderSummaryCards()}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'all', label: 'All Customers', count: customers.length },
            { id: 'analytics', label: 'Analytics', count: null }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'all' && (
        <>
          {renderFilters()}
          {renderCustomerTable()}
        </>
      )}
      {activeTab === 'analytics' && renderAnalytics()}

      {/* Customer Detail Modal */}
      {renderCustomerDetailModal()}
    </div>
  );
};

export default CustomerDashboardV2;
