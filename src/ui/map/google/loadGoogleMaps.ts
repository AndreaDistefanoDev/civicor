// Carica Google Maps una sola volta. La chiave arriva dalle Impostazioni (solo sul telefono), mai dal codice.

const CALLBACK = '__civicorGoogleMapsReady';

let pending: Promise<typeof google.maps> | undefined;
const authListeners = new Set<() => void>();

export function googleMapsScriptUrl(key: string, callback: string): string {
  const url = new URL('https://maps.googleapis.com/maps/api/js');
  url.searchParams.set('key', key);
  url.searchParams.set('v', 'weekly');
  url.searchParams.set('language', 'it');
  url.searchParams.set('region', 'IT');
  url.searchParams.set('loading', 'async');
  url.searchParams.set('callback', callback);
  return url.toString();
}

/**
 * `onAuthFailure` scatta se Google rifiuta la chiave (chiave errata, API non attiva, fatturazione assente):
 * in quel caso Civicor torna alla mappa OpenStreetMap.
 */
export function loadGoogleMaps(key: string, onAuthFailure?: () => void): Promise<typeof google.maps> {
  if (onAuthFailure) authListeners.add(onAuthFailure);
  (window as unknown as { gm_authFailure: () => void }).gm_authFailure = () => authListeners.forEach((fn) => fn());
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    (window as unknown as Record<string, () => void>)[CALLBACK] = () => resolve(window.google.maps);
    const script = document.createElement('script');
    script.src = googleMapsScriptUrl(key, CALLBACK);
    script.async = true;
    script.addEventListener('error', () => {
      pending = undefined;
      script.remove();
      reject(new Error('Google Maps non raggiungibile'));
    });
    document.head.append(script);
  });
  return pending;
}

export function removeAuthListener(fn: () => void): void {
  authListeners.delete(fn);
}

export function resetGoogleMapsForTests(): void {
  pending = undefined;
  authListeners.clear();
}
