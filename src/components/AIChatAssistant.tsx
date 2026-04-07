import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageCircle, X, Send, Sparkles, Minimize2, Maximize2, 
  Bot, User, AlertCircle, Trash2,
  ExternalLink, Wifi, WifiOff
} from 'lucide-react';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import { useAIChatHub, ChatStreamToken, HistoryMessage } from '../hooks/useAIChatHub';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isError?: boolean;
  isStreaming?: boolean;
}

interface AIChatAssistantProps {
  className?: string;
}

// Clean processing indicator — shimmer bar style
function ThinkingIndicator({ isStreaming }: { isStreaming: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 w-36">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
        <span className="font-medium">{isStreaming ? 'Generating...' : 'Thinking...'}</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" style={{ animation: 'shimmer 1.5s ease-in-out infinite' }} />
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" style={{ animation: 'shimmer 1.5s ease-in-out infinite 150ms' }} />
        </div>
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

/**
 * AI Chat Assistant - Fixed position at bottom right.
 * Uses SignalR for real-time streaming responses (OpenAI-like experience).
 * Falls back to REST API if SignalR is unavailable.
 */
export function AIChatAssistant({ className }: AIChatAssistantProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<{
    provider: string;
    model: string;
    isConfigured: boolean;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref to track current streaming message ID (avoids closure issues with server's different ID)
  const streamingMessageIdRef = useRef<string | null>(null);
  
  // Pattern definitions
  const NAVIGATION_PATTERN = '\\[\\[navigate:(\\/[^\\]]*)]\\]';
  const ACTION_PATTERN = '\\[\\[action:([^\\]]+)\\]\\]';
  
  // Parse and execute AI actions
  const parseAndExecuteActions = useCallback(async (content: string) => {
    const regex = new RegExp(ACTION_PATTERN, 'g');
    const matches = [...content.matchAll(regex)];
    
    for (const match of matches) {
      const actionStr = match[1];
      if (!actionStr) continue;
      
      // Parse action: action_name|param1=value1|param2=value2
      const parts = actionStr.split('|');
      const actionName = parts[0];
      const parameters: Record<string, string> = {};
      
      for (let i = 1; i < parts.length; i++) {
        const [key, ...valueParts] = parts[i].split('=');
        if (key && valueParts.length > 0) {
          parameters[key.trim()] = valueParts.join('=').trim();
        }
      }
      
      console.log('AI Action: Executing', actionName, parameters);
      
      try {
        const response = await api.post('/ai/actions/execute', {
          action: actionName,
          parameters
        });
        
        const result = response.data;
        console.log('AI Action Result:', result);
        
        // Show result message
        if (result.success) {
          setMessages(prev => [...prev, {
            id: `action-result-${Date.now()}`,
            role: 'assistant' as const,
            content: `✅ **Action completed:** ${result.message}`,
            timestamp: new Date(),
            isStreaming: false
          }]);
        } else {
          setMessages(prev => [...prev, {
            id: `action-error-${Date.now()}`,
            role: 'assistant' as const,
            content: `⚠️ **Action failed:** ${result.message}`,
            timestamp: new Date(),
            isStreaming: false,
            isError: true
          }]);
        }
        
        return result;
      } catch (error) {
        console.error('AI Action Error:', error);
        setMessages(prev => [...prev, {
          id: `action-error-${Date.now()}`,
          role: 'assistant' as const,
          content: `❌ **Action error:** Failed to execute ${actionName}`,
          timestamp: new Date(),
          isStreaming: false,
          isError: true
        }]);
      }
    }
    return null;
  }, []);
  
  // Parse navigation actions from AI response and execute them
  const parseAndExecuteNavigation = useCallback((content: string) => {
    // Create fresh regex instance to avoid lastIndex issues
    const regex = new RegExp(NAVIGATION_PATTERN, 'g');
    const matches = content.matchAll(regex);
    for (const match of matches) {
      const path = match[1];
      if (path) {
        console.log('AI Navigation: Found navigation action, navigating to', path);
        // Small delay to allow user to see the message before navigation
        setTimeout(() => {
          console.log('AI Navigation: Executing navigation to', path);
          navigate(path);
        }, 500);
        return path; // Return first navigation found
      }
    }
    console.log('AI Navigation: No navigation actions found in:', content.substring(0, 200));
    return null;
  }, [navigate]);
  
  // Remove navigation and action tags from display text
  const cleanActionTags = (content: string): string => {
    let cleaned = content;
    cleaned = cleaned.replace(new RegExp(NAVIGATION_PATTERN, 'g'), '');
    cleaned = cleaned.replace(new RegExp(ACTION_PATTERN, 'g'), '');
    return cleaned.trim();
  };
  
  // cleanNavigationActions is now replaced by cleanActionTags (handles both navigation and actions)

  // Use SignalR hook for streaming
  const {
    isConnected: signalRConnected,
    sendMessageStream,
  } = useAIChatHub({
    onStreamStart: () => {
      // Don't overwrite streamingMessageId - keep using the frontend's ID stored in ref
      // Server sends its own ID but we track by frontend ID
    },
    onToken: (token: ChatStreamToken) => {
      // Use ref to get current frontend message ID (avoids stale closure)
      const currentId = streamingMessageIdRef.current;
      if (!currentId) return;
      
      // Append token to the streaming message
      setMessages(prev => prev.map(msg => 
        msg.id === currentId
          ? { ...msg, content: msg.content + token.content }
          : msg
      ));
    },
    onStreamComplete: async (_messageId, fullContent) => {
      // Use ref for frontend ID instead of server's messageId
      const currentId = streamingMessageIdRef.current;
      if (!currentId) return;
      
      // Check for navigation actions and execute them
      parseAndExecuteNavigation(fullContent || '');
      
      // Check for AI actions and execute them
      await parseAndExecuteActions(fullContent || '');
      
      // Clean action tags from displayed content
      const cleanedContent = cleanActionTags(fullContent || '').trim();
      
      // If cleaned content is empty (was all action tags), remove the message
      // Otherwise update it with the cleaned content
      if (!cleanedContent) {
        setMessages(prev => prev.filter(msg => msg.id !== currentId));
      } else {
        setMessages(prev => prev.map(msg =>
          msg.id === currentId
            ? { ...msg, content: cleanedContent, isStreaming: false }
            : msg
        ));
      }
      streamingMessageIdRef.current = null;
      setStreamingMessageId(null);
      setIsLoading(false);
    },
    onStreamError: (error) => {
      // Use ref for frontend ID instead of server's messageId
      const currentId = streamingMessageIdRef.current;
      if (!currentId) return;
      
      setMessages(prev => prev.map(msg =>
        msg.id === currentId
          ? { ...msg, content: error, isError: true, isStreaming: false }
          : msg
      ));
      streamingMessageIdRef.current = null;
      setStreamingMessageId(null);
      setIsLoading(false);
    },
  });

  // Load AI settings on mount
  useEffect(() => {
    loadAISettings();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const loadAISettings = async () => {
    try {
      const response = await api.get('/ai/settings');
      const settings = response.data;
      setAiSettings({
        provider: settings.provider || 'Not configured',
        model: settings.model || 'Unknown',
        // Use server's isConfigured flag
        isConfigured: settings.isConfigured,
      });
    } catch (err) {
      console.warn('Could not load AI settings:', err);
      setAiSettings({
        provider: 'Not configured',
        model: 'Unknown',
        isConfigured: false,
      });
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    // Create placeholder for assistant response
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingMessageId(assistantMessageId);
    streamingMessageIdRef.current = assistantMessageId; // Store in ref for callbacks

    // Build history for context
    const history: HistoryMessage[] = messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      if (signalRConnected) {
        // Use SignalR streaming for real-time response
        await sendMessageStream(userMessage.content, history);
      } else {
        // Fallback to REST API if SignalR is not connected
        const response = await api.post('/ai/chat', {
          message: userMessage.content,
          context: 'dashboard_assistant',
          history,
        });

        const responseContent = response.data.response || response.data.message || 'No response received.';
        
        // Check for navigation actions and execute them
        parseAndExecuteNavigation(responseContent);
        
        // Check for AI actions and execute them
        await parseAndExecuteActions(responseContent);
        
        // Clean all action tags from displayed content
        const cleanedContent = cleanActionTags(responseContent).trim();

        // If cleaned content is empty (was all action tags), remove the message
        // Otherwise update it with the cleaned content
        if (!cleanedContent) {
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: cleanedContent,
                  isStreaming: false,
                }
              : msg
          ));
        }
        streamingMessageIdRef.current = null;
        setStreamingMessageId(null);
        setIsLoading(false);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response';
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: errorMsg,
              isError: true,
              isStreaming: false,
            }
          : msg
      ));
      streamingMessageIdRef.current = null;
      setStreamingMessageId(null);
      setIsLoading(false);
    }
  }, [input, isLoading, messages, signalRConnected, sendMessageStream, parseAndExecuteNavigation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Chat button (when closed)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          'fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg',
          'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700',
          'text-white transition-all duration-300 hover:scale-110',
          'flex items-center justify-center',
          className
        )}
        title="Open AI Assistant"
      >
        <MessageCircle className="w-6 h-6" />
        <Sparkles className="w-3 h-3 absolute -top-1 -right-1 text-yellow-300" />
      </button>
    );
  }

  // Chat window
  return (
    <div
      className={clsx(
        'fixed z-50 bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-all duration-300',
        isExpanded
          ? 'inset-4 rounded-2xl'
          : 'bottom-6 right-6 w-96 h-[500px] rounded-2xl',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              AI Assistant
              {signalRConnected ? (
                <span title="Real-time connected">
                  <Wifi className="w-3 h-3 text-green-300" />
                </span>
              ) : (
                <span title="Using REST API">
                  <WifiOff className="w-3 h-3 text-yellow-300" />
                </span>
              )}
            </h3>
            <p className="text-xs text-blue-100">
              {aiSettings?.isConfigured 
                ? `${aiSettings.provider} • ${aiSettings.model}${signalRConnected ? ' • Streaming' : ''}`
                : 'Not configured'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            title={isExpanded ? 'Minimize' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Not configured warning */}
      {!aiSettings?.isConfigured && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">AI not configured.</span>
            <button 
              onClick={() => navigate('/settings')} 
              className="text-sm font-medium underline flex items-center gap-1 hover:text-amber-800"
            >
              Configure <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              Ask me anything about your dashboard, data, or Azure resources.
            </p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
              I can create widgets, navigate pages, and query Azure data.
            </p>
            <div className="mt-4 space-y-2">
              {[
                { text: 'Create a CPU usage chart widget', icon: '📊' },
                { text: 'Show me error trends from App Insights', icon: '🔍' },
                { text: 'Create a widget showing failed requests', icon: '⚠️' },
                { text: 'Add an active alerts widget to my dashboard', icon: '🔔' },
                { text: 'Go to Azure dashboard', icon: '☁️' },
                { text: 'Show me the logs', icon: '📋' },
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion.text)}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="mr-2">{suggestion.icon}</span>
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div
              className={clsx(
                'max-w-[85%] px-4 py-2 rounded-2xl overflow-hidden',
                message.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : message.isError
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-bl-sm'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-bl-sm'
              )}
            >
              {message.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              ) : (
                <div className="text-sm prose prose-sm dark:prose-invert max-w-none break-words
                  prose-p:my-1 prose-p:leading-relaxed
                  prose-headings:mt-3 prose-headings:mb-1 prose-headings:font-semibold
                  prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
                  prose-ul:my-1 prose-ul:pl-4 prose-ol:my-1 prose-ol:pl-4
                  prose-li:my-0.5
                  prose-code:bg-gray-200 dark:prose-code:bg-slate-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-gray-900 dark:prose-pre:bg-slate-950 prose-pre:p-3 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:my-2
                  prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1
                  prose-a:text-blue-500 hover:prose-a:text-blue-600
                  prose-blockquote:border-l-2 prose-blockquote:border-blue-400 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:my-2
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                  {message.isStreaming && message.content && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-gradient-to-t from-blue-500 to-indigo-500 rounded-sm animate-pulse" />
                  )}
                </div>
              )}
              {!message.isStreaming && (
                <p className={clsx(
                  'text-[10px] mt-1',
                  message.role === 'user' ? 'text-blue-200' : 'text-gray-400 dark:text-slate-500'
                )}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-slate-600 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600 dark:text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {isLoading && !streamingMessageId && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center animate-pulse">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm">
              <ThinkingIndicator isStreaming={signalRConnected} />
            </div>
          </div>
        )}

        {/* Show streaming indicator when content is being received */}
        {streamingMessageId && messages.find(m => m.id === streamingMessageId && m.content === '') && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="bg-gray-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm">
              <ThinkingIndicator isStreaming={true} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={aiSettings?.isConfigured ? "Ask anything..." : "Configure AI first..."}
            disabled={!aiSettings?.isConfigured || isLoading}
            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-full text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || !aiSettings?.isConfigured}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChatAssistant;
