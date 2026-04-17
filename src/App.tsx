import { Suspense, useEffect, useCallback, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AzureAuthProvider } from './context/AzureAuthContext'
import { PersistentChatProvider } from './context/PersistentChatContext'
import { ManagerRoute, OrgRoute, FeatureRoute } from './components/guards'
import { ErrorBoundary, LoadingSpinner } from './components/shared'
import BrandedSplash from './components/BrandedSplash'
import Layout from './components/Layout'
import SessionExpiredModal from './components/SessionExpiredModal'
import ProfileSetupModal from './components/ProfileSetupModal'
import { registerTokenRefresh } from './services/api'
import { graphScopes, armScopes, devopsScopes } from './config/msalConfig'
import { lazyWithRetry, lazyNamedWithRetry } from './utils/lazyWithRetry'

// ---------------------------------------------------------------------------
// Lazy-loaded pages — each page is its own chunk, loaded on first navigation.
// This slashes the initial JS bundle by ~80 %.
// ---------------------------------------------------------------------------

// Auth (keep eager — they are the first screens users see)
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

// Everything else: lazyWithRetry — auto-reloads once on chunk-load failure after deployment
const DynamicDashboardPage = lazyWithRetry(() => import('./pages/DynamicDashboardPage'))
const DynamicPageRenderer = lazyNamedWithRetry(() => import('./components/dynamic'), 'DynamicPageRenderer')
const EngineeringDashboardV2 = lazyWithRetry(() => import('./pages/EngineeringDashboardV2'))
const PullRequestsPage = lazyWithRetry(() => import('./pages/PullRequestsPage'))
const DevOpsOverviewPage = lazyWithRetry(() => import('./pages/DevOpsOverviewPage'))
const DeveloperToolkitPage = lazyWithRetry(() => import('./pages/DeveloperToolkitPage'))
const EngineeringCommandCenter = lazyWithRetry(() => import('./pages/EngineeringCommandCenter'))
const ReleaseManagement = lazyWithRetry(() => import('./pages/ReleaseManagement'))
const QualityDashboardV2 = lazyWithRetry(() => import('./pages/QualityDashboardV2'))
const BugAnalyticsPage = lazyWithRetry(() => import('./pages/BugAnalyticsPage'))
const Production = lazyWithRetry(() => import('./pages/Production'))
const CustomerDashboardV2 = lazyWithRetry(() => import('./pages/CustomerDashboardV2'))
const LogsDashboard = lazyWithRetry(() => import('./pages/LogsDashboard'))
const AzureDashboard = lazyWithRetry(() => import('./pages/AzureDashboard'))
const AIChatPage = lazyWithRetry(() => import('./pages/AIChatPage'))
const AiQueryAssistantPage = lazyWithRetry(() => import('./pages/AiQueryAssistantPage'))
const JenkinsPipelinePage = lazyWithRetry(() => import('./pages/JenkinsPipelinePage'))
const JenkinsSetupPage = lazyWithRetry(() => import('./pages/JenkinsSetupPage'))
const RancherPage = lazyWithRetry(() => import('./pages/RancherPage'))
const RancherSetupPage = lazyWithRetry(() => import('./pages/RancherSetupPage'))
const ObservabilityQueryPage = lazyWithRetry(() => import('./pages/ObservabilityQueryPage'))
const ObservabilityDashboardPage = lazyWithRetry(() => import('./pages/ObservabilityDashboardPage'))
const AutomationJobsPage = lazyWithRetry(() => import('./pages/AutomationJobsPage'))
const OverviewPage = lazyWithRetry(() => import('./pages/OverviewPage'))
const McpToolsPage = lazyWithRetry(() => import('./pages/McpToolsPage'))
const ToolsPage = lazyWithRetry(() => import('./pages/ToolsPage'))
const HrSetupPage = lazyWithRetry(() => import('./pages/HrSetupPage'))
const ProductionCustomersPage = lazyWithRetry(() => import('./pages/ProductionCustomersPage'))
const DataFeedPage = lazyWithRetry(() => import('./pages/DataFeedPage'))
const SalesforcePage = lazyWithRetry(() => import('./pages/SalesforcePage'))
const ManagerSettingsPage = lazyWithRetry(() => import('./pages/ManagerSettings'))
const UserManagement = lazyWithRetry(() => import('./pages/UserManagement'))
const TenantAdminPage = lazyWithRetry(() => import('./pages/TenantAdminPage'))
const MenuManagementPage = lazyWithRetry(() => import('./pages/MenuManagementPage'))
const AccessDeniedPage = lazyWithRetry(() => import('./pages/AccessDeniedPage'))
const ReleaseBranchSetupPage = lazyWithRetry(() => import('./pages/ReleaseBranchSetupPage'))

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function AppRoutes() {
  return (
    <Routes>
      {/* Organization entry - redirect to unified login */}
      <Route path="/org" element={<Navigate to="/login" replace />} />
      
      {/* Authentication routes (eager — no Suspense needed) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      
      {/* Main app routes - OrgRoute allows both authenticated users and guests with org code */}
      <Route path="/" element={
        <OrgRoute>
          <Layout />
        </OrgRoute>
      }>
        {/* Main dashboard - uses OverviewPage with admin features hidden */}
        <Route index element={<OverviewPage isAdminView={false} />} />
        
        {/* Dynamic Dashboard Builder - Manager/Admin only */}
        <Route path="dashboard" element={<ManagerRoute><DynamicDashboardPage /></ManagerRoute>} />
        <Route path="dashboard/:pageSlug" element={<ManagerRoute><DynamicDashboardPage /></ManagerRoute>} />
        
        {/* Dynamic pages from database */}
        <Route path="p/:pageSlug" element={<DynamicPageRenderer />} />
        
        {/* Feature pages */}
        <Route path="engineering" element={<EngineeringDashboardV2 />} />
        <Route path="pull-requests" element={<PullRequestsPage />} />
        <Route path="devops-overview" element={<DevOpsOverviewPage />} />
        <Route path="developer-toolkit" element={<DeveloperToolkitPage />} />
        <Route path="devops" element={<DevOpsOverviewPage />} />
        <Route path="command-center" element={<EngineeringCommandCenter />} />
        <Route path="releases" element={<ReleaseManagement />} />
        <Route path="quality" element={<QualityDashboardV2 />} />
        <Route path="bug-analytics" element={<BugAnalyticsPage />} />
        <Route path="production" element={<Production />} />
        <Route path="customers" element={<CustomerDashboardV2 />} />
        <Route path="logs" element={<LogsDashboard />} />
        <Route path="azure" element={<AzureDashboard />} />
        <Route path="ai-chat" element={<FeatureRoute feature="enableAI"><AIChatPage /></FeatureRoute>} />
        <Route path="ai-query" element={<FeatureRoute feature="enableAI"><AiQueryAssistantPage /></FeatureRoute>} />
        <Route path="jenkins" element={<FeatureRoute feature="enableJenkins"><JenkinsPipelinePage /></FeatureRoute>} />
        <Route path="jenkins-setup" element={<ManagerRoute><JenkinsSetupPage /></ManagerRoute>} />
        <Route path="rancher" element={<RancherPage />} />
        <Route path="rancher-setup" element={<RancherSetupPage />} />
        <Route path="observability-query" element={<ObservabilityQueryPage />} />
        <Route path="observability" element={<ObservabilityDashboardPage />} />
        <Route path="automation" element={<ManagerRoute><AutomationJobsPage /></ManagerRoute>} />
        <Route path="mcp-tools" element={<McpToolsPage />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="data-feed" element={<DataFeedPage />} />
        <Route path="hr-setup" element={<HrSetupPage />} />
        <Route path="production-customers" element={<ProductionCustomersPage />} />
        <Route path="salesforce" element={<SalesforcePage />} />
        
        {/* Manager-only routes */}
        <Route path="settings" element={<ManagerRoute><ManagerSettingsPage /></ManagerRoute>} />
        <Route path="tenant-admin" element={<ManagerRoute><TenantAdminPage /></ManagerRoute>} />
        <Route path="menu-management" element={<ManagerRoute><MenuManagementPage /></ManagerRoute>} />
        <Route path="users" element={<ManagerRoute><UserManagement /></ManagerRoute>} />
        <Route path="release-branches" element={<ManagerRoute><ReleaseBranchSetupPage /></ManagerRoute>} />
      </Route>
      
      {/* Access Denied page */}
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

/**
 * Registers MSAL token refresh callback with the axios interceptor.
 * On 401, the interceptor will call MSAL to silently refresh tokens
 * before falling back to session-expired modal.
 */
function MsalTokenRefreshRegistrar({ children }: { children: React.ReactNode }) {
  const { instance, accounts } = useMsal();

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const account = accounts[0] || instance.getActiveAccount();
    if (!account) return false;

    try {
      // Silent refresh only — no popup fallback.
      // COOP headers from login.microsoftonline.com block window.closed detection,
      // causing MSAL PopupClient to hang. If silent fails with InteractionRequired,
      // trigger a full-page redirect instead of a broken popup.
      let tokenResponse;
      try {
        tokenResponse = await instance.acquireTokenSilent({ ...graphScopes, account, forceRefresh: true });
      } catch (silentErr) {
        if (silentErr instanceof InteractionRequiredAuthError) {
          // Redirect to Microsoft login — will return to app after re-auth
          await instance.acquireTokenRedirect({ ...graphScopes, account });
          return false; // Redirect started; page will reload
        }
        throw silentErr;
      }

      if (!tokenResponse?.accessToken) return false;

      // Refresh Azure Management (ARM) token too — silent only (no popup to avoid admin consent prompt)
      try {
        const armResponse = await instance.acquireTokenSilent({
          ...armScopes, account, forceRefresh: true
        }).catch(() => null);
        if (armResponse?.accessToken) {
          sessionStorage.setItem('prodvista_azure_token', armResponse.accessToken);
        }
      } catch {
        // ARM token is optional
      }

      // Refresh Azure DevOps token too — silent only (no popup to avoid admin consent prompt)
      try {
        const devopsResponse = await instance.acquireTokenSilent({
          ...devopsScopes, account, forceRefresh: true
        }).catch(() => null);
        if (devopsResponse?.accessToken) {
          sessionStorage.setItem('prodvista_devops_token', devopsResponse.accessToken);
        }
      } catch {
        // DevOps token is optional
      }

      return true;
    } catch {
      return false;
    }
  }, [instance, accounts]);

  useEffect(() => {
    registerTokenRefresh(refreshTokens);
    return () => registerTokenRefresh(null);
  }, [refreshTokens]);

  // Proactively acquire Azure ARM token on mount if missing (covers existing sessions)
  useEffect(() => {
    const ensureAzureToken = async () => {
      if (sessionStorage.getItem('prodvista_azure_token')) return;
      const account = accounts[0] || instance.getActiveAccount();
      if (!account) return;
      try {
        const response = await instance.acquireTokenSilent({ ...armScopes, account });
        if (response?.accessToken) {
          sessionStorage.setItem('prodvista_azure_token', response.accessToken);
        }
      } catch {
        // Silent failed — server credentials provide fallback for Azure features
      }
    };
    ensureAzureToken();
  }, [instance, accounts]);

  // Proactively acquire DevOps token on mount if missing (covers existing sessions)
  useEffect(() => {
    const ensureDevOpsToken = async () => {
      if (sessionStorage.getItem('prodvista_devops_token')) return;
      const account = accounts[0] || instance.getActiveAccount();
      if (!account) return;
      try {
        const response = await instance.acquireTokenSilent({ ...devopsScopes, account });
        if (response?.accessToken) {
          sessionStorage.setItem('prodvista_devops_token', response.accessToken);
        }
      } catch {
        // Silent failed — will be resolved on next login (extraScopesToConsent)
      }
    };
    ensureDevOpsToken();
  }, [instance, accounts]);

  return <>{children}</>;
}

/**
 * Blocks all routing while MSAL processes a redirect return from Microsoft login.
 * Only blocks on HandleRedirect/Startup — silent flows (SsoSilent, AcquireToken)
 * use hidden iframes and must NOT block, otherwise LoginPage gets unmounted/remounted
 * which resets its useRef guards and creates infinite ssoSilent loops.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { inProgress } = useMsal();

  if (
    inProgress === InteractionStatus.HandleRedirect ||
    inProgress === InteractionStatus.Startup
  ) {
    return <BrandedSplash message="Authenticating..." />;
  }

  return <>{children}</>;
}

/**
 * Wrapper that shows session expired modal
 */
function AuthModals({ children }: { children: React.ReactNode }) {
  const { isSessionExpired, clearSessionExpired, user, justLoggedIn, clearJustLoggedIn } = useAuth()
  const [profileComplete, setProfileComplete] = useState(false)

  // Show profile setup modal ONLY after a fresh login when DOB is missing
  const needsProfile = !!user && justLoggedIn && !user.birthMonth && !profileComplete

  const handleProfileComplete = () => {
    setProfileComplete(true)
    clearJustLoggedIn()
    // Refresh stored user so the rest of the app sees updated data
    const stored = sessionStorage.getItem('prodvista_auth_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.birthMonth) setProfileComplete(true)
      } catch { /* noop */ }
    }
  }

  return (
    <>
      {children}
      <SessionExpiredModal 
        isOpen={isSessionExpired} 
        onClose={clearSessionExpired}
      />
      <ProfileSetupModal
        isOpen={needsProfile}
        onComplete={handleProfileComplete}
      />
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AzureAuthProvider>
          <MsalTokenRefreshRegistrar>
            <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
              <AuthGate>
                <AuthModals>
                  <PersistentChatProvider>
                    <Suspense fallback={<LoadingSpinner label="Loading..." />}>
                      <AppRoutes />
                    </Suspense>
                  </PersistentChatProvider>
                </AuthModals>
              </AuthGate>
            </BrowserRouter>
          </MsalTokenRefreshRegistrar>
        </AzureAuthProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
