import api from './api'

// ==========================================
// Types
// ==========================================

export interface TenantFeatureConfig {
  authProvider: string
  authSettings: string
  cloudProvider: string
  cloudSettings: string
  monitoringProvider: string
  monitoringSettings: string
  aiProvider: string
  aiSettings: string
  cicdProvider: string
  cicdSettings: string
  sourceControlProvider: string
  sourceControlSettings: string
  databaseProvider: string
  databaseSettings: string
  enabledFeatures: string
  themeSettings: string
  brandingSettings: string
}

export interface ProviderOption {
  id: string
  displayName: string
  description: string
  adapterType: string
  requiredSettings: string[]
}

export interface CreateTenantRequest {
  code: string
  name: string
  description?: string
  adminEmail: string
  adminUsername?: string
  adminPassword?: string
  adminName?: string
  primaryColor?: string
  plan?: string
  maxUsers?: number
  authProvider?: string
  cloudProvider?: string
}

export interface TenantSetupResponse {
  success: boolean
  message: string
  tenantId?: string
  tenantCode?: string
}

export interface TenantSummary {
  id: string
  code: string
  name: string
  plan: string
  isActive: boolean
  userCount: number
  createdAt: string
}

export interface MenuReorderItem {
  id: string
  displayOrder: number
  name?: string
  icon?: string
  isActive?: boolean
}

export interface AdapterHealthResult {
  isHealthy: boolean
  message: string
  latencyMs: number
  details: Record<string, string>
}

// ==========================================
// Tenant Management
// ==========================================

export const createTenant = (request: CreateTenantRequest) =>
  api.post<TenantSetupResponse>('/tenant-setup/tenants', request).then(r => r.data)

export const listTenants = () =>
  api.get<TenantSummary[]>('/tenant-setup/tenants').then(r => r.data)

// ==========================================
// Feature Config
// ==========================================

export const getFeatureConfig = () =>
  api.get<TenantFeatureConfig>('/tenant-setup/config').then(r => r.data)

export const updateFeatureConfig = (config: Partial<TenantFeatureConfig>) =>
  api.put<TenantFeatureConfig>('/tenant-setup/config', config).then(r => r.data)

// ==========================================
// Providers
// ==========================================

export const getAllProviders = () =>
  api.get<Record<string, ProviderOption[]>>('/tenant-setup/providers').then(r => r.data)

export const getProvidersByType = (adapterType: string) =>
  api.get<ProviderOption[]>(`/tenant-setup/providers/${adapterType}`).then(r => r.data)

// ==========================================
// Health Check
// ==========================================

export const checkAdapterHealth = (adapterType: string) =>
  api.get<AdapterHealthResult>(`/tenant-setup/health/${adapterType}`).then(r => r.data)

// ==========================================
// Menu Management
// ==========================================

export const reorderMenu = (items: MenuReorderItem[]) =>
  api.put('/tenant-setup/menu/reorder', items).then(r => r.data)

export const updateMenuItem = (id: string, update: { name?: string; icon?: string; isActive?: boolean; requiredRole?: string; category?: string }) =>
  api.put(`/tenant-setup/menu/${id}`, update).then(r => r.data)
