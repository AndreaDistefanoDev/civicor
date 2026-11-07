// Un aggiornamento dell'app non deve mai cancellare o rompere il giro aperto.
import { db } from './db';
import { markOutcome, nextStop, postponeStop } from './outcomes';
import { createRoute, getStop, listStops } from './repos';
import { exportBackup, importBackup } from './backupStore';
import { codTotals } from '../domain/cod/cod';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('lo schema del database non cambia senza una migrazione', () => {
  // Se questo test fallisce: aggiungi una nuova db.version(n) con .upgrade(), non modificare la versione 1.
  expect(db.verno).toBe(1);
  expect(Object.fromEntries(db.tables.map((t) => [t.name, [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)]]))).toEqual({
    routes: ['id', 'date'],
    stops: ['id', 'routeId', '[routeId+originalIndex]'],
    stopTypes: ['id', 'position'],
    corrections: ['key'],
    settings: ['id'],
    unreadableCodes: ['++id', 'createdAt'],
  });
});

it('un giro salvato dalla versione precedente (senza i campi nuovi) funziona con la versione nuova', async () => {
  const route = await createRoute({ date: '2026-11-07' });
  // Fermate come le salvava la versione pubblicata: niente telefono, contrassegno, motivo o tentativo.
  const old = (id: string, sequence: number) => ({
    id, routeId: route.id, address: { street: `Via Vecchia, ${sequence + 1}`, city: 'Ragusa' }, trackingNumbers: [], packages: 1,
    order: 'auto', kind: 'delivery', timeWindows: [], serviceMinutes: 1, stopTypeId: 'standard', geoStatus: 'ok',
    location: { lat: 36.9, lng: 14.7 }, originalIndex: sequence, sequence, displayId: sequence + 1, outcome: 'pending', createdAt: 1,
  });
  await db.stops.bulkPut([old('a', 0), old('b', 1), old('c', 2)] as never);

  await markOutcome('a', 'failed', { failReason: 'not_home', attempt: 1 });
  await postponeStop('b');
  const stops = await listStops(route.id);
  expect(nextStop(stops)?.id).toBe('c');
  expect(codTotals(stops).count).toBe(0);
  expect((await getStop('a'))?.failReason).toBe('not_home');
});

it('la copia di sicurezza conserva i dati nuovi (telefono, contrassegno, motivo, posizione nel furgone)', async () => {
  const route = await createRoute({ date: '2026-11-07' });
  await db.stops.put({
    id: 'x', routeId: route.id, address: { street: 'Via Esempio, 12', city: 'Ragusa' }, trackingNumbers: [], packages: 1,
    order: 'auto', kind: 'delivery', timeWindows: [], serviceMinutes: 1, stopTypeId: 'standard', geoStatus: 'ok',
    originalIndex: 0, displayId: 1, outcome: 'failed', failReason: 'refused', attempt: 2, phone: '3331234567',
    cod: { amount: 12.5 }, findPackage: { positions: ['back'] }, createdAt: 1,
  });
  const file = await exportBackup();
  await db.delete();
  await db.open();
  await importBackup(JSON.parse(JSON.stringify(file)));
  expect(await getStop('x')).toMatchObject({
    failReason: 'refused', attempt: 2, phone: '3331234567', cod: { amount: 12.5 }, findPackage: { positions: ['back'] },
  });
});
