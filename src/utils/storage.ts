/**
 * storage.ts — Type-safe localStorage wrapper with JSON (de)serialization.
 *
 * Centralises every localStorage access so that:
 *   1. Quota errors are caught (Safari private browsing, full storage).
 *   2. JSON parse failures return null instead of crashing.
 *   3. Every key used in the app can be traced back here.
 */

function get<T = string>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    // Try JSON parse first; if it fails, return the raw string as T
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
  } catch {
    return null;
  }
}

function set(key: string, value: unknown): void {
  try {
    const serialised = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialised);
  } catch (err) {
    console.warn(`[storage] Failed to write key "${key}":`, err);
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop — quota or permission error
  }
}

function clear(): void {
  try { localStorage.clear(); } catch { /* noop */ }
}

export const storage = { get, set, remove, clear } as const;
