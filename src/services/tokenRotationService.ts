import api from './api';

export interface TokenRotationInfo {
  tokenCreatedAt: string | null;
  ageDays: number | null;
  requiresRotation: boolean;
  daysUntilRotation: number | null;
}

/**
 * Token Rotation API Service
 * Manages 90-day token rotation policy
 */
export const tokenRotationService = {
  /**
   * Gets current token rotation status
   */
  getStatus: () => api.get<TokenRotationInfo>('/token-rotation/status'),

  /**
   * Marks token as rotated (updates creation date)
   */
  markRotated: () => api.post('/token-rotation/mark-rotated'),

  /**
   * Checks if token requires rotation (90+ days old)
   */
  requiresRotation: () => api.get<{ requiresRotation: boolean }>('/token-rotation/requires-rotation'),
};
