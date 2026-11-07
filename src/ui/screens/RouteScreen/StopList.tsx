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

/** Elenco delle fermate, ordinato per sequenza se ottimizzato, altrimenti per inserimento. */
export function StopList(props: { stops: Stop[]; onOpen: (id: string) => void }) {
  const sorted = [...props.stops].sort((a, b) => (a.sequence ?? a.originalIndex) - (b.sequence ?? b.originalIndex));
  return (
    <ol className="stop-list">
      {sorted.map((s) => {
        const closed = s.outcome !== 'pending';
        const uncertain = !closed && (s.geoStatus === 'uncertain' || s.geoStatus === 'failed');
        return (
          <li key={s.id}>
            <button className={`stop-row${closed ? ' closed' : ''}`} onClick={() => props.onOpen(s.id)}>
              <span className={`plate${closed ? ' done' : uncertain ? ' warn' : ''}`} aria-label={`ID ${s.displayId}`}>
                {s.displayId}
              </span>
              <span className="grow">
                <span className="stop-row-line">{formatAddressLine(s.address)}</span>
                <span className="stop-row-city">
                  {s.outcome === 'failed' && s.failReason ? failReasonLabel(s.failReason) : formatAddressCity(s.address)}
                  {s.packages > 1 && (
                    <span className="stop-row-pkgs">
                      <Package size={13} aria-hidden="true" /> {s.packages}
                    </span>
                  )}
                </span>
              </span>
              <span className="stop-row-end">
                {s.eta && <span className="stop-row-eta num">{s.eta}</span>}
                {status(s)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
