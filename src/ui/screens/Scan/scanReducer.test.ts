import { initialScanState, scanReducer } from './scanReducer';
import { makeStop } from '../../../test/fixtures';

it('fermata aggiunta → banner con indirizzo e voce in cima alle recenti', () => {
  const s = scanReducer(initialScanState, { type: 'scanned', outcome: { kind: 'added', stop: makeStop({ id: 'a' }) } });
  expect(s.banner).toEqual({ kind: 'ok', text: 'Via Esempio, 12 · Ragusa, 97100' });
  expect(s.recent).toEqual(['a']);
});

it('le recenti tengono le ultime 3, la più nuova in cima', () => {
  let s = initialScanState;
  for (const id of ['a', 'b', 'c', 'd']) s = scanReducer(s, { type: 'scanned', outcome: { kind: 'added', stop: makeStop({ id }) } });
  expect(s.recent).toEqual(['d', 'c', 'b']);
});

it('doppione → "Già scansionata"', () => {
  const s = scanReducer(initialScanState, { type: 'scanned', outcome: { kind: 'duplicate', stopId: 'a' } });
  expect(s.banner).toEqual({ kind: 'duplicate', text: 'Già scansionata' });
});

it('stesso indirizzo → numero di pacchi', () => {
  const s = scanReducer(initialScanState, { type: 'scanned', outcome: { kind: 'merged', stop: makeStop({ id: 'a', packages: 2 }) } });
  expect(s.banner).toEqual({ kind: 'ok', text: 'Stesso indirizzo: 2 pacchi' });
  expect(s.recent).toEqual(['a']);
});

it('codice non GLS → "Codice non riconosciuto"', () => {
  expect(scanReducer(initialScanState, { type: 'unreadable' }).banner).toEqual({ kind: 'unreadable', text: 'Codice non riconosciuto' });
});

it('stato della fotocamera', () => {
  expect(scanReducer(initialScanState, { type: 'camera', state: 'denied' }).camera).toBe('denied');
});
