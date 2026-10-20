import { useEffect, useMemo, useState } from 'react';
import { listStops, patchStop, saveCorrection } from '../../../data/repos';
import { addressKey, formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import type { LatLng, Stop } from '../../../domain/types';
import { Screen } from '../../common/ui';
import { MapView } from '../../map/MapView';
import './VerifyScreen.css';

const RAGUSA: LatLng = { lat: 36.9258, lng: 14.7306 };
const needsCheck = (s: Stop) => s.geoStatus === 'uncertain' || s.geoStatus === 'failed';

/** Mostra una alla volta le fermate con posizione incerta; il punto corretto viene ricordato per sempre. */
export function VerifyScreen(props: { routeId: string; theme: 'dark' | 'light'; onFinish: () => void; onClose: () => void }) {
  const [queue, setQueue] = useState<Stop[] | null>(null);
  const [fallback, setFallback] = useState<LatLng>(RAGUSA);
  const [index, setIndex] = useState(0);
  const [point, setPoint] = useState<LatLng>();

  useEffect(() => {
    void listStops(props.routeId).then((stops) => {
      const todo = stops.filter(needsCheck);
      setFallback(stops.find((s) => s.geoStatus === 'ok' && s.location)?.location ?? RAGUSA);
      setQueue(todo);
      if (todo.length === 0) props.onFinish();
    });
    // Elenco fissato all'apertura: le fermate confermate non spariscono a metà.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.routeId]);

  const current = queue?.[index];
  useEffect(() => setPoint(current?.location ?? fallback), [current, fallback]);
  const draggable = useMemo(() => (point ? { location: point, onMove: setPoint } : undefined), [point]);

  if (!queue || !current || !point) return null;

  const next = () => {
    if (index + 1 >= queue.length) props.onFinish();
    else setIndex(index + 1);
  };

  const confirm = async () => {
    await patchStop(current.id, { geoStatus: 'ok', location: point, geoReason: undefined });
    await saveCorrection(addressKey(current.address), point, formatAddressLine(current.address));
    next();
  };

  const remaining = queue.length - index;
  return (
    <Screen title={`${remaining} ${remaining === 1 ? 'indirizzo' : 'indirizzi'} da verificare`} onClose={props.onClose}>
      <div className="verify-map">
        <MapView stops={[]} theme={props.theme} draggable={draggable} />
        <span className="verify-hint">Trascina il punto sull'ingresso giusto</span>
      </div>
      <div className="verify-info">
        <h2 className="verify-line">{formatAddressLine(current.address)}</h2>
        <div className="muted">{formatAddressCity(current.address)}</div>
        {current.geoReason && <div className="verify-reason">{current.geoReason}</div>}
        {current.senderNotes && (
          <div className="verify-notes">
            <span className="muted">Note dell'etichetta</span>
            <div>{current.senderNotes}</div>
          </div>
        )}
        <button className="btn-primary" onClick={confirm}>
          Conferma posizione
        </button>
        <p className="verify-remember muted">La correzione viene ricordata per le prossime volte</p>
        <button className="link-btn verify-skip" onClick={next}>
          Salta per ora
        </button>
      </div>
    </Screen>
  );
}
