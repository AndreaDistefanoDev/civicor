import { db } from './db';
import { createRoute, listStops } from './repos';
import { recordScan } from './scanStore';
import type { GlsLabel } from '../domain/types';

const label: GlsLabel = {
  trackingNumber: 'ZZ123456789010RG', recipient: 'mario rossi', street: 'Via Esempio, 12',
  city: 'Ragusa', postcode: '97100', province: 'RG',
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('recordScan salva prima di restituire (sopravvive a un ricaricamento)', async () => {
  const route = await createRoute({ date: '2026-10-19' });
  const outcome = await recordScan(route.id, label);
  expect(outcome.kind).toBe('added');
  expect(await listStops(route.id)).toHaveLength(1);
});

it('recordScan riconosce il doppione già salvato', async () => {
  const route = await createRoute({ date: '2026-10-19' });
  await recordScan(route.id, label);
  expect((await recordScan(route.id, label)).kind).toBe('duplicate');
  expect(await listStops(route.id)).toHaveLength(1);
});

it('due etichette con lo stesso indirizzo lette insieme → una fermata con 2 pacchi', async () => {
  const route = await createRoute({ date: '2026-10-19' });
  await Promise.all([recordScan(route.id, label), recordScan(route.id, { ...label, trackingNumber: 'ZZ999999999010RG' })]);
  const stops = await listStops(route.id);
  expect(stops).toHaveLength(1);
  expect(stops[0]).toMatchObject({ packages: 2 });
  expect(stops[0].trackingNumbers).toHaveLength(2);
});

it('unire un pacco non cancella la posizione già trovata', async () => {
  const route = await createRoute({ date: '2026-10-19' });
  const first = await recordScan(route.id, label);
  const id = first.kind === 'added' ? first.stop.id : '';
  const { patchStop } = await import('./repos');
  await patchStop(id, { geoStatus: 'ok', location: { lat: 1, lng: 2 } });
  await recordScan(route.id, { ...label, trackingNumber: 'ZZ999999999010RG' });
  expect((await listStops(route.id))[0]).toMatchObject({ geoStatus: 'ok', location: { lat: 1, lng: 2 }, packages: 2 });
});
