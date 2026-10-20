import { addressKey, hasHouseNumber } from '../domain/address/normalize';
import { classifyGeocode, distanceMeters } from '../domain/geocode/classify';
import type { Address, LatLng, Stop } from '../domain/types';
import type { AddressSuggestion, Geocoder } from '../services/geocoder';
import { getCorrection, getRoute, getSettings, getStop, listStops, newId, putStop } from './repos';

type Located = Pick<Stop, 'geoStatus' | 'location' | 'geoReason'>;

async function nextIndex(routeId: string): Promise<number> {
  return (await listStops(routeId)).reduce((m, s) => Math.max(m, s.originalIndex + 1), 0);
}

async function newStop(routeId: string, address: Address, located: Located, originalIndex?: number): Promise<Stop> {
  const index = originalIndex ?? (await nextIndex(routeId));
  const { defaultServiceMinutes } = await getSettings();
  const stop: Stop = {
    id: newId(), routeId, address, trackingNumbers: [], packages: 1, order: 'auto', kind: 'delivery',
    timeWindows: [], serviceMinutes: defaultServiceMinutes, stopTypeId: 'standard', originalIndex: index,
    displayId: index + 1, outcome: 'pending', createdAt: Date.now(), ...located,
  };
  await putStop(stop);
  return stop;
}

/** Oltre questa distanza dalla zona del percorso un indirizzo va controllato (es. "Via Roma" in un'altra città). */
const AREA_RADIUS_METERS = 30_000;

/** Punto di riferimento del percorso: la prima fermata con posizione, altrimenti la partenza. */
export async function routeFocus(routeId: string): Promise<LatLng | undefined> {
  const located = (await listStops(routeId)).find((s) => s.geoStatus === 'ok' && s.location);
  return located?.location ?? (await getRoute(routeId))?.startLocation;
}

async function locateSuggestion(s: AddressSuggestion, focus?: LatLng): Promise<Located> {
  const corrected = await getCorrection(addressKey(s.address));
  if (corrected) return { geoStatus: 'ok', location: corrected, geoReason: undefined };
  if (focus && distanceMeters(focus, s.location) > AREA_RADIUS_METERS) {
    return { geoStatus: 'uncertain', location: s.location, geoReason: 'lontano dalla zona del percorso' };
  }
  const c = classifyGeocode([{ location: s.location, precision: s.precision, label: s.label }], hasHouseNumber(s.address));
  return { geoStatus: c.status, location: c.location, geoReason: c.reason };
}

export async function addStopFromSuggestion(routeId: string, s: AddressSuggestion): Promise<Stop> {
  return newStop(routeId, s.address, await locateSuggestion(s, await routeFocus(routeId)));
}

export async function changeStopAddress(stopId: string, s: AddressSuggestion): Promise<void> {
  const stop = await getStop(stopId);
  if (stop) await putStop({ ...stop, address: s.address, ...(await locateSuggestion(s, await routeFocus(stop.routeId))) });
}

/** Fermata messa a mano sulla mappa: la posizione è certa per definizione. */
export async function addStopAtLocation(routeId: string, location: LatLng, label: string): Promise<Stop> {
  return newStop(routeId, { street: label.trim() || 'Punto sulla mappa', city: '' }, { geoStatus: 'ok', location, geoReason: undefined });
}

/** Una fermata per riga: memoria delle correzioni, altrimenti ricerca del testo. */
export async function addStopsFromText(routeId: string, lines: string[], geocoder: Geocoder): Promise<Stop[]> {
  const created: Stop[] = [];
  let index = await nextIndex(routeId);
  for (const line of lines) {
    const typed: Address = { street: line, city: '' };
    const corrected = await getCorrection(addressKey(typed));
    if (corrected) {
      created.push(await newStop(routeId, typed, { geoStatus: 'ok', location: corrected, geoReason: undefined }, index++));
      continue;
    }
    const hits = await geocoder.geocodeText(line);
    const c = classifyGeocode(hits, /\d/.test(line));
    created.push(await newStop(routeId, hits[0]?.address ?? typed, { geoStatus: c.status, location: c.location, geoReason: c.reason }, index++));
  }
  return created;
}
