import type { Address } from '../types';

// Abbreviazioni italiane comuni, espanse prima di togliere la punteggiatura.
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bc\.\s*so\b/g, 'corso '],
  [/\bv\.\s*le\b/g, 'viale '],
  [/\bp\.\s*z{1,2}a\b/g, 'piazza '],
  [/\bl\.\s*go\b/g, 'largo '],
  [/\bc\.?\s*\/?\s*da\b/g, 'contrada '],
  [/\bv\.\s/g, 'via '],
];

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function normalizeStreet(street: string): string {
  let s = fold(street);
  for (const [re, full] of ABBREVIATIONS) s = s.replace(re, full);
  s = s.replace(/\bn(?:r)?\s*[°º.]\s*(?=\d)/g, ' '); // "n.200", "n° 200"
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ');
  s = s.replace(/(\d+)\s+([a-z])\b/g, '$1$2'); // "177 b" → "177b"
  return s.replace(/\s+/g, ' ').trim();
}

/** Chiave stabile per riconoscere lo stesso indirizzo (doppioni, memoria delle correzioni). */
export function addressKey(a: Address): string {
  const place = a.postcode?.trim() || fold(a.city).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return `${normalizeStreet(a.street)}|${place}`;
}

export function hasHouseNumber(a: Address): boolean {
  return /\d/.test(a.street);
}

export function formatAddressLine(a: Address): string {
  return a.street.trim();
}

export function formatAddressCity(a: Address): string {
  return a.postcode ? `${a.city}, ${a.postcode}` : a.city;
}
