import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { addStopFromSuggestion, routeFocus } from '../../../data/manualAdd';
import { createSpeechInput } from '../../../device/speech';
import type { LatLng } from '../../../domain/types';
import type { Geocoder } from '../../../services/geocoder';
import { AddressAutocomplete } from '../../common/AddressAutocomplete';
import { Screen } from '../../common/ui';
import './AddStop.css';

/** "Pronuncia indirizzo": ogni frase riconosciuta diventa una fermata (primo suggerimento). */
export function VoiceInput(props: { routeId: string; geocoder: Geocoder; focus?: LatLng; onClose: () => void }) {
  const speech = useMemo(() => createSpeechInput('it-IT'), []);
  const routeCenter = useLiveQuery(() => routeFocus(props.routeId), [props.routeId]);
  const focus = props.focus ?? routeCenter;
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  // Su iPhone il riconoscimento nelle web app installate a volte si rifiuta: si passa alla tastiera.
  const [failed, setFailed] = useState(false);

  const onFinal = async (text: string) => {
    try {
      const [first] = await props.geocoder.autocomplete(text, focus);
      if (!first) {
        setMessage(`Non trovato: "${text}"`);
        return;
      }
      const stop = await addStopFromSuggestion(props.routeId, first);
      setHeard((h) => [stop.address.street, ...h]);
      setMessage(undefined);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ricerca non riuscita');
    }
  };

  const listen = (continuous: boolean) => {
    setListening(true);
    speech.start({ continuous, onFinal, onEnd: () => setListening(false), onError: () => setFailed(true) });
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
    <Screen title="Pronuncia indirizzo" onClose={() => { speech.stop(); props.onClose(); }}>
      <div className="voice">
        <span className="muted">Italiano (Italia)</span>
        <button
          className={`voice-orb${listening ? ' listening' : ''}`}
          aria-label={listening ? 'Ferma ascolto' : 'Inizia ascolto'}
          onClick={() => (listening ? speech.stop() : listen(false))}
        />
        <p className="voice-prompt">{listening ? 'Ti ascolto…' : 'Tocca e pronuncia un indirizzo'}</p>
        {message && <p className="voice-message">{message}</p>}
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
