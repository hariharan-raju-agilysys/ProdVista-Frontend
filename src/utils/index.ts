/**
 * ProdVista Shared Utilities
 * ===========================
 * Centralized utility functions used across the application.
 * Import from '@utils' or '@/utils' throughout the app.
 *
 * IMPORTANT: Keep these functions pure and well-documented.
 */

// ============================================================================
// DATE & TIME UTILITIES
// ============================================================================

/**
 * Returns a human-readable relative time string (e.g., "5m ago", "2h ago", "3d ago")
 */
export function timeAgo(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'N/A';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return 'Invalid date';

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * Format a date for display (short format)
 */
export function formatDateShort(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'N/A';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return 'Invalid';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a date for display (full format)
 */
export function formatDateFull(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'N/A';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return 'Invalid';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format a datetime for display
 */
export function formatDateTime(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'N/A';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return 'Invalid';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get duration string from milliseconds
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ============================================================================
// DEVOPS STYLING UTILITIES
// ============================================================================

/**
 * Get color classes for priority levels (Azure DevOps style)
 */
export function priorityColor(priority?: number): string {
  switch (priority) {
    case 1: return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/40';
    case 2: return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/40';
    case 3: return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/40';
    case 4: return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/40';
    default: return 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
  }
}

/**
 * Get human-readable priority label
 */
export function priorityLabel(priority?: number): string {
  switch (priority) {
    case 1: return 'Critical';
    case 2: return 'High';
    case 3: return 'Medium';
    case 4: return 'Low';
    default: return 'None';
  }
}

/**
 * Get color classes for work item states
 */
export function stateColor(state: string): string {
  const s = state.toLowerCase();
  if (s === 'new') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  if (s === 'active' || s === 'inprogress' || s === 'in progress') {
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
  }
  if (s === 'resolved' || s === 'completed' || s === 'done') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  }
  if (s === 'closed') return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  if (s === 'removed' || s === 'blocked') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}

/**
 * Get emoji icon for work item types
 */
export function workItemTypeIcon(type: string): string {
  switch (type) {
    case 'Bug': return '🐛';
    case 'Task': return '📋';
    case 'User Story': return '📖';
    case 'Feature': return '🚀';
    case 'Epic': return '🏔️';
    case 'Issue': return '⚠️';
    case 'Test Case': return '🧪';
    default: return '📄';
  }
}

/**
 * Get color classes for build status
 */
export function buildStatusColor(status: string, result?: string): string {
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'finished') {
    const r = (result || '').toLowerCase();
    if (r === 'succeeded') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    if (r === 'failed') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    if (r === 'partiallysucceeded') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
    if (r === 'canceled' || r === 'cancelled') return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
  if (s === 'inprogress' || s === 'running') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  if (s === 'notstarted' || s === 'queued') return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}

/**
 * Get PR vote display info
 */
export function prVoteInfo(vote: number): { label: string; color: string; variant: 'success' | 'warning' | 'error' | 'neutral' } {
  if (vote === 10) return { label: 'Approved', color: 'text-green-600 dark:text-green-400', variant: 'success' };
  if (vote === 5) return { label: 'Approved w/ suggestions', color: 'text-yellow-600 dark:text-yellow-400', variant: 'warning' };
  if (vote === -10) return { label: 'Rejected', color: 'text-red-600 dark:text-red-400', variant: 'error' };
  if (vote === -5) return { label: 'Waiting', color: 'text-orange-500 dark:text-orange-400', variant: 'warning' };
  return { label: 'No vote', color: 'text-gray-400 dark:text-gray-500', variant: 'neutral' };
}

// ============================================================================
// NUMBER & STRING UTILITIES
// ============================================================================

/**
 * Format numbers with K/M/B suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 3)}...`;
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to kebab-case
 */
export function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Group array by key
 */
export function groupBy<T, K extends string | number>(arr: T[], key: (item: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/**
 * Remove duplicates by key
 */
export function uniqueBy<T>(arr: T[], key: (item: T) => unknown): T[] {
  const seen = new Set();
  return arr.filter(item => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Sort array by multiple keys
 */
export function sortBy<T>(arr: T[], ...keys: ((item: T) => number | string)[]): T[] {
  return [...arr].sort((a, b) => {
    for (const key of keys) {
      const aVal = key(a);
      const bVal = key(b);
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  });
}

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: unknown[]) => unknown>(fn: T, limit: number): T {
  let lastCall = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      return fn(...args);
    }
  }) as T;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Check if value is empty (null, undefined, empty string, empty array)
 */
export function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if value is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is a valid email
 */
export function isValidEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

// ============================================================================
// CLIPBOARD UTILITIES
// ============================================================================

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// LOCAL STORAGE UTILITIES
// ============================================================================

/**
 * Get typed value from localStorage
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set typed value to localStorage
 */
export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn(`Failed to save ${key} to localStorage`);
  }
}

/**
 * Remove item from localStorage
 */
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Generate a consistent color from a string (for avatars, tags, etc.)
 */
export function stringToColor(str: string): string {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ============================================================================
// URL UTILITIES
// ============================================================================

/**
 * Build URL with query params
 */
export function buildUrl(base: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(base, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

/**
 * Parse query params from URL
 */
export function parseQueryParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// ============================================================================
// CLASSNAMES UTILITY (consistent with clsx but typed)
// ============================================================================

/**
 * Combine class names (simple utility)
 */
export function cn(...classes: (string | number | boolean | undefined | null)[]): string {
  return classes
    .filter(x => typeof x === 'string' && x.trim())
    .join(' ');
}
