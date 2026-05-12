/**
 * useDashboardHub.ts - Real-time dashboard data streaming via SignalR
 * 
 * Progressively loads dashboard data to avoid timeouts
 * Shows loading progress as data chunks arrive
 * 
 * Usage:
 *   const { streamDashboard, progress, data, isLoading, error } = useDashboardHub();
 *   
 *   // Trigger stream
 *   await streamDashboard('https://dev.azure.com/org', 'ProjectName', 7);
 *   
 *   // Access data chunks as they arrive
 *   console.log(data.repositories, data.openPullRequests, data.builds, etc.)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSignalR } from './useSignalR';

export interface DashboardProgress {
  step: string;
  progress: number; // 0-100
}

export interface DashboardData {
  repositories?: any[];
  openPullRequests?: any[];
  completedPullRequests?: any[];
  builds?: any[];
  pipelines?: any[];
  commits?: any[];
  stats?: any;
  // Manager dashboard fields
  iterations?: any[];
  workItems?: any[];
  qualitySummary?: any;
  ownerEfficiency?: any[];
}

export interface UseDashboardHubResult {
  /** Current loading progress */
  progress: DashboardProgress;
  /** Accumulated dashboard data chunks */
  data: DashboardData;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether SignalR is connected */
  isConnected: boolean;
  /** Stream engineering dashboard data */
  streamEngineeringDashboard: (organizationUrl: string, projectName: string, daysBack?: number) => Promise<void>;
  /** Stream manager dashboard data */
  streamManagerDashboard: (organizationUrl: string, projectName: string, iterationPath: string) => Promise<void>;
  /** Cancel ongoing stream */
  cancelStream: () => Promise<void>;
  /** Reset state */
  reset: () => void;
}

export function useDashboardHub(): UseDashboardHubResult {
  const { connection, isConnected, error: connectionError } = useSignalR({
    hubPath: '/hubs/dashboard',
  });

  const [progress, setProgress] = useState<DashboardProgress>({ step: '', progress: 0 });
  const [data, setData] = useState<DashboardData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const dataRef = useRef<DashboardData>({});

  // Set up SignalR event handlers
  useEffect(() => {
    if (!connection) return;

    // Progress updates
    connection.on('DashboardProgress', (progressData: DashboardProgress) => {
      setProgress(progressData);
    });

    // Data chunk received
    connection.on('DashboardDataChunk', ({ type, data: chunkData }: { type: string; data: any }) => {
      setData((prev) => {
        const updated = { ...prev, [type]: chunkData };
        dataRef.current = updated;
        return updated;
      });
    });

    // Streaming complete
    connection.on('DashboardComplete', ({ generatedAt }: { generatedAt: string }) => {
      setIsLoading(false);
      setProgress({ step: 'Complete', progress: 100 });
      console.log('[DashboardHub] Streaming complete at', generatedAt);
    });

    // Error occurred
    connection.on('DashboardError', ({ error: errorMsg }: { error: string }) => {
      setError(errorMsg);
      setIsLoading(false);
      setProgress({ step: 'Error', progress: 0 });
      console.error('[DashboardHub] Error:', errorMsg);
    });

    // Stream cancelled
    connection.on('DashboardCancelled', () => {
      setIsLoading(false);
      setProgress({ step: 'Cancelled', progress: 0 });
      console.log('[DashboardHub] Stream cancelled');
    });

    // Cleanup
    return () => {
      connection.off('DashboardProgress');
      connection.off('DashboardDataChunk');
      connection.off('DashboardComplete');
      connection.off('DashboardError');
      connection.off('DashboardCancelled');
    };
  }, [connection]);

  const streamEngineeringDashboard = useCallback(
    async (organizationUrl: string, projectName: string, daysBack = 7) => {
      if (!connection || !isConnected) {
        setError('Not connected to dashboard hub');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setData({});
        setProgress({ step: 'Starting...', progress: 0 });
        dataRef.current = {};

        await connection.invoke('StreamEngineeringDashboard', organizationUrl, projectName, daysBack);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start dashboard stream';
        setError(message);
        setIsLoading(false);
        console.error('[DashboardHub] Stream error:', err);
      }
    },
    [connection, isConnected]
  );

  const streamManagerDashboard = useCallback(
    async (organizationUrl: string, projectName: string, iterationPath: string) => {
      if (!connection || !isConnected) {
        setError('Not connected to dashboard hub');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        setData({});
        setProgress({ step: 'Starting...', progress: 0 });
        dataRef.current = {};

        await connection.invoke('StreamManagerDashboard', organizationUrl, projectName, iterationPath);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start dashboard stream';
        setError(message);
        setIsLoading(false);
        console.error('[DashboardHub] Stream error:', err);
      }
    },
    [connection, isConnected]
  );

  const cancelStream = useCallback(async () => {
    if (!connection || !isConnected) return;

    try {
      await connection.invoke('CancelDashboardStream');
    } catch (err) {
      console.error('[DashboardHub] Cancel error:', err);
    }
  }, [connection, isConnected]);

  const reset = useCallback(() => {
    setProgress({ step: '', progress: 0 });
    setData({});
    setIsLoading(false);
    setError(null);
    dataRef.current = {};
  }, []);

  return {
    progress,
    data,
    isLoading,
    error: error || connectionError,
    isConnected,
    streamEngineeringDashboard,
    streamManagerDashboard,
    cancelStream,
    reset,
  };
}
