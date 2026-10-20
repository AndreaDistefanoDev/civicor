import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteScreen } from './RouteScreen';
import { db } from '../../../data/db';
import { createRoute, getStop, putStop, saveSettings } from '../../../data/repos';
import { makeStop } from '../../../test/fixtures';
import { AppStateContext, type AppState } from '../../useAppState';

vi.mock('../../map/MapView', () => ({ MapView: () => <div /> }));
const external = vi.hoisted(() => ({ openExternal: vi.fn() }));
vi.mock('../../../device/openExternal', () => external);

function renderScreen(routeId: string) {
  const state: AppState = { setCurrentRouteId: vi.fn(), sheet: 'half', setSheet: vi.fn(), openScreen: vi.fn(),
    closeScreen: vi.fn(), showToast: vi.fn() };
  render(<AppStateContext.Provider value={state}><RouteScreen routeId={routeId} theme="dark" /></AppStateContext.Provider>);
  return state;
}

let routeId: string;
beforeEach(async () => {
  await db.delete();
  await db.open();
  external.openExternal.mockClear();
  routeId = (await createRoute({ date: '2026-10-20' })).id;
  await db.routes.update(routeId, { status: 'in_progress' });
  await putStop(makeStop({ id: 'a', routeId, sequence: 0, displayId: 1, eta: '08:10', address: { street: 'Via Prima, 1', city: 'Ragusa' }, location: { lat: 36.92587, lng: 14.73091 } }));
  await putStop(makeStop({ id: 'b', routeId, sequence: 1, displayId: 2, originalIndex: 1, eta: '08:20', address: { street: 'Via Seconda, 2', city: 'Ragusa' } }));
});

it('la card mostra la fermata corrente con posizione e orario', async () => {
  renderScreen(routeId);
  expect(await screen.findByRole('heading', { name: 'Via Prima, 1' })).toBeInTheDocument();
  expect(screen.getByText('1/2 · 08:10')).toBeInTheDocument();
});

it('Effettuata salva subito e offre Annulla', async () => {
  const app = renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Effettuata' }));
  await waitFor(async () => expect((await getStop('a'))?.outcome).toBe('done'));
  expect(app.showToast).toHaveBeenCalledWith('Fermata 1 contrassegnata come effettuata', expect.objectContaining({ label: 'Annulla' }));
  const action = vi.mocked(app.showToast).mock.calls[0][1]!;
  action.onPress();
  await waitFor(async () => expect((await getStop('a'))?.outcome).toBe('pending'));
});

it('Non riuscita passa alla fermata successiva', async () => {
  const app = renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Non riuscita' }));
  expect(await screen.findByRole('heading', { name: 'Via Seconda, 2' })).toBeInTheDocument();
  expect(app.showToast).toHaveBeenCalledWith('Fermata 1 contrassegnata come non riuscita', expect.anything());
});

it('Naviga apre l\'app scelta nelle Impostazioni', async () => {
  await saveSettings({ navApp: 'google' });
  renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Naviga' }));
  // Subito, dentro il tocco: iOS apre le app solo da un gesto dell'utente.
  expect(external.openExternal).toHaveBeenCalledWith(
    'comgooglemaps://?daddr=36.92587,14.73091&directionsmode=driving',
    'https://www.google.com/maps/dir/?api=1&destination=36.92587,14.73091&travelmode=driving');
});

it('dopo l\'ultima fermata mostra il riepilogo del percorso completato', async () => {
  await db.routes.update(routeId, { settings: { start: { mode: 'current' }, startTime: 'now', end: { mode: 'none' } } });
  renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Effettuata' }));
  await screen.findByRole('heading', { name: 'Via Seconda, 2' });
  await userEvent.click(screen.getByRole('button', { name: 'Non riuscita' }));
  expect(await screen.findByText('Percorso completato!')).toBeInTheDocument();
  expect(screen.getByText('1 fermate')).toBeInTheDocument();
  expect(screen.getByText('1 fermate mancate')).toBeInTheDocument();
});

it('percorso confermato: Avvia percorso', async () => {
  await db.routes.update(routeId, { status: 'confirmed' });
  renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Avvia percorso' }));
  await waitFor(async () => expect((await db.routes.get(routeId))?.status).toBe('in_progress'));
});
