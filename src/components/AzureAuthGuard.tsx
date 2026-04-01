import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAzureAuth } from '../context/AzureAuthContext';
import { Cloud, RefreshCw, Terminal, Home, AlertTriangle, Sparkles, Shield } from 'lucide-react';

interface AzureAuthGuardProps {
  children: ReactNode;
  /** Feature name shown in the loading/error messages */
  featureName?: string;
  /** If true, redirects to home on auth failure instead of showing inline message */
  redirectOnFailure?: boolean;
  /** Custom fallback component when not authenticated */
  fallback?: ReactNode;
}

/**
 * Wrapper component for pages/features that require Azure authentication.
 * Shows friendly loading state while checking, and helpful error messages on failure.
 */
export function AzureAuthGuard({ 
  children, 
  featureName = 'This feature',
  redirectOnFailure = false,
  fallback 
}: AzureAuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    isAzureAuthenticated, 
    isCheckingAzure, 
    azureStatus, 
    refreshAzureStatus,
    isDevelopment 
  } = useAzureAuth();
  
  const [isRetrying, setIsRetrying] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Handle redirect on failure
  useEffect(() => {
    if (redirectOnFailure && !isCheckingAzure && !isAzureAuthenticated) {
      // Store the attempted location for after login
      sessionStorage.setItem('azure_redirect_after_auth', location.pathname);
      navigate('/', { replace: true });
    }
  }, [redirectOnFailure, isCheckingAzure, isAzureAuthenticated, navigate, location]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await refreshAzureStatus();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  // Loading state - show friendly message
  if (isCheckingAzure) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
              <Cloud className="w-10 h-10 text-blue-500 animate-pulse" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Preparing {featureName}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            We're connecting to Azure services to bring you the best experience...
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-500">
            <Sparkles className="w-4 h-4 animate-pulse text-yellow-500" />
            <span>This usually takes just a moment</span>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated - render children
  if (isAzureAuthenticated) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Not authenticated - show friendly error with instructions
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Azure Access Required</h2>
                <p className="text-white/80 text-sm">
                  {featureName} needs Azure connection
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Status message */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-800 dark:text-amber-200 font-medium text-sm">
                  {azureStatus?.message || 'Azure authentication is required to access this feature.'}
                </p>
              </div>
            </div>

            {/* Instructions toggle */}
            {isDevelopment && azureStatus?.instructions && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <Terminal className="w-4 h-4" />
                  {showInstructions ? 'Hide setup instructions' : 'Show setup instructions'}
                </button>
                
                {showInstructions && (
                  <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono">
                    <p className="text-gray-400 mb-2"># Run in your terminal:</p>
                    <div className="space-y-1">
                      <p className="text-green-400">az logout</p>
                      <p className="text-green-400">az login</p>
                    </div>
                    <p className="text-gray-500 mt-3 text-xs">
                      After logging in, click Retry below.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Friendly message for production */}
            {!isDevelopment && (
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Please contact your administrator if you need access to Azure features,
                or try again later if this is a temporary issue.
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Checking...' : 'Retry Connection'}
              </button>
              
              <button
                onClick={handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </button>
            </div>
          </div>

          {/* Footer tip */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-500 text-center">
              💡 <strong>Tip:</strong> Azure features require an active Azure CLI session or managed identity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Minimal loading indicator for inline use
 */
export function AzureAuthLoading({ message = 'Connecting to Azure...' }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="relative">
        <Cloud className="w-6 h-6 text-blue-500" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">{message}</span>
    </div>
  );
}

/**
 * Small badge showing Azure auth status
 */
export function AzureAuthBadge() {
  const { isAzureAuthenticated, isCheckingAzure, azureStatus } = useAzureAuth();

  if (isCheckingAzure) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        Checking...
      </span>
    );
  }

  if (isAzureAuthenticated) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        Connected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
      <div className="w-2 h-2 bg-amber-500 rounded-full" />
      {azureStatus?.method === 'None' ? 'Not Connected' : 'Expired'}
    </span>
  );
}

export default AzureAuthGuard;
