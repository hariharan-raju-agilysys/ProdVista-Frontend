import { create } from 'zustand'
import { API_BASE_PATH } from '../services/api'

export interface FeatureFlags {
  enableAI: boolean
  enableAzure: boolean
  enableJenkins: boolean
  enableCommandCenter: boolean
}

interface FeatureState {
  features: FeatureFlags
  isLoaded: boolean
  isLoading: boolean
  loadFeatures: () => Promise<void>
}

const defaultFeatures: FeatureFlags = {
  enableAI: false,
  enableAzure: true,
  enableJenkins: true,
  enableCommandCenter: true,
}

export const useFeatureStore = create<FeatureState>((set, get) => ({
  features: defaultFeatures,
  isLoaded: false,
  isLoading: false,

  loadFeatures: async () => {
    if (get().isLoaded || get().isLoading) return
    set({ isLoading: true })
    try {
      const res = await fetch(`${API_BASE_PATH}/auth/features`)
      if (res.ok) {
        const data = await res.json()
        set({
          features: {
            enableAI: data.enableAI ?? false,
            enableAzure: data.enableAzure ?? true,
            enableJenkins: data.enableJenkins ?? true,
            enableCommandCenter: data.enableCommandCenter ?? true,
          },
          isLoaded: true,
        })
      }
    } catch {
      // On error, keep defaults (AI off, others on)
    } finally {
      set({ isLoading: false })
    }
  },
}))
