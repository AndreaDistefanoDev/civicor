import { AlertTriangle, Check, Clock, Package, X } from 'lucide-react';
import { formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import type { Stop } from '../../../domain/types';
import { failReasonLabel } from './StopCard';

function status(s: Stop) {
  if (s.outcome === 'done') return <Check size={18} className="st ok" aria-label="Effettuata" />;
  if (s.outcome === 'failed') return <X size={18} className="st danger" aria-label="Non riuscita" />;
  if (s.geoStatus === 'uncertain' || s.geoStatus === 'failed')
    return <AlertTriangle size={18} className="st warn" aria-label="Da verificare" />;
  if (s.geoStatus === 'pending') return <Clock size={18} className="st muted" aria-label="In ricerca" />;
  return null;
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Elenco delle fermate a "linea del tempo": a sinistra numero d'ordine e orario previsto,
 * al centro indirizzo e città, a destra l'ID della fermata. Prima dell'ottimizzazione al posto del numero c'è un punto.
 */
export function StopList(props: { stops: Stop[]; onOpen: (id: string) => void }) {
  const sorted = [...props.stops].sort((a, b) => (a.sequence ?? a.originalIndex) - (b.sequence ?? b.originalIndex));
  return (
    <ol className="stop-list">
      {sorted.map((s, i) => {
        const closed = s.outcome !== 'pending';
        return (
          <li key={s.id}>
            <button className={`tl-row${closed ? ' closed' : ''}`} onClick={() => props.onOpen(s.id)}>
              <span className="tl-left">
                {s.sequence !== undefined ? <span className="tl-num num">{two(i + 1)}</span> : <span className="tl-dot" aria-hidden="true" />}
                {s.eta && <span className="tl-time num">{s.eta}</span>}
              </span>
              <span className="grow">
                <span className="tl-title">{formatAddressLine(s.address)}</span>
                <span className="tl-sub">
                  {s.outcome === 'failed' && s.failReason ? failReasonLabel(s.failReason) : formatAddressCity(s.address)}
                  {s.packages > 1 && (
                    <span className="tl-pkgs">
                      <Package size={13} aria-hidden="true" /> {s.packages}
                    </span>
                  )}
                </span>
              </span>
              <span className="tl-end">
                {status(s)}
                <span className="tl-chip num">ID {s.displayId}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
