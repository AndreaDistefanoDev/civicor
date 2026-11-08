import { db } from './db';
import { applyAddedStops, discardAddedStops, listAddedStops } from './addedStops';
import { createRoute, listStops, putStops } from './repos';
import { makeStop } from '../test/fixtures';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const at = (lat: number) => ({ lat, lng: 14 });

it('le fermate aggiunte dopo l\'ottimizzazione sono quelle senza ordine', async () => {
  const r = await createRoute({ date: '2026-11-08' });
  await putStops([makeStop({ id: 'a', routeId: r.id, sequence: 0 }), makeStop({ id: 'n', routeId: r.id, originalIndex: 1 })]);
  expect((await listAddedStops(r.id)).map((s) => s.id)).toEqual(['n']);
});

it('Aggiorna percorso: le nuove entrano nel punto migliore, le altre non si spostano', async () => {
  const r = await createRoute({ date: '2026-11-08' });
  await putStops([
    makeStop({ id: 'a', routeId: r.id, sequence: 0, location: at(36.0), outcome: 'done' }),
    makeStop({ id: 'b', routeId: r.id, sequence: 1, location: at(36.02), originalIndex: 1 }),
    makeStop({ id: 'c', routeId: r.id, sequence: 2, location: at(36.04), originalIndex: 2 }),
    makeStop({ id: 'x', routeId: r.id, location: at(36.03), originalIndex: 3 }),
  ]);
  expect(await applyAddedStops(r.id)).toBe(1);
  const order = (await listStops(r.id)).sort((p, q) => p.sequence! - q.sequence!).map((s) => s.id);
  expect(order).toEqual(['a', 'b', 'x', 'c']);
});

it('Elimina: toglie solo le fermate aggiunte', async () => {
  const r = await createRoute({ date: '2026-11-08' });
  await putStops([makeStop({ id: 'a', routeId: r.id, sequence: 0 }), makeStop({ id: 'n', routeId: r.id, originalIndex: 1 })]);
  await discardAddedStops(r.id);
  expect((await listStops(r.id)).map((s) => s.id)).toEqual(['a']);
});
