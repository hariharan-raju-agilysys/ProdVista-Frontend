import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, Globe, Server, Cloud, ChevronRight, ChevronDown, ArrowLeft,
  Search, Bug, AlertTriangle, CheckCircle, Users, MapPin, Clock,
  Shield, RefreshCw, Layers, Tag
} from 'lucide-react';
import {
  getProductionOverview, getCustomerIssues,
  type ProductionOverviewResponse, type RegionOverview, type RegionCustomer,
  type CustomerIssue, type CustomerIssuesResponse
} from '../services/productionCustomersService';
import MagicalQuoteOverlay, { getRandomQuote, fetchAiQuote } from '../components/MagicalQuoteOverlay';

type View = 'regions' | 'customers' | 'detail';

const priorityColors: Record<number, string> = {
  1: 'bg-red-100 text-red-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-yellow-100 text-yellow-800',
  4: 'bg-blue-100 text-blue-800',
};

const stateColors: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700',
  Active: 'bg-yellow-100 text-yellow-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-gray-100 text-gray-600',
};

const healthColors: Record<string, string> = {
  Good: 'text-green-600',
  Warning: 'text-yellow-600',
  Critical: 'text-red-600',
};

const deploymentIcons: Record<string, typeof Cloud> = {
  SaaS: Cloud,
  OnPremise: Server,
  Hybrid: Layers,
};

export default function ProductionCustomersPage() {
  const [data, setData] = useState<ProductionOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Navigation state
  const [view, setView] = useState<View>('regions');
  const [selectedRegion, setSelectedRegion] = useState<RegionOverview | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<RegionCustomer | null>(null);

  // Issues state
  const [issues, setIssues] = useState<CustomerIssuesResponse | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(false);

  // Motivational quote popup
  const [showQuote, setShowQuote] = useState(true);
  const [quote, setQuote] = useState<{ text: string; author: string; isAiGenerated?: boolean }>(getRandomQuote);

  const dismissQuote = useCallback(() => {
    setShowQuote(false);
  }, []);

  useEffect(() => {
    fetchAiQuote().then(setQuote);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await getProductionOverview();
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load production overview');
    } finally {
      setLoading(false);
    }
  }

  function handleRegionClick(region: RegionOverview) {
    setSelectedRegion(region);
    setSelectedCustomer(null);
    setIssues(null);
    setView('customers');
    setSearch('');
  }

  function handleCustomerClick(customer: RegionCustomer) {
    setSelectedCustomer(customer);
    setView('detail');
    loadIssues(customer.customerId);
  }

  async function loadIssues(customerId: string) {
    setIssuesLoading(true);
    setIssues(null);
    try {
      const res = await getCustomerIssues(customerId);
      setIssues(res);
    } catch {
      setIssues(null);
    } finally {
      setIssuesLoading(false);
    }
  }

  function goBack() {
    if (view === 'detail') {
      setSelectedCustomer(null);
      setIssues(null);
      setView('customers');
    } else if (view === 'customers') {
      setSelectedRegion(null);
      setView('regions');
      setSearch('');
    }
  }

  // Search filter
  const filteredRegions = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.regions;
    const q = search.toLowerCase();
    return data.regions.map(r => ({
      ...r,
      customers: r.customers.filter(c =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerId.toLowerCase().includes(q) ||
        c.currentVersion?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.state?.toLowerCase().includes(q)
      ),
    })).filter(r => r.customers.length > 0 || r.region.toLowerCase().includes(q));
  }, [data, search]);

  const filteredCustomers = useMemo(() => {
    if (!selectedRegion) return [];
    const allCustomers = selectedRegion.customers;
    if (!search.trim()) return allCustomers;
    const q = search.toLowerCase();
    return allCustomers.filter(c =>
      c.customerName.toLowerCase().includes(q) ||
      c.customerId.toLowerCase().includes(q) ||
      c.currentVersion?.toLowerCase().includes(q) ||
      c.deploymentType?.toLowerCase().includes(q)
    );
  }, [selectedRegion, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading production customers...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
          <button onClick={loadData} className="ml-3 underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Motivational Quote Popup */}
      {showQuote && <MagicalQuoteOverlay quote={quote} onDismiss={dismissQuote} />}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'regions' && (
            <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <Building2 className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Production Customers</h1>
            <Breadcrumb view={view} region={selectedRegion} customer={selectedCustomer} onNav={(v) => {
              if (v === 'regions') { setView('regions'); setSelectedRegion(null); setSelectedCustomer(null); setIssues(null); setSearch(''); }
              else if (v === 'customers') { setView('customers'); setSelectedCustomer(null); setIssues(null); }
            }} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view !== 'detail' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers, versions..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}
          <button onClick={loadData} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {data && view === 'regions' && <SummaryBar summary={data.summary} />}

      {/* Views */}
      {view === 'regions' && <RegionsView regions={filteredRegions} onRegionClick={handleRegionClick} />}
      {view === 'customers' && selectedRegion && (
        <CustomersView region={selectedRegion} customers={filteredCustomers} onCustomerClick={handleCustomerClick} />
      )}
      {view === 'detail' && selectedCustomer && (
        <CustomerDetail customer={selectedCustomer} issues={issues} issuesLoading={issuesLoading} onRefreshIssues={() => loadIssues(selectedCustomer.customerId)} />
      )}
    </div>
  );
}

