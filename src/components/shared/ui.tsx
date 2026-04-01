/**
 * Shared presentational primitives used across many pages.
 *
 * Keep these small, pure, and memoised where appropriate.
 * Import from '@components/shared/ui' throughout the app.
 */

import { memo, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// StatCard — numeric KPI card (used on almost every dashboard page)
// ---------------------------------------------------------------------------

export interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  /** Tailwind colour classes for the card surface */
  color?: string;
  subtext?: string;
}

export const StatCard = memo(function StatCard({
  label, value, icon, color, subtext,
}: StatCardProps) {
  return (
    <div className={clsx(
      'rounded-xl border p-4 flex items-center gap-4 transition-all hover:shadow-md',
      color ?? 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white',
    )}>
      {icon && (
        <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-white/60 dark:bg-black/20 shadow-sm">
          {icon}
        </div>
      )}
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs font-medium opacity-80">{label}</div>
        {subtext && <div className="text-xs opacity-60 mt-0.5">{subtext}</div>}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// StatusBadge — small coloured pill
// ---------------------------------------------------------------------------

export interface StatusBadgeProps {
  label: string;
  variant?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
  size?: 'xs' | 'sm';
}

const badgeColors: Record<string, string> = {
  info:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  error:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

export const StatusBadge = memo(function StatusBadge({
  label, variant = 'neutral', size = 'xs',
}: StatusBadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center rounded-md font-medium',
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      badgeColors[variant],
    )}>
      {label}
    </span>
  );
});

// ---------------------------------------------------------------------------
// EmptyState — placeholder when data is absent
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  message?: string;
}

export const EmptyState = memo(function EmptyState({
  icon, title, message,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-3 text-gray-300 dark:text-slate-600">{icon}</div>}
      {title && <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">{title}</h3>}
      {message && <p className="text-xs text-gray-400 dark:text-slate-500">{message}</p>}
    </div>
  );
});

// ---------------------------------------------------------------------------
// LoadingSpinner — full-area spinner with optional label
// ---------------------------------------------------------------------------

export interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export const LoadingSpinner = memo(function LoadingSpinner({
  label, className,
}: LoadingSpinnerProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-32', className)}>
      <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
      {label && <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>}
    </div>
  );
});

// ---------------------------------------------------------------------------
// PageHeader — consistent header bar for every page
// ---------------------------------------------------------------------------

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export const PageHeader = memo(function PageHeader({
  title, subtitle, icon, actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              {icon}
            </div>
          )}
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
});
