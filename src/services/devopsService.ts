import api from './api'

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

class DevopsService {
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
}

export const devopsService = new DevopsService()
export default devopsService
