import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteScreen } from './RouteScreen';
import { db } from '../../../data/db';
import { createRoute, putStop, saveSettings } from '../../../data/repos';
import { OrsError } from '../../../services/ors/orsClient';
import { makeStop } from '../../../test/fixtures';
import { AppStateContext, type AppState } from '../../useAppState';

vi.mock('../../map/MapView', () => ({ MapView: () => <div /> }));
const svc = vi.hoisted(() => ({
  error: undefined as unknown,
  pending: 0,
  enqueueRoute: vi.fn(async () => {}),
}));
vi.mock('../../appServices', () => ({
  geocodeQueue: {
    enqueueRoute: svc.enqueueRoute,
    enqueue: vi.fn(),
    onChange: () => () => {},
    pendingCount: () => svc.pending,
    lastError: () => svc.error,
  },
  optimizeDeps: {},
}));

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
  svc.error = undefined;
  svc.pending = 0;
  svc.enqueueRoute.mockClear();
  await saveSettings({ orsApiKey: 'k' });
  routeId = (await createRoute({ date: '2026-10-20' })).id;
  await putStop(makeStop({ id: 'a', routeId }));
});

it('ricerca indirizzi ferma per la chiave → lo dice e porta alle Impostazioni', async () => {
  svc.error = new OrsError('bad_key');
  const app = renderScreen(routeId);
  expect(await screen.findByText('Ricerca indirizzi ferma: La chiave OpenRouteService non è valida.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Impostazioni' }));
  expect(app.openScreen).toHaveBeenCalledWith('settings');
});

it('mostra quante posizioni sono ancora in ricerca', async () => {
  svc.pending = 3;
  renderScreen(routeId);
  expect(await screen.findByText('Ricerca posizioni: 3 in corso')).toBeInTheDocument();
});

it('salvare la chiave fa ripartire la ricerca delle posizioni', async () => {
  renderScreen(routeId);
  await waitFor(() => expect(svc.enqueueRoute).toHaveBeenCalledTimes(1));
  await saveSettings({ orsApiKey: 'nuova' });
  await waitFor(() => expect(svc.enqueueRoute).toHaveBeenCalledTimes(2));
});

it('Riottimizza su un percorso ottimizzato con fermate da verificare mostra l\'avviso', async () => {
  await db.routes.update(routeId, { status: 'optimized' });
  await putStop(makeStop({ id: 'u', routeId, originalIndex: 1, geoStatus: 'uncertain' }));
  const app = renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Altre azioni del percorso' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Riottimizza percorso…' }));
  expect(await screen.findByText('1 fermate senza posizione')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Verifica ora' }));
  expect(app.openScreen).toHaveBeenCalledWith('verify', { routeId });
});

it('fermate ancora in ricerca → avviso senza rimandare alla verifica', async () => {
  await putStop(makeStop({ id: 'p', routeId, originalIndex: 1, geoStatus: 'pending', location: undefined }));
  renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Ottimizza percorso' }));
  expect(await screen.findByText('1 fermate ancora in ricerca della posizione')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Verifica ora' })).toBeNull();
});

it('salvare la chiave Google o cambiare motore fa ripartire la ricerca', async () => {
  renderScreen(routeId);
  await waitFor(() => expect(svc.enqueueRoute).toHaveBeenCalledTimes(1));
  await saveSettings({ geocoderProvider: 'google' });
  await waitFor(() => expect(svc.enqueueRoute).toHaveBeenCalledTimes(2));
  await saveSettings({ googleApiKey: 'gk' });
  await waitFor(() => expect(svc.enqueueRoute).toHaveBeenCalledTimes(3));
});
