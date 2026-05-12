import api from './api';

export interface SectionAccessRule {
  sectionKey: string;
  sectionLabel: string;
  category: string;
  description?: string;
  minimumRoleForView: string;
  minimumRoleForWrite: string;
  isEnabled: boolean;
  displayOrder: number;
  icon?: string;
}

export interface SectionPermission {
  canView: boolean;
  canWrite: boolean;
  isEnabled: boolean;
}

export interface UpdateSectionRuleRequest {
  minimumRoleForView: string;
  minimumRoleForWrite: string;
  isEnabled: boolean;
}

/** Returns all section rules for the tenant (Manager+ required). */
export async function getSectionRules(): Promise<SectionAccessRule[]> {
  const res = await api.get<SectionAccessRule[]>('/section-access');
  return res.data;
}

/**
 * Returns a map of sectionKey → {canView, canWrite, isEnabled} for the
 * current authenticated user. Any user can call this.
 */
export async function getMyPermissions(): Promise<Record<string, SectionPermission>> {
  const res = await api.get<Record<string, SectionPermission>>('/section-access/my-rules');
  return res.data;
}

/** Updates a single section rule's visibility/write settings. */
export async function updateSectionRule(
  sectionKey: string,
  rule: UpdateSectionRuleRequest,
): Promise<SectionAccessRule> {
  const res = await api.put<SectionAccessRule>(`/section-access/${encodeURIComponent(sectionKey)}`, rule);
  return res.data;
}

/** Re-seeds default rules for the tenant (Admin only). */
export async function seedSectionRules(): Promise<void> {
  await api.post('/section-access/seed');
}
