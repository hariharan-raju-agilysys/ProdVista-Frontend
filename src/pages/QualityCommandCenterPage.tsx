import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getConnections, getKpiSummary,
  QualityConnection, KpiSummary,
  getSeverityColor, getStateColor, formatDate
} from '../services/qualityService';
import {
  smartQuery, getPanels, savePanel, togglePin, deletePanel, markExecuted,
  SmartQueryInterpretation, QualityQueryPanelDto
} from '../services/qualityCommandService';
import {
  Search, Sparkles, Loader2, RefreshCw, X, Pin, PinOff, Trash2, Play,
  Bug, Target, Activity, TrendingUp, TrendingDown, Users, Calendar,
  BarChart3, AlertTriangle, Shield, Clock, Save, Bookmark
} from 'lucide-react';

// ============================================================================
// Endpoint → Service Function Map (used to execute interpreted queries)
// ============================================================================
const ENDPOINT_EXECUTOR: Record<string, (params: Record<string, unknown>, connectionId?: string) => Promise<unknown>> = {
  'summary': (p, c) => import('../services/qualityService').then(m => m.getQualitySummary(c, p.iterationPath as string)),
  'bugs': (p, c) => import('../services/qualityService').then(m => m.getBugs(p as never, c)),
  'my-bugs': (p, c) => import('../services/qualityService').then(m => m.getMyBugs(c, p.iterationPath as string, p.state as string)),
  'releases': (_, c) => import('../services/qualityService').then(m => m.getReleases(c)),
  'owner-efficiency': (p, c) => import('../services/qualityService').then(m => m.getOwnerEfficiency(c, p.iterationPath as string)),
  'trend': (p, c) => import('../services/qualityService').then(m => m.getTrend(p.days as number, c, p.iterationPath as string)),
  'aging': (p, c) => import('../services/qualityService').then(m => m.getAgingDistribution(c, p.iterationPath as string)),
  'kpi-summary': (p, c) => import('../services/qualityService').then(m => m.getKpiSummary(c, p.areaPath as string)),
  'features': (p) => import('../services/qualityService').then(m => m.getFeatureGroups(p.iterationPath as string)),
  'pull-requests': (p, c) => import('../services/qualityService').then(m => m.getPullRequests(c, p.status as string, p.top as number)),
  'pipelines': (_, c) => import('../services/qualityService').then(m => m.getPipelines(c)),
  'builds': (p, c) => import('../services/qualityService').then(m => m.getBuilds(c, p.top as number)),
  'board-summary': (p, c) => import('../services/qualityService').then(m => m.getBoardSummary(c, p.iterationPath as string)),
  'sprint-work-items': (p, c) => import('../services/qualityService').then(m => m.getSprintWorkItems(c, p.iterationPath as string)),
  'bug-analytics/by-area': (p) => import('../services/qualityService').then(m => m.getBugsByArea(p as never)),
  'bug-analytics/team-summary': (p) => import('../services/qualityService').then(m => m.getTeamSummary(p as never)),
};

// ============================================================================
// Quick Action Chips
// ============================================================================
const QUICK_ACTIONS = [
  { label: 'Critical Bugs', prompt: 'Show all critical active bugs', icon: AlertTriangle, color: 'red' },
  { label: 'My Items', prompt: 'Show my assigned bugs', icon: Users, color: 'blue' },
  { label: 'Sprint Health', prompt: 'Show current sprint summary', icon: Target, color: 'green' },
  { label: 'Bug Trend', prompt: 'Show bug creation vs resolution trend last 30 days', icon: TrendingUp, color: 'purple' },
  { label: 'Team Efficiency', prompt: 'Show team efficiency metrics', icon: BarChart3, color: 'amber' },
  { label: 'Release Status', prompt: 'Show release iteration status', icon: Calendar, color: 'teal' },
  { label: 'Aging Bugs', prompt: 'Show aging distribution of active bugs', icon: Clock, color: 'orange' },
  { label: 'Bug Hotspots', prompt: 'Show bugs by area to find hotspots', icon: Shield, color: 'pink' },
];

