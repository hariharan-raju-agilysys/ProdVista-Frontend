import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser';
import { authService, TenantInfo } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { getStoredOrgCode, getStoredOrgInfo } from '../context/AuthContext';
import { graphScopes, armScopes, devopsScopes, isMsalConfigured } from '../config/msalConfig';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Loader2, ArrowRight, Terminal, Shield,
  BarChart3, Zap, Globe, Lock, Info, UserCheck,
} from 'lucide-react';
import BrandedSplash from '../components/BrandedSplash';

const basePath = import.meta.env.VITE_BASE_PATH || '';
const isDev = import.meta.env.DEV;

// Module-level flags — survive component unmount/remount cycles caused by
// AuthGate blocking during MSAL status transitions. Without these, useRef
// guards reset on each remount, creating infinite ssoSilent API call loops.
let _ssoAttempted = false;
let _hasNavigated = false;

/* ------------------------------------------------------------------ */
/*  Animated connecting screen — shown while SSO processes            */
/* ------------------------------------------------------------------ */
function ConnectingScreen({ orgName }: { orgName?: string }) {
  return (
    <BrandedSplash
      statusDots={['Authenticating', 'Acquiring tokens', 'Loading workspace']}
      subMessage={orgName ? `Signing in to ${orgName}` : undefined}
    />
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
  const hasNavigated = useRef(_hasNavigated);
  const ssoAttempted = useRef(_ssoAttempted);
  const { instance: msalInstance, inProgress, accounts } = useMsal();
  const { setUserFromLocal, updateOrgInfo } = useAuth();

  // On first real mount (not a remount), reset module-level flags if the user
  // is not authenticated — this means they explicitly navigated to /login
  // (e.g. after logout) and SSO should be attempted fresh.
  useEffect(() => {
    if (!authService.isAuthenticated() && !sessionStorage.getItem('msal_pending_tenant')) {
      _hasNavigated = false;
      _ssoAttempted = false;
      hasNavigated.current = false;
      ssoAttempted.current = false;
    }
    return () => {
      // Sync ref values to module-level flags on unmount so they survive remounts
      _hasNavigated = hasNavigated.current;
      _ssoAttempted = ssoAttempted.current;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPendingMsal = !!sessionStorage.getItem('msal_pending_tenant');
  const storedOrgCode = getStoredOrgCode();
  const storedOrgInfo = getStoredOrgInfo();
  // Check if SSO cooldown is active (set after session expiry to prevent
  // auto-SSO from immediately re-logging the user in)
  const ssoCooldownActive = (() => {
    const ts = localStorage.getItem('prodvista_sso_cooldown');
    if (!ts) return false;
    const elapsed = Date.now() - parseInt(ts, 10);
    if (elapsed >= 3 * 60 * 1000) { // 3-minute cooldown
      localStorage.removeItem('prodvista_sso_cooldown');
      return false;
    }
    return true;
  })();
  // If we have a stored org code and MSAL is likely available,
  // start in 'connecting' phase so the user sees the connecting
  // screen immediately instead of a brief flash of the form.
  // Skip if SSO cooldown is active (e.g. after session expiry).
  const [phase, setPhase] = useState<'tenant' | 'connecting'>(
    ssoCooldownActive ? 'tenant'
      : (hasPendingMsal || (storedOrgCode && isMsalConfigured()) ? 'connecting' : 'tenant')
  );
  const [tenantCode, setTenantCode] = useState(storedOrgCode || '');
  const [connectingOrg, setConnectingOrg] = useState<string | undefined>(
    (hasPendingMsal || storedOrgCode) ? (storedOrgInfo?.name || storedOrgCode || undefined) : undefined
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedInput, setFocusedInput] = useState(false);
  // Detected SSO user from shared Microsoft session (e.g. already logged into Azure Portal / DevOps)
  const [detectedSsoUser, setDetectedSsoUser] = useState<string | null>(null);
  // Form ref for programmatic submission (auto-login countdown)
  const formRef = useRef<HTMLFormElement>(null);
  // Auto-login countdown — starts at 3 when stored org code is available and no cooldown
  const [autoLoginSecs, setAutoLoginSecs] = useState<number>(() =>
    storedOrgCode && !ssoCooldownActive ? 3 : -1
  );

  // Already authenticated — go straight to app
  useEffect(() => {
    if (hasNavigated.current) return;
    if (authService.isAuthenticated()) {
      hasNavigated.current = true;
      navigate('/', { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety timeout: if we started in 'connecting' phase (optimistic SSO)
  // but MSAL never settles within 8 s, fall back to the tenant form.
  useEffect(() => {
    if (phase !== 'connecting') return;
    const timer = setTimeout(() => {
      if (!hasNavigated.current) {
        setPhase('tenant');
        setError('Sign-in is taking longer than expected. Please try again.');
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [phase]);

  /* ---------------------------------------------------------------- */
  /*  Auto-SSO: detect existing Microsoft session on page load        */
  /*  (Same mechanism Azure Portal uses when you're already signed    */
  /*   into Azure DevOps — shared SSO cookie across Microsoft apps)   */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (hasNavigated.current || ssoAttempted.current) return;
    if (inProgress !== InteractionStatus.None) return;
    if (authService.isAuthenticated()) return;
    // Don't interfere with redirect return handler
    if (sessionStorage.getItem('msal_pending_tenant')) return;
    if (!isMsalConfigured()) return;

    ssoAttempted.current = true;

    // Skip auto-SSO if cooldown is active (session just expired)
    const cooldownTs = localStorage.getItem('prodvista_sso_cooldown');
    if (cooldownTs && (Date.now() - parseInt(cooldownTs, 10)) < 3 * 60 * 1000) {
      setPhase('tenant');
      return;
    }

    const detectExistingSession = async () => {
      // 1. Check MSAL cache first (e.g. previous login in this browser session)
      let account = accounts[0] || msalInstance.getActiveAccount();

      // 2. No cached account — try ssoSilent to detect shared Microsoft SSO cookie
      //    This is how Azure Portal knows you're already logged into DevOps
      if (!account) {
        try {
          const ssoResult = await msalInstance.ssoSilent({ scopes: graphScopes.scopes });
          account = ssoResult.account;
        } catch {
          // No shared Microsoft session — fall back to tenant form
          setPhase('tenant');
          return;
        }
      }

      if (!account) { setPhase('tenant'); return; }

      // We have a Microsoft session. Show detected user on the form.
      setDetectedSsoUser(account.username || account.name || null);

      // If we also have a stored org code, auto-login without any user input
      const storedOrgCode = getStoredOrgCode();
      const storedOrgInfo = getStoredOrgInfo();
      if (!storedOrgCode) return; // No org code — just show the hint, wait for user

      setPhase('connecting');
      setConnectingOrg(storedOrgInfo?.name || storedOrgCode);

      try {
        const tokenResponse = await msalInstance.acquireTokenSilent({ ...graphScopes, account });
        if (!tokenResponse?.accessToken) return resetToTenant();

        const response = await authService.loginWithMsal(storedOrgCode, tokenResponse.accessToken);
        if (!response.success) return resetToTenant(response.message || 'Auto sign-in failed');

        if (response.user) setUserFromLocal(response.user as any);
        updateOrgInfo(storedOrgCode, { code: storedOrgCode, name: response.user?.tenantName || storedOrgInfo?.name || storedOrgCode });

        // Acquire optional tokens (ARM & DevOps) — silent only, consent granted via login extraScopesToConsent
        try {
          const armRes = await msalInstance.acquireTokenSilent({ ...armScopes, account }).catch((e: unknown) => { console.warn('[MSAL] ARM token silent failed:', e); return null; });
          if (armRes?.accessToken) sessionStorage.setItem('prodvista_azure_token', armRes.accessToken);
        } catch (err) { console.warn('[MSAL] ARM token acquisition error:', err); }
        try {
          const devRes = await msalInstance.acquireTokenSilent({ ...devopsScopes, account }).catch((e: unknown) => { console.warn('[MSAL] DevOps token silent failed:', e); return null; });
          if (devRes?.accessToken) sessionStorage.setItem('prodvista_devops_token', devRes.accessToken);
        } catch (err) { console.warn('[MSAL] DevOps token acquisition error:', err); }

        hasNavigated.current = true;
        navigate('/', { replace: true });
      } catch {
        resetToTenant();
      }
    };

    const resetToTenant = (msg?: string) => {
      if (msg) setError(msg);
      setPhase('tenant');
    };

    detectExistingSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, accounts]);

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

          // Acquire ARM token — silent (consent granted via login extraScopesToConsent)
          try {
            const armRes = await msalInstance.acquireTokenSilent({ ...armScopes, account: accounts[0] }).catch((e: unknown) => { console.warn('[MSAL] ARM token silent failed:', e); return null; });
            if (armRes?.accessToken) sessionStorage.setItem('prodvista_azure_token', armRes.accessToken);
          } catch (err) { console.warn('[MSAL] ARM token acquisition error:', err); }

          // Acquire DevOps token — silent (consent granted via login extraScopesToConsent)
          try {
            const devRes = await msalInstance.acquireTokenSilent({ ...devopsScopes, account: accounts[0] }).catch((e: unknown) => { console.warn('[MSAL] DevOps token silent failed:', e); return null; });
            if (devRes?.accessToken) sessionStorage.setItem('prodvista_devops_token', devRes.accessToken);
          } catch (err) { console.warn('[MSAL] DevOps token acquisition error:', err); }

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
              const armRes = await msalInstance.acquireTokenSilent({ ...armScopes, account }).catch((e: unknown) => { console.warn('[MSAL] ARM token silent failed:', e); return null; });
              if (armRes?.accessToken) sessionStorage.setItem('prodvista_azure_token', armRes.accessToken);
            } catch (err) { console.warn('[MSAL] ARM token acquisition error:', err); }
            try {
              const devRes = await msalInstance.acquireTokenSilent({ ...devopsScopes, account }).catch((e: unknown) => { console.warn('[MSAL] DevOps token silent failed:', e); return null; });
              if (devRes?.accessToken) sessionStorage.setItem('prodvista_devops_token', devRes.accessToken);
            } catch (err) { console.warn('[MSAL] DevOps token acquisition error:', err); }

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
    // Only request Graph scopes here. ARM consent is handled post-login
    // via acquireTokenRedirect in App.tsx if silent acquisition fails.
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
      setPhase('tenant');
    }
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Clear SSO cooldown — user is explicitly choosing to log in
    localStorage.removeItem('prodvista_sso_cooldown');

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

  // ── Auto-login countdown when stored org code is available ─────────────────
  useEffect(() => {
    if (autoLoginSecs <= 0 || phase !== 'tenant' || loading) return;
    const t = setTimeout(() => setAutoLoginSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoginSecs, phase, loading]);
  useEffect(() => {
    if (autoLoginSecs !== 0 || phase !== 'tenant' || loading) return;
    localStorage.removeItem('prodvista_sso_cooldown');
    formRef.current?.requestSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoginSecs]);
  useEffect(() => { if (error) setAutoLoginSecs(-1); }, [error]);

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
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-blue-50/40 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
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

        {/* Animated glow orbs */}
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.28, 0.15] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-24 -right-24 w-96 h-96 bg-blue-300 rounded-full blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
          className="absolute -bottom-24 -left-24 w-80 h-80 bg-violet-400 rounded-full blur-3xl pointer-events-none"
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
                  className="flex items-start gap-3.5 bg-white/[0.07] backdrop-blur-sm rounded-xl p-3 hover:bg-white/[0.11] transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <feat.icon className="w-4.5 h-4.5 text-blue-100" />
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
            className="flex items-center gap-5 pt-6 border-t border-white/10"
          >
            {[
              { val: '99.9%', label: 'Uptime SLA' },
              { val: 'Azure', label: 'Native SSO' },
              { val: 'RBAC', label: 'Role Secured' },
            ].map(({ val, label }, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-extrabold text-white">{val}</span>
                <span className="text-[11px] text-blue-200/60 font-medium uppercase tracking-wide">{label}</span>
              </div>
            ))}
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
            <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">ProdVista</span>
          </div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-700 overflow-hidden"
          >
            {/* Accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

            <div className="p-8">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg ${
                    storedOrgCode
                      ? 'bg-gradient-to-br from-indigo-500 via-blue-600 to-blue-700 shadow-blue-300/50'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-200/50'
                  }`}
                >
                  {storedOrgCode ? (
                    <span className="text-2xl font-black text-white">
                      {(storedOrgInfo?.name || storedOrgCode || 'O')[0].toUpperCase()}
                    </span>
                  ) : (
                    <Building2 className="w-7 h-7 text-white" />
                  )}
                </motion.div>
                {storedOrgCode ? (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Welcome back</h2>
                    <p className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
                      {storedOrgInfo?.name || storedOrgCode}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1.5">Welcome back</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Enter your organization code to sign in</p>
                  </>
                )}
              </div>

              {/* Detected SSO session hint */}
              <AnimatePresence>
                {detectedSsoUser && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-blue-700 font-medium truncate">{detectedSsoUser}</p>
                        <p className="text-[11px] text-blue-500">Microsoft session detected</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

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

              {/* Quick Connect — auto-login countdown when stored org is available */}
              {storedOrgCode && !ssoCooldownActive && autoLoginSecs !== -1 && (
                <div className="mb-5 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-sm font-semibold text-blue-800">
                        {autoLoginSecs > 0 ? `Auto-connecting in ${autoLoginSecs}s` : 'Connecting…'}
                      </span>
                    </div>
                    {autoLoginSecs > 0 && (
                      <button
                        type="button"
                        onClick={() => setAutoLoginSecs(-1)}
                        className="text-xs text-blue-400 hover:text-blue-600 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                      animate={{ width: `${Math.max(0, (autoLoginSecs / 3) * 100)}%` }}
                      transition={{ duration: 1, ease: 'linear' }}
                    />
                  </div>
                </div>
              )}

              <form ref={formRef} onSubmit={handleTenantSubmit} className="space-y-5">
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
                      onChange={(e) => { setTenantCode(e.target.value); if (autoLoginSecs > 0) setAutoLoginSecs(-1); }}
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
