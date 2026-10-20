import { solveRoute, type SolverInput, type SolverResult } from '../domain/optimize/solver';

/** Calcola l'ordine delle fermate in un Web Worker, per non bloccare l'interfaccia. */
export function optimizeInWorker(input: SolverInput): Promise<SolverResult> {
  if (typeof Worker === 'undefined') return Promise.resolve(solveRoute(input));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/optimize.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<SolverResult>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(new Error(e.message || 'Ottimizzazione non riuscita'));
      worker.terminate();
    };
    worker.postMessage(input);
  });
}
