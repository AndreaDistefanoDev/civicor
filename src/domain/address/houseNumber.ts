import type { AddressSuggestion } from '../../services/geocoder';

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/**
 * Civico scritto dall'utente ("via roma 20", "via salvatore 177/b").
 * Ignora CAP (5 cifre) e numeri che fanno parte del nome della via ("Via 4 Novembre").
 */
export function extractHouseNumber(text: string): string | undefined {
  const tokens = text.toLowerCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  let found: string | undefined;
  for (let i = 0; i < tokens.length; i++) {
    const m = /^(\d{1,4})(?:\/?([a-z]))?$/.exec(tokens[i]);
    if (!m) continue;
    const next = tokens[i + 1];
    if (next && MONTHS.includes(next)) continue; // "4 novembre": nome della via
    let letter = m[2];
    if (!letter && next && /^\/?[a-z]$/.test(next)) {
      letter = next.replace('/', '');
      i++;
    }
    found = letter ? `${m[1]}/${letter.toUpperCase()}` : m[1];
  }
  return found;
}

/** Se la mappa propone solo la via, il civico scritto non va perso: viene aggiunto all'indirizzo. */
export function withTypedHouseNumber(s: AddressSuggestion, typed: string): AddressSuggestion {
  if (/\d/.test(s.address.street)) return s;
  const number = extractHouseNumber(typed);
  if (!number) return s;
  const street = `${s.address.street}, ${number}`;
  return {
    ...s,
    address: { ...s.address, street },
    label: s.label.startsWith(s.address.street) ? street + s.label.slice(s.address.street.length) : `${street}, ${s.label}`,
  };
}
