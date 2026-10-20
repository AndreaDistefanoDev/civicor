export interface MatrixRequest {
  sources: number[];
  destinations: number[];
}

/** Divide una matrice di distanze in richieste che rispettano il limite di elementi di ORS. */
export function planMatrixRequests(sources: number[], destinations: number[], maxElements = 3500): MatrixRequest[] {
  if (sources.length === 0 || destinations.length === 0) return [];
  const requests: MatrixRequest[] = [];
  if (destinations.length <= maxElements) {
    const rows = Math.floor(maxElements / destinations.length);
    for (let i = 0; i < sources.length; i += rows) {
      requests.push({ sources: sources.slice(i, i + rows), destinations });
    }
    return requests;
  }
  for (const source of sources) {
    for (let j = 0; j < destinations.length; j += maxElements) {
      requests.push({ sources: [source], destinations: destinations.slice(j, j + maxElements) });
    }
  }
  return requests;
}

/** Blocchi di al massimo `maxWaypoints` tappe, ciascuno inizia dall'ultima tappa del precedente. */
export function planDirectionsChunks<T>(points: T[], maxWaypoints = 50): T[][] {
  if (points.length < 2) return [];
  const chunks: T[][] = [];
  for (let start = 0; start < points.length - 1; start += maxWaypoints - 1) {
    chunks.push(points.slice(start, start + maxWaypoints));
  }
  return chunks;
}
