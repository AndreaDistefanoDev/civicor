import { Check, CornerDownRight, MapPin, MapPinPlus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { withTypedHouseNumber } from '../../domain/address/houseNumber';
import { searchRouteStops, streetCompletions } from '../../domain/address/routeSearch';
import type { LatLng, Stop } from '../../domain/types';
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
  /** Fermate già nel giro: quelle che corrispondono si mostrano per prime ("In questo percorso"). */
  routeStops?: Stop[];
  onOpenStop?: (stopId: string) => void;
}) {
  const [text, setText] = useState('');
  const [showAll, setShowAll] = useState(false);
  const input = useRef<HTMLInputElement>(null);
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

  const inRoute = props.routeStops ? searchRouteStops(props.routeStops, text) : [];
  const shownInRoute = showAll ? inRoute : inRoute.slice(0, 4);
  const completions = streetCompletions(results.map((r) => r.address.street), text);

  const complete = (street: string) => {
    setText(`${street} `);
    input.current?.focus();
  };

  return (
    <div className="autocomplete">
      <div className="search-field">
        <Search size={20} className="search-field-icon" aria-hidden="true" />
        <input
          ref={input}
          aria-label="Cerca indirizzo"
          autoFocus={props.autoFocus}
          placeholder={props.placeholder ?? 'Digita un indirizzo'}
          value={text}
          enterKeyHint="search"
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setShowAll(false);
          }}
        />
        {text && (
          <button className="search-field-clear" aria-label="Cancella" onClick={() => setText('')}>
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      {error && <p className="autocomplete-error">{error}</p>}
      {inRoute.length > 0 && (
        <>
          <div className="section-title autocomplete-title">In questo percorso ({inRoute.length})</div>
          <ul className="autocomplete-list">
            {shownInRoute.map((s) => (
              <li key={s.id}>
                <button className="row" onClick={() => props.onOpenStop?.(s.id)}>
                  <MapPin size={22} className="autocomplete-icon" aria-hidden="true" />
                  <span className="grow">
                    <span className="autocomplete-main">{s.address.street}</span>
                    <span className="autocomplete-sub muted">{s.address.city}</span>
                  </span>
                  {s.eta && <span className="ac-chip num">{s.eta}</span>}
                  {s.outcome === 'done' ? (
                    <span className="ac-chip num done">
                      <Check size={14} strokeWidth={3} aria-label="Effettuata" />
                      ID {s.displayId}
                    </span>
                  ) : (
                    <span className="ac-chip num">ID {s.displayId}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {inRoute.length > shownInRoute.length && (
            <button className="link-btn ac-more" onClick={() => setShowAll(true)}>
              Mostra altre {inRoute.length - shownInRoute.length} fermate di questo percorso
            </button>
          )}
        </>
      )}
      {(results.length > 0 || completions.length > 0) && <div className="section-title autocomplete-title">Aggiungi una nuova fermata</div>}
      <ul className="autocomplete-list">
        {completions.map((street) => (
          <li key={`c-${street}`}>
            <button className="row" aria-label={`Completa: ${street}`} onClick={() => complete(street)}>
              <CornerDownRight size={22} className="autocomplete-icon" aria-hidden="true" />
              <span className="grow autocomplete-main">{street}</span>
            </button>
          </li>
        ))}
        {results.map((s) => (
          <li key={s.placeId ?? `${s.label}-${s.location?.lat}-${s.location?.lng}`}>
            <button className="row" onClick={() => void pick(s)}>
              <MapPinPlus size={22} className="autocomplete-icon" aria-hidden="true" />
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
