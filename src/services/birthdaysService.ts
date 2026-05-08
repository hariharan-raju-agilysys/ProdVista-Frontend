import api from './api'

/**
 * Birthday information for a team member
 */
export interface Birthday {
  userId: string
  userName: string
  email: string
  month: number  // 1-12
  day: number    // 1-31
  lastUpdated: string
}

/**
 * Current month birthdays response
 */
export interface CurrentMonthBirthdays {
  month: number
  year: number
  birthdays: Birthday[]
}

/**
 * Birthdays Service - Fetches team member birthdays for current month
 * Uses efficient cached endpoint on backend (no expensive DB queries)
 */
export const birthdaysService = {
  /**
   * Get all team member birthdays for current month
   * Cached on backend - very fast response
   */
  async getCurrentMonthBirthdays(): Promise<Birthday[]> {
    try {
      const response = await api.get<CurrentMonthBirthdays>('/birthdays/current-month')
      return response.data?.birthdays || []
    } catch (error) {
      console.error('Failed to fetch team birthdays:', error)
      return []
    }
  },

  /**
   * Sync birthdays from database to cache (admin only)
   * Call this after bulk user profile updates
   */
  async syncBirthdaysFromDatabase(): Promise<void> {
    try {
      await api.post('/birthdays/sync')
      console.log('Birthday cache synced from database')
    } catch (error) {
      console.error('Failed to sync birthdays:', error)
      throw error
    }
  },

  /**
   * Clear birthday cache for current tenant (admin only)
   */
  async clearCache(): Promise<void> {
    try {
      await api.delete('/birthdays/clear-cache')
      console.log('Birthday cache cleared')
    } catch (error) {
      console.error('Failed to clear birthday cache:', error)
      throw error
    }
  },
}
