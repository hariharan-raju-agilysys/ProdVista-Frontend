import api from './api';

// AI Provider types
export interface AIProviderInfo {
  providerId: string;
  providerName: string;
  requiresApiKey: boolean;
  requiresEndpoint: boolean;
  description?: string;
  supportedModels?: string[];
}

export interface AIConfig {
  providerId: string;
  apiKey?: string;
  endpoint?: string;
  modelName?: string;
  deploymentName?: string;
  apiVersion?: string;
  organizationId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIConfigResponse {
  isConfigured: boolean;
  isUsingBuiltIn: boolean;
  currentProvider?: AIProviderInfo;
  hasApiKey: boolean;
  endpoint?: string;
  modelName?: string;
  deploymentName?: string;
  testResult?: AIConnectionTestResult;
}

export interface AIConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  availableModels?: string[];
}

export interface AIDataAnalysisResult {
  success: boolean;
  suggestedWidgetType?: string;
  widgetTypeSuggestions?: WidgetTypeSuggestion[];
  detectedFields?: DetectedField[];
  errorMessage?: string;
  isFromAI: boolean;
}

export interface WidgetTypeSuggestion {
  widgetType: string;
  confidence: number;
  reason: string;
}

export interface DetectedField {
  fieldName: string;
  dataType: string;
  purpose: string;
  sampleValues?: string[];
}

export interface AIFieldMappingResult {
  success: boolean;
  mappings?: { [key: string]: string };
  confidence: number;
  explanation?: string;
  errorMessage?: string;
  isFromAI: boolean;
}

export interface DataDescriptionResponse {
  description: string;
  isAIGenerated: boolean;
  provider?: string;
}

// AI Service API calls
export const aiService = {
  /**
   * Get available AI providers
   */
  async getProviders(): Promise<AIProviderInfo[]> {
    const response = await api.get<AIProviderInfo[]>('/ai/providers');
    return response.data;
  },

  /**
   * Get current AI configuration
   */
  async getConfig(): Promise<AIConfigResponse> {
    const response = await api.get<AIConfigResponse>('/ai/config');
    return response.data;
  },

  /**
   * Set AI configuration
   */
  async setConfig(config: AIConfig): Promise<AIConfigResponse> {
    const response = await api.post<AIConfigResponse>('/ai/config', config);
    return response.data;
  },

  /**
   * Test AI provider connection
   */
  async testConnection(config: AIConfig): Promise<AIConnectionTestResult> {
    const response = await api.post<AIConnectionTestResult>('/ai/test', config);
    return response.data;
  },

  /**
   * Analyze data and get widget suggestions
   */
  async analyzeData(data: unknown, widgetType?: string): Promise<AIDataAnalysisResult> {
    const response = await api.post<AIDataAnalysisResult>('/ai/analyze', {
      data,
      widgetType
    });
    return response.data;
  },

  /**
   * Get field mapping suggestions for a widget
   */
  async suggestMappings(data: unknown, widgetType: string): Promise<AIFieldMappingResult> {
    const response = await api.post<AIFieldMappingResult>('/ai/suggest-mappings', {
      data,
      widgetType
    });
    return response.data;
  },

  /**
   * Get natural language description of data
   */
  async describeData(data: unknown): Promise<DataDescriptionResponse> {
    const response = await api.post<DataDescriptionResponse>('/ai/describe', {
      data
    });
    return response.data;
  },

  /**
   * Reset to built-in analyzer
   */
  async resetToBuiltIn(): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/ai/reset');
    return response.data;
  }
};

// Helper function to get provider icon
export function getProviderIcon(providerId: string): string {
  switch (providerId) {
    case 'openai':
      return '🤖';
    case 'azure-openai':
      return '☁️';
    case 'anthropic':
      return '🧠';
    case 'google-ai':
      return '🔮';
    case 'custom':
      return '⚙️';
    case 'built-in':
      return '📊';
    default:
      return '🤖';
  }
}

// Helper function to get provider color
export function getProviderColor(providerId: string): string {
  switch (providerId) {
    case 'openai':
      return '#10a37f';
    case 'azure-openai':
      return '#0078d4';
    case 'anthropic':
      return '#cc785c';
    case 'google-ai':
      return '#4285f4';
    case 'custom':
      return '#6b7280';
    case 'built-in':
      return '#8b5cf6';
    default:
      return '#6b7280';
  }
}

export default aiService;
