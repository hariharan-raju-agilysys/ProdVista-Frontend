// =============================================================================
// ConfigDrivenDashboard — Renders an entire dashboard from a JSON config.
// The AI generates the config, this component renders it automatically.
// Every widget is interactive: clickable, maximizable, drill-downable.
// =============================================================================
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { Sparkles, RefreshCw, Wand2, Send, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  DashboardConfig,
  WidgetConfig,
  AIDashboardResponse,
} from '../types/DashboardConfigTypes';
import { WidgetContainer } from './widgets/WidgetContainer';
import { WidgetDetailModal } from './widgets/WidgetDetailModal';
import { WidgetRenderer } from './widgets/WidgetRenderer';
import { useWidgetHub, WidgetDataUpdate } from '../hooks/useWidgetHub';
import { useAIChatHub } from '../hooks/useAIChatHub';
import { saveAIConfig } from '../services/dynamicDashboardService';
import type { DashboardWidget } from '../services/dynamicDashboardService';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface ConfigDrivenDashboardProps {
  pageSlug: string;
  /** Optional pre-loaded config (if null, shows AI prompt UI) */
  initialConfig?: DashboardConfig;
  /** Called after the AI config has been saved to DB so parent can refresh */
  onApplied?: () => void;
}

/** Convert WidgetConfig to DashboardWidget for WidgetRenderer compatibility */
function toRenderWidget(wc: WidgetConfig): DashboardWidget {
  return {
    id: wc.id,
    widgetType: wc.type,
    title: wc.design.title,
    subtitle: wc.design.subtitle,
    gridX: wc.position.x,
    gridY: wc.position.y,
    gridWidth: wc.position.w,
    gridHeight: wc.position.h,
    minWidth: wc.position.minW ?? 2,
    minHeight: wc.position.minH ?? 2,
    displayOrder: 0,
    dataProviderType: wc.data.provider,
    widgetConfig: wc.data.renderConfig ?? {},
    dataProviderConfig: wc.data.staticData ? { staticData: wc.data.staticData } : {},
    refreshIntervalSeconds: wc.data.refreshInterval ?? 0,
    isLocked: false,
  };
}

