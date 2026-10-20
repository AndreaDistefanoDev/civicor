import { parseAddressLines } from './paste';

it('lista incollata: righe vuote e doppioni rimossi', () => {
  expect(parseAddressLines(' Via A 1\n\nVia B 2\nvia a 1 ')).toEqual(['Via A 1', 'Via B 2']);
});

it('accetta anche a capo di Windows e tabulazioni', () => {
  expect(parseAddressLines('Via A 1\r\n\tVia B 2\t\r\n')).toEqual(['Via A 1', 'Via B 2']);
});
