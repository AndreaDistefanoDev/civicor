import type { LatLng, NavApp } from '../types';

/** Link che apre l'app di navigazione scelta verso la fermata. */
export function buildNavigationUrl(app: NavApp, dest: LatLng): string {
  const ll = `${dest.lat},${dest.lng}`;
  switch (app) {
    case 'waze':
      return `https://waze.com/ul?ll=${ll}&navigate=yes`;
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving`;
    case 'apple':
      return `https://maps.apple.com/?daddr=${ll}&dirflg=d`;
  }
}

/** Link che apre direttamente l'app installata (Apple Maps: il link web lo apre già iOS). */
export function buildNavigationAppUrl(app: NavApp, dest: LatLng): string {
  const ll = `${dest.lat},${dest.lng}`;
  switch (app) {
    case 'waze':
      return `waze://?ll=${ll}&navigate=yes`;
    case 'google':
      return `comgooglemaps://?daddr=${ll}&directionsmode=driving`;
    case 'apple':
      return buildNavigationUrl('apple', dest);
  }
}
