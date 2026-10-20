import { useEffect, useRef, useState } from 'react';
import { withTypedHouseNumber } from '../../domain/address/houseNumber';
import type { LatLng } from '../../domain/types';
import { resolveSuggestion, type AddressSuggestion, type Geocoder, type LocatedSuggestion } from '../../services/geocoder';
import { OrsError } from '../../services/ors/orsClient';
import './common.css';

export const AUTOCOMPLETE_DELAY_MS = 250;
export const AUTOCOMPLETE_MIN_CHARS = 3;

/** 850 → "850 m", 1150 → "1,2 km", 23400 → "23 km" */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  if (m < 10000) return `${String(Math.round(m / 100) / 10).replace('.', ',')} km`;
  return `${Math.round(m / 1000)} km`;
}

/** Campo di ricerca indirizzo con suggerimenti (attesa tra i tasti, minimo 3 caratteri). */
export function AddressAutocomplete(props: {
  geocoder: Geocoder;
  focus?: LatLng;
  autoFocus?: boolean;
  placeholder?: string;
  /** Riceve il suggerimento completo di posizione (letto dal fornitore se serve). */
  onPick: (s: LocatedSuggestion) => void;
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
          setResults(r.map((s) => withTypedHouseNumber(s, query)));
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

  const pick = async (s: AddressSuggestion) => {
    try {
      // Il civico scritto resta anche se il luogo letto ha solo la via.
      props.onPick(withTypedHouseNumber(await resolveSuggestion(props.geocoder, s), text) as LocatedSuggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Indirizzo non disponibile');
    }
  };

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
          <li key={s.placeId ?? `${s.label}-${s.location?.lat}-${s.location?.lng}`}>
            <button className="row" onClick={() => void pick(s)}>
              <span className="grow">
                <span className="autocomplete-main">{s.address.street}</span>
                <span className="autocomplete-sub muted">{s.label}</span>
                {s.precision !== 'house' && /\d/.test(s.address.street) && (
                  <span className="autocomplete-warn">civico da verificare</span>
                )}
              </span>
              {s.distanceMeters !== undefined && <span className="autocomplete-dist num">{formatDistance(s.distanceMeters)}</span>}
            </button>
          </li>
        ))}
      </ul>
      {props.footer}
    </div>
  );
}
