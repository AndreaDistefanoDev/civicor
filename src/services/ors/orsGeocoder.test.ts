import { createOrsGeocoder } from './orsGeocoder';
import { OrsError } from './orsClient';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const feature = (layer: string, lng: number, lat: number, extra: Record<string, string> = {}) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: { layer, label: 'Via Esempio 12, Ragusa, RG, Italia', street: 'Via Esempio', housenumber: '12',
    locality: 'Ragusa', postalcode: '97100', region_a: 'RG', ...extra },
});

const address = { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100' };

it('senza chiave → OrsError missing_key, nessuna chiamata di rete', async () => {
  const g = createOrsGeocoder(async () => undefined);
  await expect(g.geocode(address)).rejects.toMatchObject({ reason: 'missing_key',
    message: 'Inserisci la chiave OpenRouteService nelle Impostazioni.' });
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([
  [401, 'bad_key', 'La chiave OpenRouteService non è valida.'],
  [403, 'bad_key', 'La chiave OpenRouteService non è valida.'],
  [429, 'quota', 'Limite giornaliero di OpenRouteService raggiunto. Riprova più tardi.'],
  [500, 'server', 'OpenRouteService non risponde.'],
])('HTTP %i → OrsError %s', async (status, reason, message) => {
  fetchMock.mockReturnValue(json(status, { error: 'x' }));
  const err = await createOrsGeocoder(async () => 'k').geocode(address).catch((e) => e);
  expect(err).toBeInstanceOf(OrsError);
  expect(err).toMatchObject({ reason, message });
});

it('fetch rifiutato → OrsError network', async () => {
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
  await expect(createOrsGeocoder(async () => 'k').geocode(address)).rejects.toMatchObject({
    reason: 'network', message: 'Nessuna connessione.' });
});

it('ricerca strutturata in Italia e precisione house da layer address', async () => {
  fetchMock.mockReturnValue(json(200, { features: [feature('address', 14.73091, 36.92587)] }));
  const hits = await createOrsGeocoder(async () => 'k').geocode(address, { lat: 36.9, lng: 14.7 });
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.origin).toBe('https://api.heigit.org');
  expect(url.pathname).toBe('/pelias/v1/search/structured');
  expect(url.searchParams.get('country')).toBe('IT');
  expect(url.searchParams.get('address')).toBe('Via Esempio, 12');
  expect(url.searchParams.get('locality')).toBe('Ragusa');
  expect(url.searchParams.get('postalcode')).toBe('97100');
  expect(url.searchParams.get('api_key')).toBe('k');
  expect(url.searchParams.get('focus.point.lat')).toBe('36.9');
  expect(hits).toEqual([{ location: { lat: 36.92587, lng: 14.73091 }, precision: 'house',
    label: 'Via Esempio 12, Ragusa, RG, Italia',
    address: { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100', province: 'RG' } }]);
});

it('mappa i layer di Pelias in precisioni', async () => {
  fetchMock.mockReturnValue(json(200, { features: [
    feature('street', 1, 2), feature('locality', 1, 2), feature('venue', 1, 2)] }));
  const hits = await createOrsGeocoder(async () => 'k').geocodeText('via esempio ragusa');
  expect(hits.map((h) => h.precision)).toEqual(['street', 'locality', 'unknown']);
  expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/pelias/v1/search');
  expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('boundary.country')).toBe('IT');
});

it('autocompletamento restituisce suggerimenti con indirizzo', async () => {
  fetchMock.mockReturnValue(json(200, { features: [feature('address', 14.73, 36.92)] }));
  const s = await createOrsGeocoder(async () => 'k').autocomplete('via esem');
  expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/pelias/v1/autocomplete');
  expect(s[0]).toMatchObject({ label: 'Via Esempio 12, Ragusa, RG, Italia', precision: 'house',
    address: { street: 'Via Esempio, 12', city: 'Ragusa' } });
});

describe('suggerimenti vicini alla posizione', () => {
  const me = { lat: 36.925, lng: 14.73 };
  const far = feature('address', 9.19, 45.46, { label: 'Via Roma 20, Milano' });
  const near = feature('address', 14.731, 36.926, { label: 'Via Roma 20, Ragusa' });

  it('cerca prima entro 50 km e ordina dal più vicino', async () => {
    fetchMock.mockReturnValue(json(200, { features: [far, near] }));
    const s = await createOrsGeocoder(async () => 'k').autocomplete('via roma 20', me);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('boundary.circle.lat')).toBe('36.925');
    expect(url.searchParams.get('boundary.circle.lon')).toBe('14.73');
    expect(url.searchParams.get('boundary.circle.radius')).toBe('50');
    expect(s.map((x) => x.label)).toEqual(['Via Roma 20, Ragusa', 'Via Roma 20, Milano']);
    expect(s[0].distanceMeters).toBeLessThan(200);
  });

  it('se vicino non trova niente cerca in tutta Italia', async () => {
    fetchMock.mockReturnValueOnce(json(200, { features: [] })).mockReturnValueOnce(json(200, { features: [far] }));
    const s = await createOrsGeocoder(async () => 'k').autocomplete('via roma 20', me);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('boundary.circle.lat')).toBeNull();
    expect(s.map((x) => x.label)).toEqual(['Via Roma 20, Milano']);
  });
});
