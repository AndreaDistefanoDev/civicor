import type { Stop } from '../domain/types';

/** Fermata inventata per i test. */
export function makeStop(over: Partial<Stop> = {}): Stop {
  return {
    id: 's1', routeId: 'r1', address: { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100' },
    trackingNumbers: ['ZZ123456789010RG'], packages: 1, order: 'auto', kind: 'delivery', timeWindows: [],
    serviceMinutes: 1, stopTypeId: 'standard', geoStatus: 'ok', location: { lat: 36.92, lng: 14.73 },
    originalIndex: 0, displayId: 1, outcome: 'pending', createdAt: 1, ...over,
  };
}
