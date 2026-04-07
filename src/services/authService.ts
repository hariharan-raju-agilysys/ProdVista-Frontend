// Use VITE_API_BASE_PATH for API routing (matches api.ts)
// In dev: '/api' (proxied by Vite to localhost:5555)
// In prod: '/prodvista/api' (routed by Istio VirtualService with rewrite)
const API_BASE = import.meta.env.VITE_API_BASE_PATH || '/api';

export interface AuthUser {
  id: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  username: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  role: string;
  profilePictureUrl?: string;
  department?: string;
  jobTitle?: string;
}

export interface TenantInfo {
  code: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
}

export interface LoginRequest {
  tenantCode: string;
  usernameOrEmail: string;
  password: string;
}

export interface RegisterRequest {
  tenantCode: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: AuthUser;
}

export interface UsernameCheckRequest {
  tenantCode: string;
  firstName: string;
  lastName: string;
  username?: string;
}

export interface UsernameCheckResponse {
  available: boolean;
  suggestedUsername?: string;
  suggestions: string[];
  message: string;
}

const AUTH_TOKEN_KEY = 'prodvista_auth_token';
const AUTH_USER_KEY = 'prodvista_auth_user';
const AUTH_TENANT_KEY = 'prodvista_auth_tenant';

export const authService = {
  async login(request: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    const data = await response.json();
    
    if (data.success && data.token && data.user) {
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(AUTH_TENANT_KEY, request.tenantCode);
    }
    
    return data;
  },

  async register(request: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    
    const data = await response.json();
    
    if (data.success && data.token && data.user) {
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(AUTH_TENANT_KEY, request.tenantCode);
    }
    
    return data;
  },

  async loginWithAzure(tenantCode: string): Promise<AuthResponse> {
    try {
      // First check if Azure CLI auth is valid
      const statusResponse = await fetch(`${API_BASE}/azure/auth-status`);
      const status = await statusResponse.json();
      
      if (!status.authenticated) {
        return {
          success: false,
          message: status.message || 'Azure CLI authentication required. Please run "az login" first.'
        };
      }

      // Use the Azure auth to create a session
      const response = await fetch(`${API_BASE}/auth/azure-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tenantCode,
          azureUser: status.user 
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.token && data.user) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        localStorage.setItem(AUTH_TENANT_KEY, tenantCode);
      }
      
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Azure authentication failed'
      };
    }
  },

  async loginWithMsal(tenantCode: string, accessToken: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth/msal-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantCode, accessToken }),
      });

      const data = await response.json();

      if (data.success && data.token && data.user) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        localStorage.setItem(AUTH_TENANT_KEY, tenantCode);
      }

      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Microsoft authentication failed'
      };
    }
  },

  async getTenants(): Promise<TenantInfo[]> {
    try {
      const response = await fetch(`${API_BASE}/auth/tenants`);
      return await response.json();
    } catch {
      return [];
    }
  },

  async validateTenant(code: string): Promise<TenantInfo | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/tenant/${encodeURIComponent(code)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  async checkUsername(request: UsernameCheckRequest): Promise<UsernameCheckResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      return await response.json();
    } catch {
      return { available: false, suggestions: [], message: 'Error checking username' };
    }
  },

  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  getUser(): AuthUser | null {
    const userJson = localStorage.getItem(AUTH_USER_KEY);
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  },

  getTenantCode(): string | null {
    return localStorage.getItem(AUTH_TENANT_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  },

  logout(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TENANT_KEY);
    localStorage.removeItem('prodvista_azure_token');
  },

  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};

export default authService;
