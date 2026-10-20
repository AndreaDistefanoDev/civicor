import { getCurrentPosition } from './geolocation';

afterEach(() => vi.unstubAllGlobals());

it('restituisce lat/lng dalla posizione del dispositivo', async () => {
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 36.9, longitude: 14.7 } } as GeolocationPosition) },
  });
  await expect(getCurrentPosition()).resolves.toEqual({ lat: 36.9, lng: 14.7 });
});

it('permesso negato → "Posizione non disponibile"', async () => {
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition: (_: PositionCallback, err: PositionErrorCallback) => err({ code: 1 } as GeolocationPositionError) },
  });
  await expect(getCurrentPosition()).rejects.toThrow('Posizione non disponibile');
});

it('senza GPS → "Posizione non disponibile"', async () => {
  vi.stubGlobal('navigator', {});
  await expect(getCurrentPosition()).rejects.toThrow('Posizione non disponibile');
});
