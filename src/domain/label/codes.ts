// Codici sulle etichette oltre al Data Matrix GLS: quadratini con i campi separati da "|",
// QR e codici a barre con il numero di spedizione.
import { tidy, type LabelAddress } from './parseLabelText';

const STREET_START = /^(via|viale|v\.le|corso|c\.so|piazza|p\.zza|piazzale|largo|vicolo|vico|contrada|c\.da|strada|località|loc\.|frazione|borgo|lungomare|salita|traversa|discesa|rione|circonvallazione)\b/i;
const HOUSE_NUMBER = /^\d{1,4}\s*(\/\s*[a-z0-9]{1,3}|[a-z])?$/i;

/**
 * Quadratino con i campi separati da "|" (es. "A|nome|via|città|civico||riferimento|"):
 * restituisce l'indirizzo solo se via, città e civico sono chiaramente riconoscibili.
 */
export function parsePipeLabel(text: string): LabelAddress | null {
  if (text.startsWith('!*AA')) return null;
  const f = text.split('|').map((p) => p.trim());
  if (f.length < 5) return null;
  const [, name, street, city, number] = f;
  if (!STREET_START.test(street) || !/^[a-zà-ÿ' .-]{2,}$/i.test(city) || !HOUSE_NUMBER.test(number)) return null;
  const recipient = /^[a-zà-ÿ' .-]{3,}$/i.test(name) ? tidy(name) : undefined;
  return {
    role: 'recipient',
    ...(recipient ? { recipient } : {}),
    street: `${tidy(street)}, ${tidy(number.replace(/\s+/g, ''))}`,
    postcode: '',
    city: tidy(city),
  };
}

/**
 * Numero di spedizione da un codice a barre o da un QR: lettere e cifre (almeno 6 cifre), niente link.
 * Il prefisso GS1 "(00)" delle etichette logistiche viene tolto.
 */
export function trackingFromCode(text: string): string | null {
  const t = text.trim().replace(/^\(00\)/, '');
  if (/^https?:|[\s|/]/i.test(t)) return null;
  if (!/^[A-Z0-9-]{8,30}$/i.test(t) || (t.match(/\d/g)?.length ?? 0) < 6) return null;
  return t.toUpperCase();
}

/** Tra i codici di un fotogramma, il più utile: GLS, poi quadratino con indirizzo, poi numero di spedizione. */
export function bestCode(texts: string[]): string | null {
  return (
    texts.find((t) => t.startsWith('!*AA')) ??
    texts.find((t) => parsePipeLabel(t) !== null) ??
    texts.find((t) => trackingFromCode(t) !== null) ??
    texts[0] ??
    null
  );
}
