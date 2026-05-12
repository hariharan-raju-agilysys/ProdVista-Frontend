import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  getMyPermissions,
  type SectionPermission,
} from '../services/sectionAccessService';
import { useAuth } from './AuthContext';

// ── Role hierarchy helpers ────────────────────────────────────────────────────

const ROLE_LEVELS: Record<string, number> = {
  admin: 100,
  manager: 80,
  lead: 60,
  user: 40,
  viewer: 20,
};

function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_LEVELS[userRole?.toLowerCase()] ?? 0;
  const reqLevel = ROLE_LEVELS[requiredRole?.toLowerCase()] ?? 0;
  return userLevel >= reqLevel;
}

// ── Context types ─────────────────────────────────────────────────────────────

interface SectionAccessContextValue {
  /** Map of sectionKey → {canView, canWrite, isEnabled} for the current user. */
  permissions: Record<string, SectionPermission>;
  /** true while the first fetch is loading */
  isLoading: boolean;
  /** Returns true if user can VIEW the section. Falls back to role-level check when section key is unknown. */
  canView: (sectionKey: string) => boolean;
  /** Returns true if user can WRITE to the section. */
  canWrite: (sectionKey: string) => boolean;
  /** Returns true if the section is enabled. Returns true if key is unknown. */
  isEnabled: (sectionKey: string) => boolean;
  /** Force-reload permissions from the server. */
  refreshPermissions: () => void;
}

const SectionAccessContext = createContext<SectionAccessContextValue>({
  permissions: {},
  isLoading: false,
  canView: () => true,
  canWrite: () => false,
  isEnabled: () => true,
  refreshPermissions: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

interface SectionAccessProviderProps {
  children: ReactNode;
}

export function SectionAccessProvider({ children }: SectionAccessProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, SectionPermission>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  const userRole = user?.role?.toLowerCase() ?? 'user';

  useEffect(() => {
    if (!isAuthenticated) {
      setPermissions({});
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getMyPermissions()
      .then((map) => {
        if (!cancelled) setPermissions(map);
      })
      .catch(() => {
        // Silently fail — canView/canWrite fall back to role check
        if (!cancelled) setPermissions({});
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, revision]);

  const refreshPermissions = useCallback(() => {
    setRevision((n) => n + 1);
  }, []);

  const canView = useCallback(
    (sectionKey: string): boolean => {
      const perm = permissions[sectionKey];
      if (perm === undefined) return true; // unknown key → open
      if (!perm.isEnabled) return false;
      return perm.canView;
    },
    [permissions],
  );

  const canWrite = useCallback(
    (sectionKey: string): boolean => {
      const perm = permissions[sectionKey];
      if (perm === undefined) return hasMinimumRole(userRole, 'manager');
      if (!perm.isEnabled) return false;
      return perm.canWrite;
    },
    [permissions, userRole],
  );

  const isEnabled = useCallback(
    (sectionKey: string): boolean => {
      const perm = permissions[sectionKey];
      return perm?.isEnabled ?? true;
    },
    [permissions],
  );

  return (
    <SectionAccessContext.Provider
      value={{ permissions, isLoading, canView, canWrite, isEnabled, refreshPermissions }}
    >
      {children}
    </SectionAccessContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSectionAccess(): SectionAccessContextValue {
  return useContext(SectionAccessContext);
}

export default SectionAccessContext;
