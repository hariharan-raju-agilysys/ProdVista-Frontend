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
  const response = await api.post<SmartQueryResponse>('/quality/smart-query', {
    prompt,
    connectionId: connectionId || undefined,
  });
  return response.data;
};

export const getPanels = async (): Promise<QualityQueryPanelDto[]> => {
  const response = await api.get<QualityQueryPanelDto[]>('/quality/panels');
  return response.data;
};

export const savePanel = async (request: SavePanelRequest): Promise<QualityQueryPanelDto> => {
  const response = await api.post<QualityQueryPanelDto>('/quality/panels', request);
  return response.data;
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
