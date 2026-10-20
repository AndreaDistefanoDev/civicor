import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { addStopFromSuggestion, changeStopAddress, routeFocus } from '../../../data/manualAdd';
import type { LatLng } from '../../../domain/types';
import type { Geocoder } from '../../../services/geocoder';
import { geocodeQueue } from '../../appServices';
import { AddressAutocomplete } from '../../common/AddressAutocomplete';
import { Screen } from '../../common/ui';
import './AddStop.css';

/** Ricerca con suggerimenti; con `stopId` cambia l'indirizzo di quella fermata invece di aggiungerne una. */
export function AddressSearch(props: {
  routeId: string;
  stopId?: string;
  geocoder: Geocoder;
  focus?: LatLng;
  onClose: () => void;
  onPickOnMap: () => void;
  onPaste: () => void;
}) {
  const [added, setAdded] = useState<string>();
  const routeCenter = useLiveQuery(() => routeFocus(props.routeId), [props.routeId]);
  const focus = props.focus ?? routeCenter;
  const [round, setRound] = useState(0);

  return (
    <Screen title={props.stopId ? 'Cambia indirizzo' : 'Aggiungi fermata'} onClose={props.onClose}>
      {added && (
        <p className="added-banner" role="status">
          Aggiunta ✓ {added}
        </p>
      )}
      <AddressAutocomplete
        key={round}
        geocoder={props.geocoder}
        focus={focus}
        autoFocus
        placeholder="Digita fermate"
        onPick={async (s) => {
          if (props.stopId) {
            await changeStopAddress(props.stopId, s);
            props.onClose();
            return;
          }
          const stop = await addStopFromSuggestion(props.routeId, s);
          if (stop.geoStatus === 'pending') geocodeQueue.enqueue(stop.id);
          setAdded(stop.address.street);
          setRound(round + 1); // campo vuoto per la fermata successiva
        }}
        footer={
          !props.stopId && (
            <div className="add-alt">
              <button className="row" onClick={props.onPickOnMap}>
                Scegli sulla mappa
              </button>
              <button className="row" onClick={props.onPaste}>
                Incolla una lista di indirizzi
              </button>
            </div>
          )
        }
      />
    </Screen>
  );
}
