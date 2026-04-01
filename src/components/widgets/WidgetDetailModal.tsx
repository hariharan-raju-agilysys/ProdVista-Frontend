// =============================================================================
// WidgetDetailModal — Full-view drill-down modal for any widget
// Provides: maximized view, tabbed data exploration, raw data view,
// expandable table rows, and deeper drill-down capabilities.
// =============================================================================
import { useState, useMemo } from 'react';
import { X, Maximize2, Minimize2, RefreshCw, Download, Table, BarChart3, Code, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import clsx from 'clsx';
import type { WidgetConfig } from '../../types/DashboardConfigTypes';
import { WidgetRenderer } from './WidgetRenderer';
import type { DashboardWidget } from '../../services/dynamicDashboardService';

type Tab = 'visual' | 'table' | 'raw';

interface WidgetDetailModalProps {
  widget: WidgetConfig;
  data: unknown;
  isLoading?: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onDrillDown?: (row: Record<string, unknown>) => void;
}

/** Convert WidgetConfig to DashboardWidget shape for WidgetRenderer compatibility */
function toRenderWidget(widget: WidgetConfig): DashboardWidget {
  return {
    id: widget.id,
    widgetType: widget.type,
    title: widget.design.title,
    subtitle: widget.design.subtitle,
    gridX: widget.position.x,
    gridY: widget.position.y,
    gridWidth: widget.position.w,
    gridHeight: widget.position.h,
    minWidth: widget.position.minW ?? 2,
    minHeight: widget.position.minH ?? 2,
    displayOrder: 0,
    dataProviderType: widget.data.provider,
    widgetConfig: widget.data.renderConfig ?? {},
    dataProviderConfig: {},
    refreshIntervalSeconds: widget.data.refreshInterval ?? 0,
    isLocked: false,
  };
}

/** Flatten data for table display */
function flattenData(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.map(item => 
    typeof item === 'object' && item !== null ? item as Record<string, unknown> : { value: item }
  );
  if (typeof data === 'object' && data !== null) return [data as Record<string, unknown>];
  return [{ value: data }];
}

/** Pretty-print JSON with syntax highlighting classes */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function WidgetDetailModal({
  widget,
  data,
  isLoading,
  onClose,
  onRefresh,
  onDrillDown,
}: WidgetDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('visual');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedJson, setCopiedJson] = useState(false);

  const renderWidget = useMemo(() => toRenderWidget(widget), [widget]);
  const tableData = useMemo(() => flattenData(data), [data]);
  const columns = useMemo(() => {
    if (tableData.length === 0) return [];
    const keys = new Set<string>();
    tableData.slice(0, 20).forEach(row => Object.keys(row).forEach(k => keys.add(k)));
    return Array.from(keys);
  }, [tableData]);

  const toggleRow = (index: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch { /* noop */ }
  };

  const handleExportCsv = () => {
    if (tableData.length === 0) return;
    const header = columns.join(',');
    const rows = tableData.map(row =>
      columns.map(col => {
        const val = row[col];
        const str = val === null || val === undefined ? '' : String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${widget.design.title.replace(/\s+/g, '-').toLowerCase()}-data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className={clsx(
          'bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-all duration-300',
          isFullscreen ? 'w-full h-full' : 'w-full max-w-6xl h-[85vh]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {widget.design.headerGradient && (
              <div
                className="w-1.5 h-8 rounded-full"
                style={{ background: widget.design.headerGradient }}
              />
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                {widget.design.title}
              </h2>
              {widget.design.subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{widget.design.subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab buttons */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {([
                { key: 'visual' as Tab, icon: BarChart3, label: 'Visual' },
                { key: 'table' as Tab, icon: Table, label: 'Table' },
                { key: 'raw' as Tab, icon: Code, label: 'Raw' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    activeTab === tab.key
                      ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'table' && (
              <button
                onClick={handleExportCsv}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {activeTab === 'raw' && (
              <button
                onClick={handleCopyJson}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                title={copiedJson ? 'Copied!' : 'Copy JSON'}
              >
                {copiedJson ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            )}

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
              </button>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Visual Tab */}
          {activeTab === 'visual' && (
            <div className="p-6 h-full">
              <WidgetRenderer
                widget={renderWidget}
                data={data}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Table Tab — with expandable rows and drill-down */}
          {activeTab === 'table' && (
            <div className="p-4">
              {tableData.length === 0 ? (
                <div className="text-center text-gray-400 py-12">No data available</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <th className="w-8 px-2 py-2.5" />
                        {columns.map(col => (
                          <th key={col} className="px-3 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {tableData.slice(0, 200).map((row, i) => (
                        <>
                          <tr
                            key={i}
                            className={clsx(
                              'hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors',
                              onDrillDown && 'cursor-pointer'
                            )}
                            onClick={() => onDrillDown ? onDrillDown(row) : toggleRow(i)}
                          >
                            <td className="px-2 py-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleRow(i); }}
                                className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                              >
                                {expandedRows.has(i)
                                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                              </button>
                            </td>
                            {columns.map(col => (
                              <td key={col} className="px-3 py-2 text-gray-600 dark:text-gray-300 max-w-xs truncate">
                                {formatValue(row[col])}
                              </td>
                            ))}
                          </tr>
                          {/* Expanded row detail */}
                          {expandedRows.has(i) && (
                            <tr key={`${i}-detail`}>
                              <td colSpan={columns.length + 1} className="px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {columns.map(col => (
                                    <div key={col} className="flex flex-col">
                                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{col}</span>
                                      <span className="text-sm text-gray-700 dark:text-gray-200 break-all whitespace-pre-wrap">
                                        {formatValue(row[col])}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                  {tableData.length > 200 && (
                    <div className="text-center text-sm text-gray-400 py-3">
                      Showing 200 of {tableData.length} rows
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Raw JSON Tab */}
          {activeTab === 'raw' && (
            <div className="p-4">
              <pre className="bg-gray-950 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-auto max-h-[calc(85vh-120px)] whitespace-pre-wrap">
                {JSON.stringify(data, null, 2) || 'null'}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WidgetDetailModal;
