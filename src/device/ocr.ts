// Lettura del testo stampato sulle etichette, tutta sul telefono: la foto non viene inviata a nessuno.
// Il lettore (Tesseract) si scarica alla prima apertura con i dati della lingua italiana (~1,6 MB), poi resta in cache.
import type { Worker } from 'tesseract.js';

let worker: Promise<Worker> | undefined;

/** Prepara il lettore in anticipo (all'apertura della schermata), così la prima lettura è più rapida. */
export function prepareOcr(onProgress?: (fraction: number) => void): Promise<Worker> {
  worker ??= import('tesseract.js').then(({ createWorker, OEM }) =>
    createWorker('ita', OEM.LSTM_ONLY, {
      logger: (m) => {
        if (m.status.startsWith('loading') || m.status.startsWith('initializ')) onProgress?.(m.progress);
      },
    }),
  );
  worker.catch(() => (worker = undefined));
  return worker;
}

/** Ritaglia la zona della cornice dal video e la ingrandisce quanto basta per leggere bene il testo piccolo. */
export function captureFrame(video: HTMLVideoElement, frame: { x: number; y: number; w: number; h: number }): HTMLCanvasElement | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const sx = vw * frame.x;
  const sy = vh * frame.y;
  const sw = vw * frame.w;
  const sh = vh * frame.h;
  const scale = Math.min(2, 1400 / sw);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Bianco e nero con più contrasto: il lettore distingue meglio le lettere su carta lucida o sotto la plastica.
  ctx.filter = 'grayscale(1) contrast(1.6)';
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function readText(image: HTMLCanvasElement): Promise<string> {
  const w = await prepareOcr();
  const { data } = await w.recognize(image);
  return data.text;
}

/** L'etichetta girata di 90° (pacchi messi di traverso): il lettore legge solo il testo dritto. */
export function rotate(image: HTMLCanvasElement, degrees: 90 | 270): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = image.height;
  out.height = image.width;
  const ctx = out.getContext('2d');
  if (!ctx) return image;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  return out;
}
