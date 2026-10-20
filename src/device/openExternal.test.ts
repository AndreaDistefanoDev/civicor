import { openExternal } from './openExternal';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stubWindow(visibility: 'visible' | 'hidden') {
  const location = { href: '' };
  vi.stubGlobal('location', location);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibility);
  return location;
}

it('apre l\'app e, se la pagina resta visibile, ripiega sul link web', () => {
  const loc = stubWindow('visible');
  openExternal('waze://?ll=1,2&navigate=yes', 'https://waze.com/ul?ll=1,2&navigate=yes');
  expect(loc.href).toBe('waze://?ll=1,2&navigate=yes');
  vi.advanceTimersByTime(1600);
  expect(loc.href).toBe('https://waze.com/ul?ll=1,2&navigate=yes');
});

it('se l\'app si è aperta (pagina nascosta) non ripiega', () => {
  const loc = stubWindow('hidden');
  openExternal('waze://x', 'https://waze.com/x');
  vi.advanceTimersByTime(1600);
  expect(loc.href).toBe('waze://x');
});
