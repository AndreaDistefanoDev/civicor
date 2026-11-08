// Etichette di qualsiasi corriere: dal testo letto con la fotocamera all'indirizzo del destinatario.
// Il lettore sbaglia e aggiunge "rumore" (simboli, pezzi di lettere): si cercano gli schemi dentro le righe,
// non righe perfette.
import { addressKey } from '../address/normalize';
import { extractPhone } from '../contact/phone';

export interface LabelAddress {
  role: 'recipient' | 'sender' | 'unknown';
  recipient?: string;
  street: string;
  /** Vuoti se illeggibili: si completano a mano (o con la città del giro). */
  postcode: string;
  city: string;
  province?: string;
  phone?: string;
}

const STREET_WORDS =
  'via|viale|v\\.le|corso|c\\.so|piazza|p\\.zza|piazzale|largo|vicolo|vico|contrada|c\\.da|strada|località|loc\\.|frazione|borgo|lungomare|salita|traversa|discesa|rione|circonvallazione';
const STREET_AT = new RegExp(`(?:^|\\s)(${STREET_WORDS})(?=\\s)`, 'i');
/** Nome della via fino al civico ("n.12", "177/b", "45 B"). */
const STREET_NUMBER = /^(.{2,40}?)(?:\bn(?:r|°)?\.?\s*)?(\d{1,4}(?:\s*\/\s*[a-z0-9]{1,2}\b|\s?[a-z]\b)?)/i;
const RECIPIENT_WORD = /\b(destinatario|destinataria|dest\.|consegnare a|ship to|deliver to|recipient)|^to:/i;
const SENDER_WORD = /\b(mittente|mitt\.|from|sender|shipper|return to|reso a)\b/i;
const KEYWORD_PREFIX = /^\s*(dati destinatario|destinatario|destinataria|dest\.|consegnare a|ship to|deliver to|recipient|to|mittente|mitt\.|from|sender)\s*:?\s*/i;
const COUNTRY = /^(it|ita|italia|italy)$/i;
const PROVINCE = /^\(?([A-Z]{2})\)?$/;
const SMALL_WORDS = new Set(['di', 'del', 'della', 'dello', 'dei', 'delle', 'degli', 'da', 'de', 'la', 'le', 'lo', 'il', 'e']);

/** "VIA DEL MAGAZZINO 45/b" → "Via del Magazzino 45/B"; "c.da bosco" → "C.da Bosco". */
function tidy(text: string): string {
  return text
    .trim()
    .replace(/[,;]+$/, '')
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/(\d)(\s*\/?\s*)([a-z])\b/g, (_, d: string, sep: string, l: string) => d + sep + l.toUpperCase());
}

/** Errori tipici del lettore nei CAP: O→0, I/l→1, S→5, B→8 (solo in gruppi di 5 caratteri quasi tutti cifre). */
function fixDigits(line: string): string {
  return line.replace(/\b[0-9OoIlSB]{5}\b/g, (t) =>
    (t.match(/\d/g)?.length ?? 0) >= 3 ? t.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5').replace(/B/g, '8') : t,
  );
}

