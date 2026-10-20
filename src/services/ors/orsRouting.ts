import { planDirectionsChunks } from '../../domain/routing/chunks';
import type { LatLng } from '../../domain/types';
import type { Matrix, RoutingProvider } from '../routing';
import { orsFetch } from './orsClient';

const toLngLat = (p: LatLng): [number, number] => [p.lng, p.lat];

export function createOrsRouting(getApiKey: () => Promise<string | undefined>): RoutingProvider {
  return {
    async matrix(locations, req, profile) {
      const data = (await orsFetch(`/v2/matrix/${profile}`, {
        apiKey: await getApiKey(),
        method: 'POST',
        body: {
          locations: locations.map(toLngLat),
          sources: req.sources,
          destinations: req.destinations,
          metrics: ['duration', 'distance'],
        },
      })) as Matrix;
      return { durations: data.durations, distances: data.distances };
    },

    async routeLine(points, profile, avoidTolls) {
      const apiKey = await getApiKey();
      const line: [number, number][] = [];
      for (const chunk of planDirectionsChunks(points)) {
        const data = (await orsFetch(`/v2/directions/${profile}/geojson`, {
          apiKey,
          method: 'POST',
          body: {
            coordinates: chunk.map(toLngLat),
            ...(avoidTolls ? { options: { avoid_features: ['tollways'] } } : {}),
          },
        })) as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
        const coords = data.features[0]?.geometry.coordinates ?? [];
        const last = line.at(-1);
        const skipFirst = last && coords[0] && last[0] === coords[0][0] && last[1] === coords[0][1];
        line.push(...(skipFirst ? coords.slice(1) : coords));
      }
      return line;
    },
  };
}
