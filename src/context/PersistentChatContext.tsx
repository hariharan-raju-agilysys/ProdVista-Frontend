import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import api from '../services/api';
import { useAIChatHub, ChatStreamToken, HistoryMessage } from '../hooks/useAIChatHub';

// ============================================
// Types
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isError?: boolean;
  isStreaming?: boolean;
}

interface AISettings {
  provider: string;
  model: string;
  isConfigured: boolean;
}

interface PersistentChatState {
  messages: ChatMessage[];
  isMinimized: boolean;
  isExpanded: boolean;
  isProcessing: boolean;
  hasUnread: boolean;
  aiSettings: AISettings | null;
  signalRConnected: boolean;
}

interface PersistentChatContextValue extends PersistentChatState {
  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  toggleMinimize: () => void;
  toggleExpand: () => void;
  openChat: () => void;
  closeChat: () => void;
  markAsRead: () => void;
}

// ============================================
// Constants
// ============================================

const MAX_MESSAGES = 50; // Memory limit - keep last 50 messages
const NAVIGATION_PATTERN = '\\[\\[navigate:(\\/[^\\]]*)]\\]';
const ACTION_PATTERN = '\\[\\[action:([^\\]]+)\\]\\]';

// ============================================
// Context
// ============================================

const PersistentChatContext = createContext<PersistentChatContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface PersistentChatProviderProps {
  children: ReactNode;
}

export function PersistentChatProvider({ children }: PersistentChatProviderProps) {
  // Core state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);

  // Refs for streaming
  const streamingMessageIdRef = useRef<string | null>(null);

  // Clean action tags from display text
  const cleanActionTags = (content: string): string => {
    let cleaned = content;
    cleaned = cleaned.replace(new RegExp(NAVIGATION_PATTERN, 'g'), '');
    cleaned = cleaned.replace(new RegExp(ACTION_PATTERN, 'g'), '');
    return cleaned.trim();
  };

  // Parse and execute AI actions
  const parseAndExecuteActions = useCallback(async (content: string) => {
    const regex = new RegExp(ACTION_PATTERN, 'g');
    const matches = [...content.matchAll(regex)];

    for (const match of matches) {
      const actionStr = match[1];
      if (!actionStr) continue;

      const parts = actionStr.split('|');
      const actionName = parts[0];
      const parameters: Record<string, string> = {};

      for (let i = 1; i < parts.length; i++) {
        const [key, ...valueParts] = parts[i].split('=');
        if (key && valueParts.length > 0) {
          parameters[key.trim()] = valueParts.join('=').trim();
        }
      }

      try {
        const response = await api.post('/ai/actions/execute', {
          action: actionName,
          parameters
        });
        const result = response.data;

        if (result.success) {
          setMessages(prev => limitMessages([...prev, {
            id: `action-result-${Date.now()}`,
            role: 'assistant',
            content: `✅ **Action completed:** ${result.message}`,
            timestamp: new Date(),
            isStreaming: false
          }]));
        } else {
          setMessages(prev => limitMessages([...prev, {
            id: `action-error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ **Action failed:** ${result.message}`,
            timestamp: new Date(),
            isStreaming: false,
            isError: true
          }]));
        }
      } catch (error) {
        console.error('AI Action Error:', error);
      }
    }
  }, []);

  // Limit messages to prevent memory bloat
  const limitMessages = (msgs: ChatMessage[]): ChatMessage[] => {
    if (msgs.length > MAX_MESSAGES) {
      return msgs.slice(-MAX_MESSAGES);
    }
    return msgs;
  };

  // SignalR hook for streaming
  const {
    isConnected: signalRConnected,
    sendMessageStream,
  } = useAIChatHub({
    onStreamStart: () => {
      // Keep using frontend's ID
    },
    onToken: (token: ChatStreamToken) => {
      const currentId = streamingMessageIdRef.current;
      if (!currentId) return;

      setMessages(prev => prev.map(msg =>
        msg.id === currentId
          ? { ...msg, content: msg.content + token.content }
          : msg
      ));
    },
    onStreamComplete: async (_messageId, fullContent) => {
      const currentId = streamingMessageIdRef.current;
      if (!currentId) return;

      // Execute any actions
      await parseAndExecuteActions(fullContent || '');

      // Clean action tags
      const cleanedContent = cleanActionTags(fullContent || '').trim();

      if (!cleanedContent) {
        setMessages(prev => prev.filter(msg => msg.id !== currentId));
      } else {
        setMessages(prev => limitMessages(prev.map(msg =>
          msg.id === currentId
            ? { ...msg, content: cleanedContent, isStreaming: false }
            : msg
        )));
      }

      streamingMessageIdRef.current = null;
      setIsProcessing(false);
      
      // Mark as unread if minimized
      if (isMinimized) {
        setHasUnread(true);
      }
    },
    onStreamError: (error) => {
      const currentId = streamingMessageIdRef.current;
      if (!currentId) return;

      setMessages(prev => prev.map(msg =>
        msg.id === currentId
          ? { ...msg, content: error, isError: true, isStreaming: false }
          : msg
      ));
      streamingMessageIdRef.current = null;
      setIsProcessing(false);
    },
  });

  // Load AI settings on mount
  useEffect(() => {
    const loadAISettings = async () => {
      try {
        const response = await api.get('/ai/settings');
        const settings = response.data;
        setAiSettings({
          provider: settings.provider || 'Not configured',
          model: settings.model || 'Unknown',
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
    loadAISettings();
  }, []);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => limitMessages([...prev, userMessage, assistantMessage]));
    setIsProcessing(true);
    streamingMessageIdRef.current = assistantMessageId;

    // Build history for context (last 10 messages)
    const history: HistoryMessage[] = messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      if (signalRConnected) {
        await sendMessageStream(content, history);
      } else {
        // Fallback to REST API
        const response = await api.post('/ai/chat', {
          message: content,
          context: 'dashboard_assistant',
          history,
        });

        const responseContent = response.data.response || response.data.message || 'No response received.';
        await parseAndExecuteActions(responseContent);
        const cleanedContent = cleanActionTags(responseContent).trim();

        if (!cleanedContent) {
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
        } else {
          setMessages(prev => limitMessages(prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: cleanedContent, isStreaming: false }
              : msg
          )));
        }

        streamingMessageIdRef.current = null;
        setIsProcessing(false);

        if (isMinimized) {
          setHasUnread(true);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: 'Failed to get response. Please try again.', isError: true, isStreaming: false }
          : msg
      ));
      streamingMessageIdRef.current = null;
      setIsProcessing(false);
    }
  }, [messages, isProcessing, signalRConnected, sendMessageStream, parseAndExecuteActions, isMinimized]);

  // Actions
  const clearMessages = useCallback(() => {
    setMessages([]);
    setHasUnread(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(prev => !prev);
    if (isMinimized) {
      setHasUnread(false);
    }
  }, [isMinimized]);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const openChat = useCallback(() => {
    setIsMinimized(false);
    setHasUnread(false);
  }, []);

  const closeChat = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const markAsRead = useCallback(() => {
    setHasUnread(false);
  }, []);

  const value: PersistentChatContextValue = {
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
    openChat,
    closeChat,
    markAsRead,
  };

  return (
    <PersistentChatContext.Provider value={value}>
      {children}
    </PersistentChatContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function usePersistentChat() {
  const context = useContext(PersistentChatContext);
  if (!context) {
    throw new Error('usePersistentChat must be used within PersistentChatProvider');
  }
  return context;
}
