/**
 * Session Management Service
 * Handles session initialization, token caching, and refresh.
 * Session ID is stored encrypted in sessionStorage and sent with every API request.
 */

import api from './api';

export interface SessionStatus {
  sessionId: string;
  isValid: boolean;
  createdAt: string;
  expiresAt: string;
  tokenCount: number;
  providers: string[];
}

export interface InitializeSessionRequest {
  providers: string[];
  forceRefresh?: boolean;
}

export interface InitializeSessionResponse {
  sessionId: string;
  expiresAt: string;
  tokensInitialized: number;
  providers: string[];
}

// Session ID storage key
const SESSION_ID_KEY = 'pv_session_id';
const SESSION_EXPIRY_KEY = 'pv_session_expiry';

// Provider constants - matching backend IntegrationConstants
export const SessionProviders = {
  AZURE_DEVOPS: 'azuredevops',
  AZURE_MANAGEMENT: 'azuremanagement',
  AZURE_GRAPH: 'azuregraph',
  JENKINS: 'jenkins',
  HR_PORTAL: 'hrportal',
  LLM_AZURE: 'llm_azure',
  LLM_OPENAI: 'llm_openai',
  LLM_ANTHROPIC: 'llm_anthropic',
} as const;

export type SessionProvider = typeof SessionProviders[keyof typeof SessionProviders];

// Default providers to initialize on session start
const DEFAULT_PROVIDERS: SessionProvider[] = [
  SessionProviders.AZURE_DEVOPS,
  SessionProviders.AZURE_MANAGEMENT,
];

/**
 * Get the current session ID from storage
 */
export function getSessionId(): string | null {
  return sessionStorage.getItem(SESSION_ID_KEY);
}

/**
 * Check if the session is valid (not expired)
 */
export function isSessionValid(): boolean {
  const sessionId = getSessionId();
  const expiryStr = sessionStorage.getItem(SESSION_EXPIRY_KEY);
  
  if (!sessionId || !expiryStr) return false;
  
  const expiry = new Date(expiryStr);
  return expiry > new Date();
}

/**
 * Store session information
 */
function storeSession(sessionId: string, expiresAt: string): void {
  sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  sessionStorage.setItem(SESSION_EXPIRY_KEY, expiresAt);
}

/**
 * Clear session information
 */
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_ID_KEY);
  sessionStorage.removeItem(SESSION_EXPIRY_KEY);
}

/**
 * Initialize a new session with the specified providers
 */
export async function initializeSession(
  providers: SessionProvider[] = DEFAULT_PROVIDERS,
  forceRefresh = false
): Promise<InitializeSessionResponse> {
  // If we have a valid session and not forcing refresh, return early
  if (isSessionValid() && !forceRefresh) {
    const status = await getSessionStatus();
    if (status?.isValid) {
      return {
        sessionId: status.sessionId,
        expiresAt: status.expiresAt,
        tokensInitialized: status.tokenCount,
        providers: status.providers,
      };
    }
  }

  const request: InitializeSessionRequest = {
    providers,
    forceRefresh,
  };

  const response = await api.post<InitializeSessionResponse>('/session/initialize', request);
  
  storeSession(response.data.sessionId, response.data.expiresAt);
  
  return response.data;
}

/**
 * Get current session status
 */
export async function getSessionStatus(): Promise<SessionStatus | null> {
  const sessionId = getSessionId();
  if (!sessionId) return null;

  try {
    const response = await api.get<SessionStatus>('/session/status');
    return response.data;
  } catch {
    // Session invalid or expired
    clearSession();
    return null;
  }
}

/**
 * Refresh tokens for specific providers
 */
export async function refreshTokens(
  provider: SessionProvider,
  scope?: string
): Promise<void> {
  await api.post('/session/refresh', { provider, scope });
}

/**
 * Invalidate the current session (logout)
 */
export async function invalidateSession(): Promise<void> {
  try {
    await api.post('/session/invalidate');
  } finally {
    clearSession();
  }
}

/**
 * Session service singleton for managing session lifecycle
 */
class SessionService {
  private initPromise: Promise<InitializeSessionResponse> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialize session when app loads
   * Returns existing promise if initialization is already in progress
   */
  async initialize(providers?: SessionProvider[]): Promise<InitializeSessionResponse> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = initializeSession(providers);
    
    try {
      const result = await this.initPromise;
      this.scheduleRefresh(result.expiresAt);
      return result;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Schedule automatic session refresh before expiry
   */
  private scheduleRefresh(expiresAt: string): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const expiry = new Date(expiresAt);
    const now = new Date();
    // Refresh 5 minutes before expiry
    const refreshIn = expiry.getTime() - now.getTime() - 5 * 60 * 1000;

    if (refreshIn > 0) {
      this.refreshTimer = setTimeout(() => {
        this.initialize().catch(console.error);
      }, refreshIn);
    }
  }

  /**
   * Clean up timers on logout
   */
  cleanup(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.initPromise = null;
    clearSession();
  }
}

// Export singleton instance
export const sessionService = new SessionService();

export default sessionService;
