import { useEffect, useState } from 'react';
import { geocodeQueue } from '../appServices';

/** Stato della ricerca delle posizioni (in attesa, errore) letto dalla coda condivisa. */
export function useGeocodeStatus() {
  const read = () => ({ pending: geocodeQueue.pendingCount(), error: geocodeQueue.lastError() });
  const [status, setStatus] = useState(read);
  useEffect(() => geocodeQueue.onChange(() => setStatus(read())), []);
  return status;
}

/** Riga di stato: "Ricerca indirizzi ferma: …" con accesso alle Impostazioni, oppure "N in corso". */
export function GeocodeStatusBar(props: { onOpenSettings: () => void }) {
  const { pending, error } = useGeocodeStatus();
  if (error) {
    const needsUser = error.reason === 'missing_key' || error.reason === 'bad_key';
    return (
      <div className="geo-status error" role="alert">
        <span>
          {needsUser ? 'Ricerca indirizzi ferma: ' : 'Ricerca indirizzi in pausa, riprovo: '}
          {error.message}
        </span>
        {needsUser && (
          <button className="link-btn" onClick={props.onOpenSettings}>
            Impostazioni
          </button>
        )}
      </div>
    );
  }
  if (pending > 0) return <div className="geo-status muted" role="status">Ricerca posizioni: {pending} in corso</div>;
  return null;
}
