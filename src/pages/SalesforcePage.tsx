import { useState, useEffect, useCallback } from 'react';
import salesforceService, {
  SalesforceConnection, SalesforceCase, SalesforceCaseComment,
  SalesforceAccount, SalesforceUserIdentity,
  getPriorityColor, getStatusColor, formatRelativeTime,
} from '../services/salesforceService';
import { useAuth } from '../context/AuthContext';
import {
  Cloud, ExternalLink, Loader2, RefreshCw, Search, User, Users, X, Plus,
  AlertTriangle, Clock, MessageSquare, Building2, Shield,
  Settings, Phone, Globe,
  Zap, Trash2,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════
type ViewMode = 'cases' | 'accounts' | 'setup';

// ════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════
export default function SalesforcePage() {
  useAuth(); // ensure authenticated

  // Connection state
  const [connections, setConnections] = useState<SalesforceConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [identity, setIdentity] = useState<SalesforceUserIdentity | null>(null);

  // Cases state
  const [cases, setCases] = useState<SalesforceCase[]>([]);
  const [totalCases, setTotalCases] = useState(0);
  const [selectedCase, setSelectedCase] = useState<SalesforceCase | null>(null);
  const [caseComments, setCaseComments] = useState<SalesforceCaseComment[]>([]);

  // Accounts state
  const [accounts, setAccounts] = useState<SalesforceAccount[]>([]);

  // Filters
  const [userScope, setUserScope] = useState<'mine' | 'all'>('mine');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [accountSearch, setAccountSearch] = useState('');

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('cases');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup form
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [setupForm, setSetupForm] = useState({
    connectionName: '',
    instanceUrl: 'https://agilysys.my.salesforce.com',
    clientId: '',
    clientSecret: '',
  });

  // ────────────────────────────────────────────────────────────
  // Data loading
  // ────────────────────────────────────────────────────────────

  const loadConnections = useCallback(async () => {
    try {
      const conns = await salesforceService.getConnections();
      setConnections(conns);
      if (conns.length > 0 && !selectedConnectionId) {
        const active = conns.find(c => c.isActive && c.hasRefreshToken) || conns[0];
        setSelectedConnectionId(active.id);
      }
      if (conns.length === 0) {
        setViewMode('setup');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message);
    }
  }, [selectedConnectionId]);

  const loadCases = useCallback(async () => {
    if (!selectedConnectionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await salesforceService.getCases(selectedConnectionId, {
        scope: userScope,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchTerm || undefined,
        limit: 100,
      });
      setCases(result.cases);
      setTotalCases(result.totalSize);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [selectedConnectionId, userScope, statusFilter, priorityFilter, searchTerm]);

  const loadAccounts = useCallback(async () => {
    if (!selectedConnectionId) return;
    setLoading(true);
    try {
      const data = await salesforceService.getAccounts(selectedConnectionId, accountSearch || undefined, 100);
      setAccounts(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedConnectionId, accountSearch]);

  const loadCaseDetail = useCallback(async (caseItem: SalesforceCase) => {
    setSelectedCase(caseItem);
    if (!selectedConnectionId) return;
    try {
      const comments = await salesforceService.getCaseComments(selectedConnectionId, caseItem.id);
      setCaseComments(comments);
    } catch {
      setCaseComments([]);
    }
  }, [selectedConnectionId]);

  const loadIdentity = useCallback(async () => {
    if (!selectedConnectionId) return;
    try {
      const id = await salesforceService.getIdentity(selectedConnectionId);
      setIdentity(id);
    } catch {
      setIdentity(null);
    }
  }, [selectedConnectionId]);

  // Effects
  useEffect(() => { loadConnections(); }, [loadConnections]);

  useEffect(() => {
    if (selectedConnectionId) {
      loadIdentity();
      if (viewMode === 'cases') loadCases();
      if (viewMode === 'accounts') loadAccounts();
    }
  }, [selectedConnectionId, viewMode, loadCases, loadAccounts, loadIdentity]);

  // ────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────

  const handleCreateConnection = async () => {
    if (!setupForm.connectionName || !setupForm.clientId || !setupForm.clientSecret) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const conn = await salesforceService.createConnection({
        connectionName: setupForm.connectionName,
        instanceUrl: setupForm.instanceUrl,
        clientId: setupForm.clientId,
        clientSecret: setupForm.clientSecret,
      });
      setSelectedConnectionId(conn.id);
      setShowSetupForm(false);
      setSetupForm({ connectionName: '', instanceUrl: 'https://agilysys.my.salesforce.com', clientId: '', clientSecret: '' });
      await loadConnections();

      // Start OAuth flow
      await startOAuthFlow(conn.id);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const startOAuthFlow = async (connectionId: string) => {
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const authUrl = await salesforceService.getAuthUrl(connectionId, redirectUri);
      // Store connectionId for callback
      sessionStorage.setItem('sf_oauth_conn_id', connectionId);
      sessionStorage.setItem('sf_oauth_redirect', redirectUri);
      window.location.href = authUrl;
    } catch (err: any) {
      setError(`OAuth redirect failed: ${err.message}`);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Delete this Salesforce connection?')) return;
    try {
      await salesforceService.deleteConnection(id);
      if (selectedConnectionId === id) setSelectedConnectionId('');
      await loadConnections();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message);
    }
  };

  const handleRefresh = () => {
    if (viewMode === 'cases') loadCases();
    else if (viewMode === 'accounts') loadAccounts();
  };

  // OAuth callback handler (on page load)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const connId = sessionStorage.getItem('sf_oauth_conn_id');
    const redirect = sessionStorage.getItem('sf_oauth_redirect');

    if (code && connId && redirect) {
      sessionStorage.removeItem('sf_oauth_conn_id');
      sessionStorage.removeItem('sf_oauth_redirect');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Exchange code
      salesforceService.oauthCallback(connId, code, redirect).then(result => {
        if (result.success) {
          setSelectedConnectionId(connId);
          loadConnections();
        } else {
          setError(`Salesforce auth failed: ${result.message}`);
        }
      });
    }
  }, []);

  // ────────────────────────────────────────────────────────────
  // Stat helpers
  // ────────────────────────────────────────────────────────────
  const openCases = cases.filter(c => !c.isClosed);
  const highPriorityCases = cases.filter(c => ['High', 'Critical'].includes(c.priority));
  const escalatedCases = cases.filter(c => c.isEscalated);

  // ════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-[#1a1a2e] dark:via-[#16213e] dark:to-[#0f3460] p-6">
      <div className="max-w-[1600px] mx-auto space-y-5">

        {/* ══════ Header ══════ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Salesforce Support Center</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Customer cases &amp; tickets from Salesforce
                {identity && <span className="ml-2 text-blue-500">• {identity.displayName}</span>}
              </p>
            </div>
          </div>

          {/* Connection selector */}
          <div className="flex items-center gap-2">
            {connections.length > 0 && (
              <select
                value={selectedConnectionId}
                onChange={e => setSelectedConnectionId(e.target.value)}
                className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                {connections.map(c => (
                  <option key={c.id} value={c.id}>{c.connectionName}</option>
                ))}
              </select>
            )}
            <button onClick={() => setShowSetupForm(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-3.5 h-3.5" /> Connect
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
            <button onClick={() => setError(null)}><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}

        {/* ══════ KPI Strip ══════ */}
        {viewMode === 'cases' && selectedConnectionId && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Cases', value: totalCases, icon: MessageSquare, color: 'blue' },
              { label: 'Open', value: openCases.length, icon: Clock, color: 'amber' },
              { label: 'High Priority', value: highPriorityCases.length, icon: AlertTriangle, color: 'red' },
              { label: 'Escalated', value: escalatedCases.length, icon: Zap, color: 'purple' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white dark:bg-[#292929] rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{kpi.value}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-lg bg-${kpi.color}-50 dark:bg-${kpi.color}-900/20 flex items-center justify-center`}>
                    <kpi.icon className={`w-4.5 h-4.5 text-${kpi.color}-600 dark:text-${kpi.color}-400`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════ Toolbar ══════ */}
        <div className="bg-white dark:bg-[#292929] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            {/* Left: View tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              {([
                { id: 'cases' as ViewMode, label: 'Cases', icon: MessageSquare },
                { id: 'accounts' as ViewMode, label: 'Accounts', icon: Building2 },
                { id: 'setup' as ViewMode, label: 'Setup', icon: Settings },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    viewMode === tab.id
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            {/* Right: Filters */}
            <div className="flex items-center gap-2">
              {viewMode === 'cases' && (
                <>
                  {/* My/All toggle */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                    <button onClick={() => setUserScope('mine')} className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${userScope === 'mine' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                      <User className="w-3 h-3" /> My
                    </button>
                    <button onClick={() => setUserScope('all')} className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${userScope === 'all' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                      <Users className="w-3 h-3" /> All
                    </button>
                  </div>

                  {/* Status filter */}
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <option value="">All Status</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="New">New</option>
                    <option value="Working">Working</option>
                    <option value="Escalated">Escalated</option>
                  </select>

                  {/* Priority filter */}
                  <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <option value="">All Priority</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && loadCases()}
                      placeholder="Search cases..."
                      className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 w-48"
                    />
                  </div>
                </>
              )}

              {viewMode === 'accounts' && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={accountSearch}
                    onChange={e => setAccountSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadAccounts()}
                    placeholder="Search accounts..."
                    className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 w-48"
                  />
                </div>
              )}

              {loading && (
                <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading
                </span>
              )}
              <button onClick={handleRefresh} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ══════ Content ══════ */}
        {viewMode === 'cases' && <CasesView cases={cases} selectedCase={selectedCase} caseComments={caseComments} onCaseClick={loadCaseDetail} onCloseDetail={() => setSelectedCase(null)} />}
        {viewMode === 'accounts' && <AccountsView accounts={accounts} />}
        {viewMode === 'setup' && <SetupView
          connections={connections}
          showForm={showSetupForm || connections.length === 0}
          form={setupForm}
          setForm={setSetupForm}
          onCreate={handleCreateConnection}
          onReconnect={startOAuthFlow}
          onTest={async (id) => {
            const r = await salesforceService.testConnection(id);
            alert(r.success ? `Connected! User: ${r.userName}` : `Failed: ${r.message}`);
            loadConnections();
          }}
          onDelete={handleDeleteConnection}
          loading={loading}
        />}

        {/* ══════ Setup Form Modal ══════ */}
        {showSetupForm && viewMode !== 'setup' && (
          <SetupModal
            form={setupForm}
            setForm={setSetupForm}
            onSave={handleCreateConnection}
            onClose={() => setShowSetupForm(false)}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Cases View
// ════════════════════════════════════════════════════════════════
function CasesView({ cases, selectedCase, caseComments, onCaseClick, onCloseDetail }: {
  cases: SalesforceCase[];
  selectedCase: SalesforceCase | null;
  caseComments: SalesforceCaseComment[];
  onCaseClick: (c: SalesforceCase) => void;
  onCloseDetail: () => void;
}) {
  if (cases.length === 0) {
    return (
      <div className="bg-white dark:bg-[#292929] rounded-xl border border-slate-200 dark:border-slate-700/50 p-12 text-center">
        <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">No cases found. Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-5">
      {/* Case list */}
      <div className={`${selectedCase ? 'w-1/2' : 'w-full'} space-y-2 transition-all`}>
        {cases.map(c => (
          <div
            key={c.id}
            onClick={() => onCaseClick(c)}
            className={`bg-white dark:bg-[#292929] rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedCase?.id === c.id
                ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/30'
                : 'border-slate-200 dark:border-slate-700/50 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{c.caseNumber}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getStatusColor(c.status)}`}>
                    {c.status}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getPriorityColor(c.priority)}`}>
                    {c.priority}
                  </span>
                  {c.isEscalated && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20">
                      <Zap className="w-2.5 h-2.5 inline mr-0.5" />Escalated
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white truncate">{c.subject}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {c.accountName && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.accountName}</span>}
                  {c.contactName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.contactName}</span>}
                  {c.ownerName && <span className="flex items-center gap-1"><Shield className="w-3 h-3" />Owner: {c.ownerName}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-slate-400">{formatRelativeTime(c.createdDate)}</span>
                {c.caseUrl && (
                  <a href={c.caseUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="text-blue-500 hover:text-blue-600">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Case detail panel */}
      {selectedCase && (
        <div className="w-1/2 bg-white dark:bg-[#292929] rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-lg overflow-hidden">
          <div className="sticky top-0 bg-white dark:bg-[#292929] border-b border-slate-200 dark:border-slate-700/50 px-5 py-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-slate-400">{selectedCase.caseNumber}</span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">{selectedCase.subject}</h3>
            </div>
            <div className="flex items-center gap-2">
              {selectedCase.caseUrl && (
                <a href={selectedCase.caseUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <ExternalLink className="w-3 h-3" /> Open in Salesforce
                </a>
              )}
              <button onClick={onCloseDetail} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
          </div>

          <div className="p-5 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(selectedCase.status)}`}>{selectedCase.status}</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getPriorityColor(selectedCase.priority)}`}>{selectedCase.priority}</span>
              {selectedCase.type && <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{selectedCase.type}</span>}
              {selectedCase.origin && <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{selectedCase.origin}</span>}
            </div>

            {/* Description */}
            {selectedCase.description && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Description</h4>
                <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 whitespace-pre-wrap">
                  {selectedCase.description}
                </div>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Account', value: selectedCase.accountName, icon: Building2 },
                { label: 'Contact', value: selectedCase.contactName, icon: User },
                { label: 'Contact Email', value: selectedCase.contactEmail, icon: MessageSquare },
                { label: 'Owner', value: selectedCase.ownerName, icon: Shield },
                { label: 'Created', value: selectedCase.createdDate ? new Date(selectedCase.createdDate).toLocaleString() : '-' },
                { label: 'Last Modified', value: selectedCase.lastModifiedDate ? new Date(selectedCase.lastModifiedDate).toLocaleString() : '-' },
              ].map(d => (
                <div key={d.label} className="text-xs">
                  <span className="text-slate-400 dark:text-slate-500">{d.label}</span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">{d.value || '-'}</p>
                </div>
              ))}
            </div>

            {/* Comments */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" /> Comments ({caseComments.length})
              </h4>
              {caseComments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No comments yet</p>
              ) : (
                <div className="space-y-2">
                  {caseComments.map(comment => (
                    <div key={comment.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{comment.createdByName || 'Unknown'}</span>
                        <span className="text-[10px] text-slate-400">{formatRelativeTime(comment.createdDate)}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{comment.commentBody}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Accounts View
// ════════════════════════════════════════════════════════════════
function AccountsView({ accounts }: { accounts: SalesforceAccount[] }) {
  if (accounts.length === 0) {
    return (
      <div className="bg-white dark:bg-[#292929] rounded-xl border border-slate-200 dark:border-slate-700/50 p-12 text-center">
        <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">No accounts found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {accounts.map(acc => (
        <div key={acc.id} className="bg-white dark:bg-[#292929] rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white truncate">{acc.name}</h3>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {acc.industry && <span>{acc.industry}</span>}
                {acc.type && <span>• {acc.type}</span>}
              </div>
            </div>
            {acc.openCaseCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                <MessageSquare className="w-3 h-3" />{acc.openCaseCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400">
            {acc.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{acc.phone}</span>}
            {acc.website && (
              <a href={acc.website.startsWith('http') ? acc.website : `https://${acc.website}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-500 hover:text-blue-600">
                <Globe className="w-3 h-3" />Website
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Setup View
// ════════════════════════════════════════════════════════════════
function SetupView({ connections, showForm, form, setForm, onCreate, onReconnect, onTest, onDelete, loading }: {
  connections: SalesforceConnection[];
  showForm: boolean;
  form: any;
  setForm: (f: any) => void;
  onCreate: () => void;
  onReconnect: (id: string) => void;
  onTest: (id: string) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Existing connections */}
      {connections.map(conn => (
        <div key={conn.id} className="bg-white dark:bg-[#292929] rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${conn.hasRefreshToken ? 'bg-green-500' : 'bg-amber-500'}`} />
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{conn.connectionName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{conn.instanceUrl}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${conn.hasRefreshToken ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'}`}>
                {conn.hasRefreshToken ? 'Connected' : 'Needs Auth'}
              </span>
              {conn.lastSyncAt && <span className="text-[10px] text-slate-400">Synced: {formatRelativeTime(conn.lastSyncAt)}</span>}
              {!conn.hasRefreshToken && (
                <button onClick={() => onReconnect(conn.id)} className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  Authorize
                </button>
              )}
              <button onClick={() => onTest(conn.id)} className="text-xs text-slate-600 hover:text-slate-700 dark:text-slate-400 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                Test
              </button>
              <button onClick={() => onDelete(conn.id)} className="text-xs text-red-500 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* New connection form */}
      {showForm && (
        <div className="bg-white dark:bg-[#292929] rounded-xl border border-slate-200 dark:border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-4">Connect Salesforce</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Create a <strong>Connected App</strong> in Salesforce Setup → App Manager → New Connected App.
            Enable OAuth with scopes: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">api</code> and <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">refresh_token</code>.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Connection Name" value={form.connectionName} onChange={v => setForm({ ...form, connectionName: v })} placeholder="e.g. Agilysys Production" />
            <InputField label="Instance URL" value={form.instanceUrl} onChange={v => setForm({ ...form, instanceUrl: v })} placeholder="https://agilysys.my.salesforce.com" />
            <InputField label="Consumer Key (Client ID)" value={form.clientId} onChange={v => setForm({ ...form, clientId: v })} placeholder="From Connected App" />
            <InputField label="Consumer Secret" value={form.clientSecret} onChange={v => setForm({ ...form, clientSecret: v })} placeholder="From Connected App" type="password" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onCreate} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              Save &amp; Authorize
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Setup Modal (overlay when not on setup tab)
// ════════════════════════════════════════════════════════════════
function SetupModal({ form, setForm, onSave, onClose, loading }: {
  form: any; setForm: (f: any) => void; onSave: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#292929] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Connect Salesforce</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <InputField label="Connection Name" value={form.connectionName} onChange={v => setForm({ ...form, connectionName: v })} placeholder="e.g. Agilysys Production" />
          <InputField label="Instance URL" value={form.instanceUrl} onChange={v => setForm({ ...form, instanceUrl: v })} placeholder="https://agilysys.my.salesforce.com" />
          <InputField label="Consumer Key (Client ID)" value={form.clientId} onChange={v => setForm({ ...form, clientId: v })} placeholder="From Connected App" />
          <InputField label="Consumer Secret" value={form.clientSecret} onChange={v => setForm({ ...form, clientSecret: v })} placeholder="From Connected App" type="password" />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
          <button onClick={onSave} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />} Save &amp; Authorize
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Shared input field
// ════════════════════════════════════════════════════════════════
function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
      />
    </div>
  );
}
