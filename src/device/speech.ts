// Riconoscimento vocale del browser (Safari: webkitSpeechRecognition).
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror?: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => RecognitionLike;

export interface SpeechInput {
  supported: boolean;
  start(opts: { continuous: boolean; onFinal: (text: string) => void; onEnd: () => void; onError?: () => void }): void;
  stop(): void;
}

export function createSpeechInput(lang = 'it-IT'): SpeechInput {
  const g = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const Ctor = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  let rec: RecognitionLike | undefined;
  return {
    supported: !!Ctor,
    start(opts) {
      if (!Ctor) return;
      rec = new Ctor();
      rec.lang = lang;
      rec.continuous = opts.continuous;
      rec.interimResults = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal && r[0]?.transcript.trim()) opts.onFinal(r[0].transcript.trim());
        }
      };
      rec.onend = opts.onEnd;
      rec.onerror = () => {
        opts.onError?.();
        opts.onEnd();
      };
      rec.start();
    },
    stop() {
      rec?.stop();
    },
  };
}
