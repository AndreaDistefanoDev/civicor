/** Una riga per indirizzo; righe vuote e doppioni (senza distinguere maiuscole) rimossi. */
export function parseAddressLines(text: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const key = line.toLowerCase();
    if (!line || seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines;
}
