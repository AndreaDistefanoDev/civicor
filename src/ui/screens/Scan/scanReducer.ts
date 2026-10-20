import { formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import type { ScanOutcome } from '../../../domain/scan/applyScan';

export type CameraState = 'starting' | 'live' | 'denied' | 'unavailable';

export interface ScanState {
  /** Id delle ultime fermate lette, la più nuova per prima (max 3). */
  recent: string[];
  banner?: { kind: 'ok' | 'duplicate' | 'unreadable'; text: string };
  camera: CameraState;
  /** Cresce a ogni lettura: serve a far ripartire il lampo verde. */
  flash: number;
}

export type ScanEvent =
  | { type: 'scanned'; outcome: ScanOutcome }
  | { type: 'unreadable' }
  | { type: 'camera'; state: CameraState };

export const initialScanState: ScanState = { recent: [], camera: 'starting', flash: 0 };

const pushRecent = (recent: string[], id: string) => [id, ...recent.filter((r) => r !== id)].slice(0, 3);

export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case 'camera':
      return { ...state, camera: event.state };
    case 'unreadable':
      return { ...state, banner: { kind: 'unreadable', text: 'Codice non riconosciuto' } };
    case 'scanned': {
      const o = event.outcome;
      if (o.kind === 'duplicate') return { ...state, banner: { kind: 'duplicate', text: 'Già scansionata' } };
      const text =
        o.kind === 'merged'
          ? `Stesso indirizzo: ${o.stop.packages} pacchi`
          : `${formatAddressLine(o.stop.address)} · ${formatAddressCity(o.stop.address)}`;
      return { ...state, recent: pushRecent(state.recent, o.stop.id), banner: { kind: 'ok', text }, flash: state.flash + 1 };
    }
  }
}
