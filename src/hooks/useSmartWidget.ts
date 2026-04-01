import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Types
export interface WidgetDataResult {
  success: boolean;
  data?: unknown;
  error?: string;
  prediction?: AIPrediction;
  fetchedAt: string;
  nextRefreshAt?: string;
}

export interface AIPrediction {
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  anomalies: string[];
  predictedNextHour?: {
    min: number;
    max: number;
    average: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  riskExplanation: string;
  recommendations: string[];
  generatedAt: string;
  dataPointsAnalyzed: number;
  isSimplePrediction?: boolean;
}

export interface WidgetSubscriptionConfig {
  widgetId: string;
  dataSourceType?: 'azure-metrics' | 'azure-logs' | 'sql' | 'api' | 'static';
  refreshIntervalSeconds?: number;
  enableAIPrediction?: boolean;
  
  // Azure config
  subscriptionId?: string;
  resourceId?: string;
  resourceIds?: string[];
  metricNames?: string[];
  workspaceId?: string;
  query?: string;
  timeRangeHours?: number;
  granularityMinutes?: number;
  
  // API config
  apiEndpoint?: string;
  apiHeaders?: Record<string, string>;
  
  // SQL config
  queryConfigId?: string;
}

export interface UseSmartWidgetOptions {
  config: WidgetSubscriptionConfig;
  autoSubscribe?: boolean;
  onDataUpdate?: (data: WidgetDataResult) => void;
  onPrediction?: (prediction: AIPrediction) => void;
  onAuthExpired?: (message: string) => void;
  onError?: (error: Error) => void;
}

export function useSmartWidget(options: UseSmartWidgetOptions) {
  const { 
    config, 
    autoSubscribe = true, 
    onDataUpdate, 
    onPrediction,
    onAuthExpired, 
    onError 
  } = options;
  
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<unknown>(null);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<Date | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState<number | null>(null);

  // Build connection
  const buildConnection = useCallback(() => {
    const token = localStorage.getItem('prodvista_auth_token');
    if (!token) {
      setError('No authentication token found');
      return null;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/widget`, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    return connection;
  }, []);

  // Connect to hub
  const connect = useCallback(async () => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      return true;
    }

    try {
      const connection = buildConnection();
      if (!connection) return false;

      // Set up event handlers
      connection.on('SubscriptionConfirmed', (result: { 
        widgetId: string; 
        initialData?: WidgetDataResult;
        data?: WidgetDataResult;
        nextRefreshAt?: string;
      }) => {
        console.log('Widget subscription confirmed:', result);
        setIsSubscribed(true);
        setIsLoading(false);
        
        const widgetData = result.initialData || result.data;
        if (widgetData) {
          handleDataUpdate(widgetData);
        }
        
        if (result.nextRefreshAt) {
          setNextRefreshAt(new Date(result.nextRefreshAt));
        }
      });

      connection.on('WidgetDataUpdate', (result: { 
        widgetId: string; 
        data: WidgetDataResult;
        timestamp: string;
      }) => {
        if (result.widgetId === config.widgetId) {
          handleDataUpdate(result.data);
        }
      });

      connection.on('WidgetConfigChanged', (result: {
        widgetId: string;
        data: WidgetDataResult;
        timestamp: string;
      }) => {
        if (result.widgetId === config.widgetId) {
          console.log('Widget config changed, refreshing data');
          handleDataUpdate(result.data);
        }
      });

      connection.on('RefreshStarted', () => {
        setIsLoading(true);
      });

      connection.on('PredictionStarted', () => {
        console.log('AI prediction started');
      });

      connection.on('PredictionResult', (result: {
        widgetId: string;
        prediction: AIPrediction;
        timestamp: string;
      }) => {
        if (result.widgetId === config.widgetId && result.prediction) {
          setPrediction(result.prediction);
          onPrediction?.(result.prediction);
        }
      });

      connection.on('AuthExpired', (data: { message: string }) => {
        console.warn('Widget auth expired:', data.message);
        setError('Authentication expired');
        onAuthExpired?.(data.message);
      });

      connection.onreconnecting(() => {
        console.log('Widget hub reconnecting...');
        setIsConnected(false);
      });

      connection.onreconnected(() => {
        console.log('Widget hub reconnected');
        setIsConnected(true);
        // Re-subscribe after reconnection
        if (autoSubscribe) {
          subscribe();
        }
      });

      connection.onclose((err) => {
        console.log('Widget hub connection closed', err);
        setIsConnected(false);
        setIsSubscribed(false);
        if (err) {
          setError(err.message);
          onError?.(err);
        }
      });

      await connection.start();
      connectionRef.current = connection;
      setIsConnected(true);
      return true;
    } catch (err) {
      const error = err as Error;
      console.error('Widget hub connection failed', error);
      setError(error.message);
      onError?.(error);
      return false;
    }
  }, [buildConnection, config.widgetId, autoSubscribe, onAuthExpired, onError, onPrediction]);

  // Handle data update
  const handleDataUpdate = useCallback((result: WidgetDataResult) => {
    setIsLoading(false);
    
    if (result.success) {
      setData(result.data);
      setError(null);
      setLastFetchedAt(new Date(result.fetchedAt));
      
      if (result.nextRefreshAt) {
        setNextRefreshAt(new Date(result.nextRefreshAt));
      }
      
      if (result.prediction) {
        setPrediction(result.prediction);
        onPrediction?.(result.prediction);
      }
      
      onDataUpdate?.(result);
    } else {
      setError(result.error || 'Failed to fetch data');
    }
  }, [onDataUpdate, onPrediction]);

  // Subscribe to widget
  const subscribe = useCallback(async () => {
    if (!connectionRef.current || connectionRef.current.state !== signalR.HubConnectionState.Connected) {
      const connected = await connect();
      if (!connected) return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the full config subscription method
      await connectionRef.current!.invoke('SubscribeWithConfig', {
        widgetId: config.widgetId,
        dataSourceType: config.dataSourceType,
        refreshIntervalSeconds: config.refreshIntervalSeconds,
        enableAIPrediction: config.enableAIPrediction,
        subscriptionId: config.subscriptionId,
        resourceId: config.resourceId,
        resourceIds: config.resourceIds,
        metricNames: config.metricNames,
        workspaceId: config.workspaceId,
        query: config.query,
        timeRangeHours: config.timeRangeHours,
        granularityMinutes: config.granularityMinutes,
        apiEndpoint: config.apiEndpoint,
        apiHeaders: config.apiHeaders,
        queryConfigId: config.queryConfigId
      });
    } catch (err) {
      const error = err as Error;
      console.error('Failed to subscribe to widget', error);
      setError(error.message);
      setIsLoading(false);
      onError?.(error);
    }
  }, [connect, config, onError]);

  // Unsubscribe from widget
  const unsubscribe = useCallback(async () => {
    if (!connectionRef.current) return;
    
    try {
      await connectionRef.current.invoke('UnsubscribeFromWidget', config.widgetId, config.queryConfigId);
      setIsSubscribed(false);
    } catch (err) {
      console.error('Failed to unsubscribe', err);
    }
  }, [config.widgetId, config.queryConfigId]);

  // Request manual refresh
  const refresh = useCallback(async () => {
    if (!connectionRef.current) return;
    
    setIsLoading(true);
    try {
      await connectionRef.current.invoke('RequestRefresh', config.widgetId, config.queryConfigId);
    } catch (err) {
      const error = err as Error;
      console.error('Failed to refresh', error);
      setError(error.message);
      setIsLoading(false);
    }
  }, [config.widgetId, config.queryConfigId]);

  // Request AI prediction
  const requestPrediction = useCallback(async () => {
    if (!connectionRef.current) return;
    
    try {
      await connectionRef.current.invoke('RequestPrediction', config.widgetId);
    } catch (err) {
      console.error('Failed to request prediction', err);
    }
  }, [config.widgetId]);

  // Update widget config
  const updateConfig = useCallback(async (update: {
    refreshIntervalSeconds?: number;
    enableAIPrediction?: boolean;
    dataSourceType?: string;
    configuration?: unknown;
  }) => {
    if (!connectionRef.current) return;
    
    try {
      await connectionRef.current.invoke('UpdateWidgetConfig', config.widgetId, update);
    } catch (err) {
      console.error('Failed to update config', err);
    }
  }, [config.widgetId]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.stop();
      connectionRef.current = null;
      setIsConnected(false);
      setIsSubscribed(false);
    }
  }, []);

  // Countdown timer for next refresh
  useEffect(() => {
    if (!nextRefreshAt) {
      setRefreshCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((nextRefreshAt.getTime() - now.getTime()) / 1000));
      setRefreshCountdown(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextRefreshAt]);

  // Auto-subscribe on mount
  useEffect(() => {
    if (autoSubscribe && config.widgetId) {
      subscribe();
    }

    return () => {
      unsubscribe();
      disconnect();
    };
  }, [autoSubscribe, config.widgetId]); // Only re-run on mount or widget ID change

  return {
    // Connection state
    isConnected,
    isSubscribed,
    isLoading,
    
    // Data
    data,
    prediction,
    error,
    
    // Timing
    lastFetchedAt,
    nextRefreshAt,
    refreshCountdown,
    
    // Methods
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    refresh,
    requestPrediction,
    updateConfig
  };
}

// Hook for multiple widgets
export function useSmartWidgets(configs: WidgetSubscriptionConfig[]) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [widgetData, setWidgetData] = useState<Record<string, WidgetDataResult>>({});
  const [predictions, setPredictions] = useState<Record<string, AIPrediction>>({});

  // Similar implementation but manages multiple widgets
  // This is a simplified version - expand as needed
  
  const connect = useCallback(async () => {
    const token = localStorage.getItem('prodvista_auth_token');
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/widget`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    connection.on('WidgetDataUpdate', (result: { widgetId: string; data: WidgetDataResult }) => {
      setWidgetData(prev => ({ ...prev, [result.widgetId]: result.data }));
      
      if (result.data.prediction) {
        setPredictions(prev => ({ ...prev, [result.widgetId]: result.data.prediction! }));
      }
    });

    await connection.start();
    connectionRef.current = connection;
    setIsConnected(true);

    // Subscribe to all widgets
    for (const config of configs) {
      await connection.invoke('SubscribeWithConfig', config);
    }
  }, [configs]);

  useEffect(() => {
    connect();
    return () => {
      connectionRef.current?.stop();
    };
  }, [connect]);

  return {
    isConnected,
    widgetData,
    predictions,
    refresh: async (widgetId: string) => {
      await connectionRef.current?.invoke('RequestRefresh', widgetId);
    }
  };
}

export default useSmartWidget;
