import ReactDOM from 'react-dom/client'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './config/msalConfig'
import App from './App'
import './index.css'

// Note: React Query removed — server state now handled via Context/hooks

// Initialize MSAL instance (safe even if not configured — won't attempt login)
const msalInstance = new PublicClientApplication(msalConfig)

// Set active account after redirect/popup
msalInstance.initialize().then(() => {
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0])
  }

  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as { account?: { homeAccountId: string } }
      if (payload.account) {
        msalInstance.setActiveAccount(msalInstance.getAccountByHomeId(payload.account.homeAccountId))
      }
    }
  })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <MsalProvider instance={msalInstance}>
    <App />
  </MsalProvider>
)
