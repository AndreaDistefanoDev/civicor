import { createSwitchingGeocoder } from './switchingGeocoder';
import type { Geocoder } from './geocoder';

const fake = (name: string): Geocoder => ({
  geocode: vi.fn(async () => [{ precision: 'house' as const, location: { lat: 0, lng: 0 }, label: name }]),
  geocodeText: vi.fn(async () => []),
  autocomplete: vi.fn(async () => []),
  resolveSuggestion: vi.fn(async (s) => ({ ...s, label: name })),
});

it('usa Google quando è scelto nelle Impostazioni, altrimenti OpenStreetMap', async () => {
  let provider: 'google' | 'osm' = 'osm';
  const g = createSwitchingGeocoder({ google: fake('google'), osm: fake('osm'), provider: async () => provider });
  const addr = { street: 'Via Esempio, 12', city: 'Ragusa' };
  expect((await g.geocode(addr))[0].label).toBe('osm');
  provider = 'google';
  expect((await g.geocode(addr))[0].label).toBe('google');
  expect((await g.resolveSuggestion!({ label: 'x', address: addr, precision: 'house' })).label).toBe('google');
});
