import { db } from './db';
import { optimizeRoute, resetDisplayIds, reverseRoute, skipOptimization, type OptimizeDeps } from './optimizeRoute';
import { createRoute, getRoute, listStops, putStop, saveSettings } from './repos';
import { solveRoute } from '../domain/optimize/solver';
import { OrsError } from '../services/ors/orsClient';
import { makeStop } from '../test/fixtures';
import type { LatLng } from '../domain/types';

// Punti su una retta: la partenza a lat 36.90, le fermate più a nord in ordine sparso.
const at = (lat: number): LatLng => ({ lat, lng: 14.7 });

function deps(over: Partial<OptimizeDeps> = {}): OptimizeDeps {
  return {
    getMatrix: vi.fn(async (points: LatLng[]) => {
      const d = points.map((a) => points.map((b) => Math.round(Math.abs(a.lat - b.lat) * 100000)));
      return { durations: d, distances: d.map((r) => r.map((v) => v * 10)) };
    }),
    routeLine: vi.fn(async (points: LatLng[]) => points.map((p) => [p.lng, p.lat] as [number, number])),
    getPosition: vi.fn(async () => at(36.9)),
    optimize: async (input) => solveRoute({ ...input, timeBudgetMs: 200 }),
    now: () => new Date(2026, 9, 20, 8, 0),
    ...over,
  };
}

let routeId: string;
beforeEach(async () => {
  await db.delete();
  await db.open();
  await saveSettings({ orsApiKey: 'k' });
  routeId = (await createRoute({ date: '2026-10-20' })).id;
  await putStop(makeStop({ id: 'far', routeId, originalIndex: 0, displayId: 1, location: at(36.93) }));
  await putStop(makeStop({ id: 'near', routeId, originalIndex: 1, displayId: 2, location: at(36.91) }));
  await putStop(makeStop({ id: 'mid', routeId, originalIndex: 2, displayId: 3, location: at(36.92) }));
});

it('fermate senza posizione confermata → non ottimizza (incerte e fallite)', async () => {
  await putStop(makeStop({ id: 'f', routeId, originalIndex: 3, geoStatus: 'failed', location: undefined }));
  await putStop(makeStop({ id: 'u', routeId, originalIndex: 4, geoStatus: 'uncertain' }));
  expect(await optimizeRoute(routeId, () => {}, deps())).toEqual({ kind: 'missing_locations', count: 2 });
});

it('chiave mancante → errore con il messaggio ORS', async () => {
  await saveSettings({ orsApiKey: undefined });
  expect(await optimizeRoute(routeId, () => {}, deps())).toEqual({
    kind: 'error', message: 'Inserisci la chiave OpenRouteService nelle Impostazioni.' });
});

it('quota esaurita durante il calcolo → errore leggibile', async () => {
  const d = deps({ getMatrix: vi.fn(async () => { throw new OrsError('quota'); }) });
  expect(await optimizeRoute(routeId, () => {}, d)).toEqual({
    kind: 'error', message: 'Limite giornaliero di OpenRouteService raggiunto. Riprova più tardi.' });
});

it('ottimizzazione riuscita salva sequenza, orari, linea, totali e stato', async () => {
  const steps: string[] = [];
  expect(await optimizeRoute(routeId, (s) => steps.push(s), deps())).toEqual({ kind: 'ok' });
  expect(steps).toEqual(['analisi', 'percorso', 'traffico', 'creazione']);
  const stops = (await listStops(routeId)).sort((a, b) => a.sequence! - b.sequence!);
  expect(stops.map((s) => s.id)).toEqual(['near', 'mid', 'far']);
  expect(stops.every((s) => /^\d\d:\d\d$/.test(s.eta!))).toBe(true);
  expect(stops.map((s) => s.displayId)).toEqual([2, 3, 1]); // ID classico: invariato
  const route = await getRoute(routeId);
  expect(route).toMatchObject({ status: 'optimized', startLocation: at(36.9) });
  expect(route?.polyline).toHaveLength(5); // partenza, 3 fermate, rientro
  expect(route?.totals?.km).toBeGreaterThan(0);
  expect(route?.totals?.endTime).toMatch(/^\d\d:\d\d$/);
});

it('ID dopo l\'ottimizzazione → displayId segue la sequenza', async () => {
  await saveSettings({ idMode: 'after_optimization' });
  await optimizeRoute(routeId, () => {}, deps());
  const stops = (await listStops(routeId)).sort((a, b) => a.sequence! - b.sequence!);
  expect(stops.map((s) => s.displayId)).toEqual([1, 2, 3]);
});

it('invertire il percorso inverte la sequenza', async () => {
  await optimizeRoute(routeId, () => {}, deps());
  await reverseRoute(routeId, deps());
  const stops = (await listStops(routeId)).sort((a, b) => a.sequence! - b.sequence!);
  expect(stops.map((s) => s.id)).toEqual(['far', 'mid', 'near']);
});

it('saltare l\'ottimizzazione usa l\'ordine di inserimento', async () => {
  await skipOptimization(routeId);
  const stops = (await listStops(routeId)).sort((a, b) => a.sequence! - b.sequence!);
  expect(stops.map((s) => s.id)).toEqual(['far', 'near', 'mid']);
  expect((await getRoute(routeId))?.status).toBe('optimized');
});

it('reimposta gli ID secondo la sequenza attuale', async () => {
  await optimizeRoute(routeId, () => {}, deps());
  await resetDisplayIds(routeId);
  const stops = (await listStops(routeId)).sort((a, b) => a.sequence! - b.sequence!);
  expect(stops.map((s) => s.displayId)).toEqual([1, 2, 3]);
});

it('la linea sulla mappa che fallisce non blocca l\'ottimizzazione', async () => {
  const d = deps({ routeLine: vi.fn(async () => { throw new OrsError('server'); }) });
  expect(await optimizeRoute(routeId, () => {}, d)).toEqual({ kind: 'ok' });
  expect((await getRoute(routeId))?.polyline).toBeUndefined();
});

it('chiave mancante ha la precedenza sulle fermate ancora in ricerca', async () => {
  await saveSettings({ orsApiKey: undefined });
  await putStop(makeStop({ id: 'p', routeId, originalIndex: 3, geoStatus: 'pending', location: undefined }));
  expect(await optimizeRoute(routeId, () => {}, deps())).toEqual({
    kind: 'error', message: 'Inserisci la chiave OpenRouteService nelle Impostazioni.' });
});

it('fermate ancora in ricerca sono distinte da quelle da verificare', async () => {
  await putStop(makeStop({ id: 'p', routeId, originalIndex: 3, geoStatus: 'pending', location: undefined }));
  expect(await optimizeRoute(routeId, () => {}, deps())).toEqual({ kind: 'pending_locations', count: 1 });
});

it('riottimizzando a metà giro le fermate già fatte restano in cima, nell\'ordine in cui sono state fatte', async () => {
  await db.routes.update(routeId, { status: 'in_progress' });
  await putStop(makeStop({ id: 'far', routeId, originalIndex: 0, displayId: 1, location: at(36.93), outcome: 'done', outcomeAt: 100, sequence: 7 }));
  await optimizeRoute(routeId, () => {}, deps());
  const stops = (await listStops(routeId)).sort((a, b) => a.sequence! - b.sequence!);
  expect(stops.map((s) => s.id)).toEqual(['far', 'near', 'mid']);
  expect(stops.map((s) => s.sequence)).toEqual([0, 1, 2]);
});
