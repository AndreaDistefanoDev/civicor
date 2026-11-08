import { makeStop } from '../../test/fixtures';
import type { Route } from '../types';
import { daySummary, hardAddresses, monthStats } from './stats';

const at = (h: number, m: number) => new Date(2026, 10, 5, h, m).getTime();
const route = (over: Partial<Route> = {}): Route => ({
  id: 'r1', name: 'Giovedì', date: '2026-11-05', createdAt: 1, status: 'completed',
  settings: { start: { mode: 'current' }, startTime: 'now', end: { mode: 'return' } }, totals: { km: 62.4, minutes: 300, endTime: '16:00' },
  ...over,
});

it('riepilogo di un giro: pacchi consegnati, ritiri, mancate, km, inizio, fine e minuti per fermata', () => {
  const stops = [
    makeStop({ id: 'a', packages: 3, outcome: 'done', outcomeAt: at(8, 30) }),
    makeStop({ id: 'b', packages: 1, outcome: 'done', outcomeAt: at(8, 50) }),
    makeStop({ id: 'c', kind: 'pickup', outcome: 'done', outcomeAt: at(9, 10) }),
    makeStop({ id: 'd', outcome: 'failed', failReason: 'not_home', outcomeAt: at(9, 30) }),
    makeStop({ id: 'e' }),
  ];
  expect(daySummary(route(), stops)).toEqual({
    routeId: 'r1', date: '2026-11-05', name: 'Giovedì', stops: 5, delivered: 2, packagesDelivered: 4, pickups: 1, failed: 1, completed: true,
    km: 62.4, start: '08:30', end: '09:30', minutesPerStop: 20,
  });
});

it('giro mai iniziato: niente orari né minuti per fermata', () => {
  const d = daySummary(route({ totals: undefined }), [makeStop()]);
  expect(d).toMatchObject({ delivered: 0, km: undefined, start: undefined, end: undefined, minutesPerStop: undefined });
});

it('numeri del mese: medie sui giorni lavorati, percentuale riuscite, km, fine media, mancate per motivo', () => {
  const days = [
    { routeId: 'r1', date: '2026-11-03', name: '', stops: 120, delivered: 110, packagesDelivered: 130, pickups: 4, failed: 6, km: 60, start: '08:00', end: '16:00', minutesPerStop: 3 },
    { routeId: 'r2', date: '2026-11-04', name: '', stops: 100, delivered: 96, packagesDelivered: 110, pickups: 0, failed: 4, km: 50.5, start: '08:10', end: '15:30', minutesPerStop: 4 },
    { routeId: 'r3', date: '2026-11-05', name: '', stops: 10, delivered: 0, packagesDelivered: 0, pickups: 0, failed: 0, km: 5, start: undefined, end: undefined, minutesPerStop: undefined },
  ];
  const failed = [makeStop({ outcome: 'failed', failReason: 'not_home' }), makeStop({ outcome: 'failed', failReason: 'not_home' }), makeStop({ outcome: 'failed' })];
  expect(monthStats(days, failed)).toEqual({
    workDays: 2, packagesDelivered: 240, avgPackagesPerDay: 120, avgStopsPerDay: 110, successRate: 95, pickups: 4,
    km: 110.5, avgEnd: '15:45', avgMinutesPerStop: 3.5,
    failedByReason: [['not_home', 2], ['other', 1]],
  });
});

it('mese vuoto: tutto a zero, nessuna media inventata', () => {
  expect(monthStats([], [])).toMatchObject({ workDays: 0, avgPackagesPerDay: 0, successRate: undefined, avgEnd: undefined });
});

it('indirizzi difficili: almeno 2 mancate, dal più problematico', () => {
  const f = (id: string, street: string, failReason?: 'not_home' | 'refused', t = 1) =>
    makeStop({ id, outcome: 'failed', failReason, outcomeAt: t, address: { street, city: 'Ragusa', postcode: '97100' } });
  const list = hardAddresses([
    f('1', 'Via Roma, 10', 'not_home', 1), f('2', 'VIA ROMA 10', 'refused', 5), f('3', 'Via Roma 10', 'not_home', 3),
    f('4', 'Via Etna, 2', 'not_home'), f('5', 'Via Etna, 2', undefined, 2),
    f('6', 'Via Sola, 1'),
  ]);
  expect(list).toEqual([
    { street: 'VIA ROMA 10', city: 'Ragusa', count: 3, lastReason: 'refused' },
    { street: 'Via Etna, 2', city: 'Ragusa', count: 2, lastReason: undefined },
  ]);
});

it('il giro di oggi ancora in corso non abbassa le medie', () => {
  const day = (date: string, packagesDelivered: number, done = true) => ({
    routeId: date, date, name: '', stops: packagesDelivered, delivered: packagesDelivered, packagesDelivered, pickups: 0, failed: 0,
    completed: done, start: '08:00', end: '15:00', minutesPerStop: 4,
  });
  const s = monthStats([day('2026-11-06', 100), day('2026-11-07', 2, false)], [], '2026-11-07');
  expect(s).toMatchObject({ workDays: 1, avgPackagesPerDay: 100, packagesDelivered: 100 });
  expect(monthStats([day('2026-11-06', 100), day('2026-11-07', 120)], [], '2026-11-07').workDays).toBe(2);
});
