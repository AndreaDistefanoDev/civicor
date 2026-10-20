import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerifyScreen } from './VerifyScreen';
import { db } from '../../../data/db';
import { getCorrection, getStop, putStop } from '../../../data/repos';
import { addressKey } from '../../../domain/address/normalize';
import { makeStop } from '../../../test/fixtures';
import type { MapViewProps } from '../../map/MapView';

vi.mock('../../map/MapView', () => ({
  MapView: (p: MapViewProps) => (
    <button onClick={() => p.draggable?.onMove({ lat: 36.95, lng: 14.75 })}>sposta il punto</button>
  ),
}));

beforeEach(async () => {
  await db.delete();
  await db.open();
  await putStop(makeStop({ id: 'a', originalIndex: 0, address: { street: 'Contrada Prova', city: 'Ragusa', postcode: '97100' },
    geoStatus: 'uncertain', geoReason: 'trovata solo la località', senderNotes: 'chiamare prima' }));
  await putStop(makeStop({ id: 'b', originalIndex: 1, address: { street: 'Via Altra, 3', city: 'Ragusa', postcode: '97100' },
    geoStatus: 'failed', geoReason: 'indirizzo non trovato', location: undefined }));
  await putStop(makeStop({ id: 'c', originalIndex: 2 }));
});

it('mostra solo le fermate incerte, una alla volta', async () => {
  render(<VerifyScreen routeId="r1" theme="dark" onFinish={vi.fn()} onClose={vi.fn()} />);
  expect(await screen.findByText('2 indirizzi da verificare')).toBeInTheDocument();
  expect(screen.getByText('Contrada Prova')).toBeInTheDocument();
  expect(screen.getByText('trovata solo la località')).toBeInTheDocument();
  expect(screen.getByText('chiamare prima')).toBeInTheDocument();
  expect(screen.getByText('La correzione viene ricordata per le prossime volte')).toBeInTheDocument();
});

it('spostare il punto e confermare salva la posizione e la ricorda', async () => {
  render(<VerifyScreen routeId="r1" theme="dark" onFinish={vi.fn()} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'sposta il punto' }));
  await userEvent.click(screen.getByRole('button', { name: 'Conferma posizione' }));
  await waitFor(async () => expect(await getStop('a')).toMatchObject({ geoStatus: 'ok', location: { lat: 36.95, lng: 14.75 } }));
  expect((await getStop('a'))?.geoReason).toBeUndefined();
  const key = addressKey({ street: 'Contrada Prova', city: 'Ragusa', postcode: '97100' });
  expect(await getCorrection(key)).toEqual({ lat: 36.95, lng: 14.75 });
  expect(await screen.findByText('Via Altra, 3')).toBeInTheDocument();
});

it('"Salta per ora" passa alla successiva senza salvare', async () => {
  render(<VerifyScreen routeId="r1" theme="dark" onFinish={vi.fn()} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Salta per ora' }));
  expect(await screen.findByText('Via Altra, 3')).toBeInTheDocument();
  expect((await getStop('a'))?.geoStatus).toBe('uncertain');
});

it('dopo l\'ultima chiama onFinish', async () => {
  const onFinish = vi.fn();
  render(<VerifyScreen routeId="r1" theme="dark" onFinish={onFinish} onClose={vi.fn()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Salta per ora' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Conferma posizione' }));
  await waitFor(() => expect(onFinish).toHaveBeenCalled());
  expect((await getStop('b'))?.geoStatus).toBe('ok');
});

it('nessuna fermata da verificare → onFinish subito', async () => {
  await db.stops.bulkDelete(['a', 'b']);
  const onFinish = vi.fn();
  render(<VerifyScreen routeId="r1" theme="dark" onFinish={onFinish} onClose={vi.fn()} />);
  await waitFor(() => expect(onFinish).toHaveBeenCalled());
});
