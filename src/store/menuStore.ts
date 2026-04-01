import { create } from 'zustand'

// ========================================
// API Response Types (match backend DTOs)
// ========================================

export interface SideMenuItemDto {
  id: string
  name: string
  href: string
  icon: string
  displayOrder: number
  isActive: boolean
  category: string
  requiredRole: string
  linkedTemplateId?: string
  description?: string
  isSystemDefault: boolean
}

export interface DashboardPageDto {
  id: string
  pageType: string
  slug: string
  displayName: string
  description?: string
  icon: string
  displayOrder: number
  isConfigured: boolean
  layoutType: string
  gridColumns: number
  widgetCount: number
}

export interface DashboardWidgetDto {
  id: string
  widgetType: string
  title: string
  subtitle?: string
  gridX: number
  gridY: number
  gridWidth: number
  gridHeight: number
  minWidth: number
  minHeight: number
  displayOrder: number
  dataProviderType: string
  dataProviderConfigId?: string
  widgetConfig: Record<string, unknown>
  dataProviderConfig: Record<string, unknown>
  refreshIntervalSeconds: number
  isLocked: boolean
  cachedData?: unknown
  lastDataFetch?: string
}

export interface DashboardPageDetailDto extends DashboardPageDto {
  pageConfig: Record<string, unknown>
  widgets: DashboardWidgetDto[]
}

export interface NavigationMenuDto {
  items: SideMenuItemDto[]
  pages: DashboardPageDto[]
  isManager: boolean
  isUsingDefaultMenu: boolean
}

// ========================================
// API Configuration
// ========================================

