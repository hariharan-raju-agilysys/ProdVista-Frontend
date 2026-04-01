import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AzureRegion {
  id: string
  name: string
  displayName: string
  isEnabled: boolean
  isDefault: boolean
}

export interface LLMConfig {
  provider: 'azure-openai' | 'openai'
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  apiKey?: string
}

export interface AzureConfig {
  subscriptionId: string
  tenantId: string
  storageAccounts: StorageAccountConfig[]
  applicationInsights: AppInsightsConfig[]
  regions: AzureRegion[]
}

export interface StorageAccountConfig {
  id: string
  name: string
  resourceGroup: string
  subscriptionId: string
  containers: string[]
  isEnabled: boolean
}

export interface AppInsightsConfig {
  id: string
  name: string
  resourceGroup: string
  subscriptionId: string
  region: string
  instrumentationKey: string
  isEnabled: boolean
}

export interface UserRole {
  role: 'manager' | 'user' | 'viewer'
  permissions: string[]
}

export interface AppSettings {
  llm: LLMConfig
  azure: AzureConfig
  dashboardRefreshInterval: number
  theme: 'light' | 'dark' | 'system'
  defaultRegions: string[]
  enabledFeatures: {
    aiPredictions: boolean
    logAnalysis: boolean
    costAnalysis: boolean
    alerts: boolean
  }
}

interface SettingsState {
  settings: AppSettings
  userRole: UserRole
  isConfigured: boolean
  updateLLMConfig: (config: Partial<LLMConfig>) => void
  updateAzureConfig: (config: Partial<AzureConfig>) => void
  updateSettings: (settings: Partial<AppSettings>) => void
  setUserRole: (role: UserRole) => void
  addStorageAccount: (account: StorageAccountConfig) => void
  removeStorageAccount: (id: string) => void
  addAppInsights: (appInsights: AppInsightsConfig) => void
  removeAppInsights: (id: string) => void
  toggleRegion: (regionId: string) => void
  resetToDefaults: () => void
}

const defaultRegions: AzureRegion[] = [
  { id: 'eastus', name: 'eastus', displayName: 'East US', isEnabled: true, isDefault: true },
  { id: 'westus', name: 'westus', displayName: 'West US', isEnabled: true, isDefault: true },
  { id: 'westeurope', name: 'westeurope', displayName: 'West Europe', isEnabled: true, isDefault: true },
  { id: 'northeurope', name: 'northeurope', displayName: 'North Europe', isEnabled: false, isDefault: false },
  { id: 'eastasia', name: 'eastasia', displayName: 'East Asia', isEnabled: false, isDefault: false },
  { id: 'southeastasia', name: 'southeastasia', displayName: 'Southeast Asia', isEnabled: false, isDefault: false },
  { id: 'australiaeast', name: 'australiaeast', displayName: 'Australia East', isEnabled: false, isDefault: false },
  { id: 'centralus', name: 'centralus', displayName: 'Central US', isEnabled: false, isDefault: false },
]

const defaultSettings: AppSettings = {
  llm: {
    provider: 'azure-openai',
    baseUrl: '',
    model: '',
    temperature: 0.7,
    maxTokens: 2048,
  },
  azure: {
    subscriptionId: '',
    tenantId: '',
    storageAccounts: [],
    applicationInsights: [],
    regions: defaultRegions,
  },
  dashboardRefreshInterval: 30000,
  theme: 'system',
  defaultRegions: ['eastus', 'westus', 'westeurope'],
  enabledFeatures: {
    aiPredictions: true,
    logAnalysis: true,
    costAnalysis: true,
    alerts: true,
  },
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      userRole: { role: 'viewer', permissions: ['view'] },
      isConfigured: false,

      updateLLMConfig: (config) =>
        set((state) => ({
          settings: {
            ...state.settings,
            llm: { ...state.settings.llm, ...config },
          },
        })),

      updateAzureConfig: (config) =>
        set((state) => ({
          settings: {
            ...state.settings,
            azure: { ...state.settings.azure, ...config },
          },
        })),

      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
          isConfigured: true,
        })),

      setUserRole: (role) => set({ userRole: role }),

      addStorageAccount: (account) =>
        set((state) => ({
          settings: {
            ...state.settings,
            azure: {
              ...state.settings.azure,
              storageAccounts: [...state.settings.azure.storageAccounts, account],
            },
          },
        })),

      removeStorageAccount: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            azure: {
              ...state.settings.azure,
              storageAccounts: state.settings.azure.storageAccounts.filter((a) => a.id !== id),
            },
          },
        })),

      addAppInsights: (appInsights) =>
        set((state) => ({
          settings: {
            ...state.settings,
            azure: {
              ...state.settings.azure,
              applicationInsights: [...state.settings.azure.applicationInsights, appInsights],
            },
          },
        })),

      removeAppInsights: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            azure: {
              ...state.settings.azure,
              applicationInsights: state.settings.azure.applicationInsights.filter((a) => a.id !== id),
            },
          },
        })),

      toggleRegion: (regionId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            azure: {
              ...state.settings.azure,
              regions: state.settings.azure.regions.map((r) =>
                r.id === regionId ? { ...r, isEnabled: !r.isEnabled } : r
              ),
            },
          },
        })),

      resetToDefaults: () => set({ settings: defaultSettings, isConfigured: false }),
    }),
    {
      name: 'ProdVista-settings',
    }
  )
)

// Helper hooks
export const useIsManager = () => {
  const { userRole } = useSettingsStore()
  return userRole.role === 'manager'
}

export const useCanEdit = () => {
  const { userRole } = useSettingsStore()
  return userRole.role === 'manager' || userRole.permissions.includes('edit')
}

export const useCanView = () => {
  const { userRole } = useSettingsStore()
  return userRole.permissions.includes('view') // Everyone with view permission can view
}
