import Dexie, { type Table } from 'dexie';
import type { AppSettings, LatLng, Route, Stop, StopType } from '../domain/types';

export interface CorrectionRow {
  key: string;
  location: LatLng;
  label: string;
  updatedAt: number;
}
export interface SettingsRow extends Partial<AppSettings> {
  id: 'app';
}
export interface UnreadableCodeRow {
  id?: number;
  payload: string;
  createdAt: number;
}

export class CivicorDB extends Dexie {
  routes!: Table<Route, string>;
  stops!: Table<Stop, string>;
  stopTypes!: Table<StopType, string>;
  corrections!: Table<CorrectionRow, string>;
  settings!: Table<SettingsRow, string>;
  unreadableCodes!: Table<UnreadableCodeRow, number>;

  constructor() {
    super('civicor');
    this.version(1).stores({
      routes: 'id, date',
      stops: 'id, routeId, [routeId+originalIndex]',
      stopTypes: 'id, position',
      corrections: 'key',
      settings: 'id',
      unreadableCodes: '++id, createdAt',
    });
  }
}

export const db = new CivicorDB();
