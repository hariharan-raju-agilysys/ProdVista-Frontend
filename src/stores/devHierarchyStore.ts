/**
 * devHierarchyStore — global, persisted Zustand store for director/manager hierarchy.
 *
 * Purpose
 * -------
 * Cache the full flat list of leaf-developer emails under the currently-selected director
 * (or the logged-in manager's own hierarchy). This list is the single source of truth
 * used as a filter across the entire application:
 *   - Developer Efficiency page
 *   - App Insights KQL queries
 *   - Azure DevOps queries
 *   - Any other heavy API call that needs team scoping
 *
 * Persistence
 * -----------
 * Stored in localStorage under 'prodvista-dev-hierarchy'. Survives page refresh and
 * tab reloads. Invalidated after HIERARCHY_TTL_MS (30 minutes) so data stays fresh.
 *
 * Usage (any page)
 * ----------------
 *   import { useDevHierarchyStore } from '../stores/devHierarchyStore'
 *
 *   const { hierarchyEmails, selectedDirector, isStale } = useDevHierarchyStore()
 *   // pass hierarchyEmails as filter to any API call
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Types ────────────────────────────────────────────────────────────────────

export interface HierarchyEmployee {
  employeeId: number
  name: string
  email: string
  department?: string
  designation?: string
}

export interface DirectorSummaryInfo {
  employeeId: number
  name: string
  email: string
  department?: string
  designation?: string
  reportingTo?: string
}

// ── State interface ───────────────────────────────────────────────────────────

interface DevHierarchyState {
  /** The currently-selected director/manager ID (null = none selected) */
  selectedDirectorId: number | null

  /** Full details of the selected director */
  selectedDirector: DirectorSummaryInfo | null

  /**
   * Flat list of leaf-developer emails under the selected director.
   * Empty array = no filter applied (no director selected OR no reportees found).
   * Use this as the filter value when calling App Insights, DevOps, etc.
   */
  hierarchyEmails: string[]

  /** Full employee details for the hierarchy (for display purposes) */
  hierarchyEmployees: HierarchyEmployee[]

  /** Unix timestamp (ms) of when the hierarchy was last fetched. null = never. */
  fetchedAt: number | null

  /** Cached directors list (refreshed every DIRECTORS_TTL_MS) */
  directors: DirectorSummaryInfo[]

  /** Unix timestamp (ms) of when the directors list was last fetched. */
  directorsFetchedAt: number | null

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Store a freshly-fetched hierarchy for a director */
  setHierarchy: (
    director: DirectorSummaryInfo,
    emails: string[],
    employees: HierarchyEmployee[]
  ) => void

  /** Remove the current director selection + clear cached emails */
  clearHierarchy: () => void

  /** Cache the directors list */
  setDirectors: (directors: DirectorSummaryInfo[]) => void

  /**
   * Returns true when the hierarchy cache is missing or older than HIERARCHY_TTL_MS.
   * Call this before deciding whether to fetch from the API.
   */
  isHierarchyStale: () => boolean

  /**
   * Returns true when the directors list cache is missing or older than DIRECTORS_TTL_MS.
   */
  isDirectorsStale: () => boolean
}

// ── TTL constants ─────────────────────────────────────────────────────────────

const HIERARCHY_TTL_MS = 30 * 60 * 1000  // 30 minutes
const DIRECTORS_TTL_MS = 5  * 60 * 1000  // 5 minutes

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDevHierarchyStore = create<DevHierarchyState>()(
  persist(
    (set, get) => ({
      selectedDirectorId: null,
      selectedDirector: null,
      hierarchyEmails: [],
      hierarchyEmployees: [],
      fetchedAt: null,
      directors: [],
      directorsFetchedAt: null,

      setHierarchy: (director, emails, employees) =>
        set({
          selectedDirectorId: director.employeeId,
          selectedDirector: director,
          hierarchyEmails: emails,
          hierarchyEmployees: employees,
          fetchedAt: Date.now(),
        }),

      clearHierarchy: () =>
        set({
          selectedDirectorId: null,
          selectedDirector: null,
          hierarchyEmails: [],
          hierarchyEmployees: [],
          fetchedAt: null,
        }),

      setDirectors: (directors) =>
        set({
          directors,
          directorsFetchedAt: Date.now(),
        }),

      isHierarchyStale: () => {
        const { fetchedAt } = get()
        if (fetchedAt === null) return true
        return Date.now() - fetchedAt > HIERARCHY_TTL_MS
      },

      isDirectorsStale: () => {
        const { directorsFetchedAt } = get()
        if (directorsFetchedAt === null) return true
        return Date.now() - directorsFetchedAt > DIRECTORS_TTL_MS
      },
    }),
    {
      name: 'prodvista-dev-hierarchy',
      // Only persist data-bearing fields — not action functions
      partialize: (state) => ({
        selectedDirectorId: state.selectedDirectorId,
        selectedDirector: state.selectedDirector,
        hierarchyEmails: state.hierarchyEmails,
        hierarchyEmployees: state.hierarchyEmployees,
        fetchedAt: state.fetchedAt,
        directors: state.directors,
        directorsFetchedAt: state.directorsFetchedAt,
      }),
    }
  )
)
