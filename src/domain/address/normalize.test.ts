import { addressKey, formatAddressCity, formatAddressLine, hasHouseNumber } from './normalize';

const k = (street: string, city = 'Ragusa', postcode = '97100') => addressKey({ street, city, postcode });

it('ignora maiuscole, accenti, punteggiatura e spazi', () => {
  expect(k('Via  Roma, 200')).toBe(k('via roma 200'));
  expect(k('Via Nicolò, 3')).toBe(k('via nicolo 3'));
});

it('espande le abbreviazioni comuni', () => {
  expect(k('C.so Italia 5')).toBe(k('Corso Italia, 5'));
  expect(k('V.le Europa 1')).toBe(k('Viale Europa 1'));
  expect(k('P.za Libertà 2')).toBe(k('Piazza Libertà 2'));
  expect(k('V. Roma 4')).toBe(k('Via Roma 4'));
});

it('normalizza n., n° e lettera del civico', () => {
  expect(k('via roma n.200')).toBe(k('Via Roma, 200'));
  expect(k('via roma n° 200')).toBe(k('Via Roma, 200'));
  expect(k('Via Salvatore, 177/b')).toBe(k('via salvatore 177 B'));
});

it('distingue civici e comuni diversi', () => {
  expect(k('Via Roma 20')).not.toBe(k('Via Roma 200'));
  expect(k('Via Roma 20', 'Modica', '97015')).not.toBe(k('Via Roma 20'));
});

it('senza CAP usa il comune', () => {
  expect(addressKey({ street: 'Via Roma 1', city: 'RAGUSA' })).toBe(addressKey({ street: 'via roma, 1', city: 'Ragusa' }));
});

it('riconosce la presenza del civico', () => {
  expect(hasHouseNumber({ street: 'Contrada Prova', city: 'Ragusa' })).toBe(false);
  expect(hasHouseNumber({ street: 'Via Roma, 200', city: 'Ragusa' })).toBe(true);
  expect(hasHouseNumber({ street: 'Via Salvatore 177/B', city: 'Ragusa' })).toBe(true);
});

it('formatta via e comune per la visualizzazione', () => {
  expect(formatAddressLine({ street: 'Via Esempio, 12', city: 'Ragusa' })).toBe('Via Esempio, 12');
  expect(formatAddressCity({ street: 'x', city: 'Ragusa', postcode: '97100' })).toBe('Ragusa, 97100');
  expect(formatAddressCity({ street: 'x', city: 'Ragusa' })).toBe('Ragusa');
});
