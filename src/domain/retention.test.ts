import { selectExpiredRoutes } from './retention';
import type { Route } from './types';

const route = (id: string, date: string): Route => ({
  id, name: id, date, createdAt: 0, status: 'completed',
  settings: { start: { mode: 'current' }, startTime: 'now', end: { mode: 'return' } },
});
const routes = [route('old', '2025-10-19'), route('edge', '2025-10-20'), route('new', '2026-10-01')];

it('percorsi più vecchi di 12 mesi', () => expect(selectExpiredRoutes(routes, '2026-10-20', 12)).toEqual(['old']));
it('pulizia disattivata', () => expect(selectExpiredRoutes(routes, '2026-10-20', null)).toEqual([]));
it('6 mesi', () => expect(selectExpiredRoutes(routes, '2026-10-20', 6)).toEqual(['old', 'edge']));
