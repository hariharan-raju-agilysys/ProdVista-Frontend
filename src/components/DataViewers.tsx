import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { FullScreenModal } from './FullScreenModal';
import clsx from 'clsx';

interface PreviewButtonProps {
  title: string;
  children: React.ReactNode;
  contentToCopy?: string;
  className?: string;
  variant?: 'icon' | 'button' | 'link';
  buttonText?: string;
}

/**
 * Adds a "View Full Screen" button to any component.
 * When clicked, opens the content in FullScreenModal.
 */
export function PreviewButton({
  title,
  children,
  contentToCopy,
  className = '',
  variant = 'icon',
  buttonText = 'View Details',
}: PreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {variant === 'icon' && (
        <button
          onClick={() => setIsOpen(true)}
          className={clsx(
            'p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors',
            className
          )}
          title="View full screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
      
      {variant === 'button' && (
        <button
          onClick={() => setIsOpen(true)}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors',
            className
          )}
        >
          <Maximize2 className="w-4 h-4" />
          {buttonText}
        </button>
      )}
      
      {variant === 'link' && (
        <button
          onClick={() => setIsOpen(true)}
          className={clsx(
            'text-sm text-blue-600 hover:text-blue-700 hover:underline',
            className
          )}
        >
          {buttonText}
        </button>
      )}

      <FullScreenModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        showCopyButton={!!contentToCopy}
        contentToCopy={contentToCopy}
      >
        {children}
      </FullScreenModal>
    </>
  );
}

interface JsonViewerProps {
  data: unknown;
  title?: string;
  className?: string;
  maxHeight?: string;
  showFullScreenButton?: boolean;
}

/**
 * JSON data viewer with syntax highlighting and full-screen option.
 */
export function JsonViewer({
  data,
  title = 'JSON Data',
  className = '',
  maxHeight = '400px',
  showFullScreenButton = true,
}: JsonViewerProps) {
  const jsonString = JSON.stringify(data, null, 2);

  return (
    <div className={clsx('relative bg-slate-900 rounded-lg overflow-hidden', className)}>
      {showFullScreenButton && (
        <div className="absolute top-2 right-2 z-10">
          <PreviewButton
            title={title}
            contentToCopy={jsonString}
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
          >
            <pre className="text-sm text-slate-300 font-mono p-4 overflow-auto max-h-[80vh]">
              {jsonString}
            </pre>
          </PreviewButton>
        </div>
      )}
      <pre
        className="text-sm text-slate-300 font-mono p-4 overflow-auto"
        style={{ maxHeight }}
      >
        {jsonString}
      </pre>
    </div>
  );
}

interface LogViewerProps {
  logs: string[];
  title?: string;
  className?: string;
  maxHeight?: string;
  showFullScreenButton?: boolean;
}

/**
 * Log viewer with line numbers and full-screen option.
 */
export function LogViewer({
  logs,
  title = 'Logs',
  className = '',
  maxHeight = '400px',
  showFullScreenButton = true,
}: LogViewerProps) {
  const logsText = logs.join('\n');

  const renderLogs = () => (
    <div className="font-mono text-sm">
      {logs.map((log, i) => (
        <div 
          key={i} 
          className={clsx(
            'flex gap-4 py-1 px-3 hover:bg-slate-800/50',
            log.toLowerCase().includes('error') && 'bg-red-900/20 text-red-300',
            log.toLowerCase().includes('warn') && 'bg-yellow-900/20 text-yellow-300',
            log.toLowerCase().includes('info') && 'text-blue-300'
          )}
        >
          <span className="text-slate-500 select-none w-8 text-right">{i + 1}</span>
          <span className="flex-1 text-slate-300">{log}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className={clsx('relative bg-slate-900 rounded-lg overflow-hidden', className)}>
      {showFullScreenButton && (
        <div className="absolute top-2 right-2 z-10">
          <PreviewButton
            title={title}
            contentToCopy={logsText}
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
          >
            <div className="overflow-auto max-h-[80vh]">
              {renderLogs()}
            </div>
          </PreviewButton>
        </div>
      )}
      <div className="overflow-auto" style={{ maxHeight }}>
        {renderLogs()}
      </div>
    </div>
  );
}

interface DataTableViewerProps {
  data: Record<string, unknown>[];
  title?: string;
  className?: string;
  maxHeight?: string;
  showFullScreenButton?: boolean;
}

/**
 * Table viewer for array of objects with full-screen option.
 */
export function DataTableViewer({
  data,
  title = 'Data',
  className = '',
  maxHeight = '400px',
  showFullScreenButton = true,
}: DataTableViewerProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data available
      </div>
    );
  }

  const columns = Object.keys(data[0]);
  const jsonString = JSON.stringify(data, null, 2);

  const renderTable = () => (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-100 dark:bg-slate-800">
          {columns.map((col) => (
            <th key={col} className="px-4 py-2 text-left font-medium text-gray-700 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
            {columns.map((col) => (
              <td key={col} className="px-4 py-2 text-gray-600 dark:text-slate-400 border-b border-gray-100 dark:border-slate-800">
                {String(row[col] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className={clsx('relative bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden', className)}>
      {showFullScreenButton && (
        <div className="absolute top-2 right-2 z-10">
          <PreviewButton
            title={title}
            contentToCopy={jsonString}
            className="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700"
          >
            <div className="overflow-auto max-h-[80vh]">
              {renderTable()}
            </div>
          </PreviewButton>
        </div>
      )}
      <div className="overflow-auto" style={{ maxHeight }}>
        {renderTable()}
      </div>
    </div>
  );
}

// Export all components
export { FullScreenModal, useFullScreenModal } from './FullScreenModal';
