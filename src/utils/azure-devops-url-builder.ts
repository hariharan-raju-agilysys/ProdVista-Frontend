// azure-devops-url-builder.ts
// 🔗 Centralized Azure DevOps URL builder for all entity types
// Used across DeveloperDashboard, DevOpsOverview, and Quality analytics

/**
 * Configuration for building Azure DevOps URLs
 */
export interface AzureDevOpsConfig {
  organizationUrl: string;  // e.g. "https://dev.azure.com/AGYS-VisualOne"
  projectName: string;      // e.g. "PMS"
}

/**
 * Generic entity type - accepts any JSON response from backend
 */
export type AzureDevOpsEntity = Record<string, any>;

/**
 * Centralized URL builder for all Azure DevOps entity types
 * Supports: Work Items, Pull Requests, Repositories, Builds, Releases, Commits
 */
export class AzureDevOpsUrlBuilder {
  /**
   * Build URL from any Azure DevOps entity
   * Auto-detects entity type and constructs appropriate URL
   */
  static build(entity: AzureDevOpsEntity, config?: AzureDevOpsConfig): string | null {
    if (!entity || typeof entity !== 'object') return null;

    // Work Item (Bug, Task, User Story, Feature, Epic)
    if (entity.id && this.isWorkItem(entity)) {
      return this.buildWorkItemUrl(entity, config);
    }

    // Pull Request
    if (entity.pullRequestId && entity.repository?.webUrl) {
      return `${entity.repository.webUrl}/pullrequest/${entity.pullRequestId}`;
    }

    // Repository
    if (entity.repository?.webUrl && !entity.pullRequestId) {
      return entity.repository.webUrl;
    }

    // Build
    if (entity.id && entity.buildNumber && entity._links?.web?.href) {
      return entity._links.web.href;
    }

    // Release
    if (entity.id && entity.releaseDefinition) {
      return this.buildReleaseUrl(entity, config);
    }

    // Commit
    if (entity.commitId && entity.url) {
      const org = this.extractOrganization(entity.url);
      const repo = entity.repositoryId || this.extractRepository(entity.url);
      return `https://dev.azure.com/${org}/${repo}/commit/${entity.commitId}`;
    }

    return null;
  }

  /**
   * Build Work Item URL (Bug, Task, User Story, Feature, Epic)
   * Smart URL construction from devOpsUrl or config + id
   */
  static buildWorkItemUrl(entity: AzureDevOpsEntity, config?: AzureDevOpsConfig): string | null {
    // Priority 1: Use pre-built devOpsUrl from backend
    if (entity.devOpsUrl && typeof entity.devOpsUrl === 'string' && entity.devOpsUrl.trim()) {
      return entity.devOpsUrl;
    }

    // Priority 2: Extract from entity.url field (if available)
    if (entity.url && typeof entity.url === 'string') {
      const org = this.extractOrganization(entity.url);
      const project = entity.fields?.["System.TeamProject"] || entity.project?.name;
      if (org && project && entity.id) {
        return `https://dev.azure.com/${org}/${project}/_workitems/edit/${entity.id}`;
      }
    }

    // Priority 3: Use provided config + id
    if (config && entity.id) {
      const org = this.extractOrganization(config.organizationUrl) || config.organizationUrl.split('/').pop();
      return `https://dev.azure.com/${org}/${config.projectName}/_workitems/edit/${entity.id}`;
    }

    // Fallback: Try to construct from entity fields
    if (entity.id) {
      const org = entity.organizationName || 'AGYS-VisualOne';
      const project = entity.projectName || 'PMS';
      return `https://dev.azure.com/${org}/${project}/_workitems/edit/${entity.id}`;
    }

    return null;
  }

  /**
   * Build Release URL
   */
  static buildReleaseUrl(entity: AzureDevOpsEntity, config?: AzureDevOpsConfig): string | null {
    const org = this.extractOrganization(entity.url) || config?.organizationUrl.split('/').pop() || 'AGYS-VisualOne';
    const project = entity.projectReference?.name || entity.projectName || config?.projectName || 'PMS';

    if (entity.id) {
      return `https://dev.azure.com/${org}/${project}/_releaseProgress?_a=release-pipeline-progress&releaseId=${entity.id}`;
    }
    return null;
  }

  /**
   * Build Pull Request URL
   */
  static buildPullRequestUrl(entity: AzureDevOpsEntity, _config?: AzureDevOpsConfig): string | null {
    if (!entity.pullRequestId) return null;
    if (entity.repository?.webUrl) {
      return `${entity.repository.webUrl}/pullrequest/${entity.pullRequestId}`;
    }
    return null;
  }

  /**
   * Build Commit URL
   */
  static buildCommitUrl(entity: AzureDevOpsEntity, config?: AzureDevOpsConfig): string | null {
    if (!entity.commitId) return null;
    const org = this.extractOrganization(entity.url) || config?.organizationUrl.split('/').pop() || 'AGYS-VisualOne';
    const repo = entity.repository?.name || entity.repositoryId || 'repo';
    const project = config?.projectName || 'PMS';
    return `https://dev.azure.com/${org}/${project}/_git/${repo}/commit/${entity.commitId}`;
  }

  /**
   * Check if entity is a work item (has workItemType or system type field)
   */
  private static isWorkItem(entity: AzureDevOpsEntity): boolean {
    return !!(
      (entity.workItemType && typeof entity.workItemType === 'string') ||
      (entity.fields?.["System.WorkItemType"] && typeof entity.fields["System.WorkItemType"] === 'string') ||
      (entity.type && ['Bug', 'Task', 'User Story', 'Feature', 'Epic'].includes(entity.type))
    );
  }

  /**
   * Extract organization from Azure DevOps URL
   * Handles formats:
   * - https://dev.azure.com/AGYS-VisualOne/...
   * - https://dev.azure.com/AGYS-VisualOne
   * - AGYS-VisualOne
   */
  static extractOrganization(urlOrOrg: string): string | null {
    if (!urlOrOrg) return null;

    // Already just the org name
    if (!urlOrOrg.includes('/') && !urlOrOrg.includes('https')) {
      return urlOrOrg;
    }

    // Extract from URL
    const match = urlOrOrg.match(/https:\/\/dev\.azure\.com\/([^/?#]+)/);
    return match?.[1] ?? null;
  }

  /**
   * Extract repository from Azure DevOps URL
   */
  private static extractRepository(url: string): string | null {
    const match = url.match(/\/([^/?#]+)\/repos\//);
    return match?.[1] ?? null;
  }

  /**
   * Normalize config with defaults
   */
  static normalizeConfig(config?: Partial<AzureDevOpsConfig>): AzureDevOpsConfig {
    return {
      organizationUrl: config?.organizationUrl || 'https://dev.azure.com/AGYS-VisualOne',
      projectName: config?.projectName || 'PMS',
    };
  }

  /**
   * Check if URL is valid Azure DevOps URL
   */
  static isValidUrl(url: string | null | undefined): url is string {
    return typeof url === 'string' && url.length > 0 && url.startsWith('https://dev.azure.com/');
  }
}