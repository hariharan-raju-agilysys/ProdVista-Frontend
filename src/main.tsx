import ReactDOM from 'react-dom/client'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './config/msalConfig'
import App from './App'
import './index.css'

// Note: React Query removed — server state now handled via Context/hooks

// Initialize MSAL instance (safe even if not configured — won't attempt login)
const msalInstance = new PublicClientApplication(msalConfig)

// CRITICAL: Initialize MSAL and handle redirect in correct order
msalInstance.initialize().then(() => {
  // After initialize, now handle the redirect from Microsoft login
  return msalInstance.handleRedirectPromise()
}).then((response) => {
  if (response) {
    console.log('[MSAL] ✅ handleRedirectPromise completed successfully', response)
  } else {
    console.log('[MSAL] handleRedirectPromise called but no redirect result')
  }

  // Set active account after initialization and redirect processing
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0])
    console.log('[MSAL] ✅ Active account set:', accounts[0].username)
  }

  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as { account?: { homeAccountId: string } }
      if (payload.account) {
        msalInstance.setActiveAccount(msalInstance.getAccountByHomeId(payload.account.homeAccountId))
        console.log('[MSAL] ✅ LOGIN_SUCCESS event - active account updated')
      }
    }
  })

  // Render app after MSAL is ready and redirect processed
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  )
}).catch((error) => {
  console.error('[MSAL] ❌ Error during initialization or redirect handling:', error)
  // Still render app even if something fails
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  )
})
