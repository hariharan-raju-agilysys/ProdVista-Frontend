// =============================================================================
// Dashboard JSON Config Schema — AI-driven design + data + layout
// The AI LLM generates this entire config. The renderer just renders it.
// =============================================================================

/** Top-level dashboard configuration — everything needed to render a full dashboard */
export interface DashboardConfig {
  /** Dashboard metadata */
  meta: DashboardMeta;
  /** Global design theme applied to all widgets */
  theme: DashboardTheme;
  /** Grid layout settings */
  layout: DashboardLayout;
  /** All widgets in the dashboard */
  widgets: WidgetConfig[];
  /** Global data sources that widgets can reference */
  dataSources?: DataSourceConfig[];
  /** SignalR subscriptions for real-time data */
  realtime?: RealtimeConfig;
}

export interface DashboardMeta {
  title: string;
  description?: string;
  icon?: string;
  generatedBy?: 'ai' | 'user' | 'template';
  generatedAt?: string;
  prompt?: string;
}

/** Global theme — AI picks colors, fonts, card styles */
export interface DashboardTheme {
  /** A CSS gradient or solid color for the page header accent */
  accentGradient?: string;
  /** Base card style */
  cardStyle: 'glass' | 'solid' | 'bordered' | 'elevated' | 'neon';
  /** Card border radius — sm, md, lg, xl, 2xl */
  cardRadius?: string;
  /** Color palette for widgets (AI picks a cohesive set) */
  colorPalette: string[];
  /** Dark mode preference */
  darkMode?: boolean;
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  gap: number;
  breakpoints?: Record<string, number>;
}

// =============================================================================
// Widget Config — each widget is fully self-describing
// =============================================================================
export interface WidgetConfig {
  /** Unique identifier */
  id: string;
  /** Widget type for rendering */
  type: WidgetType;
  /** Position and size on the grid */
  position: WidgetPosition;
  /** Visual design — AI controls every pixel */
  design: WidgetDesign;
  /** Data configuration */
  data: WidgetDataConfig;
  /** Interaction callbacks */
  actions?: WidgetActions;
  /** Real-time update config */
  realtime?: WidgetRealtimeConfig;
}

export type WidgetType =
  | 'metric-card'
  | 'kpi'
  | 'gauge'
  | 'line-chart'
  | 'bar-chart'
  | 'doughnut-chart'
  | 'area-chart'
  | 'data-table'
  | 'status-list'
  | 'timeline'
  | 'logs-viewer'
  | 'map'
  | 'pie-chart'
  | 'custom-html'
  | 'azure-metrics'
  | 'sparkline'
  | 'stat-row'
  | 'progress-ring'
  | 'jenkins-stats'
  | 'jenkins-jobs';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

/** AI-designed visual properties for each widget */
export interface WidgetDesign {
  /** Widget title */
  title: string;
  /** Subtitle / secondary label */
  subtitle?: string;
  /** Lucide icon name (e.g. 'Activity', 'Server', 'TrendingUp') */
  icon?: string;
  /** Icon color (CSS color) */
  iconColor?: string;
  /** Icon background — gradient or solid */
  iconBg?: string;
  /** Header gradient (CSS gradient string) */
  headerGradient?: string;
  /** Header text color */
  headerTextColor?: string;
  /** Card background (can be gradient) */
  cardBg?: string;
  /** Card border color */
  borderColor?: string;
  /** Glow / shadow color for neon style */
  glowColor?: string;
  /** Badge text (e.g. "LIVE", "24h", "Critical") */
  badge?: string;
  /** Badge color */
  badgeColor?: string;
  /** Whether to show a sparkle/shimmer animation */
  animated?: boolean;
  /** Value color override for metric cards */
  valueColor?: string;
  /** Trend indicator style */
  trendStyle?: 'arrow' | 'badge' | 'line' | 'none';
  /** Footer text (e.g. "Updated 5m ago") */
  footerText?: string;
}

// =============================================================================
// Data Configuration — tells renderer where to get data and how to shape it
// =============================================================================
export interface WidgetDataConfig {
  /** Where the data comes from */
  provider: DataProviderType;
  /** Static data (inline JSON) */
  staticData?: unknown;
  /** Reference to a named data source */
  sourceRef?: string;
  /** API endpoint to fetch data from */
  endpoint?: string;
  /** KQL query for Azure providers */
  query?: string;
  /** Time range for queries */
  timeRange?: string;
  /** Data mapping rules */
  mapping?: DataMappingConfig;
  /** Widget-specific rendering config (chart colors, table columns, etc.) */
  renderConfig?: Record<string, unknown>;
  /** Auto-refresh interval in seconds */
  refreshInterval?: number;
}

export type DataProviderType =
  | 'static'
  | 'api'
  | 'database'
  | 'azure-log-analytics'
  | 'azure-metrics'
  | 'app-insights'
  | 'signalr'
  | 'jenkins'
  | 'source-ref';

export interface DataMappingConfig {
  /** JSON path to extract data from response */
  dataPath?: string;
  /** Field mappings: target field name → source path */
  fields?: Record<string, string>;
}

export interface DataSourceConfig {
  /** Named data source that widgets reference */
  id: string;
  name: string;
  provider: DataProviderType;
  config: Record<string, unknown>;
}

// =============================================================================
// Actions — click, maximize, drill-down
// =============================================================================
export interface WidgetActions {
  /** What happens when the widget body is clicked */
  onClick?: WidgetAction;
  /** What happens on maximize */
  onMaximize?: WidgetAction;
  /** Drill-down configuration */
  drillDown?: DrillDownConfig;
  /** Whether the widget is clickable at all */
  clickable?: boolean;
}

export interface WidgetAction {
  type: 'detail-modal' | 'navigate' | 'drill-down' | 'custom';
  /** Target URL for navigate */
  target?: string;
  /** Title for the modal */
  modalTitle?: string;
  /** Custom callback name */
  callback?: string;
}

export interface DrillDownConfig {
  /** What to show when drill-down is triggered */
  type: 'expanded-table' | 'sub-dashboard' | 'query-detail' | 'chart-zoom';
  /** Additional query or config for the drill-down view */
  query?: string;
  /** Column definitions for expanded table */
  columns?: { key: string; label: string; width?: string }[];
  /** Time range for detail view */
  timeRange?: string;
}

// =============================================================================
// Real-time Config
// =============================================================================
export interface RealtimeConfig {
  /** SignalR hub URL */
  hubUrl?: string;
  /** Events to subscribe to */
  events?: string[];
}

export interface WidgetRealtimeConfig {
  /** SignalR event name to subscribe to */
  event?: string;
  /** Whether to auto-subscribe on mount */
  autoSubscribe?: boolean;
  /** Update animation style */
  updateAnimation?: 'flash' | 'slide' | 'fade' | 'none';
}

// =============================================================================
// AI Builder Request/Response
// =============================================================================
export interface AIDashboardRequest {
  /** Natural language prompt describing what the user wants */
  prompt: string;
  /** Current page slug */
  pageSlug: string;
  /** Optional context about available data sources */
  context?: string;
  /** Whether to include design/styling decisions */
  includeDesign?: boolean;
}

export interface AIDashboardResponse {
  /** The generated dashboard config */
  config: DashboardConfig;
  /** AI explanation of what was built */
  explanation: string;
  /** Whether this was applied or is a preview */
  preview: boolean;
}
