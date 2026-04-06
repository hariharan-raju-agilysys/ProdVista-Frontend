/**
 * httpClient.ts — Unified HTTP client for ProdVista frontend.
 *
 * Single axios instance used by ALL services.  Consolidates logic that was
 * previously split across api.ts and apiClient.ts into one place:
 *   - Bearer-token injection from localStorage
 *   - X-Correlation-ID for distributed tracing
 *   - 401 → clear token + dispatch 'auth:unauthorized'
 *   - Configurable timeout (default 30s)
 *
 * Environment-aware: reads VITE_API_URL at build time so the same bundle
 * works in dev (proxy), staging, and production.
 */

import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import { storage } from '../utils/storage';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_BASE_PATH || '/api';
const API_TIMEOUT  = Number(import.meta.env.VITE_API_TIMEOUT) || 30_000;

// ---------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------

const httpClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------------------------

httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = storage.get<string>('prodvista_auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Correlation ID for distributed tracing
    config.headers['X-Correlation-ID'] = crypto.randomUUID();

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor
// ---------------------------------------------------------------------------

httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Only show session-expired if user was previously logged in
      const hadToken = storage.get<string>('prodvista_auth_token');
      storage.remove('prodvista_auth_token');
      if (hadToken) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  },
);

export default httpClient;
