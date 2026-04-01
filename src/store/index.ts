/**
 * store/ — All Zustand stores in one barrel export.
 *
 * Prefer importing from '@/store' or '../store' rather than individual files.
 */

export { useDashboardStore } from './dashboardStore';
export { useFeatureStore, type FeatureFlags } from './featureStore';
export { useMenuStore } from './menuStore';
export {
  useSettingsStore,
  useIsManager,
  useCanEdit,
  useCanView,
  type AzureRegion,
  type LLMConfig,
  type AzureConfig,
  type AppSettings,
  type UserRole,
  type StorageAccountConfig,
  type AppInsightsConfig,
} from './settingsStore';
