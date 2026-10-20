import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddressSearch } from './AddressSearch';
import { VoiceInput } from './VoiceInput';
import { db } from '../../../data/db';
import { listStops, putStop } from '../../../data/repos';
import { makeStop } from '../../../test/fixtures';
import type { Geocoder } from '../../../services/geocoder';

const geocoder: Geocoder = {
  geocode: vi.fn(),
  geocodeText: vi.fn(),
  autocomplete: vi.fn(async () => [{ label: 'Via Roma 20, Ragusa', precision: 'house' as const,
    address: { street: 'Via Roma, 20', city: 'Ragusa', postcode: '97100' }, location: { lat: 36.9, lng: 14.7 } }]),
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.mocked(geocoder.autocomplete).mockClear();
});

it('chiede i suggerimenti una sola volta dopo una pausa di 250 ms', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<AddressSearch routeId="r1" geocoder={geocoder} onClose={vi.fn()} onPickOnMap={vi.fn()} onPaste={vi.fn()} />);
  await user.type(screen.getByLabelText('Cerca indirizzo'), 'Via Rom');
  expect(geocoder.autocomplete).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(260));
  expect(geocoder.autocomplete).toHaveBeenCalledTimes(1);
  expect(geocoder.autocomplete).toHaveBeenCalledWith('Via Rom', undefined);
  vi.useRealTimers();
});

it('i suggerimenti privilegiano la zona del percorso', async () => {
  await putStop(makeStop({ id: 'x', routeId: 'r1', location: { lat: 36.92, lng: 14.73 } }));
  render(<AddressSearch routeId="r1" geocoder={geocoder} onClose={vi.fn()} onPickOnMap={vi.fn()} onPaste={vi.fn()} />);
  await new Promise((r) => setTimeout(r, 50));
  await userEvent.type(screen.getByLabelText('Cerca indirizzo'), 'Via Rom');
  await waitFor(() => expect(geocoder.autocomplete).toHaveBeenCalledWith('Via Rom', { lat: 36.92, lng: 14.73 }));
});

it('scegliere un suggerimento aggiunge la fermata e lo conferma', async () => {
  render(<AddressSearch routeId="r1" geocoder={geocoder} onClose={vi.fn()} onPickOnMap={vi.fn()} onPaste={vi.fn()} />);
  await userEvent.type(screen.getByLabelText('Cerca indirizzo'), 'Via Rom');
  await userEvent.click(await screen.findByRole('button', { name: /Via Roma 20, Ragusa/ }));
  await waitFor(async () => expect(await listStops('r1')).toHaveLength(1));
  expect(await screen.findByText('Aggiunta ✓ Via Roma, 20')).toBeInTheDocument();
  expect(screen.getByLabelText('Cerca indirizzo')).toHaveValue('');
});

it('offre "Scegli sulla mappa" e "Incolla una lista"', async () => {
  const onPickOnMap = vi.fn();
  const onPaste = vi.fn();
  render(<AddressSearch routeId="r1" geocoder={geocoder} onClose={vi.fn()} onPickOnMap={onPickOnMap} onPaste={onPaste} />);
  await userEvent.click(screen.getByRole('button', { name: 'Scegli sulla mappa' }));
  await userEvent.click(screen.getByRole('button', { name: 'Incolla una lista di indirizzi' }));
  expect(onPickOnMap).toHaveBeenCalled();
  expect(onPaste).toHaveBeenCalled();
});

it('voce non disponibile → suggerisce il microfono della tastiera', async () => {
  vi.stubGlobal('webkitSpeechRecognition', undefined);
  vi.stubGlobal('SpeechRecognition', undefined);
  render(<VoiceInput routeId="r1" geocoder={geocoder} onClose={vi.fn()} />);
  expect(screen.getByText("Usa il microfono della tastiera per dettare l'indirizzo")).toBeInTheDocument();
  expect(screen.getByLabelText('Cerca indirizzo')).toBeInTheDocument();
  vi.unstubAllGlobals();
});

it('se il riconoscimento vocale fallisce passa al microfono della tastiera', async () => {
  class FailingRecognition {
    lang = ''; continuous = false; interimResults = false;
    onresult = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
    start() { setTimeout(() => this.onerror?.(), 0); }
    stop() {}
  }
  vi.stubGlobal('webkitSpeechRecognition', FailingRecognition);
  render(<VoiceInput routeId="r1" geocoder={geocoder} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Inizia ascolto' }));
  expect(await screen.findByText("Usa il microfono della tastiera per dettare l'indirizzo")).toBeInTheDocument();
  expect(screen.getByLabelText('Cerca indirizzo')).toBeInTheDocument();
  vi.unstubAllGlobals();
});
