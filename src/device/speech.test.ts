import { createSpeechInput } from './speech';

afterEach(() => vi.unstubAllGlobals());

it('senza API vocale → non supportato', () => {
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  vi.stubGlobal('SpeechRecognition', undefined);
  expect(createSpeechInput().supported).toBe(false);
});

it('riconosce in italiano e consegna le frasi finali', () => {
  const instances: Array<Record<string, unknown>> = [];
  class FakeRecognition {
    lang = '';
    continuous = false;
    interimResults = true;
    onresult?: (e: unknown) => void;
    onend?: () => void;
    start = vi.fn();
    stop = vi.fn();
    constructor() {
      instances.push(this as unknown as Record<string, unknown>);
    }
  }
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  const input = createSpeechInput();
  const onFinal = vi.fn();
  input.start({ continuous: true, onFinal, onEnd: vi.fn() });
  const rec = instances[0] as unknown as FakeRecognition;
  expect(rec.lang).toBe('it-IT');
  expect(rec.continuous).toBe(true);
  rec.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: ' via roma 20 ' }], { isFinal: true })] });
  expect(onFinal).toHaveBeenCalledWith('via roma 20');
});
