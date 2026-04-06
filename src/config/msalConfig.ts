import { Configuration, LogLevel, PopupRequest } from '@azure/msal-browser'

// Azure AD Configuration - Set these in your environment variables
const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || 'your-client-id'
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || 'common'
// Compute redirect URI: use explicit env var, or origin + base path (e.g. /prodvista)
// This avoids the dangerous sed replacement of window.location.origin in the JS bundle
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || `${window.location.origin}${import.meta.env.VITE_BASE_PATH || ''}`

/**
 * MSAL Configuration for Azure AD authentication
 * Documentation: https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-js-initializing-client-applications
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    // 'common' supports multi-tenant + personal accounts
    // Use 'organizations' for work/school accounts only
    // Use specific tenant ID for single-tenant apps
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    redirectUri: REDIRECT_URI,
    postLogoutRedirectUri: REDIRECT_URI,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage', // 'sessionStorage' or 'localStorage'
    storeAuthStateInCookie: false, // Set to true for IE11 support
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return
        switch (level) {
          case LogLevel.Error:
            console.error('[MSAL]', message)
            break
          case LogLevel.Warning:
            console.warn('[MSAL]', message)
            break
          case LogLevel.Info:
            console.info('[MSAL]', message)
            break
          case LogLevel.Verbose:
            console.debug('[MSAL]', message)
            break
        }
      },
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
    },
  },
}

/**
 * Scopes for login request
 * Add additional scopes as needed for your application
 */
export const loginRequest: PopupRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
}

/**
 * Scopes for Microsoft Graph API calls (used for token validation on backend)
 */
export const graphScopes = {
  scopes: ['User.Read'],
}

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphPhotoEndpoint: 'https://graph.microsoft.com/v1.0/me/photo/$value',
}

/**
 * Check if MSAL is configured (Azure AD client ID is set)
 * Uses the resolved clientId from msalConfig (supports runtime injection via entrypoint)
 */
export const isMsalConfigured = (): boolean => {
  const clientId = msalConfig.auth.clientId
  // Validate clientId is a real Azure AD GUID — immune to sed placeholder replacement
  // and esbuild constant folding (unlike string concatenation tricks)
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return !!clientId && guidPattern.test(clientId)
}
