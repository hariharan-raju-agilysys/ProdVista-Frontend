/**
 * Widget Modal Constants
 * All UI strings, configuration options, and labels
 */

// Data Source Types
export const DATA_SOURCE_TYPES = {
  STATIC: 'static',
  API: 'api',
  URL: 'url',
  EXCEL: 'excel',
  DOCUMENT: 'document',
  DATABASE: 'database',
  DATABASE_QUERY: 'database_query', // New: Database Query Widget
} as const

export type DataSourceType = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES]

// Auth Types
export const AUTH_TYPES = {
  NONE: 'none',
  BASIC: 'basic',
  BEARER: 'bearer',
  API_KEY: 'apikey',
} as const

export type AuthType = typeof AUTH_TYPES[keyof typeof AUTH_TYPES]

// Widget Sizes
export const WIDGET_SIZES = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  FULL: 'full',
} as const

export type WidgetSize = typeof WIDGET_SIZES[keyof typeof WIDGET_SIZES]

// UI Labels
export const LABELS = {
  // Modal
  MODAL_TITLE: 'Add Widget',
  
  // Steps
  STEP_1_TITLE: 'Widget Configuration',
  STEP_2_TITLE: 'Data Source',
  STEP_3_TITLE: 'Configure Data',
  STEP_4_TITLE: 'Preview & Confirm',
  
  // Step 1
  WIDGET_TYPE: 'Widget Type',
  WIDGET_TITLE: 'Widget Title',
  WIDGET_SIZE: 'Size',
  
  // Step 2
  DATA_SOURCE_TYPE: 'Data Source Type',
  DATA_KEY: 'Data Key',
  API_ENDPOINT_URL: 'API Endpoint URL',
  JSON_URL: 'JSON URL',
  JSON_PATH: 'JSON Path (optional)',
  JSON_PATH_HINT: 'Extract specific data from JSON response',
  EXCEL_FILE_URL: 'Excel File URL',
  SHEET_NAME: 'Sheet Name',
  CELL_RANGE: 'Cell Range',
  DOCUMENT_URL: 'Document URL',
  CONNECTION_STRING: 'Connection String / Endpoint',
  
  // Database Query Labels
  DATABASE_CONNECTION: 'Database Connection',
  SELECT_CONNECTION: 'Select a database connection',
  QUERY_CONFIG: 'Query Configuration',
  SELECT_QUERY: 'Select a saved query',
  OR_CREATE_NEW: 'Or create a new query',
  SQL_QUERY: 'SQL Query',
  SQL_QUERY_HINT: 'SELECT queries only. Be specific with columns for better performance.',
  CREATE_NEW_QUERY: 'Create New Query',
  USE_EXISTING_QUERY: 'Use Saved Query',
  NO_CONNECTIONS: 'No database connections available',
  NO_QUERIES: 'No saved queries available',
  
  // Step 3 (Settings) - moved from original step 3
  AUTO_REFRESH: 'Auto Refresh',
  AUTHENTICATION: 'Authentication',
  BEARER_TOKEN: 'Bearer Token',
  API_KEY_LABEL: 'API Key',
  BASIC_AUTH: 'Username:Password',
  
  // Step 4 (Preview)
  PREVIEW_TITLE: 'Data Preview',
  PREVIEW_LOADING: 'Loading preview data...',
  PREVIEW_ERROR: 'Failed to load preview',
  PREVIEW_NO_DATA: 'No data available',
  PREVIEW_ROWS: 'rows',
  PREVIEW_COLUMNS: 'columns',
  PREVIEW_SUCCESS: 'Data loaded successfully',
  RETRY_PREVIEW: 'Retry',
  SKIP_PREVIEW: 'Skip Preview',
  
  // Summary
  SUMMARY_TITLE: 'Widget Summary',
  SUMMARY_TYPE: 'Type:',
  SUMMARY_TITLE_LABEL: 'Title:',
  SUMMARY_SIZE: 'Size:',
  SUMMARY_DATA_SOURCE: 'Data Source:',
  SUMMARY_URL: 'URL:',
  SUMMARY_CONNECTION: 'Connection:',
  SUMMARY_QUERY: 'Query:',
  UNTITLED: 'Untitled',
  
  // Buttons
  CANCEL: 'Cancel',
  BACK: 'Back',
  NEXT: 'Next',
  PREVIEW_DATA: 'Preview Data',
  ADD_WIDGET: 'Add Widget',
  TEST_CONNECTION: 'Test Connection',
  EXECUTE_QUERY: 'Execute Query',
} as const

// Placeholders
export const PLACEHOLDERS = {
  WIDGET_TITLE: 'Enter widget title...',
  API_URL: 'https://api.example.com/data',
  JSON_PATH: 'data.items or $.results[*]',
  EXCEL_URL: 'https://example.com/data.xlsx or SharePoint URL',
  SHEET_NAME: 'Sheet1',
  CELL_RANGE: 'A1:D10',
  DOCUMENT_URL: 'https://example.com/document.json',
  DATABASE_CONNECTION: 'database-connection-id or endpoint',
  CREDENTIALS: 'Enter credentials...',
} as const

// Data Source Options with Icons
export const DATA_SOURCE_OPTIONS = [
  { 
    type: DATA_SOURCE_TYPES.STATIC, 
    label: 'Static Data', 
    iconName: 'Server',
    description: 'Use predefined sample data' 
  },
  { 
    type: DATA_SOURCE_TYPES.DATABASE_QUERY, 
    label: 'Database Query', 
    iconName: 'Database',
    description: 'Query from configured database connections' 
  },
  { 
    type: DATA_SOURCE_TYPES.API, 
    label: 'API Endpoint', 
    iconName: 'Globe',
    description: 'Fetch from REST API' 
  },
  { 
    type: DATA_SOURCE_TYPES.URL, 
    label: 'URL (JSON)', 
    iconName: 'Link',
    description: 'Load JSON from URL' 
  },
  { 
    type: DATA_SOURCE_TYPES.EXCEL, 
    label: 'Excel File', 
    iconName: 'FileSpreadsheet',
    description: 'Import from Excel/CSV' 
  },
  { 
    type: DATA_SOURCE_TYPES.DOCUMENT, 
    label: 'Document', 
    iconName: 'FileText',
    description: 'Parse structured document' 
  },
  { 
    type: DATA_SOURCE_TYPES.DATABASE, 
    label: 'Custom Database', 
    iconName: 'Database',
    description: 'Direct database connection string' 
  },
] as const

// Auth Options
export const AUTH_OPTIONS = [
  { value: AUTH_TYPES.NONE, label: 'No Authentication' },
  { value: AUTH_TYPES.BEARER, label: 'Bearer Token' },
  { value: AUTH_TYPES.API_KEY, label: 'API Key' },
  { value: AUTH_TYPES.BASIC, label: 'Basic Auth' },
] as const

// Refresh Interval Options
export const REFRESH_INTERVALS = [
  { value: 0, label: 'Manual Only' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 3600, label: '1 hour' },
] as const

// Widget Size Options
export const SIZE_OPTIONS: WidgetSize[] = [
  WIDGET_SIZES.SMALL,
  WIDGET_SIZES.MEDIUM,
  WIDGET_SIZES.LARGE,
  WIDGET_SIZES.FULL,
]

// Step Count (now includes preview step)
export const TOTAL_STEPS = 4
