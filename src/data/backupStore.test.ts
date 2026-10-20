import { db } from './db';
import { exportBackup, importBackup } from './backupStore';
import { createRoute, getCorrection, getSettings, listRoutes, putStop, saveCorrection, saveSettings, saveUnreadableCode } from './repos';
import { validateBackup } from '../domain/backup/backup';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('backup: andata e ritorno senza chiave ORS', async () => {
  const r = await createRoute({ date: '2026-10-19' });
  await putStop({
    id: 's1', routeId: r.id, address: { street: 'Via Esempio, 12', city: 'Ragusa' }, trackingNumbers: [], packages: 1,
    order: 'auto', kind: 'delivery', timeWindows: [], serviceMinutes: 1, stopTypeId: 'standard', geoStatus: 'ok',
    originalIndex: 0, displayId: 1, outcome: 'pending', createdAt: 1,
  });
  await saveCorrection('via esempio 12|97100', { lat: 1, lng: 2 }, 'Via Esempio, 12');
  await saveSettings({ navApp: 'google', orsApiKey: 'segreta', googleApiKey: 'segreta-google' });
  await saveUnreadableCode('codice strano');

  const file = await exportBackup();
  expect(file.settings).not.toHaveProperty('orsApiKey');
  expect(file.settings).not.toHaveProperty('googleApiKey');
  expect(JSON.stringify(file)).not.toContain('segreta');
  expect(file.unreadableCodes).toEqual(['codice strano']);
  const json = JSON.parse(JSON.stringify(file));

  await db.delete();
  await db.open();
  const counts = await importBackup(validateBackup(json));

  expect(counts).toEqual({ routes: 1, corrections: 1 });
  expect(await listRoutes()).toHaveLength(1);
  expect(await getCorrection('via esempio 12|97100')).toEqual({ lat: 1, lng: 2 });
  expect((await getSettings()).navApp).toBe('google');
  expect((await getSettings()).orsApiKey).toBeUndefined();
});

it('importare non cancella la chiave ORS già inserita', async () => {
  await saveSettings({ orsApiKey: 'mia' });
  const file = await exportBackup();
  await importBackup(file);
  expect((await getSettings()).orsApiKey).toBe('mia');
});
