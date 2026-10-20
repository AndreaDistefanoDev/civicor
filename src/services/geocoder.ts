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
  /** Assente finché il suggerimento non è stato letto per intero (resolveSuggestion). */
  location?: LatLng;
  precision: GeoPrecision;
  /** Identificativo del luogo per i fornitori che richiedono una seconda lettura (Google). */
  placeId?: string;
  /** Distanza dal punto di riferimento (posizione del telefono), se noto. */
  distanceMeters?: number;
}

export interface Geocoder {
  geocode(address: Address, focus?: LatLng): Promise<GeocodeHit[]>;
  geocodeText(text: string, focus?: LatLng): Promise<GeocodeHit[]>;
  autocomplete(text: string, focus?: LatLng): Promise<AddressSuggestion[]>;
  /** Completa un suggerimento scelto con posizione e indirizzo completo (se il fornitore lo richiede). */
  resolveSuggestion?(s: AddressSuggestion): Promise<AddressSuggestion>;
}

/** Suggerimento pronto all'uso: con posizione. */
export type LocatedSuggestion = AddressSuggestion & { location: LatLng };

export async function resolveSuggestion(geocoder: Geocoder, s: AddressSuggestion): Promise<LocatedSuggestion> {
  const full = geocoder.resolveSuggestion ? await geocoder.resolveSuggestion(s) : s;
  if (!full.location) throw new Error('Posizione non disponibile per questo indirizzo');
  return full as LocatedSuggestion;
}
