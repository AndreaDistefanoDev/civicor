import { LngLatBounds, Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
// MapLibre 6 usa un worker separato: Vite lo impacchetta e ne fornisce l'URL.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { stopMarker } from './markers';
import { FinishTime, LABELS_ZOOM, MapButtons, PIN_COLOR, PIN_COLOR_DARK, RAGUSA, drawOrder, fitPadding, type MapImplProps } from './shared';

const STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/fiord',
  light: 'https://tiles.openfreemap.org/styles/positron',
};
const BUILDING_3D = { dark: '#2d3743', light: '#d9dee5' };
setWorkerUrl(maplibreWorkerUrl);

/** Mappa OpenStreetMap (OpenFreeMap): gratis e senza chiave. Usata quando Google non è disponibile. */
export function OsmMap(props: MapImplProps) {
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
      center: [RAGUSA.lng, RAGUSA.lat],
      zoom: 12,
      pitch: latest.current.mode === '3d' ? 55 : 0,
      attributionControl: { compact: true },
    });
    map.current = m;
    // Mappa nuova (anche dopo il cambio di tema): va inquadrata di nuovo.
    fitted.current = false;
    const labels = () => container.current?.classList.toggle('show-labels', m.getZoom() >= LABELS_ZOOM);
    m.on('zoom', labels);
    labels();
    m.on('load', () => {
      m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      // Edifici in rilievo, visibili solo nella vista 3D.
      m.addLayer({
        id: 'buildings-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        layout: { visibility: latest.current.mode === '3d' ? 'visible' : 'none' },
        paint: {
          'fill-extrusion-color': BUILDING_3D[props.theme],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.85,
        },
      });
      m.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#000', 'line-width': 8, 'line-opacity': 0.35 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
      m.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': props.theme === 'dark' ? PIN_COLOR_DARK : PIN_COLOR, 'line-width': 4.5 }, layout: { 'line-join': 'round', 'line-cap': 'round' } });
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

  // Vista 2D / 3D.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const three = props.mode === '3d';
    if (m.getLayer('buildings-3d')) m.setLayoutProperty('buildings-3d', 'visibility', three ? 'visible' : 'none');
    m.easeTo({ pitch: three ? 55 : 0, bearing: three ? m.getBearing() : 0, zoom: three ? Math.max(m.getZoom(), 15.5) : m.getZoom(), duration: 500 });
  }, [props.mode]);

  // Segnaposti delle fermate.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    const colors = new Map(props.stopTypes?.map((t) => [t.id, t.color]));
    const located = drawOrder(props.stops, props.selectedStopId);
    markers.current = located.map((s) => {
      const el = stopMarker(s, colors.get(s.stopTypeId) ?? PIN_COLOR, s.id === props.selectedStopId);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        latest.current.onSelectStop?.(s.id);
      });
      return new Marker({ element: el, anchor: 'bottom' }).setLngLat([s.location!.lng, s.location!.lat]).addTo(m);
    });
    if (!fitted.current && located.length > 0) {
      fitted.current = true;
      // Prima del caricamento la mappa non conosce ancora la sua altezza vera: i segnaposti finirebbero sotto la scheda.
      if (m.loaded()) fitAll();
      else m.once('load', fitAll);
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
    m.resize();
    const bounds = pts.reduce((b, p) => b.extend(p), new LngLatBounds(pts[0], pts[0]));
    m.fitBounds(bounds, { padding: fitPadding(latest.current.bottomInset), maxZoom: 16, duration: 400 });
  }

  function centerOnMe() {
    navigator.geolocation?.getCurrentPosition((p) =>
      map.current?.easeTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15 }),
    );
  }

  return (
    <div className="map-wrap">
      <div ref={container} className="map" />
      <FinishTime time={props.finishTime} />
      <MapButtons bottomInset={props.bottomInset} mode={props.mode} onCenter={centerOnMe} onFit={fitAll} onToggleMode={props.onToggleMode} />
    </div>
  );
}
