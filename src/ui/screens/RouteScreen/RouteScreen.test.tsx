import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteScreen } from './RouteScreen';
import { db } from '../../../data/db';
import { createRoute, putStop, saveSettings } from '../../../data/repos';
import { makeStop } from '../../../test/fixtures';
import { AppStateContext, type AppState } from '../../useAppState';

vi.mock('../../map/MapView', () => ({ MapView: () => <div /> }));

function renderScreen(routeId: string, app: Partial<AppState> = {}) {
  const state: AppState = { setCurrentRouteId: vi.fn(), sheet: 'half', setSheet: vi.fn(), openScreen: vi.fn(),
    closeScreen: vi.fn(), showToast: vi.fn(), ...app };
  render(<AppStateContext.Provider value={state}><RouteScreen routeId={routeId} theme="dark" /></AppStateContext.Provider>);
  return state;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('con fermate da verificare non ottimizza e offre "Verifica ora"', async () => {
  await saveSettings({ orsApiKey: 'k' });
  const route = await createRoute({ date: '2026-10-20' });
  await putStop(makeStop({ id: 'a', routeId: route.id }));
  await putStop(makeStop({ id: 'b', routeId: route.id, originalIndex: 1, geoStatus: 'uncertain' }));
  const app = renderScreen(route.id);
  await userEvent.click(await screen.findByRole('button', { name: 'Ottimizza percorso' }));
  expect(await screen.findByText('1 fermate senza posizione')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Verifica ora' }));
  expect(app.openScreen).toHaveBeenCalledWith('verify', { routeId: route.id });
});

it('percorso ottimizzato: riepilogo, Perfeziona e Conferma il percorso', async () => {
  const route = await createRoute({ date: '2026-10-20' });
  await db.routes.update(route.id, { status: 'optimized', totals: { km: 63.7, minutes: 90, endTime: '23:57' } });
  await putStop(makeStop({ id: 'a', routeId: route.id, sequence: 0, eta: '22:28' }));
  renderScreen(route.id);
  expect(await screen.findByText('Termine: 23:57 · 1 fermate · 63,7 km')).toBeInTheDocument();
  expect(screen.getByText('Nessuna sosta')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Perfeziona' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Conferma il percorso' }));
  expect((await db.routes.get(route.id))?.status).toBe('confirmed');
});
