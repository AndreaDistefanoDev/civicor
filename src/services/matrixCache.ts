import { planMatrixRequests } from '../domain/routing/chunks';
import type { LatLng } from '../domain/types';
import type { Matrix, Profile, RoutingProvider } from './routing';

type Cell = { duration: number; distance: number };

const pointKey = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

/**
 * Matrice delle distanze con memoria: riottimizzare dopo aver aggiunto qualche
 * fermata scarica solo le righe e le colonne nuove.
 */
export function createMatrixCache(provider: RoutingProvider) {
  const cells = new Map<Profile, Map<string, Cell>>();
  const known = new Map<Profile, Set<string>>();

  return {
    async getMatrix(points: LatLng[], profile: Profile): Promise<Matrix> {
      const store = cells.get(profile) ?? new Map<string, Cell>();
      const done = known.get(profile) ?? new Set<string>();
      cells.set(profile, store);
      known.set(profile, done);

      const keys = points.map(pointKey);
      const uniqueKeys = [...new Set(keys)];
      const locations = uniqueKeys.map((k) => points[keys.indexOf(k)]);
      const all = uniqueKeys.map((_, i) => i);
      const fresh = all.filter((i) => !done.has(uniqueKeys[i]));
      const old = all.filter((i) => done.has(uniqueKeys[i]));

      const requests = [...planMatrixRequests(fresh, all), ...planMatrixRequests(old, fresh)];
      for (const req of requests) {
        const res = await provider.matrix(locations, req, profile);
        req.sources.forEach((s, a) =>
          req.destinations.forEach((d, b) => {
            store.set(`${uniqueKeys[s]}>${uniqueKeys[d]}`, {
              duration: res.durations[a][b],
              distance: res.distances[a][b],
            });
          }),
        );
      }
      fresh.forEach((i) => done.add(uniqueKeys[i]));

      const cell = (a: string, b: string): Cell => store.get(`${a}>${b}`) ?? { duration: 0, distance: 0 };
      return {
        durations: keys.map((a) => keys.map((b) => cell(a, b).duration)),
        distances: keys.map((a) => keys.map((b) => cell(a, b).distance)),
      };
    },
  };
}
