import { hhmmToSec, secToHhmm } from './time';

it('converte HH:mm in secondi e viceversa', () => {
  expect(hhmmToSec('14:30')).toBe(52200);
  expect(hhmmToSec('00:00')).toBe(0);
  expect(secToHhmm(52200)).toBe('14:30');
  expect(secToHhmm(52229)).toBe('14:30');
  expect(secToHhmm(52230)).toBe('14:31');
});

it('oltre la mezzanotte riparte da 00:00', () => {
  expect(secToHhmm(86400 + 600)).toBe('00:10');
});
