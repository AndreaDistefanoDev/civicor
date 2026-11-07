import type { Stop } from '../types';

/** "45,50", "1.234,5 €", "12" → numero. Undefined se vuoto, negativo o non valido. */
export function parseEuro(text: string): number | undefined {
  const clean = text.replace(/[€\s]/g, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(clean)) return undefined;
  const value = clean.includes(',') ? Number(clean.replace(/\./g, '').replace(',', '.')) : Number(clean);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function formatEuro(value: number): string {
  return `${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' as unknown as boolean })} €`;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Riepilogo contrassegni del giro: incassati (contanti / POS), ancora da incassare, da riportare in sede. */
export function codTotals(stops: Stop[]) {
  const t = { count: 0, cash: 0, pos: 0, toCollect: 0, returned: 0 };
  for (const s of stops) {
    if (!s.cod) continue;
    t.count++;
    if (s.outcome === 'done' && s.cod.method === 'cash') t.cash += s.cod.amount;
    else if (s.outcome === 'done' && s.cod.method === 'pos') t.pos += s.cod.amount;
    else if (s.outcome === 'failed') t.returned += s.cod.amount;
    else t.toCollect += s.cod.amount;
  }
  return { count: t.count, cash: round(t.cash), pos: round(t.pos), toCollect: round(t.toCollect), returned: round(t.returned) };
}
