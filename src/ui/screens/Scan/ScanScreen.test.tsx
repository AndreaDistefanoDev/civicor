import { act, render, screen, waitFor, within } from '@testing-library/react';
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
const ocr = vi.hoisted(() => ({ text: '', reads: 0 }));
vi.mock('../../../device/ocr', () => ({
  prepareOcr: vi.fn(async () => ({})),
  captureFrame: vi.fn(() => document.createElement('canvas')),
  rotate: vi.fn((c: HTMLCanvasElement) => c),
  readText: vi.fn(async () => {
    ocr.reads++;
    return ocr.text;
  }),
}));

let routeId: string;
beforeEach(async () => {
  await db.delete();
  await db.open();
  routeId = (await createRoute({ date: '2026-10-20' })).id;
  camera.result = 'ok';
  queue.enqueue.mockClear();
  queue.lastError.mockReturnValue(undefined);
  ocr.text = '';
  ocr.reads = 0;
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

it('codice che non contiene un indirizzo (altri corrieri): nessun errore, salvato una volta per migliorare il lettore', async () => {
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  await waitFor(() => expect(scanner.onPayload).toBeDefined());
  await act(async () => scanner.onPayload!('https://example.com'));
  await act(async () => scanner.onPayload!('https://example.com'));
  expect(screen.queryByText('Codice non riconosciuto')).not.toBeInTheDocument();
  await waitFor(async () => expect(await db.unreadableCodes.count()).toBe(1));
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

it('dopo la lettura si sceglie con un tocco dove va il pacco nel furgone', async () => {
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  await waitFor(() => expect(scanner.onPayload).toBeDefined());
  await act(async () => scanner.onPayload!(buildGlsPayload(label)));
  const group = await screen.findByRole('group', { name: 'Dove lo metti nel furgone?' }, { timeout: 3000 });
  await userEvent.click(within(group).getByRole('button', { name: 'Dietro' }));
  await userEvent.click(within(group).getByRole('button', { name: 'Sinistra' }));
  await waitFor(async () => expect((await listStops(routeId))[0].findPackage?.positions).toEqual(['back', 'left']), { timeout: 3000 });
  expect(within(group).getByRole('button', { name: 'Dietro' })).toHaveAttribute('aria-pressed', 'true');
});

const PRINTED = 'MITTENTE NEGOZIO\nVIA DEL MAGAZZINO 5\n20100 MILANO MI\nDESTINATARIO\nMARIO ROSSI\nVIA ROMA 18\n97100 RAGUSA RG';

it('etichetta di qualsiasi corriere: legge da sola l\'indirizzo stampato, si controlla il civico e si aggiunge', async () => {
  ocr.text = PRINTED;
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  const card = await screen.findByRole('group', { name: 'Indirizzo letto' }, { timeout: 3000 });
  expect(within(card).getByText('Mario Rossi')).toBeInTheDocument();
  const street = within(card).getByLabelText('Via e civico');
  await userEvent.clear(street);
  await userEvent.type(street, 'Via Roma 10');
  await userEvent.click(within(card).getByRole('button', { name: 'Aggiungi' }));
  await waitFor(async () => expect(await listStops(routeId)).toHaveLength(1));
  const [stop] = await listStops(routeId);
  expect(stop.address).toMatchObject({ street: 'Via Roma 10', postcode: '97100', city: 'Ragusa' });
  expect(queue.enqueue).toHaveBeenCalledWith(stop.id);
  expect(await screen.findByText('Via Roma 10 · Ragusa, 97100')).toBeInTheDocument();
});

it('un indirizzo già nel giro non viene riproposto da solo, ma con "Leggi" sì', async () => {
  await putStop(makeStop({ id: 'x', routeId, address: { street: 'Via Roma 18', city: 'Ragusa', postcode: '97100' } }));
  ocr.text = PRINTED;
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  await waitFor(() => expect(ocr.reads).toBeGreaterThan(1), { timeout: 3000 });
  expect(screen.queryByRole('group', { name: 'Indirizzo letto' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Leggi etichetta' }));
  expect(await screen.findByRole('group', { name: 'Indirizzo letto' })).toBeInTheDocument();
});

it('si può scrivere o incollare il testo (anche con "Scansiona testo" dell\'iPhone)', async () => {
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Scrivi o incolla il testo' }));
  await userEvent.type(screen.getByLabelText('Testo dell\'etichetta'), 'Anna Neri Piazza Duomo 1 97100 Ragusa RG');
  await userEvent.click(screen.getByRole('button', { name: 'Trova indirizzo' }));
  expect(await screen.findByLabelText('Via e civico')).toHaveValue('Piazza Duomo 1');
});

it('città illeggibile: la scheda propone la città più frequente del giro', async () => {
  await putStop(makeStop({ id: 'a', routeId, address: { street: 'Via Uno, 1', city: 'Ragusa', postcode: '97100' } }));
  await putStop(makeStop({ id: 'b', routeId, originalIndex: 1, address: { street: 'Via Due, 2', city: 'Ragusa', postcode: '97100' } }));
  await putStop(makeStop({ id: 'c', routeId, originalIndex: 2, address: { street: 'Via Tre, 3', city: 'Modica', postcode: '97015' } }));
  ocr.text = "A R2 |via mazzini, 17/b e PI é '";
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  const card = await screen.findByRole('group', { name: 'Indirizzo letto' }, { timeout: 3000 });
  expect(within(card).getByLabelText('Via e civico')).toHaveValue('Via Mazzini, 17/B');
  expect(within(card).getByLabelText('Città')).toHaveValue('Ragusa');
});

it('città letta male ma simile a una del giro: la scheda propone quella giusta', async () => {
  await putStop(makeStop({ id: 'a', routeId, address: { street: 'Via Uno, 1', city: 'Ragusa', postcode: '97100' } }));
  ocr.text = 'Via Verdi, 70\nEEE qusa RG';
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  const card = await screen.findByRole('group', { name: 'Indirizzo letto' }, { timeout: 3000 });
  expect(within(card).getByLabelText('Città')).toHaveValue('Ragusa');
});

it('toccando l\'immagine della fotocamera legge subito l\'indirizzo inquadrato', async () => {
  await putStop(makeStop({ id: 'x', routeId, address: { street: 'Via Roma 18', city: 'Ragusa', postcode: '97100' } }));
  ocr.text = PRINTED;
  render(<ScanScreen routeId={routeId} onDone={vi.fn()} onManualAdd={vi.fn()} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Tocca per leggere l\'indirizzo inquadrato' }));
  expect(await screen.findByRole('group', { name: 'Indirizzo letto' })).toBeInTheDocument();
  expect(screen.getByText('Punta la fotocamera su un indirizzo o tocca per selezionarlo')).toBeInTheDocument();
});
