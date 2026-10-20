export interface ScannerOptions {
  readFrame: () => ImageData | null;
  decode: (img: ImageData) => Promise<string | null>;
  onPayload: (text: string) => void;
  fps?: number;
  /** Lo stesso testo non viene riemesso finché resta inquadrato o entro questo tempo. */
  repeatWindowMs?: number;
}

/** Legge fotogrammi a ritmo fisso e segnala ogni codice nuovo una sola volta. */
export function createScanner(opts: ScannerOptions): { start(): void; stop(): void } {
  const interval = 1000 / (opts.fps ?? 8);
  const repeatWindow = opts.repeatWindowMs ?? 2500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let lastText: string | undefined;
  let lastSeen = 0;

  async function tick() {
    if (!running) return;
    const frame = opts.readFrame();
    if (frame) {
      const text = await opts.decode(frame).catch(() => null);
      if (!running) return;
      const now = Date.now();
      if (text) {
        if (text !== lastText || now - lastSeen > repeatWindow) opts.onPayload(text);
        lastText = text;
        lastSeen = now;
      }
    }
    if (running) timer = setTimeout(tick, interval);
  }

  return {
    start() {
      if (running) return;
      running = true;
      timer = setTimeout(tick, 0);
    },
    stop() {
      running = false;
      clearTimeout(timer);
    },
  };
}

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, (text: string | null) => void>();

/** Decodifica un fotogramma nel worker dedicato (WebAssembly fuori dal thread dell'interfaccia). */
export function decodeInWorker(img: ImageData): Promise<string | null> {
  if (typeof Worker === 'undefined') {
    return import('./zxing').then((m) => m.decodeDataMatrix(img));
  }
  if (!worker) {
    worker = new Worker(new URL('./scanWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; text: string | null }>) => {
      pending.get(e.data.id)?.(e.data.text);
      pending.delete(e.data.id);
    };
  }
  const id = ++nextId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ id, img }, [img.data.buffer]);
  });
}
