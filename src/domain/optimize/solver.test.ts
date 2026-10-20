import { evaluate, reverseSequence, solveRoute, type SolverInput, type SolverStop } from './solver';
import { hhmmToSec } from './time';

// Matrice: indice 0 = partenza, poi una fermata per punto.
function lineMatrix(n: number) {
  const m = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => Math.abs(i - j) * 60));
  return { durations: m, distances: m.map((r) => r.map((v) => v * 10)) };
}

const plainStops = (n: number): SolverStop[] =>
  Array.from({ length: n }, (_, i) => ({ matrixIndex: i + 1, order: 'auto', serviceSec: 60, windows: [] }));

const base = (n: number, over: Partial<SolverInput> = {}): SolverInput => ({
  ...lineMatrix(n), startIndex: 0, endIndex: null, stops: plainStops(n), startTimeSec: hhmmToSec('08:00'),
  timeBudgetMs: 500, ...over,
});

// Generatore con seme fisso per risultati ripetibili.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function random(n: number): SolverInput {
  const r = rng(42);
  const pts = Array.from({ length: n + 1 }, () => [r() * 20000, r() * 20000]);
  const d = pts.map((a) => pts.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 1.3));
  return { durations: d.map((row) => row.map((v) => v / 10)), distances: d, startIndex: 0, endIndex: 0,
    stops: plainStops(n), startTimeSec: hhmmToSec('08:00') };
}

function nearestNeighbor(input: SolverInput) {
  const left = new Set(input.stops.map((_, i) => i));
  const seq: number[] = [];
  let at = input.startIndex;
  while (left.size) {
    let best = -1;
    for (const i of left) if (best < 0 || input.durations[at][input.stops[i].matrixIndex] < input.durations[at][input.stops[best].matrixIndex]) best = i;
    seq.push(best); left.delete(best); at = input.stops[best].matrixIndex;
  }
  return evaluate(input, seq);
}

it('punti in fila → li visita in ordine', () => {
  expect(solveRoute(base(10)).sequence).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

it('rispetta Prima e Ultima', () => {
  const stops = plainStops(8);
  stops[6].order = 'first';
  stops[1].order = 'last';
  const r = solveRoute(base(8, { stops }));
  expect(r.sequence[0]).toBe(6);
  expect(r.sequence.at(-1)).toBe(1);
  expect([...r.sequence].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
});

it('fascia oraria pomeridiana → fermata visitata dopo le 14:00 senza ritardi', () => {
  const stops = plainStops(6);
  stops[0].windows = [[hhmmToSec('14:00'), hhmmToSec('18:00')]];
  const r = solveRoute(base(6, { stops }));
  const pos = r.sequence.indexOf(0);
  expect(r.lateStops).toEqual([]);
  expect(r.arrivals[pos]).toBeGreaterThanOrEqual(hhmmToSec('14:00'));
});

it('fascia mattutina → ritardo segnalato se impossibile da rispettare', () => {
  const stops = plainStops(3);
  stops[2].windows = [[hhmmToSec('07:00'), hhmmToSec('07:30')]];
  expect(solveRoute(base(3, { stops })).lateStops).toEqual([2]);
});

it('andata e ritorno include il rientro nella durata totale', () => {
  const open = solveRoute(base(5));
  const rt = solveRoute(base(5, { endIndex: 0 }));
  expect(rt.totalDuration).toBe(open.totalDuration + 5 * 60);
  expect(rt.totalDistance).toBe(open.totalDistance + 5 * 600);
});

it('orario finale = partenza + guida + soste alle fermate', () => {
  const r = solveRoute(base(3));
  expect(r.endTimeSec).toBe(hhmmToSec('08:00') + 3 * 60 + 3 * 60);
  expect(r.arrivals).toEqual([hhmmToSec('08:01'), hhmmToSec('08:03'), hhmmToSec('08:05')]);
});

it('sosta inserita dentro la sua fascia', () => {
  const brk = { earliestSec: hhmmToSec('08:04'), latestSec: hhmmToSec('08:06'), durationSec: 1800 };
  const r = solveRoute(base(6, { break: brk }));
  expect(r.breakAfter).toBeDefined();
  const startOfBreak = r.arrivals[r.breakAfter!] + 60;
  expect(startOfBreak).toBeGreaterThanOrEqual(brk.earliestSec);
  expect(startOfBreak).toBeLessThanOrEqual(brk.latestSec);
  expect(r.endTimeSec).toBe(hhmmToSec('08:00') + 6 * 60 + 6 * 60 + 1800);
});

it('150 fermate casuali in meno di 5 s e meglio del nearest-neighbor puro', () => {
  const input = random(150);
  const t0 = performance.now();
  const r = solveRoute(input);
  const ms = performance.now() - t0;
  expect(ms).toBeLessThan(5000);
  expect(r.sequence).toHaveLength(150);
  expect(new Set(r.sequence).size).toBe(150);
  expect(r.totalDuration).toBeLessThan(nearestNeighbor(input).totalDuration);
});

it('invertire scambia prima e ultima', () => {
  expect(reverseSequence(base(3), [0, 1, 2]).sequence).toEqual([2, 1, 0]);
});

it('nessuna fermata → risultato vuoto', () => {
  expect(solveRoute(base(0)).sequence).toEqual([]);
});
