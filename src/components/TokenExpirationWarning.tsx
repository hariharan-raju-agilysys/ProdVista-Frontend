import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { tokenRotationService, type TokenRotationInfo } from '../services/tokenRotationService';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

/**
 * Token Expiration Warning Banner
 * Shows when Azure DevOps token is about to expire or requires rotation
 */
export default function TokenExpirationWarning() {
  const { isAuthenticated } = useAuth();
  const [tokenInfo, setTokenInfo] = useState<TokenRotationInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkRotation = async () => {
      try {
        const { data } = await tokenRotationService.getStatus();
        setTokenInfo(data);
      } catch (error) {
        console.error('Failed to check token rotation status:', error);
      }
    };

    checkRotation();
    
    // Check every hour
    const interval = setInterval(checkRotation, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleMarkRotated = async () => {
    setLoading(true);
    try {
      await tokenRotationService.markRotated();
      const { data } = await tokenRotationService.getStatus();
      setTokenInfo(data);
    } catch (error) {
      console.error('Failed to mark token as rotated:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show if no token info, dismissed, or doesn't require rotation
  if (!tokenInfo || dismissed || !tokenInfo.requiresRotation) {
    return null;
  }

  const daysOverdue = tokenInfo.ageDays ? tokenInfo.ageDays - 90 : 0;
  const isUrgent = daysOverdue > 30; // 30+ days overdue

  return (
    <div
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-sm',
        isUrgent
          ? 'bg-red-500/90 border-red-600 text-white'
          : 'bg-yellow-500/90 border-yellow-600 text-yellow-950'
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className={clsx('w-5 h-5', isUrgent ? 'animate-pulse' : '')} />
            <div>
              <p className="font-semibold">
                {isUrgent ? '🚨 Critical: ' : '⚠️ Warning: '}
                Azure DevOps Token Requires Rotation
              </p>
              <p className="text-sm opacity-90">
                Your token is {tokenInfo.ageDays} days old ({daysOverdue} days overdue).
                Please rotate your Personal Access Token in Azure DevOps settings.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkRotated}
              disabled={loading}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors',
                isUrgent
                  ? 'bg-white text-red-600 hover:bg-red-50'
                  : 'bg-yellow-950 text-yellow-50 hover:bg-yellow-900',
                loading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
              {loading ? 'Marking...' : 'I Rotated My Token'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-2 rounded-md hover:bg-black/10 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
