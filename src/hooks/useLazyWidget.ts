import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Hook that lazily loads data when a component enters the viewport.
 * Uses IntersectionObserver to avoid unnecessary API calls for off-screen widgets.
 * 
 * On failure, prevents automatic retry from IntersectionObserver and applies
 * exponential backoff cooldown (30s → 60s → 120s) before allowing manual reload.
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
  const [retryAfter, setRetryAfter] = useState<number | null>(null); // timestamp when retry is allowed
  const failCountRef = useRef(0);
  const hasFailed = useRef(false);

  const enabled = options?.enabled !== false;

  const load = useCallback(async () => {
    // Block auto-retry if we already failed (only manual reload allowed)
    if (hasLoaded || loading || !enabled || hasFailed.current) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      setHasLoaded(true);
      failCountRef.current = 0;
      hasFailed.current = false;
      setRetryAfter(null);
    } catch (err: any) {
      hasFailed.current = true;
      failCountRef.current += 1;
      const cooldownSec = Math.min(30 * Math.pow(2, failCountRef.current - 1), 300);
      setRetryAfter(Date.now() + cooldownSec * 1000);
      setError(err?.response?.data?.error || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [fetcher, hasLoaded, loading, enabled]);

  useEffect(() => {
    if (!ref.current || !enabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded && !loading && !hasFailed.current) {
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
    // Enforce cooldown: don't allow retry until retryAfter has passed
    if (retryAfter && Date.now() < retryAfter) return;

    hasFailed.current = false;
    setHasLoaded(false);
    setData(null);
    setLoading(true);
    setError(null);
    setRetryAfter(null);
    try {
      const result = await fetcher();
      setData(result);
      setHasLoaded(true);
      failCountRef.current = 0;
    } catch (err: any) {
      hasFailed.current = true;
      failCountRef.current += 1;
      const cooldownSec = Math.min(30 * Math.pow(2, failCountRef.current - 1), 300);
      setRetryAfter(Date.now() + cooldownSec * 1000);
      setError(err?.response?.data?.error || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [fetcher, retryAfter]);

  return { ref, data, loading, error, hasLoaded, reload, retryAfter };
}
