import type { Stop } from '../../domain/types';

/** "Via Roma 28, Scicli" → "V Roma 28, Scicl": corta come sulle mappe delle app di percorso. */
function shortStreet(street: string): string {
  return street.replace(/^via\b\.?/i, 'V').replace(/^viale\b/i, 'V.le').replace(/^piazza\b/i, 'P.za').replace(/^corso\b/i, 'C.so').slice(0, 16);
}

const PLUS =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/**
 * Segnaposto di una fermata: goccia compatta con il numero, gialla come un cartello.
 * Fermata chiusa (riuscita o no): stessa goccia e stesso numero, ma "spenta" in grigio.
 * La goccia ruota dentro il bottone: il bottone lo sposta MapLibre e non va trasformato.
 */
export function stopMarker(stop: Stop, color: string, current: boolean): HTMLElement {
  const el = document.createElement('button');
  const closed = stop.outcome !== 'pending';
  const uncertain = !closed && (stop.geoStatus === 'uncertain' || stop.geoStatus === 'failed');
  // Percorso non ancora ottimizzato: le fermate non hanno un ordine, il segnaposto mostra un "+".
  const fresh = !closed && !current && !uncertain && stop.sequence === undefined;
  el.className = `stop-pin${current && !closed ? ' current' : ''}${closed ? ' off' : ''}${uncertain ? ' uncertain' : ''}${fresh ? ' new' : ''}`;
  if (!closed && !uncertain) el.style.setProperty('--pin', color);
  const state = closed ? `, ${stop.outcome === 'done' ? 'effettuata' : 'non riuscita'}` : '';
  el.setAttribute('aria-label', `Fermata ${stop.displayId}${state}: ${stop.address.street}`);
  const head = document.createElement('span');
  head.className = 'stop-pin-head';
  const num = document.createElement('span');
  num.className = 'stop-pin-num';
  if (fresh) num.innerHTML = PLUS;
  else num.textContent = String(stop.displayId);
  head.append(num);
  el.append(head);
  // Etichetta accanto: via abbreviata ("V Roma 28, Scicl") e orario previsto; si vede solo da vicino.
  if (!closed && stop.sequence !== undefined) {
    const label = document.createElement('span');
    label.className = 'stop-pin-label';
    const street = document.createElement('span');
    street.textContent = shortStreet(stop.address.street);
    label.append(street);
    if (stop.eta) {
      const eta = document.createElement('span');
      eta.className = 'stop-pin-eta';
      eta.textContent = stop.eta;
      label.append(eta);
    }
    el.append(label);
  }
  return el;
}
