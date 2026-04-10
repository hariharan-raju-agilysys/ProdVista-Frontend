import { lazy, ComponentType } from 'react';

/**
 * Wraps React.lazy() with automatic retry on chunk-load failure.
 *
 * After a deployment the browser may still hold an old index.html whose
 * chunk hashes no longer exist on the server → "Failed to fetch dynamically
 * imported module". This wrapper catches that error and does a single
 * full-page reload so the browser picks up the new manifest.
 *
 * A sessionStorage flag prevents infinite reload loops.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const key = 'lazyWithRetry_reloaded';
      const alreadyRetried = sessionStorage.getItem(key);

      if (!alreadyRetried) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Return a never-resolving promise so React doesn't render the error
        return new Promise<{ default: T }>(() => {});
      }

      // Already retried once — clear flag and let the error propagate
      sessionStorage.removeItem(key);
      throw err;
    }),
  );
}

/**
 * Same as lazyWithRetry but for named exports.
 * Usage: lazyNamedWithRetry(() => import('./module'), 'ExportName')
 */
export function lazyNamedWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<Record<string, any>>,
  exportName: string,
): React.LazyExoticComponent<T> {
  return lazyWithRetry(() =>
    factory().then((mod) => ({ default: mod[exportName] as T })),
  );
}
