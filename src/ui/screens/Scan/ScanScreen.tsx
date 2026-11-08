import { useLiveQuery } from 'dexie-react-hooks';
import { Loader2, ScanText, Type } from 'lucide-react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { addLabelStop } from '../../../data/labelStore';
import { listStops, saveUnreadableCode } from '../../../data/repos';
import { recordScan } from '../../../data/scanStore';
import { updateStop } from '../../../data/stopOps';
import { CameraError, openCamera, type CameraHandle } from '../../../device/camera';
import { playDuplicate, playError, playSuccess, unlockAudio } from '../../../device/feedback';
import { captureFrame, prepareOcr, readText, rotate } from '../../../device/ocr';
import { createScanner, decodeInWorker } from '../../../device/scanner';
import { addressKey, formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import { parsePipeLabel, trackingFromCode } from '../../../domain/label/codes';
import { parseLabelText, snapCity, type LabelAddress } from '../../../domain/label/parseLabelText';
import { parseGlsDataMatrix } from '../../../domain/gls/parseGlsDataMatrix';
import type { Stop, VehiclePosition } from '../../../domain/types';
import { geocodeQueue } from '../../appServices';
import { GeocodeStatusBar } from '../../common/GeocodeStatus';
import { CloseIcon } from '../../common/ui';
import { POSITION_LABELS } from '../StopDetail/FindPackageSheet';
import type { ScanOutcome } from '../../../domain/scan/applyScan';
import { LabelCard } from './LabelCard';
import { initialScanState, scanReducer } from './scanReducer';
import './ScanScreen.css';

/** Ritaglia la zona della cornice dal video e la riduce: meno pixel = lettura più rapida. */
function frameReader(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  return (): ImageData | null => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const side = Math.min(vw, vh) * 0.8;
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    const size = Math.min(800, Math.round(side));
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size);
  };
}

/** Esito del salvataggio di un'etichetta letta, nella forma che usa il banner della scansione. */
function toScanOutcome(o: { kind: 'added' | 'merged' | 'duplicate'; stop: Stop }): ScanOutcome {
  if (o.kind === 'duplicate') return { kind: 'duplicate', stopId: o.stop.id };
  return o.kind === 'added' ? { kind: 'added', stop: o.stop } : { kind: 'merged', stop: o.stop };
}