// ============================================================================
// Main Component
// ============================================================================
export default function QualityCommandCenterPage() {

  // Connection state
  const [connections, setConnections] = useState<QualityConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | undefined>();

  // KPI strip
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  // Smart query
  const [prompt, setPrompt] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [interpretation, setInterpretation] = useState<SmartQueryInterpretation | null>(null);
  const [queryResult, setQueryResult] = useState<unknown>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Saved panels
  const [panels, setPanels] = useState<QualityQueryPanelDto[]>([]);
  const [panelsLoading, setPanelsLoading] = useState(false);

  // Panel execution results (keyed by panel id)
  const [panelResults, setPanelResults] = useState<Record<string, unknown>>({});
  const [panelLoadingIds, setPanelLoadingIds] = useState<Set<string>>(new Set());

  const promptRef = useRef<HTMLInputElement>(null);

  // ---- Init ----
  useEffect(() => {
    loadConnections();
    loadPanels();
  }, []);

  useEffect(() => {
    if (selectedConnectionId) loadKpi();
  }, [selectedConnectionId]);

  const loadConnections = async () => {
    try {
      const conns = await getConnections();
      setConnections(conns);
      if (conns.length > 0) setSelectedConnectionId(conns[0].id);
    } catch { /* skip */ }
  };

  const loadKpi = async () => {
    setKpiLoading(true);
    try {
      const data = await getKpiSummary(selectedConnectionId);
      setKpi(data);
    } catch { /* skip */ }
    setKpiLoading(false);
  };

  const loadPanels = async () => {
    setPanelsLoading(true);
    try {
      setPanels(await getPanels());
    } catch { /* skip */ }
    setPanelsLoading(false);
  };

  // ---- Smart Query ----
  const executeSmartQuery = useCallback(async (queryPrompt: string) => {
    if (!queryPrompt.trim()) return;
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setInterpretation(null);

    try {
      const res = await smartQuery(queryPrompt, selectedConnectionId);
      if (!res.success) {
        setQueryError(res.error || 'Query interpretation failed');
        return;
      }

      setInterpretation(res.interpretation);

      // Execute the actual quality endpoint
      const executor = ENDPOINT_EXECUTOR[res.interpretation.endpointKey];
      if (executor) {
        const data = await executor(res.interpretation.parameters, selectedConnectionId);
        setQueryResult(data);
      } else {
        setQueryError(`Endpoint "${res.interpretation.endpointKey}" not yet mapped`);
      }
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setQueryLoading(false);
    }
  }, [selectedConnectionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSmartQuery(prompt);
  };

  // ---- Panel actions ----
  const handleSavePanel = async () => {
    if (!interpretation) return;
    try {
      await savePanel({
        name: interpretation.suggestedName || prompt.slice(0, 60),
        prompt,
        endpointKey: interpretation.endpointKey,
        parameters: JSON.stringify(interpretation.parameters),
        visualizationType: interpretation.visualizationType,
        visualizationConfig: JSON.stringify(interpretation.visualization),
        isPinned: false,
      });
      await loadPanels();
    } catch { /* skip */ }
  };

  const handleRunPanel = async (panel: QualityQueryPanelDto) => {
    setPanelLoadingIds(prev => new Set(prev).add(panel.id));
    try {
      const executor = ENDPOINT_EXECUTOR[panel.endpointKey];
      if (executor) {
        const params = JSON.parse(panel.parameters || '{}');
        const data = await executor(params, selectedConnectionId);
        setPanelResults(prev => ({ ...prev, [panel.id]: data }));
        await markExecuted(panel.id);
      }
    } catch { /* skip */ }
    setPanelLoadingIds(prev => { const n = new Set(prev); n.delete(panel.id); return n; });
  };

  const handleTogglePin = async (panel: QualityQueryPanelDto) => {
    await togglePin(panel.id);
    setPanels(prev => prev.map(p => p.id === panel.id ? { ...p, isPinned: !p.isPinned } : p));
  };

  const handleDeletePanel = async (id: string) => {
    await deletePanel(id);
    setPanels(prev => prev.filter(p => p.id !== id));
    setPanelResults(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Quality Command Center
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">AI-powered engineering intelligence</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Connection picker */}
              {connections.length > 0 && (
                <select
                  value={selectedConnectionId || ''}
                  onChange={e => setSelectedConnectionId(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {connections.map(c => (
                    <option key={c.id} value={c.id}>{c.connectionName || c.organizationUrl}</option>
                  ))}
                </select>
              )}
              <button onClick={loadKpi} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Refresh KPI">
                <RefreshCw size={16} className={kpiLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* KPI Strip */}
        {kpi && <KpiStrip kpi={kpi} loading={kpiLoading} />}

        {/* Smart Query Bar */}
        <section className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="flex items-center gap-3 p-4">
            <div className="flex items-center gap-2 text-purple-500">
              <Sparkles size={20} />
            </div>
            <input
              ref={promptRef}
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ask anything... e.g. 'Show critical bugs in PMS module' or 'Bug trend last 30 days'"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
              disabled={queryLoading}
            />
            {prompt && (
              <button type="button" onClick={() => { setPrompt(''); setQueryResult(null); setInterpretation(null); setQueryError(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
            <button
              type="submit"
              disabled={queryLoading || !prompt.trim()}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:shadow-md disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {queryLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Query
            </button>
          </form>

          {/* Quick Action Chips */}
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(qa => (
              <button
                key={qa.label}
                onClick={() => { setPrompt(qa.prompt); executeSmartQuery(qa.prompt); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all
                  hover:shadow-sm hover:-translate-y-0.5
                  border-${qa.color}-200 text-${qa.color}-700 bg-${qa.color}-50 hover:bg-${qa.color}-100`}
              >
                <qa.icon size={12} />
                {qa.label}
              </button>
            ))}
          </div>
        </section>

        {/* Query Result Panel */}
        {(queryLoading || queryResult != null || queryError || interpretation) ? (
          <section className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
            {/* Interpretation header */}
            {interpretation && (
              <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600">
                    {interpretation.endpointKey}
                  </span>
                  <span className="text-sm text-gray-600">{interpretation.explanation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                    {interpretation.visualizationType}
                  </span>
                  <button onClick={handleSavePanel} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600" title="Save as panel">
                    <Save size={12} /> Save
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {queryLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-blue-500" />
                <span className="ml-3 text-sm text-gray-500">Interpreting and executing...</span>
              </div>
            )}

            {/* Error */}
            {queryError && (
              <div className="p-5">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle size={16} />
                  <span className="text-sm">{queryError}</span>
                </div>
              </div>
            )}

            {/* Dynamic Result Renderer */}
            {queryResult != null && !queryLoading && (
              <div className="p-5">
                <DynamicResultRenderer
                  data={queryResult}
                  visualizationType={interpretation?.visualizationType || 'table'}
                  visualization={interpretation?.visualization}
                />
              </div>
            )}
          </section>
        ) : null}

        {/* Saved Panels */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Bookmark size={18} className="text-purple-500" />
              Saved Panels
              {panels.length > 0 && <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{panels.length}</span>}
            </h2>
            {panelsLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
          </div>

          {panels.length === 0 && !panelsLoading && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
              No saved panels yet. Run a query and click "Save" to pin it here.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {panels.map(panel => (
              <SavedPanelCard
                key={panel.id}
                panel={panel}
                result={panelResults[panel.id]}
                loading={panelLoadingIds.has(panel.id)}
                onRun={() => handleRunPanel(panel)}
                onTogglePin={() => handleTogglePin(panel)}
                onDelete={() => handleDeletePanel(panel.id)}
                onLoadPrompt={() => { setPrompt(panel.prompt); promptRef.current?.focus(); }}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// ============================================================================
// KPI Strip Component
// ============================================================================
function KpiStrip({ kpi, loading }: { kpi: KpiSummary; loading: boolean }) {
  const cards = [
    { label: 'Active Bugs', value: kpi.activeBugs, icon: Bug, color: 'red', sub: `${kpi.criticalActive} critical` },
    { label: 'Resolved', value: kpi.resolvedBugs, icon: Shield, color: 'green', sub: `${kpi.resolutionRate.toFixed(0)}% rate` },
    { label: 'Features', value: kpi.features, icon: Target, color: 'blue', sub: `${kpi.userStories} stories` },
    { label: 'Weekly Trend', value: kpi.weeklyResolved - kpi.weeklyCreated, icon: kpi.bugTrend <= 0 ? TrendingDown : TrendingUp, color: kpi.bugTrend <= 0 ? 'green' : 'red', sub: `+${kpi.weeklyCreated} / -${kpi.weeklyResolved}` },
    { label: 'MTTR', value: `${kpi.mttr.toFixed(1)}d`, icon: Clock, color: 'amber', sub: 'Mean time to resolve' },
    { label: 'Work Items', value: kpi.totalWorkItems, icon: Activity, color: 'purple', sub: `${kpi.tasks} tasks` },
  ];

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 ${loading ? 'opacity-60' : ''}`}>
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">{c.label}</span>
            <c.icon size={14} className={`text-${c.color}-500`} />
          </div>
          <div className="text-2xl font-bold text-gray-900">{typeof c.value === 'number' ? String(c.value.toLocaleString()) : String(c.value)}</div>
          <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Saved Panel Card
// ============================================================================
function SavedPanelCard({
  panel, result, loading, onRun, onTogglePin, onDelete, onLoadPrompt
}: {
  panel: QualityQueryPanelDto;
  result?: unknown;
  loading: boolean;
  onRun: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onLoadPrompt: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${panel.isPinned ? 'border-purple-300 ring-1 ring-purple-100' : 'border-gray-200/80'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800 truncate flex-1 mr-2">{panel.name}</h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onTogglePin} className="p-1 text-gray-400 hover:text-purple-500" title={panel.isPinned ? 'Unpin' : 'Pin'}>
              {panel.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{panel.prompt}</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{panel.endpointKey}</span>
          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{panel.visualizationType}</span>
        </div>
      </div>

      {/* Result preview or run button */}
      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/50 flex items-center justify-between">
        <button onClick={onRun} disabled={loading} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? 'Running...' : 'Run'}
        </button>
        <button onClick={onLoadPrompt} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <Search size={12} /> Edit & Run
        </button>
      </div>

      {/* Inline result preview */}
      {result != null && !loading && (
        <div className="border-t border-gray-100 p-3 max-h-48 overflow-auto">
          <DynamicResultRenderer data={result} visualizationType={panel.visualizationType as never} compact />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Dynamic Result Renderer
// ============================================================================
function DynamicResultRenderer({
  data, visualizationType, visualization, compact
}: {
  data: unknown;
  visualizationType: 'table' | 'chart' | 'kpi' | 'list';
  visualization?: SmartQueryInterpretation['visualization'];
  compact?: boolean;
}) {
  // Handle null/undefined
  if (data == null) return <div className="text-sm text-gray-400">No data</div>;

  // If data is an array of objects → table or list
  if (Array.isArray(data)) {
    if (data.length === 0) return <div className="text-sm text-gray-400">No results found</div>;

    if (visualizationType === 'list' || compact) {
      return <ListRenderer items={data} compact={compact} />;
    }
    return <TableRenderer items={data} columns={visualization?.columns} compact={compact} />;
  }

  // If data is a flat object → KPI cards
  if (typeof data === 'object') {
    return <ObjectRenderer data={data as Record<string, unknown>} compact={compact} />;
  }

  return <div className="text-sm text-gray-700">{String(data)}</div>;
}

// ---- Table Renderer ----
function TableRenderer({ items, columns, compact }: { items: Record<string, unknown>[]; columns?: string[]; compact?: boolean }) {
  const cols = columns?.length ? columns : Object.keys(items[0] || {}).filter(k => !k.toLowerCase().includes('url') && k !== 'devOpsUrl').slice(0, compact ? 4 : 10);
  const rows = compact ? items.slice(0, 5) : items;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200">
            {cols.map(col => (
              <th key={col} className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {formatColumnName(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              {cols.map(col => (
                <td key={col} className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                  {renderCell(col, row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {compact && items.length > 5 && (
        <div className="text-xs text-gray-400 text-center py-1">+{items.length - 5} more</div>
      )}
    </div>
  );
}

// ---- List Renderer ----
function ListRenderer({ items, compact }: { items: Record<string, unknown>[]; compact?: boolean }) {
  const rows = compact ? items.slice(0, 4) : items;
  const titleKey = findKey(items[0], ['title', 'name', 'label']) || Object.keys(items[0])[1] || Object.keys(items[0])[0];
  const idKey = findKey(items[0], ['id', 'workItemId']) || Object.keys(items[0])[0];

  return (
    <div className="space-y-2">
      {rows.map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
          <span className="text-xs font-mono text-gray-400">#{String(item[idKey] ?? i + 1)}</span>
          <span className="text-sm text-gray-800 truncate flex-1">{String(item[titleKey] ?? '')}</span>
          {item.state != null && <StateChip state={String(item.state)} />}
          {item.severity != null && <SeverityChip severity={String(item.severity)} />}
          {item.assignedTo != null && <span className="text-xs text-gray-400 truncate max-w-[120px]">{String(item.assignedTo)}</span>}
        </div>
      ))}
      {compact && items.length > 4 && (
        <div className="text-xs text-gray-400 text-center">+{items.length - 4} more</div>
      )}
    </div>
  );
}

// ---- Object/KPI Renderer ----
function ObjectRenderer({ data, compact }: { data: Record<string, unknown>; compact?: boolean }) {
  const entries = Object.entries(data).filter(([, v]) => typeof v !== 'object' || v === null);
  const shown = compact ? entries.slice(0, 6) : entries;

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
      {shown.map(([key, val]) => (
        <div key={key} className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">{formatColumnName(key)}</div>
          <div className="text-lg font-semibold text-gray-800">
            {typeof val === 'number' ? String(val.toLocaleString()) : String(val ?? '\u2014')}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function formatColumnName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\s/, '')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function renderCell(key: string, value: unknown): React.ReactNode {
  if (value == null) return <span className="text-gray-300">&mdash;</span>;
  if (typeof value === 'boolean') return value ? '\u2713' : '\u2717';
  if (key.toLowerCase().includes('date') && typeof value === 'string') return formatDate(value);
  if (key === 'state') return <StateChip state={String(value)} />;
  if (key === 'severity') return <SeverityChip severity={String(value)} />;
  if (typeof value === 'number') return String(value.toLocaleString());
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function StateChip({ state }: { state: string }) {
  const color = getStateColor(state);
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${color}`} style={{ fontSize: '0.65rem' }}>{state}</span>;
}

function SeverityChip({ severity }: { severity: string }) {
  const color = getSeverityColor(severity);
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${color}`} style={{ fontSize: '0.65rem' }}>{severity}</span>;
}

function findKey(obj: Record<string, unknown> | undefined, candidates: string[]): string | undefined {
  if (!obj) return undefined;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  return candidates.find(c => keys.includes(c.toLowerCase()));
}
