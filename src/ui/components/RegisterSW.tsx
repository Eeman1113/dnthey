'use client';

import { useEffect } from 'react';
import { BASE } from '@/ui/basePath';

/**
 * Registers the service worker so the game survives losing the connection,
 * which matters more here than for most sites: the model is already local,
 * so the only thing standing between the player and an offline session is
 * the page itself.
 */
export function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    const onLoad = () => {
      navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {
        // An unavailable service worker costs offline support and nothing else.
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
