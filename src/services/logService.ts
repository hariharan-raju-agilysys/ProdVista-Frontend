import axios from 'axios'
import { useDashboardStore, LogEntry, AIInsight } from '../store/dashboardStore'

const API_BASE = import.meta.env.VITE_API_BASE_PATH || '/api'

// Log Collection Service
export const logService = {
  // Start collecting logs from configured sources
  async startCollection() {
    const store = useDashboardStore.getState()
    store.setIsCollectingLogs(true)
    
    // In production, this would connect to actual log sources
    // For demo, we'll simulate log streaming
    this.simulateLogStream()
  },

  // Stop collecting logs
  stopCollection() {
    const store = useDashboardStore.getState()
    store.setIsCollectingLogs(false)
  },

  // Simulate real-time log streaming for demo
  simulateLogStream() {
    const store = useDashboardStore.getState()
    
    const logSamples = [
      { level: 'info', messages: [
        'Request completed successfully - 200 OK',
        'User authentication successful',
        'Database query executed in 45ms',
        'Cache hit for key: user_session_12345',
        'API endpoint /api/health responded',
        'Background job completed: data-sync',
      ]},
      { level: 'warn', messages: [
        'High memory usage detected: 85%',
        'Slow database query detected: 2.3s',
        'Rate limit approaching for client IP',
        'Deprecated API version being used',
        'Connection pool running low',
      ]},
      { level: 'error', messages: [
        'Failed to connect to external service',
        'Database connection timeout',
        'Invalid authentication token',
        'File not found: config.json',
        'OutOfMemoryError in worker thread',
      ]},
      { level: 'debug', messages: [
        'Processing batch item 45 of 100',
        'Cache invalidation triggered',
        'WebSocket connection established',
        'Retry attempt 2 of 3',
      ]},
      { level: 'critical', messages: [
        'CRITICAL: Service health check failed',
        'CRITICAL: Database cluster failover initiated',
        'CRITICAL: Payment gateway unavailable',
      ]},
    ]

    const sources = ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'notification-service', 'scheduler']
    
    const generateLog = (): LogEntry => {
      const levelData = logSamples[Math.floor(Math.random() * logSamples.length)]
      const message = levelData.messages[Math.floor(Math.random() * levelData.messages.length)]
      const source = sources[Math.floor(Math.random() * sources.length)]
      
      return {
        timestamp: new Date().toISOString(),
        level: levelData.level as LogEntry['level'],
        source,
        message,
        metadata: {
          requestId: `req-${Math.random().toString(36).substr(2, 9)}`,
          duration: Math.floor(Math.random() * 500),
        }
      }
    }

    // Generate logs at random intervals
    const streamLogs = () => {
      if (!useDashboardStore.getState().isCollectingLogs) return
      
      const batchSize = Math.floor(Math.random() * 3) + 1
      const newLogs = Array.from({ length: batchSize }, generateLog)
      store.addLogs(newLogs)
      
      setTimeout(streamLogs, Math.random() * 2000 + 500)
    }

    streamLogs()
  },

  // Fetch logs from Azure
  async fetchAzureLogs(config: any) {
    // In production, call Azure Log Analytics API
    // POST to /api/azure/logs with workspace ID and query
    try {
      const response = await axios.post(`${API_BASE}/azure/logs`, {
        workspaceId: config.workspaceId,
        query: config.query || 'ContainerLog | where TimeGenerated > ago(1h)',
        timespan: 'PT1H',
      })
      return response.data
    } catch (error) {
      console.error('Failed to fetch Azure logs:', error)
      throw error
    }
  },

  // Fetch logs from Dynatrace
  async fetchDynatraceLogs(config: any) {
    try {
      const response = await axios.post(`${API_BASE}/dynatrace/logs`, {
        environmentUrl: config.environmentUrl,
        query: config.query || 'loglevel="ERROR"',
        from: 'now-1h',
        to: 'now',
      })
      return response.data
    } catch (error) {
      console.error('Failed to fetch Dynatrace logs:', error)
      throw error
    }
  },

  // Fetch local log files
  async fetchLocalLogs(path: string) {
    try {
      const response = await axios.get(`${API_BASE}/logs/local`, {
        params: { path }
      })
      return response.data
    } catch (error) {
      console.error('Failed to fetch local logs:', error)
      throw error
    }
  },
}

