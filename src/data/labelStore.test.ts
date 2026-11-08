import { db } from './db';
import { addLabelStop } from './labelStore';
import { createRoute, listStops } from './repos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const label = { role: 'recipient' as const, recipient: 'Mario Rossi', street: 'Via Roma 10', postcode: '97100', city: 'Ragusa', province: 'RG', phone: '3331234567' };

it('aggiunge la fermata subito, con nome e telefono, in attesa della posizione', async () => {
  const r = await createRoute({ date: '2026-11-07' });
  const out = await addLabelStop(r.id, label);
  expect(out.kind).toBe('added');
  expect(out.stop).toMatchObject({
    routeId: r.id, recipient: 'Mario Rossi', phone: '3331234567', geoStatus: 'pending', packages: 1, displayId: 1,
    address: { street: 'Via Roma 10', city: 'Ragusa', postcode: '97100', province: 'RG' },
  });
});

it('stesso indirizzo nello stesso giro: un pacco in più sulla stessa fermata', async () => {
  const r = await createRoute({ date: '2026-11-07' });
  await addLabelStop(r.id, label);
  const out = await addLabelStop(r.id, { ...label, street: 'VIA ROMA, 10', phone: undefined });
  expect(out.kind).toBe('merged');
  const stops = await listStops(r.id);
  expect(stops).toHaveLength(1);
  expect(stops[0].packages).toBe(2);
  expect(stops[0].phone).toBe('3331234567');
});

it('con il numero di spedizione: lo salva sulla fermata e non aggiunge due volte lo stesso pacco', async () => {
  const r = await createRoute({ date: '2026-11-07' });
  const first = await addLabelStop(r.id, label, 'AB123456789IT');
  expect(first.stop.trackingNumbers).toEqual(['AB123456789IT']);
  const again = await addLabelStop(r.id, { ...label, street: 'Via Altra, 5' }, 'AB123456789IT');
  expect(again.kind).toBe('duplicate');
  expect(await listStops(r.id)).toHaveLength(1);
});
