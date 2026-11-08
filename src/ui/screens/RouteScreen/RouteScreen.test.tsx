import { render, screen, waitFor } from '@testing-library/react';
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
  expect(await screen.findByText('Termine: 23:57 · 1 fermata · 63,7 km')).toBeInTheDocument();
  expect(screen.getByText('1 h 30 min')).toBeInTheDocument();
  expect(screen.getByText('Nessuna sosta')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Perfeziona' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Conferma il percorso' }));
  expect((await db.routes.get(route.id))?.status).toBe('confirmed');
});

it('percorso vuoto: tre scelte per aggiungere le fermate (Mappa, Scansiona, Voce)', async () => {
  const route = await createRoute({ date: '2026-10-20' });
  const app = renderScreen(route.id);
  expect(await screen.findByText('Aggiungi le prime fermate e inizia a creare un percorso')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Mappa' }));
  expect(app.openScreen).toHaveBeenCalledWith('pickOnMap', { routeId: route.id });
  await userEvent.click(screen.getByRole('button', { name: 'Voce' }));
  expect(app.openScreen).toHaveBeenCalledWith('voice', { routeId: route.id });
  await userEvent.click(screen.getByRole('button', { name: 'Scansiona' }));
  expect(app.openScreen).toHaveBeenCalledWith('scan', { routeId: route.id });
});

it('elenco a linea del tempo: numero e orario a sinistra, ID a destra', async () => {
  const route = await createRoute({ date: '2026-10-20' });
  await db.routes.update(route.id, { status: 'optimized', totals: { km: 3.4, minutes: 13, endTime: '18:29' } });
  await putStop(makeStop({ id: 'a', routeId: route.id, sequence: 0, eta: '18:19', displayId: 7, address: { street: 'Via Pino, 40', city: 'Scicli' } }));
  renderScreen(route.id);
  const row = await screen.findByRole('button', { name: /Via Pino, 40/ });
  expect(row).toHaveTextContent('01');
  expect(row).toHaveTextContent('18:19');
  expect(row).toHaveTextContent('ID 7');
});

it('fermate aggiunte a un percorso ottimizzato: "Applica modifiche" con Aggiorna o Riottimizza', async () => {
  const route = await createRoute({ date: '2026-10-20' });
  await db.routes.update(route.id, { status: 'confirmed', totals: { km: 3.4, minutes: 13, endTime: '18:29' } });
  await putStop(makeStop({ id: 'a', routeId: route.id, sequence: 0, address: { street: 'Via Uno, 1', city: 'Ragusa' } }));
  await putStop(makeStop({ id: 'n', routeId: route.id, originalIndex: 1, address: { street: 'Via Nuova, 9', city: 'Ragusa' } }));
  renderScreen(route.id);
  expect(await screen.findByText('Fermate aggiunte')).toBeInTheDocument();
  expect(screen.getByText('Percorso esistente')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Elimina' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Applica modifiche (1)' }));
  await userEvent.click(await screen.findByRole('button', { name: /Aggiorna percorso/ }));
  await waitFor(async () => expect((await db.stops.get('n'))?.sequence).toBe(1));
  expect(await screen.findByRole('button', { name: 'Avvia percorso' })).toBeInTheDocument();
});

it('"Elimina" toglie le fermate aggiunte dopo conferma', async () => {
  const route = await createRoute({ date: '2026-10-20' });
  await db.routes.update(route.id, { status: 'optimized', totals: { km: 3.4, minutes: 13, endTime: '18:29' } });
  await putStop(makeStop({ id: 'a', routeId: route.id, sequence: 0 }));
  await putStop(makeStop({ id: 'n', routeId: route.id, originalIndex: 1 }));
  renderScreen(route.id);
  await userEvent.click(await screen.findByRole('button', { name: 'Elimina' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Elimina fermate aggiunte' }));
  await waitFor(async () => expect(await db.stops.get('n')).toBeUndefined());
});

it('percorso confermato: "Condividi percorso" e "Carica veicolo"', async () => {
  const route = await createRoute({ date: '2026-10-20', name: 'Lunedì' });
  await db.routes.update(route.id, { status: 'confirmed', totals: { km: 3.4, minutes: 13, endTime: '18:29' } });
  await putStop(makeStop({ id: 'a', routeId: route.id, sequence: 0, eta: '08:10', address: { street: 'Via Prima, 1', city: 'Ragusa' } }));
  const share = vi.fn(async () => {});
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  const app = renderScreen(route.id);
  await userEvent.click(await screen.findByRole('button', { name: 'Carica veicolo' }));
  expect(app.openScreen).toHaveBeenCalledWith('loadVehicle', { routeId: route.id });
  await userEvent.click(screen.getByRole('button', { name: 'Condividi percorso' }));
  expect(share).toHaveBeenCalledWith({ title: 'Lunedì', text: 'Lunedì · fine giro 18:29\n1. 08:10 Via Prima, 1, Ragusa' });
  delete (navigator as { share?: unknown }).share;
});
