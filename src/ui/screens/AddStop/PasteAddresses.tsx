import { useState } from 'react';
import { addStopsFromText } from '../../../data/manualAdd';
import { parseAddressLines } from '../../../domain/paste';
import type { Geocoder } from '../../../services/geocoder';
import { Screen } from '../../common/ui';
import './AddStop.css';

export function PasteAddresses(props: { routeId: string; geocoder: Geocoder; onDone: () => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const lines = parseAddressLines(text);

  return (
    <Screen
      title="Incolla indirizzi"
      onClose={props.onClose}
      footer={
        <button
          className="btn-primary"
          disabled={lines.length === 0 || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await addStopsFromText(props.routeId, lines, props.geocoder);
              props.onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Ricerca non riuscita');
              setBusy(false);
            }
          }}
        >
          {busy ? 'Ricerca in corso…' : `Aggiungi ${lines.length} indirizzi`}
        </button>
      }
    >
      <label className="field">
        <span>Un indirizzo per riga</span>
        <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Via Esempio 12, Ragusa\nCorso Modello 4, Ragusa'} />
      </label>
      {error && <p className="autocomplete-error">{error}</p>}
    </Screen>
  );
}
