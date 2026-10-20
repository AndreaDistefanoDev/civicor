// Istanze uniche dei servizi esterni, condivise da tutte le schermate.
import type { OptimizeDeps } from '../data/optimizeRoute';
import { getCorrection, getSettings, getStop, listStops, patchStop } from '../data/repos';
import { getCurrentPosition } from '../device/geolocation';
import { createGeocodeQueue } from '../services/geocodeQueue';
import { createMatrixCache } from '../services/matrixCache';
import { createOrsGeocoder } from '../services/ors/orsGeocoder';
import { createOrsRouting } from '../services/ors/orsRouting';
import { optimizeInWorker } from '../services/optimizeClient';

const apiKey = async () => (await getSettings()).orsApiKey;

export const geocoder = createOrsGeocoder(apiKey);
export const routing = createOrsRouting(apiKey);
export const matrixCache = createMatrixCache(routing);
export const geocodeQueue = createGeocodeQueue({
  geocoder,
  repos: { getCorrection, getStop, patchStop, listStops },
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  onOnline: (cb) => typeof window !== 'undefined' && window.addEventListener('online', cb),
});


export const optimizeDeps: OptimizeDeps = {
  getMatrix: (points, profile) => matrixCache.getMatrix(points, profile),
  routeLine: (points, profile, avoidTolls) => routing.routeLine(points, profile, avoidTolls),
  getPosition: () => getCurrentPosition(),
  optimize: optimizeInWorker,
  now: () => new Date(),
};
