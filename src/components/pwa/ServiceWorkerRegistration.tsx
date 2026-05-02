'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker at /sw.js on first mount.
 * Renders nothing — exists only for its side effect.
 * Failure is silent: registration errors do not affect app functionality.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // SW registration is best-effort. The app works without it.
      });
    }
  }, []);

  return null;
}
