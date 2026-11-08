import { bestCode, parsePipeLabel, trackingFromCode } from './codes';

// Dati inventati, con la stessa forma di un'etichetta vera: tipo|destinatario|via|città|civico||riferimento|
it('quadratino con la sbarretta: destinatario, via con civico e città', () => {
  expect(parsePipeLabel('A|mario rossi|via etna|catania|12||ORDINE: X1234567|')).toEqual({
    role: 'recipient', recipient: 'Mario Rossi', street: 'Via Etna, 12', postcode: '', city: 'Catania',
  });
  expect(parsePipeLabel('A|anna neri|corso italia|ragusa|45/b||')).toMatchObject({ street: 'Corso Italia, 45/B', city: 'Ragusa' });
});

it('quadratino con la sbarretta ma senza via, città o civico riconoscibili: non è un indirizzo', () => {
  expect(parsePipeLabel('a|b|c')).toBeNull();
  expect(parsePipeLabel('X|12345|67890|ABC|DEF')).toBeNull();
  expect(parsePipeLabel('A|mario rossi|via etna|catania|||')).toBeNull();
  expect(parsePipeLabel('!*AA qualcosa|via etna|catania|12')).toBeNull();
});

it('numero di spedizione dai codici a barre e dai QR', () => {
  expect(trackingFromCode('WW016076382010RG')).toBe('WW016076382010RG');
  expect(trackingFromCode('(00)380244171152672072')).toBe('380244171152672072');
  expect(trackingFromCode(' 2261201665 ')).toBe('2261201665');
  expect(trackingFromCode('https://esempio.it/traccia?id=123')).toBeNull();
  expect(trackingFromCode('ABCDEFGH')).toBeNull();
  expect(trackingFromCode('12345')).toBeNull();
});

it('tra più codici della stessa etichetta sceglie quello più utile', () => {
  expect(bestCode(['WW016076382010RG', '!*AA00ZZ'])).toBe('!*AA00ZZ');
  expect(bestCode(['2261201665', 'A|mario rossi|via etna|catania|12||'])).toBe('A|mario rossi|via etna|catania|12||');
  expect(bestCode(['https://esempio.it', 'WW016076382010RG'])).toBe('WW016076382010RG');
  expect(bestCode([])).toBeNull();
});
