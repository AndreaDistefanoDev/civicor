import type { Stop } from '../domain/types';
import { deleteStops, getStop, listStops, newId, patchStop, putStop } from './repos';

export async function updateStop(id: string, patch: Partial<Stop>): Promise<void> {
  await patchStop(id, patch);
}

/** Copia la fermata in fondo al percorso, da fare e senza ordine calcolato. */
export async function duplicateStop(id: string): Promise<Stop | undefined> {
  const stop = await getStop(id);
  if (!stop) return undefined;
  const stops = await listStops(stop.routeId);
  const originalIndex = stops.reduce((m, s) => Math.max(m, s.originalIndex + 1), 0);
  const copy: Stop = {
    ...structuredClone(stop),
    id: newId(),
    originalIndex,
    displayId: originalIndex + 1,
    outcome: 'pending',
    outcomeAt: undefined,
    sequence: undefined,
    eta: undefined,
    trackingNumbers: [],
    createdAt: Date.now(),
  };
  await putStop(copy);
  return copy;
}

export async function removeStop(id: string): Promise<void> {
  await deleteStops([id]);
}
