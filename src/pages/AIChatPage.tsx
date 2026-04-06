import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, Sparkles, Bot, User, AlertCircle, Trash2,
  ExternalLink, Wifi, WifiOff, Zap, Settings,
  MessageSquare, Clock, Copy, Check, RefreshCw,
  ThumbsUp, ThumbsDown, Search, History, ChevronDown, 
  Lightbulb, Terminal, Database, Activity, Server, Bookmark, 
  Download, Keyboard, X, PanelLeftClose, PanelLeft,
  RotateCcw, Star, Folder, ArrowRight, Layers, Users
} from 'lucide-react';
import clsx from 'clsx';
import api from '../services/api';
import engineeringService from '../services/engineeringService';
import { useAIChatHub, ChatStreamToken, HistoryMessage, AzureQueryInfo, DevOpsContextInfo, CustomerContextInfo, JenkinsContextInfo, PipelineStepInfo } from '../hooks/useAIChatHub';

// Quick action categories
const QUICK_ACTION_CATEGORIES = [
  {
    name: 'Azure Insights',
    icon: '☁️',
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-400',
    bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30',
    borderColor: 'border-blue-200/60 dark:border-blue-800/40',
    actions: [
      { label: 'Azure Resources', prompt: 'What Azure resources are available?', icon: <Database className="w-4 h-4" />, desc: 'List and explore cloud resources' },
      { label: 'Service Health', prompt: 'Show me the health status of my services', icon: <Activity className="w-4 h-4" />, desc: 'Check uptime & availability' },
      { label: 'Long Running Jobs', prompt: 'Are there any long running jobs for my services?', icon: <Clock className="w-4 h-4" />, desc: 'Detect slow operations' },
    ]
  },
  {
    name: 'Monitoring',
    icon: '📊',
    color: 'purple',
    gradient: 'from-purple-500 to-pink-400',
    bgGradient: 'from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30',
    borderColor: 'border-purple-200/60 dark:border-purple-800/40',
    actions: [
      { label: 'Recent Errors', prompt: 'Show me errors from the last 24 hours', icon: <AlertCircle className="w-4 h-4" />, desc: 'Exceptions & error logs' },
      { label: 'Dashboard Metrics', prompt: 'Give me an overview of my dashboard metrics', icon: <Activity className="w-4 h-4" />, desc: 'KPIs & performance overview' },
      { label: 'Performance Stats', prompt: 'Show me performance statistics', icon: <Zap className="w-4 h-4" />, desc: 'Response times & throughput' },
    ]
  },
  {
    name: 'Navigation',
    icon: '🧭',
    color: 'green',
    gradient: 'from-emerald-500 to-teal-400',
    bgGradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
    borderColor: 'border-emerald-200/60 dark:border-emerald-800/40',
    actions: [
      { label: 'Settings', prompt: 'Take me to the settings page', icon: <Settings className="w-4 h-4" />, desc: 'App configuration' },
      { label: 'Dashboards', prompt: 'Show me my dashboards', icon: <Folder className="w-4 h-4" />, desc: 'All dashboard views' },
      { label: 'Resources', prompt: 'Take me to resource management', icon: <Server className="w-4 h-4" />, desc: 'Manage platform resources' },
    ]
  }
];

// Sample prompts for empty state
const SAMPLE_PROMPTS = [
  { text: 'What Azure resources do I have?', icon: '☁️', tag: 'Azure' },
  { text: 'Show me recent errors', icon: '⚠️', tag: 'Monitoring' },
  { text: 'Check long running jobs', icon: '⏱️', tag: 'Performance' },
  { text: 'Navigate to settings', icon: '⚙️', tag: 'Navigation' },
  { text: 'Show build success rate', icon: '🔨', tag: 'DevOps' },
  { text: 'Analyze service dependencies', icon: '🔗', tag: 'Insights' },
];

// Capability / tool keys that auto-populate status
interface ToolCapability {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  checkKey: 'ai' | 'azure' | 'signalr' | 'devops';
  color: string;
}

const TOOL_CAPABILITIES: ToolCapability[] = [
  { id: 'ai-provider', name: 'AI / LLM', description: 'GPT model for natural language processing', icon: <Sparkles className="w-4 h-4" />, checkKey: 'ai', color: 'purple' },
  { id: 'azure-insights', name: 'App Insights', description: 'Azure Application Insights data queries', icon: <Database className="w-4 h-4" />, checkKey: 'azure', color: 'blue' },
  { id: 'realtime', name: 'Real-time Stream', description: 'SignalR streaming for live responses', icon: <Zap className="w-4 h-4" />, checkKey: 'signalr', color: 'green' },
  { id: 'devops', name: 'Azure DevOps', description: 'Work items, builds & PR analysis', icon: <Terminal className="w-4 h-4" />, checkKey: 'devops', color: 'indigo' },
];

// Suggestion prompts
const SUGGESTIONS = [
  { trigger: 'show', suggestions: ['Show me recent errors', 'Show Azure resources', 'Show dashboard metrics'] },
  { trigger: 'how', suggestions: ['How many errors occurred today?', 'How is my service performing?', 'How do I create a dashboard?'] },
  { trigger: 'what', suggestions: ['What Azure resources are available?', 'What caused recent failures?', 'What is the current status?'] },
  { trigger: 'help', suggestions: ['Help me understand this error', 'Help me configure AI settings', 'Help with dashboard creation'] },
];

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isError?: boolean;
  isStreaming?: boolean;
  feedback?: 'positive' | 'negative';
  isBookmarked?: boolean;
  azureQueryInfo?: AzureQueryInfo;
  devOpsContext?: DevOpsContextInfo;
  customerContext?: CustomerContextInfo;
  jenkinsContext?: JenkinsContextInfo;
}

interface ConversationHistory {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
}

