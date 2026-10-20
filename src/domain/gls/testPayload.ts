import type { GlsLabel } from '../types';

/**
 * Costruisce un payload Data Matrix con la stessa struttura delle etichette GLS
 * osservate (larghezze fisse, sequenza di 12 zeri, campi separati da '|').
 * Solo per i test: usare sempre dati inventati.
 */
export function buildGlsPayload(label: GlsLabel): string {
  const header = '010710260    0013    R21   0AA31        00000                         ';
  return (
    '!*AA' +
    label.trackingNumber.padEnd(18) +
    header +
    '000000000000' +
    label.recipient.padEnd(28).slice(0, 28) +
    '|' +
    label.street.padEnd(34) +
    '|' +
    label.city.padEnd(21) +
    '|' +
    (label.notes ?? '').padEnd(27).slice(0, 27) +
    label.postcode +
    label.province +
    ' '.repeat(29)
  );
}
