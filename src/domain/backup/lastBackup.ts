const dayStart = (t: number) => new Date(t).setHours(0, 0, 0, 0);

/** "mai", "oggi alle 09:05", "ieri", "6 giorni fa". */
export function lastBackupLabel(at: number | undefined, now: number): string {
  if (!at) return 'mai';
  const days = Math.round((dayStart(now) - dayStart(at)) / 86_400_000);
  if (days <= 0) {
    const d = new Date(at);
    return `oggi alle ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return days === 1 ? 'ieri' : `${days} giorni fa`;
}
