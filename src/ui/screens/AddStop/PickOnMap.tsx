import { useMemo, useState } from 'react';
import { addStopAtLocation } from '../../../data/manualAdd';
import type { LatLng } from '../../../domain/types';
import { Screen } from '../../common/ui';
import { MapView } from '../../map/MapView';
import './AddStop.css';

export function PickOnMap(props: { routeId: string; start: LatLng; theme: 'dark' | 'light'; onDone: () => void; onClose: () => void }) {
  const [point, setPoint] = useState(props.start);
  const [name, setName] = useState('');
  const draggable = useMemo(() => ({ location: point, onMove: setPoint }), [point]);

  return (
    <Screen
      title="Scegli sulla mappa"
      onClose={props.onClose}
      footer={
        <button
          className="btn-primary"
          onClick={async () => {
            await addStopAtLocation(props.routeId, point, name);
            props.onDone();
          }}
        >
          Aggiungi qui
        </button>
      }
    >
      <div className="pick-map">
        <MapView stops={[]} theme={props.theme} draggable={draggable} />
      </div>
      <label className="field">
        <span>Nome della fermata (facoltativo)</span>
        <input value={name} placeholder="Punto sulla mappa" onChange={(e) => setName(e.target.value)} />
      </label>
    </Screen>
  );
}
