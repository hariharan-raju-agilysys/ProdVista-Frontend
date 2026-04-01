// ============================================================================
// Widget Config Wizard - Shared Types
// ============================================================================

import type { DataProviderType } from '../widget-configs/types'

export type WizardStep = 'source' | 'mapper' | 'design' | 'preview'

export interface WidgetDesignConfig {
  widgetType: string
  title: string
  subtitle: string
  icon: string
  gridWidth: number
  gridHeight: number
  refreshInterval: number
  // Layout
  columns: WidgetColumn[]
  alignment: 'left' | 'center' | 'right'
  headerPosition: 'top' | 'bottom' | 'hidden'
  showBorder: boolean
  compactMode: boolean
  // Style
  bgColor: string
  textColor: string
  accentColor: string
  fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl'
  // Custom HTML overlay (AI-generated)
  customHtml: string
}

export interface WidgetColumn {
  id: string
  field: string
  label: string
  width: string
  align: 'left' | 'center' | 'right'
  format: 'text' | 'number' | 'date' | 'badge' | 'icon' | 'progress'
  icon?: string
  visible: boolean
}

export interface FieldMapping {
  id: string
  sourceField: string
  targetField: string
  transform: 'none' | 'number' | 'string' | 'date' | 'boolean' | 'array'
  label: string
}

export interface DataSourceConfig {
  type: DataProviderType | 'AzureDevOps' | 'Jenkins' | 'Excel'
  provider: Record<string, unknown>
  // Fetched sample data for preview
  sampleData: unknown
  sampleFields: FieldInfo[]
}

export interface FieldInfo {
  name: string
  path: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
  sample: unknown
}

export interface WizardState {
  step: WizardStep
  dataSource: DataSourceConfig
  mappings: FieldMapping[]
  design: WidgetDesignConfig
  aiPrompt: string
  aiSuggestion: string | null
}

export interface DropZone {
  id: string
  label: string
  fieldType: string
  accepts: string[]
  currentField: string | null
}

// Built-in icon options for widget design
export const WIDGET_ICONS = [
  'LayoutDashboard', 'Activity', 'BarChart3', 'LineChart', 'PieChart',
  'Database', 'Cloud', 'Globe', 'Server', 'Users', 'Shield', 'Zap',
  'Bug', 'Clock', 'GitPullRequest', 'Bell', 'Settings', 'Target',
  'Hash', 'TrendingUp', 'AlertTriangle', 'Cpu', 'Terminal',
  'Package', 'Layers', 'Monitor', 'Heart', 'Star', 'Bookmark',
  'CheckCircle', 'XCircle', 'Info', 'FileText', 'Folder',
  'Download', 'Upload', 'RefreshCw', 'Search', 'Filter',
  'Headphones', 'Building2', 'Ticket', 'UserCheck', 'DollarSign',
] as const

export const DATA_SOURCE_OPTIONS = [
  { type: 'AzureDevOps', label: 'Azure DevOps', desc: 'Work items, builds, PRs, pipelines', icon: 'Cloud', color: '#0078d4' },
  { type: 'Jenkins', label: 'Jenkins', desc: 'Build status, job history, artifacts', icon: 'Server', color: '#d33833' },
  { type: 'ApiEndpoint', label: 'REST API', desc: 'Any REST endpoint with JSON response', icon: 'Globe', color: '#3b82f6' },
  { type: 'DatabaseQuery', label: 'Database', desc: 'SQL Server, PostgreSQL queries', icon: 'Database', color: '#10b981' },
  { type: 'Excel', label: 'Excel / CSV', desc: 'Upload or link spreadsheet data', icon: 'FileText', color: '#16a34a' },
  { type: 'AzureLogAnalytics', label: 'Log Analytics', desc: 'KQL queries on Azure workspaces', icon: 'Terminal', color: '#8b5cf6' },
  { type: 'AppInsights', label: 'App Insights', desc: 'Application telemetry & metrics', icon: 'Cpu', color: '#ec4899' },
  { type: 'AzureMetrics', label: 'Azure Metrics', desc: 'Azure Monitor resource metrics', icon: 'BarChart3', color: '#06b6d4' },
  { type: 'Static', label: 'Static JSON', desc: 'Paste JSON data directly', icon: 'FileText', color: '#6b7280' },
  { type: 'SignalR', label: 'Real-time', desc: 'Live streaming via SignalR hub', icon: 'Zap', color: '#f59e0b' },
] as const
