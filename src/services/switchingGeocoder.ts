import type { Geocoder } from './geocoder';

/** Sceglie a ogni richiesta il motore impostato dall'utente (Google o OpenStreetMap). */
export function createSwitchingGeocoder(deps: {
  google: Geocoder;
  osm: Geocoder;
  provider: () => Promise<'google' | 'osm'>;
}): Geocoder {
  const pick = async () => ((await deps.provider()) === 'google' ? deps.google : deps.osm);
  return {
    geocode: async (address, focus) => (await pick()).geocode(address, focus),
    geocodeText: async (text, focus) => (await pick()).geocodeText(text, focus),
    autocomplete: async (text, focus) => (await pick()).autocomplete(text, focus),
    resolveSuggestion: async (s) => {
      const g = await pick();
      return g.resolveSuggestion ? g.resolveSuggestion(s) : s;
    },
  };
}
