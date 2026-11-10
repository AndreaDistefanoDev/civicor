import { Mic, Square } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { addStopFromSuggestion } from '../../../data/manualAdd';
import { withTypedHouseNumber } from '../../../domain/address/houseNumber';
import { createSpeechInput } from '../../../device/speech';
import type { LatLng } from '../../../domain/types';
import { resolveSuggestion, type Geocoder } from '../../../services/geocoder';
import { AddressAutocomplete } from '../../common/AddressAutocomplete';
import { Screen } from '../../common/ui';
import { useNearbyFocus } from '../../useNearbyFocus';
import './AddStop.css';

/**
 * "Pronuncia indirizzo": ogni frase riconosciuta diventa una fermata (primo suggerimento).
 * Dopo ogni fermata aggiunta si rimette in ascolto da sola, finché non si tocca il cerchio.
 */
export function VoiceInput(props: { routeId: string; geocoder: Geocoder; focus?: LatLng; onClose: () => void }) {
  const speech = useMemo(() => createSpeechInput('it-IT'), []);
  const nearby = useNearbyFocus(props.routeId);
  const focus = props.focus ?? nearby;
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  const [justAdded, setJustAdded] = useState(false);
  // Su iPhone il riconoscimento nelle web app installate a volte si rifiuta: si passa alla tastiera.
  const [failed, setFailed] = useState(false);
  const keepGoing = useRef(false);
  // L'ultima frase in lavorazione: true se è diventata una fermata.
  const pending = useRef<Promise<boolean>>(Promise.resolve(false));

  const add = async (text: string) => {
    setJustAdded(false);
    try {
      const [first] = await props.geocoder.autocomplete(text, focus);
      if (!first) {
        setMessage(`Non trovato: "${text}"`);
        return false;
      }
      const located = await resolveSuggestion(props.geocoder, first);
      const stop = await addStopFromSuggestion(props.routeId, withTypedHouseNumber(located, text) as typeof located);
      setHeard((h) => [stop.address.street, ...h]);
      setMessage(undefined);
      setJustAdded(true);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ricerca non riuscita');
      return false;
    }
  };

  const listen = (continuous: boolean) => {
    keepGoing.current = !continuous;
    pending.current = Promise.resolve(false);
    setListening(true);
    speech.start({
      continuous,
      onFinal: (text) => (pending.current = add(text)),
      onEnd: async () => {
        setListening(false);
        // Fermata aggiunta: si ascolta di nuovo per la prossima, senza toccare niente.
        if ((await pending.current) && keepGoing.current) listen(false);
      },
      onError: () => {
        keepGoing.current = false;
        setFailed(true);
      },
    });
  };

  const stop = () => {
    keepGoing.current = false;
    speech.stop();
  };

  if (!speech.supported || failed) {
    return (
      <Screen title="Pronuncia indirizzo" onClose={props.onClose}>
        <p className="voice-fallback muted">Usa il microfono della tastiera per dettare l'indirizzo</p>
        <AddressAutocomplete geocoder={props.geocoder} focus={focus} autoFocus onPick={(s) => void addStopFromSuggestion(props.routeId, s).then(() => props.onClose())} />
      </Screen>
    );
  }

  return (
    <Screen title="Pronuncia indirizzo" onClose={() => { stop(); props.onClose(); }}>
      <div className="voice">
        <span className="muted">Italiano (Italia)</span>
        <button
          className={`voice-orb${listening ? ' listening' : ''}`}
          aria-label={listening ? 'Ferma ascolto' : 'Inizia ascolto'}
          onClick={() => (listening ? stop() : listen(false))}
        >
          {listening ? <Square size={36} fill="currentColor" aria-hidden="true" /> : <Mic size={48} aria-hidden="true" />}
        </button>
        <p className="voice-prompt">{listening ? 'Ti ascolto…' : 'Tocca e pronuncia un indirizzo'}</p>
        {message && <p className="voice-message">{message}</p>}
        {justAdded && (
          <p className="voice-added" role="status">
            Fermata aggiunta! Parla per aggiungerne un'altra
          </p>
        )}
        <button className="btn-secondary" onClick={() => listen(true)} disabled={listening}>
          Pronuncia più indirizzi
        </button>
        {heard.length > 0 && (
          <ul className="voice-heard">
            {heard.map((h, i) => (
              <li key={`${h}-${i}`}>✓ {h}</li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}
