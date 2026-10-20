import { createOrsRouting } from './orsRouting';
import { profileFor } from '../routing';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

it('profilo dal tipo di veicolo', () => {
  expect(profileFor('car')).toBe('driving-car');
  expect(profileFor('van')).toBe('driving-car');
  expect(profileFor('scooter')).toBe('driving-car');
  expect(profileFor('bike')).toBe('cycling-regular');
});

it('matrice: POST con [lng, lat], sorgenti, destinazioni e chiave in header', async () => {
  fetchMock.mockReturnValue(json(200, { durations: [[0, 5]], distances: [[0, 50]] }));
  const r = await createOrsRouting(async () => 'k').matrix(
    [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }], { sources: [0], destinations: [0, 1] }, 'driving-car');
  const [url, init] = fetchMock.mock.calls[0];
  expect(new URL(url).pathname).toBe('/v2/matrix/driving-car');
  expect(init.headers.Authorization).toBe('k');
  expect(JSON.parse(init.body)).toEqual({ locations: [[2, 1], [4, 3]], sources: [0], destinations: [0, 1],
    metrics: ['duration', 'distance'] });
  expect(r).toEqual({ durations: [[0, 5]], distances: [[0, 50]] });
});

it('matrice: 401 e 429 arrivano come OrsError', async () => {
  const routing = createOrsRouting(async () => 'k');
  fetchMock.mockReturnValueOnce(json(401, {}));
  await expect(routing.matrix([{ lat: 1, lng: 2 }], { sources: [0], destinations: [0] }, 'driving-car'))
    .rejects.toMatchObject({ reason: 'bad_key' });
  fetchMock.mockReturnValueOnce(json(429, {}));
  await expect(routing.matrix([{ lat: 1, lng: 2 }], { sources: [0], destinations: [0] }, 'driving-car'))
    .rejects.toMatchObject({ reason: 'quota' });
});

it('linea del percorso: 60 tappe in 2 richieste, pedaggi evitati, coordinate concatenate senza doppioni', async () => {
  fetchMock
    .mockReturnValueOnce(json(200, { features: [{ geometry: { coordinates: [[0, 0], [1, 1]] } }] }))
    .mockReturnValueOnce(json(200, { features: [{ geometry: { coordinates: [[1, 1], [2, 2]] } }] }));
  const pts = Array.from({ length: 60 }, (_, i) => ({ lat: i, lng: i }));
  const line = await createOrsRouting(async () => 'k').routeLine(pts, 'driving-car', true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/v2/directions/driving-car/geojson');
  expect(body.coordinates).toHaveLength(50);
  expect(body.options).toEqual({ avoid_features: ['tollways'] });
  expect(line).toEqual([[0, 0], [1, 1], [2, 2]]);
});
