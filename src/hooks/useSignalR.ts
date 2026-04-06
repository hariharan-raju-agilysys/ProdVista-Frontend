/**
 * useSignalR.ts — Reusable SignalR connection hook factory.
 *
 * Eliminates duplicated connection bootstrap logic that existed
 * across useAIChatHub, useWidgetHub, useCloudHub, useInternalDashboardHub.
 *
 * Usage:
 *   const { connection, isConnected, error } = useSignalR('/hubs/widget');
 *
 * Features:
 *   - Token-based auth from authService
 *   - Automatic reconnect with progressive backoff
 *   - Reconnecting / reconnected / closed lifecycle callbacks
 *   - Cleanup on unmount
 *   - Connection state exposed as React state
 *   - serverTimeoutInMilliseconds configurable (fixes stuck/timeout)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { authService } from '../services/authService';

const API_BASE_URL = import.meta.env.VITE_BASE_PATH || '';

export interface UseSignalROptions {
  /** Hub path, e.g. '/hubs/widget' */
  hubPath: string;
  /** Reconnect delays in ms (default: [0, 2000, 5000, 10000, 30000]) */
  reconnectDelays?: number[];
  /** SignalR log level (default: Warning) */
  logLevel?: LogLevel;
  /** Server timeout in ms — must be > server's KeepAliveInterval (default: 60000) */
  serverTimeout?: number;
  /** Keep-alive interval in ms (default: 15000) */
  keepAliveInterval?: number;
  /** Called when connection state changes */
  onConnectionChange?: (connected: boolean) => void;
}

export interface UseSignalRResult {
  connection: HubConnection | null;
  isConnected: boolean;
  error: string | null;
  /** Manually restart the connection */
  reconnect: () => Promise<void>;
}

export function useSignalR(options: UseSignalROptions): UseSignalRResult {
  const {
    hubPath,
    reconnectDelays = [0, 2000, 5000, 10000, 30000],
    logLevel = LogLevel.Warning,
    serverTimeout = 60_000,
    keepAliveInterval = 15_000,
    onConnectionChange,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<HubConnection | null>(null);
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  // Build & start
  useEffect(() => {
    const token = authService.getToken();
    if (!token) return;

    const conn = new HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}${hubPath}`, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect(reconnectDelays)
      .configureLogging(logLevel)
      .build();

    // Tune timeouts to prevent "stuck" socket issues
    conn.serverTimeoutInMilliseconds = serverTimeout;
    conn.keepAliveIntervalInMilliseconds = keepAliveInterval;

    conn.onreconnecting(() => {
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
    });

    conn.onreconnected(() => {
      setIsConnected(true);
      setError(null);
      onConnectionChangeRef.current?.(true);
    });

    conn.onclose((err) => {
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
      if (err) setError(err.message);
    });

    connectionRef.current = conn;

    conn
      .start()
      .then(() => {
        setIsConnected(true);
        setError(null);
        onConnectionChangeRef.current?.(true);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Connection failed');
        setIsConnected(false);
        onConnectionChangeRef.current?.(false);
      });

    return () => {
      conn.stop();
      connectionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubPath]);

  const reconnect = useCallback(async () => {
    const conn = connectionRef.current;
    if (!conn || conn.state === HubConnectionState.Connected) return;
    try {
      await conn.start();
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconnect failed');
    }
  }, []);

  return {
    connection: connectionRef.current,
    isConnected,
    error,
    reconnect,
  };
}