export function ConfigDrivenDashboard({ pageSlug, initialConfig, onApplied }: ConfigDrivenDashboardProps) {
  const [config, setConfig] = useState<DashboardConfig | null>(initialConfig ?? null);
  const [widgetData, setWidgetData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');

  // AI prompt state
  const [prompt, setPrompt] = useState('');
  const [isPromptExpanded, setIsPromptExpanded] = useState(!initialConfig);

  // Detail modal state
  const [detailWidget, setDetailWidget] = useState<WidgetConfig | null>(null);
  const [refreshingWidgets, setRefreshingWidgets] = useState<Set<string>>(new Set());
  const [liveWidgets, setLiveWidgets] = useState<Set<string>>(new Set());

  // SignalR hubs
  const handleWidgetUpdate = useCallback((update: WidgetDataUpdate) => {
    setWidgetData(prev => ({ ...prev, [update.widgetId]: update.data }));
    setLiveWidgets(prev => new Set(prev).add(update.widgetId));
  }, []);

  const { subscribeToWidget } = useWidgetHub({
    onWidgetUpdate: handleWidgetUpdate,
  });

  const { buildDashboard, isConnected: aiConnected } = useAIChatHub({});

  // Auto-subscribe widgets that request SignalR
  useEffect(() => {
    if (!config?.widgets) return;
    config.widgets.forEach((w: WidgetConfig) => {
      if (w.realtime?.autoSubscribe || w.data.provider === 'signalr') {
        subscribeToWidget(w.id).catch(() => {});
      }
    });
  }, [config, subscribeToWidget]);

  // Initialize static data and fetch Jenkins data from config
  useEffect(() => {
    if (!config?.widgets) return;
    const initialData: Record<string, unknown> = {};
    config.widgets.forEach((w: WidgetConfig) => {
      if (w.data.staticData) {
        initialData[w.id] = w.data.staticData;
      }
    });
    setWidgetData(prev => ({ ...prev, ...initialData }));

    // Fetch Jenkins data for widgets with jenkins provider
    config.widgets.forEach(async (w: WidgetConfig) => {
      if (w.data.provider === 'jenkins' && w.data.renderConfig?.connectionId) {
        try {
          const token = localStorage.getItem('prodvista_auth_token') || '';
          const connId = w.data.renderConfig.connectionId as string;
          const endpoint = w.data.renderConfig.jenkinsEndpoint as string || 'stats';
          const resp = await fetch(`/api/jenkins/connections/${connId}/${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          if (resp.ok) {
            const jenkinsData = await resp.json();
            setWidgetData(prev => ({ ...prev, [w.id]: jenkinsData }));
          }
        } catch (err) {
          console.error(`Jenkins widget ${w.id} fetch error:`, err);
        }
      }
    });
  }, [config]);

  // Auto-refresh timers
  const refreshTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  useEffect(() => {
    const timers = refreshTimersRef.current;
    timers.forEach(t => clearInterval(t));
    timers.clear();

    if (!config?.widgets) return;
    config.widgets.forEach((w: WidgetConfig) => {
      if (w.data.refreshInterval && w.data.refreshInterval > 0) {
        timers.set(w.id, setInterval(() => {
          handleRefreshWidget(w);
        }, w.data.refreshInterval * 1000));
      }
    });

    return () => {
      timers.forEach(t => clearInterval(t));
      timers.clear();
    };
  }, [config?.widgets]);

  // Build grid layouts from config
  const layouts = useMemo((): { [key: string]: Layout[] } => {
    if (!config?.widgets) return { lg: [], md: [], sm: [], xs: [] };
    const lg: Layout[] = config.widgets.map((w: WidgetConfig) => ({
      i: w.id,
      x: w.position.x,
      y: w.position.y,
      w: w.position.w,
      h: w.position.h,
      minW: w.position.minW ?? 2,
      minH: w.position.minH ?? 2,
      static: true,
    }));
    return {
      lg,
      md: lg.map(l => ({ ...l, w: Math.min(l.w, 10) })),
      sm: lg.map(l => ({ ...l, w: Math.min(l.w, 6), x: l.x % 6 })),
      xs: lg.map(l => ({ ...l, w: Math.min(l.w, 4), x: 0 })),
    };
  }, [config]);

  // AI build dashboard via SignalR streaming
  const handleAIBuild = async (applyToPage = false) => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setStreamingText('');
    try {
      await buildDashboard(
        {
          prompt: prompt.trim(),
          pageSlug,
          includeDesign: true,
        },
        {
          onStart: () => {
            setStreamingText('');
          },
          onToken: (_token, accumulated) => {
            setStreamingText(accumulated);
          },
          onComplete: async (fullContent) => {
            // Parse the JSON response from accumulated LLM output
            const tryParseConfig = (str: string): AIDashboardResponse | null => {
              try {
                return JSON.parse(str) as AIDashboardResponse;
              } catch {
                return null;
              }
            };

            // Attempt to repair truncated JSON by closing unclosed brackets/braces
            const repairTruncatedJson = (str: string): string => {
              const openBraces = (str.match(/\{/g) || []).length;
              const closeBraces = (str.match(/\}/g) || []).length;
              const openBrackets = (str.match(/\[/g) || []).length;
              const closeBrackets = (str.match(/\]/g) || []).length;

              // Trim trailing incomplete value (partial string, number, etc.)
              let repaired = str.replace(/,\s*"[^"]*$/, '');        // trailing key without value
              repaired = repaired.replace(/,\s*$/, '');               // trailing comma
              repaired = repaired.replace(/"[^"]*$/, '"');           // close unclosed string

              // Close unclosed brackets then braces
              for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
              for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
              return repaired;
            };

            try {
              // Strip markdown code fences if present
              let jsonStr = fullContent.trim();
              if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
              }

              // Try direct parse first
              let parsed = tryParseConfig(jsonStr);

              // If direct parse fails, try to repair truncated JSON
              if (!parsed) {
                const repaired = repairTruncatedJson(jsonStr);
                parsed = tryParseConfig(repaired);
              }

              // Try extracting JSON object from response
              if (!parsed) {
                const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  parsed = tryParseConfig(jsonMatch[0]);
                  if (!parsed) {
                    const repaired = repairTruncatedJson(jsonMatch[0]);
                    parsed = tryParseConfig(repaired);
                  }
                }
              }

              // Last resort: extract just the config object even without explanation
              if (!parsed) {
                const configMatch = fullContent.match(/"config"\s*:\s*\{/);
                if (configMatch) {
                  const repaired = repairTruncatedJson('{' + fullContent.substring(configMatch.index!));
                  const partialParsed = tryParseConfig(repaired);
                  if (partialParsed?.config) {
                    parsed = partialParsed;
                  }
                }
              }

              if (parsed?.config) {
                setConfig(parsed.config);
                setExplanation(parsed.explanation || 'Dashboard generated');
                setIsPromptExpanded(false);
                setStreamingText('');

                // If "Build & Apply" was clicked, persist to DB
                if (applyToPage && parsed.config.widgets?.length > 0) {
                  try {
                    await saveAIConfig(pageSlug, {
                      prompt: prompt.trim(),
                      description: parsed.explanation || 'AI-generated dashboard',
                      pageTitle: parsed.config.meta?.title,
                      pageDescription: parsed.config.meta?.description,
                      gridColumns: parsed.config.layout?.columns || 12,
                      widgets: parsed.config.widgets.map((w: WidgetConfig) => ({
                        widgetType: w.type,
                        title: w.design.title,
                        subtitle: w.design.subtitle,
                        gridX: w.position.x,
                        gridY: w.position.y,
                        gridWidth: w.position.w,
                        gridHeight: w.position.h,
                        minWidth: w.position.minW ?? 2,
                        minHeight: w.position.minH ?? 2,
                        dataProviderType: w.data.provider === 'static' ? 'Static' : w.data.provider || 'Static',
                        widgetConfig: w.data.renderConfig ?? {},
                        dataProviderConfig: w.data.staticData ? { staticData: w.data.staticData } : {},
                        cachedData: w.data.staticData,
                        refreshIntervalSeconds: w.data.refreshInterval ?? 0,
                      })),
                    });
                    onApplied?.();
                  } catch (saveErr) {
                    console.error('Failed to save AI config to DB:', saveErr);
                    setError('Dashboard previewed but failed to save. Try clicking "Build & Apply" again.');
                  }
                }
              } else {
                setError('AI returned invalid JSON. Please try again with a clearer or shorter prompt.');
              }
            } catch {
              setError('AI returned invalid JSON. Please try again with a clearer or shorter prompt.');
            }
          },
          onError: (errMsg) => {
            setError(errMsg);
          },
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI build failed');
    } finally {
      setLoading(false);
    }
  };

  // Refresh a single widget
  const handleRefreshWidget = async (widget: WidgetConfig) => {
    setRefreshingWidgets(prev => new Set(prev).add(widget.id));
    // For static data, just re-set it (simulate refresh)
    setTimeout(() => {
      if (widget.data.staticData) {
        setWidgetData(prev => ({ ...prev, [widget.id]: widget.data.staticData }));
      }
      setRefreshingWidgets(prev => {
        const next = new Set(prev);
        next.delete(widget.id);
        return next;
      });
    }, 500);
  };

  // Get data for a widget
  const getWidgetData = (widget: WidgetConfig): unknown => {
    return widgetData[widget.id] ?? widget.data.staticData ?? undefined;
  };

  return (
    <div className="w-full">
      {/* AI Prompt Bar */}
      <div className={clsx(
        'mb-4 transition-all duration-300',
        isPromptExpanded ? 'bg-gradient-to-r from-violet-50 to-cyan-50 dark:from-violet-950/30 dark:to-cyan-950/30 rounded-2xl p-6 border border-violet-200/50 dark:border-violet-800/30' : ''
      )}>
        {isPromptExpanded ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">AI Dashboard Builder</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Describe what you want and AI will design the perfect dashboard</p>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Build me a production monitoring dashboard with server health, response times, error rates, and deployment status..."
                className="w-full h-24 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIBuild(); }
                }}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  onClick={() => handleAIBuild(false)}
                  disabled={loading || !prompt.trim()}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                    loading || !prompt.trim()
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/20'
                  )}
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loading ? 'Building...' : 'Preview'}
                </button>
                <button
                  onClick={() => handleAIBuild(true)}
                  disabled={loading || !prompt.trim()}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                    loading || !prompt.trim()
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500'
                  )}
                >
                  <Send className="w-4 h-4" />
                  Build & Apply
                </button>
              </div>
            </div>

            {/* Quick prompt suggestions */}
            <div className="flex flex-wrap gap-2">
              {[
                'Production monitoring with server health & response times',
                'Azure cloud infrastructure overview with costs & alerts',
                'Engineering team dashboard with deployments & code metrics',
                'Customer analytics with usage trends & satisfaction scores',
                'DevOps pipeline dashboard with build status & test coverage',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(suggestion)}
                  className="px-3 py-1 rounded-full bg-white/80 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 text-xs text-gray-600 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {loading && streamingText && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 font-mono max-h-24 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-violet-500" />
                  <span className="text-violet-600 dark:text-violet-400 font-medium text-xs">AI is generating dashboard...</span>
                </div>
                <span className="opacity-60">{streamingText.slice(-200)}</span>
              </div>
            )}

            {!aiConnected && (
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                Connecting to AI service...
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between px-2">
            {config?.meta?.title && (
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {config.meta.title}
                </h2>
                {config.meta.description && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    — {config.meta.description}
                  </span>
                )}
                {config.meta.generatedBy === 'ai' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[10px] font-bold">
                    <Sparkles className="w-3 h-3" />
                    AI Generated
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPromptExpanded(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-medium hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/20 transition-all"
              >
                <Wand2 className="w-4 h-4" />
                AI Build
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Explanation */}
      {explanation && !isPromptExpanded && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/30 dark:border-violet-800/20">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-600 dark:text-gray-300">{explanation}</p>
          </div>
        </div>
      )}

      {/* Dashboard Grid */}
      {config?.widgets && config.widgets.length > 0 && (
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={{ lg: config.layout?.columns ?? 12, md: 10, sm: 6, xs: 4 }}
          rowHeight={config.layout?.rowHeight ?? 80}
          isDraggable={false}
          isResizable={false}
          margin={[config.layout?.gap ?? 16, config.layout?.gap ?? 16]}
        >
          {config.widgets.map((widget: WidgetConfig) => (
            <div key={widget.id}>
              <WidgetContainer
                widget={widget}
                isLoading={refreshingWidgets.has(widget.id)}
                isLive={liveWidgets.has(widget.id)}
                onClickWidget={(w: WidgetConfig) => setDetailWidget(w)}
                onMaximize={(w: WidgetConfig) => setDetailWidget(w)}
                onRefresh={(w: WidgetConfig) => handleRefreshWidget(w)}
                onDrillDown={(w: WidgetConfig) => setDetailWidget(w)}
              >
                <WidgetRenderer
                  widget={toRenderWidget(widget)}
                  data={getWidgetData(widget)}
                  isLoading={refreshingWidgets.has(widget.id)}
                />
              </WidgetContainer>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}

      {/* Empty state — no config yet */}
      {!config && !loading && (
        <div className="flex flex-col items-center justify-center h-64 bg-gradient-to-br from-violet-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl border-2 border-dashed border-violet-200 dark:border-violet-800/40">
          <Wand2 className="w-14 h-14 text-violet-400 mb-4" />
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">AI-Powered Dashboard</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md text-center">
            Describe what you want above, and AI will design a beautiful, interactive dashboard for you.
          </p>
        </div>
      )}

      {/* Detail/Drill-Down Modal */}
      {detailWidget && (
        <WidgetDetailModal
          widget={detailWidget}
          data={getWidgetData(detailWidget)}
          isLoading={refreshingWidgets.has(detailWidget.id)}
          onClose={() => setDetailWidget(null)}
          onRefresh={() => handleRefreshWidget(detailWidget)}
        />
      )}
    </div>
  );
}

export default ConfigDrivenDashboard;
