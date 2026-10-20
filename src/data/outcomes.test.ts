import { db } from './db';
import { completeRoute, markOutcome, nextStop, routeSummary, undoOutcome } from './outcomes';
import { createRoute, getRoute, getStop, putStop } from './repos';
import { makeStop } from '../test/fixtures';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('Effettuata è salvata subito e restituisce lo stato precedente', async () => {
  await putStop(makeStop({ id: 's1' }));
  expect(await markOutcome('s1', 'done')).toEqual({ previous: 'pending' });
  expect(await getStop('s1')).toMatchObject({ outcome: 'done' });
  expect((await getStop('s1'))?.outcomeAt).toBeGreaterThan(0);
});

it('Annulla riporta allo stato precedente', async () => {
  await putStop(makeStop({ id: 's1' }));
  const { previous } = await markOutcome('s1', 'failed');
  await undoOutcome('s1', previous);
  expect(await getStop('s1')).toMatchObject({ outcome: 'pending', outcomeAt: undefined });
});

it('la prossima fermata è la prima da fare nella sequenza', () => {
  const stops = [
    makeStop({ id: 'a', sequence: 2 }),
    makeStop({ id: 'b', sequence: 0, outcome: 'done' }),
    makeStop({ id: 'c', sequence: 1 }),
  ];
  expect(nextStop(stops)?.id).toBe('c');
  expect(nextStop(stops.map((s) => ({ ...s, outcome: 'done' as const })))).toBeUndefined();
});

it('riepilogo del percorso', () => {
  const stops = [makeStop({ outcome: 'done' }), makeStop({ outcome: 'done' }), makeStop({ outcome: 'failed' }), makeStop()];
  expect(routeSummary(stops)).toEqual({ done: 2, failed: 1, pending: 1 });
});

it('completare il percorso cambia lo stato', async () => {
  const r = await createRoute({ date: '2026-10-20' });
  await completeRoute(r.id);
  expect((await getRoute(r.id))?.status).toBe('completed');
});
