import axios from 'axios';

/**
 * Central API Base URL resolution for Strovr
 * - In production: uses VITE_API_URL if set (e.g. https://api.yourdomain.com),
 *   otherwise defaults to window.location.origin (when backend & frontend are served together).
 * - In local development: defaults to http://localhost:3001
 */
export const API_URL: string = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : (window.location.port === '5173' || window.location.port === '3000'
            ? `http://${window.location.hostname}:3001`
            : window.location.origin))
    : 'http://localhost:3001')
).replace(/\/$/, '');

/**
 * Global Axios Request Interceptor
 * Automatically rewrites any legacy 'http://localhost:3001' request URLs
 * to the active production/LAN API_URL so no call ever fails on mobile or deployed domains.
 */
axios.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('http://localhost:3001')) {
    config.url = config.url.replace('http://localhost:3001', API_URL);
  }
  return config;
});

export default API_URL;
