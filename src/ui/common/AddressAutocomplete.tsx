import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '../../domain/types';
import type { AddressSuggestion, Geocoder } from '../../services/geocoder';
import { OrsError } from '../../services/ors/orsClient';

export const AUTOCOMPLETE_DELAY_MS = 250;
export const AUTOCOMPLETE_MIN_CHARS = 3;

/** Campo di ricerca indirizzo con suggerimenti (attesa tra i tasti, minimo 3 caratteri). */
export function AddressAutocomplete(props: {
  geocoder: Geocoder;
  focus?: LatLng;
  autoFocus?: boolean;
  placeholder?: string;
  onPick: (s: AddressSuggestion) => void;
  footer?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [error, setError] = useState<string>();
  const seq = useRef(0);

  useEffect(() => {
    const query = text.trim();
    if (query.length < AUTOCOMPLETE_MIN_CHARS) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    const id = setTimeout(async () => {
      try {
        const r = await props.geocoder.autocomplete(query, props.focus);
        if (mine === seq.current) {
          setResults(r);
          setError(undefined);
        }
      } catch (e) {
        if (mine === seq.current) setError(e instanceof OrsError ? e.message : 'Ricerca non riuscita');
      }
    }, AUTOCOMPLETE_DELAY_MS);
    return () => clearTimeout(id);
    // Il geocoder e il punto di riferimento non cambiano durante la digitazione.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="autocomplete">
      <div className="field">
        <input
          aria-label="Cerca indirizzo"
          autoFocus={props.autoFocus}
          placeholder={props.placeholder ?? 'Digita un indirizzo'}
          value={text}
          enterKeyHint="search"
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {error && <p className="autocomplete-error">{error}</p>}
      <ul className="autocomplete-list">
        {results.map((s) => (
          <li key={`${s.label}-${s.location.lat}-${s.location.lng}`}>
            <button className="row" onClick={() => props.onPick(s)}>
              <span className="grow">
                <span className="autocomplete-main">{s.address.street}</span>
                <span className="autocomplete-sub muted">{s.label}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {props.footer}
    </div>
  );
}