// Dynamic processing pipeline — shows real steps based on request type
function ProcessingPipeline({ steps, statusMessage, isStreaming }: { steps: PipelineStepInfo[]; statusMessage?: string; isStreaming: boolean }) {
  if (steps.length === 0) {
    // Fallback: simple shimmer when no pipeline info yet
    return (
      <div className="flex flex-col gap-2 w-56">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
          <span className="font-medium">{statusMessage || (isStreaming ? 'Generating...' : 'Thinking...')}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[220px]">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-2 text-xs">
          {step.status === 'done' && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
          {step.status === 'active' && <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse shrink-0" />}
          {step.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-slate-600 shrink-0" />}
          {step.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
          {step.status === 'skipped' && <div className="w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-slate-600 shrink-0" />}
          <span className={clsx(
            'transition-colors duration-200',
            step.status === 'done' && 'text-green-600 dark:text-green-400',
            step.status === 'active' && 'text-indigo-600 dark:text-indigo-400 font-medium',
            step.status === 'pending' && 'text-gray-400 dark:text-slate-500',
            step.status === 'error' && 'text-red-500',
            step.status === 'skipped' && 'text-gray-400 dark:text-slate-500 line-through',
          )}>
            {step.label}
          </span>
          {step.status === 'active' && (
            <div className="flex-1 h-1 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden ml-1">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-shimmer" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Code block component with syntax-aware styling
const CodeBlock = memo(function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(code.split('\n').length > 15);
  const isKql = language === 'kql' || language === 'kusto';

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayCode = collapsed ? code.split('\n').slice(0, 10).join('\n') + '\n...' : code;

  return (
    <div className={clsx(
      'relative group my-3 rounded-xl overflow-hidden border',
      isKql
        ? 'bg-blue-950 border-blue-800/50'
        : 'bg-gray-900 dark:bg-slate-950 border-gray-700/50 dark:border-slate-800'
    )}>
      <div className={clsx(
        'flex items-center justify-between px-4 py-2 border-b',
        isKql
          ? 'bg-blue-900/60 border-blue-800/50'
          : 'bg-gray-800 dark:bg-slate-900 border-gray-700/50'
      )}>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {isKql ? <Database className="w-3.5 h-3.5 text-blue-400" /> : <Terminal className="w-3.5 h-3.5" />}
          <span className={isKql ? 'text-blue-300 font-medium' : ''}>{isKql ? 'KQL Query' : (language || 'code')}</span>
        </div>
        <div className="flex items-center gap-1">
          {code.split('\n').length > 15 && (
            <button onClick={() => setCollapsed(!collapsed)} className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed text-gray-300 font-mono">
        <code>{displayCode}</code>
      </pre>
    </div>
  );
});

// Render a markdown table into a styled HTML table
const MarkdownTable = memo(function MarkdownTable({ header, rows }: { header: string[]; rows: string[][] }) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (col: number) => {
    if (sortCol === col) { setSortAsc(!sortAsc); } else { setSortCol(col); setSortAsc(true); }
  };

  const sorted = useMemo(() => {
    if (sortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [rows, sortCol, sortAsc]);

  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-slate-800/80">
            {header.map((h, i) => (
              <th key={i} onClick={() => handleSort(i)} className="cursor-pointer select-none px-3 py-2 text-left font-semibold text-gray-700 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  {h.trim()}
                  {sortCol === i && <span className="text-blue-500">{sortAsc ? '↑' : '↓'}</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
          {sorted.map((row, ri) => (
            <tr key={ri} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/40 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-gray-600 dark:text-slate-400 whitespace-nowrap">{cell.trim()}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

// Pre-compiled regex patterns — avoid recompilation per render
const CODE_BLOCK_REGEX = /```(\w+)?\n?([\s\S]*?)```/g;
const HEADING_REGEX = /^(#{1,4})\s+(.+)$/;
const HR_REGEX = /^---+$/;
const NUMBERED_LIST_REGEX = /^\d+[\.)\s]+/;
const BULLET_LIST_REGEX = /^[•\-\*]\s+/;
const BOLD_REGEX = /\*\*(.+?)\*\*/g;
const ITALIC_REGEX = /\*(.+?)\*/g;
const INLINE_CODE_REGEX = /`([^`]+)`/g;
const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

// Parse and render message content — clean prose with proper typography
const RenderContent = memo(function RenderContent({ content }: { content: string }) {
  const parseContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    const remaining = text;
    let keyIdx = 0;

    // Split on code blocks first
    const codeBlockRegex = new RegExp(CODE_BLOCK_REGEX.source, 'g');
    let match;
    let lastIndex = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={keyIdx++}>{parseBlocks(text.slice(lastIndex, match.index))}</span>);
      }
      parts.push(<CodeBlock key={keyIdx++} code={match[2].trim()} language={match[1]} />);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={keyIdx++}>{parseBlocks(text.slice(lastIndex))}</span>);
    }

    if (parts.length === 0) {
      remaining; // unused
      return parseBlocks(text);
    }
    return parts;
  };

  // Parse block-level elements: headings, tables, horizontal rules, numbered/bullet lists, paragraphs
  const parseBlocks = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let keyIdx = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Horizontal rule
      if (HR_REGEX.test(line.trim())) {
        elements.push(<hr key={keyIdx++} className="my-4 border-gray-200 dark:border-slate-700" />);
        i++;
        continue;
      }

      // Headings — render as clean styled text, not raw ##
      const headingMatch = line.match(HEADING_REGEX);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        const cls = level === 1
          ? 'text-lg font-bold text-gray-900 dark:text-white mt-4 mb-2'
          : level === 2
            ? 'text-base font-semibold text-gray-800 dark:text-slate-200 mt-3 mb-1.5'
            : level === 3
              ? 'text-sm font-semibold text-gray-700 dark:text-slate-300 mt-2 mb-1'
              : 'text-sm font-medium text-gray-600 dark:text-slate-400 mt-2 mb-1';
        elements.push(<div key={keyIdx++} className={cls}>{parseInline(headingText)}</div>);
        i++;
        continue;
      }

      // Table detection: |...|
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        if (tableLines.length >= 2) {
          const parseRow = (r: string) => r.split('|').slice(1, -1).map(c => c.trim());
          const header = parseRow(tableLines[0]);
          // Skip separator line (|---|---|)
          const startRow = tableLines[1].includes('---') ? 2 : 1;
          const rows = tableLines.slice(startRow).map(parseRow);
          elements.push(<MarkdownTable key={keyIdx++} header={header} rows={rows} />);
        }
        continue;
      }

      // Numbered list
      if (/^\d+[\.\)]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+[\.\)]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\d+[\.\)]\s+/, ''));
          i++;
        }
        elements.push(
          <ol key={keyIdx++} className="my-2 ml-1 space-y-1.5">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-gray-700 dark:text-slate-300 leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center justify-center mt-0.5">{idx + 1}</span>
                <span className="flex-1">{parseInline(item)}</span>
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Bullet list
      if (BULLET_LIST_REGEX.test(line)) {
        const items: string[] = [];
        while (i < lines.length && BULLET_LIST_REGEX.test(lines[i])) {
          items.push(lines[i].replace(BULLET_LIST_REGEX, ''));
          i++;
        }
        elements.push(
          <ul key={keyIdx++} className="my-2 ml-1 space-y-1">
            {items.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-gray-700 dark:text-slate-300 leading-relaxed">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mt-2" />
                <span className="flex-1">{parseInline(item)}</span>
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Regular paragraph — collect contiguous non-empty lines
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].match(HEADING_REGEX) && !lines[i].trim().startsWith('|') && !BULLET_LIST_REGEX.test(lines[i]) && !NUMBERED_LIST_REGEX.test(lines[i]) && !HR_REGEX.test(lines[i].trim())) {
        paraLines.push(lines[i]);
        i++;
      }
      if (paraLines.length > 0) {
        elements.push(
          <p key={keyIdx++} className="my-1.5 text-gray-700 dark:text-slate-300 leading-relaxed">
            {parseInline(paraLines.join(' '))}
          </p>
        );
      }
    }

    return elements;
  };

  // Parse inline formatting: bold, italic, inline code, links, emoji shortcuts
  const parseInline = (text: string): React.ReactNode => {
    // Build HTML string with inline formatting
    let html = text;
    // Bold
    html = html.replace(BOLD_REGEX, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>');
    // Italic
    html = html.replace(ITALIC_REGEX, '<em>$1</em>');
    // Inline code
    html = html.replace(INLINE_CODE_REGEX, '<code class="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700/80 rounded text-[0.85em] font-mono text-pink-600 dark:text-pink-400 border border-gray-200 dark:border-slate-600">$1</code>');
    // Links
    html = html.replace(LINK_REGEX, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-2 transition-colors">$1</a>');

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const rendered = useMemo(() => parseContent(content), [content]);

  return (
    <div className="max-w-none text-[0.9375rem] leading-relaxed" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      {rendered}
    </div>
  );
});

// Follow-up suggestion chips based on query type
function getFollowUpSuggestions(queryInfo: AzureQueryInfo): string[] {
  const suggestions: string[] = [];
  const qt = queryInfo.queryType?.toLowerCase() || '';
  
  if (qt.includes('exception') || qt.includes('error')) {
    suggestions.push('Show me related traces for these errors');
    suggestions.push('Which services are most affected?');
    suggestions.push('Show error trends over the last 7 days');
  } else if (qt.includes('request') || qt.includes('long_running')) {
    suggestions.push('Show failed requests in the same period');
    suggestions.push('What are the slowest endpoints?');
    suggestions.push('Show dependency calls for slow requests');
  } else if (qt.includes('dependencies') || qt.includes('dependency')) {
    suggestions.push('Show failed dependency calls');
    suggestions.push('Which services have the highest latency?');
    suggestions.push('Show related exceptions for failed dependencies');
  } else if (qt.includes('trace')) {
    suggestions.push('Show errors associated with these traces');
    suggestions.push('Filter traces by a specific service');
  } else if (qt.includes('availability')) {
    suggestions.push('Show availability trends this week');
    suggestions.push('Which regions have the lowest availability?');
  }

  if (suggestions.length === 0) {
    suggestions.push('Show me related errors');
    suggestions.push('What other issues exist?');
    suggestions.push('Show performance trends');
  }
  return suggestions.slice(0, 3);
}

// Azure Query Info card with KQL, portal link, follow-up suggestions
const AzureQueryCard = memo(function AzureQueryCard({ queryInfo, onFollowUp }: { queryInfo: AzureQueryInfo; onFollowUp?: (prompt: string) => void }) {
  const [showKql, setShowKql] = useState(false);
  const [kqlCopied, setKqlCopied] = useState(false);
  const followUps = getFollowUpSuggestions(queryInfo);

  const handleCopyKql = () => {
    if (queryInfo.generatedKql) {
      navigator.clipboard.writeText(queryInfo.generatedKql);
      setKqlCopied(true);
      setTimeout(() => setKqlCopied(false), 2000);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-200 dark:border-blue-800/50 overflow-hidden bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/40 dark:to-slate-800/40">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-blue-100/60 dark:bg-blue-900/30 border-b border-blue-200/60 dark:border-blue-800/40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center">
            <Database className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">Azure Application Insights</span>
        </div>
        <div className="flex items-center gap-2">
          {(queryInfo.rowCount ?? 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-200/70 dark:bg-blue-800/50 text-xs font-medium text-blue-700 dark:text-blue-300">
              {queryInfo.rowCount} records
            </span>
          )}
        </div>
      </div>

      {/* Metadata pills */}
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-2">
        {queryInfo.queryType && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-xs font-medium text-blue-700 dark:text-blue-300">
            <Activity className="w-3 h-3" />
            {queryInfo.queryType.replace(/_/g, ' ')}
          </span>
        )}
        {queryInfo.serviceName && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-xs font-medium text-purple-700 dark:text-purple-300">
            <Server className="w-3 h-3" />
            {queryInfo.serviceName}
          </span>
        )}
        {queryInfo.region && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-xs font-medium text-green-700 dark:text-green-300">
            <Layers className="w-3 h-3" />
            {queryInfo.region}
          </span>
        )}
      </div>

      {/* Actions row */}
      <div className="px-4 py-2 flex flex-wrap items-center gap-2 border-t border-blue-100 dark:border-blue-800/30">
        {queryInfo.azurePortalLink && (
          <a
            href={queryInfo.azurePortalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <ExternalLink className="w-3 h-3" />
            Open in Azure Portal
          </a>
        )}
        {queryInfo.generatedKql && (
          <button
            onClick={() => setShowKql(!showKql)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            <Terminal className="w-3 h-3" />
            {showKql ? 'Hide KQL' : 'View KQL'}
          </button>
        )}
      </div>

      {/* Collapsible KQL */}
      {showKql && queryInfo.generatedKql && (
        <div className="mx-4 mb-3 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-800/50">
          <div className="flex items-center justify-between px-3 py-1.5 bg-blue-900/80 text-xs">
            <span className="text-blue-300 font-medium">Generated KQL</span>
            <button onClick={handleCopyKql} className="text-blue-400 hover:text-white transition-colors flex items-center gap-1">
              {kqlCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              {kqlCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 bg-blue-950 text-blue-200 text-xs font-mono overflow-x-auto leading-relaxed">
            {queryInfo.generatedKql}
          </pre>
        </div>
      )}

      {/* Follow-up suggestions */}
      {onFollowUp && followUps.length > 0 && (
        <div className="px-4 py-2.5 border-t border-blue-100 dark:border-blue-800/30">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1.5 block">Related searches</span>
          <div className="flex flex-wrap gap-1.5">
            {followUps.map((s, i) => (
              <button
                key={i}
                onClick={() => onFollowUp(s)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 transition-all"
              >
                <Search className="w-3 h-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// State badge colors for DevOps work items
const STATE_COLORS: Record<string, string> = {
  'New': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Active': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Resolved': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Closed': 'bg-gray-100 text-gray-600 dark:bg-slate-700/40 dark:text-slate-400',
  'Removed': 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
};
const TYPE_ICONS: Record<string, string> = { 'Bug': '🐛', 'Task': '📋', 'User Story': '📖', 'Feature': '🚀', 'Epic': '🏔️' };

// DevOps Work Items card with drill-down, sort, and portal links
const DevOpsWorkItemsCard = memo(function DevOpsWorkItemsCard({ context, onFollowUp }: { context: DevOpsContextInfo; onFollowUp?: (prompt: string) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'title' | 'state'>('priority');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');

  const items = context.workItems;
  const types = useMemo(() => [...new Set(items.map(i => i.workItemType))], [items]);
  const states = useMemo(() => [...new Set(items.map(i => i.state))], [items]);

  const sorted = useMemo(() => {
    const filtered = items
      .filter(i => filterType === 'all' || i.workItemType === filterType)
      .filter(i => filterState === 'all' || i.state === filterState);
    return [...filtered].sort((a, b) => {
      if (sortBy === 'priority') return (parseInt(a.priority || '4') || 4) - (parseInt(b.priority || '4') || 4);
      if (sortBy === 'date') return new Date(b.changedDate || b.createdDate || 0).getTime() - new Date(a.changedDate || a.createdDate || 0).getTime();
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'state') return a.state.localeCompare(b.state);
      return 0;
    });
  }, [items, filterType, filterState, sortBy]);

  const { bugCount, activeCount, resolvedCount } = useMemo(() => ({
    bugCount: items.filter(i => i.workItemType === 'Bug').length,
    activeCount: items.filter(i => i.state === 'Active' || i.state === 'New').length,
    resolvedCount: items.filter(i => i.state === 'Resolved' || i.state === 'Closed').length,
  }), [items]);

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 dark:border-indigo-800/50 overflow-hidden bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-800/40">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-indigo-100/60 dark:bg-indigo-900/30 border-b border-indigo-200/60 dark:border-indigo-800/40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">
            Azure DevOps — {context.projectName}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-indigo-200/70 dark:bg-indigo-800/50 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          {items.length} items
        </span>
      </div>

      {/* Summary pills */}
      <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-indigo-100 dark:border-indigo-800/30">
        {bugCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-xs font-medium text-red-700 dark:text-red-300">
            🐛 {bugCount} bugs
          </span>
        )}
        {activeCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-xs font-medium text-yellow-700 dark:text-yellow-300">
            ⚡ {activeCount} active
          </span>
        )}
        {resolvedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-xs font-medium text-green-700 dark:text-green-300">
            ✅ {resolvedCount} resolved
          </span>
        )}
      </div>

      {/* Filters & Sort */}
      <div className="px-4 py-2 flex flex-wrap items-center gap-2 text-xs border-b border-indigo-100/60 dark:border-indigo-800/20">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-2 py-1 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs">
          <option value="all">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterState} onChange={e => setFilterState(e.target.value)} className="px-2 py-1 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-xs">
          <option value="all">All states</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-gray-400">Sort:</span>
          {(['priority', 'date', 'title', 'state'] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)} className={clsx('px-1.5 py-0.5 rounded', sortBy === s ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Work items list */}
      <div className="max-h-80 overflow-y-auto divide-y divide-indigo-100/60 dark:divide-indigo-800/20">
        {sorted.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              className="w-full px-4 py-2.5 flex items-start gap-3 text-left hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <span className="flex-shrink-0 mt-0.5 text-sm">{TYPE_ICONS[item.workItemType] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-slate-500 font-mono">#{item.id}</span>
                  <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', STATE_COLORS[item.state] || 'bg-gray-100 text-gray-600')}>
                    {item.state}
                  </span>
                  {item.priority && parseInt(item.priority) <= 2 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      P{item.priority}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 dark:text-slate-200 mt-0.5 truncate">{item.title}</p>
              </div>
              <ChevronDown className={clsx('w-4 h-4 text-gray-400 transition-transform flex-shrink-0 mt-1', expanded === item.id && 'rotate-180')} />
            </button>

            {/* Drill-down details */}
            {expanded === item.id && (
              <div className="px-4 pb-3 pl-11 text-xs space-y-2 animate-fadeIn">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600 dark:text-slate-400">
                  {item.assignedTo && <span><strong>Assigned:</strong> {item.assignedTo}</span>}
                  {item.severity && <span><strong>Severity:</strong> {item.severity}</span>}
                  {item.areaPath && <span><strong>Area:</strong> {item.areaPath}</span>}
                  {item.iterationPath && <span><strong>Iteration:</strong> {item.iterationPath}</span>}
                  {item.createdDate && <span><strong>Created:</strong> {new Date(item.createdDate).toLocaleDateString()}</span>}
                  {item.changedDate && <span><strong>Updated:</strong> {new Date(item.changedDate).toLocaleDateString()}</span>}
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-[10px]">{tag}</span>
                    ))}
                  </div>
                )}
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">
                    <ExternalLink className="w-3 h-3" />
                    Open in Azure DevOps
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Portal links */}
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 border-t border-indigo-100 dark:border-indigo-800/30">
        {context.bugsUrl && (
          <a href={context.bugsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
            <ExternalLink className="w-3 h-3" />
            Open in DevOps
          </a>
        )}
        {context.boardUrl && (
          <a href={context.boardUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
            <Layers className="w-3 h-3" />
            Board
          </a>
        )}
      </div>

      {/* Follow-ups */}
      {onFollowUp && (
        <div className="px-4 py-2.5 border-t border-indigo-100 dark:border-indigo-800/30">
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1.5 block">Drill deeper</span>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => onFollowUp('Show me only active bugs')} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
              <Search className="w-3 h-3" />Active bugs only
            </button>
            <button onClick={() => onFollowUp('Show resolved bugs from last sprint')} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
              <Search className="w-3 h-3" />Resolved bugs
            </button>
            <button onClick={() => onFollowUp('Show sprint work items and progress')} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
              <Search className="w-3 h-3" />Sprint progress
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// Customer context detail card — shows version info, health, deployment details as a popup-style card
const CustomerDetailCard = memo(function CustomerDetailCard({ context, onFollowUp }: { context: CustomerContextInfo; onFollowUp?: (prompt: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const healthColor = (h: string) => {
    switch (h) {
      case 'Good': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'Warning': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      case 'Critical': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'Critical': return 'text-red-600 dark:text-red-400';
      case 'High': return 'text-orange-600 dark:text-orange-400';
      case 'Medium': return 'text-blue-600 dark:text-blue-400';
      case 'Low': return 'text-gray-500 dark:text-gray-400';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-gradient-to-br from-purple-50/80 to-indigo-50/50 dark:from-purple-950/40 dark:to-indigo-950/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-purple-200/60 dark:border-purple-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600 dark:bg-purple-500 flex items-center justify-center shadow-sm">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              {context.mode === 'detail' ? 'Customer Details' : 'Production Customers'}
            </h4>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">
              {context.totalCustomers} customer{context.totalCustomers !== 1 ? 's' : ''} • {context.totalProperties} properties • {context.totalActiveUsers.toLocaleString()} users
            </p>
          </div>
        </div>
        {context.totalOpenTickets > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
            {context.totalOpenTickets} open tickets
          </span>
        )}
      </div>

      {/* Version Distribution pills */}
      {context.versionDistribution && Object.keys(context.versionDistribution).length > 0 && (
        <div className="px-4 py-2 border-b border-purple-100/60 dark:border-purple-800/30 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Versions:</span>
          {Object.entries(context.versionDistribution)
            .sort(([, a], [, b]) => b - a)
            .map(([ver, count]) => (
              <span key={ver} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                v{ver} <span className="opacity-60">({count})</span>
              </span>
            ))}
        </div>
      )}

      {/* Health Distribution pills (overview mode) */}
      {context.mode === 'overview' && context.healthDistribution && Object.keys(context.healthDistribution).length > 0 && (
        <div className="px-4 py-2 border-b border-purple-100/60 dark:border-purple-800/30 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Health:</span>
          {Object.entries(context.healthDistribution).map(([health, count]) => (
            <span key={health} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${healthColor(health)}`}>
              {health} ({count})
            </span>
          ))}
        </div>
      )}

      {/* Customer rows */}
      <div className="divide-y divide-purple-100/60 dark:divide-purple-800/30">
        {context.customers.map(cust => (
          <div key={cust.customerId}>
            <button
              onClick={() => setExpanded(expanded === cust.customerId ? null : cust.customerId)}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-purple-50/60 dark:hover:bg-purple-900/20 transition-colors text-left"
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                cust.healthScore === 'Good' ? 'bg-emerald-500' : cust.healthScore === 'Warning' ? 'bg-amber-500' : 'bg-red-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">{cust.customerName}</span>
                  <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">{cust.customerId}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">v{cust.currentVersion || '?'}</span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">{cust.region}</span>
                  <span className="text-[10px] text-gray-500 dark:text-slate-400">{cust.deploymentType}</span>
                  <span className={`text-[10px] font-medium ${priorityColor(cust.priority)}`}>{cust.priority}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[10px] text-gray-500 dark:text-slate-400">{cust.activeUsers} users</span>
                {cust.openTickets > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">{cust.openTickets} tickets</span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded === cust.customerId ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Expanded detail */}
            {expanded === cust.customerId && (
              <div className="px-4 pb-3 pt-1 bg-white/50 dark:bg-slate-900/30 border-t border-purple-100/40 dark:border-purple-800/20">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10px]">
                  <div><span className="text-gray-500 dark:text-slate-400">Health:</span> <span className={`font-semibold px-1.5 py-0.5 rounded ${healthColor(cust.healthScore)}`}>{cust.healthScore}</span></div>
                  <div><span className="text-gray-500 dark:text-slate-400">Properties:</span> <span className="text-gray-800 dark:text-slate-200 font-medium">{cust.totalProperties}</span></div>
                  <div><span className="text-gray-500 dark:text-slate-400">Location:</span> <span className="text-gray-800 dark:text-slate-200">{[cust.city, cust.state, cust.country].filter(Boolean).join(', ') || '—'}</span></div>
                  <div><span className="text-gray-500 dark:text-slate-400">Deployment:</span> <span className="text-gray-800 dark:text-slate-200">{cust.deploymentType}</span></div>
                  {cust.goLiveDate && <div><span className="text-gray-500 dark:text-slate-400">Go-Live:</span> <span className="text-gray-800 dark:text-slate-200">{new Date(cust.goLiveDate).toLocaleDateString()}</span></div>}
                  {cust.lastActivityDate && <div><span className="text-gray-500 dark:text-slate-400">Last Activity:</span> <span className="text-gray-800 dark:text-slate-200">{new Date(cust.lastActivityDate).toLocaleDateString()}</span></div>}
                  {cust.customerManager && <div><span className="text-gray-500 dark:text-slate-400">Manager:</span> <span className="text-gray-800 dark:text-slate-200">{cust.customerManager}</span></div>}
                  {cust.supportManager && <div><span className="text-gray-500 dark:text-slate-400">Support:</span> <span className="text-gray-800 dark:text-slate-200">{cust.supportManager}</span></div>}
                </div>
                {cust.products.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-500 dark:text-slate-400">Products:</span>
                    {cust.products.map(p => (
                      <span key={p} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{p}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Follow-up suggestions */}
      {onFollowUp && (
        <div className="px-4 py-2.5 border-t border-purple-200/60 dark:border-purple-800/40 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-medium text-gray-500 dark:text-slate-400">Drill deeper:</span>
          <button onClick={() => onFollowUp('Which customers are on the latest version?')} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
            <Search className="w-3 h-3" />Latest version
          </button>
          <button onClick={() => onFollowUp('Show customers with critical health score')} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
            <Search className="w-3 h-3" />Critical health
          </button>
          <button onClick={() => onFollowUp('Show customers with open tickets')} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all">
            <Search className="w-3 h-3" />Open tickets
          </button>
        </div>
      )}
    </div>
  );
});

// Jenkins Builds card — shows recent build status, job names, and links
const JenkinsBuildsCard = memo(function JenkinsBuildsCard({ context, onFollowUp }: { context: JenkinsContextInfo; onFollowUp?: (prompt: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const displayBuilds = showAll ? context.recentBuilds : context.recentBuilds.slice(0, 8);

  const resultColor = (r: string) => {
    switch (r?.toUpperCase()) {
      case 'SUCCESS': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
      case 'FAILURE': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
      case 'UNSTABLE': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400';
      case 'ABORTED': return 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400';
      case 'BUILDING': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400';
    }
  };

  const resultIcon = (r: string) => {
    switch (r?.toUpperCase()) {
      case 'SUCCESS': return '✅';
      case 'FAILURE': return '❌';
      case 'UNSTABLE': return '⚠️';
      case 'ABORTED': return '⏹';
      case 'BUILDING': return '🔄';
      default: return '❓';
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-orange-200 dark:border-orange-800/50 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-orange-200 dark:border-orange-800/40">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <span className="text-sm font-semibold text-orange-800 dark:text-orange-300">
            Jenkins Builds
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-200 dark:bg-orange-800/50 text-orange-700 dark:text-orange-300">
            {context.recentBuilds.length} builds · {context.totalJobs} jobs
          </span>
        </div>
        {context.jenkinsUrl && (
          <a
            href={context.jenkinsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 hover:underline"
          >
            Open Jenkins <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="divide-y divide-orange-100 dark:divide-orange-800/30">
        {displayBuilds.map((build, idx) => (
          <div
            key={`${build.jobName}-${build.buildNumber}-${idx}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors"
          >
            <span className="text-sm">{resultIcon(build.result)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                  {build.jobName}
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  #{build.buildNumber}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                <span>{new Date(build.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span>·</span>
                <span>{Math.round(build.durationMs / 1000)}s</span>
              </div>
            </div>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', resultColor(build.result))}>
              {build.result}
            </span>
            {build.url && (
              <a
                href={build.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-700 dark:hover:text-orange-300"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>

      {context.recentBuilds.length > 8 && (
        <div className="px-4 py-2 border-t border-orange-200 dark:border-orange-800/40">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
          >
            {showAll ? 'Show less' : `Show all ${context.recentBuilds.length} builds`}
          </button>
        </div>
      )}

      {onFollowUp && (
        <div className="px-4 py-2.5 border-t border-orange-200 dark:border-orange-800/40 flex flex-wrap gap-1.5">
          <button
            onClick={() => onFollowUp('Show me failed Jenkins builds')}
            className="text-xs px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors"
          >
            Failed builds
          </button>
          <button
            onClick={() => onFollowUp('What was the last successful deployment?')}
            className="text-xs px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50 transition-colors"
          >
            Last successful deploy
          </button>
        </div>
      )}
    </div>
  );
});

// Message component with interactions
const MessageBubble = memo(function MessageBubble({ 
  message, 
  onCopy, 
  onFeedback, 
  onBookmark,
  onRegenerate,
  onFollowUp,
  isLast 
}: { 
  message: Message; 
  onCopy: (content: string) => void;
  onFeedback: (id: string, type: 'positive' | 'negative') => void;
  onBookmark: (id: string) => void;
  onRegenerate?: () => void;
  onFollowUp?: (prompt: string) => void;
  isLast: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={clsx(
        'group flex gap-4 animate-fadeIn',
        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className={clsx(
        'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105',
        message.role === 'user' 
          ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
          : 'bg-gradient-to-br from-indigo-500 to-purple-600'
      )}>
        {message.role === 'user' 
          ? <User className="w-5 h-5 text-white" />
          : <Bot className="w-5 h-5 text-white" />
        }
      </div>
      
      {/* Message content */}
      <div className={clsx(
        'flex-1 max-w-3xl',
        message.role === 'user' && 'flex flex-col items-end'
      )}>
        <div
          className={clsx(
            'relative px-5 py-4 rounded-2xl transition-all duration-200',
            message.role === 'user'
              ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-sm shadow-lg shadow-blue-500/20'
              : message.isError
                ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-tl-sm'
                : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 shadow-lg shadow-gray-200/50 dark:shadow-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-tl-sm'
          )}
        >
          {/* Bookmark indicator */}
          {message.isBookmarked && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md animate-bounce-once">
              <Star className="w-3 h-3 text-yellow-900" fill="currentColor" />
            </div>
          )}
          
          <div className="text-sm sm:text-base leading-relaxed">
            {message.role === 'assistant' ? (
              message.isStreaming ? (
                <>
                  <span className="whitespace-pre-wrap">{message.content}</span>
                  {message.content && (
                    <span className="inline-block w-2 h-5 ml-1 bg-gradient-to-t from-blue-500 to-indigo-500 rounded-sm animate-pulse" />
                  )}
                </>
              ) : (
                <RenderContent content={message.content} />
              )
            ) : (
              <span className="whitespace-pre-wrap">{message.content}</span>
            )}
          </div>
          
          {/* Action buttons for assistant messages */}
          {message.role === 'assistant' && !message.isStreaming && message.content && (
            <div className={clsx(
              'absolute -bottom-10 left-0 flex items-center gap-1 transition-all duration-200',
              showActions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'
            )}>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Copy message"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => onFeedback(message.id, 'positive')}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  message.feedback === 'positive'
                    ? 'text-green-500 bg-green-100 dark:bg-green-900/30'
                    : 'text-gray-500 dark:text-slate-400 hover:text-green-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                )}
                title="Good response"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onFeedback(message.id, 'negative')}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  message.feedback === 'negative'
                    ? 'text-red-500 bg-red-100 dark:bg-red-900/30'
                    : 'text-gray-500 dark:text-slate-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                )}
                title="Poor response"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onBookmark(message.id)}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  message.isBookmarked
                    ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30'
                    : 'text-gray-500 dark:text-slate-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                )}
                title="Bookmark"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
              {isLast && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Regenerate response"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Azure Query Info card — enriched with KQL, portal links, follow-ups */}
        {message.role === 'assistant' && !message.isStreaming && message.azureQueryInfo && (
          <AzureQueryCard queryInfo={message.azureQueryInfo} onFollowUp={onFollowUp} />
        )}

        {/* DevOps Work Items card */}
        {message.role === 'assistant' && !message.isStreaming && message.devOpsContext && message.devOpsContext.workItems.length > 0 && (
          <DevOpsWorkItemsCard context={message.devOpsContext} onFollowUp={onFollowUp} />
        )}

        {/* Customer Context card */}
        {message.role === 'assistant' && !message.isStreaming && message.customerContext && message.customerContext.customers.length > 0 && (
          <CustomerDetailCard context={message.customerContext} onFollowUp={onFollowUp} />
        )}

        {/* Jenkins Builds card */}
        {message.role === 'assistant' && !message.isStreaming && message.jenkinsContext && message.jenkinsContext.recentBuilds.length > 0 && (
          <JenkinsBuildsCard context={message.jenkinsContext} onFollowUp={onFollowUp} />
        )}

        {/* Timestamp */}
        {!message.isStreaming && (
          <div className={clsx(
            'flex items-center gap-1.5 mt-2 text-xs',
            message.role === 'user' ? 'text-gray-400' : 'text-gray-400 dark:text-slate-500'
          )}>
            <Clock className="w-3 h-3" />
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
});

// Quick action category card — LexieLingua warm card style
const QuickActionCard = memo(function QuickActionCard({ 
  category, 
  onAction, 
  disabled 
}: { 
  category: typeof QUICK_ACTION_CATEGORIES[0]; 
  onAction: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className={clsx(
      'rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-gradient-to-br',
      category.bgGradient,
      category.borderColor,
    )}>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={clsx(
            'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm',
            category.gradient
          )}>
            <span className="text-lg text-white filter drop-shadow-sm">{category.icon}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{category.name}</h3>
            <span className="text-[11px] text-gray-400 dark:text-slate-500">{category.actions.length} actions</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {category.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => onAction(action.prompt)}
              disabled={disabled}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm bg-white/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700/80 rounded-xl transition-all duration-150 disabled:opacity-50 group backdrop-blur-sm"
            >
              <span className={clsx('text-gray-400 dark:text-slate-500 group-hover:scale-110 transition-transform', `group-hover:text-${category.color}-500`)}>{action.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-gray-800 dark:text-slate-200 font-medium text-[13px]">{action.label}</span>
                <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{action.desc}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// Input suggestions dropdown
function InputSuggestions({ 
  input, 
  onSelect, 
  visible 
}: { 
  input: string; 
  onSelect: (suggestion: string) => void;
  visible: boolean;
}) {
  const matchedSuggestions = useMemo(() => {
    if (!input || input.length < 2) return [];
    const lowerInput = input.toLowerCase();
    
    for (const item of SUGGESTIONS) {
      if (lowerInput.startsWith(item.trigger)) {
        return item.suggestions.filter(s => 
          s.toLowerCase().includes(lowerInput) && s.toLowerCase() !== lowerInput
        );
      }
    }
    return [];
  }, [input]);
  
  if (!visible || matchedSuggestions.length === 0) return null;
  
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden z-10 animate-slideUp">
      <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
          <span>Suggestions</span>
        </div>
      </div>
      <div className="py-1">
        {matchedSuggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => onSelect(suggestion)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <ArrowRight className="w-3 h-3 text-blue-500" />
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

// Tool capability status indicator
const ToolStatusCard = memo(function ToolStatusCard({ tool, status }: { tool: ToolCapability; status: boolean }) {
  const colorMap: Record<string, { bg: string; ring: string; text: string; dot: string }> = {
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', ring: 'ring-purple-200 dark:ring-purple-800', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', ring: 'ring-blue-200 dark:ring-blue-800', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
    green: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', ring: 'ring-emerald-200 dark:ring-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', ring: 'ring-indigo-200 dark:ring-indigo-800', text: 'text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500' },
  };
  const c = colorMap[tool.color] || colorMap.blue;

  return (
    <div className={clsx(
      'flex items-center gap-3 px-4 py-3 rounded-xl ring-1 transition-all',
      status ? c.bg : 'bg-gray-50 dark:bg-slate-800/50',
      status ? c.ring : 'ring-gray-200 dark:ring-slate-700',
    )}>
      <div className={clsx(
        'w-8 h-8 rounded-lg flex items-center justify-center',
        status ? c.bg : 'bg-gray-100 dark:bg-slate-700',
        status ? c.text : 'text-gray-400 dark:text-slate-500',
      )}>
        {tool.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-xs font-semibold', status ? 'text-gray-800 dark:text-slate-200' : 'text-gray-400 dark:text-slate-500')}>
          {tool.name}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{tool.description}</p>
      </div>
      <div className={clsx(
        'w-2 h-2 rounded-full flex-shrink-0',
        status ? c.dot : 'bg-gray-300 dark:bg-slate-600'
      )} />
    </div>
  );
});

// Empty state with LexieLingua-inspired warm, card-based design
function EmptyState({ 
  onAction, 
  disabled, 
  toolStatus 
}: { 
  onAction: (prompt: string) => void; 
  disabled: boolean;
  toolStatus: Record<string, boolean>;
}) {
  return (
    <div className="animate-fadeIn px-2">
      {/* Hero section — warm gradient with floating elements */}
      <div className="relative text-center mb-10">
        <div className="absolute inset-0 flex items-center justify-center opacity-30 dark:opacity-20 pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full bg-gradient-to-br from-purple-200 via-pink-100 to-blue-200 dark:from-purple-900 dark:via-pink-900/50 dark:to-blue-900 blur-3xl" />
        </div>
        
        <div className="relative">
          {/* Animated icon group */}
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute w-20 h-20 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-3xl rotate-6 animate-pulse" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-500/25">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '2s' }}>
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600 dark:from-purple-400 dark:via-indigo-400 dark:to-blue-400 bg-clip-text text-transparent mb-2">
            What would you like to explore?
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Your AI-powered engineering assistant. Query Azure, analyze metrics, navigate tools, and get answers instantly.
          </p>
        </div>
      </div>

      {/* Tool capabilities — auto-populated status */}
      <div className="max-w-2xl mx-auto mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Connected Tools</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TOOL_CAPABILITIES.map(tool => (
            <ToolStatusCard key={tool.id} tool={tool} status={toolStatus[tool.checkKey] ?? false} />
          ))}
        </div>
      </div>
      
      {/* Quick prompt pills — scrollable row */}
      <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-3xl mx-auto">
        {SAMPLE_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onAction(prompt.text)}
            disabled={disabled}
            className="group flex items-center gap-2 pl-3 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700 rounded-full text-sm text-gray-700 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-base">{prompt.icon}</span>
            <span className="text-[13px]">{prompt.text}</span>
            <span className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 rounded-full group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 group-hover:text-purple-500 transition-colors">{prompt.tag}</span>
          </button>
        ))}
      </div>
      
      {/* Action categories — LexieLingua card grid */}
      <div className="grid sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {QUICK_ACTION_CATEGORIES.map((category, i) => (
          <QuickActionCard
            key={i}
            category={category}
            onAction={onAction}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Full-page AI Chat - Enhanced interactive experience
 */
export default function AIChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStepInfo[]>([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [searchHistory, setSearchHistory] = useState('');
  const [aiSettings, setAiSettings] = useState<{
    provider: string;
    model: string;
    isConfigured: boolean;
  } | null>(null);
  const [toolStatus, setToolStatus] = useState<Record<string, boolean>>({
    ai: false,
    azure: false,
    signalr: false,
    devops: false,
  });
  const [conversationHistories] = useState<ConversationHistory[]>([
    { id: '1', title: 'Azure Resource Check', lastMessage: 'What Azure resources...', timestamp: new Date(Date.now() - 3600000), messageCount: 5 },
    { id: '2', title: 'Error Analysis', lastMessage: 'Show me recent errors', timestamp: new Date(Date.now() - 7200000), messageCount: 8 },
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const tokenBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const inputValueRef = useRef('');

  // Keep refs in sync with state (avoids stale closures without adding to deps)
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { inputValueRef.current = input; }, [input]);

  // Cleanup timers on unmount to prevent orphaned callbacks
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
      if (scrollTimerRef.current) { clearTimeout(scrollTimerRef.current); scrollTimerRef.current = null; }
    };
  }, []);
  
  const NAVIGATION_PATTERN = '\\[\\[navigate:(\\/[^\\]]*)]\\]';
  const ACTION_PATTERN = '\\[\\[action:([^\\]]+)\\]\\]';
  
  // Parse and execute AI actions (with timeout to prevent UI freeze)
  const parseAndExecuteActions = useCallback(async (content: string) => {
    const regex = new RegExp(ACTION_PATTERN, 'g');
    const matches = [...content.matchAll(regex)];
    if (matches.length === 0) return null;

    const ACTION_TIMEOUT_MS = 30_000;

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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS);

        const response = await api.post('/ai/actions/execute', {
          action: actionName,
          parameters
        }, { signal: controller.signal });

        clearTimeout(timeout);
        
        const result = response.data;
        if (result.success) {
          const icon = actionName === 'execute_db_query' ? '🗄️' : '✅';
          setMessages(prev => [...prev, {
            id: `action-result-${Date.now()}`,
            role: 'assistant' as const,
            content: `${icon} ${result.message}`,
            timestamp: new Date(),
            isStreaming: false
          }]);
        } else {
          setMessages(prev => [...prev, {
            id: `action-result-${Date.now()}`,
            role: 'assistant' as const,
            content: `⚠️ ${result.message}`,
            timestamp: new Date(),
            isStreaming: false
          }]);
        }
      } catch (error) {
        const isTimeout = error instanceof DOMException && error.name === 'AbortError';
        const errorMsg = isTimeout
          ? `⏱️ Action "${actionName}" timed out after ${ACTION_TIMEOUT_MS / 1000}s`
          : `⚠️ Action "${actionName}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('AI Action Error:', error);
        setMessages(prev => [...prev, {
          id: `action-error-${Date.now()}`,
          role: 'assistant' as const,
          content: errorMsg,
          timestamp: new Date(),
          isStreaming: false,
          isError: true
        }]);
      }
    }
    return null;
  }, []);
  
  const parseAndExecuteNavigation = useCallback((content: string) => {
    const regex = new RegExp(NAVIGATION_PATTERN, 'g');
    const matches = content.matchAll(regex);
    for (const match of matches) {
      const path = match[1];
      if (path) {
        setTimeout(() => navigate(path), 500);
        return path;
      }
    }
    return null;
  }, [navigate]);
  
  const cleanActionTags = (content: string): string => {
    let cleaned = content;
    cleaned = cleaned.replace(new RegExp(NAVIGATION_PATTERN, 'g'), '');
    cleaned = cleaned.replace(new RegExp(ACTION_PATTERN, 'g'), '');
    return cleaned.trim();
  };

  // SignalR hook
  const {
    isConnected: signalRConnected,
    sendMessageStream,
  } = useAIChatHub({
    onToken: (token: ChatStreamToken) => {
      const currentId = streamingMessageIdRef.current;
      if (!currentId) return;
      
      // Buffer tokens and flush every 100ms to reduce re-renders during streaming
      tokenBufferRef.current += token.content;
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          const buffered = tokenBufferRef.current;
          tokenBufferRef.current = '';
          flushTimerRef.current = null;
          if (buffered) {
            setMessages(prev => prev.map(msg => 
              msg.id === currentId
                ? { ...msg, content: msg.content + buffered }
                : msg
            ));
          }
        }, 100);
      }
    },
    onStreamComplete: async (_messageId, fullContent, azureQueryInfo, devOpsContext, customerContext, jenkinsContext) => {
      const currentId = streamingMessageIdRef.current;
      if (!currentId) return;

      // Flush any remaining buffered tokens
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      tokenBufferRef.current = '';

      try {
        parseAndExecuteNavigation(fullContent || '');
        await parseAndExecuteActions(fullContent || '');
      } catch (err) {
        console.error('Error executing stream actions:', err);
      } finally {
        const cleanedContent = cleanActionTags(fullContent || '').trim();

        if (!cleanedContent) {
          setMessages(prev => prev.filter(msg => msg.id !== currentId));
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === currentId
              ? { ...msg, content: cleanedContent, isStreaming: false, azureQueryInfo, devOpsContext, customerContext, jenkinsContext }
              : msg
          ));
        }
        streamingMessageIdRef.current = null;
        setStreamingMessageId(null);
        setIsLoading(false);
        setStatusMessage(undefined);
        setPipelineSteps([]);
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
      setStreamingMessageId(null);
      setIsLoading(false);
      setStatusMessage(undefined);
      setPipelineSteps([]);
    },
    onStatus: (status) => {
      setStatusMessage(status);
    },
    onPipeline: (steps, _activeStep, content) => {
      setPipelineSteps(steps);
      if (content) setStatusMessage(content);
    },
  });

  useEffect(() => {
    loadAISettings();
  }, []);

  // Sync SignalR status to tool capabilities
  useEffect(() => {
    setToolStatus(prev => ({ ...prev, signalr: signalRConnected }));
  }, [signalRConnected]);

  // Debounced scroll — only scrolls when user is near the bottom (auto-follow)
  useEffect(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      const el = messagesEndRef.current;
      if (!el) return;
      const container = el.parentElement;
      if (container) {
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        // Only auto-scroll if user hasn't scrolled up significantly
        if (distFromBottom < 300) {
          el.scrollIntoView({ behavior: 'auto' });
        }
      } else {
        el.scrollIntoView({ behavior: 'auto' });
      }
      scrollTimerRef.current = null;
    }, 300);
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setShowSidebar(prev => !prev);
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setInput('');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadAISettings = async () => {
    // Check DevOps config
    const devopsConfig = engineeringService.getSavedConfig();
    const hasDevOps = !!devopsConfig;

    try {
      const response = await api.get('/ai/settings');
      const settings = response.data;
      const isConfigured = settings.isConfigured;
      setAiSettings({
        provider: settings.provider || 'Not configured',
        model: settings.model || 'Unknown',
        isConfigured,
      });
      setToolStatus(prev => ({ ...prev, ai: isConfigured, devops: hasDevOps }));
    } catch {
      // Fallback: check tenant LLM settings directly (LLMController has no feature gate)
      try {
        const llmResponse = await api.get('/llm/settings');
        if (llmResponse.data) {
          const isConfigured = llmResponse.data.hasApiKey || llmResponse.data.useAzureTokenAuth;
          const providerName = llmResponse.data.provider === 'azureopenai' ? 'Azure OpenAI'
            : llmResponse.data.provider === 'openai' ? 'OpenAI'
            : llmResponse.data.provider || 'Not configured';
          setAiSettings({
            provider: isConfigured ? providerName : 'Not configured',
            model: llmResponse.data.model || 'Unknown',
            isConfigured: isConfigured,
          });
          setToolStatus(prev => ({ ...prev, ai: isConfigured, devops: hasDevOps }));
          return;
        }
      } catch { /* ignore */ }
      setAiSettings({
        provider: 'Not configured',
        model: 'Unknown',
        isConfigured: false,
      });
      setToolStatus(prev => ({ ...prev, ai: false, devops: hasDevOps }));
    }

    // Check Azure setup
    try {
      const azureRes = await api.get('/azure/status');
      setToolStatus(prev => ({ ...prev, azure: !!azureRes.data?.isConfigured }));
    } catch {
      // If endpoint doesn't exist, check if azure settings exist
      setToolStatus(prev => ({ ...prev, azure: true })); // assume available if no error endpoint
    }
  };

  const sendMessage = useCallback(async (messageText?: string) => {
    const textToSend = messageText || inputValueRef.current.trim();
    if (!textToSend || isLoading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };
    
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
    streamingMessageIdRef.current = assistantMessageId;
    setShowSuggestions(false);
    setPipelineSteps([]);
    setStatusMessage(undefined);

    // Use ref to avoid stale closure — messages changes shouldn't recreate sendMessage
    const history: HistoryMessage[] = messagesRef.current.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      if (signalRConnected) {
        await sendMessageStream(textToSend, history);
      } else {
        const response = await api.post('/ai/chat', {
          message: textToSend,
          context: 'dashboard_assistant',
          history,
        });

        const responseContent = response.data.response || response.data.message || 'No response received.';
        try {
          parseAndExecuteNavigation(responseContent);
          await parseAndExecuteActions(responseContent);
        } catch (actionErr) {
          console.error('Error executing actions:', actionErr);
        } finally {
          const cleanedContent = cleanActionTags(responseContent).trim();

          if (!cleanedContent) {
            setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
          } else {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: cleanedContent, isStreaming: false }
                : msg
            ));
          }
          streamingMessageIdRef.current = null;
          setStreamingMessageId(null);
          setIsLoading(false);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response';
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: errorMsg, isError: true, isStreaming: false }
          : msg
      ));
      streamingMessageIdRef.current = null;
      setStreamingMessageId(null);
      setIsLoading(false);
    }
  }, [isLoading, signalRConnected, sendMessageStream, parseAndExecuteNavigation, parseAndExecuteActions]);

  // Stable ref-based callback for follow-up messages — prevents MessageBubble memo invalidation
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;
  const handleFollowUp = useCallback((text: string) => {
    sendMessageRef.current(text);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFeedback = useCallback((id: string, type: 'positive' | 'negative') => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, feedback: msg.feedback === type ? undefined : type } : msg
    ));
  }, []);

  const handleBookmark = useCallback((id: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, isBookmarked: !msg.isBookmarked } : msg
    ));
  }, []);

  const regenerateLastResponse = useCallback(() => {
    const lastUserMessage = [...messagesRef.current].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      setMessages(prev => prev.slice(0, -1));
      setTimeout(() => sendMessageRef.current(lastUserMessage.content), 100);
    }
  }, []);

  const clearChat = () => setMessages([]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const exportConversation = () => {
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex bg-gradient-to-br from-gray-50 via-white to-purple-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/20">
      {/* Sidebar */}
      <div className={clsx(
        'flex flex-col bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 transition-all duration-300 shadow-xl',
        showSidebar ? 'w-80' : 'w-0 overflow-hidden'
      )}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg shadow-purple-500/30">
                <Bot className="w-6 h-6 text-white" />
              </div>
              {signalRConnected && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white">AI Assistant</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                {signalRConnected ? (
                  <>
                    <Wifi className="w-3 h-3 text-green-500" />
                    <span>Real-time streaming</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 text-yellow-500" />
                    <span>REST API</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-slate-700 rounded-xl text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>

        {/* Provider info */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-700/50 dark:to-slate-700/30 rounded-xl border border-gray-100 dark:border-slate-600">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">AI Provider</span>
              <button
                onClick={() => navigate('/settings')}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                title="Configure AI"
              >
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {aiSettings?.provider || 'Loading...'}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {aiSettings?.model || 'Unknown model'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-gray-400" />
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Recent Conversations
            </h3>
          </div>
          <div className="space-y-2">
            {conversationHistories
              .filter(h => h.title.toLowerCase().includes(searchHistory.toLowerCase()))
              .map((history) => (
              <button
                key={history.id}
                className="w-full flex items-start gap-3 p-3 text-left text-sm bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-all duration-150 group hover:shadow-md"
              >
                <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0 group-hover:text-purple-500 transition-colors" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {history.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                    {history.lastMessage}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400 dark:text-slate-500">
                    <span>{history.messageCount} messages</span>
                    <span>•</span>
                    <span>{history.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
            <Keyboard className="w-3.5 h-3.5" />
            <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-slate-700 rounded text-[10px]">⌘K</kbd> focus</span>
            <span>•</span>
            <span><kbd className="px-1 py-0.5 bg-gray-200 dark:bg-slate-700 rounded text-[10px]">⌘B</kbd> sidebar</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-2">
          <button
            onClick={exportConversation}
            disabled={messages.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export Conversation
          </button>
          <button
            onClick={clearChat}
            disabled={messages.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear Conversation
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? (
                <PanelLeftClose className="w-5 h-5 text-gray-500" />
              ) : (
                <PanelLeft className="w-5 h-5 text-gray-500" />
              )}
            </button>
            <div className="hidden sm:block">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                {messages.length > 0 ? 'Chat Session' : 'New Conversation'}
                {messages.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                    {messages.filter(m => m.role === 'user').length} messages
                  </span>
                )}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <>
                <button
                  onClick={exportConversation}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Export"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={clearChat}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Clear"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Not configured warning */}
        {!aiSettings?.isConfigured && (
          <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="max-w-6xl mx-auto flex items-center gap-3 text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0 animate-pulse" />
              <span className="text-sm">AI assistant is not configured. Chat functionality is limited.</span>
              <button 
                onClick={() => navigate('/settings')}
                className="text-sm font-medium underline flex items-center gap-1 hover:text-amber-800 ml-auto group"
              >
                Configure now <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* Messages - Chat style layout: fixed height, messages at bottom */}
        <div className="flex-1 overflow-y-auto min-h-0" id="chat-scroll-container">
          {messages.length === 0 ? (
            /* Empty state - centered vertically */
            <div className="flex items-center justify-center min-h-full px-4 py-6">
              <div className="w-full max-w-6xl">
                <EmptyState 
                  onAction={sendMessage} 
                  disabled={isLoading || !aiSettings?.isConfigured} 
                  toolStatus={toolStatus}
                />
              </div>
            </div>
          ) : (
            /* Messages container - uses mt-auto to push content to bottom when few messages */
            <div className="flex flex-col min-h-full">
              <div className="flex-1" />
              <div className="max-w-6xl mx-auto w-full px-6 py-6 space-y-8">
                {messages.map((message, index) => (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    onCopy={copyToClipboard}
                    onFeedback={handleFeedback}
                    onBookmark={handleBookmark}
                    onRegenerate={index === messages.length - 1 && message.role === 'assistant' && !message.isStreaming ? regenerateLastResponse : undefined}
                    onFollowUp={handleFollowUp}
                    isLast={index === messages.length - 1}
                  />
                ))}

                {/* Loading indicator */}
                {isLoading && !streamingMessageId && (
                  <div className="flex gap-4 animate-fadeIn">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <Bot className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <div className="bg-white dark:bg-slate-800 px-5 py-4 rounded-2xl rounded-tl-sm shadow-lg border border-gray-100 dark:border-slate-700">
                      <ProcessingPipeline steps={pipelineSteps} isStreaming={signalRConnected} statusMessage={statusMessage} />
                    </div>
                  </div>
                )}

                {streamingMessageId && messages.find(m => m.id === streamingMessageId && m.content === '') && (
                  <div className="flex gap-4 animate-fadeIn">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                      <Bot className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <div className="bg-white dark:bg-slate-800 px-5 py-4 rounded-2xl rounded-tl-sm shadow-lg border border-gray-100 dark:border-slate-700">
                      <ProcessingPipeline steps={pipelineSteps} isStreaming={true} statusMessage={statusMessage} />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-4">
          <div className="max-w-6xl mx-auto">
            <div className="relative">
              {/* Suggestions */}
              <InputSuggestions
                input={input}
                onSelect={(suggestion) => {
                  setInput(suggestion);
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                visible={showSuggestions && !isLoading}
              />
              
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={aiSettings?.isConfigured ? "Ask me anything... (Enter to send)" : "Configure AI first..."}
                    disabled={!aiSettings?.isConfigured || isLoading}
                    rows={1}
                    className="w-full px-5 py-4 pr-28 bg-gray-50 dark:bg-slate-700 rounded-2xl text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-600 disabled:opacity-50 resize-none overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md"
                    style={{ minHeight: '56px', maxHeight: '200px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                    }}
                  />
                  
                  {/* Input actions */}
                  <div className="absolute right-2 bottom-2 flex items-center gap-1">
                    {input && (
                      <button
                        onClick={() => setInput('')}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                        title="Clear input"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || isLoading || !aiSettings?.isConfigured}
                      className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 disabled:shadow-none disabled:hover:scale-100"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer info */}
            <div className="flex items-center justify-between mt-3 text-xs text-gray-400 dark:text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {messages.filter(m => m.role === 'user').length} messages
                </span>
                {signalRConnected && (
                  <span className="flex items-center gap-1 text-green-500">
                    <Zap className="w-3 h-3" />
                    Streaming
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px] font-mono">Enter</kbd>
                <span>send</span>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[10px] font-mono">Shift+Enter</kbd>
                <span>new line</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes bounce-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.2s ease-out; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-bounce-once { animation: bounce-once 0.3s ease-out; }
        .animate-shimmer { animation: shimmer 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
