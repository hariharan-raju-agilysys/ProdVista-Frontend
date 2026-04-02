import api from './api';

const BASE = '/data-feed';

// ========================================
// Types
// ========================================

export interface DataFeedEntry {
  id: string;
  category: string;
  title: string;
  description?: string;
  content: string;
  tags?: string;
  databaseConnectionId?: string;
  autoIncludeInAI: boolean;
  priority: number;
  isActive: boolean;
  sourceType?: string;
  sourceId?: string;
  createdBy?: string;
  lastModifiedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DataFeedListResponse {
  entries: DataFeedEntry[];
  categories: string[];
  total: number;
}

export interface CreateDataFeedRequest {
  category?: string;
  title: string;
  description?: string;
  content: string;
  tags?: string;
  databaseConnectionId?: string;
  autoIncludeInAI?: boolean;
  priority?: number;
}

export interface UpdateDataFeedRequest {
  category?: string;
  title?: string;
  description?: string;
  content?: string;
  tags?: string;
  databaseConnectionId?: string;
  autoIncludeInAI?: boolean;
  priority?: number;
  isActive?: boolean;
}

export interface AIContextResponse {
  contextMarkdown: string;
  entryCount: number;
  categories: string[];
  entries: { id: string; category: string; title: string; priority: number }[];
}

export interface SearchResponse {
  results: DataFeedEntry[];
  total: number;
}

export interface ImportRequest {
  entries: CreateDataFeedRequest[];
}

export interface ExportResponse {
  exportedAt: string;
  count: number;
  entries: CreateDataFeedRequest[];
}

// ========================================
// Suggestion Types
// ========================================

export interface DataFeedSuggestion {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  suggestedCategory: string;
  suggestedTitle: string;
  suggestedDescription?: string;
  suggestedContent: string;
  suggestedTags?: string;
  suggestedPriority: number;
  icon: string;
}

export interface SuggestionsResponse {
  suggestions: DataFeedSuggestion[];
  existingCount: number;
  totalConfiguredSources: number;
}

export interface ApplySuggestionRequest {
  sourceType: string;
  sourceId: string;
  category?: string;
  title: string;
  description?: string;
  content: string;
  tags?: string;
  autoIncludeInAI?: boolean;
  priority?: number;
}

// ========================================
// Categories
// ========================================

export const DATA_FEED_CATEGORIES = [
  { value: 'Database', label: 'Database', icon: '🗄️', description: 'Database schemas, tables, columns' },
  { value: 'Service', label: 'Service', icon: '⚙️', description: 'Microservice details, endpoints' },
  { value: 'Api', label: 'API', icon: '🔌', description: 'API documentation, contracts' },
  { value: 'Schema', label: 'Schema', icon: '📋', description: 'Data models, entity schemas' },
  { value: 'Documentation', label: 'Documentation', icon: '📄', description: 'General documentation' },
  { value: 'BusinessRules', label: 'Business Rules', icon: '📏', description: 'Business logic, validation rules' },
  { value: 'Glossary', label: 'Glossary', icon: '📖', description: 'Terms, definitions, acronyms' },
  { value: 'Other', label: 'Other', icon: '📁', description: 'Other contextual information' },
];

// ========================================
// API Functions
// ========================================

/**
 * Get all data feed entries for the tenant
 */
export async function getDataFeeds(category?: string, activeOnly = true): Promise<DataFeedListResponse> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (!activeOnly) params.append('activeOnly', 'false');
  
  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const response = await api.get<DataFeedListResponse>(url);
  return response.data;
}

/**
 * Get a single data feed entry
 */
export async function getDataFeed(id: string): Promise<DataFeedEntry> {
  const response = await api.get<DataFeedEntry>(`${BASE}/${id}`);
  return response.data;
}

/**
 * Create a new data feed entry
 */
export async function createDataFeed(request: CreateDataFeedRequest): Promise<DataFeedEntry> {
  const response = await api.post<DataFeedEntry>(BASE, request);
  return response.data;
}

/**
 * Update an existing data feed entry
 */
export async function updateDataFeed(id: string, request: UpdateDataFeedRequest): Promise<DataFeedEntry> {
  const response = await api.put<DataFeedEntry>(`${BASE}/${id}`, request);
  return response.data;
}

/**
 * Delete a data feed entry
 */
export async function deleteDataFeed(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

/**
 * Get all entries formatted for AI context injection
 */
export async function getAIContext(category?: string, connectionId?: string): Promise<AIContextResponse> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (connectionId) params.append('connectionId', connectionId);
  
  const url = params.toString() ? `${BASE}/ai-context?${params}` : `${BASE}/ai-context`;
  const response = await api.get<AIContextResponse>(url);
  return response.data;
}

/**
 * Search data feed entries by keyword
 */
export async function searchDataFeeds(query: string): Promise<SearchResponse> {
  const response = await api.get<SearchResponse>(`${BASE}/search?q=${encodeURIComponent(query)}`);
  return response.data;
}

/**
 * Import multiple data feed entries
 */
export async function importDataFeeds(entries: CreateDataFeedRequest[]): Promise<{ success: boolean; imported: number }> {
  const response = await api.post<{ success: boolean; imported: number }>(`${BASE}/import`, { entries });
  return response.data;
}

/**
 * Export all data feed entries
 */
export async function exportDataFeeds(): Promise<ExportResponse> {
  const response = await api.get<ExportResponse>(`${BASE}/export`);
  return response.data;
}

// ========================================
// Suggestion Functions
// ========================================

/**
 * Get suggested data feed entries based on tenant's configured sources
 */
export async function getSuggestions(): Promise<SuggestionsResponse> {
  const response = await api.get<SuggestionsResponse>(`${BASE}/suggestions`);
  return response.data;
}

/**
 * Apply a suggestion to create a data feed entry
 */
export async function applySuggestion(request: ApplySuggestionRequest): Promise<DataFeedEntry> {
  const response = await api.post<DataFeedEntry>(`${BASE}/suggestions/apply`, request);
  return response.data;
}

/**
 * Refresh a data feed entry from its source
 */
export async function refreshFromSource(id: string): Promise<DataFeedEntry> {
  const response = await api.post<DataFeedEntry>(`${BASE}/${id}/refresh`);
  return response.data;
}

export default {
  getDataFeeds,
  getDataFeed,
  createDataFeed,
  updateDataFeed,
  deleteDataFeed,
  getAIContext,
  searchDataFeeds,
  importDataFeeds,
  exportDataFeeds,
  getSuggestions,
  applySuggestion,
  refreshFromSource,
  DATA_FEED_CATEGORIES,
};
