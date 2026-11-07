import { renderHook } from '@testing-library/react';
import { useWakeLock } from './wakeLock';

function fakeWakeLock() {
  const sentinel = { released: false, release: vi.fn(async () => { sentinel.released = true; }) };
  const request = vi.fn(async () => { sentinel.released = false; return sentinel; });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sentinel };
}

afterEach(() => {
  delete (navigator as { wakeLock?: unknown }).wakeLock;
});

it('tiene lo schermo acceso quando attivo e lo rilascia quando smette', async () => {
  const { request, sentinel } = fakeWakeLock();
  const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
  await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
  rerender({ on: false });
  await vi.waitFor(() => expect(sentinel.release).toHaveBeenCalled());
});

it('lo richiede di nuovo quando torni all\'app (es. da Waze)', async () => {
  const { request, sentinel } = fakeWakeLock();
  renderHook(() => useWakeLock(true));
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  sentinel.released = true; // iOS lo rilascia quando l'app va in secondo piano
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
});

it('senza supporto non fa nulla e non si rompe', () => {
  expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
});