/** Zona del video letta come testo: la cornice, un po' più larga per prendere tutto l'indirizzo. */
const TEXT_FRAME = { x: 0.05, y: 0.12, w: 0.9, h: 0.76 };
/** La città che compare più spesso tra le fermate del giro: proposta quando sull'etichetta non si legge. */
function routeCity(stops: Stop[]): string {
  const counts = new Map<string, number>();
  for (const s of stops) if (s.address.city) counts.set(s.address.city, (counts.get(s.address.city) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}
const keyOf = (a: LabelAddress) => addressKey({ street: a.street, city: a.city, postcode: a.postcode });

/** Le posizioni più usate mentre si carica: un tocco dopo ogni lettura. */
const QUICK_POSITIONS: VehiclePosition[] = ['front', 'middle', 'back', 'left', 'right', 'shelf'];

function VanPositionPicker(props: { stop: Stop }) {
  const current = props.stop.findPackage?.positions ?? [];
  const toggle = (p: VehiclePosition) => {
    const positions = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    void updateStop(props.stop.id, { findPackage: { ...props.stop.findPackage, positions } });
  };
  return (
    <div className="scan-van" role="group" aria-label="Dove lo metti nel furgone?">
      <span className="scan-van-title">
        Dove lo metti? <span className="plate">{props.stop.displayId}</span>
      </span>
      <div className="scan-van-chips">
        {QUICK_POSITIONS.map((p) => (
          <button key={p} className="chip" aria-pressed={current.includes(p)} onClick={() => toggle(p)}>
            {POSITION_LABELS[p]}
          </button>
        ))}
      </div>
    </div>
  );
}

function statusIcon(s?: Stop) {
  if (!s || s.geoStatus === 'pending') return <span className="scan-status muted" aria-label="In ricerca">…</span>;
  if (s.geoStatus === 'ok') return <span className="scan-status ok" aria-label="Trovata">●</span>;
  return <span className="scan-status warn" aria-label="Da verificare">▲</span>;
}

export function ScanScreen(props: {
  routeId: string;
  onDone: (routeId: string) => void;
  onManualAdd: () => void;
  onClose: () => void;
  onOpenSettings?: () => void;
}) {
  const [state, dispatch] = useReducer(scanReducer, initialScanState);
  const stops = useLiveQuery(() => listStops(props.routeId), [props.routeId]) ?? [];
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cam = useRef<CameraHandle | null>(null);
  const [torch, setTorch] = useState(false);
  const busy = useRef(Promise.resolve());
  // Lettura del testo stampato (etichette di qualsiasi corriere).
  const [card, setCard] = useState<{ candidates: LabelAddress[]; initial: number } | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string>();
  const readingRef = useRef(false);
  const forceNext = useRef(false);
  const autoTurn = useRef(0);
  const pausedRef = useRef(false);
  const lastCodeAt = useRef(0);
  const dismissed = useRef<{ key: string; at: number }>(undefined);
  const stopsRef = useRef(stops);
  // Ultimo numero di spedizione letto da un QR o da un codice a barre: va sulla fermata che si aggiunge subito dopo.
  const lastTracking = useRef<{ code: string; at: number }>(undefined);
  stopsRef.current = stops;
  pausedRef.current = !!card || typing;

  useEffect(() => {
    unlockAudio();
    let cancelled = false;
    let scanner: { start(): void; stop(): void } | undefined;

    const unknownCodes = new Set<string>();
    const handle = async (text: string) => {
      const label = parseGlsDataMatrix(text);
      if (!label) {
        // Quadratino con i campi separati da "|" (altri mittenti): via, città e civico, si aggiunge subito.
        const piped = parsePipeLabel(text);
        if (piped) {
          lastCodeAt.current = Date.now();
          const outcome = await addLabelStop(props.routeId, piped);
          if (outcome.kind === 'added') {
            playSuccess();
            geocodeQueue.enqueue(outcome.stop.id);
          } else playDuplicate();
          dispatch({ type: 'scanned', outcome: toScanOutcome(outcome) });
          return;
        }
        // QR o codice a barre con il numero di spedizione: se il pacco è già nel giro lo dice, altrimenti lo ricorda.
        const tracking = trackingFromCode(text);
        if (tracking) {
          const known = (await listStops(props.routeId)).find((s) => s.trackingNumbers.includes(tracking));
          if (known) {
            lastCodeAt.current = Date.now();
            playDuplicate();
            dispatch({ type: 'scanned', outcome: { kind: 'duplicate', stopId: known.id } });
          } else lastTracking.current = { code: tracking, at: Date.now() };
          return;
        }
        // Codice senza indirizzo né numero utile: si legge il testo stampato. Salvato una volta per migliorare il lettore.
        if (!unknownCodes.has(text)) {
          unknownCodes.add(text);
          await saveUnreadableCode(text);
        }
        return;
      }
      lastCodeAt.current = Date.now();
      // Salvato prima del suono: se l'app si chiude subito dopo, la fermata c'è già.
      const outcome = await recordScan(props.routeId, label);
      if (outcome.kind === 'duplicate') playDuplicate();
      else {
        playSuccess();
        geocodeQueue.enqueue(outcome.stop.id);
      }
      dispatch({ type: 'scanned', outcome });
    };

    (async () => {
      try {
        if (!video.current) return;
        cam.current = await openCamera(video.current);
        if (cancelled) return cam.current.stop();
        dispatch({ type: 'camera', state: 'live' });
      } catch (e) {
        dispatch({ type: 'camera', state: e instanceof CameraError ? e.reason : 'unavailable' });
      }
      if (cancelled) return;
      scanner = createScanner({
        readFrame: video.current && canvas.current ? frameReader(video.current, canvas.current) : () => null,
        decode: decodeInWorker,
        // Una lettura alla volta, nell'ordine: evita doppioni dovuti a salvataggi in parallelo.
        onPayload: (text) => {
          busy.current = busy.current.then(() => handle(text)).catch(() => {});
        },
      });
      scanner.start();
    })();

    return () => {
      cancelled = true;
      scanner?.stop();
      cam.current?.stop();
    };
  }, [props.routeId]);

  // Lettura automatica del testo: mentre inquadri, l'indirizzo stampato viene proposto da solo.
  useEffect(() => {
    if (state.camera !== 'live') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    prepareOcr().catch(() => {});
    const tick = async () => {
      if (stopped) return;
      const codeJustRead = Date.now() - lastCodeAt.current < 3000;
      if (!pausedRef.current && !codeJustRead && document.visibilityState === 'visible') await readLabel(false);
      if (!stopped) timer = setTimeout(tick, 900);
    };
    timer = setTimeout(tick, 600);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.camera]);

  /** true se ha proposto un indirizzo. */
  const offer = (text: string, manual: boolean): boolean => {
    const read = parseLabelText(text);
    // Città: corretta su quelle già nel giro se letta quasi giusta, quella più frequente se illeggibile.
    const known = stopsRef.current.map((s) => s.address.city).filter(Boolean);
    const fallbackCity = routeCity(stopsRef.current);
    const candidates = read.candidates.map((c) => ({ ...c, city: c.city ? snapCity(c.city, known) : fallbackCity }));
    const best = read.best && candidates[read.candidates.indexOf(read.best)];
    if (candidates.length === 0) {
      if (manual) {
        playError();
        setNotice('Nessun indirizzo trovato: avvicinati, tieni fermo e riprova.');
      }
      return false;
    }
    const initial = best ? candidates.indexOf(best) : 0;
    if (!manual) {
      // In automatico non si ripropone ciò che è già nel giro o che hai appena annullato.
      const key = keyOf(candidates[initial]);
      if (stopsRef.current.some((s) => addressKey(s.address) === key)) return true;
      if (dismissed.current?.key === key && Date.now() - dismissed.current.at < 10_000) return true;
    }
    setNotice(undefined);
    setCard({ candidates, initial });
    return true;
  };

  const readLabel = async (manual: boolean) => {
    if (readingRef.current) {
      if (manual) forceNext.current = true;
      return;
    }
    const image = video.current && captureFrame(video.current, TEXT_FRAME);
    if (!image) return;
    readingRef.current = true;
    if (manual) setReading(true);
    try {
      // Pacchi di traverso: il lettore legge solo il testo dritto, quindi si prova anche girando di 90°.
      // In automatico un orientamento per volta (a turno); con "Leggi" tutti, finché trova l'indirizzo.
      const turns: Array<0 | 90 | 270> = manual ? [0, 90, 270] : [([0, 90, 270] as const)[autoTurn.current++ % 3]];
      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        const text = await readText(turn ? rotate(image, turn) : image);
        const asManual = manual || forceNext.current;
        if (pausedRef.current) break;
        const last = i === turns.length - 1;
        // Con "Leggi" il messaggio "nessun indirizzo" arriva solo dopo aver provato tutti gli orientamenti.
        if (parseLabelText(text).candidates.length > 0 || last) {
          forceNext.current = false;
          offer(text, asManual);
          break;
        }
      }
    } catch {
      if (manual) playError();
    } finally {
      readingRef.current = false;
      if (manual) setReading(false);
    }
  };

  const addFromCard = async (address: LabelAddress) => {
    const recent = lastTracking.current && Date.now() - lastTracking.current.at < 20_000 ? lastTracking.current.code : undefined;
    lastTracking.current = undefined;
    const outcome = await addLabelStop(props.routeId, address, recent);
    if (outcome.kind === 'added') {
      playSuccess();
      geocodeQueue.enqueue(outcome.stop.id);
    } else playDuplicate();
    dispatch({ type: 'scanned', outcome: toScanOutcome(outcome) });
    setCard(null);
  };

  const count = stops.length;
  const uncertain = stops.filter((s) => s.geoStatus === 'uncertain' || s.geoStatus === 'failed').length;
  const byId = new Map(stops.map((s) => [s.id, s]));
  const recent = state.recent.map((id) => byId.get(id)).filter((s): s is Stop => !!s);
  const blocked = state.camera === 'denied' || state.camera === 'unavailable';

  return (
    <div className="scan" role="dialog" aria-label="Scansiona etichette">
      <div className="scan-camera">
        <video ref={video} className="scan-video" playsInline muted />
        <canvas ref={canvas} hidden />
        {!blocked && (
          // Tutta l'immagine è un tasto: toccandola si legge subito l'indirizzo inquadrato.
          <button className="scan-tap" aria-label="Tocca per leggere l'indirizzo inquadrato" onClick={() => void readLabel(true)} />
        )}
        {!blocked && <div key={state.flash} className={`scan-frame${state.flash ? ' flash' : ''}`} aria-hidden="true" />}
        {!blocked && <p className="scan-tap-hint">Punta la fotocamera su un indirizzo o tocca per selezionarlo</p>}
        {blocked && (
          <div className="scan-blocked">
            <p>
              {state.camera === 'denied'
                ? "Consenti l'accesso alla fotocamera in Impostazioni > Safari per scansionare le etichette."
                : 'Fotocamera non disponibile su questo dispositivo.'}
            </p>
            <button className="btn-primary" onClick={props.onManualAdd}>
              Aggiungi a mano
            </button>
          </div>
        )}
        <button className="icon-btn scan-close" aria-label="Chiudi" onClick={props.onClose}>
          <CloseIcon />
        </button>
        {!blocked && (
          <button
            className={`scan-torch${torch ? ' on' : ''}`}
            onClick={async () => {
              const ok = await cam.current?.setTorch(!torch);
              if (ok) setTorch(!torch);
            }}
          >
            Torcia
          </button>
        )}
        {state.banner && (
          <div className={`scan-banner ${state.banner.kind}`} role="status">
            <span aria-hidden="true">{state.banner.kind === 'ok' ? '✓' : state.banner.kind === 'duplicate' ? '↺' : '✕'}</span>
            <span>{state.banner.text}</span>
          </div>
        )}
      </div>

      <div className="scan-panel">
        <GeocodeStatusBar onOpenSettings={props.onOpenSettings ?? props.onClose} />
        {card && (
          <LabelCard
            key={card.candidates.map(keyOf).join('|')}
            candidates={card.candidates}
            initial={card.initial}
            onAdd={(a) => void addFromCard(a)}
            onCancel={() => {
              dismissed.current = { key: keyOf(card.candidates[card.initial]), at: Date.now() };
              setCard(null);
            }}
          />
        )}
        {!card && typing && (
          <div className="label-typing">
            <label className="field">
              <span>Testo dell'etichetta</span>
              <textarea
                rows={3}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Tocca qui e usa “Scansiona testo” della tastiera, oppure scrivi l'indirizzo"
              />
            </label>
            <div className="label-actions">
              <button className="btn-secondary" onClick={() => setTyping(false)}>
                Annulla
              </button>
              <button
                className="btn-primary"
                disabled={!typed.trim()}
                onClick={() => {
                  setTyping(false);
                  offer(typed, true);
                  setTyped('');
                }}
              >
                Trova indirizzo
              </button>
            </div>
          </div>
        )}
        {!card && !typing && recent[0] && <VanPositionPicker stop={recent[0]} />}
        {!card && !typing && notice && <p className="label-nothing">{notice}</p>}
        <div className="scan-counts">
          <span className="scan-count num">{count}</span>
          {uncertain > 0 && <span className="scan-uncertain">{uncertain} da verificare</span>}
        </div>
        <ul className="scan-recent">
          {recent.map((s) => (
            <li key={s.id}>
              {statusIcon(s)}
              <span className="grow">
                <span className="scan-recent-line">{formatAddressLine(s.address)}</span>
                <span className="muted scan-recent-city">
                  {s.geoStatus === 'uncertain' || s.geoStatus === 'failed' ? s.geoReason : formatAddressCity(s.address)}
                  {s.packages > 1 ? ` · ${s.packages} pacchi` : ''}
                </span>
              </span>
            </li>
          ))}
          {recent.length === 0 && <li className="muted scan-hint">Avvicina il telefono all'etichetta: Civicor legge il codice o l'indirizzo stampato</li>}
        </ul>
        {!card && !typing && (
          <div className="scan-read">
            <button className="btn-secondary" onClick={() => void readLabel(true)} disabled={blocked || reading} aria-label="Leggi etichetta">
              {reading ? <Loader2 size={20} className="spin" aria-hidden="true" /> : <ScanText size={20} aria-hidden="true" />}
              Leggi
            </button>
            <button className="btn-secondary" onClick={() => setTyping(true)} aria-label="Scrivi o incolla il testo">
              <Type size={20} aria-hidden="true" />
              Scrivi
            </button>
          </div>
        )}
        <button className="btn-primary" onClick={() => props.onDone(props.routeId)}>
          Fine ({count} fermate)
        </button>
      </div>
    </div>
  );
}
