import { createGoogleGeocoder } from './googleGeocoder';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

// Risposta Geocoding inventata con la stessa forma di quella di Google.
const geoResult = (locationType: string, types: string[], number?: string) => ({
  formatted_address: `Via Esempio${number ? `, ${number}` : ''}, 97100 Ragusa RG, Italia`,
  types,
  geometry: { location: { lat: 36.9258, lng: 14.7306 }, location_type: locationType },
  address_components: [
    ...(number ? [{ long_name: number, short_name: number, types: ['street_number'] }] : []),
    { long_name: 'Via Esempio', short_name: 'Via Esempio', types: ['route'] },
    { long_name: 'Ragusa', short_name: 'Ragusa', types: ['locality', 'political'] },
    { long_name: 'Provincia di Ragusa', short_name: 'RG', types: ['administrative_area_level_2', 'political'] },
    { long_name: '97100', short_name: '97100', types: ['postal_code'] },
  ],
});

const address = { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100', province: 'RG' };
const g = () => createGoogleGeocoder(async () => 'gk');

it('senza chiave → messaggio per la chiave Google, nessuna chiamata', async () => {
  await expect(createGoogleGeocoder(async () => undefined).geocode(address)).rejects.toMatchObject({
    reason: 'missing_key', message: 'Inserisci la chiave Google nelle Impostazioni.' });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('ricerca dell\'indirizzo dell\'etichetta: civico esatto → precisione house con indirizzo', async () => {
  fetchMock.mockReturnValue(json(200, { status: 'OK', results: [geoResult('ROOFTOP', ['street_address'], '12')] }));
  const hits = await g().geocode(address);
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json');
  expect(url.searchParams.get('address')).toBe('Via Esempio, 12, 97100 Ragusa');
  expect(url.searchParams.get('components')).toBe('country:IT|postal_code:97100');
  expect(url.searchParams.get('language')).toBe('it');
  expect(url.searchParams.get('key')).toBe('gk');
  expect(hits).toEqual([{ location: { lat: 36.9258, lng: 14.7306 }, precision: 'house',
    label: 'Via Esempio, 12, 97100 Ragusa RG, Italia',
    address: { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100', province: 'RG' } }]);
});

it('solo la via (centro della strada) → precisione street', async () => {
  fetchMock.mockReturnValue(json(200, { status: 'OK', results: [geoResult('GEOMETRIC_CENTER', ['route'])] }));
  expect((await g().geocode(address))[0].precision).toBe('street');
});

it('nessun risultato → elenco vuoto', async () => {
  fetchMock.mockReturnValue(json(200, { status: 'ZERO_RESULTS', results: [] }));
  expect(await g().geocode(address)).toEqual([]);
});

it.each([
  ['REQUEST_DENIED', 'bad_key', 'La chiave Google non è valida o non è abilitata per questo sito.'],
  ['OVER_QUERY_LIMIT', 'quota', 'Limite di Google raggiunto. Riprova più tardi.'],
])('Geocoding %s → %s', async (status, reason, message) => {
  fetchMock.mockReturnValue(json(200, { status, results: [] }));
  await expect(g().geocode(address)).rejects.toMatchObject({ reason, message });
});

it('suggerimenti: Italia, vicino alla posizione, dal più vicino, con il civico', async () => {
  fetchMock.mockReturnValue(json(200, { suggestions: [
    { placePrediction: { placeId: 'far', distanceMeters: 400000, text: { text: 'Via Roma, 20, Milano MI, Italia' },
      structuredFormat: { mainText: { text: 'Via Roma, 20' }, secondaryText: { text: 'Milano MI, Italia' } } } },
    { placePrediction: { placeId: 'near', distanceMeters: 1200, text: { text: 'Via Roma, 20, Ragusa RG, Italia' },
      structuredFormat: { mainText: { text: 'Via Roma, 20' }, secondaryText: { text: 'Ragusa RG, Italia' } } } },
  ] }));
  const s = await g().autocomplete('via roma 20', { lat: 36.92, lng: 14.73 });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
  expect(init.method).toBe('POST');
  expect(init.headers['X-Goog-Api-Key']).toBe('gk');
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({ input: 'via roma 20', includedRegionCodes: ['it'], languageCode: 'it',
    locationBias: { circle: { center: { latitude: 36.92, longitude: 14.73 }, radius: 50000 } },
    origin: { latitude: 36.92, longitude: 14.73 } });
  expect(typeof body.sessionToken).toBe('string');
  expect(s.map((x) => x.placeId)).toEqual(['near', 'far']);
  expect(s[0]).toMatchObject({ label: 'Via Roma, 20, Ragusa RG, Italia', distanceMeters: 1200,
    address: { street: 'Via Roma, 20', city: 'Ragusa RG, Italia' }, precision: 'house' });
  expect(s[0].location).toBeUndefined();
});

it('scelto un suggerimento ne legge posizione e indirizzo completo, nella stessa sessione', async () => {
  fetchMock
    .mockReturnValueOnce(json(200, { suggestions: [{ placePrediction: { placeId: 'abc', text: { text: 'Via Esempio, 12, Ragusa' },
      structuredFormat: { mainText: { text: 'Via Esempio, 12' }, secondaryText: { text: 'Ragusa' } } } }] }))
    .mockReturnValueOnce(json(200, {
      location: { latitude: 36.9258, longitude: 14.7306 }, formattedAddress: 'Via Esempio, 12, 97100 Ragusa RG, Italia',
      types: ['street_address'],
      addressComponents: [
        { longText: '12', shortText: '12', types: ['street_number'] },
        { longText: 'Via Esempio', shortText: 'Via Esempio', types: ['route'] },
        { longText: 'Ragusa', shortText: 'Ragusa', types: ['locality'] },
        { longText: 'Provincia di Ragusa', shortText: 'RG', types: ['administrative_area_level_2'] },
        { longText: '97100', shortText: '97100', types: ['postal_code'] },
      ] }));
  const geocoder = g();
  const [s] = await geocoder.autocomplete('via esempio 12');
  const full = await geocoder.resolveSuggestion!(s);
  const [url, init] = fetchMock.mock.calls[1];
  const autocompleteToken = JSON.parse(fetchMock.mock.calls[0][1].body).sessionToken;
  expect(new URL(url).pathname).toBe('/v1/places/abc');
  expect(new URL(url).searchParams.get('sessionToken')).toBe(autocompleteToken);
  expect(init.headers['X-Goog-FieldMask']).toBe('location,addressComponents,formattedAddress,types');
  expect(full).toMatchObject({ location: { lat: 36.9258, lng: 14.7306 }, precision: 'house',
    address: { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100', province: 'RG' } });
});

it('Places con chiave rifiutata → bad_key', async () => {
  fetchMock.mockReturnValue(json(403, { error: { status: 'PERMISSION_DENIED' } }));
  await expect(g().autocomplete('via roma')).rejects.toMatchObject({ reason: 'bad_key' });
});
