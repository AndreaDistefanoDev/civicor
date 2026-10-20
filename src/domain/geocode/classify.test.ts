import { classifyGeocode } from './classify';
import type { GeocodeHit, GeoPrecision } from '../../services/geocoder';

const hit = (precision: GeoPrecision, lat = 36.92, lng = 14.73): GeocodeHit => ({
  precision, location: { lat, lng }, label: 'x',
});

it('civico trovato → ok', () => {
  expect(classifyGeocode([hit('house')], true)).toEqual({ status: 'ok', location: { lat: 36.92, lng: 14.73 } });
});

it('solo via quando serviva il civico → incerta', () => {
  expect(classifyGeocode([hit('street')], true)).toMatchObject({
    status: 'uncertain', reason: 'civico non trovato, punto a metà strada', location: { lat: 36.92, lng: 14.73 },
  });
});

it('via senza civico richiesto → ok', () => {
  expect(classifyGeocode([hit('street')], false).status).toBe('ok');
});

it('solo località → incerta', () => {
  expect(classifyGeocode([hit('locality')], true).reason).toBe('trovata solo la località');
});

it('primi due risultati a più di 500 m → incerta', () => {
  expect(classifyGeocode([hit('house'), hit('house', 36.95, 14.73)], true).reason).toBe('più risultati in posti diversi');
});

it('primi due risultati vicini → ok', () => {
  expect(classifyGeocode([hit('house'), hit('house', 36.9201, 14.7301)], true).status).toBe('ok');
});

it('nessun risultato → fallita', () => {
  expect(classifyGeocode([], true)).toEqual({ status: 'failed', reason: 'indirizzo non trovato' });
});

describe('risultato in un altro comune', () => {
  const expected = { street: 'Via Roma, 10', city: 'Ragusa', postcode: '97100' };
  const withAddr = (postcode: string, city: string): GeocodeHit => ({
    ...hit('house'), address: { street: 'Via Roma, 10', city, postcode } });

  it('CAP diverso da quello dell\'etichetta → incerta', () => {
    expect(classifyGeocode([withAddr('97015', 'Modica')], true, expected)).toMatchObject({
      status: 'uncertain', reason: 'risultato in un altro comune' });
  });
  it('stesso CAP → ok', () => {
    expect(classifyGeocode([withAddr('97100', 'Ragusa')], true, expected).status).toBe('ok');
  });
  it('senza CAP confronta il comune, ignorando maiuscole e accenti', () => {
    const noCap = { street: 'Via Roma, 10', city: 'RAGUSA' };
    expect(classifyGeocode([withAddr('97100', 'Ragusa')], true, noCap).status).toBe('ok');
    expect(classifyGeocode([withAddr('97015', 'Modica')], true, noCap).reason).toBe('risultato in un altro comune');
  });
  it('risultato senza indirizzo → nessun confronto', () => {
    expect(classifyGeocode([hit('house')], true, expected).status).toBe('ok');
  });
});
