/**
 * User Preferences Service
 * 
 * Stores user-specific preferences in localStorage
 * Used for multi-user scenarios where each user needs their own configuration
 * DB stores tenant-level defaults, localStorage stores user-specific overrides
 */

// Storage keys
const STORAGE_KEYS = {
  AI_QUERY_PREFERENCES: 'prodvista_ai_query_preferences',
  AI_QUERY_SETUP_COMPLETE: 'prodvista_ai_query_setup_complete',
  DASHBOARD_PREFERENCES: 'prodvista_dashboard_preferences',
  WIDGET_PREFERENCES: 'prodvista_widget_preferences',
  LAST_USED_CONNECTION: 'prodvista_last_used_connection',
} as const;

// ============================================================================
// AI Query Preferences
// ============================================================================

export interface AIQueryUserPreferences {
  // Selected database connections (local DB connection IDs - GUIDs)
  selectedDatabaseIds: string[];
  
  // Default connection to use when no specific selection
  defaultConnectionId?: string;
  
  // Selected Azure SQL database IDs (resource IDs)
  selectedAzureDatabaseIds?: string[];
  
  // Default Azure database
  defaultAzureDatabaseId?: string;
  
  // Query preferences
  maxQueryRows: number;
  queryTimeoutSeconds: number;
  
  // Feature flags
  enableCrossDatabaseJoins: boolean;
  autoExecuteQueries: boolean;
  showSqlPreview: boolean;
  
  // UI preferences
  showHistory: boolean;
  historySize: number;
  
  // Last updated timestamp
  lastUpdated: string;
}

const DEFAULT_AI_QUERY_PREFERENCES: AIQueryUserPreferences = {
  selectedDatabaseIds: [],
  defaultConnectionId: undefined,
  selectedAzureDatabaseIds: [],
  defaultAzureDatabaseId: undefined,
  maxQueryRows: 100,
  queryTimeoutSeconds: 30,
  enableCrossDatabaseJoins: false,
  autoExecuteQueries: true,
  showSqlPreview: true,
  showHistory: true,
  historySize: 50,
  lastUpdated: new Date().toISOString(),
};

// ============================================================================
// Dashboard Preferences
// ============================================================================

export interface DashboardUserPreferences {
  // Default refresh interval in seconds
  defaultRefreshInterval: number;
  
  // Theme preference
  theme: 'light' | 'dark' | 'system';
  
  // Grid density
  gridDensity: 'compact' | 'normal' | 'spacious';
  
  // Show widget borders
  showWidgetBorders: boolean;
  
  // Auto-load dashboards on startup
  autoLoadDashboards: boolean;
  
  // Last viewed dashboard ID
  lastViewedDashboardId?: string;
  
  // Favorite dashboard IDs
  favoriteDashboardIds: string[];
  
  lastUpdated: string;
}

const DEFAULT_DASHBOARD_PREFERENCES: DashboardUserPreferences = {
  defaultRefreshInterval: 60,
  theme: 'system',
  gridDensity: 'normal',
  showWidgetBorders: true,
  autoLoadDashboards: true,
  lastViewedDashboardId: undefined,
  favoriteDashboardIds: [],
  lastUpdated: new Date().toISOString(),
};

// ============================================================================
// Storage Utilities
// ============================================================================

function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.error(`Failed to read ${key} from localStorage:`, error);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error);
    return false;
  }
}

