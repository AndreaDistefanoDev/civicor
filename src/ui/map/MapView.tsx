import { LngLatBounds, Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
// MapLibre 6 usa un worker separato: Vite lo impacchetta e ne fornisce l'URL.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import type { LatLng, Stop, StopType } from '../../domain/types';
import './MapView.css';

const STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/fiord',
  light: 'https://tiles.openfreemap.org/styles/positron',
};
const RAGUSA: [number, number] = [14.7306, 36.9258];
setWorkerUrl(maplibreWorkerUrl);

export interface MapViewProps {
  stops: Stop[];
  stopTypes?: StopType[];
  polyline?: [number, number][];
  selectedStopId?: string;
  onSelectStop?: (id: string) => void;
  userLocation?: LatLng;
  draggable?: { location: LatLng; onMove: (l: LatLng) => void };
  theme: 'dark' | 'light';
  /** Spazio in basso occupato dal pannello, per centrare la mappa nella parte visibile. */
  bottomInset?: number;
}

function plate(stop: Stop, color: string, selected: boolean): HTMLElement {
  const el = document.createElement('button');
  el.className = `stop-plate${selected ? ' selected' : ''}${stop.outcome !== 'pending' ? ' done' : ''}${
    stop.geoStatus === 'uncertain' ? ' uncertain' : ''
  }`;
  el.style.setProperty('--plate', color);
  el.setAttribute('aria-label', `Fermata ${stop.displayId}: ${stop.address.street}`);
  el.textContent = String(stop.displayId);
  return el;
}

/** Mappa OpenStreetMap (OpenFreeMap) con targhette numerate delle fermate e linea del percorso. */
export function MapView(props: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap>(null);
  const markers = useRef<Marker[]>([]);
  const extra = useRef<Marker[]>([]);
  const fitted = useRef(false);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    if (!container.current) return;
    const m = new MlMap({
      container: container.current,
      style: STYLES[props.theme],
      center: RAGUSA,
      zoom: 12,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.on('load', () => {
      m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#000', 'line-width': 8, 'line-opacity': 0.35 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
      m.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#ffc23d', 'line-width': 4.5 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
      drawLine(latest.current.polyline);
    });
    return () => m.remove();
    // Lo stile cambia solo con il tema.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.theme]);

  function drawLine(line?: [number, number][]) {
    const src = map.current?.getSource('route') as GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: line && line.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }] : [],
    });
  }

  useEffect(() => drawLine(props.polyline), [props.polyline]);

  // Targhette delle fermate.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    const colors = new Map(props.stopTypes?.map((t) => [t.id, t.color]));
    const located = props.stops.filter((s) => s.location);
    markers.current = located.map((s) => {
      const el = plate(s, colors.get(s.stopTypeId) ?? '#ffc23d', s.id === props.selectedStopId);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        latest.current.onSelectStop?.(s.id);
      });
      return new Marker({ element: el }).setLngLat([s.location!.lng, s.location!.lat]).addTo(m);
    });
    if (!fitted.current && located.length > 0) {
      fitted.current = true;
      fitAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.stops, props.stopTypes, props.selectedStopId]);

  // Punto trascinabile (verifica indirizzi) e posizione dell'utente.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    extra.current.forEach((mk) => mk.remove());
    extra.current = [];
    if (props.userLocation) {
      const dot = document.createElement('div');
      dot.className = 'user-dot';
      extra.current.push(new Marker({ element: dot }).setLngLat([props.userLocation.lng, props.userLocation.lat]).addTo(m));
    }
    if (props.draggable) {
      const pin = document.createElement('div');
      pin.className = 'drag-pin';
      const mk = new Marker({ element: pin, draggable: true, anchor: 'bottom' })
        .setLngLat([props.draggable.location.lng, props.draggable.location.lat])
        .addTo(m);
      mk.on('dragend', () => {
        const ll = mk.getLngLat();
        latest.current.draggable?.onMove({ lat: ll.lat, lng: ll.lng });
      });
      extra.current.push(mk);
      m.easeTo({ center: [props.draggable.location.lng, props.draggable.location.lat], zoom: 17 });
    }
  }, [props.userLocation, props.draggable?.location.lat, props.draggable?.location.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  function fitAll() {
    const m = map.current;
    const pts = latest.current.stops.filter((s) => s.location).map((s) => [s.location!.lng, s.location!.lat] as [number, number]);
    if (!m || pts.length === 0) return;
    const bounds = pts.reduce((b, p) => b.extend(p), new LngLatBounds(pts[0], pts[0]));
    m.fitBounds(bounds, { padding: { top: 60, left: 40, right: 60, bottom: (latest.current.bottomInset ?? 0) + 40 }, maxZoom: 16, duration: 400 });
  }

  function centerOnMe() {
    navigator.geolocation?.getCurrentPosition((p) =>
      map.current?.easeTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15 }),
    );
  }

  return (
    <div className="map-wrap">
      <div ref={container} className="map" />
      <div className="map-buttons" style={{ bottom: (props.bottomInset ?? 0) + 12 }}>
        <button className="icon-btn" aria-label="Centra sulla mia posizione" onClick={centerOnMe}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="3.5" fill="currentColor" />
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
        <button className="icon-btn" aria-label="Vista d'insieme" onClick={fitAll}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
