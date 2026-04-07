import api from './api'

// Types
export interface AzureDevOpsConnection {
  id: string
  connectionName: string
  organizationUrl: string
  projectName: string
  isActive: boolean
  lastSyncAt?: string
  lastSyncStatus?: string
}

export interface CreateConnectionRequest {
  connectionName: string
  organizationUrl: string
  projectName: string
}

// Discovery types (Azure CLI based)
export interface AzureDevOpsOrganization {
  accountId: string
  accountName: string
  accountUri: string
}

export interface AzureDevOpsProject {
  id: string
  name: string
  description?: string
  state?: string
  visibility?: string
}

export interface AzureDevOpsUser {
  displayName?: string
  mailAddress?: string
  principalName?: string
}

export interface AzureDevOpsAreaPath {
  id: number
  name: string
  path: string
}

export interface AzureDevOpsIterationPath {
  id: number
  name: string
  path: string
  startDate?: string
  finishDate?: string
}

export interface AzureDevOpsSavedQuery {
  id: string
  name: string
  path: string
  queryType?: string
}

export interface ReleaseNoteTemplate {
  id: string
  name: string
  description: string
  templateFileName: string
  isActive: boolean
  version: number
  tableCount?: number
  dynamicFieldCount?: number
  tableMappings?: TableMapping[]
  dynamicFields?: DynamicField[]
}

export interface TableMapping {
  id: string
  tableName: string
  tableIdentifier: string
  displayOrder: number
  queryType: string
  workItemTypes?: string
  states?: string
  columnMappings: ColumnMapping[]
}

export interface ColumnMapping {
  id: string
  columnHeader: string
  azureDevOpsField: string
  columnOrder: number
}

export interface DynamicField {
  id: string
  fieldName: string
  displayName: string
  placeholder: string
  fieldType: 'Text' | 'Number' | 'Date' | 'DateTime' | 'Dropdown' | 'AutoIncrement' | 'UserPicker' | 'MultiSelect'
  isRequired: boolean
  defaultValue?: string
  isAutoIncrement: boolean
  displayOrder: number
}

export interface ReleaseConfiguration {
  id: string
  name: string
  description: string
  templateId: string
  templateName: string
  azureDevOpsConnectionId?: string
  connectionName?: string
  versionPattern: string
  lastReleaseVersion?: string
  lastReleaseDate?: string
  outputFileNamePattern: string
}

export interface CreateConfigurationRequest {
  name: string
  description?: string
  templateId: string
  azureDevOpsConnectionId?: string
  defaultBranch?: string
  defaultAssignedTo?: string
  defaultAreaPath?: string
  defaultIterationPath?: string
  versionPattern?: string
  outputFileNamePattern?: string
}

export interface NextVersionSuggestion {
  suggestedVersion: string
  majorVersion: number
  minorVersion: number
  patchVersion: number
  serialNumber: number
  releaseDate: string
}

export interface ReleaseNote {
  id: string
  releaseVersion: string
  releaseName: string
  releaseDate: string
  status: 'Draft' | 'InProgress' | 'PendingReview' | 'Approved' | 'Published' | 'Archived'
  templateName?: string
  assignedUserName?: string
  isLocked: boolean
  lockedByUserName?: string
  createdAt?: string
  generatedAt?: string
}

export interface ReleaseNoteDetail extends ReleaseNote {
  buildName?: string
  dockerImageName?: string
  lockedAt?: string
  dynamicFieldValues?: Record<string, string>
  template?: ReleaseNoteTemplate
  workItemsByTable: Record<string, WorkItem[]>
}

export interface CreateReleaseNoteRequest {
  configurationId: string
  releaseVersion: string
  releaseDate: string
  releaseName?: string
  description?: string
  assignedUserId?: string
  assignedUserName?: string
  buildName?: string
  dockerImageName?: string
  dynamicFieldValues?: Record<string, string>
}

export interface WorkItem {
  id: string
  azureDevOpsId: number
  workItemType: string
  title: string
  state: string
  assignedTo?: string
  description?: string
  tags?: string
  isIncluded: boolean
  userNotes?: string
  displayOrder: number
}

export interface FetchWorkItemsRequest {
  assignedTo?: string
  areaPath?: string
  iterationPath?: string
}

// Service class
class ReleaseNotesService {
  // Azure DevOps Discovery (using SSO via X-Azure-Token header)
  async discoverOrganizations(): Promise<AzureDevOpsOrganization[]> {
    const response = await api.get<{ organizations: AzureDevOpsOrganization[]; authMethod: string }>('/devops/discover/organizations')
    return response.data.organizations
  }

  async discoverProjects(organizationUrl: string): Promise<AzureDevOpsProject[]> {
    const response = await api.get<AzureDevOpsProject[]>('/devops/discover/projects', {
      params: { organizationUrl }
    })
    return response.data
  }

