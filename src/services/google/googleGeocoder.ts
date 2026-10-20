import type { Address } from '../../domain/types';
import type { AddressSuggestion, GeoPrecision, GeocodeHit, Geocoder } from '../geocoder';
import { OrsError, type OrsErrorReason } from '../ors/orsClient';

// Errori con testi riferiti a Google (stessa classe usata dalla coda per decidere se fermarsi o ritentare).
const MESSAGES: Record<OrsErrorReason, string> = {
  missing_key: 'Inserisci la chiave Google nelle Impostazioni.',
  bad_key: 'La chiave Google non è valida o non è abilitata per questo sito.',
  quota: 'Limite di Google raggiunto. Riprova più tardi.',
  network: 'Nessuna connessione.',
  server: 'Google non risponde.',
};
const fail = (reason: OrsErrorReason) => new OrsError(reason, MESSAGES[reason]);

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_URL = 'https://places.googleapis.com/v1';
const NEARBY_METERS = 50_000;

interface Component {
  types: string[];
  long: string;
  short: string;
}

function toAddress(components: Component[]): Address | undefined {
  const get = (type: string) => components.find((c) => c.types.includes(type));
  const route = get('route')?.long;
  const city = (get('locality') ?? get('administrative_area_level_3') ?? get('postal_town'))?.long;
  if (!route || !city) return undefined;
  const number = get('street_number')?.long;
  return {
    street: number ? `${route}, ${number}` : route,
    city,
    postcode: get('postal_code')?.long,
    province: get('administrative_area_level_2')?.short,
  };
}

function precisionOf(types: string[], locationType?: string): GeoPrecision {
  if (types.some((t) => t === 'street_address' || t === 'premise' || t === 'subpremise')) {
    return locationType === 'APPROXIMATE' ? 'street' : 'house';
  }
  if (types.includes('route')) return 'street';
  if (types.some((t) => t === 'locality' || t === 'postal_code' || t.startsWith('administrative_area'))) return 'locality';
  return 'unknown';
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw fail('network');
  }
}

function checkHttp(res: Response) {
  if (res.status === 400 || res.status === 401 || res.status === 403) throw fail('bad_key');
  if (res.status === 429) throw fail('quota');
  if (!res.ok) throw fail('server');
}

/** Ricerca indirizzi con Google: Geocoding per gli indirizzi completi, Places (New) per i suggerimenti. */
export function createGoogleGeocoder(getApiKey: () => Promise<string | undefined>): Geocoder {
  // Una sessione di suggerimenti termina con la lettura del luogo scelto (così Google la fattura come una sola).
  let session = crypto.randomUUID();

  const key = async () => {
    const k = await getApiKey();
    if (!k) throw fail('missing_key');
    return k;
  };

  async function geocodeQuery(params: Record<string, string>): Promise<GeocodeHit[]> {
    const url = new URL(GEOCODE_URL);
    for (const [k, v] of Object.entries({ ...params, language: 'it', region: 'it', key: await key() })) url.searchParams.set(k, v);
    const res = await request(url.toString());
    checkHttp(res);
    const data = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        types: string[];
        geometry: { location: { lat: number; lng: number }; location_type: string };
        address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
      }>;
    };
    if (data.status === 'ZERO_RESULTS') return [];
    if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') throw fail('bad_key');
    if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'OVER_DAILY_LIMIT') throw fail('quota');
    if (data.status !== 'OK') throw fail('server');
    return data.results.map((r) => {
      const hit: GeocodeHit = {
        location: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
        precision: precisionOf(r.types, r.geometry.location_type),
        label: r.formatted_address,
      };
      const address = toAddress(r.address_components.map((c) => ({ types: c.types, long: c.long_name, short: c.short_name })));
      if (address) hit.address = address;
      return hit;
    });
  }

  return {
    geocode(address) {
      const place = [address.postcode, address.city].filter(Boolean).join(' ');
      return geocodeQuery({
        address: `${address.street}, ${place}`,
        components: ['country:IT', ...(address.postcode ? [`postal_code:${address.postcode}`] : [])].join('|'),
      });
    },

    geocodeText(text) {
      return geocodeQuery({ address: text, components: 'country:IT' });
    },

    async autocomplete(text, focus) {
      const point = focus && { latitude: focus.lat, longitude: focus.lng };
      const res = await request(`${PLACES_URL}/places:autocomplete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': await key() },
        body: JSON.stringify({
          input: text,
          includedRegionCodes: ['it'],
          languageCode: 'it',
          sessionToken: session,
          ...(point ? { locationBias: { circle: { center: point, radius: NEARBY_METERS } }, origin: point } : {}),
        }),
      });
      checkHttp(res);
      const data = (await res.json()) as {
        suggestions?: Array<{
          placePrediction?: {
            placeId: string;
            distanceMeters?: number;
            text: { text: string };
            structuredFormat?: { mainText: { text: string }; secondaryText?: { text: string } };
          };
        }>;
      };
      return (data.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map<AddressSuggestion>((p) => {
          const main = p.structuredFormat?.mainText.text ?? p.text.text;
          return {
            placeId: p.placeId,
            label: p.text.text,
            address: { street: main, city: p.structuredFormat?.secondaryText?.text ?? '' },
            precision: /\d/.test(main) ? 'house' : 'street',
            distanceMeters: p.distanceMeters,
          };
        })
        .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    },

    async resolveSuggestion(s) {
      if (!s.placeId || s.location) return s;
      const url = new URL(`${PLACES_URL}/places/${encodeURIComponent(s.placeId)}`);
      url.searchParams.set('sessionToken', session);
      url.searchParams.set('languageCode', 'it');
      const res = await request(url.toString(), {
        headers: { 'X-Goog-Api-Key': await key(), 'X-Goog-FieldMask': 'location,addressComponents,formattedAddress,types' },
      });
      checkHttp(res);
      session = crypto.randomUUID(); // sessione chiusa: la prossima ricerca ne apre una nuova
      const d = (await res.json()) as {
        location: { latitude: number; longitude: number };
        formattedAddress: string;
        types?: string[];
        addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
      };
      const address = toAddress((d.addressComponents ?? []).map((c) => ({ types: c.types, long: c.longText, short: c.shortText })));
      return {
        ...s,
        label: d.formattedAddress,
        address: address ?? s.address,
        location: { lat: d.location.latitude, lng: d.location.longitude },
        precision: precisionOf(d.types ?? []),
      };
    },
  };
}
