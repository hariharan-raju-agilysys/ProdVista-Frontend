import { useState, useEffect, useMemo } from 'react';
import {
  X, Search, Plus, CheckCircle, LayoutGrid, List, Loader2,
  Sparkles, Cloud, Activity, Shield, Eye, Timer, Server,
  Zap, ChevronDown, ChevronUp, Filter, Box
} from 'lucide-react';
import clsx from 'clsx';
import {
  getTemplateCatalog,
  applyTemplates,
  quickSetupPage,
  WidgetTemplateCatalog,
  WidgetTemplateItem,
  AzureConfigOverride,
  getAzureSubscriptions,
  getLogAnalyticsWorkspaces,
  getAppInsightsInstances,
  AzureSubscription,
  AzureWorkspace,
  AzureAppInsights,
} from '../services/dynamicDashboardService';
import { getResourceGraphSubscriptions } from '../services/api';

interface WidgetTemplateGalleryProps {
  pageSlug: string;
  onClose: () => void;
  onTemplatesApplied: () => void;
}

const CATEGORY_ICONS: Record<string, typeof Activity> = {
  'Azure Monitor': Cloud,
  'Application Insights': Eye,
  'Azure DevOps': Server,
  'Infrastructure': Box,
  'Logs & Traces': Activity,
  'Performance': Timer,
  'Security': Shield,
  'General': LayoutGrid,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Azure Monitor': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'Application Insights': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'Azure DevOps': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  'Infrastructure': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  'Logs & Traces': 'bg-red-500/10 text-red-400 border-red-500/30',
  'Performance': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  'Security': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  'General': 'bg-green-500/10 text-green-400 border-green-500/30',
};

const WIDGET_TYPE_LABELS: Record<string, string> = {
  'metric-card': 'Metric Card',
  'kpi': 'KPI',
  'gauge': 'Gauge',
  'line-chart': 'Line Chart',
  'bar-chart': 'Bar Chart',
  'doughnut-chart': 'Doughnut',
  'area-chart': 'Area Chart',
  'data-table': 'Data Table',
  'status-list': 'Status List',
  'timeline': 'Timeline',
  'map': 'Map',
  'logs-viewer': 'Logs Viewer',
  'azure-metrics': 'Azure Metrics',
  'custom-html': 'Custom HTML',
};

