/**
 * Shared presentational primitives used across many pages.
 *
 * Keep these small, pure, and memoised where appropriate.
 * Import from '@components/shared/ui' throughout the app.
 *
 * GUIDELINES:
 * - All components should be memoized for performance
 * - Use clsx for conditional class names
 * - Provide sensible defaults
 * - Export TypeScript interfaces for props
 */

import { memo, type ReactNode, type ButtonHTMLAttributes, forwardRef } from 'react';
import { RefreshCw, GitBranch, GitCommit, Play, ExternalLink, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import {
  timeAgo,
  priorityColor,
  stateColor,
  workItemTypeIcon,
  buildStatusColor,
  prVoteInfo,
  getInitials,
  stringToColor,
} from '@/utils';

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

// ---------------------------------------------------------------------------
// InteractiveStatCard — clickable stat card with hover effects
// ---------------------------------------------------------------------------

export interface InteractiveStatCardProps extends StatCardProps {
  onClick?: () => void;
  trend?: { value: number; label?: string };
  isLoading?: boolean;
}

export const InteractiveStatCard = memo(function InteractiveStatCard({
  label, value, icon, color, subtext, onClick, trend, isLoading,
}: InteractiveStatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick || isLoading}
      className={clsx(
        'w-full rounded-xl border p-4 flex items-center gap-4 transition-all text-left',
        'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
        'disabled:cursor-default disabled:hover:scale-100',
        color ?? 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white',
      )}
    >
      {icon && (
        <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-white/60 dark:bg-black/20 shadow-sm">
          {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold">{isLoading ? '...' : value}</div>
        <div className="text-xs font-medium opacity-80">{label}</div>
        {subtext && <div className="text-xs opacity-60 mt-0.5">{subtext}</div>}
      </div>
      {trend && (
        <div className={clsx(
          'text-xs font-medium px-2 py-1 rounded-full',
          trend.value > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
          trend.value < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        )}>
          {trend.value > 0 ? '+' : ''}{trend.value}%
        </div>
      )}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Avatar — user avatar with fallback to initials
// ---------------------------------------------------------------------------

export interface AvatarProps {
  name?: string;
  imageUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const avatarSizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export const Avatar = memo(function Avatar({
  name, imageUrl, size = 'sm', className,
}: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name || 'Avatar'}
        className={clsx('rounded-full object-cover', avatarSizes[size], className)}
      />
    );
  }
  return (
    <div className={clsx(
      'rounded-full flex items-center justify-center font-medium text-white',
      stringToColor(name || ''),
      avatarSizes[size],
      className,
    )}>
      {getInitials(name || '')}
    </div>
  );
});

// ---------------------------------------------------------------------------
// WorkItemCard — DevOps work item card
// ---------------------------------------------------------------------------

export interface WorkItemCardProps {
  id: number;
  title: string;
  type: string;
  state: string;
  priority?: number;
  assignedTo?: string;
  assignedToImageUrl?: string;
  changedDate?: string;
  url?: string;
  onClick?: () => void;
}

export const WorkItemCard = memo(function WorkItemCard({
  id, title, type, state, priority, assignedTo, assignedToImageUrl, changedDate, url, onClick,
}: WorkItemCardProps) {
  const content = (
    <div className={clsx(
      'p-3 rounded-lg border transition-all',
      'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
      (onClick || url) && 'hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md cursor-pointer',
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0" title={type}>{workItemTypeIcon(type)}</span>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">#{id}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {priority && (
            <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', priorityColor(priority))}>
              P{priority}
            </span>
          )}
          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', stateColor(state))}>
            {state}
          </span>
        </div>
      </div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-2">{title}</h4>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Avatar name={assignedTo} imageUrl={assignedToImageUrl} size="xs" />
          <span className="truncate max-w-[100px]">{assignedTo || 'Unassigned'}</span>
        </div>
        {changedDate && <span>{timeAgo(changedDate)}</span>}
      </div>
    </div>
  );

  if (url) {
    return <a href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>{content}</a>;
  }
  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  }
  return content;
});

// ---------------------------------------------------------------------------
// PullRequestCard — Git pull request card
// ---------------------------------------------------------------------------

export interface PullRequestCardProps {
  id: number;
  title: string;
  status: string;
  sourceBranch: string;
  targetBranch: string;
  createdBy?: string;
  createdByImageUrl?: string;
  createdDate?: string;
  reviewers?: Array<{ displayName: string; vote: number; imageUrl?: string }>;
  url?: string;
  onClick?: () => void;
}

export const PullRequestCard = memo(function PullRequestCard({
  id, title, status, sourceBranch, targetBranch, createdBy, createdByImageUrl, createdDate, reviewers, url, onClick,
}: PullRequestCardProps) {
  const content = (
    <div className={clsx(
      'p-3 rounded-lg border transition-all',
      'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
      (onClick || url) && 'hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-md cursor-pointer',
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-purple-500" />
          <span className="text-xs text-purple-600 dark:text-purple-400 font-mono">!{id}</span>
        </div>
        <StatusBadge
          label={status}
          variant={status.toLowerCase() === 'active' ? 'info' : status.toLowerCase() === 'completed' ? 'success' : 'neutral'}
          size="xs"
        />
      </div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-2">{title}</h4>
      <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400 mb-2">
        <span className="truncate max-w-[80px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
          {sourceBranch.replace('refs/heads/', '')}
        </span>
        <span>→</span>
        <span className="truncate max-w-[80px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
          {targetBranch.replace('refs/heads/', '')}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
          <Avatar name={createdBy} imageUrl={createdByImageUrl} size="xs" />
          <span className="truncate max-w-[80px]">{createdBy || 'Unknown'}</span>
          {createdDate && <span>• {timeAgo(createdDate)}</span>}
        </div>
        {reviewers && reviewers.length > 0 && (
          <div className="flex -space-x-1">
            {reviewers.slice(0, 3).map((r, i) => (
              <div key={i} className="relative" title={`${r.displayName}: ${prVoteInfo(r.vote).label}`}>
                <Avatar name={r.displayName} imageUrl={r.imageUrl} size="xs" />
                <span className={clsx(
                  'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white dark:border-slate-800',
                  r.vote === 10 ? 'bg-green-500' :
                  r.vote === 5 ? 'bg-yellow-500' :
                  r.vote === -10 ? 'bg-red-500' :
                  r.vote === -5 ? 'bg-orange-500' : 'bg-gray-400'
                )} />
              </div>
            ))}
            {reviewers.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-[10px] font-medium">
                +{reviewers.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (url) {
    return <a href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>{content}</a>;
  }
  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  }
  return content;
});

// ---------------------------------------------------------------------------
// CommitCard — Git commit card
// ---------------------------------------------------------------------------

export interface CommitCardProps {
  commitId: string;
  comment: string;
  author?: string;
  authorImageUrl?: string;
  authorDate?: string;
  url?: string;
  onClick?: () => void;
}

export const CommitCard = memo(function CommitCard({
  commitId, comment, author, authorImageUrl, authorDate, url, onClick,
}: CommitCardProps) {
  const shortId = commitId.substring(0, 7);
  const content = (
    <div className={clsx(
      'p-3 rounded-lg border transition-all',
      'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
      (onClick || url) && 'hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md cursor-pointer',
    )}>
      <div className="flex items-start gap-3">
        <GitCommit className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-xs bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded font-mono text-orange-600 dark:text-orange-400">
              {shortId}
            </code>
            {authorDate && (
              <span className="text-[10px] text-gray-400 dark:text-slate-500">{timeAgo(authorDate)}</span>
            )}
          </div>
          <p className="text-sm text-gray-900 dark:text-white line-clamp-2 mb-1">{comment}</p>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
            <Avatar name={author} imageUrl={authorImageUrl} size="xs" />
            <span className="truncate">{author || 'Unknown'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (url) {
    return <a href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>{content}</a>;
  }
  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  }
  return content;
});

// ---------------------------------------------------------------------------
// BuildCard — CI/CD build card
// ---------------------------------------------------------------------------

export interface BuildCardProps {
  id: number;
  buildNumber: string;
  definitionName: string;
  status: string;
  result?: string;
  queueTime?: string;
  finishTime?: string;
  sourceBranch?: string;
  requestedBy?: string;
  requestedByImageUrl?: string;
  url?: string;
  onClick?: () => void;
}

export const BuildCard = memo(function BuildCard({
  buildNumber, definitionName, status, result, queueTime, finishTime, sourceBranch, requestedBy, requestedByImageUrl, url, onClick,
}: BuildCardProps) {
  const statusLabel = result || status;
  const content = (
    <div className={clsx(
      'p-3 rounded-lg border transition-all',
      'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
      (onClick || url) && 'hover:border-cyan-400 dark:hover:border-cyan-500 hover:shadow-md cursor-pointer',
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-cyan-500" />
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300">{definitionName}</span>
        </div>
        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-medium', buildStatusColor(status, result))}>
          {statusLabel}
        </span>
      </div>
      <div className="text-sm font-mono text-gray-900 dark:text-white mb-2">#{buildNumber}</div>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Avatar name={requestedBy} imageUrl={requestedByImageUrl} size="xs" />
          <span className="truncate max-w-[80px]">{requestedBy || 'System'}</span>
        </div>
        <div className="flex items-center gap-2">
          {sourceBranch && (
            <span className="truncate max-w-[80px] text-[10px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              {sourceBranch.replace('refs/heads/', '')}
            </span>
          )}
          {(finishTime || queueTime) && <span>{timeAgo(finishTime || queueTime)}</span>}
        </div>
      </div>
    </div>
  );

  if (url) {
    return <a href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>{content}</a>;
  }
  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>;
  }
  return content;
});

// ---------------------------------------------------------------------------
// Card — generic card container
// ---------------------------------------------------------------------------

export interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const cardPadding = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = memo(function Card({
  children, className, padding = 'md', hover = false,
}: CardProps) {
  return (
    <div className={clsx(
      'rounded-xl border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700',
      cardPadding[padding],
      hover && 'transition-all hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600',
      className,
    )}>
      {children}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Button — styled button with variants
// ---------------------------------------------------------------------------

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const buttonVariants = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
  secondary: 'bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600',
  ghost: 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
};

const buttonSizes = {
  xs: 'px-2 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, className, disabled, ...props
}, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});

// ---------------------------------------------------------------------------
// TabPanel — simple tab switcher
// ---------------------------------------------------------------------------

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
}

export interface TabPanelProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'pills' | 'underline';
}

export const TabPanel = memo(function TabPanel({
  tabs, activeTab, onTabChange, variant = 'pills',
}: TabPanelProps) {
  if (variant === 'underline') {
    return (
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex gap-4 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-all',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300',
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className={clsx(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === tab.id
              ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white',
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && (
            <span className={clsx(
              'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
              activeTab === tab.id
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                : 'bg-gray-200 text-gray-600 dark:bg-slate-600 dark:text-slate-400',
            )}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// ErrorAlert — error message display
// ---------------------------------------------------------------------------

export interface ErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorAlert = memo(function ErrorAlert({
  title = 'Error', message, onRetry,
}: ErrorAlertProps) {
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-300">{title}</h4>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Skeleton — loading placeholder
// ---------------------------------------------------------------------------

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton = memo(function Skeleton({
  className, variant = 'rect',
}: SkeletonProps) {
  return (
    <div className={clsx(
      'animate-pulse bg-gray-200 dark:bg-slate-700',
      variant === 'circle' && 'rounded-full',
      variant === 'rect' && 'rounded-md',
      variant === 'text' && 'rounded h-4',
      className,
    )} />
  );
});

// ---------------------------------------------------------------------------
// ProgressBar — simple progress indicator
// ---------------------------------------------------------------------------

export interface ProgressBarProps {
  value: number; // 0-100
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const progressColors = {
  default: 'bg-blue-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
};

export const ProgressBar = memo(function ProgressBar({
  value, variant = 'default', size = 'sm', showLabel = false,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full">
      <div className={clsx(
        'w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
      )}>
        <div
          className={clsx('h-full rounded-full transition-all', progressColors[variant])}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 dark:text-slate-400 mt-1">{Math.round(clampedValue)}%</span>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// IconButton — small icon-only button
// ---------------------------------------------------------------------------

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string; // for accessibility
  size?: 'xs' | 'sm' | 'md';
  variant?: 'ghost' | 'solid';
}

const iconButtonSizes = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
};

export const IconButton = memo(forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  icon, label, size = 'sm', variant = 'ghost', className, ...props
}, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg transition-all',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        iconButtonSizes[size],
        variant === 'ghost'
          ? 'text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700'
          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}));

// ---------------------------------------------------------------------------
// Divider — horizontal rule
// ---------------------------------------------------------------------------

export interface DividerProps {
  label?: string;
  className?: string;
}

export const Divider = memo(function Divider({ label, className }: DividerProps) {
  if (label) {
    return (
      <div className={clsx('flex items-center gap-4', className)}>
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">{label}</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
      </div>
    );
  }
  return <div className={clsx('h-px bg-gray-200 dark:bg-slate-700', className)} />;
});

// ---------------------------------------------------------------------------
// Link — styled anchor with external indicator
// ---------------------------------------------------------------------------

export interface LinkProps {
  href: string;
  children: ReactNode;
  external?: boolean;
  className?: string;
}

export const Link = memo(function Link({
  href, children, external = false, className,
}: LinkProps) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={clsx(
        'text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1',
        className,
      )}
    >
      {children}
      {external && <ExternalLink className="w-3 h-3" />}
    </a>
  );
});
