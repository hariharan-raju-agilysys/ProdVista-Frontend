import api from './api'

// ==========================================
// Types
// ==========================================

export interface DevTeamMemberDto {
  id: string
  entraObjectId?: string
  devOpsIdentityGuid?: string
  devOpsUniqueName?: string
  displayName: string
  email: string
  jobTitle?: string
  department?: string
  avatarUrl?: string
  isActive: boolean
  lastSyncedAt?: string
}

export interface GlobalSearchResult {
  query: string
  hits: SearchHit[]
  totalCount: number
}

export interface SearchHit {
  hitType: string
  title: string
  subtitle?: string
  url?: string
  relevance: number
  metadata?: Record<string, string>
}

export interface BranchTenantDetail {
  mapping: BranchTenantMappingDto
  recentCommits: CommitSummary[]
  buildHealth?: BuildHealthSnapshotDto
}

export interface CommitSummary {
  commitId: string
  shortId: string
  message: string
  author: string
  date: string
}

export interface BranchTenantMappingDto {
  id: string
  branchName: string
  targetTenantId: string
  targetPropertyId?: string
  environment: string
  repositoryName?: string
  lastDeployedCommitSha?: string
  lastDeployedAt?: string
  isActive: boolean
}

export interface UpsertBranchTenantMappingRequest {
  id?: string
  branchName: string
  targetTenantId: string
  targetPropertyId?: string
  environment: string
  repositoryName?: string
}

export interface BuildHealthSnapshotDto {
  id: string
  branchName: string
  buildDefinitionName?: string
  source: string
  totalBuildsAnalyzed: number
  successCount: number
  failureCount: number
  failureRate: number
  riskScore: number
  avgDurationMs: number
  lastBuildResult?: string
  lastBuildAt?: string
  recentBuildResultsJson: string
  recommendation?: string
  computedAt: string
}

export interface AttentionQueueResult {
  items: AttentionItem[]
  criticalCount: number
  warningCount: number
  infoCount: number
}

export interface AttentionItem {
  category: string
  priority: string
  title: string
  subtitle?: string
  url?: string
  ageDays?: number
  metadata?: Record<string, string>
}

export interface QualityIndexSnapshotDto {
  id: string
  developerName: string
  periodName: string
  periodStart: string
  periodEnd: string
  prsMerged: number
  codeReviewsCompleted: number
  workItemsResolved: number
  productionBugsIntroduced: number
  bugsFixed: number
  qualityIndex: number
}

// ==========================================
// API Calls
// ==========================================

const BASE = '/dev-intelligence'

export const devIntelligenceService = {
  // Team Members
  getTeamMembers: () =>
    api.get<DevTeamMemberDto[]>(`${BASE}/team-members`),

  syncTeamMembers: (connectionId: string) =>
    api.post<DevTeamMemberDto[]>(`${BASE}/sync-team?connectionId=${connectionId}`),

  // Global Search
  globalSearch: (query: string) =>
    api.get<GlobalSearchResult>(`${BASE}/search`, { params: { q: query } }),

  // Branch-to-Tenant
  getBranchForTenant: (tenantId: string, propertyId?: string) =>
    api.get<BranchTenantDetail>(`${BASE}/branch-tenant`, { params: { tenantId, propertyId } }),

  getBranchTenantMappings: () =>
    api.get<BranchTenantMappingDto[]>(`${BASE}/branch-tenant-mappings`),

  upsertBranchTenantMapping: (request: UpsertBranchTenantMappingRequest) =>
    api.post<BranchTenantMappingDto>(`${BASE}/branch-tenant-mappings`, request),

  // Build Health
  getBuildHealth: () =>
    api.get<BuildHealthSnapshotDto[]>(`${BASE}/build-health`),

  refreshBuildHealth: (branchName: string) =>
    api.post<BuildHealthSnapshotDto>(`${BASE}/build-health/refresh?branchName=${encodeURIComponent(branchName)}`),

  // Attention Queue
  getAttentionQueue: (devOpsUniqueName: string) =>
    api.get<AttentionQueueResult>(`${BASE}/attention-queue`, { params: { devOpsUniqueName } }),

  // Quality Index
  getQualityIndex: (period?: string) =>
    api.get<QualityIndexSnapshotDto[]>(`${BASE}/quality-index`, { params: { period } }),
}

export default devIntelligenceService
