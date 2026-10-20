import { CameraError, openCamera } from './camera';

const video = () => ({ srcObject: null as MediaStream | null, play: vi.fn(async () => {}), setAttribute: vi.fn() }) as unknown as HTMLVideoElement;

afterEach(() => vi.unstubAllGlobals());

it('getUserMedia rifiutato con NotAllowedError → CameraError denied', async () => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })) } });
  const err = await openCamera(video()).catch((e) => e);
  expect(err).toBeInstanceOf(CameraError);
  expect(err.reason).toBe('denied');
});

it('nessun mediaDevices → CameraError unavailable', async () => {
  vi.stubGlobal('navigator', {});
  await expect(openCamera(video())).rejects.toMatchObject({ reason: 'unavailable' });
});

it('fotocamera posteriore; stop ferma le tracce', async () => {
  const stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }], getVideoTracks: () => [{ stop: stopTrack, getCapabilities: () => ({}) }] };
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const v = video();
  const cam = await openCamera(v);
  expect(getUserMedia.mock.calls[0][0]).toMatchObject({ video: { facingMode: 'environment' }, audio: false });
  expect(v.srcObject).toBe(stream);
  cam.stop();
  expect(stopTrack).toHaveBeenCalled();
});
