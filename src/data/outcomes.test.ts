import { db } from './db';
import { completeRoute, markOutcome, nextStop, postponeStop, routeSummary, undoOutcome, upcomingStops } from './outcomes';
import { createRoute, getRoute, getStop, putStop } from './repos';
import { makeStop } from '../test/fixtures';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('Effettuata è salvata subito e restituisce lo stato precedente', async () => {
  await putStop(makeStop({ id: 's1' }));
  expect((await markOutcome('s1', 'done')).previous).toMatchObject({ outcome: 'pending' });
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

it('Non riuscita salva il motivo e il tentativo; Annulla li toglie', async () => {
  await putStop(makeStop({ id: 's1' }));
  const { previous } = await markOutcome('s1', 'failed', { failReason: 'not_home', attempt: 2 });
  expect(await getStop('s1')).toMatchObject({ outcome: 'failed', failReason: 'not_home', attempt: 2 });
  await undoOutcome('s1', previous);
  const back = await getStop('s1');
  expect(back).toMatchObject({ outcome: 'pending' });
  expect(back?.failReason).toBeUndefined();
  expect(back?.attempt).toBeUndefined();
});

it('Effettuata con contrassegno registra contanti o POS; Annulla torna a "da incassare"', async () => {
  await putStop(makeStop({ id: 's1', cod: { amount: 25 } }));
  const { previous } = await markOutcome('s1', 'done', { codMethod: 'pos' });
  expect((await getStop('s1'))?.cod).toEqual({ amount: 25, method: 'pos' });
  await undoOutcome('s1', previous);
  expect((await getStop('s1'))?.cod).toEqual({ amount: 25 });
});

it('Effettuata cancella un vecchio motivo di mancata consegna', async () => {
  await putStop(makeStop({ id: 's1', outcome: 'failed', failReason: 'refused', attempt: 1 }));
  await markOutcome('s1', 'done');
  const s = await getStop('s1');
  expect(s?.failReason).toBeUndefined();
  expect(s?.attempt).toBeUndefined();
});

it('Riprova più tardi sposta la fermata in fondo senza toccare l\'ordine delle altre', async () => {
  await putStop(makeStop({ id: 'a', sequence: 0, eta: '08:00' }));
  await putStop(makeStop({ id: 'b', sequence: 1, eta: '08:10' }));
  await putStop(makeStop({ id: 'c', sequence: 2, eta: '08:20' }));
  await postponeStop('a');
  const [a, b, c] = await Promise.all(['a', 'b', 'c'].map(getStop));
  expect(b?.sequence).toBe(1);
  expect(c?.sequence).toBe(2);
  expect(a?.sequence).toBe(3);
  expect(a?.eta).toBeUndefined();
  expect(nextStop([a!, b!, c!])?.id).toBe('b');
});

it('le prossime fermate dopo quella attuale, nell\'ordine', () => {
  const stops = [
    makeStop({ id: 'a', sequence: 0, outcome: 'done' }),
    makeStop({ id: 'b', sequence: 1 }),
    makeStop({ id: 'c', sequence: 2 }),
    makeStop({ id: 'd', sequence: 3, outcome: 'failed' }),
    makeStop({ id: 'e', sequence: 4 }),
    makeStop({ id: 'f', sequence: 5 }),
  ];
  expect(upcomingStops(stops, 'b', 2).map((s) => s.id)).toEqual(['c', 'e']);
});
