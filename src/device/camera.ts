export class CameraError extends Error {
  constructor(public reason: 'denied' | 'unavailable') {
    super(reason === 'denied' ? 'Accesso alla fotocamera negato' : 'Fotocamera non disponibile');
    this.name = 'CameraError';
  }
}

export interface CameraHandle {
  stop(): void;
  setTorch(on: boolean): Promise<boolean>;
}

/** Apre la fotocamera posteriore nel <video>. */
export async function openCamera(video: HTMLVideoElement): Promise<CameraHandle> {
  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!media?.getUserMedia) throw new CameraError('unavailable');

  let stream: MediaStream;
  try {
    stream = await media.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    const name = (e as { name?: string }).name;
    throw new CameraError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
  }

  video.setAttribute('playsinline', 'true');
  video.setAttribute('muted', 'true');
  video.srcObject = stream;
  await video.play().catch(() => {});

  const track = stream.getVideoTracks()[0];
  return {
    stop: () => stream.getTracks().forEach((t) => t.stop()),
    async setTorch(on) {
      const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      if (!caps?.torch) return false;
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      return true;
    },
  };
}
