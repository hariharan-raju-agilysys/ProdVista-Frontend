import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { authService, TenantInfo } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { graphScopes, isMsalConfigured } from '../config/msalConfig';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Loader2, ArrowLeft, ArrowRight, Terminal, Shield,
  BarChart3, Zap, Globe, ChevronRight, Sparkles, Lock,
} from 'lucide-react';

const isDev = import.meta.env.DEV;

/* ------------------------------------------------------------------ */
/*  Animated background orbs                                          */
/* ------------------------------------------------------------------ */
function FloatingOrbs() {
  const orbs = useMemo(() => [
    { size: 320, x: '10%', y: '20%', delay: 0, duration: 22, color: 'from-blue-500/30 to-purple-500/20' },
    { size: 260, x: '70%', y: '60%', delay: 4, duration: 26, color: 'from-cyan-400/25 to-blue-500/15' },
    { size: 200, x: '50%', y: '10%', delay: 8, duration: 20, color: 'from-indigo-400/20 to-pink-400/10' },
    { size: 180, x: '80%', y: '30%', delay: 2, duration: 24, color: 'from-violet-500/20 to-fuchsia-400/10' },
    { size: 140, x: '20%', y: '75%', delay: 6, duration: 18, color: 'from-sky-400/25 to-teal-400/15' },
  ], []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full bg-gradient-to-br ${orb.color} blur-3xl`}
          style={{ width: orb.size, height: orb.size, left: orb.x, top: orb.y }}
          animate={{ x: [0, 40, -30, 0], y: [0, -50, 30, 0], scale: [1, 1.15, 0.9, 1] }}
          transition={{ duration: orb.duration, delay: orb.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step indicator                                                    */
/* ------------------------------------------------------------------ */
function StepIndicator({ current }: { current: 'tenant' | 'login' }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {(['tenant', 'login'] as const).map((s, i) => (
        <div key={s} className="flex items-center gap-3">
          <motion.div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 ${
              s === current
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : current === 'login' && i === 0
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/10 text-white/40 border border-white/20'
            }`}
            layout
          >
            {current === 'login' && i === 0 ? (
              <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </motion.svg>
            ) : (
              i + 1
            )}
          </motion.div>
          {i === 0 && (
            <div className={`w-12 h-0.5 rounded-full transition-colors duration-500 ${
              current === 'login' ? 'bg-emerald-500' : 'bg-white/20'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature showcase for left panel                                   */
/* ------------------------------------------------------------------ */
const features = [
  { icon: BarChart3, title: 'Real-time Analytics', desc: 'Live metrics, traces & dashboards with Azure Monitor' },
  { icon: Shield, title: 'Enterprise Security', desc: 'SSO with Microsoft Entra ID & RBAC policies' },
  { icon: Zap, title: 'AI-Powered Insights', desc: 'Natural language queries powered by Azure OpenAI' },
  { icon: Globe, title: 'Multi-Tenant SaaS', desc: 'Isolated data with per-tenant customisation' },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export default function LoginPage() {
  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  const { instance: msalInstance, inProgress, accounts } = useMsal();
  const { setUserFromLocal, updateOrgInfo } = useAuth();

  // If returning from MSAL redirect, skip tenant form and show loading
  const hasPendingMsal = !!sessionStorage.getItem('msal_pending_tenant');
  const [step, setStep] = useState<'tenant' | 'login'>(hasPendingMsal ? 'login' : 'tenant');
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [tenantCode, setTenantCode] = useState('');
  const [loading, setLoading] = useState(hasPendingMsal);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState(false);

  // Check if already authenticated on mount
  useEffect(() => {
    if (hasNavigated.current) return;
    if (authService.isAuthenticated()) {
      hasNavigated.current = true;
      navigate('/', { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle MSAL redirect return
  useEffect(() => {
    if (hasNavigated.current) return;
    if (inProgress !== InteractionStatus.None) return;

    const savedTenant = sessionStorage.getItem('msal_pending_tenant');
    if (!savedTenant || accounts.length === 0) {
      // MSAL finished but no account — SSO didn't complete; reset to tenant form
      if (hasPendingMsal) {
        sessionStorage.removeItem('msal_pending_tenant');
        setStep('tenant');
        setLoading(false);
      }
      return;
    }

    sessionStorage.removeItem('msal_pending_tenant');
    setLoading(true);

    msalInstance.acquireTokenSilent({
      ...graphScopes,
      account: accounts[0],
    }).then(async (tokenResponse) => {
      if (tokenResponse?.accessToken) {
        const response = await authService.loginWithMsal(savedTenant, tokenResponse.accessToken);
        if (response.success) {
          if (response.user) setUserFromLocal(response.user as any);
          updateOrgInfo(savedTenant, { code: savedTenant, name: response.user?.tenantName || savedTenant });

          // Also acquire Azure Management (ARM) token for resource discovery
          try {
            const armTokenResponse = await msalInstance.acquireTokenSilent({
              scopes: ['https://management.azure.com/.default'],
              account: accounts[0],
            });
            if (armTokenResponse?.accessToken) {
              localStorage.setItem('prodvista_azure_token', armTokenResponse.accessToken);
            }
          } catch {
            // ARM token is optional — resource discovery will use server credentials as fallback
            console.warn('Could not acquire Azure Management token (optional for resource discovery)');
          }

          hasNavigated.current = true;
          navigate('/');
        } else {
          setError(response.message || 'Microsoft login failed');
        }
      } else {
        setError('No access token received from Microsoft');
      }
    }).catch((err: any) => {
      setError(err.message || 'Failed to complete Microsoft login');
    }).finally(() => {
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, accounts]);

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

  const handleMicrosoftLogin = async () => {
    if (!tenantInfo) return;

    if (!isMsalConfigured()) {
      setError('Microsoft SSO is not configured. Please contact your administrator.');
      return;
    }

    setLoading(true);
    setError('');
    sessionStorage.setItem('msal_pending_tenant', tenantInfo.code);
    // Persist org info BEFORE redirect so OrgRoute passes on page reload
    updateOrgInfo(tenantInfo.code, tenantInfo);

    try {
      await msalInstance.loginRedirect({
        ...graphScopes,
        prompt: 'select_account',
      });
    } catch (err: any) {
      sessionStorage.removeItem('msal_pending_tenant');
      if (err.errorCode !== 'user_cancelled') {
        setError(err.message || 'Microsoft authentication failed');
      }
      setLoading(false);
    }
  };

  const handleAzureCliLogin = async () => {
    if (!tenantInfo) return;

    setLoading(true);
    setError('');
    try {
      const response = await authService.loginWithAzure(tenantInfo.code);
      if (response.success) {
        if (response.user) setUserFromLocal(response.user as any);
        updateOrgInfo(tenantInfo.code, tenantInfo);
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

  /* ================================================================ */
  /*  Shared animation variants                                       */
  /* ================================================================ */
  const cardVariants = {
    enter: { opacity: 0, x: 40, filter: 'blur(4px)' },
    center: { opacity: 1, x: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, x: -40, filter: 'blur(4px)' },
  };

  return (
    <div className="min-h-screen flex bg-[#0a0e1a]">
      {/* ============================================================ */}
      {/*  LEFT PANEL — Hero / Branding                               */}
      {/* ============================================================ */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        {/* Gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0c1322]" />

        <FloatingOrbs />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-12">
          {/* Top logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">ProdVista</span>
          </motion.div>

          {/* Center hero */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-medium text-blue-300">Engineering Command Center</span>
              </div>

              <h1 className="text-5xl font-extrabold text-white leading-[1.1] mb-4 tracking-tight">
                Monitor.{' '}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  Analyze.
                </span>{' '}
                Ship.
              </h1>
              <p className="text-lg text-slate-400 leading-relaxed mb-10">
                Production monitoring, DevOps analytics, and AI-powered insights — all in one beautiful dashboard.
              </p>
            </motion.div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-3">
              {features.map((feat, i) => (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  className="group relative p-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-300"
                >
                  <feat.icon className="w-5 h-5 text-blue-400 mb-2.5 group-hover:text-blue-300 transition-colors" />
                  <p className="text-sm font-semibold text-white mb-1">{feat.title}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bottom testimonial / trust */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="flex items-center gap-3 pt-6 border-t border-white/[0.06]"
          >
            <div className="flex -space-x-2">
              {['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500'].map((bg, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-[#0f172a] flex items-center justify-center text-[10px] font-bold text-white`}>
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-slate-400">Trusted by engineering teams</p>
              <p className="text-xs text-slate-500">Azure-native & enterprise-ready</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  RIGHT PANEL — Login Form                                   */}
      {/* ============================================================ */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative overflow-hidden bg-[#0a0e1a]">
        {/* Subtle radial glow behind the card */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-blue-500/[0.04] blur-3xl" />
        </div>

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25"
            >
              <BarChart3 className="w-6 h-6 text-white" />
            </motion.div>
            <span className="text-xl font-bold text-white tracking-tight">ProdVista</span>
          </div>

          {/* Step indicator */}
          <StepIndicator current={step} />

          {/* Glass card */}
          <motion.div
            layout
            className="relative rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden"
          >
            {/* Gradient top bar */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-400" />

            <div className="p-8">
              <AnimatePresence mode="wait">
                {/* ============================== */}
                {/* STEP 1: Organization Code      */}
                {/* ============================== */}
                {step === 'tenant' && (
                  <motion.div
                    key="tenant"
                    variants={cardVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <div className="text-center mb-8">
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/25"
                      >
                        <Building2 className="w-8 h-8 text-white" />
                      </motion.div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        Welcome back
                      </h2>
                      <p className="text-sm text-slate-400">
                        Enter your organization code to get started
                      </p>
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-red-400 text-xs">!</span>
                            </div>
                            <p className="text-sm text-red-300">{error}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <form onSubmit={handleTenantSubmit} className="space-y-5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                          Organization Code
                        </label>
                        <div className={`relative rounded-xl transition-all duration-300 ${
                          focusedInput
                            ? 'ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10'
                            : 'ring-1 ring-white/[0.08]'
                        }`}>
                          <div className="absolute left-4 top-1/2 -translate-y-1/2">
                            <Building2 className={`w-4.5 h-4.5 transition-colors duration-300 ${
                              focusedInput ? 'text-blue-400' : 'text-slate-500'
                            }`} />
                          </div>
                          <input
                            type="text"
                            value={tenantCode}
                            onChange={(e) => setTenantCode(e.target.value)}
                            onFocus={() => setFocusedInput(true)}
                            onBlur={() => setFocusedInput(false)}
                            className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/[0.04] text-white placeholder-slate-500 text-sm focus:outline-none border-0"
                            placeholder="e.g. versa"
                            autoFocus
                            autoComplete="organization"
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          The unique identifier provided by your admin
                        </p>
                      </div>

                      <motion.button
                        type="submit"
                        disabled={loading || !tenantCode.trim()}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 disabled:shadow-none"
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
                  </motion.div>
                )}

                {/* ============================== */}
                {/* STEP 2: SSO Login              */}
                {/* ============================== */}
                {step === 'login' && tenantInfo && (
                  <motion.div
                    key="login"
                    variants={cardVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <div className="text-center mb-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-5 shadow-lg relative overflow-hidden"
                        style={{
                          background: `linear-gradient(135deg, ${accentColor}, ${adjustColor(accentColor, -40)})`,
                          boxShadow: `0 10px 30px -5px ${accentColor}33`,
                        }}
                      >
                        {tenantInfo.name.charAt(0).toUpperCase()}
                      </motion.div>

                      <h2 className="text-2xl font-bold text-white mb-1">
                        {tenantInfo.name}
                      </h2>
                      <p className="text-sm text-slate-400 mb-3">
                        Choose your sign-in method
                      </p>

                      <button
                        type="button"
                        onClick={handleBackToTenant}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-all group"
                      >
                        <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                        <span>Change organization</span>
                        <span className="ml-1 px-2 py-0.5 bg-white/[0.06] rounded-md text-[10px] font-mono text-slate-400 border border-white/[0.06]">
                          {tenantInfo.code}
                        </span>
                      </button>
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-red-400 text-xs">!</span>
                            </div>
                            <p className="text-sm text-red-300">{error}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-3">
                      {/* Microsoft SSO — Primary */}
                      <motion.button
                        onClick={handleMicrosoftLogin}
                        disabled={loading}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-3.5 px-4 bg-white text-[#1a1a1a] font-semibold rounded-xl transition-all flex items-center justify-between gap-3 disabled:opacity-50 hover:bg-slate-50 shadow-lg group"
                      >
                        <div className="flex items-center gap-3">
                          {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                          ) : (
                            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                              <rect width="10" height="10" fill="#f25022"/>
                              <rect x="11" width="10" height="10" fill="#7fba00"/>
                              <rect y="11" width="10" height="10" fill="#00a4ef"/>
                              <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
                            </svg>
                          )}
                          <span>{loading ? 'Redirecting...' : 'Sign in with Microsoft'}</span>
                        </div>
                        {!loading && (
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        )}
                      </motion.button>

                      {/* DEV: Azure CLI */}
                      {isDev && (
                        <>
                          <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-white/[0.06]" />
                            </div>
                            <div className="relative flex justify-center">
                              <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600 bg-[#0a0e1a]">
                                Dev Only
                              </span>
                            </div>
                          </div>

                          <motion.button
                            onClick={handleAzureCliLogin}
                            disabled={loading}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-3 px-4 bg-white/[0.04] border border-white/[0.08] text-slate-300 font-medium rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 hover:bg-white/[0.07] hover:border-white/[0.12] text-sm"
                          >
                            <Terminal className="w-4 h-4 text-emerald-400" />
                            Azure CLI Login
                          </motion.button>
                          <p className="text-[11px] text-center text-slate-600">
                            Run{' '}
                            <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-emerald-400/80 text-[10px] font-mono">
                              az login
                            </code>{' '}
                            first
                          </p>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-600">
            <Lock className="w-3 h-3" />
            <span>&copy; {new Date().getFullYear()} ProdVista</span>
            <span className="text-slate-700">·</span>
            <span>Secured by Azure</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function adjustColor(color: string, amount: number): string {
  const clamp = (num: number) => Math.min(255, Math.max(0, num));
  color = color.replace('#', '');
  const num = parseInt(color, 16);
  const r = clamp((num >> 16) + amount);
  const g = clamp(((num >> 8) & 0x00FF) + amount);
  const b = clamp((num & 0x0000FF) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
