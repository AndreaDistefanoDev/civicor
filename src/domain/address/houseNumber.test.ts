import { extractHouseNumber, withTypedHouseNumber } from './houseNumber';

it.each([
  ['via roma 20', '20'],
  ['Via Roma, 20 Ragusa', '20'],
  ['via salvatore 177/b', '177/B'],
  ['via salvatore 177 b ragusa', '177/B'],
  ['via 4 novembre 12', '12'],
  ['corso italia 5 97100 ragusa', '5'],
])('trova il civico in "%s"', (text, expected) => {
  expect(extractHouseNumber(text)).toBe(expected);
});

it.each(['corso italia', 'via 4 novembre', 'via xx settembre', 'piazza 97100'])('nessun civico in "%s"', (text) => {
  expect(extractHouseNumber(text)).toBeUndefined();
});

const street = {
  label: 'Via Roma, Ragusa, RG, Italia', precision: 'street' as const,
  address: { street: 'Via Roma', city: 'Ragusa', postcode: '97100' }, location: { lat: 36.9, lng: 14.7 },
};

it('il civico scritto si aggiunge al suggerimento che non ce l\'ha', () => {
  expect(withTypedHouseNumber(street, 'via roma 20')).toMatchObject({
    address: { street: 'Via Roma, 20', city: 'Ragusa' }, label: 'Via Roma, 20, Ragusa, RG, Italia', precision: 'street' });
});

it('suggerimento che ha già il civico resta com\'è', () => {
  const house = { ...street, precision: 'house' as const, address: { ...street.address, street: 'Via Roma, 22' } };
  expect(withTypedHouseNumber(house, 'via roma 20')).toBe(house);
});

it('senza civico scritto il suggerimento resta com\'è', () => {
  expect(withTypedHouseNumber(street, 'via roma')).toBe(street);
});
