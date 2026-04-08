/**
 * Application Constants
 * Centralized constants matching backend patterns for consistency.
 * These constants mirror ProdVista.Domain/Constants/ on the server side.
 */

// ============================================================================
// SESSION & AUTHENTICATION
// ============================================================================

export const SessionConstants = {
  /** Session ID header name */
  SESSION_HEADER: 'X-Session-Id',
  
  /** Session storage keys */
  StorageKeys: {
    SESSION_ID: 'pv_session_id',
    SESSION_EXPIRY: 'pv_session_expiry',
    AUTH_TOKEN: 'prodvista_auth_token',
    AZURE_TOKEN: 'prodvista_azure_token',
    DEVOPS_TOKEN: 'prodvista_devops_token',
  },
  
  /** Session timeout in hours */
  TIMEOUT_HOURS: 8,
  
  /** Token refresh buffer in minutes */
  REFRESH_BUFFER_MINUTES: 5,
} as const;

// ============================================================================
// INTEGRATION PROVIDERS
// ============================================================================

export const ProviderIds = {
  // CI/CD Providers
  AZURE_DEVOPS: 'azuredevops',
  JENKINS: 'jenkins',
  GITHUB_ACTIONS: 'githubactions',
  
  // Cloud Providers
  AZURE_MANAGEMENT: 'azuremanagement',
  AZURE_GRAPH: 'azuregraph',
  
  // HR/Identity Providers
  HR_PORTAL: 'hrportal',
  
  // LLM Providers
  LLM_AZURE_OPENAI: 'llm_azure',
  LLM_OPENAI: 'llm_openai',
  LLM_ANTHROPIC: 'llm_anthropic',
  
  // Monitoring Providers
  APP_INSIGHTS: 'appinsights',
  DYNATRACE: 'dynatrace',
  DATADOG: 'datadog',
} as const;

export type ProviderId = typeof ProviderIds[keyof typeof ProviderIds];

// ============================================================================
// AZURE DEVOPS
// ============================================================================

export const AzureDevOpsConstants = {
  /** Base URL for Azure DevOps REST API */
  BASE_URL: 'https://dev.azure.com',
  
  /** VSTS/Legacy domain */
  LEGACY_DOMAIN: '.visualstudio.com',
  
  /** API versions */
  ApiVersions: {
    DEFAULT: '7.1-preview',
    GIT: '7.1-preview.1',
    BUILD: '7.1-preview.7',
    RELEASE: '7.1-preview.8',
    PIPELINES: '7.1-preview.1',
    WIT: '7.1-preview.3',
    CORE: '7.1-preview.4',
  },
  
  /** Work item fields */
  WorkItemFields: {
    ID: 'System.Id',
    TITLE: 'System.Title',
    STATE: 'System.State',
    WORK_ITEM_TYPE: 'System.WorkItemType',
    ASSIGNED_TO: 'System.AssignedTo',
    CREATED_DATE: 'System.CreatedDate',
    CHANGED_DATE: 'System.ChangedDate',
    AREA_PATH: 'System.AreaPath',
    ITERATION_PATH: 'System.IterationPath',
    TAGS: 'System.Tags',
    PRIORITY: 'Microsoft.VSTS.Common.Priority',
    SEVERITY: 'Microsoft.VSTS.Common.Severity',
    STORY_POINTS: 'Microsoft.VSTS.Scheduling.StoryPoints',
  },
  
  /** Standard fields to fetch */
  STANDARD_FIELDS: [
    'System.Id',
    'System.Title',
    'System.State',
    'System.WorkItemType',
    'System.AssignedTo',
    'System.CreatedDate',
    'System.ChangedDate',
    'System.Tags',
    'Microsoft.VSTS.Common.Priority',
  ].join(','),
} as const;

// ============================================================================
// JENKINS
// ============================================================================

export const JenkinsConstants = {
  /** API paths */
  Api: {
    BUILD_INFO: '/api/json',
    BUILD_LOG: '/consoleText',
    BUILD_QUEUE: '/queue/api/json',
    CRUMB: '/crumbIssuer/api/json',
  },
  
  /** Build results */
  BuildResults: {
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
    UNSTABLE: 'UNSTABLE',
    ABORTED: 'ABORTED',
    NOT_BUILT: 'NOT_BUILT',
  },
} as const;

