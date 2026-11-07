import { useLiveQuery } from 'dexie-react-hooks';
import { Check, CircleCheckBig, Flag, Navigation, ShieldCheck } from 'lucide-react';
import { completeRoute, markOutcome, nextStop, postponeStop, routeSummary, undoOutcome, upcomingStops } from '../../../data/outcomes';
import { getSettings, patchStop, updateRoute } from '../../../data/repos';
import { openExternal } from '../../../device/openExternal';
import { lastBackupLabel } from '../../../domain/backup/lastBackup';
import { codTotals, formatEuro } from '../../../domain/cod/cod';
import { buildNavigationAppUrl, buildNavigationUrl } from '../../../domain/nav/navLinks';
import type { CodMethod, FailReason, LatLng, NavApp, Route, Stop } from '../../../domain/types';
import { downloadBackup } from '../../backupDownload';
import { useAppState } from '../../useAppState';
import { FAIL_REASONS, StopCard, failReasonLabel } from './StopCard';
import { StopList } from './StopList';

/** Sincrona: deve partire dentro il tocco, senza attese. */
function navigate(to: LatLng | undefined, app: NavApp) {
  if (!to) return;
  openExternal(buildNavigationAppUrl(app, to), buildNavigationUrl(app, to));
}

/** Fine giornata: cosa riportare in sede (mancate per motivo, contrassegni). */
function DayReport(props: { stops: Stop[] }) {
  const failed = props.stops.filter((s) => s.outcome === 'failed');
  const cod = codTotals(props.stops);
  const reasons = FAIL_REASONS.map(([r, label]) => [label, failed.filter((s) => (s.failReason ?? 'other') === r).length] as const)
    .filter(([, n]) => n > 0);
  if (reasons.length === 0 && cod.count === 0) return null;
  return (
    <div className="card day-report">
      {reasons.length > 0 && (
        <div className="day-report-block">
          <div className="day-report-title">Mancate</div>
          {reasons.map(([label, n]) => (
            <div key={label} className="day-report-line">{label}: {n}</div>
          ))}
        </div>
      )}
      {cod.count > 0 && (
        <div className="day-report-block">
          <div className="day-report-title">Contrassegni</div>
          <div className="day-report-line num">Contanti: {formatEuro(cod.cash)}</div>
          <div className="day-report-line num">POS: {formatEuro(cod.pos)}</div>
          {cod.returned > 0 && <div className="day-report-line num">Da riportare: {formatEuro(cod.returned)}</div>}
          {cod.toCollect > 0 && <div className="day-report-line num">Ancora da incassare: {formatEuro(cod.toCollect)}</div>}
        </div>
      )}
    </div>
  );
}

export function CompletedCard(props: { stops: Stop[]; onNewRoute: () => void }) {
  const s = routeSummary(props.stops);
  const settings = useLiveQuery(getSettings, []);
  return (
    <div className="completed-card">
      <div className="completed-check" aria-hidden="true">
        <CircleCheckBig size={30} />
      </div>
      <h3>Percorso completato!</h3>
      <div className="completed-stats">
        <span>{s.done} fermate</span>
        <span>{s.failed} fermate mancate</span>
      </div>
      <DayReport stops={props.stops} />
      <button className="btn-secondary" onClick={() => void downloadBackup()}>
        <ShieldCheck size={20} aria-hidden="true" />
        Salva copia di sicurezza
      </button>
      <p className="completed-backup muted">Ultima copia: {lastBackupLabel(settings?.lastBackupAt, Date.now())}</p>
      <button className="btn-primary" onClick={props.onNewRoute}>
        Crea nuovo percorso
      </button>
    </div>
  );
}

/** Barra di avanzamento del giro: fermate chiuse (fatte o non riuscite) sul totale. */
export function RouteProgress(props: { stops: Stop[] }) {
  const closed = props.stops.filter((s) => s.outcome !== 'pending').length;
  const total = props.stops.length;
  return (
    <div className="route-progress">
      <div
        className="route-progress-bar"
        role="progressbar"
        aria-label="Avanzamento del giro"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={closed}
      >
        <span style={{ width: `${total ? (closed / total) * 100 : 0}%` }} />
      </div>
      <span className="route-progress-text num">
        {closed}/{total}
      </span>
    </div>
  );
}