// ── Breadcrumb ─────────────────────────────────────────────────────────

function Breadcrumb({ view, region, customer, onNav }: {
  view: View; region: RegionOverview | null; customer: RegionCustomer | null;
  onNav: (v: View) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
      <button onClick={() => onNav('regions')} className="hover:text-indigo-600">All Regions</button>
      {(view === 'customers' || view === 'detail') && region && (
        <>
          <ChevronRight className="w-3 h-3" />
          <button onClick={() => onNav('customers')} className="hover:text-indigo-600">{region.region}</button>
        </>
      )}
      {view === 'detail' && customer && (
        <>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700 font-medium">{customer.customerName}</span>
        </>
      )}
    </div>
  );
}

// ── Summary Bar ────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: ProductionOverviewResponse['summary'] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <StatCard label="Total Customers" value={summary.totalCustomers} icon={Building2} color="text-indigo-600" bg="bg-indigo-50" />
      <StatCard label="Regions" value={summary.totalRegions} icon={Globe} color="text-blue-600" bg="bg-blue-50" />
      <StatCard label="Properties" value={summary.totalProperties} icon={MapPin} color="text-emerald-600" bg="bg-emerald-50" />
      <StatCard label="Open Tickets" value={summary.totalOpenTickets} icon={Bug} color="text-red-600" bg="bg-red-50" />
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-gray-500 mb-2">Versions</div>
        <div className="space-y-1">
          {Object.entries(summary.versionDistribution).sort(([a], [b]) => b.localeCompare(a)).map(([ver, count]) => (
            <div key={ver} className="flex justify-between text-sm">
              <span className="font-mono text-gray-700">{ver}</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-gray-500 mb-2">Deployment</div>
        <div className="space-y-1">
          {Object.entries(summary.deploymentTypes).map(([type, count]) => (
            <div key={type} className="flex justify-between text-sm">
              <span className="text-gray-700">{type}</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number; icon: typeof Building2; color: string; bg: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3">
      <div className={`${bg} p-2.5 rounded-lg`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}

// ── Regions View ───────────────────────────────────────────────────────

function RegionsView({ regions, onRegionClick }: {
  regions: RegionOverview[]; onRegionClick: (r: RegionOverview) => void;
}) {
  if (regions.length === 0) {
    return <div className="text-center text-gray-500 py-12">No regions found. Seed customer data first.</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {regions.map(region => (
        <div
          key={region.region}
          onClick={() => onRegionClick(region)}
          className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2.5 rounded-lg">
                <Globe className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-700">{region.region}</h3>
                <p className="text-sm text-gray-500">{region.customerCount} customers · {region.totalProperties} properties</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
          </div>

          {/* Version distribution */}
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-500 mb-2">Version Distribution</div>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(region.versionDistribution).sort(([a], [b]) => b.localeCompare(a)).map(([ver, count]) => (
                <span key={ver} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-sm">
                  <Tag className="w-3 h-3 text-gray-500" />
                  <span className="font-mono font-medium">{ver}</span>
                  <span className="text-gray-500">({count})</span>
                </span>
              ))}
            </div>
          </div>

          {/* Deployment types */}
          <div className="flex items-center gap-4 text-sm">
            {Object.entries(region.deploymentTypes).map(([type, count]) => {
              const Icon = deploymentIcons[type] || Server;
              return (
                <div key={type} className="flex items-center gap-1.5 text-gray-600">
                  <Icon className="w-4 h-4" />
                  <span>{type}: {count}</span>
                </div>
              );
            })}
          </div>

          {/* Health & tickets */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-sm">
            <div className="flex items-center gap-1.5 text-gray-600">
              <Users className="w-4 h-4" />
              <span>{region.totalUsers.toLocaleString()} users</span>
            </div>
            {region.totalOpenTickets > 0 && (
              <div className="flex items-center gap-1.5 text-red-600">
                <Bug className="w-4 h-4" />
                <span>{region.totalOpenTickets} open tickets</span>
              </div>
            )}
            {Object.entries(region.healthDistribution).map(([health, count]) => (
              <div key={health} className={`flex items-center gap-1.5 ${healthColors[health] || 'text-gray-500'}`}>
                {health === 'Good' && <CheckCircle className="w-4 h-4" />}
                {health === 'Warning' && <AlertTriangle className="w-4 h-4" />}
                {health === 'Critical' && <Shield className="w-4 h-4" />}
                <span>{health}: {count}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Customers View ─────────────────────────────────────────────────────

function CustomersView({ region, customers, onCustomerClick }: {
  region: RegionOverview; customers: RegionCustomer[]; onCustomerClick: (c: RegionCustomer) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Region header stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Customers" value={region.customerCount} icon={Building2} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard label="Properties" value={region.totalProperties} icon={MapPin} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Users" value={region.totalUsers} icon={Users} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Open Tickets" value={region.totalOpenTickets} icon={Bug} color="text-red-600" bg="bg-red-50" />
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Versions</div>
          {Object.entries(region.versionDistribution).sort(([a], [b]) => b.localeCompare(a)).map(([ver, count]) => (
            <div key={ver} className="flex justify-between text-sm">
              <span className="font-mono">{ver}</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Customer table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Version</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Deployment</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Properties</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Users</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tickets</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Health</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Priority</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map(c => {
              const DIcon = deploymentIcons[c.deploymentType] || Server;
              return (
                <tr
                  key={c.customerId}
                  onClick={() => onCustomerClick(c)}
                  className="border-b border-gray-100 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.customerName}</div>
                    <div className="text-xs text-gray-500">{c.customerId} · {c.city}, {c.state}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{c.currentVersion}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <DIcon className="w-4 h-4" />
                      <span>{c.deploymentType}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.totalProperties}</td>
                  <td className="px-4 py-3 text-gray-700">{c.activeUsers.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {c.openTickets > 0 ? (
                      <span className="text-red-600 font-medium">{c.openTickets}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${healthColors[c.healthScore] || 'text-gray-500'}`}>{c.healthScore}</span>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div className="text-center text-gray-500 py-8">No customers match your search.</div>
        )}
      </div>
    </div>
  );
}

// ── Customer Detail View ───────────────────────────────────────────────

function CustomerDetail({ customer, issues, issuesLoading, onRefreshIssues }: {
  customer: RegionCustomer;
  issues: CustomerIssuesResponse | null;
  issuesLoading: boolean;
  onRefreshIssues: () => void;
}) {
  const [expandedProps, setExpandedProps] = useState(true);
  const DIcon = deploymentIcons[customer.deploymentType] || Server;

  return (
    <div className="space-y-6">
      {/* Customer header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-50 p-3 rounded-xl">
              <Building2 className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{customer.customerName}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span>{customer.customerId}</span>
                <span>·</span>
                <span>{customer.city}, {customer.state}, {customer.country}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm ${healthColors[customer.healthScore] || 'text-gray-500'}`}>{customer.healthScore}</span>
            <PriorityBadge priority={customer.priority} />
          </div>
        </div>

        {/* Key info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
          <InfoCell label="Version" value={customer.currentVersion} mono />
          <InfoCell label="Deployment" value={customer.deploymentType} icon={<DIcon className="w-4 h-4" />} />
          <InfoCell label="Properties" value={String(customer.totalProperties)} />
          <InfoCell label="Active Users" value={customer.activeUsers.toLocaleString()} />
          <InfoCell label="Open Tickets" value={String(customer.openTickets)} highlight={customer.openTickets > 0} />
          <InfoCell label="Status" value={customer.status} />
        </div>

        {/* Managers */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="text-sm">
            <span className="text-gray-500">Customer Manager:</span>
            <span className="ml-2 text-gray-800 font-medium">{customer.customerManager || '-'}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Support Manager:</span>
            <span className="ml-2 text-gray-800 font-medium">{customer.supportManager || '-'}</span>
          </div>
        </div>

        {/* Products */}
        {customer.products && customer.products.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2">Products</div>
            <div className="flex flex-wrap gap-2">
              {customer.products.map(p => (
                <span key={p} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Properties section */}
      {customer.subProperties && customer.subProperties.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl">
          <button
            onClick={() => setExpandedProps(!expandedProps)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-gray-900">Properties ({customer.subProperties.length})</span>
            </div>
            {expandedProps ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {expandedProps && (
            <div className="px-6 pb-4 border-t border-gray-100">
              <table className="w-full text-sm mt-3">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-2 font-medium">Property ID</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Version</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.subProperties.map(sp => (
                    <tr key={sp.id} className="border-t border-gray-50">
                      <td className="py-2 font-mono text-gray-600">{sp.id}</td>
                      <td className="py-2 text-gray-800">{sp.name}</td>
                      <td className="py-2">
                        <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{customer.currentVersion}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Issues section */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-500" />
            <span className="font-semibold text-gray-900">
              Azure DevOps Issues
              {issues && issues.totalCount !== undefined && ` (${issues.totalCount})`}
            </span>
          </div>
          <button onClick={onRefreshIssues} className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Refresh issues">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${issuesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="px-6 py-4">
          {issuesLoading && (
            <div className="flex items-center gap-2 text-gray-500 py-4">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Fetching issues from Azure DevOps...</span>
            </div>
          )}

          {!issuesLoading && issues && !issues.connected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              {issues.message || 'Azure DevOps connection not configured.'}
            </div>
          )}

          {!issuesLoading && issues && issues.connected && issues.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {issues.error}
            </div>
          )}

          {!issuesLoading && issues && issues.connected && !issues.error && issues.issues.length === 0 && (
            <div className="text-center text-gray-500 py-6">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p>No open bugs or issues found for this customer.</p>
            </div>
          )}

          {!issuesLoading && issues && issues.issues.length > 0 && (
            <div className="space-y-3">
              {issues.issues.map(issue => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Issue Card ─────────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: CustomerIssue }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className={`mt-0.5 px-2 py-0.5 rounded text-xs font-semibold ${priorityColors[issue.priority] || 'bg-gray-100 text-gray-700'}`}>
            P{issue.priority}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">#{issue.id}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${stateColors[issue.state] || 'bg-gray-100 text-gray-600'}`}>
                {issue.state}
              </span>
              {issue.isCustomerReported && (
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">Customer Reported</span>
              )}
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">{issue.workItemType}</span>
            </div>
            <button onClick={() => setExpanded(!expanded)} className="text-left mt-1">
              <span className="text-sm font-medium text-gray-900 hover:text-indigo-700">{issue.title}</span>
            </button>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
              {issue.assignedTo && <span>Assigned: {issue.assignedTo}</span>}
              {issue.severity && <span>Severity: {issue.severity}</span>}
              {issue.areaPath && <span>{issue.areaPath}</span>}
              {issue.createdDate && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(issue.createdDate).toLocaleDateString()}
                </span>
              )}
            </div>
            {issue.tags && (
              <div className="flex flex-wrap gap-1 mt-2">
                {issue.tags.split(';').map(tag => tag.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {expanded && issue.reproSteps && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-700 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: issue.reproSteps }}
        />
      )}
    </div>
  );
}

// ── Small Components ───────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    Critical: 'bg-red-100 text-red-700',
    High: 'bg-orange-100 text-orange-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[priority] || 'bg-gray-100 text-gray-600'}`}>
      {priority}
    </span>
  );
}

function InfoCell({ label, value, mono, icon, highlight }: {
  label: string; value: string; mono?: boolean; icon?: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-0.5 flex items-center gap-1.5 text-sm font-medium ${highlight ? 'text-red-600' : 'text-gray-900'} ${mono ? 'font-mono' : ''}`}>
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}
