import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface SmartQueryInterpretation {
  endpointKey: string;
  parameters: Record<string, unknown>;
  visualizationType: 'table' | 'chart' | 'kpi' | 'list';
  visualization: {
    columns?: string[];
    chartType?: 'bar' | 'line' | 'pie' | 'doughnut';
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  };
  suggestedName: string;
  explanation: string;
}

export interface SmartQueryResponse {
  interpretation: SmartQueryInterpretation;
  data?: unknown;
  totalCount: number;
  success: boolean;
  error?: string;
}

export interface QualityQueryPanelDto {
  id: string;
  name: string;
  prompt: string;
  endpointKey: string;
  parameters: string;
  visualizationType: string;
  visualizationConfig: string;
  sortOrder: number;
  isPinned: boolean;
  createdAt: string;
  lastExecutedAt?: string;
}

export interface SavePanelRequest {
  name: string;
  prompt: string;
  endpointKey: string;
  parameters: string;
  visualizationType: string;
  visualizationConfig: string;
  isPinned: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

export const smartQuery = async (prompt: string, connectionId?: string): Promise<SmartQueryResponse> => {
  const response = await api.post<any>('/quality/smart-query', {
    prompt,
    connectionId: connectionId || undefined,
  });
  // Handle wrapped response { success, result: SmartQueryResponse } or direct response
  const data = response.data;
  if (data && data.result && typeof data.result === 'object') {
    return data.result as SmartQueryResponse;
  }
  if (data && typeof data === 'object' && ('success' in data || 'interpretation' in data)) {
    return data as SmartQueryResponse;
  }
  console.warn('Unexpected smartQuery response structure:', data);
  return { 
    success: false, 
    error: 'Invalid response format', 
    totalCount: 0,
    interpretation: {
      endpointKey: '',
      parameters: {},
      visualizationType: 'table',
      visualization: {},
      suggestedName: '',
      explanation: ''
    }
  };
};

export const getPanels = async (): Promise<QualityQueryPanelDto[]> => {
  const response = await api.get<any>('/quality/panels');
  // Handle wrapped response { success, result: [...] } or direct array
  const data = response.data;
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray(data.result)) {
    return data.result;
  }
  // If neither, return empty array to prevent crashes
  console.warn('Unexpected getPanels response structure:', data);
  return [];
};

export const savePanel = async (request: SavePanelRequest): Promise<QualityQueryPanelDto> => {
  const response = await api.post<any>('/quality/panels', request);
  // Handle wrapped response { success, result: {...} } or direct object
  const data = response.data;
  if (data && data.result && typeof data.result === 'object' && !Array.isArray(data.result)) {
    return data.result;
  }
  if (data && typeof data === 'object' && !Array.isArray(data) && 'id' in data) {
    return data as QualityQueryPanelDto;
  }
  console.warn('Unexpected savePanel response structure:', data);
  throw new Error('Invalid savePanel response');
};

export const togglePin = async (id: string): Promise<void> => {
  await api.put(`/quality/panels/${id}/pin`);
};

export const markExecuted = async (id: string): Promise<void> => {
  await api.put(`/quality/panels/${id}/executed`);
};

export const deletePanel = async (id: string): Promise<void> => {
  await api.delete(`/quality/panels/${id}`);
};
