// Feedback sonoro della scansione. Su iOS l'audio va sbloccato da un tocco dell'utente.
let ctx: AudioContext | undefined;

export function unlockAudio(): void {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx ??= new AC();
  void ctx.resume();
}

function tone(freq: number, ms: number, delayMs = 0) {
  if (!ctx) return;
  const start = ctx.currentTime + delayMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'square';
  gain.gain.setValueAtTime(0.18, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + ms / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + ms / 1000);
}

/** Etichetta letta: un tono acuto breve. */
export function playSuccess(): void {
  tone(880, 120);
}
/** Già scansionata: due toni bassi. */
export function playDuplicate(): void {
  tone(440, 80);
  tone(440, 80, 130);
}
/** Codice non riconosciuto. */
export function playError(): void {
  tone(220, 220);
}
