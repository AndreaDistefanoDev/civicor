import './MapView.css';
import type { LatLng, Stop, StopType } from '../../domain/types';

export interface MapViewProps {
  stops: Stop[];
  stopTypes?: StopType[];
  polyline?: [number, number][];
  /** Fermata attuale: segnaposto più grande. */
  selectedStopId?: string;
  onSelectStop?: (id: string) => void;
  userLocation?: LatLng;
  draggable?: { location: LatLng; onMove: (l: LatLng) => void };
  theme: 'dark' | 'light';
  /** Spazio in basso occupato dal pannello, per centrare la mappa nella parte visibile. */
  bottomInset?: number;
  /** Orario di fine giro, mostrato in alto a destra durante il giro. */
  finishTime?: string;
}

/** Props delle due mappe (Google e OpenStreetMap): in più la vista 2D/3D. */
export interface MapImplProps extends MapViewProps {
  mode: '2d' | '3d';
  onToggleMode: () => void;
  /** Solo mappa Google: vista satellite. */
  satellite?: boolean;
  onToggleSatellite?: () => void;
}

export const RAGUSA = { lat: 36.9258, lng: 14.7306 };
/** Le etichette (via e orario) compaiono solo da questo zoom in su, quando c'è spazio e non si sovrappongono. */
export const LABELS_ZOOM = 15;

/** Bandierina con l'orario di fine giro. */
export function FinishTime(props: { time?: string }) {
  if (!props.time) return null;
  return (
    <div className="map-finish" aria-label={`Fine giro alle ${props.time}`}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 15V2m0 0h9l-2 3 2 3H3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      {props.time}
    </div>
  );
}
export const PIN_COLOR = '#0e7490';
/** Stesso ottanio, più chiaro per la mappa scura. */
export const PIN_COLOR_DARK = '#1b8fae';

/** Ordine di disegno: prima le fermate chiuse, poi quelle da fare, per ultima quella attuale (sopra a tutte). */
export function drawOrder(stops: Stop[], currentId?: string): Stop[] {
  const rank = (s: Stop) => (s.outcome !== 'pending' ? 0 : s.id === currentId ? 2 : 1);
  return stops.filter((s) => s.location).sort((a, b) => rank(a) - rank(b));
}

export function fitPadding(bottomInset = 0) {
  return { top: 60, left: 40, right: 60, bottom: bottomInset + 40 };
}

/** Tasti sopra la mappa: la mia posizione, vista d'insieme, 2D/3D. */
export function MapButtons(props: {
  bottomInset?: number;
  mode: '2d' | '3d';
  onCenter: () => void;
  onFit: () => void;
  onToggleMode: () => void;
  satellite?: boolean;
  onToggleSatellite?: () => void;
}) {
  return (
    <div className="map-buttons" style={{ bottom: (props.bottomInset ?? 0) + 12 }}>
      {props.onToggleSatellite && (
        <button className="icon-btn map-layer-btn" aria-label="Vista satellite" aria-pressed={!!props.satellite} onClick={props.onToggleSatellite}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 2.5 2.5 6.5 10 10.5l7.5-4L10 2.5ZM2.5 10l7.5 4 7.5-4M2.5 13.5l7.5 4 7.5-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <button className="icon-btn map-mode-btn" aria-label="Vista 3D" aria-pressed={props.mode === '3d'} onClick={props.onToggleMode}>
        {props.mode === '3d' ? '3D' : '2D'}
      </button>
      <button className="icon-btn" aria-label="Centra sulla mia posizione" onClick={props.onCenter}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="3.5" fill="currentColor" />
          <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      <button className="icon-btn" aria-label="Vista d'insieme" onClick={props.onFit}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
