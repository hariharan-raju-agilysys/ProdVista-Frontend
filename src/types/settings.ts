/**
 * Shared Settings Types
 * Central type definitions for settings across the application
 */

// ============================================================================
// AI Provider Settings
// ============================================================================

export type AIProvider = 'Azure' | 'Aws' | 'OpenAI' | 'Anthropic';

export interface AIProviderConfig {
  provider: AIProvider;
  
  // Azure OpenAI
  azureEndpoint?: string;
  azureDeploymentName?: string;
  azureResourceId?: string;
  useAzureManagedIdentity?: boolean;
  
  // AWS Bedrock
  awsRegion?: string;
  awsModelId?: string;
  
  // OpenAI
  openAiApiKey?: string;
  openAiModel?: string;
  
  // Anthropic
  anthropicApiKey?: string;
  anthropicModel?: string;
}

export interface AIQuerySettings extends AIProviderConfig {
  isEnabled: boolean;
  maxQueryRows: number;
  queryTimeoutSeconds: number;
  defaultConnectionId?: string;
  allowedTables?: string;
  selectedDatabaseIds?: string[];
  enableCrossDatabaseJoins?: boolean;
  lastTestedAt?: string;
  lastTestSuccessful?: boolean;
}

// ============================================================================
// Database Connection Settings
// ============================================================================

export type DatabaseType = 'SqlServer' | 'PostgreSQL' | 'MySQL' | 'SQLite' | 'AzureSQL' | 'CosmosDB';
export type AuthenticationType = 'SqlAuth' | 'WindowsAuth' | 'AzureAD' | 'ManagedIdentity';
export type ConnectionMethod = 'ConnectionString' | 'IndividualFields';

export interface DatabaseConnectionConfig {
  id?: string;
  name: string;
  databaseType: DatabaseType;
  connectionMethod: ConnectionMethod;
  
  // Connection string method
  connectionString?: string;
  
  // Individual fields method
  serverName?: string;
  port?: number;
  databaseName?: string;
  authenticationType?: AuthenticationType;
  username?: string;
  password?: string;
  
  // Options
  useEncryption?: boolean;
  trustServerCertificate?: boolean;
  connectionTimeoutSeconds?: number;
  queryTimeoutSeconds?: number;
  
  // Azure Log Analytics
  workspaceId?: string;
  azureTenantId?: string;
  azureClientId?: string;
  
  // Metadata
  description?: string;
  isActive?: boolean;
  lastTestedAt?: string;
  lastTestSuccessful?: boolean;
}

// ============================================================================
// Feature Flags & Preferences
// ============================================================================

export interface FeatureFlags {
  enableAIQuery: boolean;
  enableMultiDatabase: boolean;
  enableCrossDatabaseJoins: boolean;
  enableAzureAutoDiscovery: boolean;
  enableDarkMode: boolean;
  enableNotifications: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  defaultDashboard?: string;
  sidebarCollapsed?: boolean;
  notificationsEnabled?: boolean;
}

// ============================================================================
// Form State Types
// ============================================================================

export interface SettingsFormState<T> {
  data: T;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// ============================================================================
// Update Request Types
// ============================================================================

export interface UpdateAIQuerySettingsRequest {
  isEnabled: boolean;
  provider: AIProvider;
  azureEndpoint?: string;
  azureDeploymentName?: string;
  useAzureManagedIdentity: boolean;
  maxQueryRows: number;
  queryTimeoutSeconds: number;
  defaultConnectionId?: string;
  allowedTables?: string;
  selectedDatabaseIds?: string[];
  enableCrossDatabaseJoins: boolean;
}

export interface UpdateDatabaseConnectionRequest {
  name: string;
  databaseType: DatabaseType;
  connectionMethod: ConnectionMethod;
  connectionString?: string;
  serverName?: string;
  port?: number;
  databaseName?: string;
  authenticationType?: AuthenticationType;
  username?: string;
  password?: string;
  useEncryption?: boolean;
  trustServerCertificate?: boolean;
  connectionTimeoutSeconds?: number;
  queryTimeoutSeconds?: number;
  description?: string;
  isActive?: boolean;
}
