import { useEffect, useState, useCallback, useRef } from 'react';
import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { authService } from '../services/authService';

const API_BASE_URL = (import.meta.env.VITE_BASE_PATH || '').replace(/\/$/, '');

export interface ChatMessage {
  message: string;
  content?: string;
  context?: string;
  history?: HistoryMessage[];
  model?: string;
}

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AzureQueryInfo {
  queryType?: string;
  serviceName?: string;
  region?: string;
  azurePortalLink?: string;
  rowCount?: number;
  generatedKql?: string;
}

export interface DevOpsWorkItemSummary {
  id: number;
  title: string;
  state: string;
  workItemType: string;
  assignedTo?: string;
  severity?: string;
  priority?: string;
  createdDate?: string;
  changedDate?: string;
  url?: string;
  areaPath?: string;
  iterationPath?: string;
  tags?: string[];
}

export interface DevOpsContextInfo {
  organizationUrl?: string;
  projectName?: string;
  workItems: DevOpsWorkItemSummary[];
  bugsUrl?: string;
  boardUrl?: string;
  queriesUrl?: string;
}

export interface CustomerSummary {
  customerId: string;
  customerName: string;
  currentVersion?: string;
  region: string;
  status: string;
  priority: string;
  deploymentType: string;
  activeUsers: number;
  totalProperties: number;
  openTickets: number;
  healthScore: string;
  products: string[];
  goLiveDate?: string;
  lastActivityDate?: string;
  customerManager?: string;
  supportManager?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface CustomerContextInfo {
  mode: 'overview' | 'detail';
  totalCustomers: number;
  totalProperties: number;
  totalActiveUsers: number;
  totalOpenTickets: number;
  versionDistribution: Record<string, number>;
  healthDistribution: Record<string, number>;
  customers: CustomerSummary[];
}

export interface JenkinsBuildSummary {
  jobName: string;
  buildNumber: number;
  result: string;
  timestamp: string;
  durationMs: number;
  url?: string;
}

export interface JenkinsContextInfo {
  jenkinsUrl?: string;
  totalJobs: number;
  recentBuilds: JenkinsBuildSummary[];
}

export interface PipelineStepInfo {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'skipped' | 'error';
}

export interface ChatStreamToken {
  messageId: string;
  type: 'start' | 'token' | 'end' | 'error' | 'status' | 'pipeline';
  content: string;
  model?: string;
  provider?: string;
  timestamp: string;
  error?: string;
  azureQueryResult?: AzureQueryInfo;
  devOpsContext?: DevOpsContextInfo;
  customerContext?: CustomerContextInfo;
  jenkinsContext?: JenkinsContextInfo;
  pipelineSteps?: PipelineStepInfo[];
  activeStep?: string;
}

export interface ChatResponse {
  success: boolean;
  messageId: string;
  content: string;
  model?: string;
  provider?: string;
  duration?: number;
  error?: string;
  timestamp: string;
}

// Database query types for AI Query Assistant
export interface DatabaseQueryRequest {
  question: string;
  connectionId?: string;
  azureDatabaseId?: string;
  executeQuery?: boolean;
  maxRows?: number;
}

export interface DatabaseQueryStreamToken {
  queryId: string;
  phase: 'starting' | 'understanding' | 'generating' | 'validating' | 'executing' | 'complete' | 'error';
  message: string;
  progress: number;
  generatedSql?: string;
  success?: boolean;
  rowCount?: number;
  executionTimeMs?: number;
  data?: Record<string, unknown>[];
  error?: string;
  timestamp: string;
}

export interface DatabaseQueryCallbacks {
  onPhaseChange?: (phase: string, message: string, progress: number) => void;
  onSqlGenerated?: (sql: string) => void;
  onComplete?: (result: DatabaseQueryStreamToken) => void;
  onError?: (error: string) => void;
}

// AI Dashboard Builder types
export interface DashboardBuildRequest {
  prompt: string;
  pageSlug: string;
  context?: string;
  includeDesign?: boolean;
}

export interface DashboardBuildCallbacks {
  onStart?: (messageId: string) => void;
  onToken?: (token: string, accumulated: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: string) => void;
}

interface UseAIChatHubOptions {
  onToken?: (token: ChatStreamToken) => void;
  onStreamStart?: (messageId: string) => void;
  onStreamComplete?: (messageId: string, fullContent: string, azureQueryInfo?: AzureQueryInfo, devOpsContext?: DevOpsContextInfo, customerContext?: CustomerContextInfo, jenkinsContext?: JenkinsContextInfo) => void;
  onStreamError?: (error: string, messageId: string) => void;
  onStatus?: (status: string, messageId: string) => void;
  onPipeline?: (steps: PipelineStepInfo[], activeStep: string | undefined, content: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function useAIChatHub(options: UseAIChatHubOptions = {}) {
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  const isStreamingRef = useRef(false);
  
  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Create connection
  useEffect(() => {
    const token = authService.getToken();
    if (!token) return;

    const newConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/aichat`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build();

    setConnection(newConnection);

    return () => {
      newConnection.stop();
    };
  }, []);

  // Start connection and setup handlers
  useEffect(() => {
    if (!connection) return;

    const startConnection = async () => {
      try {
        await connection.start();
        setIsConnected(true);
        setConnectionError(null);
        optionsRef.current.onConnectionChange?.(true);
        console.log('SignalR connected to AIChatHub');
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Connection failed';
        setConnectionError(error);
        setIsConnected(false);
        optionsRef.current.onConnectionChange?.(false);
        console.error('AIChatHub connection error:', error);
      }
    };

    // Handle connected event from server
    connection.on('Connected', (data: { connectionId: string; message: string }) => {
      console.log('AIChatHub connected:', data.message);
    });

    connection.onreconnecting((error) => {
      setIsConnected(false);
      optionsRef.current.onConnectionChange?.(false);
      console.log('AIChatHub reconnecting...', error?.message);
    });

    connection.onreconnected((connectionId) => {
      setIsConnected(true);
      optionsRef.current.onConnectionChange?.(true);
      console.log('AIChatHub reconnected:', connectionId);
    });

    connection.onclose((error) => {
      setIsConnected(false);
      optionsRef.current.onConnectionChange?.(false);
      console.log('AIChatHub connection closed', error?.message);
    });

    startConnection();

    return () => {
      connection.off('Connected');
    };
  }, [connection]);

  // Send message with streaming response using SignalR streaming
  const sendMessageStream = useCallback(async (
    message: string,
    history: HistoryMessage[] = [],
    context?: string,
    model?: string
  ): Promise<void> => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      throw new Error('Not connected to AI chat service');
    }

    if (isStreamingRef.current) {
      console.warn('Already streaming, ignoring request');
      return;
    }

    isStreamingRef.current = true;
    const contentChunks: string[] = [];
    let currentMessageId = '';

    try {
      // Use SignalR streaming to receive tokens
      const chatMessage: ChatMessage = {
        message,
        content: message,
        context: context || 'dashboard_assistant',
        history,
        model,
      };

      // stream() returns an IStreamResult that we can subscribe to
      const stream = connection.stream<ChatStreamToken>('SendMessageStream', chatMessage);

      stream.subscribe({
        next: (token: ChatStreamToken) => {
          if (token.type === 'start') {
            currentMessageId = token.messageId;
            optionsRef.current.onStreamStart?.(token.messageId);
          } else if (token.type === 'pipeline') {
            optionsRef.current.onPipeline?.(token.pipelineSteps || [], token.activeStep, token.content);
            // Also forward as status for backward-compat
            if (token.content) {
              optionsRef.current.onStatus?.(token.content, token.messageId || currentMessageId);
            }
          } else if (token.type === 'status') {
            optionsRef.current.onStatus?.(token.content, token.messageId || currentMessageId);
          } else if (token.type === 'token') {
            contentChunks.push(token.content);
            optionsRef.current.onToken?.(token);
          } else if (token.type === 'end') {
            const fullContent = contentChunks.join('');
            optionsRef.current.onStreamComplete?.(token.messageId, token.content || fullContent, token.azureQueryResult, token.devOpsContext, token.customerContext, token.jenkinsContext);
          } else if (token.type === 'error') {
            optionsRef.current.onStreamError?.(token.error || 'Unknown error', token.messageId);
          }
        },
        error: (err: Error) => {
          console.error('Stream error:', err);
          optionsRef.current.onStreamError?.(err.message, currentMessageId);
          isStreamingRef.current = false;
        },
        complete: () => {
          console.log('Stream completed');
          isStreamingRef.current = false;
        },
      });
    } catch (err) {
      isStreamingRef.current = false;
      console.error('Failed to start streaming:', err);
      throw err;
    }
  }, [connection]);

  // Send message without streaming (for fallback)
  const sendMessage = useCallback(async (
    message: string,
    history: HistoryMessage[] = [],
    context?: string,
    model?: string
  ): Promise<ChatResponse> => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      throw new Error('Not connected to AI chat service');
    }

    try {
      const chatMessage: ChatMessage = {
        message,
        content: message,
        context: context || 'dashboard_assistant',
        history,
        model,
      };
      
      const response = await connection.invoke<ChatResponse>('SendMessage', chatMessage);
      return response;
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  }, [connection]);

  // Get available models
  const getAvailableModels = useCallback(async (): Promise<string[]> => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      throw new Error('Not connected');
    }

    try {
      const models = await connection.invoke<string[]>('GetAvailableModels');
      return models;
    } catch (err) {
      console.error('Failed to get models:', err);
      return [];
    }
  }, [connection]);

  // Check if AI is available
  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      return false;
    }

    try {
      return await connection.invoke<boolean>('CheckAvailability');
    } catch (err) {
      console.error('Failed to check availability:', err);
      return false;
    }
  }, [connection]);

  // Execute database query via SignalR (avoids HTTP timeout issues)
  const executeDatabaseQuery = useCallback(async (
    request: DatabaseQueryRequest,
    callbacks: DatabaseQueryCallbacks
  ): Promise<DatabaseQueryStreamToken | null> => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      callbacks.onError?.('Not connected to AI chat service');
      return null;
    }

    return new Promise((resolve) => {
      let finalResult: DatabaseQueryStreamToken | null = null;

      try {
        const stream = connection.stream<DatabaseQueryStreamToken>('ExecuteDatabaseQueryStream', request);

        stream.subscribe({
          next: (token: DatabaseQueryStreamToken) => {
            console.log('[SignalR-DbQuery] Phase:', token.phase, token.message, token.progress + '%');
            
            callbacks.onPhaseChange?.(token.phase, token.message, token.progress);
            
            if (token.generatedSql) {
              callbacks.onSqlGenerated?.(token.generatedSql);
            }
            
            if (token.phase === 'complete') {
              finalResult = token;
              callbacks.onComplete?.(token);
            } else if (token.phase === 'error') {
              callbacks.onError?.(token.error || token.message);
              finalResult = token;
            }
          },
          error: (err: Error) => {
            console.error('[SignalR-DbQuery] Stream error:', err);
            callbacks.onError?.(err.message);
            resolve(null);
          },
          complete: () => {
            console.log('[SignalR-DbQuery] Stream completed');
            resolve(finalResult);
          },
        });
      } catch (err) {
        console.error('[SignalR-DbQuery] Failed to start query:', err);
        callbacks.onError?.(err instanceof Error ? err.message : 'Unknown error');
        resolve(null);
      }
    });
  }, [connection]);

  // Build AI dashboard via SignalR streaming
  const buildDashboard = useCallback(async (
    request: DashboardBuildRequest,
    callbacks: DashboardBuildCallbacks
  ): Promise<string | null> => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      callbacks.onError?.('Not connected to AI chat service');
      return null;
    }

    return new Promise((resolve) => {
      const dashChunks: string[] = [];

      try {
        const stream = connection.stream<ChatStreamToken>('BuildDashboardStream', request);

        stream.subscribe({
          next: (token: ChatStreamToken) => {
            if (token.type === 'start') {
              callbacks.onStart?.(token.messageId);
            } else if (token.type === 'token') {
              dashChunks.push(token.content);
              const fullContent = dashChunks.join('');
              callbacks.onToken?.(token.content, fullContent);
            } else if (token.type === 'end') {
              // end token has the full content
              const fullContent = dashChunks.join('');
              callbacks.onComplete?.(token.content || fullContent);
            } else if (token.type === 'error') {
              callbacks.onError?.(token.content || 'Unknown error');
            }
          },
          error: (err: Error) => {
            console.error('[SignalR-Dashboard] Stream error:', err);
            callbacks.onError?.(err.message);
            resolve(null);
          },
          complete: () => {
            console.log('[SignalR-Dashboard] Stream completed');
            resolve(dashChunks.join(''));
          },
        });
      } catch (err) {
        console.error('[SignalR-Dashboard] Failed to start build:', err);
        callbacks.onError?.(err instanceof Error ? err.message : 'Unknown error');
        resolve(null);
      }
    });
  }, [connection]);

  return {
    isConnected,
    connectionError,
    sendMessageStream,
    sendMessage,
    getAvailableModels,
    checkAvailability,
    executeDatabaseQuery,
    buildDashboard,
    isStreaming: isStreamingRef.current,
    connection,
  };
}
