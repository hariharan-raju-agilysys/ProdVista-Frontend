import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const API_TIMEOUT = 30000

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token management
let authToken: string | null = null

export const setAuthToken = (token: string | null) => {
  authToken = token
  if (token) {
    localStorage.setItem('prodvista_auth_token', token)
  } else {
    localStorage.removeItem('prodvista_auth_token')
  }
}

export const getAuthToken = (): string | null => {
  if (!authToken) {
    authToken = localStorage.getItem('prodvista_auth_token')
  }
  return authToken
}

export const clearAuthToken = () => {
  authToken = null
  localStorage.removeItem('prodvista_auth_token')
}

// Request interceptor - add auth headers and common config
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken()
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Add correlation ID for request tracking
    config.headers['X-Correlation-ID'] = crypto.randomUUID()
    
    // Add timestamp
    config.headers['X-Request-Time'] = new Date().toISOString()

    return config
  },
  (error: AxiosError) => {
    console.error('Request interceptor error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error: AxiosError) => {
    const { response } = error

    if (response) {
      switch (response.status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          clearAuthToken()
          window.dispatchEvent(new CustomEvent('auth:unauthorized'))
          break
        case 403:
          // Forbidden
          window.dispatchEvent(new CustomEvent('auth:forbidden'))
          break
        case 500:
          console.error('Server error:', response.data)
          break
      }
    } else if (error.request) {
      // Network error
      console.error('Network error:', error.message)
    }

    return Promise.reject(error)
  }
)

export default apiClient
