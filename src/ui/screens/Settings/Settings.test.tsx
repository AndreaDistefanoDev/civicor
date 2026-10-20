import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from './Settings';
import { db } from '../../../data/db';
import { getSettings } from '../../../data/repos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('scegliere Google Maps salva l\'app di navigazione', async () => {
  render(<Settings onClose={() => {}} />);
  await userEvent.selectOptions(await screen.findByLabelText('App di navigazione'), 'Google Maps');
  await waitFor(async () => expect((await getSettings()).navApp).toBe('google'));
});

it('salva la chiave OpenRouteService', async () => {
  render(<Settings onClose={() => {}} />);
  await userEvent.type(await screen.findByLabelText('Chiave OpenRouteService'), 'abc123');
  await userEvent.tab();
  await waitFor(async () => expect((await getSettings()).orsApiKey).toBe('abc123'));
});

it('pulizia: "Mai" disattiva l\'eliminazione automatica', async () => {
  render(<Settings onClose={() => {}} />);
  await userEvent.selectOptions(await screen.findByLabelText('Elimina percorsi più vecchi di'), 'Mai');
  await waitFor(async () => expect((await getSettings()).retentionMonths).toBeNull());
});

it('importare un file non valido mostra un messaggio', async () => {
  render(<Settings onClose={() => {}} />);
  const file = new File(['{"app":"altro"}'], 'backup.json', { type: 'application/json' });
  await userEvent.upload(await screen.findByLabelText('Importa backup'), file);
  expect(await screen.findByText('File di backup non valido')).toBeInTheDocument();
});

it('sceglie Google per la ricerca indirizzi e ne salva la chiave', async () => {
  render(<Settings onClose={() => {}} />);
  await userEvent.selectOptions(await screen.findByLabelText('Ricerca indirizzi'), 'Google (più preciso)');
  await userEvent.type(screen.getByLabelText('Chiave Google'), 'gk123');
  await userEvent.tab();
  await waitFor(async () => expect(await getSettings()).toMatchObject({ geocoderProvider: 'google', googleApiKey: 'gk123' }));
});
