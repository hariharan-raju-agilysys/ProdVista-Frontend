import api from './api';

export interface AiAskQuestionRequest {
  question: string;
  connectionId?: string;
  azureDatabaseId?: string;  // Azure SQL database resource ID (for managed identity auth)
  executeQuery?: boolean;
  maxRows?: number;
}

export interface AiGenerateSqlRequest {
  question: string;
  connectionId: string;
}

export interface AiQueryResponse {
  success: boolean;
  generatedSql?: string;
  data?: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  errorMessage?: string;
  errorCode?: string;
  provider: string;
  executedAt: string;
  explanation?: string;
  performanceNotes?: string;
  validationStatus?: string;
  suggestedCsvName?: string;
}

export interface SqlGenerationResult {
  success: boolean;
  sql?: string;
  explanation?: string;
  errorMessage?: string;
  tokenCount: number;
  generationTime: string;
}

export interface SqlValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  queryType: string;
  tablesReferenced: string[];
}

export interface DatabaseSchemaContext {
  tables: TableSchema[];
  views: ViewSchema[];
  databaseName?: string;
  extractedAt: string;
}

export interface TableSchema {
  name: string;
  schema: string;
  columns: ColumnSchema[];
  rowCount?: number;
  primaryKeyColumns: string[];
  foreignKeys: ForeignKey[];
}

export interface ViewSchema {
  name: string;
  schema: string;
  columns: ColumnSchema[];
}

export interface ColumnSchema {
  name: string;
  dataType: string;
  isNullable: boolean;
  maxLength?: number;
  isPrimaryKey: boolean;
  sampleValues: string[];
}

export interface ForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface ProviderTestResult {
  success: boolean;
  message: string;
  provider?: string;
  responseTime: string;
  testedAt: string;
}

export interface AiQuerySettings {
  isEnabled: boolean;
  provider: string;
  azureEndpoint?: string;
  azureDeploymentName?: string;
  useAzureManagedIdentity: boolean;
  maxQueryRows: number;
  queryTimeoutSeconds: number;
  defaultConnectionId?: string;
  allowedTables?: string;
  lastTestedAt?: string;
  lastTestSuccessful?: boolean;
  selectedDatabaseIds?: string[];
  enableCrossDatabaseJoins: boolean;
  // Azure SQL database selections (resource IDs are strings)
  selectedAzureDatabaseIds?: string[];
  defaultAzureDatabaseId?: string;
  // RAG settings
  enableRagCache: boolean;
  embeddingDeploymentName?: string;
  ragSimilarityThreshold: number;
  ragAutoStore: boolean;
}

export interface UpdateAiQuerySettingsRequest {
  isEnabled: boolean;
  provider: string;
  azureEndpoint?: string;
  azureDeploymentName?: string;
  useAzureManagedIdentity: boolean;
  maxQueryRows: number;
  queryTimeoutSeconds: number;
  defaultConnectionId?: string;
  allowedTables?: string;
  selectedDatabaseIds?: string[];
  enableCrossDatabaseJoins: boolean;
  // Azure SQL database selections (resource IDs are strings)
  selectedAzureDatabaseIds?: string[];
  defaultAzureDatabaseId?: string;
  // RAG settings
  enableRagCache: boolean;
  embeddingDeploymentName?: string;
  ragSimilarityThreshold: number;
  ragAutoStore: boolean;
}

export interface RagEntry {
  id: string;
  naturalLanguageQuery: string;
  generatedSql: string;
  databaseName?: string;
  hitCount: number;
  lastHitAt: string;
  isVerified: boolean;
  isActive: boolean;
  hasEmbedding: boolean;
  createdAt: string;
  tags?: string;
}

// Multi-database schema types
export interface MultiDatabaseSchemaContext {
  databases: DatabaseSchemaInfo[];
  tables: CrossDatabaseTableSchema[];
  supportsCrossJoin: boolean;
}

export interface DatabaseSchemaInfo {
  connectionId: string;
  databaseName: string;
  serverName: string;
  databaseType: string;
  tableCount: number;
}

export interface CrossDatabaseTableSchema {
  databaseName: string;
  tableName: string;
  fullyQualifiedName: string;
  columns: ColumnSchema[];
  foreignKeys: CrossDatabaseForeignKey[];
}

export interface CrossDatabaseForeignKey {
  columnName: string;
  referencedDatabase: string;
  referencedTable: string;
  referencedColumn: string;
}

// Auto-discovery types
export interface AzureOpenAIResource {
  id: string;
  name: string;
  resourceGroup: string;
  location: string;
  subscriptionId: string;
  endpoint: string;
  kind: string;
  skuName: string;
  displayName: string;
}

export interface AzureOpenAIDeployment {
  id: string;
  name: string;
  model: string;
  modelVersion: string;
  capacity?: number;
  status: string;
  displayName: string;
}

export interface DiscoveredDatabase {
  id: string;
  name: string;
  serverName: string;
  resourceGroup: string;
  subscriptionId: string;
  location: string;
  kind: string;
  status: string;
  connectionString?: string;
  displayName: string;
}

export interface DatabaseTestResult {
  success: boolean;
  serverVersion?: string;
  databaseName?: string;
  tableCount: number;
  latencyMs: number;
  errorMessage?: string;
}

export interface AutoConfigureResult {
  discoveredOpenAIResources: number;
  discoveredDeployments: number;
  discoveredDatabases: number;
  recommendedEndpoint?: string;
  recommendedResourceName?: string;
  recommendedDeployment?: string;
  recommendedModel?: string;
  recommendedConnectionString?: string;
  databaseTestResult?: DatabaseTestResult;
  isReadyToEnable: boolean;
}

