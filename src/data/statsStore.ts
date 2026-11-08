import { daySummary } from '../domain/stats/stats';
import type { Stop } from '../domain/types';
import { db } from './db';

/** I giri di un mese ('YYYY-MM'), dal più recente, con le fermate mancate del mese. */
export async function loadMonth(month: string) {
  const routes = (await db.routes.where('date').startsWith(month).toArray()).sort((a, b) => b.date.localeCompare(a.date));
  const stops = await db.stops.where('routeId').anyOf(routes.map((r) => r.id)).toArray();
  const byRoute = new Map<string, Stop[]>();
  for (const s of stops) byRoute.set(s.routeId, [...(byRoute.get(s.routeId) ?? []), s]);
  return {
    days: routes.map((r) => daySummary(r, byRoute.get(r.id) ?? [])),
    failed: stops.filter((s) => s.outcome === 'failed'),
  };
}

/** Tutte le consegne mancate salvate (restano quanto i giri: vedi "Elimina percorsi più vecchi di"). */
export function listFailedStops(): Promise<Stop[]> {
  return db.stops.where('outcome').equals('failed').toArray();
}
