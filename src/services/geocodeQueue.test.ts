import { createGeocodeQueue } from './geocodeQueue';
import { OrsError } from './ors/orsClient';
import type { GeocodeHit, Geocoder } from './geocoder';
import type { LatLng, Stop } from '../domain/types';

const stop = (id: string, street = 'Via Esempio, 12'): Stop => ({
  id, routeId: 'r1', address: { street, city: 'Ragusa', postcode: '97100' }, trackingNumbers: [], packages: 1,
  order: 'auto', kind: 'delivery', timeWindows: [], serviceMinutes: 1, stopTypeId: 'standard',
  geoStatus: 'pending', originalIndex: 0, displayId: 1, outcome: 'pending', createdAt: 1,
});

function setup(opts: { hits?: GeocodeHit[]; error?: unknown; errors?: unknown[]; corrections?: Record<string, LatLng>; during?: (store: Map<string, Stop>) => void; sleep?: (ms: number) => Promise<void> } = {}) {
  const store = new Map<string, Stop>();
  const pendingErrors = [...(opts.errors ?? [])];
  const onlineListeners: Array<() => void> = [];
  const geocode = vi.fn(async () => {
    opts.during?.(store);
    if (pendingErrors.length) throw pendingErrors.shift();
    if (opts.error) throw opts.error;
    return opts.hits ?? [];
  });
  const geocoder: Geocoder = { geocode, geocodeText: vi.fn(), autocomplete: vi.fn() };
  let online = true;
  const queue = createGeocodeQueue({
    geocoder,
    repos: {
      getCorrection: async (k) => opts.corrections?.[k],
      getStop: async (id) => store.get(id),
      patchStop: async (id, patch) => {
        const cur = store.get(id);
        if (cur) store.set(id, { ...cur, ...patch });
      },
      listStops: async (routeId) => [...store.values()].filter((s) => s.routeId === routeId),
    },
    isOnline: () => online,
    delayMs: 0,
    sleep: opts.sleep ?? (() => Promise.resolve()),
    onOnline: (cb) => void onlineListeners.push(cb),
  });
  const idle = () => new Promise<void>((resolve) => {
    const check = () => (queue.pendingCount() === 0 ? resolve() : setTimeout(check, 1));
    check();
  });
  return { store, geocode, queue, idle, setOnline: (v: boolean) => (online = v), goOnline: () => { online = true; onlineListeners.forEach((cb) => cb()); } };
}

const house: GeocodeHit = { precision: 'house', location: { lat: 36.92, lng: 14.73 }, label: 'x' };

it('indirizzo nella memoria delle correzioni → ok senza chiamare il geocoder', async () => {
  const t = setup({ corrections: { 'via esempio 12|97100': { lat: 1, lng: 2 } } });
  t.store.set('s1', stop('s1'));
  t.queue.enqueue('s1');
  await t.idle();
  expect(t.geocode).not.toHaveBeenCalled();
  expect(t.store.get('s1')).toMatchObject({ geoStatus: 'ok', location: { lat: 1, lng: 2 } });
});

it('civico trovato → ok con la posizione', async () => {
  const t = setup({ hits: [house] });
  t.store.set('s1', stop('s1'));
  t.queue.enqueue('s1');
  await t.idle();
  expect(t.store.get('s1')).toMatchObject({ geoStatus: 'ok', location: house.location });
});

it('solo la via con civico richiesto → incerta con motivo', async () => {
  const t = setup({ hits: [{ ...house, precision: 'street' }] });
  t.store.set('s1', stop('s1'));
  t.queue.enqueue('s1');
  await t.idle();
  expect(t.store.get('s1')).toMatchObject({ geoStatus: 'uncertain', geoReason: 'civico non trovato, punto a metà strada' });
});

it('offline → resta pending, poi tornato online → ok', async () => {
  const t = setup({ hits: [house] });
  t.setOnline(false);
  t.store.set('s1', stop('s1'));
  t.queue.enqueue('s1');
  await new Promise((r) => setTimeout(r, 10));
  expect(t.store.get('s1')?.geoStatus).toBe('pending');
  expect(t.geocode).not.toHaveBeenCalled();
  t.setOnline(true);
  await t.idle();
  expect(t.store.get('s1')?.geoStatus).toBe('ok');
});

it('chiave non valida → coda ferma con errore, fermate restano pending', async () => {
  const t = setup({ error: new OrsError('bad_key') });
  t.store.set('s1', stop('s1'));
  t.store.set('s2', stop('s2', 'Via Altra, 3'));
  t.queue.enqueue('s1');
  t.queue.enqueue('s2');
  await new Promise((r) => setTimeout(r, 10));
  expect(t.queue.lastError()?.reason).toBe('bad_key');
  expect(t.geocode).toHaveBeenCalledTimes(1);
  expect(t.store.get('s1')?.geoStatus).toBe('pending');
  expect(t.store.get('s2')?.geoStatus).toBe('pending');
});

it('enqueueRoute accoda solo le fermate pending del percorso', async () => {
  const t = setup({ hits: [house] });
  t.store.set('s1', stop('s1'));
  t.store.set('s2', { ...stop('s2', 'Via Altra, 3'), geoStatus: 'ok', location: { lat: 0, lng: 0 } });
  await t.queue.enqueueRoute('r1');
  await t.idle();
  expect(t.geocode).toHaveBeenCalledTimes(1);
});

it('le modifiche fatte durante la ricerca non vengono perse', async () => {
  const t = setup({ hits: [house], during: (store) => {
    const s = store.get('s1')!;
    store.set('s1', { ...s, packages: 2, trackingNumbers: ['ZZ1', 'ZZ2'] });
  } });
  t.store.set('s1', { ...stop('s1'), trackingNumbers: ['ZZ1'] });
  t.queue.enqueue('s1');
  await t.idle();
  expect(t.store.get('s1')).toMatchObject({ geoStatus: 'ok', packages: 2, trackingNumbers: ['ZZ1', 'ZZ2'] });
});

it('errore temporaneo del server → ritenta, poi ok e nessun errore', async () => {
  const t = setup({ hits: [house], errors: [new OrsError('server'), new OrsError('quota')] });
  t.store.set('s1', stop('s1'));
  t.queue.enqueue('s1');
  await t.idle();
  expect(t.geocode).toHaveBeenCalledTimes(3);
  expect(t.store.get('s1')?.geoStatus).toBe('ok');
  expect(t.queue.lastError()).toBeUndefined();
});

it('al ritorno del segnale riparte subito senza aspettare l\'attesa', async () => {
  const t = setup({ hits: [house], sleep: () => new Promise(() => {}) });
  t.setOnline(false);
  t.store.set('s1', stop('s1'));
  t.queue.enqueue('s1');
  await new Promise((r) => setTimeout(r, 10));
  expect(t.store.get('s1')?.geoStatus).toBe('pending');
  t.goOnline();
  await t.idle();
  expect(t.store.get('s1')?.geoStatus).toBe('ok');
});

it('avvisa chi ascolta quando cambia il numero in attesa', async () => {
  const t = setup({ hits: [house] });
  const cb = vi.fn();
  t.queue.onChange(cb);
  t.store.set('s1', stop('s1'));
  t.queue.enqueue('s1');
  expect(cb).toHaveBeenCalled();
});
