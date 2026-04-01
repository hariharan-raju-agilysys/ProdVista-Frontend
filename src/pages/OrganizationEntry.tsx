import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, TenantInfo } from '../services/authService';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';

const ORG_CODE_KEY = 'prodvista_org_code';
const ORG_INFO_KEY = 'prodvista_org_info';

export function getStoredOrgCode(): string | null {
  return localStorage.getItem(ORG_CODE_KEY);
}

export function getStoredOrgInfo(): TenantInfo | null {
  const info = localStorage.getItem(ORG_INFO_KEY);
  if (!info) return null;
  try {
    return JSON.parse(info);
  } catch {
    return null;
  }
}

export function setOrgInfo(code: string, info: TenantInfo) {
  localStorage.setItem(ORG_CODE_KEY, code);
  localStorage.setItem(ORG_INFO_KEY, JSON.stringify(info));
}

export function clearOrgInfo() {
  localStorage.removeItem(ORG_CODE_KEY);
  localStorage.removeItem(ORG_INFO_KEY);
}

export default function OrganizationEntry() {
  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  const [orgCode, setOrgCode] = useState('');
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Prevent multiple navigations
    if (hasNavigated.current) return;

    // Check if already authenticated - redirect to dashboard
    if (authService.isAuthenticated()) {
      hasNavigated.current = true;
      navigate('/', { replace: true });
      return;
    }

    // Check if org code is already stored - go directly to dashboard
    const storedCode = getStoredOrgCode();
    const storedInfo = getStoredOrgInfo();
    if (storedCode && storedInfo) {
      hasNavigated.current = true;
      navigate('/', { replace: true });
      return;
    }

    // Load available organizations
    authService.getTenants().then(t => {
      setTenants(t);
      setLoadingTenants(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const tenant = await authService.validateTenant(orgCode.toLowerCase());
    
    if (tenant) {
      setOrgInfo(orgCode.toLowerCase(), tenant);
      hasNavigated.current = true;
      navigate('/', { replace: true });
    } else {
      setError('Organization not found. Please check your organization code.');
    }
    
    setLoading(false);
  };

  const handleSelectTenant = async (code: string) => {
    const tenant = tenants.find(t => t.code === code);
    if (tenant) {
      setOrgInfo(code, tenant);
      hasNavigated.current = true;
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)` 
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
              <h1 className="text-4xl font-bold mb-3">ProdVista</h1>
              <p className="text-xl text-white/80">Production Monitoring & Analytics Dashboard</p>
            </div>
            
            <div className="space-y-4 text-left bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Real-time Metrics</p>
                  <p className="text-sm text-white/70">Monitor deployments, bugs, and incidents live</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">AI-Powered Insights</p>
                  <p className="text-sm text-white/70">Predictive analytics with smart recommendations</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Multi-tenant Support</p>
                  <p className="text-sm text-white/70">Each organization gets their own dashboard</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Organization Entry Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ProdVista</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Enter Organization</h2>
              <p className="text-gray-500 mt-2">Enter your organization code to view the dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Code
                </label>
                <input
                  type="text"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value)}
                  placeholder="e.g., default"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={loading}
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !orgCode.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    View Dashboard
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Select Organizations */}
            {!loadingTenants && tenants.length > 0 && (
              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-white text-sm text-gray-500">Or select an organization</span>
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  {tenants.slice(0, 5).map((tenant) => (
                    <button
                      key={tenant.code}
                      onClick={() => handleSelectTenant(tenant.code)}
                      className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                    >
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: tenant.primaryColor || '#3b82f6' }}
                      >
                        {tenant.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tenant.name}</p>
                        <p className="text-xs text-gray-500">{tenant.code}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loadingTenants && (
              <div className="mt-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Manager or Admin?{' '}
            <a href="/login" className="text-blue-600 hover:underline font-medium">
              Sign in here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
