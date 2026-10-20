import type { GlsLabel } from '../types';

const PREFIX = '!*AA';
const TAIL = /^(.*?)(\d{5})([A-Z]{2})$/i;

/** 'ragusa' / 'RAGUSA' → 'Ragusa'; 'santa croce camerina' → 'Santa Croce Camerina'. */
function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Legge il contenuto del codice Data Matrix di un'etichetta GLS.
 * Restituisce null per qualsiasi codice con struttura diversa.
 */
export function parseGlsDataMatrix(payload: string): GlsLabel | null {
  if (!payload.startsWith(PREFIX)) return null;

  const parts = payload.split('|');
  if (parts.length < 4) return null;

  const trackingNumber = payload.slice(PREFIX.length, PREFIX.length + 18).trim();
  if (!/^[A-Z0-9]{8,}$/i.test(trackingNumber)) return null;

  const recipientMatch = /0{12}(.*)$/.exec(parts[0]);
  if (!recipientMatch) return null;

  const tail = TAIL.exec(parts[3].trimEnd());
  if (!tail) return null;

  const street = parts[1].trim();
  const city = parts[2].trim();
  if (!street || !city) return null;

  const notes = tail[1].trim();
  return {
    trackingNumber,
    recipient: recipientMatch[1].trim(),
    street,
    city: titleCase(city),
    notes: notes || undefined,
    postcode: tail[2],
    province: tail[3].toUpperCase(),
  };
}
