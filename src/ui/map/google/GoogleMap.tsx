import { useEffect, useRef, useState } from 'react';
import { stopMarker } from '../markers';
import { FinishTime, LABELS_ZOOM, MapButtons, PIN_COLOR, RAGUSA, drawOrder, fitPadding, type MapImplProps } from '../shared';
import { loadGoogleMaps, removeAuthListener } from './loadGoogleMaps';

// Map ID di prova fornito da Google: serve per i segnaposti personalizzati e per inclinare la mappa (3D).
const MAP_ID = 'DEMO_MAP_ID';

type MarkerCtor = typeof google.maps.marker.AdvancedMarkerElement;
type Marker = google.maps.marker.AdvancedMarkerElement;

/** Mappa Google: stessi segnaposti e stessa linea del percorso, con vista 3D (edifici in rilievo da vicino). */
export function GoogleMap(props: MapImplProps & { apiKey: string; onAuthFailure: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map>(undefined);
  const AdvancedMarker = useRef<MarkerCtor>(undefined);
  const markers = useRef<Marker[]>([]);
  const extra = useRef<Marker[]>([]);
  const lines = useRef<google.maps.Polyline[]>([]);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    let cancelled = false;
    const onFail = props.onAuthFailure;
    (async () => {
      const g = await loadGoogleMaps(props.apiKey, onFail);
      const { Map } = (await g.importLibrary('maps')) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await g.importLibrary('marker')) as google.maps.MarkerLibrary;
      if (cancelled || !container.current) return;
      map.current = new Map(container.current, {
        center: RAGUSA,
        zoom: 12,
        mapId: MAP_ID,
        colorScheme: props.theme === 'dark' ? g.ColorScheme.DARK : g.ColorScheme.LIGHT,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        tilt: latest.current.mode === '3d' ? 45 : 0,
      });
      const m = map.current;
      m.addListener('zoom_changed', () => container.current?.classList.toggle('show-labels', (m.getZoom() ?? 0) >= LABELS_ZOOM));
      AdvancedMarker.current = AdvancedMarkerElement;
      setReady(true);
    })().catch(onFail);
    return () => {
      cancelled = true;
      removeAuthListener(onFail);
    };
    // La mappa si crea una volta per chiave e tema (il colore scuro/chiaro si sceglie solo alla creazione).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.apiKey, props.theme]);

  // Linea del percorso.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    lines.current.forEach((l) => l.setMap(null));
    const path = (props.polyline ?? []).map(([lng, lat]) => ({ lat, lng }));
    lines.current =
      path.length > 1
        ? [
            new google.maps.Polyline({ map: m, path, strokeColor: '#000', strokeOpacity: 0.35, strokeWeight: 9, zIndex: 1 }),
            new google.maps.Polyline({ map: m, path, strokeColor: PIN_COLOR, strokeOpacity: 1, strokeWeight: 5, zIndex: 2 }),
          ]
        : [];
  }, [props.polyline, ready]);

  // Vista satellite (foto dall'alto con i nomi delle strade).
  useEffect(() => {
    map.current?.setMapTypeId(props.satellite ? 'hybrid' : 'roadmap');
  }, [props.satellite, ready]);

  // Vista 2D / 3D: in 3D la mappa si inclina e, da vicino, gli edifici sono in rilievo.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const three = props.mode === '3d';
    m.moveCamera({ tilt: three ? 45 : 0, heading: three ? m.getHeading() : 0, zoom: three ? Math.max(m.getZoom() ?? 12, 16.5) : m.getZoom() });
  }, [props.mode, ready]);

  // Segnaposti delle fermate.
  useEffect(() => {
    const m = map.current;
    const Ctor = AdvancedMarker.current;
    if (!m || !Ctor) return;
    markers.current.forEach((mk) => (mk.map = null));
    const colors = new Map(props.stopTypes?.map((t) => [t.id, t.color]));
    const located = drawOrder(props.stops, props.selectedStopId);
    markers.current = located.map((s, i) => {
      const content = stopMarker(s, colors.get(s.stopTypeId) ?? PIN_COLOR, s.id === props.selectedStopId);
      content.addEventListener('click', (e) => {
        e.stopPropagation();
        latest.current.onSelectStop?.(s.id);
      });
      return new Ctor({ map: m, position: s.location!, content, zIndex: i, title: content.getAttribute('aria-label') ?? '' });
    });
    if (!fitted.current && located.length > 0) {
      fitted.current = true;
      fitAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.stops, props.stopTypes, props.selectedStopId, ready]);

  // Punto trascinabile (verifica indirizzi) e posizione dell'utente.
  useEffect(() => {
    const m = map.current;
    const Ctor = AdvancedMarker.current;
    if (!m || !Ctor) return;
    extra.current.forEach((mk) => (mk.map = null));
    extra.current = [];
    if (props.userLocation) {
      const dot = document.createElement('div');
      dot.className = 'user-dot';
      extra.current.push(new Ctor({ map: m, position: props.userLocation, content: dot }));
    }
    if (props.draggable) {
      const pin = document.createElement('div');
      pin.className = 'drag-pin';
      const mk = new Ctor({ map: m, position: props.draggable.location, content: pin, gmpDraggable: true });
      mk.addListener('dragend', () => {
        const p = mk.position;
        if (!p) return;
        const lat = typeof p.lat === 'function' ? p.lat() : p.lat;
        const lng = typeof p.lng === 'function' ? p.lng() : p.lng;
        latest.current.draggable?.onMove({ lat, lng });
      });
      extra.current.push(mk);
      m.moveCamera({ center: props.draggable.location, zoom: 18 });
    }
  }, [props.userLocation, props.draggable?.location.lat, props.draggable?.location.lng, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function fitAll() {
    const m = map.current;
    const pts = latest.current.stops.filter((s) => s.location).map((s) => s.location!);
    if (!m || pts.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    pts.forEach((p) => bounds.extend(p));
    m.fitBounds(bounds, fitPadding(latest.current.bottomInset));
  }

  function centerOnMe() {
    navigator.geolocation?.getCurrentPosition((p) =>
      map.current?.moveCamera({ center: { lat: p.coords.latitude, lng: p.coords.longitude }, zoom: 16 }),
    );
  }

  return (
    <div className="map-wrap">
      <div ref={container} className="map" />
      <FinishTime time={props.finishTime} />
      <MapButtons bottomInset={props.bottomInset} satellite={props.satellite} onToggleSatellite={props.onToggleSatellite} mode={props.mode} onCenter={centerOnMe} onFit={fitAll} onToggleMode={props.onToggleMode} />
    </div>
  );
}
