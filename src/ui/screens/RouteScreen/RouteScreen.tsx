import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { optimizeRoute, resetDisplayIds, reverseRoute, skipOptimization, type OptimizeStep } from '../../../data/optimizeRoute';
import { deleteStops, getRoute, getSettings, listStops, listStopTypes, updateRoute } from '../../../data/repos';
import { unlockAudio } from '../../../device/feedback';
import type { Route } from '../../../domain/types';
import { geocodeQueue, optimizeDeps } from '../../appServices';
import { GeocodeStatusBar } from '../../common/GeocodeStatus';
import { ConfirmDialog, PickerSheet } from '../../common/ui';
import { MapView } from '../../map/MapView';
import { BottomSheet, sheetHeight } from '../../sheet/BottomSheet';
import { useAppState } from '../../useAppState';
import { Guidance } from './Guidance';
import { OptimizingModal } from './OptimizingModal';
import { RouteMenu } from './RouteMenu';
import { SearchBar } from './SearchBar';
import { StopList } from './StopList';
import './RouteScreen.css';

type Dialog = 'refine' | 'invert' | 'deleteAll' | null;

function startText(r: Route) {
  return r.settings.start.mode === 'current'
    ? { title: 'Inizia dalla posizione attuale', sub: "Posizione GPS usata durante l'ottimizzazione" }
    : { title: r.settings.start.address.street, sub: 'Posizione iniziale' };
}
function endText(r: Route) {
  const e = r.settings.end;
  if (e.mode === 'return') return { title: 'Andata e ritorno', sub: 'Torna alla posizione iniziale' };
  if (e.mode === 'none') return { title: 'Nessuna posizione finale', sub: "Il percorso finisce all'ultima fermata" };
  return { title: e.address.street, sub: 'Posizione finale' };
}
function breakText(r: Route) {
  const b = r.settings.break;
  return b
    ? { title: `Sosta di ${b.minutes} minuti`, sub: `Tra le ${b.earliest} e le ${b.latest}` }
    : { title: 'Nessuna sosta', sub: 'Tocca per pianificare una sosta' };
}

function SettingRow(props: { title: string; sub: string; onClick: () => void; icon: string }) {
  return (
    <button className="setting-row" onClick={props.onClick}>
      <span className="setting-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span className="grow">
        <span className="setting-title">{props.title}</span>
        <span className="setting-sub muted">{props.sub}</span>
      </span>
    </button>
  );
}

