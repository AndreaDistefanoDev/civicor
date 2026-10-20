import { parseGlsDataMatrix } from './parseGlsDataMatrix';
import { buildGlsPayload } from './testPayload';
import type { GlsLabel } from '../types';

// Dati inventati: stessa struttura delle etichette GLS reali, nessun dato personale.
const label: GlsLabel = {
  trackingNumber: 'ZZ123456789010RG',
  recipient: 'mario rossi',
  street: 'Via Esempio, 12',
  city: 'ragusa',
  notes: 'CHIAMARE PRIMA',
  postcode: '97100',
  province: 'RG',
};

it('legge tutti i campi da un payload GLS', () => {
  expect(parseGlsDataMatrix(buildGlsPayload(label))).toEqual({ ...label, city: 'Ragusa' });
});

it('legge CAP e provincia incollati a note troncate', () => {
  const p = buildGlsPayload({ ...label, notes: 'CONTANTE 3330000000 chiamar' }).replace(/\s+$/, '');
  expect(parseGlsDataMatrix(p)).toMatchObject({
    notes: 'CONTANTE 3330000000 chiamar',
    postcode: '97100',
    province: 'RG',
  });
});

it('note assenti → undefined', () => {
  expect(parseGlsDataMatrix(buildGlsPayload({ ...label, notes: undefined }))?.notes).toBeUndefined();
});

it('civico con lettera conservato', () => {
  expect(parseGlsDataMatrix(buildGlsPayload({ ...label, street: 'Via Prova, 177/B' }))?.street).toBe(
    'Via Prova, 177/B',
  );
});

it('comune in maiuscolo diventa maiuscola iniziale', () => {
  expect(parseGlsDataMatrix(buildGlsPayload({ ...label, city: 'SANTA CROCE CAMERINA' }))?.city).toBe(
    'Santa Croce Camerina',
  );
});

it.each(['', 'ciao', 'https://example.com', '!*AAZZ1|a|b'])('payload non GLS %s → null', (p) => {
  expect(parseGlsDataMatrix(p)).toBeNull();
});
