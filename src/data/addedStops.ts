import { insertStops } from '../domain/optimize/insertion';
import type { Stop } from '../domain/types';
import { deleteStops, listStops, putStops } from './repos';

/** Fermate aggiunte a un percorso già ottimizzato: non hanno ancora un posto nell'ordine. */
export async function listAddedStops(routeId: string): Promise<Stop[]> {
  return (await listStops(routeId)).filter((s) => s.sequence === undefined).sort((a, b) => a.originalIndex - b.originalIndex);
}

/** "Aggiorna percorso": inserisce le fermate aggiunte senza riordinare le altre. Restituisce quante. */
export async function applyAddedStops(routeId: string): Promise<number> {
  const stops = await listStops(routeId);
  const existing = stops.filter((s) => s.sequence !== undefined).sort((a, b) => a.sequence! - b.sequence!);
  const added = stops.filter((s) => s.sequence === undefined).sort((a, b) => a.originalIndex - b.originalIndex);
  if (added.length === 0) return 0;
  // Le fermate già chiuse restano davanti: le nuove vanno dopo l'ultima chiusa.
  const fixed = existing.reduce((n, s, i) => (s.outcome !== 'pending' ? i + 1 : n), 0);
  const byId = new Map(stops.map((s) => [s.id, s]));
  const order = insertStops(existing, added, fixed);
  await putStops(order.map((id, i) => ({ ...byId.get(id)!, sequence: i })));
  return added.length;
}

/** "Elimina": toglie le fermate aggiunte e non ancora applicate. */
export async function discardAddedStops(routeId: string): Promise<void> {
  await deleteStops((await listAddedStops(routeId)).map((s) => s.id));
}
