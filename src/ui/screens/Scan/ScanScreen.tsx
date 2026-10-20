import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useReducer, useRef, useState } from 'react';
import { listStops, saveUnreadableCode } from '../../../data/repos';
import { recordScan } from '../../../data/scanStore';
import { CameraError, openCamera, type CameraHandle } from '../../../device/camera';
import { playDuplicate, playError, playSuccess, unlockAudio } from '../../../device/feedback';
import { createScanner, decodeInWorker } from '../../../device/scanner';
import { formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import { parseGlsDataMatrix } from '../../../domain/gls/parseGlsDataMatrix';
import type { Stop } from '../../../domain/types';
import { geocodeQueue } from '../../appServices';
import { GeocodeStatusBar } from '../../common/GeocodeStatus';
import { CloseIcon } from '../../common/ui';
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

  useEffect(() => {
    unlockAudio();
    let cancelled = false;
    let scanner: { start(): void; stop(): void } | undefined;

    const handle = async (text: string) => {
      const label = parseGlsDataMatrix(text);
      if (!label) {
        playError();
        dispatch({ type: 'unreadable' });
        await saveUnreadableCode(text);
        return;
      }
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
        {!blocked && <div key={state.flash} className={`scan-frame${state.flash ? ' flash' : ''}`} />}
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
          {recent.length === 0 && <li className="muted scan-hint">Inquadra il quadratino del codice sull'etichetta</li>}
        </ul>
        <button className="btn-primary" onClick={() => props.onDone(props.routeId)}>
          Fine ({count} fermate)
        </button>
      </div>
    </div>
  );
}
