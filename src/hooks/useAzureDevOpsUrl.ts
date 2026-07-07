// useAzureDevOpsUrl.ts
// 🔗 Custom hook for building Azure DevOps URLs
// Provides type-safe URL builders for work items, PRs, commits, etc.

import { useMemo } from 'react';
import { AzureDevOpsUrlBuilder, type AzureDevOpsConfig, type AzureDevOpsEntity } from '../utils/azure-devops-url-builder';

/**
 * Configuration hook - returns default or custom Azure DevOps config
 */
export function useAzureDevOpsConfig(custom?: Partial<AzureDevOpsConfig>): AzureDevOpsConfig {
  return useMemo(() => AzureDevOpsUrlBuilder.normalizeConfig(custom), [custom]);
}

/**
 * Build URL for any entity - auto-detects type
 */
export function useEntityUrl(entity: AzureDevOpsEntity | null, config?: AzureDevOpsConfig): string | null {
  return useMemo(() => {
    if (!entity) return null;
    return AzureDevOpsUrlBuilder.build(entity, config);
  }, [entity, config]);
}

/**
 * Build work item URL specifically
 */
export function useWorkItemUrl(entity: AzureDevOpsEntity | null, config?: AzureDevOpsConfig): string | null {
  return useMemo(() => {
    if (!entity) return null;
    return AzureDevOpsUrlBuilder.buildWorkItemUrl(entity, config);
  }, [entity, config]);
}

/**
 * Build pull request URL
 */
export function usePullRequestUrl(entity: AzureDevOpsEntity | null, config?: AzureDevOpsConfig): string | null {
  return useMemo(() => {
    if (!entity) return null;
    return AzureDevOpsUrlBuilder.buildPullRequestUrl(entity, config);
  }, [entity, config]);
}

/**
 * Build commit URL
 */
export function useCommitUrl(entity: AzureDevOpsEntity | null, config?: AzureDevOpsConfig): string | null {
  return useMemo(() => {
    if (!entity) return null;
    return AzureDevOpsUrlBuilder.buildCommitUrl(entity, config);
  }, [entity, config]);
}

/**
 * Build release URL
 */
export function useReleaseUrl(entity: AzureDevOpsEntity | null, config?: AzureDevOpsConfig): string | null {
  return useMemo(() => {
    if (!entity) return null;
    return AzureDevOpsUrlBuilder.buildReleaseUrl(entity, config);
  }, [entity, config]);
}

/**
 * Transform array of entities to include devOpsUrl
 * Useful for enriching API responses
 */
export function useEntityUrls<T extends AzureDevOpsEntity>(
  entities: T[] | null,
  config?: AzureDevOpsConfig
): (T & { devOpsUrl: string })[] | null {
  return useMemo(() => {
    if (!entities) return null;
    const normalizedConfig = config || AzureDevOpsUrlBuilder.normalizeConfig();
    return entities.map(entity => ({
      ...entity,
      devOpsUrl: AzureDevOpsUrlBuilder.build(entity, normalizedConfig) || '',
    }));
  }, [entities, config]);
}

/**
 * Check if URL is valid Azure DevOps URL
 */
export function useIsValidAzureDevOpsUrl(url: string | null | undefined): boolean {
  return useMemo(() => AzureDevOpsUrlBuilder.isValidUrl(url), [url]);
}