const API_BASE = '/api/dynamicdashboard'

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem('prodvista_auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ========================================
// Store State & Actions
// ========================================

interface MenuState {
  // Navigation data
  menuItems: SideMenuItemDto[]
  pages: DashboardPageDto[]
  currentPage: DashboardPageDetailDto | null
  isManager: boolean
  
  // Loading states
  isLoading: boolean
  isPageLoading: boolean
  error: string | null
  tenantCode: string | null
  lastLoadParams: string | null
  
  // Navigation Actions
  loadNavigation: (tenantCode?: string, userRole?: string) => Promise<void>
  initializeMenuItems: () => Promise<void>
  
  // Menu CRUD
  createMenuItem: (item: Partial<SideMenuItemDto>) => Promise<SideMenuItemDto | null>
  updateMenuItem: (id: string, updates: Partial<SideMenuItemDto>) => Promise<void>
  deleteMenuItem: (id: string) => Promise<void>
  reorderMenuItems: (positions: { id: string; displayOrder: number }[]) => Promise<void>
  
  // Page Actions
  loadPage: (slug: string) => Promise<void>
  createPage: (page: {
    slug: string
    displayName: string
    description?: string
    icon?: string
    displayOrder?: number
  }) => Promise<DashboardPageDto | null>
  deletePage: (id: string) => Promise<void>
  
  // Widget Actions
  addWidget: (pageId: string, widget: {
    widgetType: string
    title: string
    subtitle?: string
    gridX: number
    gridY: number
    gridWidth?: number
    gridHeight?: number
    dataProviderType?: string
    dataProviderConfig?: Record<string, unknown>
    widgetConfig?: Record<string, unknown>
    refreshIntervalSeconds?: number
  }) => Promise<DashboardWidgetDto | null>
  updateWidget: (widgetId: string, updates: Partial<DashboardWidgetDto>) => Promise<void>
  deleteWidget: (widgetId: string) => Promise<void>
  updateWidgetPositions: (pageId: string, positions: {
    widgetId: string
    gridX: number
    gridY: number
    gridWidth: number
    gridHeight: number
    displayOrder: number
  }[]) => Promise<void>
}

export const useMenuStore = create<MenuState>()((set, get) => ({
  menuItems: [],
  pages: [],
  currentPage: null,
  isManager: false,
  isLoading: false,
  isPageLoading: false,
  error: null,
  tenantCode: null,
  lastLoadParams: null as string | null,

  // ========================================
  // Navigation
  // ========================================
  
  loadNavigation: async (tenantCode?: string, userRole?: string) => {
    // Skip if same params already loaded
    const loadKey = `${tenantCode || 'default'}:${userRole || ''}`
    if (get().lastLoadParams === loadKey && get().menuItems.length > 0) {
      return
    }
    
    // Skip if already loading
    if (get().isLoading) {
      return
    }
    
    set({ isLoading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (tenantCode) params.append('tenantCode', tenantCode)
      if (userRole) params.append('userRole', userRole)
      
      const response = await fetch(`${API_BASE}/menu?${params}`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      })

      if (!response.ok) throw new Error('Failed to load navigation')

      const data: NavigationMenuDto = await response.json()
      set({
        menuItems: data.items,
        pages: data.pages,
        isManager: data.isManager,
        tenantCode: tenantCode || 'default',
        lastLoadParams: loadKey,
        isLoading: false,
      })
    } catch (error) {
      console.error('Load navigation error:', error)
      set({ error: 'Failed to load navigation', isLoading: false })
    }
  },

  initializeMenuItems: async () => {
    try {
      const response = await fetch(`${API_BASE}/menu/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error || 'Failed to initialize menu')
      }

      await get().loadNavigation(get().tenantCode || undefined)
    } catch (error) {
      console.error('Initialize menu error:', error)
      set({ error: 'Failed to initialize menu' })
    }
  },

  // ========================================
  // Menu CRUD
  // ========================================

  createMenuItem: async (item) => {
    try {
      const response = await fetch(`${API_BASE}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(item),
      })

      if (!response.ok) throw new Error('Failed to create menu item')

      const newItem: SideMenuItemDto = await response.json()
      set((state) => ({ menuItems: [...state.menuItems, newItem] }))
      return newItem
    } catch (error) {
      console.error('Create menu item error:', error)
      return null
    }
  },

  updateMenuItem: async (id, updates) => {
    try {
      const response = await fetch(`${API_BASE}/menu/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update menu item')

      const updated: SideMenuItemDto = await response.json()
      set((state) => ({
        menuItems: state.menuItems.map((m) => (m.id === id ? updated : m)),
      }))
    } catch (error) {
      console.error('Update menu item error:', error)
    }
  },

  deleteMenuItem: async (id) => {
    try {
      const response = await fetch(`${API_BASE}/menu/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      })

      if (!response.ok) throw new Error('Failed to delete menu item')

      set((state) => ({
        menuItems: state.menuItems.filter((m) => m.id !== id),
      }))
    } catch (error) {
      console.error('Delete menu item error:', error)
    }
  },

  reorderMenuItems: async (positions) => {
    try {
      await fetch(`${API_BASE}/menu/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(positions),
      })

      await get().loadNavigation(get().tenantCode || undefined)
    } catch (error) {
      console.error('Reorder menu items error:', error)
    }
  },

  // ========================================
  // Pages
  // ========================================

  loadPage: async (slug) => {
    set({ isPageLoading: true, error: null })
    try {
      const response = await fetch(`${API_BASE}/pages/${slug}`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      })

      if (response.status === 404) {
        set({ currentPage: null, isPageLoading: false })
        return
      }

      if (!response.ok) throw new Error('Failed to load page')

      const page: DashboardPageDetailDto = await response.json()
      set({ currentPage: page, isPageLoading: false })
    } catch (error) {
      console.error('Load page error:', error)
      set({ error: 'Failed to load page', isPageLoading: false })
    }
  },

  createPage: async (page) => {
    try {
      const response = await fetch(`${API_BASE}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(page),
      })

      if (!response.ok) throw new Error('Failed to create page')

      const newPage: DashboardPageDto = await response.json()
      set((state) => ({ pages: [...state.pages, newPage] }))
      return newPage
    } catch (error) {
      console.error('Create page error:', error)
      return null
    }
  },

  deletePage: async (id) => {
    try {
      const response = await fetch(`${API_BASE}/pages/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      })

      if (!response.ok) throw new Error('Failed to delete page')

      set((state) => ({
        pages: state.pages.filter((p) => p.id !== id),
        currentPage: state.currentPage?.id === id ? null : state.currentPage,
      }))
    } catch (error) {
      console.error('Delete page error:', error)
    }
  },

  // ========================================
  // Widgets
  // ========================================

  addWidget: async (pageId, widget) => {
    try {
      const response = await fetch(`${API_BASE}/pages/${pageId}/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(widget),
      })

      if (!response.ok) throw new Error('Failed to add widget')

      const newWidget: DashboardWidgetDto = await response.json()
      
      set((state) => {
        if (state.currentPage?.id === pageId) {
          return {
            currentPage: {
              ...state.currentPage,
              widgets: [...state.currentPage.widgets, newWidget],
            },
          }
        }
        return {}
      })
      
      return newWidget
    } catch (error) {
      console.error('Add widget error:', error)
      return null
    }
  },

  updateWidget: async (widgetId, updates) => {
    try {
      const response = await fetch(`${API_BASE}/widgets/${widgetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update widget')

      const updated: DashboardWidgetDto = await response.json()
      
      set((state) => {
        if (state.currentPage) {
          return {
            currentPage: {
              ...state.currentPage,
              widgets: state.currentPage.widgets.map((w) =>
                w.id === widgetId ? updated : w
              ),
            },
          }
        }
        return {}
      })
    } catch (error) {
      console.error('Update widget error:', error)
    }
  },

  deleteWidget: async (widgetId) => {
    try {
      const response = await fetch(`${API_BASE}/widgets/${widgetId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      })

      if (!response.ok) throw new Error('Failed to delete widget')

      set((state) => {
        if (state.currentPage) {
          return {
            currentPage: {
              ...state.currentPage,
              widgets: state.currentPage.widgets.filter((w) => w.id !== widgetId),
            },
          }
        }
        return {}
      })
    } catch (error) {
      console.error('Delete widget error:', error)
    }
  },

  updateWidgetPositions: async (pageId, positions) => {
    try {
      await fetch(`${API_BASE}/pages/${pageId}/widgets/positions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify(positions),
      })

      // Reload page to get updated positions
      const currentSlug = get().currentPage?.slug
      if (currentSlug) {
        await get().loadPage(currentSlug)
      }
    } catch (error) {
      console.error('Update widget positions error:', error)
    }
  },
}))

export default useMenuStore
