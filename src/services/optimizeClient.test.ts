import { optimizeInWorker } from './optimizeClient';

it('senza Web Worker calcola comunque il percorso nel thread principale', async () => {
  expect(typeof Worker).toBe('undefined');
  const d = [[0, 60, 120], [60, 0, 60], [120, 60, 0]];
  const r = await optimizeInWorker({
    durations: d, distances: d, startIndex: 0, endIndex: null, startTimeSec: 28800,
    stops: [{ matrixIndex: 2, order: 'auto', serviceSec: 0, windows: [] }, { matrixIndex: 1, order: 'auto', serviceSec: 0, windows: [] }],
  });
  expect(r.sequence).toEqual([1, 0]);
});