function removeFromStorage(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to remove ${key} from localStorage:`, error);
    return false;
  }
}

// ============================================================================
// User Preferences Service
// ============================================================================

export const userPreferencesService = {
  // -------------------------------------------------------------------------
  // AI Query Preferences
  // -------------------------------------------------------------------------
  
  /**
   * Get AI Query user preferences from localStorage
   */
  getAIQueryPreferences(): AIQueryUserPreferences {
    return getFromStorage(STORAGE_KEYS.AI_QUERY_PREFERENCES, DEFAULT_AI_QUERY_PREFERENCES);
  },

  /**
   * Save AI Query user preferences to localStorage
   */
  saveAIQueryPreferences(preferences: Partial<AIQueryUserPreferences>): AIQueryUserPreferences {
    const current = this.getAIQueryPreferences();
    const updated: AIQueryUserPreferences = {
      ...current,
      ...preferences,
      lastUpdated: new Date().toISOString(),
    };
    saveToStorage(STORAGE_KEYS.AI_QUERY_PREFERENCES, updated);
    return updated;
  },

  /**
   * Check if AI Query setup has been completed
   */
  isAIQuerySetupComplete(): boolean {
    return getFromStorage(STORAGE_KEYS.AI_QUERY_SETUP_COMPLETE, false);
  },

  /**
   * Mark AI Query setup as complete
   */
  markAIQuerySetupComplete(): void {
    saveToStorage(STORAGE_KEYS.AI_QUERY_SETUP_COMPLETE, true);
  },

  /**
   * Reset AI Query setup (force re-configuration)
   */
  resetAIQuerySetup(): void {
    removeFromStorage(STORAGE_KEYS.AI_QUERY_SETUP_COMPLETE);
    removeFromStorage(STORAGE_KEYS.AI_QUERY_PREFERENCES);
  },

  /**
   * Check if user has configured database selections
   */
  hasConfiguredDatabases(): boolean {
    const prefs = this.getAIQueryPreferences();
    return (
      (prefs.selectedDatabaseIds?.length ?? 0) > 0 ||
      (prefs.selectedAzureDatabaseIds?.length ?? 0) > 0
    );
  },

  /**
   * Get selected database IDs for AI queries
   */
  getSelectedDatabaseIds(): string[] {
    const prefs = this.getAIQueryPreferences();
    return prefs.selectedDatabaseIds || [];
  },

  /**
   * Set selected database IDs
   */
  setSelectedDatabaseIds(ids: string[]): void {
    this.saveAIQueryPreferences({
      selectedDatabaseIds: ids,
      defaultConnectionId: ids.length > 0 ? ids[0] : undefined,
    });
  },

  /**
   * Get the default connection ID
   */
  getDefaultConnectionId(): string | undefined {
    const prefs = this.getAIQueryPreferences();
    return prefs.defaultConnectionId || prefs.selectedDatabaseIds?.[0];
  },

  /**
   * Set last used connection
   */
  setLastUsedConnection(connectionId: string): void {
    saveToStorage(STORAGE_KEYS.LAST_USED_CONNECTION, connectionId);
  },

  /**
   * Get last used connection
   */
  getLastUsedConnection(): string | undefined {
    return getFromStorage(STORAGE_KEYS.LAST_USED_CONNECTION, undefined);
  },

  // -------------------------------------------------------------------------
  // Dashboard Preferences
  // -------------------------------------------------------------------------

  /**
   * Get Dashboard user preferences
   */
  getDashboardPreferences(): DashboardUserPreferences {
    return getFromStorage(STORAGE_KEYS.DASHBOARD_PREFERENCES, DEFAULT_DASHBOARD_PREFERENCES);
  },

  /**
   * Save Dashboard user preferences
   */
  saveDashboardPreferences(preferences: Partial<DashboardUserPreferences>): DashboardUserPreferences {
    const current = this.getDashboardPreferences();
    const updated: DashboardUserPreferences = {
      ...current,
      ...preferences,
      lastUpdated: new Date().toISOString(),
    };
    saveToStorage(STORAGE_KEYS.DASHBOARD_PREFERENCES, updated);
    return updated;
  },

  /**
   * Add dashboard to favorites
   */
  addFavoriteDashboard(dashboardId: string): void {
    const prefs = this.getDashboardPreferences();
    if (!prefs.favoriteDashboardIds.includes(dashboardId)) {
      this.saveDashboardPreferences({
        favoriteDashboardIds: [...prefs.favoriteDashboardIds, dashboardId],
      });
    }
  },

  /**
   * Remove dashboard from favorites
   */
  removeFavoriteDashboard(dashboardId: string): void {
    const prefs = this.getDashboardPreferences();
    this.saveDashboardPreferences({
      favoriteDashboardIds: prefs.favoriteDashboardIds.filter(id => id !== dashboardId),
    });
  },

  /**
   * Set last viewed dashboard
   */
  setLastViewedDashboard(dashboardId: string): void {
    this.saveDashboardPreferences({ lastViewedDashboardId: dashboardId });
  },

  // -------------------------------------------------------------------------
  // General Utilities
  // -------------------------------------------------------------------------

  /**
   * Clear all user preferences
   */
  clearAllPreferences(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      removeFromStorage(key);
    });
  },

  /**
   * Export all preferences as JSON (for backup/sync)
   */
  exportPreferences(): string {
    const data = {
      aiQuery: this.getAIQueryPreferences(),
      dashboard: this.getDashboardPreferences(),
      setupComplete: this.isAIQuerySetupComplete(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  },

  /**
   * Import preferences from JSON (for restore/sync)
   */
  importPreferences(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.aiQuery) {
        saveToStorage(STORAGE_KEYS.AI_QUERY_PREFERENCES, data.aiQuery);
      }
      if (data.dashboard) {
        saveToStorage(STORAGE_KEYS.DASHBOARD_PREFERENCES, data.dashboard);
      }
      if (data.setupComplete !== undefined) {
        saveToStorage(STORAGE_KEYS.AI_QUERY_SETUP_COMPLETE, data.setupComplete);
      }
      return true;
    } catch (error) {
      console.error('Failed to import preferences:', error);
      return false;
    }
  },
};

export default userPreferencesService;