export function WidgetTemplateGallery({ pageSlug, onClose, onTemplatesApplied }: WidgetTemplateGalleryProps) {
  const [catalog, setCatalog] = useState<WidgetTemplateCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAzureConfig, setShowAzureConfig] = useState(false);

  // Azure config state
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [workspaces, setWorkspaces] = useState<AzureWorkspace[]>([]);
  const [appInsights, setAppInsights] = useState<AzureAppInsights[]>([]);
  const [azureConfig, setAzureConfig] = useState<AzureConfigOverride>({});
  const [loadingAzure, setLoadingAzure] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const res = await getTemplateCatalog();
      setCatalog(res.data);
    } catch (err) {
      console.error('Failed to load template catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAzureSubscriptions = async () => {
    try {
      setLoadingAzure(true);
      const res = await getResourceGraphSubscriptions();
      setSubscriptions(res.data || []);
    } catch (err) {
      console.error('Failed to load Azure subscriptions:', err);
      try {
        const fallback = await getAzureSubscriptions();
        setSubscriptions(fallback.data || []);
      } catch {
        // silently fail
      }
    } finally {
      setLoadingAzure(false);
    }
  };

  const handleSubscriptionChange = async (subId: string) => {
    setAzureConfig(prev => ({ ...prev, subscriptionId: subId }));
    if (subId) {
      try {
        const [wsRes, aiRes] = await Promise.all([
          getLogAnalyticsWorkspaces(subId),
          getAppInsightsInstances(subId),
        ]);
        setWorkspaces(wsRes.data || []);
        setAppInsights(aiRes.data || []);
      } catch {
        // silently fail
      }
    }
  };

  const filteredTemplates = useMemo(() => {
    if (!catalog) return [];
    let templates = catalog.templates;
    if (activeCategory !== 'all') {
      templates = templates.filter(t => t.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      templates = templates.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q)) ||
        t.widgetType.toLowerCase().includes(q) ||
        t.dataProviderType.toLowerCase().includes(q)
      );
    }
    return templates;
  }, [catalog, activeCategory, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const allIds = filteredTemplates.map(t => t.id);
    setSelectedIds(new Set(allIds));
  };

  const selectNone = () => setSelectedIds(new Set());

  const selectCategory = (cat: string) => {
    const catIds = (catalog?.templates || []).filter(t => t.category === cat).map(t => t.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      catIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleApplySelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      setApplying(true);
      await applyTemplates(pageSlug, {
        templateIds: Array.from(selectedIds),
        azureConfig: (azureConfig.subscriptionId || azureConfig.resourceId || azureConfig.workspaceId) ? azureConfig : undefined,
      });
      onTemplatesApplied();
    } catch (err) {
      console.error('Failed to apply templates:', err);
    } finally {
      setApplying(false);
    }
  };

  const handleQuickSetup = async () => {
    try {
      setApplying(true);
      await quickSetupPage(pageSlug, {
        replaceExisting: true,
        azureConfig: (azureConfig.subscriptionId || azureConfig.resourceId || azureConfig.workspaceId) ? azureConfig : undefined,
      });
      onTemplatesApplied();
    } catch (err) {
      console.error('Failed quick setup:', err);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[95vw] max-w-7xl h-[90vh] bg-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Widget Template Gallery</h2>
              <p className="text-xs text-gray-400">
                {catalog ? `${catalog.totalCount} templates across ${catalog.categories.length} categories` : 'Loading...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                {selectedIds.size} selected
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-700/30 bg-gray-800/30 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700/50 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700/50">
            <button
              onClick={() => setViewMode('grid')}
              className={clsx('p-2 rounded-l-lg transition-colors', viewMode === 'grid' ? 'bg-violet-500/20 text-violet-400' : 'text-gray-500 hover:text-gray-300')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx('p-2 rounded-r-lg transition-colors', viewMode === 'list' ? 'bg-violet-500/20 text-violet-400' : 'text-gray-500 hover:text-gray-300')}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Azure Config toggle */}
          <button
            onClick={() => {
              setShowAzureConfig(!showAzureConfig);
              if (!showAzureConfig && subscriptions.length === 0) loadAzureSubscriptions();
            }}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
              showAzureConfig
                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                : 'bg-gray-800 border-gray-700/50 text-gray-400 hover:text-gray-200'
            )}
          >
            <Cloud className="w-4 h-4" />
            Azure Config
            {showAzureConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Select buttons */}
          <div className="flex items-center gap-1">
            <button onClick={selectAll} className="px-3 py-2 text-xs bg-gray-800 border border-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors">
              Select All
            </button>
            <button onClick={selectNone} className="px-3 py-2 text-xs bg-gray-800 border border-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors">
              Clear
            </button>
          </div>

          {/* Quick Setup */}
          <button
            onClick={handleQuickSetup}
            disabled={applying}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20"
          >
            <Zap className="w-4 h-4" />
            Quick Setup
          </button>

          {/* Apply Selected */}
          <button
            onClick={handleApplySelected}
            disabled={applying || selectedIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:from-violet-400 hover:to-cyan-400 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20"
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} to Dashboard
          </button>
        </div>

        {/* Azure Config Panel (collapsible) */}
        {showAzureConfig && (
          <div className="px-6 py-3 border-b border-gray-700/30 bg-blue-950/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Azure Subscription</label>
                <select
                  value={azureConfig.subscriptionId || ''}
                  onChange={e => handleSubscriptionChange(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-lg text-sm text-gray-200 focus:border-blue-500/50"
                >
                  <option value="">-- Select Subscription --</option>
                  {loadingAzure ? (
                    <option disabled>Loading...</option>
                  ) : (
                    subscriptions.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Log Analytics Workspace</label>
                <select
                  value={azureConfig.workspaceId || ''}
                  onChange={e => setAzureConfig(prev => ({ ...prev, workspaceId: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-lg text-sm text-gray-200 focus:border-blue-500/50"
                >
                  <option value="">-- Select Workspace --</option>
                  {workspaces.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.resourceGroup})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Application Insights</label>
                <select
                  value={azureConfig.resourceId || ''}
                  onChange={e => setAzureConfig(prev => ({ ...prev, resourceId: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded-lg text-sm text-gray-200 focus:border-blue-500/50"
                >
                  <option value="">-- Select App Insights --</option>
                  {appInsights.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.resourceGroup})</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Configure Azure resources to auto-wire templates. Leave blank for manual configuration later.
            </p>
          </div>
        )}

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar */}
          <div className="w-52 shrink-0 border-r border-gray-700/30 bg-gray-800/20 overflow-y-auto hidden md:block">
            <div className="p-3">
              <button
                onClick={() => setActiveCategory('all')}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1',
                  activeCategory === 'all'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'text-gray-400 hover:bg-gray-700/30 hover:text-white'
                )}
              >
                <Filter className="w-4 h-4" />
                All Templates
                <span className="ml-auto text-xs opacity-60">{catalog?.totalCount || 0}</span>
              </button>

              <div className="mt-3 space-y-1">
                {catalog?.categories.map(cat => {
                  const Icon = CATEGORY_ICONS[cat.name] || LayoutGrid;
                  const isActive = activeCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
                      onClick={() => setActiveCategory(cat.name)}
                      className={clsx(
                        'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors group',
                        isActive
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                          : 'text-gray-400 hover:bg-gray-700/30 hover:text-white'
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{cat.name}</span>
                      <span className="ml-auto text-xs opacity-60 shrink-0">{cat.count}</span>
                      {!isActive && (
                        <button
                          onClick={e => { e.stopPropagation(); selectCategory(cat.name); }}
                          className="hidden group-hover:block text-xs text-violet-400 hover:text-violet-300 shrink-0"
                          title={`Select all ${cat.name}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Template grid/list */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Search className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-lg font-medium">No templates found</p>
                <p className="text-sm">Try a different search or category</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredTemplates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isSelected={selectedIds.has(template.id)}
                    onToggle={() => toggleSelect(template.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map(template => (
                  <TemplateListRow
                    key={template.id}
                    template={template}
                    isSelected={selectedIds.has(template.id)}
                    onToggle={() => toggleSelect(template.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, isSelected, onToggle }: { template: WidgetTemplateItem; isSelected: boolean; onToggle: () => void }) {
  const colorClass = CATEGORY_COLORS[template.category] || CATEGORY_COLORS['General'];
  const Icon = CATEGORY_ICONS[template.category] || LayoutGrid;

  return (
    <div
      onClick={onToggle}
      className={clsx(
        'relative rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg group',
        isSelected
          ? 'bg-violet-500/10 border-violet-500/50 shadow-violet-500/10 ring-1 ring-violet-500/30'
          : 'bg-gray-800/50 border-gray-700/30 hover:border-gray-600/50 hover:bg-gray-800/70'
      )}
    >
      {/* Selection indicator */}
      <div className={clsx(
        'absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
        isSelected
          ? 'bg-violet-500 border-violet-500'
          : 'border-gray-600 group-hover:border-gray-400'
      )}>
        {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
      </div>

      {/* Category badge */}
      <div className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border mb-3', colorClass)}>
        <Icon className="w-3 h-3" />
        {template.category}
      </div>

      {/* Icon + Title */}
      <div className="mb-2">
        <span className="text-xl">{template.icon}</span>
      </div>
      <h3 className="text-sm font-semibold text-white mb-1 leading-tight">{template.title}</h3>
      {template.subtitle && (
        <p className="text-xs text-gray-500 mb-2">{template.subtitle}</p>
      )}
      <p className="text-xs text-gray-400 line-clamp-2 mb-3">{template.description}</p>

      {/* Footer meta */}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="px-1.5 py-0.5 rounded bg-gray-700/50">
          {WIDGET_TYPE_LABELS[template.widgetType] || template.widgetType}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-gray-700/50">
          {template.dataProviderType}
        </span>
      </div>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {template.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700/30 text-gray-500">
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="text-[9px] text-gray-600">+{template.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateListRow({ template, isSelected, onToggle }: { template: WidgetTemplateItem; isSelected: boolean; onToggle: () => void }) {
  const colorClass = CATEGORY_COLORS[template.category] || CATEGORY_COLORS['General'];
  const Icon = CATEGORY_ICONS[template.category] || LayoutGrid;

  return (
    <div
      onClick={onToggle}
      className={clsx(
        'flex items-center gap-4 rounded-lg border px-4 py-3 cursor-pointer transition-all',
        isSelected
          ? 'bg-violet-500/10 border-violet-500/50'
          : 'bg-gray-800/50 border-gray-700/30 hover:border-gray-600/50'
      )}
    >
      {/* Checkbox */}
      <div className={clsx(
        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
        isSelected ? 'bg-violet-500 border-violet-500' : 'border-gray-600'
      )}>
        {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
      </div>

      {/* Icon */}
      <span className="text-xl shrink-0">{template.icon}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white truncate">{template.title}</h3>
          <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border', colorClass)}>
            <Icon className="w-3 h-3" />
            {template.category}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5">{template.description}</p>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] px-2 py-1 rounded bg-gray-700/50 text-gray-400">
          {WIDGET_TYPE_LABELS[template.widgetType] || template.widgetType}
        </span>
        <span className="text-[10px] px-2 py-1 rounded bg-gray-700/50 text-gray-400">
          {template.dataProviderType}
        </span>
        <span className="text-[10px] text-gray-500">{template.defaultWidth}x{template.defaultHeight}</span>
      </div>
    </div>
  );
}

export default WidgetTemplateGallery;
