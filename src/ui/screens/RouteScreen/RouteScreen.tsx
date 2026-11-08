import { useLiveQuery } from 'dexie-react-hooks';
import { Coffee, Flag, House, Map as MapIcon, MapPinPlus, Menu, Mic, ScanLine, Share2, Truck, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { applyAddedStops, discardAddedStops } from '../../../data/addedStops';
import { nextStop } from '../../../data/outcomes';
import { optimizeRoute, resetDisplayIds, reverseRoute, skipOptimization, type OptimizeStep } from '../../../data/optimizeRoute';
import { deleteStops, getRoute, getSettings, listStops, listStopTypes, updateRoute } from '../../../data/repos';
import { unlockAudio } from '../../../device/feedback';
import { useWakeLock } from '../../../device/wakeLock';
import { routeShareText } from '../../../domain/share/routeText';
import type { Route } from '../../../domain/types';
import { geocodeQueue, optimizeDeps } from '../../appServices';
import { GeocodeStatusBar } from '../../common/GeocodeStatus';
import { ConfirmDialog, PickerSheet } from '../../common/ui';
import { MapView } from '../../map/MapView';
import { BottomSheet, sheetHeight } from '../../sheet/BottomSheet';
import { formatDuration } from '../../dates';
import { useAppState } from '../../useAppState';
import { Guidance } from './Guidance';
import { OptimizingModal } from './OptimizingModal';
import { RouteMenu } from './RouteMenu';
import { SearchBar } from './SearchBar';
import { StopList } from './StopList';
import './RouteScreen.css';

type Dialog = 'refine' | 'invert' | 'deleteAll' | 'apply' | 'discard' | null;

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

/** Riga della linea del tempo per partenza, sosta e arrivo: a destra una piccola icona, come le fermate. */
function TimelineRow(props: { title: string; sub: string; onClick: () => void; icon: LucideIcon; time?: string }) {
  const Icon = props.icon;
  return (
    <button className="tl-row tl-setting" onClick={props.onClick}>
      <span className="tl-left">
        <span className="tl-dot" aria-hidden="true" />
        {props.time && <span className="tl-time num">{props.time}</span>}
      </span>
      <span className="grow">
        <span className="tl-title">{props.title}</span>
        <span className="tl-sub">{props.sub}</span>
      </span>
      <span className="tl-end">
        <span className="tl-chip icon" aria-hidden="true">
          <Icon size={15} />
        </span>
      </span>
    </button>
  );
}

/** "Termine: 18:29 · 3 fermate · 3,4 km" sopra il nome del percorso. */
function routeMeta(r: Route, stops: number): string {
  const count = `${stops} ${stops === 1 ? 'fermata' : 'fermate'}`;
  if (!r.totals) return count;
  return `Termine: ${r.totals.endTime} · ${count} · ${String(r.totals.km).replace('.', ',')} km`;
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
  // Durante il giro il pannello mostra solo la fermata attuale; con la X si torna all'elenco.
  const [cardView, setCardView] = useState(true);

  // Riprende la ricerca delle posizioni rimaste in sospeso: all'apertura (es. dopo un ricaricamento)
  // e ogni volta che cambiano le chiavi o il motore di ricerca indirizzi.
  const settingsLoaded = settings !== undefined;
  const orsKey = settings?.orsApiKey;
  const googleKey = settings?.googleApiKey;
  const provider = settings?.geocoderProvider;
  useEffect(() => {
    if (settingsLoaded) void geocodeQueue.enqueueRoute(props.routeId);
  }, [props.routeId, orsKey, googleKey, provider, settingsLoaded]);
  // Durante il giro lo schermo resta acceso: niente sblocchi a ogni fermata.
  useWakeLock(!!settings?.keepAwake && route?.status === 'in_progress');

  if (!route || !stops) return null;
  const empty = stops.length === 0;
  // Fermate aggiunte a un percorso già ottimizzato: aspettano "Applica modifiche".
  const added = route.status === 'planning' ? [] : stops.filter((s) => s.sequence === undefined);
  const pendingChanges = !empty && added.length > 0;
  const guiding = route.status === 'in_progress' && cardView && !pendingChanges && !!nextStop(stops);
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
  // Condividi: con il foglio di condivisione dell'iPhone (WhatsApp, Messaggi…); altrimenti copia il testo.
  const share = async () => {
    const text = routeShareText(route.name, route.totals?.endTime, stops);
    if (navigator.share) {
      await navigator.share({ title: route.name, text }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(text).catch(() => {});
      app.showToast('Percorso copiato: incollalo dove vuoi');
    }
  };
  const openStop = (id: string) => app.openScreen('stopDetail', { stopId: id });
  const scan = () => {
    unlockAudio();
    app.openScreen('scan', { routeId: route.id });
  };


  return (
    <div className="route-screen">
      <MapView
        stops={stops}
        stopTypes={stopTypes}
        polyline={route.polyline}
        theme={props.theme}
        bottomInset={sheetHeight(app.sheet)}
        selectedStopId={route.status === 'in_progress' ? nextStop(stops)?.id : undefined}
        finishTime={route.status === 'in_progress' ? route.totals?.endTime : undefined}
        onSelectStop={openStop}
      />
      <button className="icon-btn floating menu-btn" aria-label="Menu" onClick={() => app.openScreen('drawer')}>
        <Menu size={20} aria-hidden="true" />
      </button>
      <BottomSheet snap={app.sheet} onSnapChange={app.setSheet}>
        {!guiding && (
          <SearchBar
            onSearch={() => app.openScreen('search', { routeId: route.id })}
            onScan={scan}
            onVoice={() => app.openScreen('voice', { routeId: route.id })}
          />
        )}
        {!guiding && (
        <div className="route-head">
          <div className="grow">
            {!empty && <div className="route-meta">{routeMeta(route, stops.length)}</div>}
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
        )}
        {!guiding && !pendingChanges && (route.status === 'confirmed' || route.status === 'in_progress') && (
          <div className="route-chips">
            <button className="chip-btn" onClick={() => void share()}>
              <Share2 size={16} aria-hidden="true" />
              Condividi percorso
            </button>
            <button className="chip-btn" onClick={() => app.openScreen('loadVehicle', { routeId: route.id })}>
              <Truck size={16} aria-hidden="true" />
              Carica veicolo
            </button>
          </div>
        )}

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
            <MapPinPlus size={30} className="route-empty-icon" aria-hidden="true" />
            <p>Aggiungi le prime fermate e inizia a creare un percorso</p>
            <div className="add-tiles">
              <button className="add-tile" onClick={() => app.openScreen('pickOnMap', { routeId: route.id })}>
                <MapIcon size={22} aria-hidden="true" />
                Mappa
              </button>
              <button className="add-tile" onClick={scan}>
                <ScanLine size={22} aria-hidden="true" />
                Scansiona
              </button>
              <button className="add-tile" onClick={() => app.openScreen('voice', { routeId: route.id })}>
                <Mic size={22} aria-hidden="true" />
                Voce
              </button>
            </div>
          </div>
        )}

        {pendingChanges && (
          <>
            <div className="section-title">Fermate aggiunte</div>
            <StopList stops={added} onOpen={openStop} />
            <div className="section-title">Percorso esistente</div>
            <StopList stops={stops.filter((s) => s.sequence !== undefined)} onOpen={openStop} />
            <div className="sheet-actions two">
              <button className="btn-secondary" onClick={() => setDialog('discard')}>
                Elimina
              </button>
              <button className="btn-primary" onClick={() => setDialog('apply')}>
                Applica modifiche ({added.length})
              </button>
            </div>
          </>
        )}

        {!empty && !pendingChanges && route.status === 'planning' && (
          <>
            <div className="section-title">Impostazione percorso</div>
            <TimelineRow icon={House} {...startText(route)} onClick={openDetails} />
            <TimelineRow icon={Flag} {...endText(route)} onClick={openDetails} />
            <div className="section-title">Fermate aggiunte</div>
            <StopList stops={stops} onOpen={openStop} />
            <div className="sheet-actions">
              <button className="btn-primary" onClick={optimize}>
                Ottimizza percorso
              </button>
            </div>
          </>
        )}

        {!empty && !pendingChanges && route.status === 'optimized' && (
          <>
            <TimelineRow icon={Coffee} {...breakText(route)} onClick={openDetails} />
            <TimelineRow icon={House} title="Posizione iniziale" sub={startText(route).sub} onClick={openDetails} />
            <StopList stops={stops} onOpen={openStop} />
            <TimelineRow icon={Flag} {...endText(route)} time={route.totals?.endTime} onClick={openDetails} />
            <div className="sheet-actions three">
              {route.totals && <span className="route-duration num">{formatDuration(route.totals.minutes)}</span>}
              <button className="btn-secondary" onClick={() => setDialog('refine')}>
                Perfeziona
              </button>
              <button className="btn-primary" onClick={() => void updateRoute(route.id, { status: 'confirmed' })}>
                Conferma il percorso
              </button>
            </div>
          </>
        )}

        {!empty && !pendingChanges && route.status !== 'planning' && route.status !== 'optimized' && (
          <Guidance
            route={route}
            stops={stops}
            view={guiding ? 'card' : 'list'}
            onCloseCard={() => setCardView(false)}
            onShowCard={route.status === 'in_progress' && nextStop(stops) ? () => setCardView(true) : undefined}
          />
        )}
      </BottomSheet>

      {step && <OptimizingModal step={step} />}
      {dialog === 'refine' && (
        <PickerSheet title="Perfeziona il percorso" onCancel={() => setDialog(null)} onDone={() => setDialog(null)}>
          <button className="row" onClick={() => setDialog('invert')}>
            <span className="grow">
              <span className="row-title">Inverti il percorso</span>
              <span className="row-sub">Inverti la direzione del percorso</span>
            </span>
          </button>
        </PickerSheet>
      )}
      {dialog === 'apply' && (
        <PickerSheet title={`Applica modifiche (${added.length})`} onCancel={() => setDialog(null)} onDone={() => setDialog(null)}>
          <button
            className="row"
            onClick={async () => {
              setDialog(null);
              await applyAddedStops(route.id);
            }}
          >
            <span className="grow">
              <span className="row-title">Aggiorna percorso</span>
              <span className="row-sub">Riordina solo le fermate modificate</span>
            </span>
          </button>
          <button
            className="row"
            onClick={() => {
              setDialog(null);
              void optimize();
            }}
          >
            <span className="grow">
              <span className="row-title">Riottimizza percorso</span>
              <span className="row-sub">Riordina tutte le fermate per un'efficienza ottimale</span>
            </span>
          </button>
        </PickerSheet>
      )}
      {dialog === 'discard' && (
        <ConfirmDialog
          title="Eliminare le fermate aggiunte?"
          message={`${added.length} ${added.length === 1 ? 'fermata non è ancora' : 'fermate non sono ancora'} nel percorso.`}
          confirmLabel="Elimina fermate aggiunte"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            setDialog(null);
            await discardAddedStops(route.id);
          }}
        />
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
