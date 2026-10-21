/**
 * Global Desktop & Web Zoom Scaling Manager (50% to 200%)
 * Provides unified zoom control via native Electron webFrame or CSS root zoom,
 * persisting preference across sessions with full keyboard shortcut and wheel support.
 */

const STORAGE_KEY = 'strovr_desktop_zoom';
export const MIN_ZOOM = 0.5; // 50%
export const MAX_ZOOM = 2.0; // 200%
export const DEFAULT_ZOOM = 1.0; // 100%

export const ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '67%', value: 0.67 },
  { label: '75%', value: 0.75 },
  { label: '80%', value: 0.8 },
  { label: '90%', value: 0.9 },
  { label: '100%', value: 1.0 },
  { label: '110%', value: 1.1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '175%', value: 1.75 },
  { label: '200%', value: 2.0 }
];

let currentZoom = DEFAULT_ZOOM;
const listeners = new Set<(zoom: number) => void>();

function clampZoom(factor: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(factor * 100) / 100));
}

function applyToDom(factor: number) {
  try {
    const electron = (window as any).electronZoom;
    if (electron && typeof electron.setZoomFactor === 'function') {
      electron.setZoomFactor(factor);
    } else {
      (document.documentElement.style as any).zoom = String(factor);
    }
  } catch (err) {
    console.warn('[ZoomManager] Could not apply zoom to DOM:', err);
  }
}

export const zoomManager = {
  getZoom(): number {
    return currentZoom;
  },

  getZoomPercent(): number {
    return Math.round(currentZoom * 100);
  },

  setZoom(factor: number): number {
    const clamped = clampZoom(factor);
    currentZoom = clamped;
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch (_) {}
    applyToDom(clamped);
    listeners.forEach((fn) => fn(clamped));
    return clamped;
  },

  zoomIn(delta = 0.1): number {
    return this.setZoom(currentZoom + delta);
  },

  zoomOut(delta = 0.1): number {
    return this.setZoom(currentZoom - delta);
  },

  reset(): number {
    return this.setZoom(DEFAULT_ZOOM);
  },

  subscribe(callback: (zoom: number) => void): () => void {
    listeners.add(callback);
    callback(currentZoom);
    return () => {
      listeners.delete(callback);
    };
  },

  init(): void {
    if (typeof window === 'undefined') return;

    let savedZoom = DEFAULT_ZOOM;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
          savedZoom = parsed;
        }
      }
    } catch (_) {}

    this.setZoom(savedZoom);

    // Global keyboard shortcuts (Ctrl + Plus, Ctrl + Minus, Ctrl + 0)
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+' || e.code === 'NumpadAdd') {
          e.preventDefault();
          this.zoomIn(0.1);
        } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          this.zoomOut(0.1);
        } else if (e.key === '0' || e.code === 'Numpad0') {
          e.preventDefault();
          this.reset();
        }
      }
    });

    // Global mouse wheel shortcut (Ctrl + Wheel)
    window.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            this.zoomIn(0.05);
          } else {
            this.zoomOut(0.05);
          }
        }
      },
      { passive: false }
    );
  }
};

export default zoomManager;
