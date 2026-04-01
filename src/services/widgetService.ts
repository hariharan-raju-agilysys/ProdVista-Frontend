import apiClient from './apiClient'

// Types
export interface WidgetDataSource {
  type: 'static' | 'api' | 'url' | 'excel' | 'document' | 'database'
  url?: string
  path?: string
  sheetName?: string
  cellRange?: string
  query?: string
  headers?: Record<string, string>
  refreshIntervalSeconds?: number
}

export interface CreateWidgetRequest {
  title: string
  widgetType: 'metric' | 'chart-line' | 'chart-bar' | 'chart-doughnut' | 'table' | 'list' | 'status'
  size: 'small' | 'medium' | 'large' | 'full'
  dashboardId?: string
  
  // Data source
  dataSourceType: string
  dataSourceUrl?: string
  dataSourcePath?: string
  refreshIntervalSeconds?: number
  
  // Auth
  authType?: 'none' | 'basic' | 'bearer' | 'apikey'
  authCredentials?: string
  
  // Config
  config?: Record<string, any>
  
  // Grid position
  gridX?: number
  gridY?: number
  gridWidth?: number
  gridHeight?: number
}

export interface UpdateWidgetRequest {
  title?: string
  widgetType?: string
  size?: string
  dataSourceType?: string
  dataSourceUrl?: string
  dataSourcePath?: string
  refreshIntervalSeconds?: number
  authType?: string
  authCredentials?: string
  config?: Record<string, any>
  gridX?: number
  gridY?: number
  gridWidth?: number
  gridHeight?: number
  isActive?: boolean
  displayOrder?: number
}

export interface Widget {
  id: string
  userId: string
  dashboardId?: string
  title: string
  widgetType: string
  size: string
  dataSourceType: string
  dataSourceUrl?: string
  dataSourcePath?: string
  refreshIntervalSeconds: number
  authType: string
  gridX: number
  gridY: number
  gridWidth: number
  gridHeight: number
  config?: Record<string, any>
  data?: any
  lastDataFetch?: string
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

export interface WidgetPositionUpdate {
  id: string
  gridX: number
  gridY: number
  gridWidth: number
  gridHeight: number
  displayOrder: number
}

class WidgetService {
  private readonly basePath = '/widgets'

  /**
   * Get all widgets for a user
   */
  async getUserWidgets(userId: string, dashboardId?: string): Promise<Widget[]> {
    const params = dashboardId ? { dashboardId } : {}
    const response = await apiClient.get<Widget[]>(`${this.basePath}/user/${userId}`, { params })
    return response.data
  }

  /**
   * Get a specific widget
   */
  async getWidget(id: string): Promise<Widget> {
    const response = await apiClient.get<Widget>(`${this.basePath}/${id}`)
    return response.data
  }

  /**
   * Create a new widget
   */
  async createWidget(userId: string, request: CreateWidgetRequest): Promise<Widget> {
    const response = await apiClient.post<Widget>(`${this.basePath}?userId=${userId}`, request)
    return response.data
  }

  /**
   * Update a widget
   */
  async updateWidget(id: string, request: UpdateWidgetRequest): Promise<Widget> {
    const response = await apiClient.put<Widget>(`${this.basePath}/${id}`, request)
    return response.data
  }

  /**
   * Delete a widget
   */
  async deleteWidget(id: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${id}`)
  }

  /**
   * Refresh widget data from source
   */
  async refreshWidgetData(id: string): Promise<{ data: any; lastFetch: string }> {
    const response = await apiClient.post<{ data: any; lastFetch: string }>(`${this.basePath}/${id}/refresh`)
    return response.data
  }

  /**
   * Bulk update widget positions
   */
  async updatePositions(positions: WidgetPositionUpdate[]): Promise<void> {
    await apiClient.put(`${this.basePath}/positions`, positions)
  }
}

export const widgetService = new WidgetService()
export default widgetService
