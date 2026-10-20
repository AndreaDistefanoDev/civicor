import type { Route } from './types';

/** Percorsi con data precedente a `today` meno `months` mesi. `null` = pulizia disattivata. */
export function selectExpiredRoutes(routes: Route[], today: string, months: number | null): string[] {
  if (months === null) return [];
  const [y, m, d] = today.split('-').map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1 - months, d)).toISOString().slice(0, 10);
  return routes.filter((r) => r.date < cutoff).map((r) => r.id);
}
