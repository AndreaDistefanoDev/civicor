import type { StopOrder } from '../types';

export interface SolverStop {
  matrixIndex: number;
  order: StopOrder;
  serviceSec: number;
  /** Fasce orarie in secondi dalla mezzanotte. Vuoto = qualsiasi orario. */
  windows: Array<[number, number]>;
}

export interface SolverInput {
  durations: number[][];
  distances: number[][];
  startIndex: number;
  /** Uguale a startIndex = andata e ritorno; null = nessuna posizione finale. */
  endIndex: number | null;
  stops: SolverStop[];
  startTimeSec: number;
  break?: { earliestSec: number; latestSec: number; durationSec: number };
  timeBudgetMs?: number;
}

export interface SolverResult {
  /** Indici in `stops`, nell'ordine di visita. */
  sequence: number[];
  /** Inizio del servizio a ogni fermata (secondi), nell'ordine di `sequence`. */
  arrivals: number[];
  /** Posizione in `sequence` dopo cui fare la sosta. */
  breakAfter?: number;
  totalDistance: number;
  totalDuration: number;
  endTimeSec: number;
  /** Indici in `stops` delle fermate raggiunte dopo la fine della loro fascia. */
  lateStops: number[];
}

const LATE_PENALTY = 10;

interface Simulation extends SolverResult {
  lateness: number;
}

function simulate(input: SolverInput, sequence: number[], breakAfter?: number): Simulation {
  const { durations, distances, stops } = input;
  let t = input.startTimeSec;
  let at = input.startIndex;
  let distance = 0;
  let lateness = 0;
  const arrivals: number[] = [];
  const lateStops: number[] = [];

  sequence.forEach((stopIdx, k) => {
    const stop = stops[stopIdx];
    t += durations[at][stop.matrixIndex];
    distance += distances[at][stop.matrixIndex];
    if (stop.windows.length > 0) {
      const open = stop.windows.find(([, end]) => t <= end);
      if (open) {
        t = Math.max(t, open[0]);
      } else {
        lateness += t - stop.windows[stop.windows.length - 1][1];
        lateStops.push(stopIdx);
      }
    }
    arrivals.push(t);
    t += stop.serviceSec;
    if (input.break && breakAfter === k) t += input.break.durationSec;
    at = stop.matrixIndex;
  });

  if (input.endIndex !== null) {
    t += durations[at][input.endIndex];
    distance += distances[at][input.endIndex];
  }

  return {
    sequence,
    arrivals,
    breakAfter,
    totalDistance: distance,
    totalDuration: t - input.startTimeSec,
    endTimeSec: t,
    lateStops,
    lateness,
  };
}

const costOf = (s: Simulation) => s.totalDuration + LATE_PENALTY * s.lateness;

/** Sceglie dopo quale fermata fare la sosta, con inizio dentro la sua fascia. */
function placeBreak(input: SolverInput, sequence: number[]): number | undefined {
  if (!input.break || sequence.length === 0) return undefined;
  const plain = simulate(input, sequence);
  const { earliestSec, latestSec } = input.break;
  let best: { k: number; cost: number } | undefined;
  for (let k = 0; k < sequence.length; k++) {
    const breakStart = plain.arrivals[k] + input.stops[sequence[k]].serviceSec;
    if (breakStart < earliestSec || breakStart > latestSec) continue;
    const cost = costOf(simulate(input, sequence, k));
    if (!best || cost < best.cost) best = { k, cost };
  }
  if (best) return best.k;
  // Nessuna posizione dentro la fascia: la prima dopo l'inizio della fascia, altrimenti l'ultima.
  const after = plain.arrivals.findIndex((a, k) => a + input.stops[sequence[k]].serviceSec >= earliestSec);
  return after >= 0 ? after : sequence.length - 1;
}

export function evaluate(input: SolverInput, sequence: number[]): SolverResult {
  const { lateness: _lateness, ...result } = simulate(input, sequence, placeBreak(input, sequence));
  return result;
}

export function reverseSequence(input: SolverInput, sequence: number[]): SolverResult {
  return evaluate(input, [...sequence].reverse());
}

function nearestNeighborBlock(input: SolverInput, block: number[], from: number): number[] {
  const left = new Set(block);
  const order: number[] = [];
  let at = from;
  while (left.size > 0) {
    let best = -1;
    let bestD = Infinity;
    for (const i of left) {
      const d = input.durations[at][input.stops[i].matrixIndex];
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    order.push(best);
    left.delete(best);
    at = input.stops[best].matrixIndex;
  }
  return order;
}

/**
 * Ordine delle fermate: costruzione nearest-neighbor per blocchi (Prima, Automatico, Ultima),
 * poi miglioramenti locali 2-opt e Or-opt dentro ogni blocco finché migliora o finisce il tempo.
 */
export function solveRoute(input: SolverInput): SolverResult {
  const n = input.stops.length;
  if (n === 0) return evaluate(input, []);
  const deadline = Date.now() + (input.timeBudgetMs ?? 3000);

  const blocks = (['first', 'auto', 'last'] as const).map((order) =>
    input.stops.map((s, i) => (s.order === order ? i : -1)).filter((i) => i >= 0),
  );
  let seq: number[] = [];
  let from = input.startIndex;
  for (const block of blocks) {
    const part = nearestNeighborBlock(input, block, from);
    seq.push(...part);
    if (part.length) from = input.stops[part[part.length - 1]].matrixIndex;
  }

  // Intervalli [inizio, fine) di ogni blocco dentro la sequenza.
  const ranges: Array<[number, number]> = [];
  let offset = 0;
  for (const block of blocks) {
    if (block.length) ranges.push([offset, offset + block.length]);
    offset += block.length;
  }

  let bestCost = costOf(simulate(input, seq));
  let improved = true;
  while (improved && Date.now() < deadline) {
    improved = false;
    for (const [lo, hi] of ranges) {
      // 2-opt: inverte un tratto.
      for (let i = lo; i < hi - 1 && Date.now() < deadline; i++) {
        for (let j = i + 1; j < hi; j++) {
          const candidate = seq.slice();
          for (let a = i, b = j; a < b; a++, b--) [candidate[a], candidate[b]] = [candidate[b], candidate[a]];
          const c = costOf(simulate(input, candidate));
          if (c < bestCost - 1e-9) {
            seq = candidate;
            bestCost = c;
            improved = true;
          }
        }
      }
      // Or-opt: sposta un tratto di 1–3 fermate in un altro punto del blocco.
      for (let len = 1; len <= 3; len++) {
        for (let i = lo; i + len <= hi && Date.now() < deadline; i++) {
          for (let j = lo; j <= hi - len; j++) {
            if (j === i) continue;
            const segment = seq.slice(i, i + len);
            const rest = [...seq.slice(0, i), ...seq.slice(i + len)];
            const candidate = [...rest.slice(0, j), ...segment, ...rest.slice(j)];
            const c = costOf(simulate(input, candidate));
            if (c < bestCost - 1e-9) {
              seq = candidate;
              bestCost = c;
              improved = true;
            }
          }
        }
      }
    }
  }

  return evaluate(input, seq);
}
