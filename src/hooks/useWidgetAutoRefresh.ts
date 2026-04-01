import { useState, useEffect, useCallback, useRef } from 'react';

interface UseWidgetAutoRefreshOptions {
  widgetId: string;
  refreshIntervalSeconds: number;
  enabled: boolean;
  onRefresh: (widgetId: string) => Promise<void>;
}

interface UseWidgetAutoRefreshReturn {
  secondsUntilRefresh: number;
  isRefreshing: boolean;
  refresh: () => void;
  pause: () => void;
  resume: () => void;
  isPaused: boolean;
}

export function useWidgetAutoRefresh({
  widgetId,
  refreshIntervalSeconds,
  enabled,
  onRefresh,
}: UseWidgetAutoRefreshOptions): UseWidgetAutoRefreshReturn {
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(refreshIntervalSeconds);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const doRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefreshRef.current(widgetId);
    } catch (err) {
      console.error(`Auto-refresh failed for widget ${widgetId}:`, err);
    } finally {
      setIsRefreshing(false);
      setSecondsUntilRefresh(refreshIntervalSeconds);
    }
  }, [widgetId, refreshIntervalSeconds]);

  useEffect(() => {
    if (!enabled || refreshIntervalSeconds <= 0 || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setSecondsUntilRefresh(refreshIntervalSeconds);

    intervalRef.current = setInterval(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) {
          doRefresh();
          return refreshIntervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, refreshIntervalSeconds, isPaused, doRefresh]);

  const refresh = useCallback(() => {
    doRefresh();
  }, [doRefresh]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);

  return { secondsUntilRefresh, isRefreshing, refresh, pause, resume, isPaused };
}
