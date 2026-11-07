// Solo in sviluppo (?demo): un percorso con fermate INVENTATE per vedere le schermate piene.
import { db } from '../data/db';
import { createRoute, putStops } from '../data/repos';
import type { Stop } from '../domain/types';
import { todayIso } from './dates';

const STREETS = ['Via Esempio, 12', 'Corso Modello, 40', 'Via Prova, 7', 'Piazza Campione, 3', 'Via Fittizia, 21/B',
  'Viale Immaginario, 88', 'Via Demo, 5', 'Contrada Inventata'];

export async function seedDemo(): Promise<void> {
  if ((await db.routes.count()) > 0) return;
  const route = await createRoute({ date: todayIso(), name: 'Giro di prova' });
  const stops: Stop[] = STREETS.map((street, i) => ({
    id: `demo-${i}`, routeId: route.id, address: { street, city: 'Ragusa', postcode: '97100' },
    trackingNumbers: [`ZZ00000000${i}010RG`], packages: i === 2 ? 3 : 1, order: 'auto', kind: i === 5 ? 'pickup' : 'delivery',
    timeWindows: i === 3 ? [{ start: '14:00', end: '18:00' }] : [], serviceMinutes: 2, stopTypeId: 'standard',
    geoStatus: i === 7 ? 'uncertain' : 'ok', geoReason: i === 7 ? 'civico non trovato, punto a metà strada' : undefined,
    location: { lat: 36.918 + (i % 4) * 0.006, lng: 14.715 + Math.floor(i / 4) * 0.012 + (i % 3) * 0.004 },
    originalIndex: i, sequence: i, displayId: i + 1, eta: `${String(8 + Math.floor(i / 3)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`,
    outcome: i < 2 ? 'done' : 'pending', outcomeAt: i < 2 ? Date.now() - (2 - i) * 600000 : undefined,
    senderNotes: i === 1 ? 'CHIAMARE PRIMA' : undefined, createdAt: Date.now(),
    findPackage: { positions: ([['back', 'left'], ['shelf'], ['middle'], ['front', 'right']] as const)[i % 4].slice(), size: i === 2 ? 'box' : undefined },
    phone: i === 2 ? '3330000000' : undefined, cod: i === 2 ? { amount: 25 } : undefined,
  }));
  await putStops(stops);
  await db.routes.update(route.id, {
    status: 'in_progress', totals: { km: 23.4, minutes: 95, endTime: '11:40' }, startLocation: { lat: 36.925, lng: 14.73 },
    polyline: stops.map((s) => [s.location!.lng, s.location!.lat] as [number, number]),
  });
}
