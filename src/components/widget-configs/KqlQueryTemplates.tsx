import { useState, useEffect } from 'react';
import { FileCode2, ChevronDown, ChevronUp, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { getScopedKqlTemplates } from '../../services/api';

export interface KqlTemplate {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'errors' | 'availability' | 'usage' | 'security' | 'infrastructure';
  query: string;
  suggestedTimeRange: string;
  requiresAppInsights?: boolean;
}

export const KQL_TEMPLATES: KqlTemplate[] = [
  // Performance Templates
  {
    id: 'request-count',
    name: 'Request Count Over Time',
    description: 'Track HTTP request volume with time-based aggregation',
    category: 'performance',
    query: `requests
| summarize RequestCount = count() by bin(timestamp, 5m)
| order by timestamp desc
| take 100`,
    suggestedTimeRange: '1h',
    requiresAppInsights: true,
  },
  {
    id: 'response-time',
    name: 'Average Response Time',
    description: 'Monitor API response latency trends',
    category: 'performance',
    query: `requests
| summarize AvgDuration = avg(duration), P95 = percentile(duration, 95), P99 = percentile(duration, 99) by bin(timestamp, 5m)
| order by timestamp desc`,
    suggestedTimeRange: '4h',
    requiresAppInsights: true,
  },
  {
    id: 'slow-requests',
    name: 'Slow Requests Analysis',
    description: 'Find requests taking longer than 3 seconds',
    category: 'performance',
    query: `requests
| where duration > 3000
| summarize Count = count(), AvgDuration = avg(duration) by name, resultCode
| order by Count desc
| take 20`,
    suggestedTimeRange: '24h',
    requiresAppInsights: true,
  },
  {
    id: 'dependency-performance',
    name: 'Dependency Performance',
    description: 'Monitor external service call durations',
    category: 'performance',
    query: `dependencies
| summarize AvgDuration = avg(duration), CallCount = count(), FailureRate = countif(success == false) * 100.0 / count() 
    by target, type
| order by CallCount desc`,
    suggestedTimeRange: '1h',
    requiresAppInsights: true,
  },

  // Error Templates
  {
    id: 'failed-requests',
    name: 'Failed Requests',
    description: 'Track HTTP 4xx and 5xx error rates',
    category: 'errors',
    query: `requests
| where resultCode startswith "4" or resultCode startswith "5"
| summarize ErrorCount = count() by resultCode, name
| order by ErrorCount desc
| take 20`,
    suggestedTimeRange: '24h',
    requiresAppInsights: true,
  },
  {
    id: 'exception-trends',
    name: 'Exception Trends',
    description: 'Monitor application exceptions over time',
    category: 'errors',
    query: `exceptions
| summarize ExceptionCount = count() by bin(timestamp, 15m), type
| order by timestamp desc`,
    suggestedTimeRange: '4h',
    requiresAppInsights: true,
  },
  {
    id: 'exception-details',
    name: 'Exception Details',
    description: 'Get detailed exception information with stack traces',
    category: 'errors',
    query: `exceptions
| project timestamp, type, outerMessage, innermostMessage, problemId
| order by timestamp desc
| take 50`,
    suggestedTimeRange: '1h',
    requiresAppInsights: true,
  },
  {
    id: 'dependency-failures',
    name: 'Dependency Failures',
    description: 'Track failed external service calls',
    category: 'errors',
    query: `dependencies
| where success == false
| summarize FailureCount = count() by target, type, resultCode
| order by FailureCount desc
| take 20`,
    suggestedTimeRange: '24h',
    requiresAppInsights: true,
  },

  // Availability Templates
  {
    id: 'availability-results',
    name: 'Availability Test Results',
    description: 'Monitor synthetic availability test outcomes',
    category: 'availability',
    query: `availabilityResults
| summarize SuccessRate = countif(success == true) * 100.0 / count(), AvgDuration = avg(duration) 
    by name, location
| order by SuccessRate asc`,
    suggestedTimeRange: '24h',
    requiresAppInsights: true,
  },
  {
    id: 'service-health',
    name: 'Service Health Overview',
    description: 'Overall success rate and performance metrics',
    category: 'availability',
    query: `requests
| summarize TotalRequests = count(), 
    SuccessRate = countif(success == true) * 100.0 / count(),
    AvgDuration = avg(duration)
    by bin(timestamp, 1h)
| order by timestamp desc`,
    suggestedTimeRange: '7d',
    requiresAppInsights: true,
  },

  // Usage Templates
  {
    id: 'page-views',
    name: 'Page Views Analytics',
    description: 'Track page view counts and popular pages',
    category: 'usage',
    query: `pageViews
| summarize ViewCount = count(), AvgDuration = avg(duration) by name
| order by ViewCount desc
| take 20`,
    suggestedTimeRange: '24h',
    requiresAppInsights: true,
  },
  {
    id: 'user-sessions',
    name: 'User Sessions',
    description: 'Analyze unique users and session patterns',
    category: 'usage',
    query: `requests
| summarize UniqueUsers = dcount(user_Id), Sessions = dcount(session_Id), Requests = count() 
    by bin(timestamp, 1h)
| order by timestamp desc`,
    suggestedTimeRange: '7d',
    requiresAppInsights: true,
  },
  {
    id: 'top-operations',
    name: 'Top Operations',
    description: 'Most frequently called API endpoints',
    category: 'usage',
    query: `requests
| summarize RequestCount = count(), AvgDuration = avg(duration), FailureRate = countif(success == false) * 100.0 / count()
    by name
| order by RequestCount desc
| take 15`,
    suggestedTimeRange: '24h',
    requiresAppInsights: true,
  },

  // Security Templates
  {
    id: 'auth-failures',
    name: 'Authentication Failures',
    description: 'Track 401/403 responses for security monitoring',
    category: 'security',
    query: `requests
| where resultCode == "401" or resultCode == "403"
| summarize FailureCount = count() by name, client_IP, bin(timestamp, 15m)
| order by FailureCount desc
| take 50`,
    suggestedTimeRange: '24h',
    requiresAppInsights: true,
  },
  {
    id: 'suspicious-activity',
    name: 'Suspicious Activity',
    description: 'High request rates from single IPs',
    category: 'security',
    query: `requests
| summarize RequestCount = count() by client_IP, bin(timestamp, 5m)
| where RequestCount > 100
| order by RequestCount desc`,
    suggestedTimeRange: '1h',
    requiresAppInsights: true,
  },

  // Infrastructure Templates
  {
    id: 'performance-counters',
    name: 'Performance Counters',
    description: 'CPU, memory, and system performance metrics',
    category: 'infrastructure',
    query: `performanceCounters
| where name in ("% Processor Time", "Available Bytes", "Process CPU")
| summarize AvgValue = avg(value) by name, bin(timestamp, 5m)
| order by timestamp desc`,
    suggestedTimeRange: '4h',
    requiresAppInsights: true,
  },
  {
    id: 'trace-logs',
    name: 'Application Traces',
    description: 'Recent trace logs with severity filtering',
    category: 'infrastructure',
    query: `traces
| where severityLevel >= 2
| project timestamp, message, severityLevel, operation_Name
| order by timestamp desc
| take 100`,
    suggestedTimeRange: '1h',
    requiresAppInsights: true,
  },
  {
    id: 'custom-events',
    name: 'Custom Events',
    description: 'Track custom application events',
    category: 'infrastructure',
    query: `customEvents
| summarize EventCount = count() by name
| order by EventCount desc
| take 20`,
    suggestedTimeRange: '24h',
    requiresAppInsights: true,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  performance: 'Performance',
  errors: 'Errors & Exceptions',
  availability: 'Availability',
  usage: 'Usage Analytics',
  security: 'Security',
  infrastructure: 'Infrastructure',
};

const CATEGORY_COLORS: Record<string, string> = {
  performance: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
  errors: 'text-red-600 bg-red-50 dark:bg-red-900/30',
  availability: 'text-green-600 bg-green-50 dark:bg-green-900/30',
  usage: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30',
  security: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30',
  infrastructure: 'text-gray-600 bg-gray-50 dark:bg-gray-700/50',
};

interface KqlQueryTemplatesProps {
  onSelectTemplate: (template: KqlTemplate) => void;
  currentQuery?: string;
  useScopedTemplates?: boolean; // Load optimized templates from backend
}

export function KqlQueryTemplates({ onSelectTemplate, useScopedTemplates = true }: KqlQueryTemplatesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [scopedTemplates, setScopedTemplates] = useState<KqlTemplate[]>([]);
  const [useBackend, setUseBackend] = useState(useScopedTemplates);

  // Load scoped templates from backend
  useEffect(() => {
    if (useBackend && isExpanded) {
      loadScopedTemplates();
    }
  }, [useBackend, isExpanded]);

  const loadScopedTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await getScopedKqlTemplates();
      // Map backend templates to KqlTemplate format
      const templates: KqlTemplate[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category as KqlTemplate['category'],
        query: t.optimizedQuery || t.query,
        suggestedTimeRange: t.suggestedTimeRange || '1h',
        requiresAppInsights: t.requiresAppInsights,
      }));
      setScopedTemplates(templates);
      console.log(`Loaded ${templates.length} optimized KQL templates from backend`);
    } catch (err) {
      console.warn('Failed to load scoped templates, using local:', err);
      setUseBackend(false);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const categories = Object.keys(CATEGORY_LABELS);

  // Use backend templates if available, otherwise fall back to local
  const activeTemplates = useBackend && scopedTemplates.length > 0 ? scopedTemplates : KQL_TEMPLATES;

  const filteredTemplates = selectedCategory
    ? activeTemplates.filter(t => t.category === selectedCategory)
    : activeTemplates;

  const handleCopy = (template: KqlTemplate) => {
    navigator.clipboard.writeText(template.query);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelect = (template: KqlTemplate) => {
    onSelectTemplate(template);
    setIsExpanded(false);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
            Query Templates
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({activeTemplates.length} {useBackend && scopedTemplates.length > 0 ? 'optimized' : 'pre-built'} queries)
          </span>
          {loadingTemplates && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
        </div>
        <div className="flex items-center gap-2">
          {useBackend && isExpanded && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); loadScopedTemplates(); }}
              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              title="Refresh optimized templates"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5", loadingTemplates && "animate-spin")} />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                'px-2 py-1 text-xs rounded-full transition-colors',
                !selectedCategory
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={clsx(
                  'px-2 py-1 text-xs rounded-full transition-colors',
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Templates List */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                        {template.name}
                      </span>
                      <span className={clsx('px-1.5 py-0.5 text-xs rounded', CATEGORY_COLORS[template.category])}>
                        {CATEGORY_LABELS[template.category]}
                      </span>
                      {template.requiresAppInsights && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          App Insights
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {template.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(template)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                      title="Copy query"
                    >
                      {copiedId === template.id ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelect(template)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Use
                    </button>
                  </div>
                </div>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto max-h-20 overflow-y-auto">
                  {template.query}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default KqlQueryTemplates;
