import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Hook that lazily loads data when a component enters the viewport.
 * Uses IntersectionObserver to avoid unnecessary API calls for off-screen widgets.
 */
export function useLazyWidget<T>(
  fetcher: () => Promise<T>,
  options?: { rootMargin?: string; threshold?: number; enabled?: boolean }
) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const enabled = options?.enabled !== false;

  const load = useCallback(async () => {
    if (hasLoaded || loading || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      setHasLoaded(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [fetcher, hasLoaded, loading, enabled]);

  useEffect(() => {
    if (!ref.current || !enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded && !loading) {
          load();
        }
      },
      {
        rootMargin: options?.rootMargin ?? '200px',
        threshold: options?.threshold ?? 0,
      }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [load, hasLoaded, loading, enabled, options?.rootMargin, options?.threshold]);

  const reload = useCallback(async () => {
    setHasLoaded(false);
    setData(null);
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      setHasLoaded(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  return { ref, data, loading, error, hasLoaded, reload };
}
