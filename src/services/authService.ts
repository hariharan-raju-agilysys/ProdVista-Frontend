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
  birthMonth?: number | null;
  birthDay?: number | null;
  bio?: string | null;
  theme?: string;
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
      sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      sessionStorage.setItem(AUTH_TENANT_KEY, request.tenantCode);
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
      sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      sessionStorage.setItem(AUTH_TENANT_KEY, request.tenantCode);
    }
    
    return data;
  },

  async loginWithAzure(tenantCode: string): Promise<AuthResponse> {
    try {
      console.log('[AzureLogin] Starting Azure CLI login for tenant:', tenantCode);
      
      // First check if Azure CLI auth is valid
      const statusResponse = await fetch(`${API_BASE}/azure/auth-status`);
      
      if (!statusResponse.ok) {
        console.error('[AzureLogin] Auth-status endpoint failed:', statusResponse.status, statusResponse.statusText);
        return {
          success: false,
          message: `Server error checking Azure CLI status (HTTP ${statusResponse.status}). Ensure backend is running and 'az login' was executed.`
        };
      }
      
      const status = await statusResponse.json();
      console.log('[AzureLogin] Auth status:', {
        authenticated: status.authenticated,
        method: status.method,
        hasUser: !!status.user,
        message: status.message
      });
      
      if (!status.authenticated) {
        const instruction = status.instructions || status.message || 'Run "az login" in your terminal first';
        console.warn('[AzureLogin] Not authenticated. Instructions:', instruction);
        return {
          success: false,
          message: instruction
        };
      }

      if (!status.user?.email) {
        console.error('[AzureLogin] No email in Azure user info');
        return {
          success: false,
          message: 'Unable to retrieve email from Azure CLI. Make sure you are logged in with an account.'
        };
      }

      console.log('[AzureLogin] Azure CLI authenticated as:', status.user.email);

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
      console.log('[AzureLogin] Backend login response:', {
        success: data.success,
        message: data.message,
        hasToken: !!data.token,
        hasUser: !!data.user
      });
      
      if (!response.ok) {
        console.error('[AzureLogin] Backend login failed (HTTP ' + response.status + '):', data);
        return data;
      }
      
      if (data.success && data.token && data.user) {
        sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        sessionStorage.setItem(AUTH_TENANT_KEY, tenantCode);
        console.log('[AzureLogin] Success - user logged in:', data.user.email);
      }
      
      return data;
    } catch (error: any) {
      console.error('[AzureLogin] Exception occurred:', error);
      return {
        success: false,
        message: `Azure authentication error: ${error.message || 'Unknown error'}. Check browser console for details.`
      };
    }
  },

  async loginWithMsal(tenantCode: string, accessToken: string): Promise<AuthResponse> {
    try {
      console.log('[MSAL] Starting MSAL login for tenant:', tenantCode);
      console.log('[MSAL] Access token length:', accessToken?.length || 0);
      console.log('[MSAL] Sending POST to:', `${API_BASE}/auth/msal-login`);
      
      const requestBody = { tenantCode, accessToken };
      console.log('[MSAL] Request body keys:', Object.keys(requestBody));
      
      const response = await fetch(`${API_BASE}/auth/msal-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('[MSAL] Response received - Status:', response.status, 'OK:', response.ok);
      console.log('[MSAL] Response headers:', {
        contentType: response.headers.get('content-type'),
        authorization: response.headers.get('authorization') ? 'present' : 'absent'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MSAL] HTTP Error - Status:', response.status, 'Body:', errorText.substring(0, 500));
        return {
          success: false,
          message: `Authentication failed: ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log('[MSAL] Response JSON parsed:', {
        success: data.success,
        hasToken: !!data.token,
        hasUser: !!data.user,
        tokenLength: data.token?.length || 0,
        message: data.message,
        fullData: JSON.stringify(data).substring(0, 200)
      });

      if (data.success && data.token && data.user) {
        // Store token and user data
        console.error('[MSAL] 🟢 ✅ Storing token to sessionStorage...');
        console.error('[MSAL] Token details:', { length: data.token?.length, hasUser: !!data.user, success: data.success });
        
        sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
        sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        sessionStorage.setItem(AUTH_TENANT_KEY, tenantCode);
        
        // Verify storage was successful
        const stored = sessionStorage.getItem(AUTH_TOKEN_KEY);
        const storedUser = sessionStorage.getItem(AUTH_USER_KEY);
        console.error('[MSAL] 🟢 Token storage verification:', { tokenStored: !!stored, tokenLength: stored?.length || 0, userStored: !!storedUser });
        
        if (!stored || !storedUser) {
          console.error('[MSAL] ❌ CRITICAL: Token or user not stored in sessionStorage!');
        }
        
        // ⚠️ COMMENTED OUT: Verify token immediately after login
        // This call was causing a race condition - making API request before axios interceptor could attach JWT
        // await authService.verifyTokenAfterLogin(data.token, data.user);
        console.error('[MSAL] 🟢 JWT stored successfully, axios interceptor will use it for subsequent requests');
      } else {
        console.error('[MSAL] ❌ Response missing required fields:', {
          hasSuccess: 'success' in data,
          hasToken: 'token' in data,
          hasUser: 'user' in data,
          successValue: data.success,
          tokenValue: data.token ? `${data.token.substring(0, 50)}...` : 'null',
          userData: data.user ? JSON.stringify(data.user).substring(0, 100) : 'null'
        });
      }

      return data;
    } catch (error: any) {
      console.error('[MSAL] Login error:', error);
      return {
        success: false,
        message: error.message || 'Microsoft authentication failed'
      };
    }
  },

  async verifyTokenAfterLogin(token: string, user: any): Promise<void> {
    try {
      console.log('[TokenVerify] Starting token verification after MSAL login...');
      
      // Call backend to decode and verify the token
      const verifyResponse = await fetch(`${API_BASE}/token-verification/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!verifyResponse.ok) {
        console.warn('[TokenVerify] Backend token verification failed:', verifyResponse.status);
        return;
      }

      const verification = await verifyResponse.json();
      
      // Log token details
      console.log('[TokenVerify] ✅ Token verified successfully:', {
        issued: verification.issuedAt,
        expires: verification.expiresAt,
        isExpired: verification.isExpired,
        userId: verification.claims?.userId,
        tenantId: verification.claims?.tenantId,
        email: verification.claims?.email,
        role: verification.claims?.role,
        issuer: verification.issuer,
        audience: verification.audience
      });

      // Validate critical claims
      const expectedUserId = user.id;
      const expectedTenantId = user.tenantId;
      const actualUserId = verification.claims?.userId;
      const actualTenantId = verification.claims?.tenantId;

      if (actualUserId !== expectedUserId) {
        console.error('[TokenVerify] ❌ UserId mismatch!', {
          expected: expectedUserId,
          actual: actualUserId
        });
      } else {
        console.log('[TokenVerify] ✅ UserId matches:', actualUserId);
      }

      if (actualTenantId !== expectedTenantId) {
        console.error('[TokenVerify] ❌ TenantId mismatch!', {
          expected: expectedTenantId,
          actual: actualTenantId
        });
      } else {
        console.log('[TokenVerify] ✅ TenantId matches:', actualTenantId);
      }

      // Store verification details for debugging
      sessionStorage.setItem('prodvista_token_verified', JSON.stringify({
        timestamp: new Date().toISOString(),
        tokenLength: token.length,
        expiresAt: verification.expiresAt,
        claims: verification.claims,
        verified: true
      }));

    } catch (error: any) {
      console.warn('[TokenVerify] Token verification check failed (non-critical):', error.message);
      // Don't block login if verification fails - it's a diagnostic check
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
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  },

  getUser(): AuthUser | null {
    const userJson = sessionStorage.getItem(AUTH_USER_KEY);
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  },

  getTenantCode(): string | null {
    return sessionStorage.getItem(AUTH_TENANT_KEY);
  },

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  },

  logout(): void {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_TENANT_KEY);
    sessionStorage.removeItem('prodvista_azure_token');
    sessionStorage.removeItem('prodvista_devops_token');
  },

  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  async updateProfile(data: { birthMonth?: number; birthDay?: number; bio?: string; theme?: string }): Promise<AuthUser | null> {
    try {
      const response = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (!response.ok) return null;
      const user: AuthUser = await response.json();
      // Update stored user with new profile data
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      // Invalidate birthday cache so dashboard picks up DOB changes
      const todayKey = `prodvista_birthdays_${new Date().toISOString().slice(0, 10)}`;
      sessionStorage.removeItem(todayKey);
      return user;
    } catch {
      return null;
    }
  },
};

export default authService;
