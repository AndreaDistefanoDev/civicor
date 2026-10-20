import type { BackupFile } from '../domain/backup/backup';
import { db } from './db';
import { getSettings, listUnreadableCodes, saveSettings } from './repos';

export async function exportBackup(): Promise<BackupFile> {
  // Le chiavi dei servizi restano solo sul telefono: mai nei backup.
  const { orsApiKey: _ors, googleApiKey: _google, ...settings } = await getSettings();
  const corrections = (await db.corrections.toArray()).map(({ key, location, label }) => ({ key, location, label }));
  return {
    app: 'civicor',
    version: 1,
    exportedAt: new Date().toISOString(),
    routes: await db.routes.toArray(),
    stops: await db.stops.toArray(),
    stopTypes: await db.stopTypes.toArray(),
    corrections,
    unreadableCodes: await listUnreadableCodes(),
    settings,
  };
}

/** Unisce il backup ai dati presenti: a parità di id vince il file. La chiave ORS resta quella attuale. */
export async function importBackup(file: BackupFile): Promise<{ routes: number; corrections: number }> {
  const now = Date.now();
  await db.transaction('rw', [db.routes, db.stops, db.stopTypes, db.corrections, db.unreadableCodes], async () => {
    await db.routes.bulkPut(file.routes);
    await db.stops.bulkPut(file.stops);
    await db.stopTypes.bulkPut(file.stopTypes);
    await db.corrections.bulkPut(file.corrections.map((c) => ({ ...c, updatedAt: now })));
    const existing = new Set((await db.unreadableCodes.toArray()).map((r) => r.payload));
    await db.unreadableCodes.bulkAdd(
      file.unreadableCodes.filter((p) => !existing.has(p)).map((payload) => ({ payload, createdAt: now })),
    );
  });
  const { orsApiKey: _ors, googleApiKey: _google, ...settings } = file.settings as BackupFile['settings'] & {
    orsApiKey?: string;
    googleApiKey?: string;
  };
  await saveSettings(settings);
  return { routes: file.routes.length, corrections: file.corrections.length };
}
