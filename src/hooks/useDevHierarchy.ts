/**
 * useDevHierarchy — smart hook that loads and caches the director/manager hierarchy.
 *
 * How it works
 * ------------
 * 1. On first call, reads from the devHierarchyStore (which may already be populated
 *    from localStorage — persisted from a previous session).
 * 2. If the cache is stale (>30 min) or empty, fetches fresh data from the API.
 * 3. For admins: directors list is fetched separately (5-min TTL).
 *    Director selection persists across navigations.
 * 4. For managers: hierarchy is auto-resolved from their own email on mount.
 *
 * Usage (any page/component)
 * --------------------------
 *   const {
 *     hierarchyEmails,    // ← pass to any filtered API call
 *     selectedDirector,
 *     directors,
 *     selectDirector,
 *     clearSelection,
 *     isLoading,
 *     isAdmin,
 *   } = useDevHierarchy()
 */

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import devEfficiencyService from '../services/devEfficiencyService'
import { useDevHierarchyStore, type DirectorSummaryInfo } from '../stores/devHierarchyStore'

interface UseDevHierarchyResult {
  /** Flat list of all leaf-developer emails. Empty = no selection yet (admin) or loading. */
  hierarchyEmails: string[]
  /** The currently-selected root director / manager. */
  selectedDirector: DirectorSummaryInfo | null
  /** List of all directors (admin-only). Empty for non-admins. */
  directors: DirectorSummaryInfo[]
  /** Whether a data-loading operation is in flight. */
  isLoading: boolean
  /** Whether the last load produced an error. */
  error: string | null
  /** Whether the current user is an admin. */
  isAdmin: boolean
  /**
   * Admin-only: select a director and immediately fetch (or serve from cache)
   * the full hierarchy for that director.
   */
  selectDirector: (director: DirectorSummaryInfo) => Promise<void>
  /** Admin-only: deselect the current director and clear cached hierarchy. */
  clearSelection: () => void
  /** Manually force a hierarchy refresh (ignores TTL). */
  refreshHierarchy: () => Promise<void>
}

export function useDevHierarchy(): UseDevHierarchyResult {
  const { user } = useAuth()
  const isAdmin = user?.role?.toLowerCase() === 'admin'

  const store = useDevHierarchyStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load directors (admin only, 5-min TTL) ───────────────────────────────
  useEffect(() => {
    if (!isAdmin) return
    if (!store.isDirectorsStale()) return

    let cancelled = false

    const fetchDirectors = async () => {
      try {
        const res = await devEfficiencyService.getDirectors()
        if (!cancelled) {
          store.setDirectors(
            res.data.map((d) => ({
              employeeId: d.employeeId,
              name: d.name,
              email: d.email,
              department: d.department,
              designation: d.designation,
              reportingTo: d.reportingTo,
            }))
          )
        }
      } catch (err) {
        console.error('[useDevHierarchy] failed to load directors', err)
      }
    }

    fetchDirectors()
    return () => { cancelled = true }
  }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── For managers: auto-load hierarchy on mount ───────────────────────────
  useEffect(() => {
    if (isAdmin) return                        // admins must select explicitly
    if (!store.isHierarchyStale()) return      // fresh cache — skip fetch

    let cancelled = false

    const fetchManagerHierarchy = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await devEfficiencyService.getHierarchy()
        if (!cancelled && res.data.rootEmployee) {
          store.setHierarchy(
            {
              employeeId: res.data.rootEmployee.employeeId,
              name: res.data.rootEmployee.name,
              email: res.data.rootEmployee.email,
              department: res.data.rootEmployee.department,
              designation: res.data.rootEmployee.designation,
              reportingTo: res.data.rootEmployee.reportingTo,
            },
            res.data.emails,
            res.data.employees.map((e) => ({
              employeeId: e.employeeId,
              name: e.name,
              email: e.email,
              department: e.department,
              designation: e.designation,
            }))
          )
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load hierarchy'
          setError(msg)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchManagerHierarchy()
    return () => { cancelled = true }
  }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Admin: fetch hierarchy for a selected director ───────────────────────
  const selectDirector = useCallback(
    async (director: DirectorSummaryInfo) => {
      // If it's the same director and the cache is still fresh, no-op
      if (
        store.selectedDirectorId === director.employeeId &&
        !store.isHierarchyStale()
      ) {
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const res = await devEfficiencyService.getHierarchy(director.employeeId)
        store.setHierarchy(
          {
            employeeId: director.employeeId,
            name: director.name,
            email: director.email,
            department: director.department,
            designation: director.designation,
            reportingTo: director.reportingTo,
          },
          res.data.emails,
          res.data.employees.map((e) => ({
            employeeId: e.employeeId,
            name: e.name,
            email: e.email,
            department: e.department,
            designation: e.designation,
          }))
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load hierarchy'
        setError(msg)
      } finally {
        setIsLoading(false)
      }
    },
    [store] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const clearSelection = useCallback(() => {
    store.clearHierarchy()
  }, [store]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshHierarchy = useCallback(async () => {
    if (isAdmin) {
      if (store.selectedDirectorId === null) return
      const director = store.selectedDirector!
      setIsLoading(true)
      setError(null)
      try {
        const res = await devEfficiencyService.getHierarchy(store.selectedDirectorId)
        store.setHierarchy(
          director,
          res.data.emails,
          res.data.employees.map((e) => ({
            employeeId: e.employeeId,
            name: e.name,
            email: e.email,
            department: e.department,
            designation: e.designation,
          }))
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to refresh hierarchy'
        setError(msg)
      } finally {
        setIsLoading(false)
      }
    } else {
      // For managers, force re-fetch of own hierarchy
      const prev = store.fetchedAt
      store.clearHierarchy()
      // Temporarily set fetchedAt to null so the useEffect above re-runs
      // The effect checks isHierarchyStale() which will be true after clear
      void prev // suppress unused warning
    }
  }, [isAdmin, store]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    hierarchyEmails: store.hierarchyEmails,
    selectedDirector: store.selectedDirector,
    directors: store.directors,
    isLoading,
    error,
    isAdmin,
    selectDirector,
    clearSelection,
    refreshHierarchy,
  }
}
