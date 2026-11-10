import { render, screen, waitFor, within } from '@testing-library/react';
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
  expect(within(screen.getByRole('region', { name: 'Fermata attuale' })).getByText('1/2 · 08:10')).toBeInTheDocument();
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

it('Non riuscita chiede il motivo, lo salva e passa alla fermata successiva', async () => {
  const app = renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Non riuscita' }));
  const sheet = await screen.findByRole('dialog', { name: 'Perché non è riuscita?' });
  await userEvent.click(within(sheet).getByRole('button', { name: '2° tentativo' }));
  await userEvent.click(within(sheet).getByRole('button', { name: 'Non in casa' }));
  expect(await screen.findByRole('heading', { name: 'Via Seconda, 2' })).toBeInTheDocument();
  expect(await getStop('a')).toMatchObject({ outcome: 'failed', failReason: 'not_home', attempt: 2 });
  expect(app.showToast).toHaveBeenCalledWith('Fermata 1 non riuscita: non in casa (2° tentativo)', expect.anything());
});

it('la posizione del pacco nel furgone si vede in grande, con i prossimi pacchi', async () => {
  await db.stops.update('a', { findPackage: { positions: ['back', 'left'] } });
  await db.stops.update('b', { findPackage: { positions: ['shelf'] } });
  renderScreen(routeId);
  const card = await screen.findByRole('region', { name: 'Fermata attuale' });
  expect(await within(card).findByText('Dietro · Sinistra')).toBeInTheDocument();
  expect(within(card).getByText('Poi')).toBeInTheDocument();
  expect(within(card).getByText('Ripiano')).toBeInTheDocument();
});

it('con il telefono: Chiama, SMS e WhatsApp con il messaggio già scritto', async () => {
  await db.stops.update('a', { phone: '3331234567' });
  renderScreen(routeId);
  expect(await screen.findByRole('link', { name: 'Chiama' })).toHaveAttribute('href', 'tel:+393331234567');
  expect(screen.getByRole('link', { name: 'SMS' }).getAttribute('href')).toMatch(/^sms:\+393331234567&body=/);
  expect(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/393331234567\?text=/);
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
  await userEvent.click(await screen.findByRole('button', { name: 'Rifiutato' }));
  expect(await screen.findByText('Percorso completato!')).toBeInTheDocument();
  expect(screen.getByText('Rifiutato: 1')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Salva copia di sicurezza/ })).toBeInTheDocument();
  expect(screen.getByText('1 fermata')).toBeInTheDocument();
  expect(screen.getByText('1 fermata mancata')).toBeInTheDocument();
});

it('percorso confermato: Avvia percorso', async () => {
  await db.routes.update(routeId, { status: 'confirmed' });
  renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Avvia percorso' }));
  await waitFor(async () => expect((await db.routes.get(routeId))?.status).toBe('in_progress'));
});

it('con la X si passa all\'elenco del percorso e si torna alla fermata attuale', async () => {
  renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Chiudi scheda' }));
  expect(screen.queryByRole('region', { name: 'Fermata attuale' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Via Seconda, 2/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Torna alla fermata attuale' }));
  expect(await screen.findByRole('region', { name: 'Fermata attuale' })).toBeInTheDocument();
});

it('elenco durante il giro: spunta verde nell\'ID delle fatte e pulsante per scorrere alla fermata attuale', async () => {
  await db.stops.update('a', { outcome: 'done' });
  const scrolled: string[] = [];
  Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.textContent ?? ''); };
  renderScreen(routeId);
  await userEvent.click(await screen.findByRole('button', { name: 'Chiudi scheda' }));
  const done = screen.getByRole('button', { name: /Via Prima, 1/ });
  expect(within(done).getByText('ID 1').closest('.tl-chip')).toHaveClass('done');
  expect(within(screen.getByRole('button', { name: /Via Seconda, 2/ })).getByText('ID 2').closest('.tl-chip')).not.toHaveClass('done');
  await userEvent.click(screen.getByRole('button', { name: 'Scorri alla fermata attuale' }));
  expect(scrolled.some((t) => t.includes('Via Seconda, 2'))).toBe(true);
});
