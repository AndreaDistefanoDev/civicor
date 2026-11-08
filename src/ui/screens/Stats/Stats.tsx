import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { listFailedStops, loadMonth } from '../../../data/statsStore';
import { hardAddresses, monthStats, type DaySummary } from '../../../domain/stats/stats';
import { Screen } from '../../common/ui';
import { monthLabel, shortDate } from '../../dates';
import { failReasonLabel } from '../RouteScreen/StopCard';
import './Stats.css';

const comma = (n: number) => String(n).replace('.', ',');

/** 'YYYY-MM' spostato di n mesi. */
function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daySub(d: DaySummary): string {
  return [
    `${d.packagesDelivered} pacchi`,
    d.failed ? `${d.failed} mancate` : '',
    d.pickups ? `${d.pickups} ritiri` : '',
    d.km !== undefined ? `${comma(d.km)} km` : '',
    d.start && d.end ? `${d.start}–${d.end}` : '',
  ].filter(Boolean).join(' · ');
}

/** "I miei numeri": medie del mese, mancate, contrassegni, indirizzi difficili e tutti i giri fatti. */
export function Stats(props: { month: string; currentMonth: string; today?: string; onOpenRoute: (id: string) => void; onClose: () => void }) {
  const [month, setMonth] = useState(props.month);
  const data = useLiveQuery(() => loadMonth(month), [month]);
  const failedAll = useLiveQuery(listFailedStops, []);
  const stats = data && monthStats(data.days, data.failed, props.today);
  const hard = failedAll ? hardAddresses(failedAll) : [];

  const tiles: Array<[string, string]> = stats
    ? [
        ['Pacchi consegnati', String(stats.packagesDelivered)],
        ['Media pacchi al giorno', String(stats.avgPackagesPerDay)],
        ['Fermate al giorno', String(stats.avgStopsPerDay)],
        ['Consegne riuscite', stats.successRate === undefined ? '—' : `${stats.successRate}%`],
        ['Giorni lavorati', String(stats.workDays)],
        ['Km', comma(stats.km)],
        ['Fine giro media', stats.avgEnd ?? '—'],
        ['Minuti per fermata', stats.avgMinutesPerStop === undefined ? '—' : comma(stats.avgMinutesPerStop)],
      ]
    : [];

  return (
    <Screen title="I miei numeri" onClose={props.onClose}>
      <div className="stats-month">
        <button className="icon-btn" aria-label="Mese precedente" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="stats-month-label">{monthLabel(`${month}-01`)}</span>
        <button
          className="icon-btn"
          aria-label="Mese successivo"
          disabled={month >= props.currentMonth}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {stats && stats.workDays === 0 && <p className="stats-empty muted">Nessun giro in questo mese</p>}

      {stats && stats.workDays > 0 && (
        <>
          <div className="stats-tiles" role="group" aria-label="Numeri del mese">
            {tiles.map(([label, value]) => (
              <div key={label} className="stats-tile">
                <span className="stats-tile-label">{label}</span>
                <span className="stats-tile-value num">{value}</span>
              </div>
            ))}
          </div>
          <p className="stats-note muted">Km del percorso calcolato: con le deviazioni quelli guidati sono un po' di più.</p>

          {stats.failedByReason.length > 0 && (
            <>
              <div className="section-title">Mancate per motivo</div>
              <div className="card stats-card">
                {stats.failedByReason.map(([reason, n]) => (
                  <div key={reason} className="stats-line">
                    {failReasonLabel(reason)}: {n}
                  </div>
                ))}
              </div>
            </>
          )}

        </>
      )}

      {hard.length > 0 && (
        <>
          <div className="section-title">Indirizzi difficili</div>
          <div className="card">
            {hard.map((h) => (
              <div key={`${h.street}|${h.city}`} className="row">
                <span className="grow">
                  <span className="row-title">{h.street}</span>
                  <span className="row-sub">
                    {h.city} · {h.count} volte{h.lastReason ? ` · ultima: ${failReasonLabel(h.lastReason).toLowerCase()}` : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {data && data.days.length > 0 && (
        <>
          <div className="section-title">Giri effettuati</div>
          <ul className="card stats-routes" aria-label="Giri effettuati">
            {data.days.map((d) => (
              <li key={d.routeId}>
                <button className="row" onClick={() => props.onOpenRoute(d.routeId)}>
                  <span className="stats-route-date num">{shortDate(d.date)}</span>
                  <span className="grow">
                    <span className="row-title">{d.name}</span>
                    <span className="row-sub">{daySub(d)}</span>
                  </span>
                  <ChevronRight size={18} className="chev" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}
