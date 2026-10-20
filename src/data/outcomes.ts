import type { Stop, StopOutcome } from '../domain/types';
import { getStop, putStop, updateRoute } from './repos';

/** Segna l'esito subito (sopravvive a una chiusura dell'app) e restituisce lo stato precedente per Annulla. */
export async function markOutcome(stopId: string, outcome: 'done' | 'failed'): Promise<{ previous: StopOutcome }> {
  const stop = await getStop(stopId);
  if (!stop) throw new Error('Fermata non trovata');
  await putStop({ ...stop, outcome, outcomeAt: Date.now() });
  return { previous: stop.outcome };
}

export async function undoOutcome(stopId: string, previous: StopOutcome): Promise<void> {
  const stop = await getStop(stopId);
  if (stop) await putStop({ ...stop, outcome: previous, outcomeAt: previous === 'pending' ? undefined : stop.outcomeAt });
}

const order = (s: Stop) => s.sequence ?? s.originalIndex;

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
