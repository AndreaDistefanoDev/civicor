import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteDetails } from './RouteDetails';
import { db } from '../../../data/db';
import { createRoute, getRoute, getSettings } from '../../../data/repos';
import type { Geocoder } from '../../../services/geocoder';

const geocoder: Geocoder = {
  geocode: vi.fn(),
  geocodeText: vi.fn(),
  autocomplete: vi.fn(async () => [{
    label: 'Via Esempio 12, Ragusa', precision: 'house' as const,
    address: { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100' }, location: { lat: 36.9, lng: 14.7 },
  }]),
};

let routeId: string;
beforeEach(async () => {
  await db.delete();
  await db.open();
  routeId = (await createRoute({ date: '2026-10-20' })).id;
});

it('mostra le impostazioni predefinite del percorso', async () => {
  render(<RouteDetails routeId={routeId} geocoder={geocoder} onClose={() => {}} />);
  expect(await screen.findByText('Usa posizione attuale')).toBeInTheDocument();
  expect(screen.getByText('Inizia ora')).toBeInTheDocument();
  expect(screen.getByText('Ritorna all\'inizio')).toBeInTheDocument();
  expect(screen.getByText('Aggiungi una sosta')).toBeInTheDocument();
});

it('"Termina ad altro indirizzo" con un suggerimento salva la fine del percorso', async () => {
  const onClose = vi.fn();
  render(<RouteDetails routeId={routeId} geocoder={geocoder} onClose={onClose} />);
  await userEvent.click(await screen.findByRole('button', { name: /Ritorna all'inizio/ }));
  await userEvent.click(screen.getByRole('button', { name: /Termina ad altro indirizzo/ }));
  await userEvent.type(screen.getByLabelText('Cerca indirizzo'), 'Via Esem');
  await userEvent.click(await screen.findByRole('button', { name: /Via Esempio 12, Ragusa/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Fatto' }));
  await waitFor(async () => expect((await getRoute(routeId))?.settings.end).toEqual({
    mode: 'address', address: { street: 'Via Esempio, 12', city: 'Ragusa', postcode: '97100' }, location: { lat: 36.9, lng: 14.7 },
  }));
  expect(onClose).toHaveBeenCalled();
});

it('sosta con orari e durata', async () => {
  render(<RouteDetails routeId={routeId} geocoder={geocoder} onClose={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Aggiungi una sosta' }));
  expect(screen.getByLabelText('Primo orario')).toHaveValue('08:00');
  expect(screen.getByLabelText('Ultimo orario')).toHaveValue('18:00');
  expect(screen.getByLabelText('Durata sosta (minuti)')).toHaveValue('30');
  await userEvent.click(screen.getByRole('button', { name: 'Aggiungi la sosta' }));
  await userEvent.click(screen.getByRole('button', { name: 'Fatto' }));
  await waitFor(async () => expect((await getRoute(routeId))?.settings.break).toEqual({ earliest: '08:00', latest: '18:00', minutes: 30 }));
});

it('"Salva come predefinito" scrive le impostazioni predefinite', async () => {
  render(<RouteDetails routeId={routeId} geocoder={geocoder} onClose={() => {}} />);
  await userEvent.click(await screen.findByRole('switch', { name: 'Salva come predefinito' }));
  await userEvent.click(screen.getByRole('button', { name: 'Fatto' }));
  await waitFor(async () => expect((await getSettings()).defaultRouteSettings).toMatchObject({ end: { mode: 'return' } }));
});
