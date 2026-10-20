import { evaluate, type SolverInput, type SolverResult } from '../domain/optimize/solver';
import { hhmmToSec, secToHhmm } from '../domain/optimize/time';
import type { AppSettings, LatLng, Route, Stop } from '../domain/types';
import { OrsError } from '../services/ors/orsClient';
import { profileFor, type Matrix, type Profile } from '../services/routing';
import { getRoute, getSettings, listStops, putStops, updateRoute } from './repos';

export type OptimizeStep = 'analisi' | 'percorso' | 'traffico' | 'creazione';
export type OptimizeOutcome =
  | { kind: 'ok' }
  /** Fermate incerte o non trovate: vanno verificate a mano. */
  | { kind: 'missing_locations'; count: number }
  /** Fermate la cui posizione è ancora in ricerca. */
  | { kind: 'pending_locations'; count: number }
  | { kind: 'error'; message: string };

export interface OptimizeDeps {
  getMatrix(points: LatLng[], profile: Profile): Promise<Matrix>;
  routeLine(points: LatLng[], profile: Profile, avoidTolls: boolean): Promise<[number, number][]>;
  getPosition(): Promise<LatLng>;
  optimize(input: SolverInput): Promise<SolverResult>;
  now(): Date;
}

interface Context {
  route: Route;
  stops: Stop[];
  settings: AppSettings;
  start: LatLng;
  end?: LatLng;
  input: SolverInput;
  profile: Profile;
}


async function buildContext(routeId: string, deps: OptimizeDeps): Promise<Context> {
  const route = await getRoute(routeId);
  if (!route) throw new Error('Percorso non trovato');
  const settings = await getSettings();
  if (!settings.orsApiKey) throw new OrsError('missing_key');
  const stops = (await listStops(routeId)).filter((s) => s.outcome === 'pending');
  const { start: startSetting, end: endSetting } = route.settings;

  const start =
    startSetting.mode === 'address' && startSetting.location ? startSetting.location : await deps.getPosition();
  const end =
    endSetting.mode === 'return' ? start : endSetting.mode === 'address' ? endSetting.location : undefined;

  const points = [start, ...stops.map((s) => s.location!), ...(end && endSetting.mode === 'address' ? [end] : [])];
  const profile = profileFor(settings.vehicle);
  const matrix = await deps.getMatrix(points, profile);
  const now = deps.now();
  const startTimeSec =
    route.settings.startTime === 'now' ? now.getHours() * 3600 + now.getMinutes() * 60 : hhmmToSec(route.settings.startTime);
  const brk = route.settings.break;

  const input: SolverInput = {
    ...matrix,
    startIndex: 0,
    endIndex: endSetting.mode === 'return' ? 0 : endSetting.mode === 'address' && end ? points.length - 1 : null,
    startTimeSec,
    stops: stops.map((s, i) => ({
      matrixIndex: i + 1,
      order: s.order,
      serviceSec: Math.round(s.serviceMinutes * 60),
      windows: s.timeWindows.map((w) => [hhmmToSec(w.start), hhmmToSec(w.end)] as [number, number]),
    })),
    break: brk ? { earliestSec: hhmmToSec(brk.earliest), latestSec: hhmmToSec(brk.latest), durationSec: brk.minutes * 60 } : undefined,
  };
  return { route, stops, settings, start, end, input, profile };
}

async function saveResult(ctx: Context, result: SolverResult, deps: OptimizeDeps): Promise<void> {
  const ordered = result.sequence.map((i) => ctx.stops[i]);
  const linePoints = [ctx.start, ...ordered.map((s) => s.location!), ...(ctx.end ? [ctx.end] : [])];
  const polyline = await deps.routeLine(linePoints, ctx.profile, ctx.settings.avoidTolls).catch(() => undefined);

  // Le fermate già fatte restano in cima, nell'ordine in cui sono state fatte; le altre seguono.
  const delivered = (await listStops(ctx.route.id))
    .filter((s) => s.outcome !== 'pending')
    .sort((a, b) => (a.outcomeAt ?? 0) - (b.outcomeAt ?? 0))
    .map((s, pos) => ({ ...s, sequence: pos }));
  const offset = delivered.length;
  const updated = ordered.map((s, pos) => ({
    ...s,
    sequence: offset + pos,
    eta: secToHhmm(result.arrivals[pos]),
    displayId: ctx.settings.idMode === 'after_optimization' ? offset + pos + 1 : s.displayId,
  }));
  await putStops([...delivered, ...updated]);
  await updateRoute(ctx.route.id, {
    status: 'optimized',
    startLocation: ctx.start,
    polyline,
    totals: {
      km: Math.round(result.totalDistance / 100) / 10,
      minutes: Math.round(result.totalDuration / 60),
      endTime: secToHhmm(result.endTimeSec),
    },
  });
}

const toOutcome = (e: unknown): OptimizeOutcome => ({
  kind: 'error',
  message: e instanceof Error ? e.message : 'Ottimizzazione non riuscita',
});

/** Calcola l'ordine migliore delle fermate e lo salva. Le fermate senza posizione confermata bloccano il calcolo. */
export async function optimizeRoute(routeId: string, onStep: (s: OptimizeStep) => void, deps: OptimizeDeps): Promise<OptimizeOutcome> {
  // Prima la chiave: senza, la ricerca delle posizioni non può finire e il messaggio giusto è questo.
  if (!(await getSettings()).orsApiKey) return toOutcome(new OrsError('missing_key'));
  const todo = (await listStops(routeId)).filter((s) => s.outcome === 'pending');
  const searching = todo.filter((s) => s.geoStatus === 'pending').length;
  if (searching > 0) return { kind: 'pending_locations', count: searching };
  const missing = todo.filter((s) => s.geoStatus !== 'ok' || !s.location).length;
  if (missing > 0) return { kind: 'missing_locations', count: missing };
  try {
    onStep('analisi');
    const ctx = await buildContext(routeId, deps);
    onStep('percorso');
    const result = await deps.optimize(ctx.input);
    onStep('traffico');
    onStep('creazione');
    await saveResult(ctx, result, deps);
    return { kind: 'ok' };
  } catch (e) {
    return toOutcome(e);
  }
}

/** Inverte la sequenza attuale e ricalcola gli orari (matrice già in memoria). */
export async function reverseRoute(routeId: string, deps: OptimizeDeps): Promise<OptimizeOutcome> {
  try {
    const ctx = await buildContext(routeId, deps);
    const current = ctx.stops.map((s, i) => ({ i, seq: s.sequence ?? s.originalIndex })).sort((a, b) => a.seq - b.seq).map((x) => x.i);
    await saveResult(ctx, evaluate(ctx.input, current.reverse()), deps);
    return { kind: 'ok' };
  } catch (e) {
    return toOutcome(e);
  }
}

/** Nessun calcolo: le fermate restano nell'ordine in cui sono state aggiunte. */
export async function skipOptimization(routeId: string): Promise<void> {
  const stops = (await listStops(routeId)).sort((a, b) => a.originalIndex - b.originalIndex);
  await putStops(stops.map((s, pos) => ({ ...s, sequence: pos, eta: undefined })));
  await updateRoute(routeId, { status: 'optimized', polyline: undefined, totals: undefined });
}

export async function resetDisplayIds(routeId: string): Promise<void> {
  const stops = await listStops(routeId);
  await putStops(stops.map((s) => ({ ...s, displayId: (s.sequence ?? s.originalIndex) + 1 })));
}
