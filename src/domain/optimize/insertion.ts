import { distanceMeters } from '../geocode/classify';
import type { LatLng } from '../types';

interface Point {
  id: string;
  location?: LatLng;
}

/**
 * "Aggiorna percorso": inserisce le fermate nuove nel punto del giro che lo allunga meno
 * (in linea d'aria), senza cambiare l'ordine di quelle che c'erano già.
 * `fixed` = quante fermate in testa sono già chiuse: le nuove vanno solo dopo di loro.
 * Restituisce gli id nell'ordine finale; le nuove senza posizione vanno in fondo.
 */
export function insertStops(route: Point[], added: Point[], fixed = 0): string[] {
  const order = [...route];
  const noLocation: Point[] = [];
  for (const stop of added) {
    if (!stop.location) {
      noLocation.push(stop);
      continue;
    }
    let bestAt = order.length;
    let bestCost = Infinity;
    for (let at = Math.min(fixed, order.length); at <= order.length; at++) {
      const prev = order[at - 1]?.location;
      const next = order[at]?.location;
      const cost =
        (prev ? distanceMeters(prev, stop.location) : 0) +
        (next ? distanceMeters(stop.location, next) : 0) -
        (prev && next ? distanceMeters(prev, next) : 0);
      // A parità si preferisce più avanti: non si mette una fermata nuova prima della prima senza motivo.
      if (cost <= bestCost) {
        bestCost = cost;
        bestAt = at;
      }
    }
    order.splice(bestAt, 0, stop);
  }
  return [...order, ...noLocation].map((s) => s.id);
}
