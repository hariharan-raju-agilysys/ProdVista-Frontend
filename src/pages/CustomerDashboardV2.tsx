import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getCustomerSummary,
  getCustomers,
  getFilterOptions,
  updateCustomer,
  CustomerDetailDto,
  CustomerSummaryDto,
  CustomerFilterDto,
  FilterOptions,
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
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
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
      const [summaryData, customersData, filterData] = await Promise.all([
        getCustomerSummary(),
        getCustomers(),
        getFilterOptions()
      ]);
      setSummary(summaryData);
      setCustomers(customersData);
      setFilterOptions(filterData);
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

        {/* Top Region */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Top Region</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {Object.entries(summary.byRegion).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1 text-xs">
            {Object.entries(summary.byRegion).slice(0, 3).map(([region, count]) => (
              <span key={region} className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {region}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderFilters = () => {
    if (!filterOptions) return null;

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
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value || undefined }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Statuses</option>
            {filterOptions.statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Region Filter */}
          <select
            value={filters.region || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, region: e.target.value || undefined }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Regions</option>
            {filterOptions.regions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={filters.priority || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value || undefined }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Priorities</option>
            {filterOptions.priorities.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Deployment Type Filter */}
          <select
            value={filters.deploymentType || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, deploymentType: e.target.value || undefined }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            {filterOptions.deploymentTypes.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

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

    const EditField = ({ label, field, type = 'text' }: { label: string; field: string; type?: string }) => {
      const value = (data as any)[field] ?? '';
      return editMode ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{label}</label>
          <input
            type={type}
            value={type === 'date' && value ? new Date(value).toISOString().split('T')[0] : value}
            onChange={(e) => handleFieldChange(field, type === 'number' ? parseInt(e.target.value) || 0 : type === 'date' ? new Date(e.target.value).toISOString() : e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      ) : (
        <div className="flex justify-between">
          <span className="text-gray-500">{label}</span>
          <span className="text-gray-900 dark:text-white">{type === 'date' ? formatDate(value) : value || 'N/A'}</span>
        </div>
      );
    };

    const EditSelect = ({ label, field, options }: { label: string; field: string; options: string[] }) => {
      const value = (data as any)[field] ?? '';
      return editMode ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">{label}</label>
          <select
            value={value}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ) : null;
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <div>
              {editMode ? (
                <input
                  type="text"
                  value={editingCustomer?.customerName ?? ''}
                  onChange={(e) => handleFieldChange('customerName', e.target.value)}
                  className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none"
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCustomer.customerName}</h2>
              )}
              <p className="text-sm text-gray-500">{selectedCustomer.customerId}</p>
            </div>
            <div className="flex items-center gap-2">
              {isManager && !editMode && (
                <button
                  onClick={() => handleStartEdit(selectedCustomer)}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg flex items-center gap-1"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                onClick={() => { setSelectedCustomer(null); handleCancelEdit(); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Row */}
            <div className="flex flex-wrap gap-3">
              {editMode ? (
                <>
                  <EditSelect label="Status" field="status" options={['Active', 'Onboarding', 'Suspended', 'Churned']} />
                  <EditSelect label="Priority" field="priority" options={['Critical', 'High', 'Medium', 'Low']} />
                  <EditSelect label="Deployment" field="deploymentType" options={['SaaS', 'OnPremise', 'Hybrid']} />
                  <EditSelect label="Health" field="healthScore" options={['Good', 'Warning', 'Critical']} />
                </>
              ) : (
                <>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(data.status || '')}`}>{data.status}</span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(data.priority || '')}`}>{data.priority} Priority</span>
                  <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {getDeploymentTypeIcon(data.deploymentType || '')} {data.deploymentType}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getHealthScoreColor(data.healthScore || '')} bg-opacity-20`}>
                    Health: {data.healthScore}
                  </span>
                </>
              )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Identification */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Identification</h3>
                <div className="space-y-2 text-sm">
                  <EditField label="Tenant ID" field="tenantId" />
                  <EditField label="Property ID" field="propertyId" />
                  <EditField label="Region" field="region" />
                  <EditField label="Version" field="currentVersion" />
                </div>
              </div>

              {/* Address */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Address</h3>
                {editMode ? (
                  <div className="space-y-2">
                    <EditField label="Address" field="address" />
                    <EditField label="City" field="city" />
                    <EditField label="State" field="state" />
                    <EditField label="Country" field="country" />
                    <EditField label="Postal Code" field="postalCode" />
                  </div>
                ) : (
                  <div className="text-sm text-gray-900 dark:text-white">
                    <p>{data.address}</p>
                    <p>{data.city}, {data.state}</p>
                    <p>{data.country} {data.postalCode}</p>
                  </div>
                )}
              </div>

              {/* Customer Manager */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Customer Manager</h3>
                {editMode ? (
                  <div className="space-y-2">
                    <EditField label="Name" field="customerManager" />
                    <EditField label="Email" field="customerManagerEmail" />
                  </div>
                ) : (
                  <div className="text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">{data.customerManager}</p>
                    <a href={`mailto:${data.customerManagerEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline">{data.customerManagerEmail}</a>
                  </div>
                )}
              </div>

              {/* Support Manager */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Support Manager</h3>
                {editMode ? (
                  <div className="space-y-2">
                    <EditField label="Name" field="supportManager" />
                    <EditField label="Email" field="supportManagerEmail" />
                  </div>
                ) : (
                  <div className="text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">{data.supportManager}</p>
                    <a href={`mailto:${data.supportManagerEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline">{data.supportManagerEmail}</a>
                  </div>
                )}
              </div>

              {/* Onboarded By */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Onboarded By</h3>
                {editMode ? (
                  <div className="space-y-2">
                    <EditField label="Name" field="onboardedBy" />
                    <EditField label="Email" field="onboardedByEmail" />
                  </div>
                ) : (
                  <div className="text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">{data.onboardedBy}</p>
                    <a href={`mailto:${data.onboardedByEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline">{data.onboardedByEmail}</a>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Key Dates</h3>
                <div className="space-y-2 text-sm">
                  <EditField label="Onboarding Start" field="onboardingStartDate" type="date" />
                  <EditField label="Go Live" field="goLiveDate" type="date" />
                  <EditField label="Contract Start" field="contractStartDate" type="date" />
                  <EditField label="Contract End" field="contractEndDate" type="date" />
                </div>
              </div>
            </div>

            {/* Products */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Products</h3>
              <div className="flex flex-wrap gap-2">
                {(data.products || []).map((product, idx) => (
                  <span key={idx} className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                    {product}
                  </span>
                ))}
              </div>
            </div>

            {/* Sub-Properties */}
            {(data.subProperties || []).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Sub-Properties ({data.subProperties?.length || 0})
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-600">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Property Code</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Property Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Property ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {(data.subProperties || []).map((sp, idx) => (
                        <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-gray-650">
                          <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-white">{sp.id}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{sp.name}</td>
                          <td className="px-4 py-2 text-sm font-mono text-blue-600 dark:text-blue-400">{sp.propertyId ?? 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {editMode ? (
                <>
                  <EditField label="Active Users" field="activeUsers" type="number" />
                  <EditField label="Total Properties" field="totalProperties" type="number" />
                  <EditField label="Open Tickets" field="openTickets" type="number" />
                </>
              ) : (
                <>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.activeUsers}</div>
                    <div className="text-xs text-gray-500">Active Users</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.totalProperties}</div>
                    <div className="text-xs text-gray-500">Properties</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.openTickets}</div>
                    <div className="text-xs text-gray-500">Open Tickets</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{formatRelativeTime(data.lastActivityDate || '')}</div>
                    <div className="text-xs text-gray-500">Last Activity</div>
                  </div>
                </>
              )}
            </div>
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
