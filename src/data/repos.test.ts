import { db } from './db';
import {
  createRoute,
  deleteRoute,
  deleteStopType,
  duplicateRoute,
  getCorrection,
  getSettings,
  listRoutes,
  listStops,
  listStopTypes,
  putStop,
  saveCorrection,
  saveSettings,
} from './repos';
import type { Stop } from '../domain/types';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const stop = (routeId: string, id: string, originalIndex = 0): Stop => ({
  id, routeId, address: { street: 'Via Esempio, 12', city: 'Ragusa' }, trackingNumbers: [], packages: 1,
  order: 'auto', kind: 'delivery', timeWindows: [], serviceMinutes: 1, stopTypeId: 'standard',
  geoStatus: 'pending', originalIndex, displayId: originalIndex + 1, outcome: 'pending', createdAt: 1,
});

it('crea un percorso con il giorno della settimana come nome', async () => {
  const r = await createRoute({ date: '2026-10-19' });
  expect(r).toMatchObject({ name: 'Lunedì', date: '2026-10-19', status: 'planning',
    settings: { start: { mode: 'current' }, startTime: 'now', end: { mode: 'return' } } });
});

it('usa le impostazioni di percorso predefinite se salvate', async () => {
  await saveSettings({ defaultRouteSettings: { start: { mode: 'current' }, startTime: '07:30', end: { mode: 'none' } } });
  const r = await createRoute({ date: '2026-10-19', name: 'Giro mattina' });
  expect(r.name).toBe('Giro mattina');
  expect(r.settings).toMatchObject({ startTime: '07:30', end: { mode: 'none' } });
});

it('elenca i percorsi dal più recente', async () => {
  await createRoute({ date: '2026-10-16' });
  await createRoute({ date: '2026-10-19' });
  expect((await listRoutes()).map((r) => r.date)).toEqual(['2026-10-19', '2026-10-16']);
});

it('eliminare un percorso elimina anche le sue fermate', async () => {
  const r = await createRoute({ date: '2026-10-19' });
  await putStop(stop(r.id, 's1'));
  await deleteRoute(r.id);
  expect(await listStops(r.id)).toEqual([]);
  expect(await listRoutes()).toEqual([]);
});

it('duplicare un percorso copia le fermate riportandole da fare', async () => {
  const r = await createRoute({ date: '2026-10-19' });
  await putStop({ ...stop(r.id, 's1'), outcome: 'done' });
  const copy = await duplicateRoute(r.id);
  const stops = await listStops(copy.id);
  expect(copy.id).not.toBe(r.id);
  expect(stops).toHaveLength(1);
  expect(stops[0]).toMatchObject({ routeId: copy.id, outcome: 'pending' });
});

it('impostazioni predefinite su database vuoto', async () => {
  expect(await getSettings()).toEqual({ navApp: 'waze', defaultServiceMinutes: 1, vehicle: 'car',
    avoidTolls: false, idMode: 'classic', theme: 'dark', retentionMonths: 12, geocoderProvider: 'osm' });
});

it('crea il tipo Standard una sola volta', async () => {
  await listStopTypes();
  const types = await listStopTypes();
  expect(types).toEqual([{ id: 'standard', name: 'Standard', color: '#ffc23d', position: 0, builtIn: true }]);
});

it('il tipo Standard non si elimina', async () => {
  await listStopTypes();
  await expect(deleteStopType('standard')).rejects.toThrow('Non puoi modificare questo tipo');
});

it('ricorda una correzione di posizione', async () => {
  await saveCorrection('via esempio 12|97100', { lat: 36.9, lng: 14.7 }, 'Via Esempio, 12');
  expect(await getCorrection('via esempio 12|97100')).toEqual({ lat: 36.9, lng: 14.7 });
  expect(await getCorrection('altro')).toBeUndefined();
});
