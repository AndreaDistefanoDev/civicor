import { addressKey, hasHouseNumber } from '../domain/address/normalize';
import { classifyGeocode } from '../domain/geocode/classify';
import type { Repos } from '../data/repos';
import type { Geocoder } from './geocoder';
import { OrsError } from './ors/orsClient';

export interface GeocodeQueueDeps {
  geocoder: Geocoder;
  repos: Pick<Repos, 'getCorrection' | 'patchStop' | 'getStop' | 'listStops'>;
  isOnline: () => boolean;
  /** Pausa tra due richieste di rete (sotto i 100/min di ORS). */
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Registra una funzione da chiamare quando torna la connessione. */
  onOnline?: (cb: () => void) => void;
}

export interface GeocodeQueue {
  enqueue(stopId: string): void;
  enqueueRoute(routeId: string): Promise<void>;
  onChange(cb: () => void): () => void;
  pendingCount(): number;
  lastError(): OrsError | undefined;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const yieldToEventLoop = () => new Promise<void>((r) => setTimeout(r, 0));
const MAX_BACKOFF_MS = 60_000;
/** Errori che si risolvono solo con un intervento dell'utente: la coda si ferma. */
const FATAL = new Set(['missing_key', 'bad_key']);

/**
 * Cerca sulla mappa le fermate in attesa, una alla volta, senza bloccare la scansione.
 * Prima guarda la memoria delle correzioni; senza rete o con errori temporanei aspetta e ritenta.
 */
export function createGeocodeQueue(deps: GeocodeQueueDeps): GeocodeQueue {
  const sleep = deps.sleep ?? defaultSleep;
  const delayMs = deps.delayMs ?? 700;
  const queue: string[] = [];
  const listeners = new Set<() => void>();
  let running = false;
  let processing = false;
  let error: OrsError | undefined;
  let wake: (() => void) | undefined;

  const notify = () => listeners.forEach((cb) => cb());
  deps.onOnline?.(() => wake?.());

  /** Attende `ms`, ma si sveglia subito se torna la connessione. */
  const waitOrWake = (ms: number) =>
    new Promise<void>((resolve) => {
      wake = resolve;
      void sleep(ms).then(resolve);
    }).finally(() => (wake = undefined));

  async function processStop(id: string): Promise<'done' | 'retry'> {
    const stop = await deps.repos.getStop(id);
    if (!stop || stop.geoStatus !== 'pending') return 'done';

    const corrected = await deps.repos.getCorrection(addressKey(stop.address));
    if (corrected) {
      await deps.repos.patchStop(id, { geoStatus: 'ok', location: corrected, geoReason: undefined });
      return 'done';
    }
    if (!deps.isOnline()) return 'retry';

    const hits = await deps.geocoder.geocode(stop.address);
    const result = classifyGeocode(hits, hasHouseNumber(stop.address), stop.address);
    // Solo i campi della posizione: le modifiche fatte nel frattempo (pacchi, note…) restano.
    await deps.repos.patchStop(id, { geoStatus: result.status, location: result.location, geoReason: result.reason });
    if (delayMs > 0) await sleep(delayMs);
    return 'done';
  }

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    let backoff = 2000;
    try {
      while (queue.length > 0 && !(error && FATAL.has(error.reason))) {
        processing = true;
        let outcome: 'done' | 'retry';
        try {
          outcome = await processStop(queue[0]);
        } catch (e) {
          error = e instanceof OrsError ? e : new OrsError('server');
          notify();
          if (FATAL.has(error.reason)) break;
          outcome = 'retry';
        }
        if (outcome === 'done') {
          queue.shift();
          backoff = 2000;
          if (error && !FATAL.has(error.reason)) error = undefined;
          processing = false;
          notify();
        } else {
          await waitOrWake(backoff);
          await yieldToEventLoop();
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
      }
    } finally {
      processing = false;
      running = false;
    }
  }

  const restart = () => {
    error = undefined;
    notify();
    void run();
  };

  return {
    enqueue(stopId) {
      if (!queue.includes(stopId)) queue.push(stopId);
      restart();
    },
    async enqueueRoute(routeId) {
      const stops = await deps.repos.listStops(routeId);
      for (const s of stops) if (s.geoStatus === 'pending' && !queue.includes(s.id)) queue.push(s.id);
      restart();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    pendingCount: () => queue.length + (processing && queue.length === 0 ? 1 : 0),
    lastError: () => error,
  };
}
