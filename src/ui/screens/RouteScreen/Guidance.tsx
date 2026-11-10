import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronDown, ChevronUp, CircleCheckBig, CopyPlus, Map as MapIcon, Navigation, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { completeRoute, markOutcome, nextStop, routeSummary, undoOutcome, upcomingStops } from '../../../data/outcomes';
import { duplicateRoute, getSettings, updateRoute } from '../../../data/repos';
import { openExternal } from '../../../device/openExternal';
import { lastBackupLabel } from '../../../domain/backup/lastBackup';
import { buildNavigationAppUrl, buildNavigationUrl } from '../../../domain/nav/navLinks';
import type { FailReason, LatLng, NavApp, Route, Stop } from '../../../domain/types';
import { downloadBackup } from '../../backupDownload';
import { formatDuration } from '../../dates';
import { useAppState } from '../../useAppState';
import { FAIL_REASONS, StopCard, failReasonLabel } from './StopCard';
import { StopList } from './StopList';

/** Sincrona: deve partire dentro il tocco, senza attese. */
function navigate(to: LatLng | undefined, app: NavApp) {
  if (!to) return;
  openExternal(buildNavigationAppUrl(app, to), buildNavigationUrl(app, to));
}

/** Fine giornata: consegne mancate per motivo, da riportare in sede. */
function DayReport(props: { stops: Stop[] }) {
  const failed = props.stops.filter((s) => s.outcome === 'failed');
  const reasons = FAIL_REASONS.map(([r, label]) => [label, failed.filter((s) => (s.failReason ?? 'other') === r).length] as const)
    .filter(([, n]) => n > 0);
  if (reasons.length === 0) return null;
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
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function CompletedCard(props: { stops: Stop[]; onNewRoute: () => void; onCopyStops?: () => void }) {
  const s = routeSummary(props.stops);
  const settings = useLiveQuery(getSettings, []);
  return (
    <div className="completed-card">
      <div className="completed-check" aria-hidden="true">
        <CircleCheckBig size={30} />
      </div>
      <h3>Percorso completato!</h3>
      <div className="completed-stats">
        <span>{plural(s.done, 'fermata', 'fermate')}</span>
        <span>{plural(s.failed, 'fermata mancata', 'fermate mancate')}</span>
      </div>
      {props.onCopyStops && (
        <button className="btn-secondary completed-copy" onClick={props.onCopyStops}>
          <CopyPlus size={20} aria-hidden="true" />
          Copia le fermate in un nuovo percorso
        </button>
      )}
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
export function Guidance(props: {
  route: Route;
  stops: Stop[];
  /** Durante il giro: solo la fermata attuale ('card') o l'elenco del percorso ('list'). */
  view?: 'card' | 'list';
  onCloseCard?: () => void;
  onShowCard?: () => void;
}) {
  const app = useAppState();
  const settings = useLiveQuery(getSettings, []);
  const { route, stops } = props;
  if (!settings) return null;
  const navApp = settings.navApp;
  const openStop = (id: string) => app.openScreen('stopDetail', { stopId: id });

  const copyStops = async () => {
    const copy = await duplicateRoute(route.id);
    app.setCurrentRouteId(copy.id);
  };

  if (route.status === 'confirmed') {
    return (
      <>
        <StopList stops={stops} onOpen={openStop} />
        <div className="sheet-actions three">
          {route.totals && <span className="route-duration num">{formatDuration(route.totals.minutes)}</span>}
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

  if (route.status === 'completed')
    return <CompletedCard stops={stops} onNewRoute={() => app.openScreen('createRoute')} onCopyStops={() => void copyStops()} />;

  const current = nextStop(stops);
  const ordered = [...stops].sort((a, b) => (a.sequence ?? a.originalIndex) - (b.sequence ?? b.originalIndex));

  const done = async (stop: Stop) => {
    const { previous } = await markOutcome(stop.id, 'done');
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

  if (!current) {
    const end = route.settings.end;
    const endPoint = end.mode === 'return' ? route.startLocation : end.mode === 'address' ? end.location : undefined;
    if (!endPoint)
      return <CompletedCard stops={stops} onNewRoute={() => app.openScreen('createRoute')} onCopyStops={() => void copyStops()} />;
    return (
      <section className="stop-card" aria-label="Rientro">
        <div className="stop-card-head">
          <h3 className="stop-card-line">{end.mode === 'address' ? end.address.street : 'Posizione iniziale'}</h3>
          <div className="stop-card-kicker">Posizione finale{route.totals ? ` · ${route.totals.endTime}` : ''}</div>
        </div>
        <div className="stop-card-actions two">
          <button className="action-tile primary" onClick={() => navigate(endPoint, navApp)}>
            <Navigation size={22} aria-hidden="true" />
            Naviga
          </button>
          <button className="action-tile" onClick={() => void completeRoute(route.id)}>
            <Check size={22} className="ok-text" aria-hidden="true" />
            Percorso completato
          </button>
        </div>
        <div className="stop-card-rows">
          <button className="row" onClick={() => app.openScreen('routeDetails', { routeId: route.id })}>
            <span className="detail-icon" aria-hidden="true"><MapIcon size={20} /></span>
            <span className="grow">Cambia posizione finale</span>
          </button>
        </div>
      </section>
    );
  }

  if (props.view === 'list') return <GuidanceList route={route} stops={stops} onShowCard={props.onShowCard} openStop={openStop} />;

  return (
    <>
      <StopCard
        stop={current}
        position={ordered.indexOf(current) + 1}
        total={stops.length}
        upcoming={upcomingStops(stops, current.id, 2)}
        onNavigate={(chosen) => navigate(current.location, chosen ?? navApp)}
        onDone={() => void done(current)}
        onFailed={(reason, attempt) => void failed(current, reason, attempt)}
        onOpen={() => openStop(current.id)}
        onClose={props.onCloseCard}
      />
    </>
  );
}

/** Elenco del percorso durante il giro (dopo aver chiuso la scheda della fermata). */
function GuidanceList(props: { route: Route; stops: Stop[]; onShowCard?: () => void; openStop: (id: string) => void }) {
  const list = useRef<HTMLDivElement>(null);
  const current = [...props.stops]
    .sort((a, b) => (a.sequence ?? a.originalIndex) - (b.sequence ?? b.originalIndex))
    .find((s) => s.outcome === 'pending');
  const row = () => list.current?.querySelector(`[data-stop-id="${current?.id}"]`);
  const scrollToCurrent = () => row()?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  // Il pulsante compare solo quando la fermata attuale è fuori vista, con la freccia verso di lei.
  const [where, setWhere] = useState<'visible' | 'above' | 'below'>('below');
  useEffect(() => {
    const el = row();
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => setWhere(e.isIntersecting ? 'visible' : e.boundingClientRect.top < (e.rootBounds?.top ?? 0) ? 'above' : 'below'),
      { root: list.current?.closest('.sheet-body'), threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);
  return (
    <div ref={list}>
      {props.onShowCard && (
        <div className="list-current">
          <button className="btn-primary" onClick={props.onShowCard}>
            <Navigation size={20} aria-hidden="true" />
            Torna alla fermata attuale
          </button>
        </div>
      )}
      <StopList stops={props.stops} onOpen={props.openStop} />
      <div className="list-end">
        <button className="btn-ghost" onClick={() => void completeRoute(props.route.id)}>
          Contrassegna percorso come completato
        </button>
      </div>
      {current && where !== 'visible' && (
        <div className="list-jump">
          <button className="round-btn" aria-label="Scorri alla fermata attuale" onClick={scrollToCurrent}>
            {where === 'above' ? <ChevronUp size={24} aria-hidden="true" /> : <ChevronDown size={24} aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
}