/** Toglie i simboli che il lettore aggiunge ai bordi delle etichette e delle tabelle. */
const clean = (line: string) => fixDigits(line.replace(/[|[\]{}\\=_‘’“”"<>~^*»«•]/g, ' ').replace(/\s+/g, ' ').trim());

const letters = (w: string) => w.replace(/[^a-zà-ÿ]/gi, '').length;

/** Sigle delle province italiane: due maiuscole contano come provincia solo se sono una di queste ("LA" no). */
const PROVINCES = new Set(
  'AG AL AN AO AP AQ AR AT AV BA BG BI BL BN BO BR BS BT BZ CA CB CE CH CL CN CO CR CS CT CZ EN FC FE FG FI FM FR GE GO GR IM IS KR LC LE LI LO LT LU MB MC ME MI MN MO MS MT NA NO NU OR PA PC PD PE PG PI PN PO PR PT PU PV PZ RA RC RE RG RI RM RN RO SA SI SO SP SR SS SU SV TA TE TN TO TP TR TS TV UD VA VB VC VE VI VR VT VV'.split(' '),
);
/** Parole inventate dal lettore: tre lettere uguali di fila ("EEE") o nessuna vocale. */
const junk = (w: string) => /([a-z])\1\1/i.test(w) || !/[aeiouàèéìòù]/i.test(w);

/** Parole della città dopo il CAP (o da sola su una riga), fino a provincia, paese o rumore. */
function readCity(words: string[]): { city: string; province?: string } | undefined {
  const city: string[] = [];
  let province: string | undefined;
  for (let i = 0; i < words.length && city.length < 5; i++) {
    const w = words[i];
    const prov = PROVINCE.exec(w);
    if (prov && city.length > 0 && PROVINCES.has(prov[1])) {
      province = prov[1];
      break;
    }
    if (COUNTRY.test(w) && city.length > 0) break;
    const word = /^[a-zà-ÿ'.-]+$/i.test(w) && !junk(w);
    // Prima della città si saltano al massimo due pezzetti spuri ("EEE", "a").
    if (city.length === 0 && (!word || letters(w) < 3)) {
      if (i >= 2) break;
      continue;
    }
    if (!word || letters(w) < 2) break;
    city.push(w);
  }
  return city.length ? { city: tidy(city.join(' ')), province } : undefined;
}

/** Distanza di modifica tra due parole (lettere da cambiare, aggiungere o togliere). */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** Città letta male ma simile a una già nel giro ("Qusa" → "Ragusa", "Modlca" → "Modica"): si usa quella. */
export function snapCity(read: string, known: string[]): string {
  const r = read.toLowerCase();
  if (r.length < 3) return read;
  let best: string | undefined;
  let distance = Infinity;
  for (const k of new Set(known)) {
    const d = editDistance(r, k.toLowerCase());
    if (d < distance) [best, distance] = [k, d];
  }
  if (!best) return read;
  const sameEnd = best.toLowerCase().slice(-3) === r.slice(-3);
  return distance <= 1 || (distance <= 3 && sameEnd && r.length >= 4) ? best : read;
}

/** Via e civico che iniziano con "Via/Corso/…": il resto della riga (rumore) si scarta. */
function readStreet(text: string): { street: string; before: string } | undefined {
  const m = STREET_AT.exec(text);
  if (!m) return undefined;
  const from = m.index + m[0].length - m[1].length;
  const rest = text.slice(from);
  const n = STREET_NUMBER.exec(rest);
  const street = n ? `${n[1]}${n[2].replace(/\s+/g, '')}` : rest.split(/\s+/).slice(0, 4).join(' ');
  return { street: tidy(street), before: text.slice(0, from) };
}

/** Nome del destinatario: senza "Destinatario:" e senza i pezzetti spuri all'inizio. */
function readName(text: string): string | undefined {
  const words = text.replace(KEYWORD_PREFIX, '').split(/\s+/).filter(Boolean);
  while (words.length && (letters(words[0]) < 3 || junk(words[0]))) words.shift();
  while (words.length && (letters(words[words.length - 1]) < 2 || junk(words[words.length - 1]))) words.pop();
  if (words.length === 0 || words.some((w) => /\d{3,}/.test(w))) return undefined;
  return tidy(words.join(' '));
}

function roleOf(lines: string[]): LabelAddress['role'] {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (SENDER_WORD.test(lines[i])) return 'sender';
    if (RECIPIENT_WORD.test(lines[i])) return 'recipient';
  }
  return 'unknown';
}

interface Found extends LabelAddress {
  first: number;
  last: number;
}

export function parseLabelText(text: string): { candidates: LabelAddress[]; best?: LabelAddress } {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const found: Found[] = [];
  const usedStreetLines = new Set<number>();
  let blockStart = 0;

  // 1) Indirizzi con il CAP: i più affidabili.
  lines.forEach((line, i) => {
    const cap = /\b(\d{5})\b/.exec(line);
    if (!cap) return;
    const place = readCity(line.slice(cap.index + 5).trim().split(/\s+/).filter(Boolean));
    if (!place) return;
    let s = readStreet(line.slice(0, cap.index));
    let first = i;
    for (let back = 1; !s && back <= 2 && i - back >= blockStart; back++) {
      s = readStreet(lines[i - back]);
      if (s) first = i - back;
    }
    if (!s) return;
    usedStreetLines.add(first);
    found.push({ ...describe(lines, first, i, blockStart, s), postcode: cap[1], ...place });
    blockStart = i + 1;
  });

  // 2) Via senza CAP leggibile: città sulla riga sotto, se c'è, altrimenti da completare.
  lines.forEach((line, i) => {
    if (usedStreetLines.has(i) || /\b\d{5}\b/.test(line)) return;
    const s = readStreet(line);
    if (!s || !/\d/.test(s.street)) return;
    const below = lines[i + 1];
    // Città da sola sulla riga sotto: si saltano i pezzetti spuri davanti ("a RAGUSA").
    const belowWords = below && !readStreet(below) && !/\d/.test(below) ? below.split(/\s+/) : [];
    while (belowWords.length > 1 && letters(belowWords[0]) < 3) belowWords.shift();
    const place = belowWords.length ? readCity(belowWords) : undefined;
    found.push({ ...describe(lines, i, place ? i + 1 : i, 0, s), postcode: '', city: place?.city ?? '', province: place?.province });
  });

  // Stessa via letta due volte (blocco grande e riga con il CAP): resta quella più completa.
  const streetKey = (c: LabelAddress) => addressKey({ street: c.street, city: '' }).split('|')[0];
  const unique = found.filter((c) => !(c.postcode === '' && found.some((o) => o !== c && o.postcode !== '' && streetKey(o) === streetKey(c))));

  const rank = (c: LabelAddress) => ({ recipient: 0, unknown: 1, sender: 2 })[c.role] * 3 + (c.postcode ? 0 : 1) + (c.city ? 0 : 1);
  const candidates = unique
    .map((c, order) => ({ c, order }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.order - b.order)
    .map(({ c: { first: _f, last: _l, ...rest } }) => rest);
  const best = candidates.find((c) => c.role !== 'sender');
  return { candidates, best };
}

/** Nome, ruolo (destinatario/mittente) e telefono intorno all'indirizzo trovato. */
function describe(lines: string[], first: number, last: number, blockStart: number, s: { street: string; before: string }) {
  let name = readName(s.before);
  let top = first;
  const above = lines[first - 1];
  if (!name && first > blockStart && above && !/\b\d{5}\b/.test(above) && !readStreet(above)) {
    name = readName(above);
    top = first - 1;
  }
  const context = lines.slice(Math.max(blockStart, top - 2), first + 1);
  const nextCap = lines.findIndex((l, j) => j > last && /\b\d{5}\b/.test(l));
  const phoneLines = lines.slice(top, nextCap === -1 ? last + 3 : Math.min(last + 3, nextCap));
  return {
    role: roleOf(context),
    recipient: name,
    street: s.street,
    phone: extractPhone(phoneLines.join(' ')),
    first,
    last,
  };
}

/** Riga da cercare con il motore indirizzi: "Via Roma 10, 97100 Ragusa RG". */
export function labelAddressLine(a: LabelAddress): string {
  return [a.street, [a.postcode, a.city, a.province].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}
