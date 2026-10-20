import { applyScan, type ScanContext } from './applyScan';
import type { GlsLabel, Stop } from '../types';

const label: GlsLabel = {
  trackingNumber: 'ZZ123456789010RG', recipient: 'mario rossi', street: 'Via Esempio, 12',
  city: 'Ragusa', notes: 'CHIAMARE PRIMA', postcode: '97100', province: 'RG',
};
let n = 0;
const ctx: ScanContext = { routeId: 'r1', now: 1000, newId: () => `s${++n}`, serviceMinutes: 1, stopTypeId: 'standard' };

const added = (stops: Stop[], l: GlsLabel): Stop => {
  const r = applyScan(stops, l, ctx);
  if (r.kind !== 'added') throw new Error(`atteso added, ottenuto ${r.kind}`);
  return r.stop;
};

it('etichetta nuova → fermata aggiunta in attesa di posizione', () => {
  expect(added([], label)).toMatchObject({
    routeId: 'r1', geoStatus: 'pending', packages: 1, order: 'auto', kind: 'delivery',
    trackingNumbers: ['ZZ123456789010RG'], senderNotes: 'CHIAMARE PRIMA', recipient: 'mario rossi',
    address: { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100', province: 'RG' },
    originalIndex: 0, displayId: 1, outcome: 'pending', serviceMinutes: 1, stopTypeId: 'standard',
    timeWindows: [], createdAt: 1000,
  });
});

it('le fermate successive prendono indice e ID progressivi', () => {
  const first = added([], label);
  const second = added([first], { ...label, trackingNumber: 'ZZ555555555010RG', street: 'Via Altra, 3' });
  expect(second).toMatchObject({ originalIndex: 1, displayId: 2 });
});

it('stesso numero di spedizione → doppione, nessuna modifica', () => {
  const first = added([], label);
  expect(applyScan([first], label, ctx)).toEqual({ kind: 'duplicate', stopId: first.id });
});

it('stesso indirizzo, spedizione diversa → un pacco in più sulla stessa fermata', () => {
  const first = added([], label);
  const r = applyScan([first], { ...label, trackingNumber: 'ZZ999999999010RG', street: 'via esempio 12' }, ctx);
  expect(r).toMatchObject({
    kind: 'merged',
    stop: { id: first.id, packages: 2, trackingNumbers: ['ZZ123456789010RG', 'ZZ999999999010RG'] },
  });
});
