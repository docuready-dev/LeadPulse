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
 * Check if the active client environment is the Electron Desktop PC build
 */
export const isDesktopEnvironment: boolean = typeof window !== 'undefined' && (
  Boolean((window as any).isDesktop) ||
  Boolean((window as any).electronZoom) ||
  Boolean(window.navigator.userAgent.includes('Electron')) ||
  Boolean(window.navigator.userAgent.includes('StrovrDesktop'))
);

/**
 * Retrieve or generate a persistent unique machine ID for desktop telemetry
 */
function getOrGenerateMachineId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let machineId = localStorage.getItem('strovr_machine_id');
    if (!machineId) {
      machineId = 'pc_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('strovr_machine_id', machineId);
    }
    return machineId;
  } catch (_) {
    return 'pc_fallback_' + Date.now();
  }
}

/**
 * Global Axios Request Interceptor
 * 1. Automatically rewrites any legacy 'http://localhost:3001' request URLs
 *    to the active production/LAN API_URL so no call ever fails on mobile or deployed domains.
 * 2. Injects client environment telemetry headers so Superadmin knows which users are on PC vs Web.
 */
axios.interceptors.request.use((config) => {
  if (config.url && config.url.startsWith('http://localhost:3001')) {
    config.url = config.url.replace('http://localhost:3001', API_URL);
  }

  // Inject Platform & Device Telemetry Headers
  config.headers = config.headers || {};
  config.headers['X-Client-Platform'] = isDesktopEnvironment ? 'desktop-windows' : 'web';
  if (isDesktopEnvironment) {
    config.headers['X-App-Version'] = (window as any).STROVR_APP_VERSION || '3.0.0';
    config.headers['X-Machine-Id'] = getOrGenerateMachineId();
    config.headers['X-Client-OS'] = 'Windows';
  }

  return config;
});

export default API_URL;
