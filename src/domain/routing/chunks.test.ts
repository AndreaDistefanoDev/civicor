import { planDirectionsChunks, planMatrixRequests } from './chunks';

it('132 punti → richieste da al massimo 3500 elementi che coprono ogni riga una volta', () => {
  const all = [...Array(132).keys()];
  const reqs = planMatrixRequests(all, all);
  expect(reqs.every((r) => r.sources.length * r.destinations.length <= 3500)).toBe(true);
  expect(reqs.flatMap((r) => r.sources).sort((a, b) => a - b)).toEqual(all);
  expect(reqs.every((r) => r.destinations.length === 132)).toBe(true);
});

it('nessuna sorgente o destinazione → nessuna richiesta', () => {
  expect(planMatrixRequests([], [1, 2])).toEqual([]);
  expect(planMatrixRequests([1], [])).toEqual([]);
});

it('troppe destinazioni per una riga → divide anche le destinazioni', () => {
  const dest = [...Array(5000).keys()];
  const reqs = planMatrixRequests([0], dest);
  expect(reqs.every((r) => r.sources.length * r.destinations.length <= 3500)).toBe(true);
  expect(reqs.flatMap((r) => r.destinations)).toEqual(dest);
});

it('120 tappe → blocchi da 50 che si sovrappongono di un punto', () => {
  const c = planDirectionsChunks([...Array(120).keys()]);
  expect(c.map((x) => [x[0], x.at(-1)])).toEqual([[0, 49], [49, 98], [98, 119]]);
});

it('meno di 2 punti → nessun blocco', () => {
  expect(planDirectionsChunks([1])).toEqual([]);
});
