export function hhmmToSec(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 3600 + m * 60;
}

/** Secondi dalla mezzanotte → 'HH:mm', arrotondato al minuto. */
export function secToHhmm(sec: number): string {
  const minutes = Math.round(sec / 60) % (24 * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
