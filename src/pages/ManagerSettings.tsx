import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, Shield, MapPin, Database, Cpu, Users, Save, AlertCircle, Cloud, Zap,
  GitBranch, RefreshCw, Loader2, CheckCircle, XCircle
} from 'lucide-react'
import { useSettingsStore, useIsManager } from '../stores/settingsStore'
import { LLMConfigPanel } from '../components/LLMConfigPanel'
import AzureResourceManager from '../components/AzureResourceManager'
import AzureResourceSetup from '../components/AzureResourceSetup'
import DevOpsConnectionSetup from '../components/DevOpsConnectionSetup'
import { devopsService, AzureDevOpsOrganization } from '../services/devopsService'
import engineeringService, { EngineeringConfig } from '../services/engineeringService'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { devopsScopes, isMsalConfigured } from '../config/msalConfig'
import { storeEncryptedDevOpsToken } from '../utils/tokenEncryption'
import { AzureDevOpsUrlBuilder } from '../utils/azure-devops-url-builder'

type TabId = 'general' | 'llm' | 'azure-setup' | 'azure' | 'devops' | 'regions' | 'users'

interface Tab {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const tabs: Tab[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'llm', label: 'AI / LLM', icon: Cpu },
  { id: 'azure-setup', label: 'Azure Setup', icon: Zap },
  { id: 'azure', label: 'Azure Resources', icon: Database },
  { id: 'devops', label: 'Azure DevOps', icon: GitBranch },
  { id: 'regions', label: 'Regions', icon: MapPin },
  { id: 'users', label: 'Access Control', icon: Users },
]

