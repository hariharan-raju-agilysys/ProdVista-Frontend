import { Configuration, LogLevel, PopupRequest } from '@azure/msal-browser'

// Azure AD Configuration - Set these in your environment variables
const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || 'your-client-id'
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || 'your-tenant-id'
// Compute redirect URI: use explicit env var, or origin + base path (e.g. /prodvista)
// This avoids the dangerous sed replacement of window.location.origin in the JS bundle
// Enforce HTTPS when the page is loaded over HTTPS (prevents mixed content errors
// in AKS behind TLS-terminating ingress when the build-time env var uses http://)
const REDIRECT_URI = (() => {
  const uri = import.meta.env.VITE_REDIRECT_URI || `${window.location.origin}${import.meta.env.VITE_BASE_PATH || ''}`;
  if (window.location.protocol === 'https:' && uri.startsWith('http://')) {
    return uri.replace('http://', 'https://');
  }
  return uri;
})();

/**
 * MSAL Configuration for Azure AD authentication
 * Documentation: https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-js-initializing-client-applications
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    // Placeholder 'your-tenant-id' is replaced at runtime via docker-entrypoint.sh sed
    // For single-tenant apps, this MUST resolve to the actual Azure AD tenant GUID
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
  // TODO: Uncomment after Azure DevOps approval for Calendar & OnlineMeetings access
  // scopes: ['User.Read', 'Calendars.Read', 'OnlineMeetings.Read', 'openid', 'profile', 'email'],
}

/**
 * Scopes for Microsoft Graph API calls (used for token validation on backend)
 */
export const graphScopes = {
  scopes: ['User.Read'],
  // TODO: Uncomment after Azure DevOps approval for Calendar & OnlineMeetings access
  // scopes: ['User.Read', 'Calendars.Read', 'OnlineMeetings.Read'],
}

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphPhotoEndpoint: 'https://graph.microsoft.com/v1.0/me/photo/$value',
}

/**
 * Azure Resource Manager (ARM) scopes for resource discovery
 */
export const armScopes = {
  scopes: ['https://management.azure.com/.default'],
}

/**
 * Azure DevOps scopes — 499b84ac… is the well-known Microsoft-published
 * Application ID for Azure DevOps (not a secret).
 * See: https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth?view=azure-devops#scopes
 */
export const devopsScopes = {
  scopes: ['499b84ac-1321-427f-aa17-267ca6975798/user_impersonation'],
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