export function RouteScreen(props: { routeId: string; theme: 'dark' | 'light' }) {
  const app = useAppState();
  const route = useLiveQuery(() => getRoute(props.routeId), [props.routeId]);
  const stops = useLiveQuery(() => listStops(props.routeId), [props.routeId]);
  const stopTypes = useLiveQuery(listStopTypes, []);
  const [step, setStep] = useState<OptimizeStep | null>(null);
  const settings = useLiveQuery(getSettings, []);
  const [notice, setNotice] = useState<'missing' | 'pending' | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  // Riprende la ricerca delle posizioni rimaste in sospeso: all'apertura (es. dopo un ricaricamento)
  // e ogni volta che cambia la chiave OpenRouteService.
  const settingsLoaded = settings !== undefined;
  const orsKey = settings?.orsApiKey;
  useEffect(() => {
    if (settingsLoaded) void geocodeQueue.enqueueRoute(props.routeId);
  }, [props.routeId, orsKey, settingsLoaded]);

  if (!route || !stops) return null;
  const empty = stops.length === 0;
  const todo = stops.filter((s) => s.outcome === 'pending');
  const searchingCount = todo.filter((s) => s.geoStatus === 'pending').length;
  const missingCount = todo.filter((s) => s.geoStatus === 'uncertain' || s.geoStatus === 'failed').length;

  const optimize = async () => {
    setStep('analisi');
    const outcome = await optimizeRoute(route.id, setStep, optimizeDeps);
    setStep(null);
    if (outcome.kind === 'missing_locations') setNotice('missing');
    if (outcome.kind === 'pending_locations') setNotice('pending');
    if (outcome.kind === 'error') app.showToast(outcome.message);
  };
  const openDetails = () => app.openScreen('routeDetails', { routeId: route.id });
  const openStop = (id: string) => app.openScreen('stopDetail', { stopId: id });
  const scan = () => {
    unlockAudio();
    app.openScreen('scan', { routeId: route.id });
  };

  const meta = route.totals
    ? `Termine: ${route.totals.endTime} · ${stops.length} fermate · ${String(route.totals.km).replace('.', ',')} km`
    : `${stops.length} fermate`;

  return (
    <div className="route-screen">
      <MapView
        stops={stops}
        stopTypes={stopTypes}
        polyline={route.polyline}
        theme={props.theme}
        bottomInset={sheetHeight(app.sheet)}
        onSelectStop={openStop}
      />
      <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => app.openScreen('drawer')}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <BottomSheet snap={app.sheet} onSnapChange={app.setSheet}>
        <SearchBar
          onSearch={() => app.openScreen('search', { routeId: route.id })}
          onScan={scan}
          onVoice={() => app.openScreen('voice', { routeId: route.id })}
        />
        <div className="route-head">
          <div className="grow">
            {!empty && <div className="route-meta muted">{meta}</div>}
            <h2 className="route-name">{route.name}</h2>
          </div>
          {!empty && (
            <RouteMenu
              status={route.status}
              onRouteDetails={openDetails}
              onSkip={() => void skipOptimization(route.id)}
              onReoptimize={optimize}
              onResetIds={() => void resetDisplayIds(route.id)}
              onDeleteAll={() => setDialog('deleteAll')}
            />
          )}
        </div>

        <GeocodeStatusBar onOpenSettings={() => app.openScreen('settings')} />
        {notice === 'missing' && missingCount > 0 && (
          <div className="missing-notice" role="alert">
            <span>{missingCount} fermate senza posizione</span>
            <button className="link-btn" onClick={() => app.openScreen('verify', { routeId: route.id })}>
              Verifica ora
            </button>
          </div>
        )}
        {notice === 'pending' && searchingCount > 0 && (
          <div className="missing-notice" role="alert">
            <span>{searchingCount} fermate ancora in ricerca della posizione</span>
          </div>
        )}

        {empty && (
          <div className="route-empty">
            <p>Aggiungi le prime fermate e inizia a creare un percorso</p>
            <button className="btn-primary" onClick={() => app.openScreen('search', { routeId: route.id })}>
              + Aggiungi fermata
            </button>
            <button className="btn-secondary" onClick={scan}>
              Scansiona etichette
            </button>
          </div>
        )}

        {!empty && route.status === 'planning' && (
          <>
            <div className="section-title">Impostazione percorso</div>
            <SettingRow icon="⌂" {...startText(route)} onClick={openDetails} />
            <SettingRow icon="⚑" {...endText(route)} onClick={openDetails} />
            <div className="section-title">Fermate</div>
            <StopList stops={stops} onOpen={openStop} />
            <div className="sheet-actions">
              <button className="btn-primary" onClick={optimize}>
                Ottimizza percorso
              </button>
            </div>
          </>
        )}

        {!empty && route.status === 'optimized' && (
          <>
            <SettingRow icon="☕" {...breakText(route)} onClick={openDetails} />
            <SettingRow icon="⌂" title="Posizione iniziale" sub={startText(route).sub} onClick={openDetails} />
            <StopList stops={stops} onOpen={openStop} />
            <SettingRow icon="⚑" {...endText(route)} onClick={openDetails} />
            <div className="sheet-actions two">
              <button className="btn-secondary" onClick={() => setDialog('refine')}>
                Perfeziona
              </button>
              <button className="btn-primary" onClick={() => void updateRoute(route.id, { status: 'confirmed' })}>
                Conferma il percorso
              </button>
            </div>
          </>
        )}

        {!empty && route.status !== 'planning' && route.status !== 'optimized' && (
          <Guidance route={route} stops={stops} />
        )}
      </BottomSheet>

      {step && <OptimizingModal step={step} />}
      {dialog === 'refine' && (
        <PickerSheet title="Perfeziona il percorso" onCancel={() => setDialog(null)} onDone={() => setDialog(null)}>
          <button className="row" onClick={() => setDialog('invert')}>
            <span className="grow">
              <span className="setting-title">Inverti il percorso</span>
              <span className="setting-sub muted">Inverti la direzione del percorso</span>
            </span>
          </button>
        </PickerSheet>
      )}
      {dialog === 'invert' && (
        <ConfirmDialog
          title="Inverti percorso"
          message="L'inversione del percorso modificherà la sequenza delle fermate: le fermate finali diventeranno quelle iniziali."
          confirmLabel="Inverti il percorso"
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            setDialog(null);
            const outcome = await reverseRoute(route.id, optimizeDeps);
            if (outcome.kind === 'error') app.showToast(outcome.message);
          }}
        />
      )}
      {dialog === 'deleteAll' && (
        <ConfirmDialog
          title="Eliminare tutte le fermate?"
          message="Il percorso resterà vuoto."
          confirmLabel="Elimina fermate"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            await deleteStops(stops.map((s) => s.id));
            await updateRoute(route.id, { status: 'planning', polyline: undefined, totals: undefined });
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
