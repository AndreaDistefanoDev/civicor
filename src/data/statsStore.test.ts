import { db } from './db';
import { createRoute, putStops } from './repos';
import { listFailedStops, loadMonth } from './statsStore';
import { makeStop } from '../test/fixtures';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('carica i giri del mese, dal più recente, con le mancate del mese', async () => {
  const oct = await createRoute({ date: '2026-10-30' });
  const n1 = await createRoute({ date: '2026-11-02' });
  const n2 = await createRoute({ date: '2026-11-03' });
  await putStops([
    makeStop({ id: 'o', routeId: oct.id, outcome: 'failed', outcomeAt: 1 }),
    makeStop({ id: 'a', routeId: n1.id, outcome: 'done', outcomeAt: 2 }),
    makeStop({ id: 'b', routeId: n2.id, outcome: 'failed', failReason: 'refused', outcomeAt: 3 }),
  ]);
  const m = await loadMonth('2026-11');
  expect(m.days.map((d) => d.date)).toEqual(['2026-11-03', '2026-11-02']);
  expect(m.failed.map((s) => s.id)).toEqual(['b']);
  expect((await listFailedStops()).map((s) => s.id).sort()).toEqual(['b', 'o']);
});