  async testDiscoveredConnection(organizationUrl: string, projectName: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/devops/discover/test', {
      organizationUrl,
      projectName
    })
    return response.data
  }

  // Azure DevOps Connections
  async getConnections(): Promise<AzureDevOpsConnection[]> {
    const response = await api.get<AzureDevOpsConnection[]>('/release-notes/connections')
    return response.data
  }

  async createConnection(request: CreateConnectionRequest): Promise<AzureDevOpsConnection> {
    const response = await api.post<AzureDevOpsConnection>('/release-notes/connections', request)
    return response.data
  }

  async testConnection(connectionId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(`/release-notes/connections/${connectionId}/test`)
    return response.data
  }

  async syncConnection(connectionId: string): Promise<{ users: number; areas: number; iterations: number; queries: number }> {
    const response = await api.post<{ users: number; areas: number; iterations: number; queries: number }>(`/release-notes/connections/${connectionId}/sync`)
    return response.data
  }

  async getConnectionUsers(connectionId: string): Promise<AzureDevOpsUser[]> {
    const response = await api.get<AzureDevOpsUser[]>(`/release-notes/connections/${connectionId}/users`)
    return response.data
  }

  async getConnectionAreas(connectionId: string): Promise<AzureDevOpsAreaPath[]> {
    const response = await api.get<AzureDevOpsAreaPath[]>(`/release-notes/connections/${connectionId}/areas`)
    return response.data
  }

  async getConnectionIterations(connectionId: string): Promise<AzureDevOpsIterationPath[]> {
    const response = await api.get<AzureDevOpsIterationPath[]>(`/release-notes/connections/${connectionId}/iterations`)
    return response.data
  }

  async getConnectionQueries(connectionId: string): Promise<AzureDevOpsSavedQuery[]> {
    const response = await api.get<AzureDevOpsSavedQuery[]>(`/release-notes/connections/${connectionId}/queries`)
    return response.data
  }

  // Templates
  async getTemplates(): Promise<ReleaseNoteTemplate[]> {
    const response = await api.get<ReleaseNoteTemplate[]>('/release-notes/templates')
    return response.data
  }

  async getTemplate(templateId: string): Promise<ReleaseNoteTemplate> {
    const response = await api.get<ReleaseNoteTemplate>(`/release-notes/templates/${templateId}`)
    return response.data
  }

  async createTemplate(request: FormData): Promise<ReleaseNoteTemplate> {
    const response = await api.post<ReleaseNoteTemplate>('/release-notes/templates', request, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  }

  async addTableMapping(templateId: string, request: Partial<TableMapping>): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>(`/release-notes/templates/${templateId}/table-mappings`, request)
    return response.data
  }

  async addColumnMapping(tableMappingId: string, request: Partial<ColumnMapping>): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>(`/release-notes/table-mappings/${tableMappingId}/columns`, request)
    return response.data
  }

  async addDynamicField(templateId: string, request: Partial<DynamicField>): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>(`/release-notes/templates/${templateId}/dynamic-fields`, request)
    return response.data
  }

  // Configurations
  async getConfigurations(): Promise<ReleaseConfiguration[]> {
    const response = await api.get<ReleaseConfiguration[]>('/release-notes/configurations')
    return response.data
  }

  async createConfiguration(request: CreateConfigurationRequest): Promise<ReleaseConfiguration> {
    const response = await api.post<ReleaseConfiguration>('/release-notes/configurations', request)
    return response.data
  }

  async getNextVersion(configId: string): Promise<NextVersionSuggestion> {
    const response = await api.get<NextVersionSuggestion>(`/release-notes/configurations/${configId}/next-version`)
    return response.data
  }

  // Release Notes
  async getReleaseNotes(status?: string, limit = 50): Promise<ReleaseNote[]> {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    params.set('limit', limit.toString())
    const response = await api.get<ReleaseNote[]>(`/release-notes?${params}`)
    return response.data
  }

  async getReleaseNote(releaseNoteId: string): Promise<ReleaseNoteDetail> {
    const response = await api.get<ReleaseNoteDetail>(`/release-notes/${releaseNoteId}`)
    return response.data
  }

  async createReleaseNote(request: CreateReleaseNoteRequest): Promise<ReleaseNote> {
    const response = await api.post<ReleaseNote>('/release-notes', request)
    return response.data
  }

  async fetchWorkItems(releaseNoteId: string, request: FetchWorkItemsRequest): Promise<WorkItem[]> {
    const response = await api.post<WorkItem[]>(`/release-notes/${releaseNoteId}/fetch-work-items`, request)
    return response.data
  }

  async lockReleaseNote(releaseNoteId: string): Promise<{ locked: boolean; lockedBy: string }> {
    const response = await api.post<{ locked: boolean; lockedBy: string }>(`/release-notes/${releaseNoteId}/lock`)
    return response.data
  }

  async unlockReleaseNote(releaseNoteId: string): Promise<{ locked: boolean }> {
    const response = await api.post<{ locked: boolean }>(`/release-notes/${releaseNoteId}/unlock`)
    return response.data
  }

  async updateWorkItem(releaseNoteId: string, workItemId: string, request: { isIncluded: boolean; userNotes?: string; displayOrder: number }): Promise<void> {
    await api.put(`/release-notes/${releaseNoteId}/work-items/${workItemId}`, request)
  }

  async updateStatus(releaseNoteId: string, status: string): Promise<{ status: string }> {
    const response = await api.put<{ status: string }>(`/release-notes/${releaseNoteId}/status`, { status })
    return response.data
  }
}

export const releaseNotesService = new ReleaseNotesService()
export default releaseNotesService
