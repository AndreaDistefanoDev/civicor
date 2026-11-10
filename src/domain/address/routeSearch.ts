import type { Stop } from '../types';
import { fold } from './normalize';

const words = (text: string) => fold(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);

/**
 * Fermate del giro che corrispondono a quello che si sta scrivendo (ogni parola deve comparire
 * nella via o nella città), nell'ordine del giro. Servono almeno 3 lettere.
 */
export function searchRouteStops(stops: Stop[], query: string): Stop[] {
  const q = words(query);
  if (q.join('').length < 3) return [];
  return stops
    .filter((s) => {
      const hay = words(`${s.address.street} ${s.address.city}`);
      return q.every((w) => hay.some((h) => h.startsWith(w)));
    })
    .sort((a, b) => (a.sequence ?? a.originalIndex) - (b.sequence ?? b.originalIndex));
}

/** Nome della via senza civico: "Via Romania, 13" → "Via Romania". */
const streetName = (street: string) => street.replace(/[,\s]+\d.*$/, '').trim();

/**
 * Completamenti: nomi di via (dai suggerimenti) che continuano quello che si sta scrivendo,
 * es. "via roma" → "Via Romania". Non quando si sta già scrivendo il civico.
 */
export function streetCompletions(streets: string[], query: string): string[] {
  const q = fold(query).trim();
  if (/\d/.test(q) || q.length < 3) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of streets) {
    const name = streetName(s);
    const key = fold(name);
    if (key.startsWith(q) && key !== q && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out.slice(0, 3);
}
