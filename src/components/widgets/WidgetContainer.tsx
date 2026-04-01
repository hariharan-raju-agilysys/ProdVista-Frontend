// =============================================================================
// WidgetContainer — AI-designed, clickable widget wrapper
// Renders beautiful titles with icons, gradients, badges, glow effects.
// Every widget is clickable → opens detail modal or drill-down.
// =============================================================================
import { useState, useMemo } from 'react';
import {
  Maximize2, ExternalLink, RefreshCw, ChevronRight, Zap,
  Activity, Server, TrendingUp, TrendingDown, BarChart3,
  Database, Globe, Shield, Clock, AlertTriangle, CheckCircle,
  XCircle, Eye, Layers, Cpu, HardDrive, Wifi, Users,
  FileText, GitBranch, Box, Terminal, Search, Settings,
  PieChart, LineChart, LayoutDashboard, Gauge, List,
  Table, Map, MessageSquare, Sparkles, ArrowUpRight
} from 'lucide-react';
import clsx from 'clsx';
import type { WidgetConfig, WidgetDesign } from '../../types/DashboardConfigTypes';

// Lucide icon map — AI can reference these by name
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity, Server, TrendingUp, TrendingDown, BarChart3,
  Database, Globe, Shield, Clock, AlertTriangle, CheckCircle,
  XCircle, Eye, Layers, Cpu, HardDrive, Wifi, Users,
  FileText, GitBranch, Box, Terminal, Search, Settings,
  PieChart, LineChart, LayoutDashboard, Gauge, List,
  Table, Map, MessageSquare, Sparkles, Zap, ArrowUpRight,
  Maximize2, ExternalLink, RefreshCw, ChevronRight,
};

interface WidgetContainerProps {
  widget: WidgetConfig;
  children: React.ReactNode;
  isLoading?: boolean;
  isLive?: boolean;
  onClickWidget?: (widget: WidgetConfig) => void;
  onMaximize?: (widget: WidgetConfig) => void;
  onRefresh?: (widget: WidgetConfig) => void;
  onDrillDown?: (widget: WidgetConfig) => void;
  className?: string;
}

/** Get card style classes based on AI theme */
function getCardClasses(design: WidgetDesign, cardStyle: string): string {
  const base = 'relative overflow-hidden transition-all duration-300 group';
  
  switch (cardStyle) {
    case 'glass':
      return clsx(base, 'bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 shadow-lg');
    case 'neon':
      return clsx(base, 'bg-gray-900 border border-gray-700', design.glowColor ? '' : 'shadow-lg shadow-blue-500/10');
    case 'elevated':
      return clsx(base, 'bg-white dark:bg-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 border-0');
    case 'bordered':
      return clsx(base, 'bg-white dark:bg-gray-800 border-2', design.borderColor ? '' : 'border-gray-200 dark:border-gray-700');
    case 'solid':
    default:
      return clsx(base, 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm');
  }
}

export function WidgetContainer({
  widget,
  children,
  isLoading,
  isLive,
  onClickWidget,
  onMaximize,
  onRefresh,
  onDrillDown,
  className,
}: WidgetContainerProps) {
  const { design, actions } = widget;
  const [hovered, setHovered] = useState(false);
  
  const isClickable = actions?.clickable !== false && (!!onClickWidget || !!actions?.onClick);
  const IconComponent = design.icon ? ICON_MAP[design.icon] : null;
  
  // Determine card style (default to 'elevated')
  const cardStyle = 'elevated'; // Will be overridden by theme in ConfigDrivenDashboard
  
  const cardClasses = useMemo(() => getCardClasses(design, cardStyle), [design, cardStyle]);

  const cardRadius = 'rounded-2xl';

  return (
    <div
      className={clsx(
        cardClasses,
        cardRadius,
        isClickable && 'cursor-pointer hover:scale-[1.01] hover:shadow-2xl',
        className
      )}
      style={{
        background: design.cardBg || undefined,
        borderColor: design.borderColor || undefined,
        boxShadow: design.glowColor && hovered ? `0 0 30px ${design.glowColor}` : undefined,
      }}
      onClick={isClickable ? () => onClickWidget?.(widget) : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header Gradient Bar */}
      {design.headerGradient && (
        <div
          className="h-1 w-full"
          style={{ background: design.headerGradient }}
        />
      )}

      {/* Widget Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Icon with styled background */}
          {IconComponent && (
            <div
              className={clsx(
                'flex items-center justify-center w-9 h-9 rounded-xl shrink-0',
                design.animated && 'animate-pulse'
              )}
              style={{
                background: design.iconBg || 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: design.iconColor || '#fff',
              }}
            >
              <IconComponent className="w-4.5 h-4.5" />
            </div>
          )}
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3
                className={clsx(
                  'text-sm font-semibold truncate',
                  design.headerTextColor ? '' : 'text-gray-800 dark:text-gray-100'
                )}
                style={{ color: design.headerTextColor || undefined }}
              >
                {design.title}
              </h3>
              
              {/* Badge */}
              {design.badge && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: design.badgeColor || '#3b82f6',
                    color: '#fff',
                  }}
                >
                  {design.badge === 'LIVE' && <Zap className="w-2.5 h-2.5 mr-0.5" />}
                  {design.badge}
                </span>
              )}
              
              {/* Live indicator from SignalR */}
              {isLive && !design.badge && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            
            {design.subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {design.subtitle}
              </p>
            )}
          </div>
        </div>
        
        {/* Action buttons — slide in on hover */}
        <div
          className={clsx(
            'flex items-center gap-0.5 transition-all duration-200',
            hovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
          )}
        >
          {onRefresh && (
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(widget); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            </button>
          )}
          
          {onMaximize && (
            <button
              onClick={(e) => { e.stopPropagation(); onMaximize(widget); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              title="Maximize"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          
          {actions?.drillDown && onDrillDown && (
            <button
              onClick={(e) => { e.stopPropagation(); onDrillDown(widget); }}
              className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 hover:text-blue-600 transition-colors"
              title="Drill Down"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Widget Content */}
      <div className="px-4 pb-3 h-[calc(100%-60px)] overflow-auto">
        {isLoading ? (
          <div className="animate-pulse space-y-3 h-full pt-2">
            <div className="h-8 bg-gray-200/60 dark:bg-gray-700/60 rounded-lg w-2/3" />
            <div className="h-4 bg-gray-200/40 dark:bg-gray-700/40 rounded w-1/2" />
            <div className="h-16 bg-gray-200/30 dark:bg-gray-700/30 rounded-lg mt-2" />
          </div>
        ) : (
          children
        )}
      </div>
      
      {/* Footer */}
      {design.footerText && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
            {design.footerText}
          </p>
        </div>
      )}
      
      {/* Click indicator on hover */}
      {isClickable && hovered && (
        <div className="absolute bottom-2 right-3 flex items-center gap-1 text-[10px] text-gray-400/70 dark:text-gray-500/70 pointer-events-none">
          <span>Click for details</span>
          <ArrowUpRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}

export { ICON_MAP };
export default WidgetContainer;
