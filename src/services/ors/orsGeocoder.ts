import type { Address, LatLng } from '../../domain/types';
import type { AddressSuggestion, GeoPrecision, GeocodeHit, Geocoder } from '../geocoder';
import { orsFetch } from './orsClient';

interface PeliasFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    layer?: string;
    label?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    localadmin?: string;
    county?: string;
    postalcode?: string;
    region_a?: string;
  };
}

function precisionOf(layer?: string): GeoPrecision {
  if (layer === 'address') return 'house';
  if (layer === 'street') return 'street';
  if (layer && ['locality', 'localadmin', 'neighbourhood', 'postalcode', 'borough'].includes(layer)) return 'locality';
  return 'unknown';
}

function addressOf(p: PeliasFeature['properties']): Address | undefined {
  const city = p.locality ?? p.localadmin ?? p.county;
  const streetName = p.street ?? (p.layer === 'street' ? p.name : undefined);
  if (!streetName || !city) return undefined;
  return {
    street: p.housenumber ? `${streetName}, ${p.housenumber}` : streetName,
    city,
    postcode: p.postalcode,
    province: p.region_a,
  };
}

function toHit(f: PeliasFeature): GeocodeHit {
  const [lng, lat] = f.geometry.coordinates;
  const hit: GeocodeHit = {
    location: { lat, lng },
    precision: precisionOf(f.properties.layer),
    label: f.properties.label ?? f.properties.name ?? '',
  };
  const address = addressOf(f.properties);
  if (address) hit.address = address;
  return hit;
}

function focusParams(focus?: LatLng): Record<string, string> {
  return focus ? { 'focus.point.lat': String(focus.lat), 'focus.point.lon': String(focus.lng) } : {};
}

export function createOrsGeocoder(getApiKey: () => Promise<string | undefined>): Geocoder {
  async function search(path: string, query: Record<string, string>): Promise<GeocodeHit[]> {
    const data = (await orsFetch(path, { apiKey: await getApiKey(), query })) as { features?: PeliasFeature[] };
    return (data.features ?? []).map(toHit);
  }

  return {
    geocode(address, focus) {
      const query: Record<string, string> = {
        address: address.street,
        locality: address.city,
        country: 'IT',
        size: '3',
        ...focusParams(focus),
      };
      if (address.postcode) query.postalcode = address.postcode;
      return search('/pelias/v1/search/structured', query);
    },
    geocodeText(text, focus) {
      return search('/pelias/v1/search', { text, 'boundary.country': 'IT', size: '3', ...focusParams(focus) });
    },
    async autocomplete(text, focus) {
      const hits = await search('/pelias/v1/autocomplete', { text, 'boundary.country': 'IT', ...focusParams(focus) });
      return hits
        .filter((h): h is GeocodeHit & { address: Address } => !!h.address)
        .map<AddressSuggestion>((h) => ({ label: h.label, address: h.address, location: h.location, precision: h.precision }));
    },
  };
}
