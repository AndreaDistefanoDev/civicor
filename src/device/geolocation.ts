import type { LatLng } from '../domain/types';

/** Posizione attuale dal GPS del telefono. */
export function getCurrentPosition(timeoutMs = 10000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      reject(new Error('Posizione non disponibile'));
      return;
    }
    geo.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Posizione non disponibile')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}
