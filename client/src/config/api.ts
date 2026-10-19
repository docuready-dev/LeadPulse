import axios from 'axios';

/**
 * Central API Base URL resolution for Strovr
 * - In production: uses VITE_API_URL if set (e.g. https://api.yourdomain.com),
 *   otherwise defaults to window.location.origin (when backend & frontend are served together).
 * - In local development: defaults to http://localhost:3001
 */
export const API_URL: string = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin)
).replace(/\/$/, '');

/**
 * Global Axios Request Interceptor
 * Automatically rewrites any legacy 'http://localhost:3001' request URLs
 * to the active production API_URL so no call ever fails in production.
 */
axios.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('http://localhost:3001')) {
    config.url = config.url.replace('http://localhost:3001', API_URL);
  }
  return config;
});

export default API_URL;
