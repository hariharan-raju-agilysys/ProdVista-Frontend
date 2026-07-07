import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, Shield, Cloud, Activity, Brain, GitBranch, Code2,
  Check, AlertCircle, Loader2, Heart, Plus, Users, Palette, ChevronRight
} from 'lucide-react'
import {
  getFeatureConfig, updateFeatureConfig, getAllProviders, checkAdapterHealth, listTenants, createTenant,
  type TenantFeatureConfig, type ProviderOption, type AdapterHealthResult, type TenantSummary, type CreateTenantRequest
} from '../services/tenantSetupService'
import { useAuth } from '../context/AuthContext'

// ==========================================
// Types
// ==========================================

type TabId = 'adapters' | 'tenants' | 'branding'

interface AdapterCategory {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  providerField: keyof TenantFeatureConfig
  settingsField: keyof TenantFeatureConfig
  description: string
}

const ADAPTER_CATEGORIES: AdapterCategory[] = [
  { key: 'auth', label: 'Authentication', icon: Shield, providerField: 'authProvider', settingsField: 'authSettings', description: 'How users log in to this tenant' },
  { key: 'cloud', label: 'Cloud Platform', icon: Cloud, providerField: 'cloudProvider', settingsField: 'cloudSettings', description: 'Cloud resource monitoring and management' },
  { key: 'monitoring', label: 'Monitoring', icon: Activity, providerField: 'monitoringProvider', settingsField: 'monitoringSettings', description: 'Application performance and log monitoring' },
  { key: 'ai', label: 'AI / LLM Pipeline', icon: Brain, providerField: 'aiProvider', settingsField: 'aiSettings', description: 'AI-powered features and natural language queries' },
  { key: 'cicd', label: 'CI/CD Pipeline', icon: GitBranch, providerField: 'cicdProvider', settingsField: 'cicdSettings', description: 'Build pipelines and deployment tracking' },
  { key: 'sourcecontrol', label: 'Source Control', icon: Code2, providerField: 'sourceControlProvider', settingsField: 'sourceControlSettings', description: 'Repository and code management' },
]

// ==========================================
// Main Component
// ==========================================

