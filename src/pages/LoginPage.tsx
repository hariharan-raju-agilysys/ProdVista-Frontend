import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { authService, TenantInfo } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { graphScopes, armScopes, devopsScopes, isMsalConfigured } from '../config/msalConfig';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Loader2, ArrowRight, Terminal, Shield,
  BarChart3, Zap, Globe, Lock, Info,
} from 'lucide-react';

const basePath = import.meta.env.VITE_BASE_PATH || '';
const isDev = import.meta.env.DEV;

/* ------------------------------------------------------------------ */
/*  Animated connecting screen — shown while SSO processes            */
/* ------------------------------------------------------------------ */
function ConnectingScreen({ orgName }: { orgName?: string }) {
  const dots = ['Authenticating', 'Acquiring tokens', 'Loading workspace'];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((p) => (p + 1) % dots.length), 2200);
    return () => clearInterval(t);
  }, [dots.length]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 mb-12"
      >
        <img
          src={`${basePath}/favicon.svg`}
          alt="ProdVista"
          className="w-10 h-10 rounded-xl shadow-md"
        />
        <span className="text-xl font-bold text-gray-900 tracking-tight">ProdVista</span>
      </motion.div>

      {/* Animated ring */}
      <div className="relative mb-10">
        <motion.div
          className="w-16 h-16 rounded-full border-[3px] border-blue-100"
          style={{ borderTopColor: '#3b82f6' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Shield className="w-6 h-6 text-blue-500" />
        </div>
      </div>

      {/* Status text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={active}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="text-sm font-medium text-gray-500"
        >
          {dots[active]}
          <motion.span
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            ...
          </motion.span>
        </motion.p>
      </AnimatePresence>

      {orgName && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 text-xs text-gray-400"
        >
          Signing in to <span className="font-semibold text-gray-500">{orgName}</span>
        </motion.p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature showcase for left panel                                   */
/* ------------------------------------------------------------------ */
const features = [
  { icon: BarChart3, title: 'Real-time Analytics', desc: 'Live metrics & dashboards with Azure Monitor' },
  { icon: Shield, title: 'Enterprise Security', desc: 'SSO with Microsoft Entra ID & RBAC' },
  { icon: Zap, title: 'AI-Powered Insights', desc: 'Natural language queries via Azure OpenAI' },
  { icon: Globe, title: 'Multi-Tenant SaaS', desc: 'Isolated data with per-tenant config' },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export default function LoginPage() {
  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  const { instance: msalInstance, inProgress, accounts } = useMsal();
  const { setUserFromLocal, updateOrgInfo } = useAuth();

  const hasPendingMsal = !!sessionStorage.getItem('msal_pending_tenant');
  const [phase, setPhase] = useState<'tenant' | 'connecting'>(hasPendingMsal ? 'connecting' : 'tenant');
  const [tenantCode, setTenantCode] = useState('');
  const [connectingOrg, setConnectingOrg] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState(false);

  // Already authenticated — go straight to app
  useEffect(() => {
    if (hasNavigated.current) return;
    if (authService.isAuthenticated()) {
      hasNavigated.current = true;
      navigate('/', { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /*  MSAL redirect return handler                                    */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (hasNavigated.current) return;
    if (inProgress !== InteractionStatus.None) return;

    const savedTenant = sessionStorage.getItem('msal_pending_tenant');
    if (!savedTenant || accounts.length === 0) {
      if (hasPendingMsal) {
        sessionStorage.removeItem('msal_pending_tenant');
        setPhase('tenant');
      }
      return;
    }

    sessionStorage.removeItem('msal_pending_tenant');
    setPhase('connecting');
    setConnectingOrg(savedTenant);

    const acquireGraphToken = async () => {
      try {
        return await msalInstance.acquireTokenSilent({ ...graphScopes, account: accounts[0] });
      } catch (silentErr) {
        if (silentErr instanceof InteractionRequiredAuthError) {
          sessionStorage.setItem('msal_pending_tenant', savedTenant);
          await msalInstance.acquireTokenRedirect({ ...graphScopes, account: accounts[0] });
          return null;
        }
        throw silentErr;
      }
    };

    acquireGraphToken().then(async (tokenResponse) => {
      if (tokenResponse?.accessToken) {
        const response = await authService.loginWithMsal(savedTenant, tokenResponse.accessToken);
        if (response.success) {
          if (response.user) setUserFromLocal(response.user as any);
          updateOrgInfo(savedTenant, { code: savedTenant, name: response.user?.tenantName || savedTenant });

          // Acquire ARM token (optional)
          try {
            const armRes = await msalInstance.acquireTokenSilent({ ...armScopes, account: accounts[0] }).catch(() => null);
            if (armRes?.accessToken) sessionStorage.setItem('prodvista_azure_token', armRes.accessToken);
          } catch { /* optional */ }

          // Acquire DevOps token (optional)
          try {
            const devRes = await msalInstance.acquireTokenSilent({ ...devopsScopes, account: accounts[0] }).catch(() => null);
            if (devRes?.accessToken) sessionStorage.setItem('prodvista_devops_token', devRes.accessToken);
          } catch { /* optional */ }

          hasNavigated.current = true;
          navigate('/', { replace: true });
        } else {
          setError(response.message || 'Microsoft login failed');
          setPhase('tenant');
        }
      } else {
        setError('No access token received from Microsoft');
        setPhase('tenant');
      }
    }).catch((err: any) => {
      setError(err.message || 'Failed to complete Microsoft login');
      setPhase('tenant');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, accounts]);

  /* ---------------------------------------------------------------- */
  /*  Tenant submit → auto-SSO (no second screen)                    */
  /* ---------------------------------------------------------------- */
  const startSsoLogin = async (info: TenantInfo) => {
    if (!isMsalConfigured()) {
      setError('Microsoft SSO is not configured. Please contact your administrator.');
      return;
    }

    setPhase('connecting');
    setConnectingOrg(info.name);
    sessionStorage.setItem('msal_pending_tenant', info.code);
    updateOrgInfo(info.code, info);

    // Check if an existing MSAL account can be silently used
    const account = accounts[0] || msalInstance.getActiveAccount();
    if (account) {
      try {
        const tokenResponse = await msalInstance.acquireTokenSilent({ ...graphScopes, account });
        if (tokenResponse?.accessToken) {
          const response = await authService.loginWithMsal(info.code, tokenResponse.accessToken);
          if (response.success) {
            sessionStorage.removeItem('msal_pending_tenant');
            if (response.user) setUserFromLocal(response.user as any);
            updateOrgInfo(info.code, { code: info.code, name: response.user?.tenantName || info.name });

            try {
              const armRes = await msalInstance.acquireTokenSilent({ ...armScopes, account }).catch(() => null);
              if (armRes?.accessToken) sessionStorage.setItem('prodvista_azure_token', armRes.accessToken);
            } catch { /* optional */ }
            try {
              const devRes = await msalInstance.acquireTokenSilent({ ...devopsScopes, account }).catch(() => null);
              if (devRes?.accessToken) sessionStorage.setItem('prodvista_devops_token', devRes.accessToken);
            } catch { /* optional */ }

            hasNavigated.current = true;
            navigate('/', { replace: true });
            return;
          }
          // Backend rejected the token — show error, don't redirect
          sessionStorage.removeItem('msal_pending_tenant');
          setError(response.message || 'Login failed. Please try again.');
          setPhase('tenant');
          return;
        }
      } catch {
        // Silent failed — fall through to redirect
      }
    }

    // No existing session — redirect to Microsoft login
    try {
      await msalInstance.loginRedirect({
        ...graphScopes,
        prompt: 'select_account',
        extraScopesToConsent: [...devopsScopes.scopes],
      });
    } catch (err: any) {
      sessionStorage.removeItem('msal_pending_tenant');
      if (err.errorCode !== 'user_cancelled') {
        setError(err.message || 'Microsoft authentication failed');
      }
      setPhase('tenant');
    }
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const code = tenantCode.trim().toLowerCase();
    if (!code) { setError('Please enter your organization code'); return; }

    setLoading(true);
    try {
      const info = await authService.validateTenant(code);
      if (info) {
        await startSsoLogin(info);
      } else {
        setError('Organization not found. Please check the code and try again.');
      }
    } catch {
      setError('Unable to verify organization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAzureCliLogin = async () => {
    const code = tenantCode.trim().toLowerCase();
    if (!code) return;

    setLoading(true);
    setError('');
    try {
      const info = await authService.validateTenant(code);
      if (!info) { setError('Organization not found'); setLoading(false); return; }
      const response = await authService.loginWithAzure(info.code);
      if (response.success) {
        if (response.user) setUserFromLocal(response.user as any);
        updateOrgInfo(info.code, info);
        hasNavigated.current = true;
        navigate('/', { replace: true });
      } else {
        setError(response.message || 'Azure CLI login failed. Run "az login" first.');
      }
    } catch (err: any) {
      setError(err.message || 'Azure authentication failed');
    } finally {
      setLoading(false);
    }
  };

  /* ================================================================ */
  /*  Connecting screen — full-page animated loader                   */
  /* ================================================================ */
  if (phase === 'connecting') {
    return <ConnectingScreen orgName={connectingOrg} />;
  }

  /* ================================================================ */
  /*  Tenant entry — light, professional, single-step                 */
  /* ================================================================ */
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      {/* ============================================================ */}
      {/*  LEFT PANEL — Branding (desktop only)                       */}
      {/* ============================================================ */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700">
        {/* Subtle pattern */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-14">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <img src={`${basePath}/favicon.svg`} alt="ProdVista" className="w-10 h-10 rounded-xl shadow-lg" />
            <span className="text-lg font-bold text-white tracking-tight">ProdVista</span>
          </motion.div>

          {/* Hero */}
          <div className="flex-1 flex flex-col justify-center max-w-md">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <h1 className="text-4xl font-extrabold text-white leading-tight mb-4 tracking-tight">
                Engineering{' '}
                <span className="text-blue-200">Command Center</span>
              </h1>
              <p className="text-base text-blue-100/80 leading-relaxed mb-10">
                Production monitoring, DevOps analytics, and AI-powered insights — all in one place.
              </p>
            </motion.div>

            {/* Feature list */}
            <div className="space-y-4">
              {features.map((feat, i) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
                  className="flex items-start gap-3.5"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <feat.icon className="w-4.5 h-4.5 text-blue-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{feat.title}</p>
                    <p className="text-xs text-blue-200/70 leading-relaxed">{feat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Trust bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-3 pt-6 border-t border-white/10"
          >
            <div className="flex -space-x-2">
              {['bg-blue-300', 'bg-emerald-300', 'bg-purple-300', 'bg-amber-300'].map((bg, i) => (
                <div key={i} className={`w-7 h-7 rounded-full ${bg} border-2 border-indigo-700 flex items-center justify-center text-[10px] font-bold text-indigo-900`}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-blue-100/80 font-medium">Trusted by engineering teams</p>
              <p className="text-[11px] text-blue-200/50">Azure-native & enterprise-ready</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL — Organization Code Form                       */}
      {/* ============================================================ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <img src={`${basePath}/favicon.svg`} alt="ProdVista" className="w-10 h-10 rounded-xl shadow-md" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">ProdVista</span>
          </div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden"
          >
            {/* Accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

            <div className="p-8">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200/50"
                >
                  <Building2 className="w-7 h-7 text-white" />
                </motion.div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1.5">Welcome back</h2>
                <p className="text-sm text-gray-500">Enter your organization code to sign in</p>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-red-500 text-xs font-bold">!</span>
                      </div>
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleTenantSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Organization Code
                  </label>
                  <div className={`relative flex items-center rounded-xl transition-all duration-200 bg-gray-50 ${
                    focusedInput
                      ? 'ring-2 ring-blue-500/40 shadow-sm bg-white'
                      : 'ring-1 ring-gray-200 hover:ring-gray-300'
                  }`}>
                    <div className="pl-3.5 flex items-center pointer-events-none">
                      <Building2 className={`w-[18px] h-[18px] transition-colors ${
                        focusedInput ? 'text-blue-500' : 'text-gray-400'
                      }`} />
                    </div>
                    <input
                      type="text"
                      value={tenantCode}
                      onChange={(e) => setTenantCode(e.target.value)}
                      onFocus={() => setFocusedInput(true)}
                      onBlur={() => setFocusedInput(false)}
                      className="w-full pl-3 pr-4 py-3 bg-transparent text-gray-900 placeholder-gray-400 text-sm focus:outline-none border-0 rounded-xl"
                      placeholder="e.g. versa"
                      autoFocus
                      autoComplete="organization"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-1.5">
                    <Info className="w-3 h-3" />
                    The unique code provided by your admin
                  </p>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading || !tenantCode.trim()}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-blue-200/50 disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>

              {/* DEV: Azure CLI shortcut */}
              {isDev && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <motion.button
                    onClick={handleAzureCliLogin}
                    disabled={loading || !tenantCode.trim()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-2.5 px-4 bg-gray-50 border border-gray-200 text-gray-600 font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-gray-100 text-sm"
                  >
                    <Terminal className="w-4 h-4 text-emerald-500" />
                    Azure CLI Login
                    <span className="text-[10px] text-gray-400 ml-1">(dev)</span>
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-gray-400">
            <Lock className="w-3 h-3" />
            <span>&copy; {new Date().getFullYear()} ProdVista</span>
            <span className="text-gray-300">·</span>
            <span>Secured by Azure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