/** Percorso confermato, in corso e completato. */
export function Guidance(props: { route: Route; stops: Stop[] }) {
  const app = useAppState();
  const settings = useLiveQuery(getSettings, []);
  const { route, stops } = props;
  if (!settings) return null;
  const navApp = settings.navApp;
  const openStop = (id: string) => app.openScreen('stopDetail', { stopId: id });

  if (route.status === 'confirmed') {
    return (
      <>
        <StopList stops={stops} onOpen={openStop} />
        <div className="sheet-actions two">
          <button className="btn-secondary" onClick={() => void updateRoute(route.id, { status: 'optimized' })}>
            Modifica
          </button>
          <button className="btn-primary" onClick={() => void updateRoute(route.id, { status: 'in_progress' })}>
            Avvia percorso
          </button>
        </div>
      </>
    );
  }

  if (route.status === 'completed') return <CompletedCard stops={stops} onNewRoute={() => app.openScreen('createRoute')} />;

  const current = nextStop(stops);
  const ordered = [...stops].sort((a, b) => (a.sequence ?? a.originalIndex) - (b.sequence ?? b.originalIndex));

  const done = async (stop: Stop, codMethod?: CodMethod) => {
    const { previous } = await markOutcome(stop.id, 'done', { codMethod });
    app.showToast(`Fermata ${stop.displayId} contrassegnata come effettuata`, {
      label: 'Annulla',
      onPress: () => void undoOutcome(stop.id, previous),
    });
  };
  const failed = async (stop: Stop, failReason: FailReason, attempt: 1 | 2) => {
    const { previous } = await markOutcome(stop.id, 'failed', { failReason, attempt });
    app.showToast(`Fermata ${stop.displayId} non riuscita: ${failReasonLabel(failReason).toLowerCase()} (${attempt}° tentativo)`, {
      label: 'Annulla',
      onPress: () => void undoOutcome(stop.id, previous),
    });
  };
  const postpone = async (stop: Stop) => {
    const previous = await postponeStop(stop.id);
    if (!previous) return;
    app.showToast(`Fermata ${stop.displayId} spostata in fondo`, {
      label: 'Annulla',
      onPress: () => void patchStop(stop.id, previous),
    });
  };

  if (!current) {
    const end = route.settings.end;
    const endPoint = end.mode === 'return' ? route.startLocation : end.mode === 'address' ? end.location : undefined;
    if (!endPoint) return <CompletedCard stops={stops} onNewRoute={() => app.openScreen('createRoute')} />;
    return (
      <>
        <RouteProgress stops={stops} />
        <section className="stop-card" aria-label="Rientro">
          <div className="stop-card-head">
            <span className="plate lg" aria-hidden="true">
              <Flag size={20} />
            </span>
            <div className="grow">
              <div className="stop-card-kicker">Posizione finale{route.totals ? ` · ${route.totals.endTime}` : ''}</div>
              <h3 className="stop-card-line">{end.mode === 'address' ? end.address.street : 'Posizione iniziale'}</h3>
            </div>
          </div>
          <button className="btn-primary stop-card-nav" onClick={() => navigate(endPoint, navApp)}>
            <Navigation size={20} aria-hidden="true" />
            Naviga
          </button>
          <div className="stop-card-outcomes single">
            <button className="outcome done" onClick={() => void completeRoute(route.id)}>
              <Check size={20} aria-hidden="true" />
              Percorso completato
            </button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <RouteProgress stops={stops} />
      <StopCard
        stop={current}
        position={ordered.indexOf(current) + 1}
        total={stops.length}
        upcoming={upcomingStops(stops, current.id, 2)}
        onNavigate={(chosen) => navigate(current.location, chosen ?? navApp)}
        onDone={(codMethod) => void done(current, codMethod)}
        onFailed={(reason, attempt) => void failed(current, reason, attempt)}
        onPostpone={() => void postpone(current)}
        onOpen={() => openStop(current.id)}
      />
      <div className="section-title">Tutte le fermate</div>
      <StopList stops={stops} onOpen={openStop} />
      <div className="list-end">
        <button className="btn-ghost" onClick={() => void completeRoute(route.id)}>
          Contrassegna percorso come completato
        </button>
      </div>
    </>
  );
}
