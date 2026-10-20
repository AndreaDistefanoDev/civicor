import type { AppSettings, LatLng, Route, Stop, StopType } from '../types';

export interface BackupFile {
  app: 'civicor';
  version: 1;
  exportedAt: string;
  routes: Route[];
  stops: Stop[];
  stopTypes: StopType[];
  corrections: Array<{ key: string; location: LatLng; label: string }>;
  unreadableCodes: string[];
  settings: Omit<AppSettings, 'orsApiKey'>;
}

const LISTS = ['routes', 'stops', 'stopTypes', 'corrections', 'unreadableCodes'] as const;

export function validateBackup(json: unknown): BackupFile {
  const invalid = () => new Error('File di backup non valido');
  if (!json || typeof json !== 'object') throw invalid();
  const o = json as Record<string, unknown>;
  if (o.app !== 'civicor' || o.version !== 1) throw invalid();
  if (!LISTS.every((k) => Array.isArray(o[k]))) throw invalid();
  if (!o.settings || typeof o.settings !== 'object') throw invalid();
  return o as unknown as BackupFile;
}
