import api from './api';

// ── Types ──────────────────────────────────────────────────

export interface ReleaseBranch {
  id: string;
  name: string;
  branchType: 'Main' | 'Hotfix' | 'Custom';
  branchName: string;
  version?: string;
  description?: string;
  availability: 'Unknown' | 'Available' | 'Unavailable';
  reportedByUser?: string;
  reportedAt?: string;
  sortOrder: number;
  isActive: boolean;
  createdByDisplayName: string;
  createdAt: string;
}

export interface UpsertReleaseBranchRequest {
  id?: string;
  name: string;
  branchType: string;
  branchName: string;
  version?: string;
  description?: string;
  sortOrder: number;
}

// ── API Functions ──────────────────────────────────────────

export async function getReleaseBranches(): Promise<ReleaseBranch[]> {
  const { data } = await api.get('/release-branches');
  return data;
}

export async function upsertReleaseBranch(request: UpsertReleaseBranchRequest): Promise<ReleaseBranch> {
  const { data } = await api.post('/release-branches', request);
  return data;
}

export async function deleteReleaseBranch(id: string): Promise<void> {
  await api.delete(`/release-branches/${id}`);
}

export async function reportBranchUnavailable(id: string): Promise<{ message: string }> {
  const { data } = await api.post(`/release-branches/${id}/report-unavailable`);
  return data;
}

export async function markBranchAvailable(id: string): Promise<void> {
  await api.post(`/release-branches/${id}/mark-available`);
}
