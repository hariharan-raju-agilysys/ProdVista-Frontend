import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AzureQuickSetup from '../components/AzureQuickSetup'
import AppInsightsTraces from '../components/AppInsightsTraces'
import AzureLogsViewer from '../components/AzureLogsViewer'
import LogAnalyticsQuery from '../components/LogAnalyticsQuery'
import { AzureAuthGuard } from '../components/AzureAuthGuard'
import { executeLogAnalyticsQuery } from '../services/api'

interface Workspace {
  id: string
  name: string
  resourceGroup: string
  location: string
}

interface Resource {
  id: string
  name: string
  type: string
  location: string
  resourceGroup?: string
}

interface SelectedResource {
  id: string
  name: string
  type: string
  location: string
  resourceGroup?: string
  subscriptionId: string
}

interface QueryResult {
  columns: string[]
  rows: any[][]
  query: string
  workspaceId: string
}

type ViewMode = 'setup' | 'traces' | 'logs' | 'query-results' | 'log-analytics'

export default function AzureDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('setup')
  const [selectedWorkspace, setSelectedWorkspace] = useState<SelectedResource | null>(null)
  const [selectedStorage, setSelectedStorage] = useState<SelectedResource | null>(null)
  const [selectedAppInsights, setSelectedAppInsights] = useState<SelectedResource | null>(null)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)

  const handleWorkspaceSelect = (workspace: Workspace, subscriptionId: string) => {
    setSelectedWorkspace({ ...workspace, type: 'workspaces', subscriptionId })
    setViewMode('traces')
  }

  const handleStorageSelect = (storage: Resource, subscriptionId: string) => {
    setSelectedStorage({ ...storage, subscriptionId })
    setViewMode('logs')
  }

  const handleResourceSelect = (resource: Resource, subscriptionId: string) => {
    if (resource.type.includes('storageAccounts')) {
      handleStorageSelect(resource, subscriptionId)
    } else if (resource.type.includes('workspaces')) {
      handleWorkspaceSelect({ ...resource, resourceGroup: resource.resourceGroup || '' }, subscriptionId)
    } else if (resource.type.includes('components')) {
      setSelectedAppInsights({ ...resource, subscriptionId })
      setViewMode('traces')
    }
  }

  const handleRunQuery = async (workspaceId: string, query: string) => {
    setQueryLoading(true)
    setQueryError(null)
    try {
      const result = await executeLogAnalyticsQuery(workspaceId, query, 'PT1H')
      setQueryResult({
        columns: result.columns || [],
        rows: result.rows || [],
        query,
        workspaceId
      })
      setViewMode('query-results')
    } catch (error: any) {
      setQueryError(error.response?.data?.message || error.message || 'Query execution failed')
    } finally {
      setQueryLoading(false)
    }
  }

  const goBack = () => {
    setViewMode('setup')
    setQueryError(null)
  }

  return (
    <AzureAuthGuard featureName="Azure Explorer" redirectOnFailure={true}>
    <div className="min-h-screen bg-gray-900 p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            {viewMode !== 'setup' && (
              <button
                onClick={goBack}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
            )}
            <h1 className="text-2xl font-bold text-white">
              {viewMode === 'setup' && '☁️ Azure Explorer'}
              {viewMode === 'traces' && '📊 Distributed Traces'}
              {viewMode === 'logs' && '📦 Storage Logs'}
              {viewMode === 'log-analytics' && '🔍 Log Analytics'}
              {viewMode === 'query-results' && '🔍 Query Results'}
            </h1>
          </div>
          <p className="text-gray-400">
            {viewMode === 'setup' && 'Quick access to your Azure resources, workspaces, and data'}
            {viewMode === 'traces' && (selectedWorkspace?.name || selectedAppInsights?.name || 'View application traces and telemetry')}
            {viewMode === 'logs' && (selectedStorage?.name || 'Browse and search storage logs')}
            {viewMode === 'log-analytics' && 'Query Log Analytics workspaces with KQL'}
            {viewMode === 'query-results' && 'KQL query results'}
          </p>
        </div>

        {/* Breadcrumb Navigation */}
        {viewMode !== 'setup' && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <button
              onClick={goBack}
              className="text-blue-400 hover:text-blue-300"
            >
              Azure
            </button>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">
              {viewMode === 'traces' && (selectedWorkspace?.name || selectedAppInsights?.name || 'Traces')}
              {viewMode === 'logs' && (selectedStorage?.name || 'Logs')}
              {viewMode === 'log-analytics' && 'Log Analytics Query'}
              {viewMode === 'query-results' && 'Query Results'}
            </span>
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {viewMode === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Quick Actions */}
              <div className="mb-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setViewMode('log-analytics')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  🔍 Open Log Analytics Query
                </button>
              </div>

              <AzureQuickSetup
                onWorkspaceSelect={handleWorkspaceSelect}
                onResourceSelect={handleResourceSelect}
                onRunQuery={handleRunQuery}
              />
              {queryLoading && (
                <div className="mt-4 p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-blue-300">Executing query...</span>
                </div>
              )}
              {queryError && (
                <div className="mt-4 p-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300">
                  ❌ {queryError}
                </div>
              )}
            </motion.div>
          )}

          {viewMode === 'traces' && (
            <motion.div
              key="traces"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <AppInsightsTraces
                workspaceId={selectedWorkspace?.id || selectedAppInsights?.id}
                resourceId={selectedAppInsights?.id}
                onClose={goBack}
              />
            </motion.div>
          )}

          {viewMode === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <AzureLogsViewer
                accountName={selectedStorage?.name}
                onClose={goBack}
              />
            </motion.div>
          )}

          {viewMode === 'log-analytics' && (
            <motion.div
              key="log-analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <LogAnalyticsQuery
                defaultWorkspaceId={selectedWorkspace?.id}
                onClose={goBack}
              />
            </motion.div>
          )}

          {viewMode === 'query-results' && queryResult && (
            <motion.div
              key="query-results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Query Info */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-400">Executed Query</h3>
                  <span className="text-xs text-gray-500">{queryResult.rows.length} rows</span>
                </div>
                <pre className="text-sm text-green-400 bg-gray-900 p-3 rounded overflow-x-auto">
                  {queryResult.query}
                </pre>
              </div>

              {/* Results Table */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-700">
                        {queryResult.columns.map((col, i) => (
                          <th key={i} className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {queryResult.rows.slice(0, 100).map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-700/50">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-2 text-gray-300 whitespace-nowrap">
                              {typeof cell === 'object' ? JSON.stringify(cell) : String(cell ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {queryResult.rows.length > 100 && (
                  <div className="p-3 bg-gray-700 text-center text-sm text-gray-400">
                    Showing 100 of {queryResult.rows.length} rows
                  </div>
                )}
                {queryResult.rows.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    No results found
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
    </AzureAuthGuard>
  )
}
