import { db } from './db';
import { addStopFromSuggestion, addStopsFromText, changeStopAddress } from './manualAdd';
import { getStop, listStops, putStop, saveCorrection } from './repos';
import { addressKey } from '../domain/address/normalize';
import type { Geocoder } from '../services/geocoder';
import { makeStop } from '../test/fixtures';

const suggestion = (precision: 'house' | 'street') => ({
  label: 'Via Esempio 12, Ragusa', precision, address: { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100' },
  location: { lat: 36.92, lng: 14.73 },
});

function geocoder(): Geocoder & { geocodeText: ReturnType<typeof vi.fn> } {
  return {
    geocode: vi.fn(),
    autocomplete: vi.fn(),
    geocodeText: vi.fn(async () => [{ precision: 'house' as const, location: { lat: 1, lng: 2 }, label: 'Via B 2, Ragusa',
      address: { street: 'Via B, 2', city: 'Ragusa', postcode: '97100' } }]),
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('suggerimento con civico → fermata trovata con quella posizione', async () => {
  const stop = await addStopFromSuggestion('r1', suggestion('house'));
  expect(stop).toMatchObject({ routeId: 'r1', geoStatus: 'ok', location: { lat: 36.92, lng: 14.73 },
    address: { street: 'Via Esempio, 12' }, originalIndex: 0, displayId: 1, packages: 1, order: 'auto' });
});

it('suggerimento senza civico preciso → da verificare', async () => {
  const stop = await addStopFromSuggestion('r1', suggestion('street'));
  expect(stop).toMatchObject({ geoStatus: 'uncertain', geoReason: 'civico non trovato, punto a metà strada' });
});

it('la memoria delle correzioni vince sul suggerimento', async () => {
  await saveCorrection(addressKey(suggestion('house').address), { lat: 5, lng: 6 }, 'x');
  expect((await addStopFromSuggestion('r1', suggestion('street'))).location).toEqual({ lat: 5, lng: 6 });
});

it('lista incollata: usa la correzione se esiste, altrimenti cerca il testo', async () => {
  await saveCorrection(addressKey({ street: 'Via A 1', city: '' }), { lat: 9, lng: 9 }, 'Via A 1');
  const g = geocoder();
  const stops = await addStopsFromText('r1', ['Via A 1', 'Via B 2'], g);
  expect(g.geocodeText).toHaveBeenCalledTimes(1);
  expect(stops[0]).toMatchObject({ location: { lat: 9, lng: 9 }, geoStatus: 'ok' });
  expect(stops[1]).toMatchObject({ location: { lat: 1, lng: 2 }, geoStatus: 'ok', address: { street: 'Via B, 2', city: 'Ragusa' } });
  expect((await listStops('r1')).map((s) => s.originalIndex)).toEqual([0, 1]);
});

it('cambia indirizzo di una fermata esistente', async () => {
  await putStop(makeStop({ id: 's1', geoStatus: 'uncertain', geoReason: 'x' }));
  await changeStopAddress('s1', suggestion('house'));
  expect(await getStop('s1')).toMatchObject({ address: { street: 'Via Esempio, 12' }, geoStatus: 'ok', geoReason: undefined });
});

describe('zona del percorso', () => {
  const milano = { ...suggestion('house'), label: 'Via Roma 10, Milano', location: { lat: 45.46, lng: 9.19 },
    address: { street: 'Via Roma, 10', city: 'Milano', postcode: '20121' } };

  it('suggerimento lontano dalle altre fermate → da verificare', async () => {
    await putStop(makeStop({ id: 'x', routeId: 'r1', location: { lat: 36.92, lng: 14.73 } }));
    expect(await addStopFromSuggestion('r1', milano)).toMatchObject({ geoStatus: 'uncertain', geoReason: 'lontano dalla zona del percorso' });
  });

  it('suggerimento vicino alle altre fermate → trovata', async () => {
    await putStop(makeStop({ id: 'x', routeId: 'r1', location: { lat: 36.92, lng: 14.73 } }));
    expect((await addStopFromSuggestion('r1', { ...suggestion('house'), location: { lat: 36.93, lng: 14.74 } })).geoStatus).toBe('ok');
  });

  it('il punto di riferimento è la prima fermata con posizione del percorso', async () => {
    const { routeFocus } = await import('./manualAdd');
    expect(await routeFocus('r1')).toBeUndefined();
    await putStop(makeStop({ id: 'x', routeId: 'r1', location: { lat: 36.92, lng: 14.73 } }));
    expect(await routeFocus('r1')).toEqual({ lat: 36.92, lng: 14.73 });
  });
});