export function ManagerSettingsPage() {
  const isManager = useIsManager()
  const { settings, updateSettings, userRole, setUserRole, toggleRegion } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [isSaving, setIsSaving] = useState(false)
  const { instance, accounts } = useMsal()

  /**
   * ✅ NEW: Stores DevOps PAT token with encryption
   * Uses user session (userId + tenantId) as encryption salt
   */
  const storeDevOpsToken = async (token: string): Promise<void> => {
    try {
      const userStr = sessionStorage.getItem('prodvista_auth_user');
      if (!userStr) {
        console.warn('No user session found - storing token unencrypted (fallback)');
        sessionStorage.setItem('prodvista_devops_token', token);
        return;
      }
      const user = JSON.parse(userStr);
      await storeEncryptedDevOpsToken(token, user.id, user.tenantId);
      console.log('✅ DevOps PAT token stored with encryption');
    } catch (error) {
      console.error('Failed to encrypt DevOps token:', error);
      // Fallback to unencrypted storage if encryption fails
      sessionStorage.setItem('prodvista_devops_token', token);
    }
  };

  /** Ensure a DevOps SSO token is in sessionStorage, acquiring one if necessary. */
  const ensureDevOpsToken = async (): Promise<boolean> => {
    if (sessionStorage.getItem('prodvista_devops_token')) return true
    if (!isMsalConfigured()) return false
    const account = accounts[0] || instance.getActiveAccount()
    if (!account) return false
    try {
      const response = await instance.acquireTokenSilent({ ...devopsScopes, account })
      if (response?.accessToken) {
        await storeDevOpsToken(response.accessToken); // ✅ Use encrypted storage
        return true
      }
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        try {
          const response = await instance.acquireTokenPopup({ ...devopsScopes, account })
          if (response?.accessToken) {
            await storeDevOpsToken(response.accessToken); // ✅ Use encrypted storage
            return true
          }
        } catch (popupErr) {
          console.warn('[MSAL] DevOps token popup failed:', popupErr)
        }
      } else {
        console.warn('[MSAL] DevOps token silent failed:', err)
      }
    }
    return false
  }

  // DevOps config state
  const [devopsOrgs, setDevopsOrgs] = useState<AzureDevOpsOrganization[]>([])
  const [devopsProjects, setDevopsProjects] = useState<{ id: string; name: string }[]>([])
  const [devopsSelectedOrg, setDevopsSelectedOrg] = useState('')
  const [devopsSelectedProjects, setDevopsSelectedProjects] = useState<string[]>([])
  const [devopsIsDiscovering, setDevopsIsDiscovering] = useState(false)
  const [devopsSavedConfig, setDevopsSavedConfig] = useState<EngineeringConfig | null>(null)
  const [devopsTestResult, setDevopsTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [devopsError, setDevopsError] = useState<string | null>(null)
  const [devDevOpsToken, setDevDevOpsToken] = useState('')
  const msalAvailable = isMsalConfigured() && accounts.length > 0

  // Load saved DevOps config
  useEffect(() => {
    const saved = engineeringService.getSavedConfig()
    if (saved) {
      setDevopsSavedConfig(saved)
      setDevopsSelectedOrg(saved.organizationUrl)
      setDevopsSelectedProjects(saved.projectNames?.length ? saved.projectNames : saved.projectName ? [saved.projectName] : [])
    }
  }, [])

  const handleDiscoverOrgs = async () => {
    setDevopsIsDiscovering(true)
    setDevopsError(null)
    try {
      // ✅ If user pasted a PAT token, store it with encryption
      if (devDevOpsToken.trim()) {
        await storeDevOpsToken(devDevOpsToken.trim());
      } else {
        await ensureDevOpsToken()
      }
      const orgs = await devopsService.discoverOrganizations()
      setDevopsOrgs(orgs)
      if (orgs.length > 0 && !devopsSelectedOrg) {
        setDevopsSelectedOrg(orgs[0].accountUri)
      }
    } catch {
      setDevopsError('Failed to discover organizations. Ensure you are signed in with Azure SSO or Azure CLI is logged in.')
    } finally {
      setDevopsIsDiscovering(false)
    }
  }

  const handleDiscoverProjects = async (orgUrl: string) => {
    if (!orgUrl) return
    setDevopsIsDiscovering(true)
    setDevopsError(null)
    try {
      // ✅ If user pasted a PAT token, store it with encryption
      if (devDevOpsToken.trim()) {
        await storeDevOpsToken(devDevOpsToken.trim());
      } else {
        await ensureDevOpsToken()
      }
      const projs = await devopsService.discoverProjects(orgUrl)
      setDevopsProjects(projs)
      if (projs.length > 0 && devopsSelectedProjects.length === 0) {
        setDevopsSelectedProjects([projs[0].name])
      }
    } catch {
      setDevopsError('Failed to discover projects.')
    } finally {
      setDevopsIsDiscovering(false)
    }
  }

  useEffect(() => {
    if (devopsSelectedOrg && activeTab === 'devops') {
      handleDiscoverProjects(devopsSelectedOrg)
    }
  }, [devopsSelectedOrg, activeTab])

  const handleTestDevOpsConnection = async () => {
    if (!devopsSelectedOrg || devopsSelectedProjects.length === 0) return
    setDevopsIsDiscovering(true)
    setDevopsTestResult(null)
    try {
      // ✅ If user pasted a PAT token, store it with encryption
      if (devDevOpsToken.trim()) {
        await storeDevOpsToken(devDevOpsToken.trim());
      } else {
        await ensureDevOpsToken()
      }
      const result = await devopsService.testDiscoveredConnection(devopsSelectedOrg, devopsSelectedProjects[0])
      setDevopsTestResult(result)
    } catch {
      setDevopsTestResult({ success: false, message: 'Connection test failed' })
    } finally {
      setDevopsIsDiscovering(false)
    }
  }

  const handleSaveDevOpsConfig = () => {
    if (!devopsSelectedOrg || devopsSelectedProjects.length === 0) return
    const newConfig: EngineeringConfig = {
      organizationUrl: devopsSelectedOrg,
      projectName: devopsSelectedProjects[0],
      projectNames: devopsSelectedProjects,
    }
    engineeringService.saveConfig(newConfig)
    setDevopsSavedConfig(newConfig)
  }

  const handleClearDevOpsConfig = () => {
    engineeringService.clearConfig()
    setDevopsSavedConfig(null)
    setDevopsSelectedOrg('')
    setDevopsSelectedProjects([])
    setDevopsTestResult(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsSaving(false)
  }

  // For demo, allow switching roles
  const toggleManagerRole = () => {
    if (userRole.role === 'manager') {
      setUserRole({ role: 'user', permissions: ['view'] })
    } else {
      setUserRole({ role: 'manager', permissions: ['view', 'edit', 'configure'] })
    }
  }

  if (!isManager) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center"
          >
            <Shield className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Manager Access Required</h2>
            <p className="text-gray-400 mb-6">
              Only managers can access the settings page. Contact your administrator for access.
            </p>
            <div className="p-4 bg-gray-900/50 rounded-lg text-left">
              <p className="text-sm text-gray-500">Current Role: <span className="text-white capitalize">{userRole.role}</span></p>
              <p className="text-sm text-gray-500">Permissions: <span className="text-white">{userRole.permissions.join(', ')}</span></p>
            </div>
            
            {/* Demo toggle - remove in production */}
            <button
              onClick={toggleManagerRole}
              className="mt-6 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
            >
              [Demo] Switch to Manager Role
            </button>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Settings className="w-8 h-8 text-purple-400" />
                Manager Settings
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Configure application settings and integrations</p>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save All Changes
            </button>
          </div>

          {/* Demo role toggle */}
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Demo Mode: You are logged in as a Manager</span>
            </div>
            <button
              onClick={toggleManagerRole}
              className="text-xs px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-colors"
            >
              Switch to User View
            </button>
          </div>
        </motion.div>

        <div className="flex gap-8">
          {/* Sidebar Tabs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-64 flex-shrink-0"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'bg-purple-500/20 text-purple-400 border-l-2 border-purple-500'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white border-l-2 border-transparent'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* Content Area */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">General Settings</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                          Dashboard Refresh Interval
                        </label>
                        <select
                          value={settings.dashboardRefreshInterval}
                          onChange={(e) => updateSettings({ dashboardRefreshInterval: Number(e.target.value) })}
                          className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:border-purple-500 outline-none"
                        >
                          <option value={10000}>10 seconds</option>
                          <option value={30000}>30 seconds</option>
                          <option value={60000}>1 minute</option>
                          <option value={300000}>5 minutes</option>
                        </select>
                      </div>

                      {/* Theme selector removed — light mode only */}

                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                          Enabled Features
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(settings.enabledFeatures).map(([feature, enabled]) => (
                            <label
                              key={feature}
                              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => updateSettings({
                                  enabledFeatures: {
                                    ...settings.enabledFeatures,
                                    [feature]: !enabled,
                                  },
                                })}
                                className="w-4 h-4 accent-purple-500"
                              />
                              <span className="text-gray-700 dark:text-gray-300 capitalize">{feature.replace(/([A-Z])/g, ' $1')}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'llm' && (
                <motion.div
                  key="llm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <LLMConfigPanel />
                </motion.div>
              )}

              {activeTab === 'azure-setup' && (
                <motion.div
                  key="azure-setup"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <AzureResourceSetup />
                </motion.div>
              )}

              {activeTab === 'azure' && (
                <motion.div
                  key="azure"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  {/* Auto-Discovery Azure Resource Manager */}
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Cloud className="w-6 h-6 text-blue-400" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Azure Resources</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Auto-discover and configure Azure resources via CLI/SSO - no manual IDs required
                        </p>
                      </div>
                    </div>
                  </div>
                  <AzureResourceManager />
                </motion.div>
              )}

              {activeTab === 'devops' && (
                <motion.div
                  key="devops"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* PAT-based Connection (primary method) */}
                  <DevOpsConnectionSetup mode="settings" />

                  {/* Separator */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">or use Azure SSO</span>
                    <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  </div>

                  {/* SSO-based connection (secondary/alternative) */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-6">
                      <GitBranch className="w-6 h-6 text-blue-400" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Azure SSO Discovery</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Auto-discover organizations and projects using your Azure SSO session.
                        </p>
                      </div>
                    </div>

                    {devopsSavedConfig && (
                      <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            <div>
                              <p className="text-sm font-medium text-green-400">Connected</p>
                              <p className="text-xs text-gray-400">
                                {AzureDevOpsUrlBuilder.extractOrganization(devopsSavedConfig.organizationUrl) || 'Unknown'} / {devopsSavedConfig.projectNames?.length ? devopsSavedConfig.projectNames.join(', ') : devopsSavedConfig.projectName}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleClearDevOpsConfig}
                            className="text-xs px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    )}

                    {devopsError && (
                      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-400">{devopsError}</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Dev token input — shown when MSAL/SSO is not available (local dev) */}
                      {!msalAvailable && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                          <p className="text-xs text-amber-400">
                            SSO not available (local dev). Paste a DevOps Bearer token to use discovery:
                          </p>
                          <code className="block text-[10px] text-gray-500 bg-gray-900 p-2 rounded select-all">
                            az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv
                          </code>
                          <input
                            type="password"
                            value={devDevOpsToken}
                            onChange={e => setDevDevOpsToken(e.target.value)}
                            placeholder="Paste Bearer token here..."
                            className="w-full px-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-amber-500 outline-none"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Organization
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={devopsSelectedOrg}
                            onChange={(e) => {
                              setDevopsSelectedOrg(e.target.value)
                              setDevopsSelectedProjects([])
                              setDevopsTestResult(null)
                            }}
                            className="flex-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none"
                          >
                            <option value="">Select organization...</option>
                            {devopsOrgs.map(org => (
                              <option key={org.accountId} value={org.accountUri}>
                                {org.accountName}
                              </option>
                            ))}
                            {devopsSavedConfig && !devopsOrgs.find(o => o.accountUri === devopsSavedConfig.organizationUrl) && (
                              <option value={devopsSavedConfig.organizationUrl}>
                                {AzureDevOpsUrlBuilder.extractOrganization(devopsSavedConfig.organizationUrl) || 'Unknown'}
                              </option>
                            )}
                          </select>
                          <button
                            onClick={handleDiscoverOrgs}
                            disabled={devopsIsDiscovering}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
                          >
                            {devopsIsDiscovering ? <Loader2 className="animate-spin w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                            Discover
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Uses your Azure SSO credentials to auto-discover organizations</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Projects <span className="text-gray-500 text-xs font-normal">(select one or more)</span>
                        </label>
                        {devopsSelectedProjects.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {devopsSelectedProjects.map(name => (
                              <span key={name} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded-full text-sm">
                                {name}
                                <button
                                  onClick={() => {
                                    setDevopsSelectedProjects(prev => prev.filter(p => p !== name))
                                    setDevopsTestResult(null)
                                  }}
                                  className="hover:text-red-400 transition-colors ml-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className={`w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden ${!devopsSelectedOrg ? 'opacity-50' : ''}`}>
                          {devopsProjects.length === 0 ? (
                            <p className="p-3 text-gray-500 text-sm">{devopsSelectedOrg ? 'No projects found. Click Discover.' : 'Select an organization first.'}</p>
                          ) : (
                            <div className="max-h-48 overflow-y-auto">
                              {devopsProjects.map(proj => {
                                const isSelected = devopsSelectedProjects.includes(proj.name)
                                return (
                                  <button
                                    key={proj.id}
                                    onClick={() => {
                                      setDevopsSelectedProjects(prev =>
                                        isSelected ? prev.filter(p => p !== proj.name) : [...prev, proj.name]
                                      )
                                      setDevopsTestResult(null)
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                                      isSelected
                                        ? 'bg-blue-600/20 text-blue-300'
                                        : 'text-gray-300 hover:bg-gray-800'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                      isSelected ? 'bg-blue-600 border-blue-500' : 'border-gray-600'
                                    }`}>
                                      {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                    </div>
                                    {proj.name}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {devopsTestResult && (
                        <div className={`p-3 rounded-lg border ${devopsTestResult.success
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                        }`}>
                          <div className="flex items-center gap-2">
                            {devopsTestResult.success
                              ? <CheckCircle className="w-4 h-4 text-green-400" />
                              : <XCircle className="w-4 h-4 text-red-400" />
                            }
                            <p className={`text-sm ${devopsTestResult.success ? 'text-green-400' : 'text-red-400'}`}>
                              {devopsTestResult.message}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleTestDevOpsConnection}
                          disabled={!devopsSelectedOrg || devopsSelectedProjects.length === 0 || devopsIsDiscovering}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                        >
                          Test Connection
                        </button>
                        <button
                          onClick={handleSaveDevOpsConfig}
                          disabled={!devopsSelectedOrg || devopsSelectedProjects.length === 0}
                          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                        >
                          Save Connection
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-2">How It Works</h3>
                    <ul className="text-sm text-gray-400 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        <strong className="text-gray-300">PAT (Recommended):</strong> Paste a Personal Access Token above for direct, reliable access
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        <strong className="text-gray-300">SSO:</strong> Click "Discover" to auto-detect organizations via your Azure session
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        Engineering Dashboard, Bug Analytics, and Commit/PR widgets will use the saved connection
                      </li>
                    </ul>
                  </div>
                </motion.div>
              )}

              {activeTab === 'regions' && (
                <motion.div
                  key="regions"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Azure Regions</h3>
                    <p className="text-gray-400 mb-4">Enable the regions you want to monitor</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {settings.azure.regions.map((region) => (
                        <button
                          key={region.id}
                          onClick={() => toggleRegion(region.id)}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${
                            region.isEnabled
                              ? 'border-green-500 bg-green-500/10'
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <MapPin className={`w-4 h-4 ${region.isEnabled ? 'text-green-400' : 'text-gray-500'}`} />
                            {region.isDefault && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">Default</span>
                            )}
                          </div>
                          <p className="text-white font-medium mt-2">{region.displayName}</p>
                          <p className="text-xs text-gray-500">{region.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'users' && (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Access Control</h3>
                    <p className="text-gray-400 mb-6">
                      Users sign in with Azure AD. Managers can configure settings, users can only view dashboards.
                    </p>

                    <div className="space-y-4">
                      <div className="p-4 bg-gray-900 rounded-lg">
                        <h4 className="text-white font-medium mb-2">Role: Manager</h4>
                        <p className="text-sm text-gray-400 mb-2">Full access to all settings and configurations</p>
                        <div className="flex flex-wrap gap-2">
                          {['view', 'edit', 'configure', 'manage-users'].map((perm) => (
                            <span key={perm} className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-gray-900 rounded-lg">
                        <h4 className="text-white font-medium mb-2">Role: User</h4>
                        <p className="text-sm text-gray-400 mb-2">Can view dashboards and logs</p>
                        <div className="flex flex-wrap gap-2">
                          {['view'].map((perm) => (
                            <span key={perm} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-gray-900 rounded-lg">
                        <h4 className="text-white font-medium mb-2">Role: Viewer</h4>
                        <p className="text-sm text-gray-400 mb-2">Read-only access to dashboards</p>
                        <div className="flex flex-wrap gap-2">
                          {['view'].map((perm) => (
                            <span key={perm} className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerSettingsPage
