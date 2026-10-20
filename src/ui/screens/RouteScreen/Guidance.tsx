import { useLiveQuery } from 'dexie-react-hooks';
import { completeRoute, markOutcome, nextStop, routeSummary, undoOutcome } from '../../../data/outcomes';
import { getSettings, updateRoute } from '../../../data/repos';
import { openExternal } from '../../../device/openExternal';
import { buildNavigationAppUrl, buildNavigationUrl } from '../../../domain/nav/navLinks';
import type { LatLng, NavApp, Route, Stop } from '../../../domain/types';
import { useAppState } from '../../useAppState';
import { StopCard } from './StopCard';
import { StopList } from './StopList';

/** Sincrona: deve partire dentro il tocco, senza attese. */
function navigate(to: LatLng | undefined, app: NavApp) {
  if (!to) return;
  openExternal(buildNavigationAppUrl(app, to), buildNavigationUrl(app, to));
}

export function CompletedCard(props: { stops: Stop[]; onNewRoute: () => void }) {
  const s = routeSummary(props.stops);
  return (
    <div className="completed-card">
      <div className="completed-check" aria-hidden="true">✓</div>
      <h3>Percorso completato!</h3>
      <div className="completed-stats">
        <span>{s.done} fermate</span>
        <span>{s.failed} fermate mancate</span>
      </div>
      <button className="btn-primary" onClick={props.onNewRoute}>
        Crea nuovo percorso
      </button>
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

  const mark = async (stop: Stop, outcome: 'done' | 'failed') => {
    const { previous } = await markOutcome(stop.id, outcome);
    app.showToast(`Fermata ${stop.displayId} contrassegnata come ${outcome === 'done' ? 'effettuata' : 'non riuscita'}`, {
      label: 'Annulla',
      onPress: () => void undoOutcome(stop.id, previous),
    });
  };

  if (!current) {
    const end = route.settings.end;
    const endPoint = end.mode === 'return' ? route.startLocation : end.mode === 'address' ? end.location : undefined;
    if (!endPoint) return <CompletedCard stops={stops} onNewRoute={() => app.openScreen('createRoute')} />;
    return (
      <div className="stop-card">
        <h3 className="stop-card-line">{end.mode === 'address' ? end.address.street : 'Posizione iniziale'}</h3>
        <div className="stop-card-meta muted">Posizione finale{route.totals ? ` · ${route.totals.endTime}` : ''}</div>
        <div className="stop-card-actions two">
          <button className="stop-card-btn primary" onClick={() => navigate(endPoint, navApp)}>
            <span aria-hidden="true">▲</span>
            Naviga
          </button>
          <button className="stop-card-btn" onClick={() => void completeRoute(route.id)}>
            <span aria-hidden="true" className="ok-icon">✓</span>
            Percorso completato
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <StopCard
        stop={current}
        position={ordered.indexOf(current) + 1}
        total={stops.length}
        onNavigate={(chosen) => navigate(current.location, chosen ?? navApp)}
        onDone={() => void mark(current, 'done')}
        onFailed={() => void mark(current, 'failed')}
        onOpen={() => openStop(current.id)}
      />
      <div className="section-title">Tutte le fermate</div>
      <StopList stops={stops} onOpen={openStop} />
      <div className="sheet-actions">
        <button className="btn-secondary" onClick={() => void completeRoute(route.id)}>
          Contrassegna percorso come completato
        </button>
      </div>
    </>
  );
}
