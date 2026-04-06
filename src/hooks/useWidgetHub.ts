import { useEffect, useState, useCallback, useRef } from 'react';
import { HubConnection, HubConnectionBuilder, LogLevel, HubConnectionState } from '@microsoft/signalr';
import { authService } from '../services/authService';

const API_BASE_URL = import.meta.env.VITE_BASE_PATH || '';

export interface WidgetDataUpdate {
  widgetId: string;
  data: unknown;
  timestamp: string;
}

export interface QueryResultUpdate {
  queryConfigId: string;
  queryName: string;
  data: Record<string, unknown>[];
  columns: { name: string; dataType: string; isNullable: boolean }[];
  rowCount: number;
  executionDurationMs: number;
  executedAt: string;
}

export interface QueryStatusUpdate {
  queryConfigId: string;
  status: 'running' | 'success' | 'failed' | 'error';
  error?: string;
  timestamp: string;
}

interface UseWidgetHubOptions {
  onWidgetUpdate?: (update: WidgetDataUpdate) => void;
  onQueryResult?: (result: QueryResultUpdate) => void;
  onQueryStatus?: (status: QueryStatusUpdate) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function useWidgetHub(options: UseWidgetHubOptions = {}) {
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const subscribedWidgets = useRef<Set<string>>(new Set());
  const subscribedQueries = useRef<Set<string>>(new Set());

  // Create connection
  useEffect(() => {
    const token = authService.getToken();
    if (!token) return;

    const newConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/widget`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Information)
      .build();

    setConnection(newConnection);

    return () => {
      newConnection.stop();
    };
  }, []); // Token is fetched inside the effect

  // Start connection and setup handlers
  useEffect(() => {
    if (!connection) return;

    const startConnection = async () => {
      // Only start if in Disconnected state
      if (connection.state !== HubConnectionState.Disconnected) {
        console.log('SignalR already connecting or connected, state:', connection.state);
        if (connection.state === HubConnectionState.Connected) {
          setIsConnected(true);
          setConnectionError(null);
        }
        return;
      }
      
      try {
        await connection.start();
        setIsConnected(true);
        setConnectionError(null);
        options.onConnectionChange?.(true);
        console.log('SignalR connected to WidgetHub');
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Connection failed';
        setConnectionError(error);
        setIsConnected(false);
        options.onConnectionChange?.(false);
        console.error('SignalR connection error:', error);
      }
    };

    // Event handlers
    connection.on('WidgetDataUpdate', (data: WidgetDataUpdate) => {
      options.onWidgetUpdate?.(data);
    });

    connection.on('QueryResultUpdate', (data: QueryResultUpdate) => {
      options.onQueryResult?.(data);
    });

    connection.on('QueryStatusUpdate', (data: QueryStatusUpdate) => {
      options.onQueryStatus?.(data);
    });

    connection.on('SubscriptionConfirmed', (data: { widgetId: string; queryConfigId?: string }) => {
      console.log('Subscription confirmed:', data);
    });

    connection.on('RefreshRequested', (data: { widgetId: string; queryConfigId: string; status: string }) => {
      console.log('Refresh requested:', data);
    });

    connection.onreconnecting((error) => {
      setIsConnected(false);
      options.onConnectionChange?.(false);
      console.log('SignalR reconnecting...', error?.message);
    });

    connection.onreconnected((connectionId) => {
      setIsConnected(true);
      options.onConnectionChange?.(true);
      console.log('SignalR reconnected:', connectionId);
      
      // Re-subscribe to widgets and queries
      subscribedWidgets.current.forEach((widgetId) => {
        const queryId = subscribedQueries.current.has(widgetId) ? widgetId : undefined;
        connection.invoke('SubscribeToWidget', widgetId, queryId);
      });
    });

    connection.onclose((error) => {
      setIsConnected(false);
      options.onConnectionChange?.(false);
      console.log('SignalR connection closed', error?.message);
    });

    startConnection();

    return () => {
      connection.off('WidgetDataUpdate');
      connection.off('QueryResultUpdate');
      connection.off('QueryStatusUpdate');
      connection.off('SubscriptionConfirmed');
      connection.off('RefreshRequested');
    };
  }, [connection, options]);

  // Subscribe to a widget
  const subscribeToWidget = useCallback(async (widgetId: string, queryConfigId?: string) => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      console.warn('Cannot subscribe: not connected');
      return;
    }

    try {
      await connection.invoke('SubscribeToWidget', widgetId, queryConfigId);
      subscribedWidgets.current.add(widgetId);
      if (queryConfigId) {
        subscribedQueries.current.add(queryConfigId);
      }
    } catch (err) {
      console.error('Failed to subscribe to widget:', err);
    }
  }, [connection]);

  // Unsubscribe from a widget
  const unsubscribeFromWidget = useCallback(async (widgetId: string, queryConfigId?: string) => {
    if (!connection || connection.state !== HubConnectionState.Connected) return;

    try {
      await connection.invoke('UnsubscribeFromWidget', widgetId, queryConfigId);
      subscribedWidgets.current.delete(widgetId);
      if (queryConfigId) {
        subscribedQueries.current.delete(queryConfigId);
      }
    } catch (err) {
      console.error('Failed to unsubscribe from widget:', err);
    }
  }, [connection]);

  // Request immediate refresh
  const requestRefresh = useCallback(async (widgetId: string, queryConfigId: string) => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      console.warn('Cannot request refresh: not connected');
      return;
    }

    try {
      await connection.invoke('RequestRefresh', widgetId, queryConfigId);
    } catch (err) {
      console.error('Failed to request refresh:', err);
    }
  }, [connection]);

  return {
    isConnected,
    connectionError,
    subscribeToWidget,
    unsubscribeFromWidget,
    requestRefresh,
  };
}

// Singleton hook for global connection management
let globalConnection: HubConnection | null = null;

export function getGlobalWidgetConnection(token: string): HubConnection {
  if (!globalConnection) {
    globalConnection = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/widget`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
  }
  return globalConnection;
}
