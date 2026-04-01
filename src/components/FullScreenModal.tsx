import { useEffect, useCallback } from 'react';
import { X, Maximize2, Minimize2, Download, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface FullScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCopyButton?: boolean;
  showDownloadButton?: boolean;
  onDownload?: () => void;
  contentToCopy?: string;
  className?: string;
}

/**
 * Full-screen modal for viewing detailed content.
 * Use this for long-running details, logs, JSON data, etc.
 */
export function FullScreenModal({
  isOpen,
  onClose,
  title = 'Details',
  children,
  showCopyButton = false,
  showDownloadButton = false,
  onDownload,
  contentToCopy,
  className = '',
}: FullScreenModalProps) {
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(true);

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  const handleCopy = async () => {
    if (contentToCopy) {
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-all duration-300 ${
          isFullScreen 
            ? 'w-full h-full' 
            : 'w-[90%] h-[90%] max-w-6xl rounded-xl'
        } ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            {title}
          </h2>
          
          <div className="flex items-center gap-2">
            {showCopyButton && contentToCopy && (
              <button
                onClick={handleCopy}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title="Copy content"
              >
                {copied ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
              </button>
            )}
            
            {showDownloadButton && onDownload && (
              <button
                onClick={onDownload}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title={isFullScreen ? 'Windowed mode' : 'Full screen'}
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage full-screen modal state
 */
export function useFullScreenModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<{
    title: string;
    children: React.ReactNode;
    contentToCopy?: string;
  } | null>(null);

  const openModal = (modalContent: {
    title: string;
    children: React.ReactNode;
    contentToCopy?: string;
  }) => {
    setContent(modalContent);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setContent(null);
  };

  return {
    isOpen,
    content,
    openModal,
    closeModal,
  };
}

export default FullScreenModal;
