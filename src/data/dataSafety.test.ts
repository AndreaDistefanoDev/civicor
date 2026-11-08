// Un aggiornamento dell'app non deve mai cancellare o rompere il giro aperto.
import Dexie from 'dexie';
import { db } from './db';
import { markOutcome, nextStop } from './outcomes';
import { createRoute, getStop, listStops } from './repos';
import { exportBackup, importBackup } from './backupStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('lo schema del database non cambia senza una migrazione', () => {
  // Se questo test fallisce: aggiungi una nuova db.version(n) (con .upgrade() se serve), non modificare le precedenti.
  expect(db.verno).toBe(2);
  expect(Object.fromEntries(db.tables.map((t) => [t.name, [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)]]))).toEqual({
    routes: ['id', 'date'],
    stops: ['id', 'routeId', '[routeId+originalIndex]', 'outcome'],
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
  const stops = await listStops(route.id);
  expect(nextStop(stops)?.id).toBe('b');
  expect((await getStop('a'))?.failReason).toBe('not_home');
});

it('la copia di sicurezza conserva i dati nuovi (telefono, motivo, posizione nel furgone)', async () => {
  const route = await createRoute({ date: '2026-11-07' });
  await db.stops.put({
    id: 'x', routeId: route.id, address: { street: 'Via Esempio, 12', city: 'Ragusa' }, trackingNumbers: [], packages: 1,
    order: 'auto', kind: 'delivery', timeWindows: [], serviceMinutes: 1, stopTypeId: 'standard', geoStatus: 'ok',
    originalIndex: 0, displayId: 1, outcome: 'failed', failReason: 'refused', attempt: 2, phone: '3331234567',
    findPackage: { positions: ['back'] }, createdAt: 1,
  });
  const file = await exportBackup();
  await db.delete();
  await db.open();
  await importBackup(JSON.parse(JSON.stringify(file)));
  expect(await getStop('x')).toMatchObject({
    failReason: 'refused', attempt: 2, phone: '3331234567', findPackage: { positions: ['back'] },
  });
});

it('passando dalla versione 1 alla 2 del database il giro aperto resta intatto', async () => {
  db.close();
  await Dexie.delete('civicor');
  const v1 = new Dexie('civicor');
  v1.version(1).stores({
    routes: 'id, date', stops: 'id, routeId, [routeId+originalIndex]', stopTypes: 'id, position',
    corrections: 'key', settings: 'id', unreadableCodes: '++id, createdAt',
  });
  await v1.open();
  await v1.table('routes').put({ id: 'r', name: 'Giro', date: '2026-11-07', createdAt: 1, status: 'in_progress',
    settings: { start: { mode: 'current' }, startTime: 'now', end: { mode: 'return' } } });
  await v1.table('stops').bulkPut([
    { id: 'a', routeId: 'r', address: { street: 'Via A, 1', city: 'Ragusa' }, outcome: 'failed', originalIndex: 0, displayId: 1 },
    { id: 'b', routeId: 'r', address: { street: 'Via B, 2', city: 'Ragusa' }, outcome: 'pending', originalIndex: 1, displayId: 2 },
  ]);
  v1.close();

  await db.open();
  expect(db.verno).toBe(2);
  expect((await db.routes.get('r'))?.status).toBe('in_progress');
  expect(await db.stops.count()).toBe(2);
  expect((await db.stops.where('outcome').equals('failed').toArray()).map((s) => s.id)).toEqual(['a']);
});
