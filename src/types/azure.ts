/**
 * Shared Azure Resource Types
 * Central type definitions for Azure resources across the application
 */

// ============================================================================
// Azure Subscription & Resource Group
// ============================================================================

export interface AzureSubscription {
  id: string;
  subscriptionId: string;
  displayName: string;
  state: 'Enabled' | 'Disabled' | 'Warned' | 'PastDue' | 'Deleted';
  tenantId?: string;
}

export interface AzureResourceGroup {
  id: string;
  name: string;
  location: string;
  subscriptionId: string;
  tags?: Record<string, string>;
}

// ============================================================================
// Azure OpenAI Resources
// ============================================================================

export interface AzureOpenAIResource {
  id: string;
  name: string;
  displayName: string;
  endpoint: string;
  location: string;
  subscriptionId: string;
  resourceGroup: string;
  sku?: string;
  kind?: string;
  provisioningState?: string;
  tags?: Record<string, string>;
}

export interface AzureOpenAIDeployment {
  id: string;
  name: string;
  displayName: string;
  model: string;
  modelVersion?: string;
  capacity?: number;
  scaleType?: string;
  provisioningState?: string;
  createdAt?: string;
}

export interface AzureOpenAIModel {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  capabilities: string[];
  maxTokens?: number;
  isDeprecated?: boolean;
}

// ============================================================================
// Azure SQL & Database Resources
// ============================================================================

export interface AzureSqlServer {
  id: string;
  name: string;
  fullyQualifiedDomainName: string;
  location: string;
  subscriptionId: string;
  resourceGroup: string;
  administratorLogin?: string;
  version?: string;
  state?: string;
}

export interface AzureSqlDatabase {
  id: string;
  name: string;
  displayName: string;
  serverName: string;
  location: string;
  subscriptionId: string;
  resourceGroup: string;
  status?: string;
  edition?: string;
  tier?: string;
  serviceLevelObjective?: string;
  maxSizeBytes?: number;
  connectionString?: string;
}

// ============================================================================
// Discovery Results
// ============================================================================

export interface AzureDiscoveryResult {
  success: boolean;
  subscriptions: AzureSubscription[];
  openAIResources: AzureOpenAIResource[];
  sqlServers: AzureSqlServer[];
  databases: AzureSqlDatabase[];
  discoveredAt: string;
  errorMessage?: string;
}

export interface AzureAutoConfigResult {
  success: boolean;
  message: string;
  discoveredSubscriptions: number;
  discoveredOpenAIResources: number;
  discoveredDeployments: number;
  discoveredDatabases: number;
  suggestedEndpoint?: string;
  suggestedDeployment?: string;
  suggestedDatabase?: string;
}

// ============================================================================
// Selection State
// ============================================================================

export interface AzureResourceSelection {
  subscription?: AzureSubscription;
  resourceGroup?: AzureResourceGroup;
  openAIResource?: AzureOpenAIResource;
  deployment?: AzureOpenAIDeployment;
  sqlServer?: AzureSqlServer;
  database?: AzureSqlDatabase;
}

export interface AzureOpenAIConfig {
  endpoint: string;
  deploymentName: string;
  useManagedIdentity: boolean;
  apiKey?: string;
  resourceId?: string;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface AzureResourceSelectorProps {
  selectedResource?: AzureOpenAIResource;
  selectedDeployment?: AzureOpenAIDeployment;
  onResourceChange: (resource: AzureOpenAIResource | undefined) => void;
  onDeploymentChange: (deployment: AzureOpenAIDeployment | undefined) => void;
  onConfigChange?: (config: AzureOpenAIConfig) => void;
  showManagedIdentityOption?: boolean;
  useManagedIdentity?: boolean;
  onManagedIdentityChange?: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export interface DatabaseSelectorProps {
  connections: DatabaseConnection[];
  selectedConnectionId?: string;
  selectedConnectionIds?: string[];
  onConnectionChange?: (connectionId: string | undefined) => void;
  onMultipleConnectionsChange?: (connectionIds: string[]) => void;
  multiSelect?: boolean;
  showCrossDatabaseOption?: boolean;
  enableCrossDatabaseJoins?: boolean;
  onCrossDatabaseJoinsChange?: (value: boolean) => void;
  showAzureDiscovery?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  databaseType: string;
  databaseName?: string;
  serverName?: string;
  connectionString?: string;
  isActive?: boolean;
  isConnected?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AzureDiscoveryResponse {
  success: boolean;
  subscriptions: AzureSubscription[];
  resources: AzureOpenAIResource[];
  deployments: AzureOpenAIDeployment[];
  databases: AzureSqlDatabase[];
  message?: string;
  errorMessage?: string;
}

export interface DeploymentListResponse {
  deployments: AzureOpenAIDeployment[];
  resourceId: string;
  resourceName: string;
}
