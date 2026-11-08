// "I miei numeri": riepiloghi calcolati sul telefono dai giri salvati.
import { addressKey } from '../address/normalize';
import type { FailReason, Route, Stop } from '../types';

export interface DaySummary {
  routeId: string;
  date: string;
  name: string;
  stops: number;
  /** Consegne riuscite (fermate, non pacchi). */
  delivered: number;
  packagesDelivered: number;
  pickups: number;
  failed: number;
  /** Giro segnato come completato. */
  completed?: boolean;
  /** Km del percorso calcolato (non quelli guidati davvero). */
  km?: number;
  /** Ora del primo e dell'ultimo esito segnato. */
  start?: string;
  end?: string;
  minutesPerStop?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const round1 = (n: number) => Math.round(n * 10) / 10;
const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined);

export function daySummary(route: Route, stops: Stop[]): DaySummary {
  const done = stops.filter((s) => s.outcome === 'done');
  const deliveries = done.filter((s) => s.kind === 'delivery');
  const times = stops.filter((s) => s.outcome !== 'pending' && s.outcomeAt).map((s) => s.outcomeAt!).sort((a, b) => a - b);
  const first = times[0];
  const last = times[times.length - 1];
  return {
    routeId: route.id,
    date: route.date,
    name: route.name,
    stops: stops.length,
    delivered: deliveries.length,
    packagesDelivered: deliveries.reduce((n, s) => n + s.packages, 0),
    pickups: done.length - deliveries.length,
    failed: stops.filter((s) => s.outcome === 'failed').length,
    completed: route.status === 'completed',
    km: route.totals?.km,
    start: first ? clock(first) : undefined,
    end: last ? clock(last) : undefined,
    minutesPerStop: times.length >= 2 ? round1((last - first) / 60000 / (times.length - 1)) : undefined,
  };
}

export interface MonthStats {
  workDays: number;
  packagesDelivered: number;
  avgPackagesPerDay: number;
  avgStopsPerDay: number;
  /** Consegne riuscite su consegne tentate, in percentuale. */
  successRate?: number;
  pickups: number;
  km: number;
  avgEnd?: string;
  avgMinutesPerStop?: number;
  failedByReason: Array<[FailReason, number]>;
}

/**
 * Le medie contano solo i giorni lavorati (almeno una fermata chiusa).
 * Il giro di oggi entra solo quando è completato: a metà giornata abbasserebbe le medie.
 */
export function monthStats(days: DaySummary[], failedStops: Stop[], today?: string): MonthStats {
  const worked = days.filter((d) => d.delivered + d.pickups + d.failed > 0 && (d.date !== today || d.completed));
  const delivered = worked.reduce((n, d) => n + d.delivered, 0);
  const failed = worked.reduce((n, d) => n + d.failed, 0);
  const packages = worked.reduce((n, d) => n + d.packagesDelivered, 0);
  const ends = worked.filter((d) => d.end).map((d) => toMinutes(d.end!));
  const avgEnd = average(ends);
  const reasons = new Map<FailReason, number>();
  for (const s of failedStops) reasons.set(s.failReason ?? 'other', (reasons.get(s.failReason ?? 'other') ?? 0) + 1);
  const perStop = average(worked.flatMap((d) => (d.minutesPerStop !== undefined ? [d.minutesPerStop] : [])));
  return {
    workDays: worked.length,
    packagesDelivered: packages,
    avgPackagesPerDay: worked.length ? Math.round(packages / worked.length) : 0,
    avgStopsPerDay: worked.length ? Math.round(worked.reduce((n, d) => n + d.stops, 0) / worked.length) : 0,
    successRate: delivered + failed ? Math.round((delivered / (delivered + failed)) * 100) : undefined,
    pickups: worked.reduce((n, d) => n + d.pickups, 0),
    km: round1(worked.reduce((n, d) => n + (d.km ?? 0), 0)),
    avgEnd: avgEnd === undefined ? undefined : `${pad(Math.floor(Math.round(avgEnd) / 60))}:${pad(Math.round(avgEnd) % 60)}`,
    avgMinutesPerStop: perStop === undefined ? undefined : round1(perStop),
    failedByReason: [...reasons].sort((a, b) => b[1] - a[1]),
  };
}

/** Indirizzi con almeno `min` consegne mancate, dal più problematico. */
export function hardAddresses(failedStops: Stop[], min = 2, limit = 5) {
  const groups = new Map<string, Stop[]>();
  for (const s of failedStops) {
    const key = addressKey(s.address);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.values()]
    .filter((g) => g.length >= min)
    .map((g) => {
      const last = g.reduce((a, b) => ((b.outcomeAt ?? 0) > (a.outcomeAt ?? 0) ? b : a));
      return { street: last.address.street, city: last.address.city, count: g.length, lastReason: last.failReason };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
