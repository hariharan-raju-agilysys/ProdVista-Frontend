import api from './api'

// Types
export interface AIPrediction {
  id: string
  predictionId: string
  type: string
  title: string
  description: string
  affectedResource: string
  severity: 'Low' | 'Medium' | 'High' | 'Critical'
  confidence: number
  generatedAt: string
  predictedWindowStart: string
  predictedWindowEnd: string
  recommendedActions: string[]
  isAcknowledged: boolean
  acknowledgedAt?: string
  acknowledgedBy?: string
  modelVersion: string
}

export interface AIGeneratedImage {
  id: string
  imageId: string
  type: string
  title: string
  description: string
  imageDataBase64: string
  mimeType: string
  width: number
  height: number
  chartType?: string
  generatedAt: string
  generationTimeMs: number
}

export interface ModelMetrics {
  accuracy: number
  precision: number
  recall: number
  f1Score: number
  totalPredictions: number
  correctPredictions: number
  falsePositives: number
  falseNegatives: number
  lastTrainedAt: string
  modelVersion: string
}

// API Functions
export const aiPredictionService = {
  // Get all predictions
  async getPredictions(hoursAhead = 24): Promise<AIPrediction[]> {
    const response = await api.get<AIPrediction[]>('/aipredictions', {
      params: { hoursAhead }
    })
    return response.data
  },

  // Get active predictions
  async getActivePredictions(): Promise<AIPrediction[]> {
    const response = await api.get<AIPrediction[]>('/aipredictions/active')
    return response.data
  },

  // Get pod restart predictions
  async getPodRestartPredictions(serviceName?: string): Promise<AIPrediction[]> {
    const response = await api.get<AIPrediction[]>('/aipredictions/pod-restarts', {
      params: { serviceName }
    })
    return response.data
  },

  // Acknowledge prediction
  async acknowledgePrediction(id: string, acknowledgedBy: string): Promise<AIPrediction> {
    const response = await api.post<AIPrediction>(
      `/aipredictions/${id}/acknowledge`,
      { acknowledgedBy }
    )
    return response.data
  },

  // Get prediction visualization
  async getPredictionVisualization(id: string): Promise<AIGeneratedImage> {
    const response = await api.get<AIGeneratedImage>(
      `/aipredictions/${id}/visualization`
    )
    return response.data
  },

  // Get model metrics
  async getModelMetrics(): Promise<ModelMetrics> {
    const response = await api.get<ModelMetrics>('/aipredictions/model/metrics')
    return response.data
  },

  // Trigger model training
  async trainModel(): Promise<void> {
    await api.post('/aipredictions/model/train')
  },

  // Generate issue visualization
  async generateIssueVisualization(
    incidentId: string,
    imageType: string = 'IncidentTimeline'
  ): Promise<AIGeneratedImage> {
    const response = await api.post<AIGeneratedImage>(
      '/aipredictions/visualize/issue',
      { incidentId, imageType }
    )
    return response.data
  },

  // Generate forecast visualization
  async generateForecastVisualization(
    metricName: string,
    daysAhead: number = 7,
    chartType: string = 'Line'
  ): Promise<AIGeneratedImage> {
    const response = await api.post<AIGeneratedImage>(
      '/aipredictions/visualize/forecast',
      { metricName, daysAhead, chartType }
    )
    return response.data
  },

  // Generate anomaly heatmap
  async generateAnomalyHeatmap(
    startDate: Date,
    endDate: Date
  ): Promise<AIGeneratedImage> {
    const response = await api.post<AIGeneratedImage>(
      '/aipredictions/visualize/heatmap',
      { 
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString() 
      }
    )
    return response.data
  },

  // Generate dependency graph
  async generateDependencyGraph(serviceName: string): Promise<AIGeneratedImage> {
    const response = await api.get<AIGeneratedImage>(
      `/aipredictions/visualize/dependencies/${serviceName}`
    )
    return response.data
  }
}

// Helper to decode base64 image
export function decodeImage(image: AIGeneratedImage): string {
  return `data:${image.mimeType};base64,${image.imageDataBase64}`
}

// Helper to format severity badge color
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'Critical':
      return '#ef4444'
    case 'High':
      return '#f97316'
    case 'Medium':
      return '#eab308'
    default:
      return '#22c55e'
  }
}

// Helper to format confidence percentage
export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(0)}%`
}

// Helper to get time until prediction
export function getTimeUntil(predictedWindowStart: string): string {
  const start = new Date(predictedWindowStart)
  const now = new Date()
  const diffMs = start.getTime() - now.getTime()
  
  if (diffMs < 0) return 'In progress'
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `In ${days} day${days > 1 ? 's' : ''}`
  }
  
  if (hours > 0) {
    return `In ${hours}h ${minutes}m`
  }
  
  return `In ${minutes}m`
}

export default aiPredictionService
