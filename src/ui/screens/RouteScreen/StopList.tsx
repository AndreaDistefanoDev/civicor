import { formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import type { Stop } from '../../../domain/types';

function statusMark(s: Stop) {
  if (s.outcome === 'done') return <span className="mark ok" aria-label="Effettuata">✓</span>;
  if (s.outcome === 'failed') return <span className="mark danger" aria-label="Non riuscita">✕</span>;
  if (s.geoStatus === 'uncertain' || s.geoStatus === 'failed') return <span className="mark warn" aria-label="Da verificare">▲</span>;
  if (s.geoStatus === 'pending') return <span className="mark muted" aria-label="In ricerca">…</span>;
  return null;
}

/** Elenco delle fermate, ordinato per sequenza se ottimizzato, altrimenti per inserimento. */
export function StopList(props: { stops: Stop[]; onOpen: (id: string) => void }) {
  const sorted = [...props.stops].sort((a, b) => (a.sequence ?? a.originalIndex) - (b.sequence ?? b.originalIndex));
  return (
    <ol className="stop-list">
      {sorted.map((s) => (
        <li key={s.id}>
          <button className="stop-row" onClick={() => props.onOpen(s.id)}>
            <span className="stop-row-num num">{s.eta ?? String(s.displayId).padStart(2, '0')}</span>
            <span className="grow">
              <span className="stop-row-line">{formatAddressLine(s.address)}</span>
              <span className="stop-row-city muted">
                {formatAddressCity(s.address)}
                {s.packages > 1 ? ` · ${s.packages} pacchi` : ''}
              </span>
            </span>
            {statusMark(s)}
            <span className="id-badge num">ID {s.displayId}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
