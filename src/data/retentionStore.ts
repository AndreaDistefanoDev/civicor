import { selectExpiredRoutes } from '../domain/retention';
import { deleteRoute, getSettings, listRoutes } from './repos';

/** Elimina i percorsi più vecchi della soglia nelle Impostazioni. Restituisce quanti ne ha eliminati. */
export async function cleanupExpiredRoutes(today: string): Promise<number> {
  const { retentionMonths } = await getSettings();
  const expired = selectExpiredRoutes(await listRoutes(), today, retentionMonths);
  for (const id of expired) await deleteRoute(id);
  return expired.length;
}
