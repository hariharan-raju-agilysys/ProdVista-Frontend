/**
 * Token Encryption/Decryption Utility
 * Uses Web Crypto API (AES-GCM) for secure browser-side token storage
 * Similar to Azure DevOps token handling pattern
 * 
 * Features:
 * - AES-GCM encryption (256-bit key, 12-byte IV)
 * - PBKDF2 key derivation (100k iterations)
 * - Token expiration (24-hour default)
 * - Cross-tab sync via SignalR
 */

import { tokenSyncService } from '../services/tokenSyncService';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

/**
 * Derives encryption key from user session (user ID + tenant + timestamp)
 */
async function deriveKey(salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(salt),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('prodvista-devops-token-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts Azure DevOps PAT token for browser storage
 * @param token - Plain text PAT token (52 chars)
 * @param userSalt - Unique salt from user session (user.id + tenant.id)
 * @returns Base64-encoded encrypted token with IV prefix
 */
export async function encryptDevOpsToken(token: string, userSalt: string): Promise<string> {
  try {
    const key = await deriveKey(userSalt);
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoder = new TextEncoder();

    const encrypted = await window.crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoder.encode(token)
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return base64-encoded string
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Token encryption failed:', error);
    throw new Error('Failed to encrypt DevOps token');
  }
}

/**
 * Decrypts Azure DevOps PAT token from browser storage
 * @param encryptedToken - Base64-encoded encrypted token with IV prefix
 * @param userSalt - Same salt used for encryption
 * @returns Plain text PAT token
 */
export async function decryptDevOpsToken(encryptedToken: string, userSalt: string): Promise<string> {
  try {
    const key = await deriveKey(userSalt);
    const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Token decryption failed:', error);
    throw new Error('Failed to decrypt DevOps token - may be corrupted or invalid');
  }
}

/**
 * Stores encrypted DevOps token in sessionStorage with expiration
 * @param token - Plain text PAT token
 * @param userId - Current user ID
 * @param tenantId - Current tenant ID
 * @param expiresInMs - Expiration time in milliseconds (default: 24 hours)
 */
export async function storeEncryptedDevOpsToken(
  token: string,
  userId: string,
  tenantId: string,
  expiresInMs: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<void> {
  const salt = `${userId}-${tenantId}`;
  const expiresAt = Date.now() + expiresInMs;
  
  // Store token with expiration metadata
  const tokenData = JSON.stringify({ token, expiresAt });
  const encrypted = await encryptDevOpsToken(tokenData, salt);
  
  sessionStorage.setItem('prodvista_devops_token_encrypted', encrypted);
  sessionStorage.setItem('prodvista_devops_token_salt', salt);
  sessionStorage.setItem('prodvista_devops_token_expires', expiresAt.toString());
  
  console.log(`✅ Token stored with expiration: ${new Date(expiresAt).toLocaleString()}`);
  
  // Broadcast token update to other tabs via SignalR
  try {
    await tokenSyncService.broadcastTokenUpdate(encrypted, salt, expiresAt);
  } catch (error) {
    console.warn('Failed to broadcast token update (SignalR may not be connected):', error);
  }
}

/**
 * Retrieves and decrypts DevOps token from sessionStorage with expiration check
 * @param userId - Current user ID
 * @param tenantId - Current tenant ID
 * @returns Plain text PAT token or null if not found/expired
 */
export async function getDecryptedDevOpsToken(userId: string, tenantId: string): Promise<string | null> {
  const encrypted = sessionStorage.getItem('prodvista_devops_token_encrypted');
  const storedSalt = sessionStorage.getItem('prodvista_devops_token_salt');
  const expiresAtStr = sessionStorage.getItem('prodvista_devops_token_expires');

  if (!encrypted || !storedSalt) {
    return null;
  }

  // Check expiration first (quick check before decryption)
  if (expiresAtStr) {
    const expiresAt = parseInt(expiresAtStr, 10);
    if (Date.now() > expiresAt) {
      console.warn('⏰ Token expired - clearing');
      await clearDevOpsToken();
      return null;
    }
  }

  const expectedSalt = `${userId}-${tenantId}`;
  if (storedSalt !== expectedSalt) {
    console.warn('Token salt mismatch - clearing token');
    await clearDevOpsToken();
    return null;
  }

  try {
    const decrypted = await decryptDevOpsToken(encrypted, storedSalt);
    
    // Parse token data with expiration (new format)
    try {
      const tokenData = JSON.parse(decrypted);
      if (tokenData.token && tokenData.expiresAt) {
        // Double-check expiration from encrypted data
        if (Date.now() > tokenData.expiresAt) {
          console.warn('⏰ Token expired (from encrypted data) - clearing');
          await clearDevOpsToken();
          return null;
        }
        return tokenData.token;
      }
    } catch {
      // Fallback for legacy tokens without expiration metadata
      return decrypted;
    }
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt token:', error);
    await clearDevOpsToken();
    return null;
  }
}

/**
 * Clears DevOps token from storage and broadcasts to other tabs
 */
export async function clearDevOpsToken(): Promise<void> {
  sessionStorage.removeItem('prodvista_devops_token');
  sessionStorage.removeItem('prodvista_devops_token_encrypted');
  sessionStorage.removeItem('prodvista_devops_token_salt');
  sessionStorage.removeItem('prodvista_devops_token_expires');
  
  // Broadcast token clear to other tabs via SignalR
  try {
    await tokenSyncService.broadcastTokenClear();
  } catch (error) {
    console.warn('Failed to broadcast token clear:', error);
  }
}

/**
 * Checks if encrypted DevOps token exists
 */
export function hasEncryptedDevOpsToken(): boolean {
  return sessionStorage.getItem('prodvista_devops_token_encrypted') !== null;
}

/**
 * Gets token expiration timestamp
 * @returns Expiration timestamp or null if not set
 */
export function getTokenExpiration(): number | null {
  const expiresAtStr = sessionStorage.getItem('prodvista_devops_token_expires');
  if (!expiresAtStr) return null;
  return parseInt(expiresAtStr, 10);
}

/**
 * Checks if token is expired
 * @returns true if expired or not found
 */
export function isTokenExpired(): boolean {
  const expiresAt = getTokenExpiration();
  if (!expiresAt) return true;
  return Date.now() > expiresAt;
}

/**
 * Gets time remaining until expiration in milliseconds
 * @returns Time remaining or 0 if expired
 */
export function getTimeUntilExpiration(): number {
  const expiresAt = getTokenExpiration();
  if (!expiresAt) return 0;
  const remaining = expiresAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Formats time remaining as human-readable string
 * @returns Formatted string like "23h 45m" or "Expired"
 */
export function formatTimeRemaining(): string {
  const remaining = getTimeUntilExpiration();
  if (remaining === 0) return 'Expired';
  
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
