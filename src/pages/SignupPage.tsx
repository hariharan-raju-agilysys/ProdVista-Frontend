import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authService, TenantInfo } from '../services/authService';

export default function SignupPage() {
  const navigate = useNavigate();
  const hasNavigated = useRef(false);
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'tenant' | 'details'>('tenant');
  const [tenantCode, setTenantCode] = useState(searchParams.get('tenant') || '');
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // Username checking state
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [usernameMessage, setUsernameMessage] = useState('');
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);

  useEffect(() => {
    // Prevent multiple navigations
    if (hasNavigated.current) return;

    // Check if already logged in
    if (authService.isAuthenticated()) {
      hasNavigated.current = true;
      navigate('/dashboard', { replace: true });
      return;
    }

    // Auto-validate tenant from URL param
    if (searchParams.get('tenant')) {
      validateTenant(searchParams.get('tenant')!);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced username availability check
  const checkUsernameAvailability = useCallback(async (username: string, firstName: string, lastName: string) => {
    if (!username || username.length < 3 || !tenantCode) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      setUsernameMessage('');
      return;
    }

    setUsernameChecking(true);
    try {
      const result = await authService.checkUsername({
        tenantCode: tenantCode.toLowerCase(),
        firstName,
        lastName,
        username: username.toLowerCase(),
      });
      
      setUsernameAvailable(result.available);
      setUsernameSuggestions(result.suggestions || []);
      setUsernameMessage(result.message);
    } catch (err) {
      console.error('Username check error:', err);
    }
    setUsernameChecking(false);
  }, [tenantCode]);

  // Auto-generate username from first + last name
  useEffect(() => {
    if (!usernameManuallyEdited && formData.firstName && formData.lastName && tenantCode) {
      const generatedUsername = (formData.firstName + formData.lastName)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      
      if (generatedUsername.length >= 3) {
        setFormData(prev => ({ ...prev, username: generatedUsername }));
        
        // Debounce the check
        const timeoutId = setTimeout(() => {
          checkUsernameAvailability(generatedUsername, formData.firstName, formData.lastName);
        }, 500);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [formData.firstName, formData.lastName, tenantCode, usernameManuallyEdited, checkUsernameAvailability]);

  // Check username when manually edited
  useEffect(() => {
    if (usernameManuallyEdited && formData.username && formData.username.length >= 3) {
      const timeoutId = setTimeout(() => {
        checkUsernameAvailability(formData.username, formData.firstName, formData.lastName);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [formData.username, usernameManuallyEdited, checkUsernameAvailability, formData.firstName, formData.lastName]);

  const validateTenant = async (code: string) => {
    setLoading(true);
    const tenant = await authService.validateTenant(code.toLowerCase());
    if (tenant) {
      setTenantInfo(tenant);
      setTenantCode(code);
      setStep('details');
    }
    setLoading(false);
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    await validateTenant(tenantCode);
    if (!tenantInfo) {
      setError('Organization not found. Please check your organization code.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Track if username was manually edited
    if (name === 'username') {
      setUsernameManuallyEdited(true);
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
    }
    
    // Reset username auto-generation when names change
    if (name === 'firstName' || name === 'lastName') {
      if (!usernameManuallyEdited) {
        setUsernameAvailable(null);
        setUsernameSuggestions([]);
      }
    }
  };

  const selectSuggestedUsername = (suggested: string) => {
    setFormData(prev => ({ ...prev, username: suggested }));
    setUsernameManuallyEdited(true);
    setUsernameAvailable(true);
    setUsernameSuggestions([]);
    setUsernameMessage('');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!acceptTerms) {
      setError('Please accept the terms and conditions');
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (usernameAvailable === false) {
      setError('Please choose an available username');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.register({
        tenantCode: tenantCode.toLowerCase(),
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username.toLowerCase(),
        email: formData.email.toLowerCase(),
        password: formData.password,
      });

      if (response.success) {
        navigate('/dashboard');
      } else {
        setError(response.message || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    }

    setLoading(false);
  };

  const handleBackToTenant = () => {
    setStep('tenant');
    setError('');
    setTenantInfo(null);
  };

  const passwordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score: 1, label: 'Weak', color: '#ef4444' };
    if (score <= 4) return { score: 2, label: 'Medium', color: '#f59e0b' };
    return { score: 3, label: 'Strong', color: '#22c55e' };
  };

  const strength = passwordStrength(formData.password);

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${tenantInfo?.primaryColor || '#3b82f6'} 0%, ${adjustColor(tenantInfo?.primaryColor || '#3b82f6', -30)} 100%)` 
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold mb-3">Join {tenantInfo?.name || 'ProdVista'}</h1>
              <p className="text-xl text-white/80">Create your account and start monitoring</p>
            </div>
            
            <div className="space-y-4 text-left bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-lg font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium">Enter Organization Code</p>
                  <p className="text-sm text-white/70">Get it from your administrator</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-lg font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium">Create Your Account</p>
                  <p className="text-sm text-white/70">Fill in your details</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-lg font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium">Start Monitoring</p>
                  <p className="text-sm text-white/70">Access your team's dashboards</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 overflow-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: tenantInfo?.primaryColor || '#3b82f6' }}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Account</h1>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            {step === 'tenant' ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Let's Get Started</h2>
                  <p className="text-gray-600 dark:text-gray-400">Enter your organization code to continue</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <form onSubmit={handleTenantSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="tenantCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Organization Code
                    </label>
                    <input
                      type="text"
                      id="tenantCode"
                      value={tenantCode}
                      onChange={(e) => setTenantCode(e.target.value)}
                      placeholder="Ask your administrator for the code"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      required
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !tenantCode}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Verifying...
                      </>
                    ) : (
                      <>
                        Continue
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-600 font-medium hover:underline">
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Details Step */}
                <button
                  onClick={handleBackToTenant}
                  className="mb-6 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Change organization
                </button>

                <div className="text-center mb-6">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-3"
                    style={{ backgroundColor: tenantInfo?.primaryColor || '#3b82f6' }}
                  >
                    {tenantInfo?.name.charAt(0).toUpperCase() || 'O'}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Join {tenantInfo?.name || 'Organization'}
                  </h2>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder="John"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder="Doe"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="john.doe@company.com"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Username
                      <span className="text-xs text-gray-500 ml-2">(auto-generated from name)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="username"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        placeholder="johndoe"
                        className={`w-full px-4 py-2.5 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm pr-10 ${
                          usernameAvailable === true ? 'border-green-500' : 
                          usernameAvailable === false ? 'border-red-500' : 
                          'border-gray-300 dark:border-gray-600'
                        }`}
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameChecking ? (
                          <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : usernameAvailable === true ? (
                          <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : usernameAvailable === false ? (
                          <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : null}
                      </div>
                    </div>
                    {usernameAvailable === false && (
                      <div className="mt-2">
                        <p className="text-xs text-red-500 mb-2">{usernameMessage || 'Username is already taken'}</p>
                        {usernameSuggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs text-gray-500">Try:</span>
                            {usernameSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => selectSuggestedUsername(suggestion)}
                                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {usernameAvailable === true && (
                      <p className="mt-1 text-xs text-green-500">Username is available!</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="At least 8 characters"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors pr-12 text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full transition-all duration-300"
                              style={{ 
                                width: `${(strength.score / 3) * 100}%`,
                                backgroundColor: strength.color 
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium" style={{ color: strength.color }}>
                            {strength.label}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Re-enter password"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                      required
                    />
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                    )}
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="acceptTerms"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="acceptTerms" className="text-sm text-gray-600 dark:text-gray-400">
                      I agree to the{' '}
                      <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
                      {' '}and{' '}
                      <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !acceptTerms || usernameAvailable === false || usernameChecking}
                    className="w-full py-3 px-4 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 mt-2"
                    style={{ backgroundColor: tenantInfo?.primaryColor || '#3b82f6' }}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    Already have an account?{' '}
                    <Link 
                      to={`/login?tenant=${tenantCode}`}
                      className="font-medium hover:underline"
                      style={{ color: tenantInfo?.primaryColor || '#3b82f6' }}
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-500">
            © {new Date().getFullYear()} ProdVista. All rights reserved.
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
