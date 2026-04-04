import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { authService, TenantInfo } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { graphScopes, isMsalConfigured } from '../config/msalConfig';
import { Building2, Loader2, ArrowLeft, ArrowRight, Terminal } from 'lucide-react';

// Check if we're in development mode
const isDev = import.meta.env.DEV;

export default function LoginPage() {
  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  const { instance: msalInstance } = useMsal();
  const { setUserFromLocal } = useAuth();

  // Two-step flow: 'tenant' → 'login'
  const [step, setStep] = useState<'tenant' | 'login'>('tenant');
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [tenantCode, setTenantCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if already authenticated on mount
  useEffect(() => {
    if (hasNavigated.current) return;
    if (authService.isAuthenticated()) {
      hasNavigated.current = true;
      navigate('/', { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const code = tenantCode.trim().toLowerCase();
    if (!code) {
      setError('Please enter your organization code');
      return;
    }

    setLoading(true);
    try {
      const info = await authService.validateTenant(code);
      if (info) {
        setTenantInfo(info);
        setStep('login');
        setError('');
      } else {
        setError('Organization not found. Please check the code and try again.');
      }
    } catch {
      setError('Unable to verify organization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToTenant = () => {
    setStep('tenant');
    setError('');
  };

  // Microsoft SSO Login (primary method)
  const handleMicrosoftLogin = async () => {
    if (!tenantInfo) return;

    if (!isMsalConfigured()) {
      setError('Microsoft SSO is not configured. Please contact your administrator.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const loginResponse = await msalInstance.loginPopup({
        ...graphScopes,
        prompt: 'select_account',
      });

      if (loginResponse?.accessToken) {
        const response = await authService.loginWithMsal(tenantInfo.code, loginResponse.accessToken);
        if (response.success) {
          if (response.user) setUserFromLocal(response.user as any);
          hasNavigated.current = true;
          navigate('/');
        } else {
          setError(response.message || 'Microsoft login failed');
        }
      } else {
        setError('No access token received from Microsoft');
      }
    } catch (err: any) {
      if (err.errorCode !== 'user_cancelled') {
        setError(err.message || 'Microsoft authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // Azure CLI Login (DEV mode only)
  const handleAzureCliLogin = async () => {
    if (!tenantInfo) return;

    setLoading(true);
    setError('');
    try {
      const response = await authService.loginWithAzure(tenantInfo.code);
      if (response.success) {
        if (response.user) setUserFromLocal(response.user as any);
        hasNavigated.current = true;
        navigate('/');
      } else {
        setError(response.message || 'Azure CLI login failed. Run "az login" first.');
      }
    } catch (err: any) {
      setError(err.message || 'Azure authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const accentColor = tenantInfo?.primaryColor || '#3b82f6';

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accentColor} 0%, ${adjustColor(accentColor, -30)} 100%)`
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="max-w-md text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold mb-3">{tenantInfo?.name || 'ProdVista'}</h1>
              <p className="text-xl text-white/80">Production Monitoring & Analytics Dashboard</p>
            </div>

            <div className="space-y-4 text-left bg-white/10 backdrop-blur-sm rounded-xl p-6">
              {[
                { title: 'Azure Integration', desc: 'Connect to your Azure resources seamlessly' },
                { title: 'Real-time Monitoring', desc: 'Live metrics, logs, and distributed traces' },
                { title: 'Customizable Dashboards', desc: 'Build your own widgets and views' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-white/70">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: accentColor }}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tenantInfo?.name || 'ProdVista'}</h1>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">

            {/* ============================== */}
            {/* STEP 1: Enter Organization Code */}
            {/* ============================== */}
            {step === 'tenant' && (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    Welcome to ProdVista
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Enter your organization code to continue
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <form onSubmit={handleTenantSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Building2 className="w-4 h-4 inline mr-1" />
                      Organization Code
                    </label>
                    <input
                      type="text"
                      value={tenantCode}
                      onChange={(e) => setTenantCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g. default"
                      autoFocus
                      autoComplete="organization"
                    />
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      This is the unique code provided by your organization
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {/* ============================== */}
            {/* STEP 2: SSO Login              */}
            {/* ============================== */}
            {step === 'login' && tenantInfo && (
              <>
                <div className="text-center mb-8">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4"
                    style={{ backgroundColor: accentColor }}
                  >
                    {tenantInfo.name.charAt(0).toUpperCase()}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {tenantInfo.name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Sign in to your account
                  </p>
                  {/* Tenant badge + back link */}
                  <button
                    type="button"
                    onClick={handleBackToTenant}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change organization</span>
                    <span className="ml-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">
                      {tenantInfo.code}
                    </span>
                  </button>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* Microsoft SSO Login - Primary Method */}
                <div className="space-y-4">
                  <button
                    onClick={handleMicrosoftLogin}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-[#0078d4] hover:bg-[#106ebe] text-white font-medium rounded-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                          <rect width="10" height="10" fill="#f25022"/>
                          <rect x="11" width="10" height="10" fill="#7fba00"/>
                          <rect y="11" width="10" height="10" fill="#00a4ef"/>
                          <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
                        </svg>
                        Sign in with Microsoft
                      </>
                    )}
                  </button>

                  {/* Azure CLI Login - DEV MODE ONLY */}
                  {isDev && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Development Only</span>
                        </div>
                      </div>

                      <button
                        onClick={handleAzureCliLogin}
                        disabled={loading}
                        className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        <Terminal className="w-5 h-5" />
                        Sign in with Azure CLI
                      </button>
                      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                        Run <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">az login</code> in terminal first
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-500">
            &copy; {new Date().getFullYear()} ProdVista. Secured by Azure.
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper function to adjust color brightness
function adjustColor(color: string, amount: number): string {
  const clamp = (num: number) => Math.min(255, Math.max(0, num));

  color = color.replace('#', '');

  const num = parseInt(color, 16);
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00FF) + amount);
  const b = clamp((num & 0x0000FF) + amount);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
