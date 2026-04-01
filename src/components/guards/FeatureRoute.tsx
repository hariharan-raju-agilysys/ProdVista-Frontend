import { Navigate } from 'react-router-dom'
import { useFeatureStore } from '../../store/featureStore'

interface FeatureRouteProps {
  feature: keyof import('../../store/featureStore').FeatureFlags
  children: React.ReactNode
}

/**
 * Route guard that checks if a feature flag is enabled.
 * Redirects to home if the feature is disabled.
 */
export function FeatureRoute({ feature, children }: FeatureRouteProps) {
  const { features, isLoaded } = useFeatureStore()

  // While loading, render nothing (avoids flash)
  if (!isLoaded) return null

  if (!features[feature]) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
