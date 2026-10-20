import type { GeocodeHit } from '../../services/geocoder';
import type { Address, LatLng } from '../types';

export type Classified = { status: 'ok' | 'uncertain' | 'failed'; location?: LatLng; reason?: string };

const AMBIGUITY_METERS = 500;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const foldCity = (c: string) => c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Il risultato è in un altro comune rispetto all'indirizzo cercato? (CAP se c'è, altrimenti nome del comune) */
function otherTown(found: Address | undefined, expected: Address | undefined): boolean {
  if (!found || !expected) return false;
  if (found.postcode && expected.postcode) return found.postcode !== expected.postcode;
  if (found.city && expected.city) return foldCity(found.city) !== foldCity(expected.city);
  return false;
}

/** Decide se il punto trovato è affidabile o va verificato a mano. */
export function classifyGeocode(hits: GeocodeHit[], wantsHouseNumber: boolean, expected?: Address): Classified {
  const [top, second] = hits;
  if (!top) return { status: 'failed', reason: 'indirizzo non trovato' };
  const location = top.location;

  if (otherTown(top.address, expected)) {
    return { status: 'uncertain', location, reason: 'risultato in un altro comune' };
  }
  if (top.precision === 'locality' || top.precision === 'unknown') {
    return { status: 'uncertain', location, reason: 'trovata solo la località' };
  }
  if (wantsHouseNumber && top.precision !== 'house') {
    return { status: 'uncertain', location, reason: 'civico non trovato, punto a metà strada' };
  }
  if (second && second.precision === top.precision && distanceMeters(top.location, second.location) > AMBIGUITY_METERS) {
    return { status: 'uncertain', location, reason: 'più risultati in posti diversi' };
  }
  return { status: 'ok', location };
}
