// Modelli condivisi di Civicor. TypeScript puro: niente dipendenze dal browser.

export type LatLng = { lat: number; lng: number };

export type Address = { street: string; city: string; postcode?: string; province?: string };

export type GeoStatus = 'pending' | 'ok' | 'uncertain' | 'failed';
export type StopOrder = 'first' | 'auto' | 'last';
export type StopKind = 'delivery' | 'pickup';
export type StopOutcome = 'pending' | 'done' | 'failed';
export type PackageSize = 'small' | 'medium' | 'large' | 'box' | 'bag' | 'letter';
export type VehiclePosition = 'front' | 'middle' | 'back' | 'left' | 'right' | 'floor' | 'shelf';
/** Orari nel formato 'HH:mm'. */
export type TimeWindow = { start: string; end: string };

export interface Stop {
  id: string;
  routeId: string;
  address: Address;
  recipient?: string;
  notes?: string;
  senderNotes?: string;
  trackingNumbers: string[];
  packages: number;
  order: StopOrder;
  kind: StopKind;
  timeWindows: TimeWindow[];
  serviceMinutes: number;
  stopTypeId: string;
  findPackage?: { size?: PackageSize; positions: VehiclePosition[] };
  location?: LatLng;
  geoStatus: GeoStatus;
  geoReason?: string;
  originalIndex: number;
  sequence?: number;
  displayId: number;
  eta?: string;
  outcome: StopOutcome;
  outcomeAt?: number;
  createdAt: number;
}

export type StartSetting = { mode: 'current' } | { mode: 'address'; address: Address; location?: LatLng };
export type EndSetting =
  | { mode: 'return' }
  | { mode: 'address'; address: Address; location?: LatLng }
  | { mode: 'none' };

export interface RouteSettings {
  start: StartSetting;
  startTime: 'now' | string;
  end: EndSetting;
  endTime?: string;
  break?: { earliest: string; latest: string; minutes: number };
}

export type RouteStatus = 'planning' | 'optimized' | 'confirmed' | 'in_progress' | 'completed';

export interface Route {
  id: string;
  name: string;
  /** 'YYYY-MM-DD' */
  date: string;
  createdAt: number;
  status: RouteStatus;
  settings: RouteSettings;
  startLocation?: LatLng;
  polyline?: [number, number][];
  totals?: { km: number; minutes: number; endTime: string };
}

export interface StopType {
  id: string;
  name: string;
  color: string;
  position: number;
  builtIn: boolean;
}

export type NavApp = 'waze' | 'google' | 'apple';

export interface AppSettings {
  navApp: NavApp;
  defaultServiceMinutes: number;
  vehicle: 'car' | 'van' | 'bike' | 'scooter';
  avoidTolls: boolean;
  idMode: 'classic' | 'after_optimization';
  theme: 'dark' | 'light' | 'auto';
  orsApiKey?: string;
  retentionMonths: number | null;
  defaultRouteSettings?: RouteSettings;
}

export interface GlsLabel {
  trackingNumber: string;
  recipient: string;
  street: string;
  city: string;
  notes?: string;
  postcode: string;
  province: string;
}
