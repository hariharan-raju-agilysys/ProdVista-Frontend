import { useState, useRef, useEffect } from 'react';
import {
  Bot, Send, Sparkles, Minimize2, Maximize2,
  User, AlertCircle, Trash2, Wifi, WifiOff,
  MessageCircle, ChevronUp, ChevronDown
} from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { usePersistentChat, type ChatMessage } from '../context/PersistentChatContext';

// ============================================
// Thinking Indicator
// ============================================

function ThinkingIndicator({ isStreaming }: { isStreaming: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 w-36">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
        <span className="font-medium">{isStreaming ? 'Generating...' : 'Thinking...'}</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shimmer-animation" />
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shimmer-animation-delayed" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Message Bubble
// ============================================

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming && !message.content;

  return (
    <div className={clsx('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={clsx(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
          isUser
            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
            : message.isError
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50'
            : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-100 dark:border-slate-700 shadow-sm'
        )}
      >
        {isStreaming ? (
          <ThinkingIndicator isStreaming={!!message.isStreaming} />
        ) : message.isError ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{message.content}</span>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Widget Component
// ============================================

export default function PersistentChatWidget() {
  const {
    messages,
    isMinimized,
    isExpanded,
    isProcessing,
    hasUnread,
    aiSettings,
    signalRConnected,
    sendMessage,
    clearMessages,
    toggleMinimize,
    toggleExpand,
  } = usePersistentChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (!isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Minimized widget (bottom bar) - positioned left of FAB
  if (isMinimized) {
    return (
      <button
        onClick={toggleMinimize}
        className={clsx(
          'fixed bottom-6 right-24 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-all duration-300',
          'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500',
          'text-white font-medium text-sm',
          hasUnread && 'animate-bounce'
        )}
      >
        <div className="relative">
          <MessageCircle className="w-5 h-5" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </div>
        <span className="max-w-[150px] truncate">
          {isProcessing ? (
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Processing...
            </span>
          ) : hasUnread ? (
            'New message!'
          ) : messages.length > 0 ? (
            'Chat active'
          ) : (
            'AI Assistant'
          )}
        </span>
        <ChevronUp className="w-4 h-4" />
      </button>
    );
  }

  // Expanded chat panel
  const panelHeight = isExpanded ? 'h-[80vh]' : 'h-[400px]';
  const panelWidth = isExpanded ? 'w-[600px]' : 'w-[380px]';

  return (
    <div
      className={clsx(
        'fixed bottom-4 right-4 z-[100] flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-all duration-300',
        'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700',
        panelHeight,
        panelWidth
      )}
    >
      {/* Header */}
      <div className="shrink-0 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <div>
            <h3 className="text-sm font-semibold">AI Assistant</h3>
            <div className="flex items-center gap-1.5 text-[10px] text-white/70">
              {signalRConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-300" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-300" />
                  <span>REST Mode</span>
                </>
              )}
              {aiSettings?.model && <span>• {aiSettings.model}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleExpand}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Minimize"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-950/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-slate-400">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-violet-500" />
            </div>
            <h4 className="font-medium text-gray-700 dark:text-slate-300">How can I help?</h4>
            <p className="text-xs mt-1 max-w-[200px]">
              Ask questions, run queries, or get help with anything.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 p-3 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isProcessing}
            className={clsx(
              'flex-1 px-4 py-2 rounded-full text-sm',
              'bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700',
              'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
              'placeholder-gray-400 dark:placeholder-slate-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className={clsx(
              'p-2.5 rounded-full transition-all',
              input.trim() && !isProcessing
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <Sparkles className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-gray-400 dark:text-slate-500">
          <span>Press Enter to send</span>
          <span>{messages.length} messages</span>
        </div>
      </div>

      {/* Shimmer animation styles */}
      <style>{`
        .shimmer-animation {
          animation: shimmer 1.5s ease-in-out infinite;
        }
        .shimmer-animation-delayed {
          animation: shimmer 1.5s ease-in-out infinite 150ms;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
