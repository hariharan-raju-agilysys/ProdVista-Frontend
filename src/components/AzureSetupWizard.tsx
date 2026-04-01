import { useState, useEffect } from 'react'
import { useDashboardStore } from '../store/dashboardStore'
import { useAzureAuth, useAzureResources } from '../hooks/useAzureAuth'
import { 
  X, ChevronRight, ChevronLeft, Cloud, Check, 
  AlertCircle, Loader2, Server, Container,
  Database, Play, Sparkles
} from 'lucide-react'
import clsx from 'clsx'

interface AzureSetupWizardProps {
  onComplete: (config: any) => void
  onCancel: () => void
}

export default function AzureSetupWizard({ onComplete, onCancel }: AzureSetupWizardProps) {
  const {
    azureConnection,
    setAzureSubscriptions,
    selectSubscription,
    selectResourceGroup,
    setServices,
    selectServices,
    setPods,
    selectPods,
  } = useDashboardStore()

  // Use global Azure auth
  const { 
    isAuthenticated, 
    user, 
    subscriptions, 
    selectedSubscription,
    isLoading: authLoading,
    loginDemo,
    loginInteractive,
    selectSubscription: selectSub
  } = useAzureAuth()

  const { resourceGroups, services, fetchResourceGroups, fetchServices } = useAzureResources()

  // Start at step 1 if already authenticated
  const [step, setStep] = useState(() => isAuthenticated ? 1 : 0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-advance when authenticated
  useEffect(() => {
    if (isAuthenticated && step === 0) {
      // Sync subscriptions to dashboard store
      setAzureSubscriptions(subscriptions.map(s => ({
        id: s.subscriptionId,
        name: s.displayName,
        tenantId: s.tenantId
      })))
      setStep(1)
    }
  }, [isAuthenticated, step, subscriptions])

  const steps = [
    { id: 0, name: 'Connect', icon: Cloud },
    { id: 1, name: 'Subscription', icon: Database },
    { id: 2, name: 'Services', icon: Server },
    { id: 3, name: 'Pods', icon: Container },
    { id: 4, name: 'Confirm', icon: Check },
  ]

  const handleLogin = async (mode: 'demo' | 'interactive') => {
    setError(null)
    try {
      if (mode === 'demo') {
        await loginDemo()
      } else {
        await loginInteractive()
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    }
  }

  const handleSelectSubscription = async (subscriptionId: string) => {
    setIsLoading(true)
    selectSub(subscriptionId)
    selectSubscription(subscriptionId)
    await fetchResourceGroups()
    setIsLoading(false)
  }

  const handleSelectResourceGroup = async (resourceGroup: string) => {
    setIsLoading(true)
    selectResourceGroup(resourceGroup)
    await fetchServices(resourceGroup)
    
    // Sync to dashboard store - map service types to valid dashboard types
    const typeMap: Record<string, 'app-service' | 'container-app' | 'aks' | 'function' | 'vm' | 'storage'> = {
      'Microsoft.Web/sites': 'app-service',
      'Microsoft.App/containerApps': 'container-app',
      'Microsoft.ContainerService/managedClusters': 'aks',
      'Microsoft.Storage/storageAccounts': 'storage',
    }
    
    setServices(services.map(s => ({
      id: s.id,
      name: s.name,
      type: typeMap[s.type] || 'app-service',
      resourceGroup: s.resourceGroup,
    })))
    
    setStep(2)
    setIsLoading(false)
  }

  const fetchPods = async (serviceIds: string[]) => {
    setIsLoading(true)
    selectServices(serviceIds)
    
    await new Promise(resolve => setTimeout(resolve, 800))
    
    setPods([
      { name: 'ProdVista-api-pod-1', namespace: 'production', status: 'Running', containers: ['api', 'sidecar'] },
      { name: 'ProdVista-api-pod-2', namespace: 'production', status: 'Running', containers: ['api', 'sidecar'] },
      { name: 'ProdVista-worker-pod-1', namespace: 'production', status: 'Running', containers: ['worker'] },
      { name: 'ProdVista-scheduler-pod-1', namespace: 'production', status: 'Pending', containers: ['scheduler'] },
      { name: 'ProdVista-cache-pod-1', namespace: 'production', status: 'Running', containers: ['redis'] },
    ])
    
    setStep(3)
    setIsLoading(false)
  }

  const handleServiceSelect = (serviceId: string) => {
    const current = azureConnection.selectedServices || []
    if (current.includes(serviceId)) {
      selectServices(current.filter(id => id !== serviceId))
    } else {
      selectServices([...current, serviceId])
    }
  }

  const handlePodSelect = (podName: string) => {
    const current = azureConnection.selectedPods || []
    if (current.includes(podName)) {
      selectPods(current.filter(name => name !== podName))
    } else {
      selectPods([...current, podName])
    }
  }

  const handleComplete = () => {
    onComplete({
      isAuthenticated,
      user,
      subscription: azureConnection.selectedSubscription,
      resourceGroup: azureConnection.selectedResourceGroup,
      services: azureConnection.selectedServices,
      pods: azureConnection.selectedPods,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">Azure Cloud Setup</h2>
              <p className="text-blue-100 text-sm">Connect to Azure Monitor Logs</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 bg-slate-700/50 border-b border-slate-600">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  step > s.id ? 'bg-green-500' : step === s.id ? 'bg-primary-500' : 'bg-slate-600'
                )}>
                  {step > s.id ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <s.icon className="w-4 h-4 text-white" />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div className={clsx(
                    'w-8 md:w-16 h-1 mx-1',
                    step > s.id ? 'bg-green-500' : 'bg-slate-600'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px]">
          {/* Step 0: Choose Login Method */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold text-white mb-2">Choose Connection Method</h3>
                <p className="text-slate-400 text-sm">Select how you want to connect to Azure</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-3 rounded-lg mb-4">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid gap-4">
                {/* Demo Mode - No credentials needed */}
                <button
                  onClick={() => handleLogin('demo')}
                  disabled={authLoading}
                  className={clsx(
                    'p-6 rounded-xl border-2 text-left transition-all hover:scale-[1.02]',
                    'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-emerald-500/20 rounded-lg">
                      <Play className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white text-lg">Demo Mode</h4>
                        <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-300 text-xs rounded-full">
                          Recommended
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mb-2">
                        Try the dashboard with sample data - no Azure account required
                      </p>
                      <ul className="text-xs text-slate-500 space-y-1">
                        <li>• No credentials needed</li>
                        <li>• Pre-populated with realistic mock data</li>
                        <li>• Full feature preview</li>
                      </ul>
                    </div>
                    {authLoading && (
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                    )}
                  </div>
                </button>

                {/* Interactive Browser Login */}
                <button
                  onClick={() => handleLogin('interactive')}
                  disabled={authLoading}
                  className={clsx(
                    'p-6 rounded-xl border-2 text-left transition-all hover:scale-[1.02]',
                    'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <Cloud className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white text-lg mb-1">Sign in with Azure</h4>
                      <p className="text-slate-400 text-sm mb-2">
                        Login via browser - uses your Azure account credentials
                      </p>
                      <ul className="text-xs text-slate-500 space-y-1">
                        <li>• Opens Azure login in browser</li>
                        <li>• No client secrets required</li>
                        <li>• Uses your existing Azure permissions</li>
                      </ul>
                    </div>
                    {authLoading && (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    )}
                  </div>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Both options provide full dashboard functionality with AI-powered insights</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Select Subscription */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Select Subscription & Resource Group</h3>
                <p className="text-slate-400 text-sm">Choose the subscription containing your applications</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Available Subscriptions</label>
                  <div className="space-y-2">
                    {subscriptions.map(sub => (
                      <div
                        key={sub.subscriptionId}
                        onClick={() => handleSelectSubscription(sub.subscriptionId)}
                        className={clsx(
                          'p-4 rounded-lg border-2 cursor-pointer transition-all',
                          selectedSubscription === sub.subscriptionId
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-slate-600 hover:border-slate-500'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{sub.displayName}</p>
                            <p className="text-sm text-slate-400">{sub.subscriptionId}</p>
                          </div>
                          {selectedSubscription === sub.subscriptionId && (
                            <Check className="w-5 h-5 text-primary-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {resourceGroups.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Resource Groups</label>
                    <div className="space-y-2">
                      {resourceGroups.map(rg => (
                        <div
                          key={rg.id}
                          onClick={() => handleSelectResourceGroup(rg.name)}
                          className={clsx(
                            'p-4 rounded-lg border-2 cursor-pointer transition-all',
                            azureConnection.selectedResourceGroup === rg.name
                              ? 'border-primary-500 bg-primary-500/10'
                              : 'border-slate-600 hover:border-slate-500'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-white">{rg.name}</p>
                              <p className="text-sm text-slate-400">Location: {rg.location}</p>
                            </div>
                            {azureConnection.selectedResourceGroup === rg.name && (
                              <Check className="w-5 h-5 text-primary-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Services */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Select Services to Monitor</h3>
                <p className="text-slate-400 text-sm">Choose which Azure services to collect logs from</p>
              </div>

              <div className="space-y-2">
                {azureConnection.services.map(service => {
                  const isSelected = azureConnection.selectedServices.includes(service.id)
                  const typeIcons: Record<string, string> = {
                    'app-service': '🌐',
                    'container-app': '📦',
                    'aks': '☸️',
                    'function': '⚡',
                    'vm': '🖥️',
                  }
                  
                  return (
                    <div
                      key={service.id}
                      onClick={() => handleServiceSelect(service.id)}
                      className={clsx(
                        'p-4 rounded-lg border-2 cursor-pointer transition-all',
                        isSelected
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-slate-600 hover:border-slate-500'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{typeIcons[service.type] || '📁'}</span>
                          <div>
                            <p className="font-medium text-white">{service.name}</p>
                            <p className="text-sm text-slate-400">{service.type}</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-5 h-5 rounded border-slate-500 text-primary-500"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="text-slate-400 text-sm">
                  {azureConnection.selectedServices.length} services selected
                </span>
                <button
                  onClick={() => fetchPods(azureConnection.selectedServices)}
                  disabled={azureConnection.selectedServices.length === 0 || isLoading}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Select Pods */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Select Pods (Optional)</h3>
                <p className="text-slate-400 text-sm">
                  Choose specific pods or leave empty to monitor all pods
                </p>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
                <p className="text-slate-300 text-sm">
                  💡 By default, we'll collect logs from <strong>all pods</strong> in the selected services. 
                  Select specific pods below if you want to filter.
                </p>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {azureConnection.pods.map(pod => {
                  const isSelected = azureConnection.selectedPods.includes(pod.name)
                  const statusColors: Record<string, string> = {
                    'Running': 'text-green-400',
                    'Pending': 'text-yellow-400',
                    'Failed': 'text-red-400',
                  }
                  
                  return (
                    <div
                      key={pod.name}
                      onClick={() => handlePodSelect(pod.name)}
                      className={clsx(
                        'p-4 rounded-lg border-2 cursor-pointer transition-all',
                        isSelected
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-slate-600 hover:border-slate-500'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Container className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="font-medium text-white">{pod.name}</p>
                            <p className="text-sm text-slate-400">
                              {pod.namespace} · {pod.containers.length} container(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={clsx('text-sm font-medium', statusColors[pod.status])}>
                            {pod.status}
                          </span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-5 h-5 rounded border-slate-500 text-primary-500"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between pt-4">
                <span className="text-slate-400 text-sm">
                  {azureConnection.selectedPods.length === 0 
                    ? 'Monitoring all pods' 
                    : `${azureConnection.selectedPods.length} pods selected`}
                </span>
                <button
                  onClick={() => setStep(4)}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2"
                >
                  Review Setup
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">Setup Complete!</h3>
                <p className="text-slate-400 text-sm">Review your configuration before launching</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Subscription</h4>
                  <p className="text-white">
                    {azureConnection.subscriptions.find(s => s.id === azureConnection.selectedSubscription)?.name}
                  </p>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Resource Group</h4>
                  <p className="text-white">{azureConnection.selectedResourceGroup}</p>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Services ({azureConnection.selectedServices.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {azureConnection.selectedServices.map(serviceId => {
                      const service = azureConnection.services.find(s => s.id === serviceId)
                      return (
                        <span key={serviceId} className="px-2 py-1 bg-slate-600 rounded text-sm text-white">
                          {service?.name}
                        </span>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Pods</h4>
                  <p className="text-white">
                    {azureConnection.selectedPods.length === 0 
                      ? 'All pods (auto-discover)' 
                      : azureConnection.selectedPods.join(', ')}
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg p-4 border border-green-500/30">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Ready to start collecting logs</span>
                </div>
                <p className="text-sm text-slate-300">
                  AI analysis will automatically process logs and provide insights.
                </p>
              </div>

              <button
                onClick={handleComplete}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-600 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Complete Setup & Start Monitoring
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step > 0 && step < 4 && (
          <div className="px-6 py-4 bg-slate-700/30 border-t border-slate-600 flex justify-between">
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 text-slate-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
