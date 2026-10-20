// Interfaccia del geocoder: OpenStreetMap oggi, sostituibile (es. Google) senza toccare UI e dominio.
import type { Address, LatLng } from '../domain/types';

export type GeoPrecision = 'house' | 'street' | 'locality' | 'unknown';

export interface GeocodeHit {
  location: LatLng;
  precision: GeoPrecision;
  label: string;
  address?: Address;
}

export interface AddressSuggestion {
  label: string;
  address: Address;
  location: LatLng;
  precision: GeoPrecision;
}

export interface Geocoder {
  geocode(address: Address, focus?: LatLng): Promise<GeocodeHit[]>;
  geocodeText(text: string, focus?: LatLng): Promise<GeocodeHit[]>;
  autocomplete(text: string, focus?: LatLng): Promise<AddressSuggestion[]>;
}
