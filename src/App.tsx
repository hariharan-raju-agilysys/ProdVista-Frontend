import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AzureAuthProvider } from './context/AzureAuthContext'
import { PersistentChatProvider } from './context/PersistentChatContext'
import { ManagerRoute, OrgRoute, FeatureRoute } from './components/guards'
import { ErrorBoundary, LoadingSpinner } from './components/shared'
import Layout from './components/Layout'
import SessionExpiredModal from './components/SessionExpiredModal'

// ---------------------------------------------------------------------------
// Lazy-loaded pages — each page is its own chunk, loaded on first navigation.
// This slashes the initial JS bundle by ~80 %.
// ---------------------------------------------------------------------------

// Auth (keep eager — they are the first screens users see)
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

// Everything else: lazy
const ManagerDashboard = lazy(() => import('./components/ManagerDashboard'))
const DynamicDashboardPage = lazy(() => import('./pages/DynamicDashboardPage'))
const DynamicPageRenderer = lazy(() => import('./components/dynamic').then(m => ({ default: m.DynamicPageRenderer })))
const EngineeringDashboardV2 = lazy(() => import('./pages/EngineeringDashboardV2'))
const PullRequestsPage = lazy(() => import('./pages/PullRequestsPage'))
const DevOpsOverviewPage = lazy(() => import('./pages/DevOpsOverviewPage'))
const EngineeringCommandCenter = lazy(() => import('./pages/EngineeringCommandCenter'))
const ReleaseManagement = lazy(() => import('./pages/ReleaseManagement'))
const QualityDashboardV2 = lazy(() => import('./pages/QualityDashboardV2'))
const BugAnalyticsPage = lazy(() => import('./pages/BugAnalyticsPage'))
const Production = lazy(() => import('./pages/Production'))
const CustomerDashboardV2 = lazy(() => import('./pages/CustomerDashboardV2'))
const LogsDashboard = lazy(() => import('./pages/LogsDashboard'))
const AzureDashboard = lazy(() => import('./pages/AzureDashboard'))
const AIChatPage = lazy(() => import('./pages/AIChatPage'))
const AiQueryAssistantPage = lazy(() => import('./pages/AiQueryAssistantPage'))
const ReleaseNotesPageV2 = lazy(() => import('./pages/ReleaseNotesPageV2'))
const JenkinsPipelinePage = lazy(() => import('./pages/JenkinsPipelinePage'))
const JenkinsSetupPage = lazy(() => import('./pages/JenkinsSetupPage'))
const ObservabilityQueryPage = lazy(() => import('./pages/ObservabilityQueryPage'))
const ObservabilityDashboardPage = lazy(() => import('./pages/ObservabilityDashboardPage'))
const InternalDashboardPage = lazy(() => import('./pages/InternalDashboardPage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const HrSetupPage = lazy(() => import('./pages/HrSetupPage'))
const ProductionCustomersPage = lazy(() => import('./pages/ProductionCustomersPage'))
const DataFeedPage = lazy(() => import('./pages/DataFeedPage'))
const ManagerSettingsPage = lazy(() => import('./pages/ManagerSettings'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const TenantAdminPage = lazy(() => import('./pages/TenantAdminPage'))
const MenuManagementPage = lazy(() => import('./pages/MenuManagementPage'))
const AccessDeniedPage = lazy(() => import('./pages/AccessDeniedPage'))

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
        {/* Main dashboard - uses InternalDashboardPage with admin features hidden */}
        <Route index element={<InternalDashboardPage isAdminView={false} />} />
        
        {/* Dynamic Dashboard Builder - Manager/Admin only */}
        <Route path="dashboard" element={<ManagerRoute><DynamicDashboardPage /></ManagerRoute>} />
        <Route path="dashboard/:pageSlug" element={<ManagerRoute><DynamicDashboardPage /></ManagerRoute>} />
        
        {/* Dynamic pages from database */}
        <Route path="p/:pageSlug" element={<DynamicPageRenderer />} />
        
        {/* Feature pages */}
        <Route path="engineering" element={<EngineeringDashboardV2 />} />
        <Route path="pull-requests" element={<PullRequestsPage />} />
        <Route path="devops-overview" element={<DevOpsOverviewPage />} />
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
        <Route path="release-notes" element={<FeatureRoute feature="enableReleaseNotes"><ReleaseNotesPageV2 /></FeatureRoute>} />
        <Route path="jenkins" element={<FeatureRoute feature="enableJenkins"><JenkinsPipelinePage /></FeatureRoute>} />
        <Route path="jenkins-setup" element={<ManagerRoute><JenkinsSetupPage /></ManagerRoute>} />
        <Route path="observability-query" element={<ObservabilityQueryPage />} />
        <Route path="observability" element={<ObservabilityDashboardPage />} />
        <Route path="internal" element={<InternalDashboardPage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="data-feed" element={<DataFeedPage />} />
        <Route path="hr-setup" element={<HrSetupPage />} />
        <Route path="production-customers" element={<ProductionCustomersPage />} />
        
        {/* Manager-only routes */}
        <Route path="settings" element={<ManagerRoute><ManagerSettingsPage /></ManagerRoute>} />
        <Route path="tenant-admin" element={<ManagerRoute><TenantAdminPage /></ManagerRoute>} />
        <Route path="menu-management" element={<ManagerRoute><MenuManagementPage /></ManagerRoute>} />
        <Route path="users" element={<ManagerRoute><UserManagement /></ManagerRoute>} />
      </Route>
      
      {/* Access Denied page */}
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

/**
 * Wrapper that shows session expired modal
 */
function AuthModals({ children }: { children: React.ReactNode }) {
  const { isSessionExpired, clearSessionExpired } = useAuth()
  return (
    <>
      {children}
      <SessionExpiredModal 
        isOpen={isSessionExpired} 
        onClose={clearSessionExpired}
      />
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AzureAuthProvider>
          <BrowserRouter>
            <AuthModals>
              <PersistentChatProvider>
                <Suspense fallback={<LoadingSpinner label="Loading..." />}>
                  <AppRoutes />
                </Suspense>
              </PersistentChatProvider>
            </AuthModals>
          </BrowserRouter>
        </AzureAuthProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
