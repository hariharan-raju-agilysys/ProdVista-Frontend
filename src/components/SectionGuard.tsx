import { type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useSectionAccess } from '../context/SectionAccessContext';

interface SectionGuardProps {
  /** The section key to check, e.g. "hr:upload", "ai:chat" */
  sectionKey: string;
  /** 'view' (default) = guard visibility; 'write' = guard write actions */
  mode?: 'view' | 'write';
  /** Custom content to show when access is denied. Defaults to null (renders nothing). */
  fallback?: ReactNode;
  /** When true, show a subtle "restricted" placeholder instead of nothing */
  showRestricted?: boolean;
  children: ReactNode;
}

/**
 * SectionGuard — conditionally renders children based on the current user's
 * section access permissions loaded from the SectionAccessContext.
 *
 * Usage:
 * ```tsx
 * <SectionGuard sectionKey="hr:upload">
 *   <UploadButton />
 * </SectionGuard>
 *
 * <SectionGuard sectionKey="devops:deploy" mode="write" showRestricted>
 *   <TriggerDeployButton />
 * </SectionGuard>
 * ```
 */
export function SectionGuard({
  sectionKey,
  mode = 'view',
  fallback,
  showRestricted = false,
  children,
}: SectionGuardProps) {
  const { canView, canWrite } = useSectionAccess();

  const hasAccess = mode === 'write' ? canWrite(sectionKey) : canView(sectionKey);

  if (hasAccess) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  if (showRestricted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-sm select-none">
        <Lock className="w-3.5 h-3.5 shrink-0" />
        <span>Restricted</span>
      </div>
    );
  }

  return null;
}

export default SectionGuard;
