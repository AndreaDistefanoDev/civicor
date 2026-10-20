import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { routeFocus } from '../data/manualAdd';
import { getCurrentPosition } from '../device/geolocation';
import type { LatLng } from '../domain/types';

/** Punto di riferimento per i suggerimenti: la posizione del telefono, altrimenti la zona del percorso. */
export function useNearbyFocus(routeId: string): LatLng | undefined {
  const [gps, setGps] = useState<LatLng>();
  const routeCenter = useLiveQuery(() => routeFocus(routeId), [routeId]);
  useEffect(() => {
    let alive = true;
    getCurrentPosition(5000)
      .then((p) => alive && setGps(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return gps ?? routeCenter;
}
