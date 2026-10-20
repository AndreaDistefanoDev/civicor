import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanScreen } from './ScanScreen';
import { db } from '../../../data/db';
import { createRoute, listStops, putStop } from '../../../data/repos';
import { buildGlsPayload } from '../../../domain/gls/testPayload';
import { makeStop } from '../../../test/fixtures';
import { CameraError } from '../../../device/camera';

const camera = vi.hoisted(() => ({ result: 'ok' as 'ok' | 'denied' }));
const scanner = vi.hoisted(() => ({ onPayload: undefined as undefined | ((t: string) => void) }));
const queue = vi.hoisted(() => ({ enqueue: vi.fn(), onChange: () => () => {}, pendingCount: () => 0, lastError: vi.fn(() => undefined as unknown) }));

vi.mock('../../../device/camera', async (orig) => {
  const real = await orig<typeof import('../../../device/camera')>();
  return {
    ...real,
    openCamera: vi.fn(async () => {
      if (camera.result === 'denied') throw new real.CameraError('denied');
      return { stop: vi.fn(), setTorch: vi.fn(async () => true) };
    }),
  };
});
vi.mock('../../../device/scanner', () => ({
  createScanner: (opts: { onPayload: (t: string) => void }) => {
    scanner.onPayload = opts.onPayload;
    return { start: vi.fn(), stop: vi.fn() };
  },
  decodeInWorker: vi.fn(),
}));
vi.mock('../../../device/feedback', () => ({ unlockAudio: vi.fn(), playSuccess: vi.fn(), playDuplicate: vi.fn(), playError: vi.fn() }));
vi.mock('../../appServices', () => ({ geocodeQueue: queue }));

let routeId: string;
beforeEach(async () => {
  await db.delete();
  await db.open();
  routeId = (await createRoute({ date: '2026-10-20' })).id;
  camera.result = 'ok';
  queue.enqueue.mockClear();
  queue.lastError.mockReturnValue(undefined);
});

it('se la ricerca indirizzi è ferma per la chiave lo dice anche durante la scansione', async () => {
  const { OrsError } = await import('../../../services/ors/orsClient');
  queue.lastError.mockReturnValue(new OrsError('missing_key'));
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} onOpenSettings={vi.fn()} />);
  expect(await screen.findByText('Ricerca indirizzi ferma: Inserisci la chiave OpenRouteService nelle Impostazioni.')).toBeInTheDocument();
});

const label = {
  trackingNumber: 'ZZ123456789010RG', recipient: 'mario rossi', street: 'Via Esempio, 12',
  city: 'ragusa', postcode: '97100', province: 'RG',
};

it('un\'etichetta letta viene salvata, mostrata e messa in coda per la posizione', async () => {
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  await waitFor(() => expect(scanner.onPayload).toBeDefined());
  await act(async () => scanner.onPayload!(buildGlsPayload(label)));
  await waitFor(async () => expect(await listStops(routeId)).toHaveLength(1));
  expect(await screen.findByText('Via Esempio, 12 · Ragusa, 97100')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Fine (1 fermate)' })).toBeInTheDocument();
  expect(queue.enqueue).toHaveBeenCalledWith((await listStops(routeId))[0].id);
});

it('stessa etichetta due volte → "Già scansionata", una sola fermata', async () => {
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  await waitFor(() => expect(scanner.onPayload).toBeDefined());
  await act(async () => scanner.onPayload!(buildGlsPayload(label)));
  await act(async () => scanner.onPayload!(buildGlsPayload(label)));
  expect(await screen.findByText('Già scansionata')).toBeInTheDocument();
  expect(await listStops(routeId)).toHaveLength(1);
});

it('codice non GLS → "Codice non riconosciuto" e salvato per migliorare il lettore', async () => {
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  await waitFor(() => expect(scanner.onPayload).toBeDefined());
  await act(async () => scanner.onPayload!('https://example.com'));
  expect(await screen.findByText('Codice non riconosciuto')).toBeInTheDocument();
  expect(await db.unreadableCodes.count()).toBe(1);
});

it('mostra quante fermate sono da verificare', async () => {
  await putStop(makeStop({ id: 'x', routeId, geoStatus: 'uncertain' }));
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByText('1 da verificare')).toBeInTheDocument();
});

it('fotocamera negata → spiega come consentirla e offre l\'inserimento a mano', async () => {
  camera.result = 'denied';
  const onManualAdd = vi.fn();
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={onManualAdd} onClose={vi.fn()} />);
  expect(await screen.findByText("Consenti l'accesso alla fotocamera in Impostazioni > Safari per scansionare le etichette.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi a mano' }));
  expect(onManualAdd).toHaveBeenCalled();
  expect(CameraError).toBeDefined();
});

it('"Fine" passa il percorso a onDone', async () => {
  const onDone = vi.fn();
  render(<ScanScreen routeId={routeId} onDone={onDone} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Fine (0 fermate)' }));
  expect(onDone).toHaveBeenCalledWith(routeId);
});
