import { makeStop } from '../../test/fixtures';
import { codTotals, formatEuro, parseEuro } from './cod';

it('legge importi scritti all\'italiana', () => {
  expect(parseEuro('45,50')).toBe(45.5);
  expect(parseEuro('1.234,5 €')).toBe(1234.5);
  expect(parseEuro('12')).toBe(12);
  expect(parseEuro('')).toBeUndefined();
  expect(parseEuro('-3')).toBeUndefined();
  expect(parseEuro('abc')).toBeUndefined();
});

it('scrive gli importi in euro', () => {
  expect(formatEuro(45.5)).toBe('45,50 €');
  expect(formatEuro(1234)).toBe('1.234,00 €');
});

it('somma i contrassegni: incassati in contanti, con POS e ancora da incassare', () => {
  const t = codTotals([
    makeStop({ id: 'a', cod: { amount: 20, method: 'cash' }, outcome: 'done' }),
    makeStop({ id: 'b', cod: { amount: 30.5, method: 'pos' }, outcome: 'done' }),
    makeStop({ id: 'c', cod: { amount: 10 } }),
    makeStop({ id: 'd', cod: { amount: 5 }, outcome: 'failed' }),
    makeStop({ id: 'e' }),
  ]);
  expect(t).toEqual({ count: 4, cash: 20, pos: 30.5, toCollect: 10, returned: 5 });
});
