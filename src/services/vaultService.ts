import api from './api'

export interface VaultItem {
  id: string
  userId: string
  type: 'credential' | 'document' | 'url' | 'app-config' | 'note'
  title: string
  description?: string
  content: string
  category: string
  tags: string[]
  isFavorite: boolean
  isSecure: boolean
  createdAt: string
  updatedAt: string
  lastAccessedAt?: string
}

export interface CreateVaultItemDto {
  type: 'credential' | 'document' | 'url' | 'app-config' | 'note'
  title: string
  description?: string
  content: string
  category: string
  tags: string[]
  isSecure: boolean
}

export interface UpdateVaultItemDto {
  title?: string
  description?: string
  content?: string
  category?: string
  tags?: string[]
  isFavorite?: boolean
  isSecure?: boolean
}

export interface VaultStats {
  total: number
  credentials: number
  documents: number
  urls: number
  configs: number
  notes: number
  favorites: number
  secure: number
  categoryCounts: Record<string, number>
}

export const vaultService = {
  /**
   * Get all vault items for current user
   */
  getAllItems: () => api.get<VaultItem[]>('/vault/items'),

  /**
   * Get single vault item by ID
   */
  getItem: (id: string) => api.get<VaultItem>(`/vault/items/${id}`),

  /**
   * Create new vault item
   */
  createItem: (data: CreateVaultItemDto) => api.post<VaultItem>('/vault/items', data),

  /**
   * Update existing vault item
   */
  updateItem: (id: string, data: UpdateVaultItemDto) => 
    api.put<VaultItem>(`/vault/items/${id}`, data),

  /**
   * Toggle favorite status
   */
  toggleFavorite: (id: string) => api.post<VaultItem>(`/vault/items/${id}/favorite`),

  /**
   * Delete vault item
   */
  deleteItem: (id: string) => api.delete(`/vault/items/${id}`),

  /**
   * Search vault items with fuzzy matching
   */
  searchItems: (query: string) => 
    api.get<VaultItem[]>('/vault/search', { params: { query } }),

  /**
   * Get vault statistics
   */
  getStats: () => api.get<VaultStats>('/vault/stats'),
}

export default vaultService
