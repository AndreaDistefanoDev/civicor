import { googleMapsScriptUrl, loadGoogleMaps, resetGoogleMapsForTests } from './loadGoogleMaps';

afterEach(() => {
  resetGoogleMapsForTests();
  document.head.innerHTML = '';
  delete (window as { google?: unknown }).google;
});

it('costruisce l\'indirizzo dello script con chiave, lingua italiana e caricamento asincrono', () => {
  const url = new URL(googleMapsScriptUrl('k 1', '__cb'));
  expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/js');
  expect(url.searchParams.get('key')).toBe('k 1');
  expect(url.searchParams.get('language')).toBe('it');
  expect(url.searchParams.get('region')).toBe('IT');
  expect(url.searchParams.get('loading')).toBe('async');
  expect(url.searchParams.get('callback')).toBe('__cb');
});

it('aggiunge lo script una sola volta e si risolve quando Google è pronto', async () => {
  const a = loadGoogleMaps('key');
  const b = loadGoogleMaps('key');
  expect(document.head.querySelectorAll('script')).toHaveLength(1);
  const fake = { maps: { importLibrary: vi.fn() } };
  (window as unknown as { google: unknown }).google = fake;
  const cb = new URL(document.head.querySelector('script')!.src).searchParams.get('callback')!;
  (window as unknown as Record<string, () => void>)[cb]();
  await expect(a).resolves.toBe(fake.maps);
  expect(await b).toBe(fake.maps);
});

it('chiave rifiutata (o fatturazione non attiva): avvisa chi ascolta', async () => {
  const onFail = vi.fn();
  void loadGoogleMaps('key', onFail);
  (window as unknown as { gm_authFailure: () => void }).gm_authFailure();
  expect(onFail).toHaveBeenCalled();
});

it('se lo script non si scarica la promessa fallisce', async () => {
  const p = loadGoogleMaps('key');
  document.head.querySelector('script')!.dispatchEvent(new Event('error'));
  await expect(p).rejects.toThrow('Google Maps non raggiungibile');
});
