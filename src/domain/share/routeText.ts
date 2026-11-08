import type { Stop } from '../types';

/** Il percorso come testo semplice (WhatsApp, SMS, note): solo le fermate ancora da fare, nell'ordine. */
export function routeShareText(name: string, endTime: string | undefined, stops: Stop[]): string {
  const todo = stops
    .filter((s) => s.outcome === 'pending')
    .sort((a, b) => (a.sequence ?? a.originalIndex) - (b.sequence ?? b.originalIndex));
  const lines = todo.map((s, i) => `${i + 1}. ${s.eta ? `${s.eta} ` : ''}${s.address.street}${s.address.city ? `, ${s.address.city}` : ''}`);
  return [`${name}${endTime ? ` · fine giro ${endTime}` : ''}`, ...lines].join('\n');
}