export default function TenantAdminPage() {
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('adapters')
  const [config, setConfig] = useState<TenantFeatureConfig | null>(null)
  const [providers, setProviders] = useState<Record<string, ProviderOption[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [configData, providerData] = await Promise.all([
        getFeatureConfig(),
        getAllProviders(),
      ])
      setConfig(configData)
      setProviders(providerData)
    } catch (_) {
      setError('Failed to load tenant configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleProviderChange = async (providerField: keyof TenantFeatureConfig, value: string) => {
    if (!config) return
    try {
      setSaving(true)
      setError(null)
      const update = { [providerField]: value }
      const updated = await updateFeatureConfig(update)
      setConfig(updated)
      setSuccessMsg('Configuration updated')
      setTimeout(() => setSuccessMsg(null), 2000)
    } catch (_) {
      setError('Failed to update configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleSettingsChange = async (settingsField: keyof TenantFeatureConfig, settings: Record<string, string>) => {
    if (!config) return
    try {
      setSaving(true)
      const update = { [settingsField]: JSON.stringify(settings) }
      const updated = await updateFeatureConfig(update)
      setConfig(updated)
      setSuccessMsg('Settings saved')
      setTimeout(() => setSuccessMsg(null), 2000)
    } catch {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'adapters' as TabId, label: 'Adapters & Providers', icon: Settings },
    ...(isAdmin ? [{ id: 'tenants' as TabId, label: 'Tenant Management', icon: Users }] : []),
    { id: 'branding' as TabId, label: 'Branding & Theme', icon: Palette },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-slate-400">Loading configuration...</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tenant Administration</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">Configure adapters, manage tenants, and customize branding</p>
      </div>

      {/* Status Messages */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" /> {error}
          </motion.div>
        )}
        {successMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400">
            <Check className="w-4 h-4" /> {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-slate-800/50 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'adapters' && config && (
        <AdaptersTab
          config={config}
          providers={providers}
          saving={saving}
          onProviderChange={handleProviderChange}
          onSettingsChange={handleSettingsChange}
        />
      )}
      {activeTab === 'tenants' && <TenantsTab />}
      {activeTab === 'branding' && config && (
        <BrandingTab config={config} onSave={(updates) => updateFeatureConfig(updates).then(setConfig)} />
      )}
      </div>
    </div>
  )
}

// ==========================================
// Adapters Tab
// ==========================================

function AdaptersTab({ config, providers, saving, onProviderChange, onSettingsChange }: {
  config: TenantFeatureConfig
  providers: Record<string, ProviderOption[]>
  saving: boolean
  onProviderChange: (field: keyof TenantFeatureConfig, value: string) => void
  onSettingsChange: (field: keyof TenantFeatureConfig, settings: Record<string, string>) => void
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {ADAPTER_CATEGORIES.map(category => (
        <AdapterCard
          key={category.key}
          category={category}
          currentProvider={(config[category.providerField] as string) || 'none'}
          currentSettings={tryParseJson(config[category.settingsField] as string)}
          options={providers[category.key] || []}
          saving={saving}
          onProviderChange={(value) => onProviderChange(category.providerField, value)}
          onSettingsChange={(settings) => onSettingsChange(category.settingsField, settings)}
        />
      ))}
    </div>
  )
}

// ==========================================
// Adapter Card
// ==========================================

function AdapterCard({ category, currentProvider, currentSettings, options, saving, onProviderChange, onSettingsChange }: {
  category: AdapterCategory
  currentProvider: string
  currentSettings: Record<string, string>
  options: ProviderOption[]
  saving: boolean
  onProviderChange: (value: string) => void
  onSettingsChange: (settings: Record<string, string>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [health, setHealth] = useState<AdapterHealthResult | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const [editSettings, setEditSettings] = useState<Record<string, string>>(currentSettings)

  const selectedOption = options.find(o => o.id === currentProvider)
  const isActive = currentProvider !== 'none'

  // Provider-specific setting hints for better UX
  const settingHints: Record<string, Record<string, string>> = {
    'dynatrace': {
      environmentUrl: 'e.g. https://abc12345.live.dynatrace.com',
      apiToken: 'Generate from Settings → Access tokens (logs.read, metrics.read, openTelemetryTrace.read)',
    },
    'app-insights': {
      resourceId: '/subscriptions/{sub}/resourceGroups/{rg}/providers/microsoft.insights/components/{name}',
      workspaceId: 'Log Analytics workspace GUID (optional fallback)',
    },
    'azure-openai': {
      endpoint: 'e.g. https://your-resource.openai.azure.com',
      apiKey: 'API key from Azure portal (leave empty to use Azure CLI auth)',
      deploymentName: 'Your model deployment name (e.g. gpt-4o)',
    },
    'openai': {
      apiKey: 'API key from platform.openai.com/api-keys',
      model: 'e.g. gpt-4o, gpt-4o-mini, gpt-3.5-turbo',
    },
    'azure-devops': {
      organization: 'e.g. https://dev.azure.com/your-org',
      pat: 'Personal access token with Work Items (Read) scope',
    },
  }

  const getHint = (setting: string): string | undefined =>
    settingHints[currentProvider]?.[setting]

  const handleHealthCheck = async () => {
    setCheckingHealth(true)
    try {
      const result = await checkAdapterHealth(category.key)
      setHealth(result)
    } catch {
      setHealth({ isHealthy: false, message: 'Health check failed', latencyMs: 0, details: {} })
    } finally {
      setCheckingHealth(false)
    }
  }

  const handleSaveSettings = () => {
    onSettingsChange(editSettings)
    setExpanded(false)
  }

  return (
    <motion.div layout className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Card Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-500'}`}>
            <category.icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-medium">{category.label}</h3>
            <p className="text-xs text-slate-500">{category.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {health && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${health.isHealthy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {health.isHealthy ? 'Healthy' : 'Error'}
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-slate-700/50 transition-colors"
          >
            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Provider Selector */}
      <div className="px-4 pb-3">
        <select
          value={currentProvider}
          onChange={(e) => onProviderChange(e.target.value)}
          disabled={saving}
          className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
          {options.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.displayName}</option>
          ))}
        </select>
      </div>

      {/* Expanded Settings */}
      <AnimatePresence>
        {expanded && selectedOption && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700/50"
          >
            <div className="p-4 space-y-3">
              {/* Provider-specific settings */}
              {selectedOption.requiredSettings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Provider Settings</p>
                  {selectedOption.requiredSettings.map(setting => (
                    <div key={setting}>
                      <label className="text-xs text-slate-400 mb-1 block capitalize">{setting.replace(/([A-Z])/g, ' $1')}</label>
                      <input
                        type={setting.toLowerCase().includes('key') || setting.toLowerCase().includes('token') || setting.toLowerCase().includes('password') || setting.toLowerCase().includes('pat') ? 'password' : 'text'}
                        value={editSettings[setting] || ''}
                        onChange={(e) => setEditSettings(prev => ({ ...prev, [setting]: e.target.value }))}
                        placeholder={getHint(setting) || `Enter ${setting}`}
                        className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleSaveSettings}
                    className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md transition-colors"
                  >
                    Save Settings
                  </button>
                </div>
              )}

              {/* Health Check */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-700/30">
                <button
                  onClick={handleHealthCheck}
                  disabled={checkingHealth}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-xs rounded-md transition-colors disabled:opacity-50"
                >
                  {checkingHealth ? <Loader2 className="w-3 h-3 animate-spin" /> : <Heart className="w-3 h-3" />}
                  Check Health
                </button>
                {health && (
                  <span className="text-xs text-slate-500">
                    {health.message} ({health.latencyMs}ms)
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ==========================================
// Tenants Tab
// ==========================================

function TenantsTab() {
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    try {
      const data = await listTenants()
      setTenants(data)
    } catch {
      // Silent fail — user may not have permission
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Tenants</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Tenant
        </button>
      </div>

      {/* Create Tenant Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CreateTenantForm onCreated={() => { setShowCreate(false); loadTenants() }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tenant List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="space-y-2">
          {tenants.map(tenant => (
            <div key={tenant.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{tenant.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">{tenant.code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tenant.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {tenant.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Plan: {tenant.plan} &middot; {tenant.userCount} users &middot; Created {new Date(tenant.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
          {tenants.length === 0 && (
            <p className="text-slate-500 text-center py-8">No tenants found</p>
          )}
        </div>
      )}
    </div>
  )
}

// ==========================================
// Create Tenant Form
// ==========================================

function CreateTenantForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CreateTenantRequest>({
    code: '', name: '', adminEmail: '', adminPassword: 'Admin@123', maxUsers: 10,
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code || !form.name || !form.adminEmail) {
      setError('Code, name, and admin email are required')
      return
    }
    try {
      setCreating(true)
      setError(null)
      const result = await createTenant(form)
      if (result.success) {
        onCreated()
      } else {
        setError(result.message)
      }
    } catch {
      setError('Failed to create tenant')
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-4 space-y-3">
      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Tenant Code *</label>
          <input
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            placeholder="e.g. acme"
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Tenant Name *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Acme Corp"
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Admin Email *</label>
          <input
            type="email"
            value={form.adminEmail}
            onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
            placeholder="admin@acme.com"
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Admin Password</label>
          <input
            type="password"
            value={form.adminPassword}
            onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
            placeholder="Default: Admin@123"
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Primary Color</label>
          <input
            value={form.primaryColor || '#3b82f6'}
            onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
            type="color"
            className="w-full h-9 bg-slate-900/50 border border-slate-600/50 rounded cursor-pointer"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Max Users</label>
          <input
            type="number"
            value={form.maxUsers}
            onChange={e => setForm(f => ({ ...f, maxUsers: parseInt(e.target.value) || 10 }))}
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {creating && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Tenant
        </button>
      </div>
    </form>
  )
}

// ==========================================
// Branding Tab
// ==========================================

function BrandingTab({ config, onSave }: { config: TenantFeatureConfig; onSave: (updates: Partial<TenantFeatureConfig>) => Promise<void> }) {
  const branding = tryParseJson(config.brandingSettings)
  const theme = tryParseJson(config.themeSettings)
  const [appName, setAppName] = useState(branding.appName || 'ProdVista')
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor || '#3b82f6')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      brandingSettings: JSON.stringify({ ...branding, appName, primaryColor }),
      themeSettings: JSON.stringify({ ...theme, primaryColor }),
    })
    setSaving(false)
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 max-w-xl">
      <h2 className="text-lg font-semibold text-white mb-4">Branding & Theme</h2>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-slate-400 block mb-1">Application Name</label>
          <input
            value={appName}
            onChange={e => setAppName(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 block mb-1">Primary Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer" />
            <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white w-32 focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Branding
          </button>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// Helpers
// ==========================================

function tryParseJson(str: string): Record<string, string> {
  try {
    return JSON.parse(str || '{}')
  } catch {
    return {}
  }
}