// AI Analysis Service
export const aiService = {
  // Analyze logs with local AI model
  async analyzeLogs(logs: LogEntry[]): Promise<AIInsight[]> {
    const store = useDashboardStore.getState()
    store.setIsAnalyzing(true)

    try {
      // In production, send to AI backend
      // const response = await axios.post(`${API_BASE}/ai/analyze`, { logs })
      // return response.data.insights

      // For demo, simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const insights = this.generateDemoInsights(logs)
      store.setAiInsights(insights)
      return insights
    } finally {
      store.setIsAnalyzing(false)
    }
  },

  // Generate demo insights (replace with actual AI in production)
  generateDemoInsights(logs: LogEntry[]): AIInsight[] {
    const errorCount = logs.filter(l => l.level === 'error' || l.level === 'critical').length
    const warnCount = logs.filter(l => l.level === 'warn').length
    
    const insights: AIInsight[] = []

    // Anomaly detection
    if (errorCount > 5) {
      insights.push({
        id: `insight-${Date.now()}-1`,
        type: 'anomaly',
        severity: errorCount > 10 ? 'critical' : 'high',
        title: 'Elevated Error Rate Detected',
        description: `Detected ${errorCount} errors in the recent log window. This is ${Math.round(errorCount / logs.length * 100)}% of all logs, which is above the normal threshold.`,
        affectedServices: ['api-gateway', 'auth-service'],
        suggestedAction: 'Review recent deployments and check service dependencies',
        confidence: 0.92,
        timestamp: new Date().toISOString(),
      })
    }

    // Pattern recognition
    if (warnCount > 3) {
      insights.push({
        id: `insight-${Date.now()}-2`,
        type: 'trend',
        severity: 'medium',
        title: 'Memory Usage Trend',
        description: 'Multiple warnings about high memory usage detected. The pattern suggests a potential memory leak in the user-service.',
        affectedServices: ['user-service'],
        suggestedAction: 'Schedule a service restart or investigate memory allocation',
        confidence: 0.78,
        timestamp: new Date().toISOString(),
      })
    }

    // Prediction
    insights.push({
      id: `insight-${Date.now()}-3`,
      type: 'prediction',
      severity: 'low',
      title: 'Traffic Spike Predicted',
      description: 'Based on historical patterns, expecting 40% increase in traffic in the next 2 hours. Consider scaling up resources.',
      affectedServices: ['api-gateway', 'payment-service'],
      suggestedAction: 'Enable auto-scaling or manually increase instance count',
      confidence: 0.85,
      timestamp: new Date().toISOString(),
    })

    // Recommendation
    insights.push({
      id: `insight-${Date.now()}-4`,
      type: 'recommendation',
      severity: 'low',
      title: 'Database Query Optimization',
      description: 'Detected 15 slow queries (>1s) from auth-service. Query patterns suggest missing index on user_sessions table.',
      affectedServices: ['auth-service'],
      suggestedAction: 'Add index: CREATE INDEX idx_user_sessions_token ON user_sessions(token)',
      confidence: 0.88,
      timestamp: new Date().toISOString(),
    })

    // Alert
    if (logs.some(l => l.level === 'critical')) {
      insights.unshift({
        id: `insight-${Date.now()}-5`,
        type: 'alert',
        severity: 'critical',
        title: 'Critical Service Alert',
        description: 'Critical errors detected requiring immediate attention. Service stability may be compromised.',
        affectedServices: logs.filter(l => l.level === 'critical').map(l => l.source),
        suggestedAction: 'Check service health immediately and review error logs',
        confidence: 1.0,
        timestamp: new Date().toISOString(),
      })
    }

    return insights
  },

  // Get real-time predictions from AI model
  async getPredictions(metrics: any) {
    try {
      const response = await axios.post(`${API_BASE}/ai/predict`, { metrics })
      return response.data
    } catch (error) {
      console.error('Failed to get AI predictions:', error)
      throw error
    }
  },

  // Get root cause analysis
  async getRootCause(errorLogs: LogEntry[]) {
    try {
      const response = await axios.post(`${API_BASE}/ai/root-cause`, { logs: errorLogs })
      return response.data
    } catch (error) {
      console.error('Failed to get root cause analysis:', error)
      throw error
    }
  },
}

// Combined service for dashboard data
export const dashboardService = {
  // Initialize dashboard with all data sources
  async initialize() {
    logService.startCollection()
  },

  // Stop all services
  cleanup() {
    logService.stopCollection()
  },

  // Trigger AI analysis on current logs
  async runAnalysis() {
    const { logs } = useDashboardStore.getState()
    return aiService.analyzeLogs(logs)
  },

  // Get metrics summary
  getMetricsSummary() {
    const { logs, aiInsights } = useDashboardStore.getState()
    
    const errorCount = logs.filter(l => l.level === 'error').length
    const warnCount = logs.filter(l => l.level === 'warn').length
    const criticalCount = logs.filter(l => l.level === 'critical').length
    const totalLogs = logs.length

    return {
      errorCount,
      warnCount,
      criticalCount,
      totalLogs,
      errorRate: totalLogs > 0 ? (errorCount / totalLogs * 100).toFixed(1) : '0',
      criticalInsights: aiInsights.filter(i => i.severity === 'critical').length,
      highInsights: aiInsights.filter(i => i.severity === 'high').length,
    }
  },
}

export default dashboardService
