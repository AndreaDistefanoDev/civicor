import { solveRoute, type SolverInput } from '../domain/optimize/solver';

self.onmessage = (e: MessageEvent<SolverInput>) => {
  self.postMessage(solveRoute(e.data));
};
