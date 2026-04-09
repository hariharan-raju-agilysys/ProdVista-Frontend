import apiClient, { setAuthToken, clearAuthToken } from './apiClient'

export interface User {
  id: string
  azureObjectId: string
  email: string
  displayName: string
  role: 'User' | 'Manager' | 'Admin'
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  department?: string
  jobTitle?: string
  birthMonth?: number | null
  birthDay?: number | null
  bio?: string | null
}

export interface LoginResponse {
  user: User
  token?: string
  isNewUser: boolean
  message: string
}

export interface UserStats {
  totalUsers: number
  activeUsers: number
  managers: number
  newUsersToday: number
}

export interface LoginProfileRequest {
  azureObjectId: string
  email: string
  displayName: string
  tenantId: string
  department?: string
  jobTitle?: string
  profilePictureUrl?: string
}

class AuthApi {
  /**
   * Login with user profile data (from Microsoft Graph or Demo)
   */
  async loginWithProfile(profile: LoginProfileRequest): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/users/login', profile)
    
    if (data.token) {
      setAuthToken(data.token)
    }
    
    return data
  }

  /**
   * Legacy login with Azure token (deprecated)
   */
  async login(azureToken: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/users/login', {
      azureToken,
    })
    
    if (data.token) {
      setAuthToken(data.token)
    }
    
    return data
  }

  /**
   * Get all users (manager only)
   */
  async getUsers(): Promise<User[]> {
    const { data } = await apiClient.get<User[]>('/users')
    return data
  }

  /**
   * Update user role (manager only)
   */
  async updateUserRole(userId: string, role: string): Promise<User> {
    const { data } = await apiClient.put<User>(`/users/${userId}/role`, { role })
    return data
  }

  /**
   * Update user status (manager only)
   */
  async updateUserStatus(userId: string, isActive: boolean): Promise<User> {
    const { data } = await apiClient.put<User>(`/users/${userId}/status`, { isActive })
    return data
  }

  /**
   * Get user statistics (manager only)
   */
  async getUserStats(): Promise<UserStats> {
    const { data } = await apiClient.get<UserStats>('/users/stats')
    return data
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    clearAuthToken()
  }
}

export const authApi = new AuthApi()
export default authApi