class AiQueryService {
  private readonly baseUrl = '/ai-query';
  private readonly discoveryUrl = '/ai-query/discovery';

  async askQuestion(request: AiAskQuestionRequest): Promise<AiQueryResponse> {
    const response = await api.post<AiQueryResponse>(`${this.baseUrl}/ask`, request);
    return response.data;
  }

  async generateSql(request: AiGenerateSqlRequest): Promise<SqlGenerationResult> {
    const response = await api.post<SqlGenerationResult>(`${this.baseUrl}/generate-sql`, request);
    return response.data;
  }

  async validateSql(sql: string): Promise<SqlValidationResult> {
    const response = await api.post<SqlValidationResult>(`${this.baseUrl}/validate-sql`, { sql });
    return response.data;
  }

  async getSchema(connectionId: string): Promise<DatabaseSchemaContext> {
    const response = await api.get<DatabaseSchemaContext>(`${this.baseUrl}/schema/${connectionId}`);
    return response.data;
  }

  async getMultiDatabaseSchema(connectionIds: string[], tableFilter?: string): Promise<MultiDatabaseSchemaContext> {
    const response = await api.post<MultiDatabaseSchemaContext>(
      `${this.baseUrl}/schema/multi`,
      { connectionIds, tableFilter }
    );
    return response.data;
  }

  async testProvider(): Promise<ProviderTestResult> {
    const response = await api.post<ProviderTestResult>(`${this.baseUrl}/test`);
    return response.data;
  }

  async getSettings(): Promise<AiQuerySettings> {
    const response = await api.get<AiQuerySettings>(`${this.baseUrl}/settings`);
    return response.data;
  }

  async updateSettings(settings: UpdateAiQuerySettingsRequest): Promise<AiQuerySettings> {
    const response = await api.put<AiQuerySettings>(`${this.baseUrl}/settings`, settings);
    return response.data;
  }

  // Auto-discovery methods
  async discoverOpenAIResources(subscriptionIds?: string[]): Promise<{ count: number; resources: AzureOpenAIResource[] }> {
    const params = subscriptionIds?.length ? `?subscriptionIds=${subscriptionIds.join(',')}` : '';
    const response = await api.get<{ count: number; resources: AzureOpenAIResource[] }>(
      `${this.discoveryUrl}/openai-resources${params}`
    );
    return response.data;
  }

  async getOpenAIDeployments(resourceId: string): Promise<{ count: number; deployments: AzureOpenAIDeployment[] }> {
    // Base64 encode the resourceId to handle slashes
    const encodedId = btoa(resourceId);
    const response = await api.get<{ resourceId: string; count: number; deployments: AzureOpenAIDeployment[] }>(
      `${this.discoveryUrl}/openai-resources/${encodedId}/deployments`
    );
    return response.data;
  }

  async discoverDatabases(subscriptionIds?: string[]): Promise<{ count: number; databases: DiscoveredDatabase[] }> {
    const params = subscriptionIds?.length ? `?subscriptionIds=${subscriptionIds.join(',')}` : '';
    const response = await api.get<{ count: number; databases: DiscoveredDatabase[] }>(
      `${this.discoveryUrl}/databases${params}`
    );
    return response.data;
  }

  async testDatabaseConnection(connectionString: string): Promise<DatabaseTestResult> {
    const response = await api.post<DatabaseTestResult>(
      `${this.discoveryUrl}/databases/test`,
      { connectionString }
    );
    return response.data;
  }

  async autoConfigureSettings(subscriptionIds?: string[], testConnectionString?: string): Promise<AutoConfigureResult> {
    const response = await api.post<AutoConfigureResult>(
      `${this.discoveryUrl}/auto-configure`,
      { subscriptionIds, testConnectionString }
    );
    return response.data;
  }

  // RAG Knowledge Base methods
  async getRagEntries(activeOnly = true): Promise<RagEntry[]> {
    const response = await api.get<RagEntry[]>(`${this.baseUrl}/rag/entries`, {
      params: { activeOnly }
    });
    return response.data;
  }

  async toggleRagEntry(entryId: string): Promise<{ success: boolean }> {
    const response = await api.post<{ success: boolean }>(`${this.baseUrl}/rag/entries/${entryId}/toggle`);
    return response.data;
  }

  async verifyRagEntry(entryId: string): Promise<{ success: boolean }> {
    const response = await api.post<{ success: boolean }>(`${this.baseUrl}/rag/entries/${entryId}/verify`);
    return response.data;
  }

  async deleteRagEntry(entryId: string): Promise<{ success: boolean }> {
    const response = await api.delete<{ success: boolean }>(`${this.baseUrl}/rag/entries/${entryId}`);
    return response.data;
  }

  async rebuildEmbeddings(): Promise<{ rebuilt: number }> {
    const response = await api.post<{ rebuilt: number }>(`${this.baseUrl}/rag/rebuild-embeddings`);
    return response.data;
  }

  async exportCsv(data: Record<string, unknown>[], suggestedFilename?: string): Promise<void> {
    const response = await api.post(`${this.baseUrl}/export-csv`, {
      data,
      suggestedFilename
    }, {
      responseType: 'blob'
    });
    
    // Trigger download
    const blob = new Blob([response.data as BlobPart], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFilename?.replace('YYYYMMDD', new Date().toISOString().slice(0, 10).replace(/-/g, '')) 
      || `query_export_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

export const aiQueryService = new AiQueryService();
export default aiQueryService;
