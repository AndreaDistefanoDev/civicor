import { db } from './db';
import { createRoute, listRoutes, saveSettings } from './repos';
import { cleanupExpiredRoutes } from './retentionStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('elimina i percorsi più vecchi della soglia impostata', async () => {
  await createRoute({ date: '2025-09-01' });
  await createRoute({ date: '2026-10-01' });
  expect(await cleanupExpiredRoutes('2026-10-20')).toBe(1);
  expect((await listRoutes()).map((r) => r.date)).toEqual(['2026-10-01']);
});

it('con la pulizia disattivata non elimina niente', async () => {
  await saveSettings({ retentionMonths: null });
  await createRoute({ date: '2020-01-01' });
  expect(await cleanupExpiredRoutes('2026-10-20')).toBe(0);
});
