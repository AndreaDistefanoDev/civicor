import type { CodMethod, FailReason, Stop } from '../domain/types';
import { getStop, listStops, patchStop, putStop, updateRoute } from './repos';

/** Quello che un esito cambia nella fermata: serve ad Annulla per rimettere tutto com'era. */
export type OutcomeSnapshot = Pick<Stop, 'outcome' | 'outcomeAt' | 'failReason' | 'attempt' | 'cod'>;

const snapshot = (s: Stop): OutcomeSnapshot => ({
  outcome: s.outcome, outcomeAt: s.outcomeAt, failReason: s.failReason, attempt: s.attempt, cod: s.cod,
});

/** Segna l'esito subito (sopravvive a una chiusura dell'app) e restituisce lo stato precedente per Annulla. */
export async function markOutcome(
  stopId: string,
  outcome: 'done' | 'failed',
  extra: { failReason?: FailReason; attempt?: 1 | 2; codMethod?: CodMethod } = {},
): Promise<{ previous: OutcomeSnapshot }> {
  const stop = await getStop(stopId);
  if (!stop) throw new Error('Fermata non trovata');
  const failed = outcome === 'failed';
  await putStop({
    ...stop,
    outcome,
    outcomeAt: Date.now(),
    failReason: failed ? extra.failReason : undefined,
    attempt: failed ? extra.attempt : undefined,
    cod: stop.cod && { amount: stop.cod.amount, method: failed ? undefined : extra.codMethod },
  });
  return { previous: snapshot(stop) };
}

export async function undoOutcome(stopId: string, previous: OutcomeSnapshot): Promise<void> {
  const stop = await getStop(stopId);
  if (stop) await putStop({ ...stop, ...previous });
}

const order = (s: Stop) => s.sequence ?? s.originalIndex;

/** "Riprova più tardi": la fermata va in fondo, l'ordine delle altre (e del furgone) non cambia. */
export async function postponeStop(stopId: string): Promise<Pick<Stop, 'sequence' | 'eta'> | undefined> {
  const stop = await getStop(stopId);
  if (!stop) return undefined;
  const last = (await listStops(stop.routeId)).reduce((m, s) => Math.max(m, order(s)), 0);
  await patchStop(stopId, { sequence: last + 1, eta: undefined });
  return { sequence: stop.sequence, eta: stop.eta };
}

/** Le prossime n fermate da fare dopo quella indicata. */
export function upcomingStops(stops: Stop[], afterId: string, n: number): Stop[] {
  const sorted = [...stops].sort((a, b) => order(a) - order(b));
  const from = sorted.findIndex((s) => s.id === afterId);
  return sorted.slice(from + 1).filter((s) => s.outcome === 'pending').slice(0, n);
}

export function nextStop(stops: Stop[]): Stop | undefined {
  return [...stops].sort((a, b) => order(a) - order(b)).find((s) => s.outcome === 'pending');
}

export function routeSummary(stops: Stop[]): { done: number; failed: number; pending: number } {
  return {
    done: stops.filter((s) => s.outcome === 'done').length,
    failed: stops.filter((s) => s.outcome === 'failed').length,
    pending: stops.filter((s) => s.outcome === 'pending').length,
  };
}

export async function completeRoute(routeId: string): Promise<void> {
  await updateRoute(routeId, { status: 'completed' });
}
