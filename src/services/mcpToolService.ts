import api from './api'

// ============================================================================
// MCP Tools Service — Dynamic tool discovery, execution, and history
// ============================================================================

// ── Types ──────────────────────────────────────────────────

export interface McpToolParameter {
  id: string
  name: string
  displayName: string
  description?: string
  parameterType: string // String, Number, Boolean, DateTime, Select, MultiSelect, TextArea, Json, ConnectionPicker, ResourcePicker, Secret
  isRequired: boolean
  defaultValue?: string
  validationPattern?: string
  validationMessage?: string
  options?: string // JSON string — parsed by the UI
  displayOrder: number
  group?: string
}

export interface McpTool {
  id: string
  name: string
  displayName: string
  description: string
  category: string
  icon: string
  handlerType: string
  isSystem: boolean
  requiredRole: string
  outputFormat: string // table, json, chart, markdown, log
  timeoutSeconds: number
  tags: string
  isActive: boolean
  parameters: McpToolParameter[]
}

export interface McpToolCategoryGroup {
  category: string
  tools: McpTool[]
}

export interface McpToolListResponse {
  tools: McpTool[]
  categories: McpToolCategoryGroup[]
  totalCount: number
}

export interface McpToolExecutionResult {
  success: boolean
  error?: string
  warning?: string
  outputFormat: string
  columns: string[]
  data: Record<string, unknown>[]
  rowCount: number
  durationMs: number
  executionId: string
  rawOutput?: string
}

export interface McpExecutionHistory {
  id: string
  toolName: string
  toolDisplayName: string
  toolIcon: string
  status: string
  durationMs: number
  rowCount?: number
  errorMessage?: string
  executedAt: string
}

export interface McpExecutionDetail {
  id: string
  toolName: string
  toolDisplayName: string
  status: string
  inputParameters: string
  outputResult?: string
  durationMs: number
  rowCount?: number
  errorMessage?: string
  executedAt: string
  completedAt?: string
}

export interface ConnectionPickerItem {
  id: string
  name: string
  serverName?: string
  databaseName?: string
  provider: string
}

export interface CreateMcpToolRequest {
  name: string
  displayName: string
  description?: string
  category?: string
  icon?: string
  handlerType: string
  handlerConfig?: string
  requiredRole?: string
  displayOrder?: number
  outputFormat?: string
  timeoutSeconds?: number
  tags?: string
  parameters?: {
    name: string
    displayName?: string
    description?: string
    parameterType?: string
    isRequired?: boolean
    defaultValue?: string
    validationPattern?: string
    validationMessage?: string
    options?: string
    group?: string
  }[]
}

// ── API Functions ──────────────────────────────────────────

const BASE = '/mcp/tools'

/** List all available tools for the current tenant */
export const getTools = async (): Promise<McpToolListResponse> => {
  const res = await api.get<McpToolListResponse>(BASE)
  return res.data
}

/** Get a specific tool with full parameter definitions */
export const getTool = async (toolName: string): Promise<McpTool> => {
  const res = await api.get<McpTool>(`${BASE}/${toolName}`)
  return res.data
}

/** Execute a tool with parameters */
export const executeTool = async (
  toolName: string,
  parameters: Record<string, unknown>
): Promise<McpToolExecutionResult> => {
  const res = await api.post<McpToolExecutionResult>(`${BASE}/${toolName}/execute`, parameters)
  return res.data
}

/** Create a custom tool definition */
export const createTool = async (request: CreateMcpToolRequest): Promise<McpTool> => {
  const res = await api.post<McpTool>(BASE, request)
  return res.data
}

/** Update a custom tool */
export const updateTool = async (
  toolId: string,
  updates: Partial<McpTool>
): Promise<McpTool> => {
  const res = await api.put<McpTool>(`${BASE}/${toolId}`, updates)
  return res.data
}

/** Delete a custom tool */
export const deleteTool = async (toolId: string): Promise<void> => {
  await api.delete(`${BASE}/${toolId}`)
}

/** Get execution history */
export const getHistory = async (
  limit = 20,
  toolName?: string
): Promise<McpExecutionHistory[]> => {
  const params = new URLSearchParams({ limit: limit.toString() })
  if (toolName) params.set('toolName', toolName)
  const res = await api.get<McpExecutionHistory[]>(`${BASE}/history?${params}`)
  return res.data
}

/** Get execution detail (with output) */
export const getExecutionDetail = async (
  executionId: string
): Promise<McpExecutionDetail> => {
  const res = await api.get<McpExecutionDetail>(`${BASE}/history/${executionId}`)
  return res.data
}

/** Get database connections for ConnectionPicker */
export const getConnections = async (): Promise<ConnectionPickerItem[]> => {
  const res = await api.get<ConnectionPickerItem[]>(`${BASE}/connections`)
  return res.data
}

/** Parse parameter options JSON safely */
export const parseOptions = (optionsJson?: string): unknown => {
  if (!optionsJson) return null
  try {
    return JSON.parse(optionsJson)
  } catch {
    return null
  }
}

/** Parse tags JSON safely */
export const parseTags = (tagsJson?: string): string[] => {
  if (!tagsJson) return []
  try {
    return JSON.parse(tagsJson)
  } catch {
    return []
  }
}
