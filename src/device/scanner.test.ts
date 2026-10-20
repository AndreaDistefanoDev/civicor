import { createScanner } from './scanner';

const frame = {} as ImageData;

function run(sequence: Array<string | null>, onPayload: (t: string) => void) {
  let i = 0;
  const scanner = createScanner({
    readFrame: () => frame,
    decode: async () => sequence[Math.min(i++, sequence.length - 1)],
    onPayload,
    fps: 10,
    repeatWindowMs: 2500,
  });
  return scanner;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('stessa etichetta per 20 fotogrammi → un solo onPayload', async () => {
  const onPayload = vi.fn();
  const s = run(Array(20).fill('A'), onPayload);
  s.start();
  await vi.advanceTimersByTimeAsync(2000);
  s.stop();
  expect(onPayload).toHaveBeenCalledTimes(1);
});

it('etichetta diversa subito dopo → secondo onPayload', async () => {
  const onPayload = vi.fn();
  const s = run(['A', 'A', 'B', 'B'], onPayload);
  s.start();
  await vi.advanceTimersByTimeAsync(1000);
  s.stop();
  expect(onPayload.mock.calls).toEqual([['A'], ['B']]);
});

it('stessa etichetta ripresa dopo 3 s fuori inquadratura → nuovo onPayload', async () => {
  const onPayload = vi.fn();
  const s = run(['A', ...Array(30).fill(null), 'A', 'A'], onPayload);
  s.start();
  await vi.advanceTimersByTimeAsync(4000);
  s.stop();
  expect(onPayload).toHaveBeenCalledTimes(2);
});

it('dopo stop non legge più', async () => {
  const onPayload = vi.fn();
  const s = run(['A'], onPayload);
  s.start();
  s.stop();
  await vi.advanceTimersByTimeAsync(1000);
  expect(onPayload).not.toHaveBeenCalled();
});
