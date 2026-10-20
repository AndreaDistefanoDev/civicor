import { db } from './db';
import type { AppSettings, LatLng, Route, RouteSettings, Stop, StopType } from '../domain/types';

const WEEKDAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

export const DEFAULT_SETTINGS: AppSettings = {
  navApp: 'waze',
  defaultServiceMinutes: 1,
  vehicle: 'car',
  avoidTolls: false,
  idMode: 'classic',
  theme: 'dark',
  retentionMonths: 12,
  geocoderProvider: 'osm',
};

const DEFAULT_ROUTE_SETTINGS: RouteSettings = { start: { mode: 'current' }, startTime: 'now', end: { mode: 'return' } };

const STANDARD_TYPE: StopType = { id: 'standard', name: 'Standard', color: '#ffc23d', position: 0, builtIn: true };

export const newId = (): string => crypto.randomUUID();

export function weekdayName(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

// ---------- Percorsi ----------

export async function createRoute(input: { name?: string; date: string }): Promise<Route> {
  const settings = await getSettings();
  const route: Route = {
    id: newId(),
    name: input.name?.trim() || weekdayName(input.date),
    date: input.date,
    createdAt: Date.now(),
    status: 'planning',
    settings: structuredClone(settings.defaultRouteSettings ?? DEFAULT_ROUTE_SETTINGS),
  };
  await db.routes.put(route);
  return route;
}

export async function getRoute(id: string): Promise<Route | undefined> {
  return db.routes.get(id);
}

export async function listRoutes(): Promise<Route[]> {
  const routes = await db.routes.toArray();
  return routes.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

export async function updateRoute(id: string, patch: Partial<Route>): Promise<void> {
  await db.routes.update(id, patch);
}

export async function renameRoute(id: string, name: string): Promise<void> {
  await db.routes.update(id, { name: name.trim() });
}

export async function deleteRoute(id: string): Promise<void> {
  await db.transaction('rw', db.routes, db.stops, async () => {
    await db.stops.where('routeId').equals(id).delete();
    await db.routes.delete(id);
  });
}

export async function duplicateRoute(id: string): Promise<Route> {
  const source = await db.routes.get(id);
  if (!source) throw new Error('Percorso non trovato');
  const copy: Route = {
    ...structuredClone(source),
    id: newId(),
    name: `${source.name} (copia)`,
    createdAt: Date.now(),
    status: 'planning',
    polyline: undefined,
    totals: undefined,
  };
  const stops = (await listStops(id)).map((s) => ({
    ...structuredClone(s),
    id: newId(),
    routeId: copy.id,
    outcome: 'pending' as const,
    outcomeAt: undefined,
    sequence: undefined,
    eta: undefined,
  }));
  await db.transaction('rw', db.routes, db.stops, async () => {
    await db.routes.put(copy);
    await db.stops.bulkPut(stops);
  });
  return copy;
}

// ---------- Fermate ----------

export async function listStops(routeId: string): Promise<Stop[]> {
  return db.stops.where('[routeId+originalIndex]').between([routeId, -Infinity], [routeId, Infinity]).toArray();
}

export async function getStop(id: string): Promise<Stop | undefined> {
  return db.stops.get(id);
}

export async function putStop(stop: Stop): Promise<void> {
  await db.stops.put(stop);
}

/** Aggiorna solo i campi indicati, sulla versione attuale della fermata (nessuna modifica persa). */
export async function patchStop(id: string, patch: Partial<Stop>): Promise<void> {
  await db.stops.update(id, patch);
}

export async function putStops(stops: Stop[]): Promise<void> {
  await db.stops.bulkPut(stops);
}

export async function deleteStops(ids: string[]): Promise<void> {
  await db.stops.bulkDelete(ids);
}

// ---------- Impostazioni ----------

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get('app');
  const { id: _id, ...saved } = row ?? { id: 'app' };
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = (await db.settings.get('app')) ?? { id: 'app' as const };
  await db.settings.put({ ...current, ...patch, id: 'app' });
}

// ---------- Tipi di fermata ----------

/** Sola lettura (usabile nelle query reattive): "Standard" c'è sempre, anche se non ancora salvato. */
export async function listStopTypes(): Promise<StopType[]> {
  const types = await db.stopTypes.orderBy('position').toArray();
  return types.some((t) => t.id === STANDARD_TYPE.id) ? types : [STANDARD_TYPE, ...types];
}

export async function saveStopType(type: StopType): Promise<void> {
  if (type.id === STANDARD_TYPE.id) throw new Error('Non puoi modificare questo tipo');
  await db.stopTypes.put(type);
}

export async function deleteStopType(id: string): Promise<void> {
  if (id === STANDARD_TYPE.id) throw new Error('Non puoi modificare questo tipo');
  await db.stopTypes.delete(id);
}

export async function reorderStopTypes(ids: string[]): Promise<void> {
  await db.transaction('rw', db.stopTypes, async () => {
    if (!(await db.stopTypes.get(STANDARD_TYPE.id))) await db.stopTypes.put(STANDARD_TYPE);
    await Promise.all(ids.map((id, position) => db.stopTypes.update(id, { position })));
  });
}

// ---------- Memoria delle correzioni ----------

export async function getCorrection(key: string): Promise<LatLng | undefined> {
  return (await db.corrections.get(key))?.location;
}

export async function saveCorrection(key: string, location: LatLng, label: string): Promise<void> {
  await db.corrections.put({ key, location, label, updatedAt: Date.now() });
}

// ---------- Codici non riconosciuti ----------

export async function saveUnreadableCode(payload: string): Promise<void> {
  await db.unreadableCodes.add({ payload, createdAt: Date.now() });
}

export async function listUnreadableCodes(): Promise<string[]> {
  return (await db.unreadableCodes.orderBy('createdAt').toArray()).map((r) => r.payload);
}

// ---------- Archiviazione persistente ----------

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export const repos = {
  createRoute, getRoute, listRoutes, updateRoute, renameRoute, deleteRoute, duplicateRoute,
  listStops, getStop, putStop, patchStop, putStops, deleteStops,
  getSettings, saveSettings,
  listStopTypes, saveStopType, deleteStopType, reorderStopTypes,
  getCorrection, saveCorrection,
  saveUnreadableCode, listUnreadableCodes,
  requestPersistentStorage,
};
export type Repos = typeof repos;