// ============================================================================
// LLM PROVIDERS
// ============================================================================

export const LlmConstants = {
  /** Azure OpenAI */
  AzureOpenAI: {
    API_VERSION: '2024-02-15-preview',
    DEFAULT_DEPLOYMENT: 'gpt-4',
  },
  
  /** OpenAI */
  OpenAI: {
    BASE_URL: 'https://api.openai.com/v1',
    DEFAULT_MODEL: 'gpt-4-turbo-preview',
  },
  
  /** Anthropic */
  Anthropic: {
    BASE_URL: 'https://api.anthropic.com/v1',
    DEFAULT_MODEL: 'claude-3-opus-20240229',
    API_VERSION: '2023-06-01',
  },
  
  /** Token limits */
  TokenLimits: {
    GPT4_TURBO: 128000,
    GPT4: 8192,
    GPT35_TURBO: 16384,
    CLAUDE_3: 200000,
  },
} as const;

// ============================================================================
// HTTP HEADERS
// ============================================================================

export const HeaderConstants = {
  /** Authorization header names */
  AUTHORIZATION: 'Authorization',
  BEARER: 'Bearer',
  BASIC: 'Basic',
  
  /** Custom headers */
  SESSION_ID: 'X-Session-Id',
  AZURE_TOKEN: 'X-Azure-Token',
  DEVOPS_TOKEN: 'X-DevOps-Token',
  TENANT_ID: 'X-Tenant-Id',
  CORRELATION_ID: 'X-Correlation-Id',
  
  /** Content types */
  ContentTypes: {
    JSON: 'application/json',
    FORM: 'application/x-www-form-urlencoded',
    MULTIPART: 'multipart/form-data',
  },
} as const;

// ============================================================================
// API ROUTES
// ============================================================================

export const ApiRoutes = {
  /** Authentication */
  Auth: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },
  
  /** Session management */
  Session: {
    INITIALIZE: '/session/initialize',
    STATUS: '/session/status',
    REFRESH: '/session/refresh',
    INVALIDATE: '/session/invalidate',
  },
  
  /** Azure DevOps */
  DevOps: {
    STATS: '/devops/stats',
    PULL_REQUESTS: '/devops/pullrequests',
    BUILDS: '/devops/builds',
    WORK_ITEMS: '/devops/workitems',
    ORGANIZATIONS: '/devops/organizations',
    PROJECTS: '/devops/projects',
  },
  
  /** AI Query */
  AiQuery: {
    ASK: '/ai-query/ask',
    GENERATE_SQL: '/ai-query/generate-sql',
    SETTINGS: '/ai-query/settings',
  },
  
  /** Dashboard */
  Dashboard: {
    LIST: '/dashboard',
    BY_ID: (id: string) => `/dashboard/${id}`,
    WIDGETS: '/dashboard/widgets',
  },
} as const;

// ============================================================================
// UI CONSTANTS
// ============================================================================

export const UiConstants = {
  /** Default page sizes */
  PageSizes: {
    DEFAULT: 20,
    SMALL: 10,
    LARGE: 50,
    MAX: 100,
  },
  
  /** Refresh intervals (ms) */
  RefreshIntervals: {
    FAST: 10_000,      // 10 seconds
    NORMAL: 30_000,    // 30 seconds
    SLOW: 60_000,      // 1 minute
    VERY_SLOW: 300_000, // 5 minutes
  },
  
  /** Toast durations (ms) */
  ToastDurations: {
    SHORT: 3000,
    NORMAL: 5000,
    LONG: 8000,
  },
} as const;

// ============================================================================
// DASHBOARD DEFAULTS (mirrors backend DashboardConstants.cs)
// ============================================================================

export const DashboardConstants = {
  /** Default number of days to show PRs */
  PR_DAYS_BACK: 7,
  /** Default hours back for PR API calls (PR_DAYS_BACK * 24) */
  PR_HOURS_BACK: 7 * 24,
  /** Default number of days for commit stats */
  COMMIT_DAYS_BACK: 7,
  /** Max PRs to display in recent activity widget */
  RECENT_PR_DISPLAY_COUNT: 25,
} as const;
