import { applyScan, type ScanOutcome } from '../domain/scan/applyScan';
import type { GlsLabel } from '../domain/types';
import { db } from './db';
import { getSettings, listStops, newId } from './repos';

/**
 * Applica un'etichetta letta e la salva subito, prima di qualsiasi feedback.
 * In una transazione: due letture ravvicinate non si sovrascrivono a vicenda.
 */
export async function recordScan(routeId: string, label: GlsLabel): Promise<ScanOutcome> {
  const { defaultServiceMinutes } = await getSettings();
  return db.transaction('rw', db.stops, async () => {
    const stops = await listStops(routeId);
    const outcome = applyScan(stops, label, {
      routeId,
      now: Date.now(),
      newId,
      serviceMinutes: defaultServiceMinutes,
      stopTypeId: 'standard',
    });
    if (outcome.kind === 'added') await db.stops.add(outcome.stop);
    if (outcome.kind === 'merged') {
      await db.stops.update(outcome.stop.id, { packages: outcome.stop.packages, trackingNumbers: outcome.stop.trackingNumbers });
    }
    return outcome;
  });
}
