import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, AlertTriangle, CheckCircle, Clock, 
  TrendingUp, Cpu, RefreshCw, ImageIcon,
  ChevronRight, X
} from 'lucide-react'
import aiPredictionService, { 
  AIPrediction, 
  AIGeneratedImage,
  decodeImage,
  getSeverityColor,
  formatConfidence,
  getTimeUntil
} from '../services/aiPredictionService'

interface AIPredictionWidgetProps {
  isManager?: boolean
  maxPredictions?: number
}

export default function AIPredictionWidget({ 
  isManager = false, 
  maxPredictions = 5 
}: AIPredictionWidgetProps) {
  const [predictions, setPredictions] = useState<AIPrediction[]>([])
  const [selectedPrediction, setSelectedPrediction] = useState<AIPrediction | null>(null)
  const [visualization, setVisualization] = useState<AIGeneratedImage | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    loadPredictions()
    // Auto-refresh every 2 minutes
    const interval = setInterval(loadPredictions, 120000)
    return () => clearInterval(interval)
  }, [])

  const loadPredictions = async () => {
    try {
      setLoading(true)
      const data = await aiPredictionService.getActivePredictions()
      setPredictions(data.slice(0, maxPredictions))
    } catch (error) {
      console.error('Failed to load predictions:', error)
      // Use mock data for demo
      setPredictions(getMockPredictions())
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadPredictions()
    setRefreshing(false)
  }

  const handleViewDetails = async (prediction: AIPrediction) => {
    setSelectedPrediction(prediction)
    setShowModal(true)
    
    try {
      const viz = await aiPredictionService.getPredictionVisualization(prediction.id)
      setVisualization(viz)
    } catch (error) {
      console.error('Failed to load visualization:', error)
      setVisualization(null)
    }
  }

  const handleAcknowledge = async (prediction: AIPrediction) => {
    try {
      const updated = await aiPredictionService.acknowledgePrediction(
        prediction.id, 
        'Current User' // Replace with actual user
      )
      setPredictions(prev => 
        prev.map(p => p.id === updated.id ? updated : p)
      )
      setSelectedPrediction(updated)
    } catch (error) {
      console.error('Failed to acknowledge prediction:', error)
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'Critical':
      case 'High':
        return <AlertTriangle className="w-4 h-4" />
      case 'Medium':
        return <Clock className="w-4 h-4" />
      default:
        return <TrendingUp className="w-4 h-4" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PodRestart':
        return <Cpu className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">AI Predictions</h3>
            <p className="text-xs text-slate-400">Powered by local ML model</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Predictions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse flex items-center gap-2 text-slate-400">
              <Sparkles className="w-5 h-5 animate-bounce" />
              <span>Analyzing patterns...</span>
            </div>
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-500" />
            <p>No active predictions</p>
            <p className="text-xs">System is operating normally</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {predictions.map((prediction, index) => (
              <motion.div
                key={prediction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg ${
                  prediction.isAcknowledged 
                    ? 'bg-slate-800/30 border-slate-700'
                    : `bg-slate-800/50 border-l-4`
                }`}
                style={{ 
                  borderLeftColor: prediction.isAcknowledged ? 'transparent' : getSeverityColor(prediction.severity) 
                }}
                onClick={() => handleViewDetails(prediction)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: getSeverityColor(prediction.severity) }}>
                        {getSeverityIcon(prediction.severity)}
                      </span>
                      <span className="text-sm font-medium text-white line-clamp-1">
                        {prediction.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                      {prediction.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-slate-500">
                        {getTypeIcon(prediction.type)}
                        {prediction.affectedResource}
                      </span>
                      <span 
                        className="px-2 py-0.5 rounded-full font-medium"
                        style={{ 
                          backgroundColor: `${getSeverityColor(prediction.severity)}20`,
                          color: getSeverityColor(prediction.severity)
                        }}
                      >
                        {formatConfidence(prediction.confidence)}
                      </span>
                      <span className="text-slate-500">
                        {getTimeUntil(prediction.predictedWindowStart)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showModal && selectedPrediction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm p-6 border-b border-slate-800 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${getSeverityColor(selectedPrediction.severity)}20`,
                        color: getSeverityColor(selectedPrediction.severity)
                      }}
                    >
                      {selectedPrediction.severity}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatConfidence(selectedPrediction.confidence)} confidence
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-white">{selectedPrediction.title}</h2>
                  <p className="text-sm text-slate-400 mt-1">{selectedPrediction.affectedResource}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Description */}
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Description</h3>
                  <p className="text-white">{selectedPrediction.description}</p>
                </div>

                {/* Time Window */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-1">Predicted Start</p>
                    <p className="text-white font-medium">
                      {new Date(selectedPrediction.predictedWindowStart).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-xs text-slate-400 mb-1">Predicted End</p>
                    <p className="text-white font-medium">
                      {new Date(selectedPrediction.predictedWindowEnd).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Visualization */}
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    AI Visualization
                  </h3>
                  <div className="bg-slate-800/30 rounded-xl p-4 flex items-center justify-center min-h-[200px]">
                    {visualization ? (
                      <img 
                        src={decodeImage(visualization)} 
                        alt={visualization.title}
                        className="max-w-full h-auto rounded-lg"
                      />
                    ) : (
                      <div className="text-slate-500 text-sm flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading visualization...
                      </div>
                    )}
                  </div>
                </div>

                {/* Recommended Actions */}
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Recommended Actions</h3>
                  <div className="space-y-2">
                    {selectedPrediction.recommendedActions.map((action, i) => (
                      <div key={i} className="flex items-start gap-3 bg-slate-800/30 rounded-lg p-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-medium flex-shrink-0">
                          {i + 1}
                        </span>
                        <p className="text-sm text-white">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Manager Actions */}
                {isManager && !selectedPrediction.isAcknowledged && (
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => handleAcknowledge(selectedPrediction)}
                      className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:from-indigo-600 hover:to-purple-700 transition-colors"
                    >
                      Acknowledge & Take Action
                    </button>
                  </div>
                )}

                {selectedPrediction.isAcknowledged && (
                  <div className="flex items-center gap-2 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <div>
                      <p className="text-emerald-400 font-medium">Acknowledged</p>
                      <p className="text-xs text-slate-400">
                        By {selectedPrediction.acknowledgedBy} at{' '}
                        {selectedPrediction.acknowledgedAt && 
                          new Date(selectedPrediction.acknowledgedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Mock data for demo/offline mode
function getMockPredictions(): AIPrediction[] {
  return [
    {
      id: '1',
      predictionId: 'PRED001',
      type: 'PodRestart',
      title: 'Potential Pod Restart - api-gateway',
      description: 'Memory usage trending upward. Pod may restart within 4 hours due to memory pressure.',
      affectedResource: 'api-gateway',
      severity: 'High',
      confidence: 0.87,
      generatedAt: new Date().toISOString(),
      predictedWindowStart: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      predictedWindowEnd: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      recommendedActions: [
        'Scale up pod replicas to handle load',
        'Review memory limits in deployment config',
        'Check for memory leaks in recent deployments'
      ],
      isAcknowledged: false,
      modelVersion: 'v1.0.0'
    },
    {
      id: '2',
      predictionId: 'PRED002',
      type: 'CpuSpike',
      title: 'CPU Spike Predicted - order-service',
      description: 'Historical pattern indicates CPU spike during end-of-month processing.',
      affectedResource: 'order-service',
      severity: 'Medium',
      confidence: 0.78,
      generatedAt: new Date().toISOString(),
      predictedWindowStart: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      predictedWindowEnd: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      recommendedActions: [
        'Pre-scale horizontally before peak hours',
        'Enable auto-scaling if not active',
        'Review and optimize heavy queries'
      ],
      isAcknowledged: false,
      modelVersion: 'v1.0.0'
    },
    {
      id: '3',
      predictionId: 'PRED003',
      type: 'IncidentRecurrence',
      title: 'Similar Conditions to INC-2024-0892',
      description: 'Database connection pool exhaustion risk detected based on query patterns.',
      affectedResource: 'database-cluster',
      severity: 'Critical',
      confidence: 0.92,
      generatedAt: new Date().toISOString(),
      predictedWindowStart: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      predictedWindowEnd: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      recommendedActions: [
        'Increase connection pool size immediately',
        'Enable connection pooling timeouts',
        'Review and terminate long-running queries'
      ],
      isAcknowledged: false,
      modelVersion: 'v1.0.0'
    }
  ]
}
