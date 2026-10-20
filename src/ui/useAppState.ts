import { createContext, useContext } from 'react';
import type { Snap } from './sheet/BottomSheet';

/** Schermate sopra la mappa. Ogni task aggiunge le sue. */
export type ScreenName =
  | 'drawer'
  | 'createRoute'
  | 'settings'
  | 'routeDetails'
  | 'stopDetail'
  | 'stopTypes'
  | 'scan'
  | 'verify'
  | 'search'
  | 'paste'
  | 'voice'
  | 'pickOnMap';

export interface OpenScreen {
  name: ScreenName;
  params?: Record<string, string>;
}

export interface AppState {
  currentRouteId?: string;
  setCurrentRouteId: (id: string | undefined) => void;
  sheet: Snap;
  setSheet: (s: Snap) => void;
  openScreen: (name: ScreenName, params?: Record<string, string>) => void;
  closeScreen: () => void;
  showToast: (message: string, action?: { label: string; onPress: () => void }) => void;
}

export const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState fuori da AppStateContext');
  return ctx;
}
