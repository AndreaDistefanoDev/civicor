import { createMatrixCache } from './matrixCache';
import type { RoutingProvider } from './routing';
import type { LatLng } from '../domain/types';

const pts = (n: number, offset = 0): LatLng[] =>
  Array.from({ length: n }, (_, i) => ({ lat: 36.9 + (i + offset) * 0.001, lng: 14.7 }));

function fakeProvider() {
  let elements = 0;
  const provider: RoutingProvider = {
    async matrix(locations, req) {
      elements += req.sources.length * req.destinations.length;
      const val = (i: number, j: number) => Math.round(Math.abs(locations[i].lat - locations[j].lat) * 1e6);
      return {
        durations: req.sources.map((i) => req.destinations.map((j) => val(i, j))),
        distances: req.sources.map((i) => req.destinations.map((j) => val(i, j) * 10)),
      };
    },
    routeLine: vi.fn(),
  };
  return { provider, elements: () => elements };
}

it('restituisce la matrice completa nell\'ordine dei punti', async () => {
  const { provider } = fakeProvider();
  const m = await createMatrixCache(provider).getMatrix(pts(3), 'driving-car');
  expect(m.durations).toEqual([[0, 1000, 2000], [1000, 0, 1000], [2000, 1000, 0]]);
  expect(m.distances[0][2]).toBe(20000);
});

it('aggiungendo 2 punti a 130 già noti chiede solo righe e colonne nuove', async () => {
  const { provider, elements } = fakeProvider();
  const cache = createMatrixCache(provider);
  await cache.getMatrix(pts(130), 'driving-car');
  const before = elements();
  const m = await cache.getMatrix([...pts(130), ...pts(2, 500)], 'driving-car');
  expect(elements() - before).toBe(2 * 132 + 130 * 2);
  expect(m.durations).toHaveLength(132);
  expect(m.durations[131]).toHaveLength(132);
});

it('profilo diverso → non riusa i valori', async () => {
  const { provider, elements } = fakeProvider();
  const cache = createMatrixCache(provider);
  await cache.getMatrix(pts(3), 'driving-car');
  const before = elements();
  await cache.getMatrix(pts(3), 'cycling-regular');
  expect(elements() - before).toBe(9);
});
