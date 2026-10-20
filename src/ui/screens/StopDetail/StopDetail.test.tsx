import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StopDetail } from './StopDetail';
import { db } from '../../../data/db';
import { getStop, listStops, putStop } from '../../../data/repos';
import { makeStop } from '../../../test/fixtures';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await putStop(makeStop());
});

const renderDetail = (over: Partial<Parameters<typeof StopDetail>[0]> = {}) =>
  render(<StopDetail stopId="s1" onClose={vi.fn()} onManageTypes={vi.fn()} onChangeAddress={vi.fn()} {...over} />);

it('mostra indirizzo, numero di spedizione e righe principali', async () => {
  renderDetail();
  expect(await screen.findByText('Via Esempio, 12')).toBeInTheDocument();
  expect(screen.getByText('Ragusa, 97100')).toBeInTheDocument();
  expect(screen.getByText('ZZ123456789010RG')).toBeInTheDocument();
  for (const label of ['Trova il pacco', 'Pacchi', 'Ordine', 'Tipo', 'Orario di arrivo', 'Tempo stimato alla fermata']) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }
  expect(screen.getByText('Qualsiasi orario')).toBeInTheDocument();
});

it('"+" porta i pacchi a 2 e "−" non scende sotto 1', async () => {
  renderDetail();
  const minus = await screen.findByRole('button', { name: 'Un pacco in meno' });
  expect(minus).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Un pacco in più' }));
  await waitFor(async () => expect((await getStop('s1'))?.packages).toBe(2));
});

it('"Ultima" e "Ritiro" si salvano subito', async () => {
  renderDetail();
  await userEvent.click(await screen.findByRole('button', { name: 'Ultima' }));
  await userEvent.click(screen.getByRole('button', { name: 'Ritiro' }));
  await waitFor(async () => expect(await getStop('s1')).toMatchObject({ order: 'last', kind: 'pickup' }));
});

it('salva la fascia oraria 14:00–18:00', async () => {
  renderDetail();
  await userEvent.click(await screen.findByRole('button', { name: /Orario di arrivo/ }));
  const from = screen.getByLabelText('Dalle');
  const to = screen.getByLabelText('Alle');
  await userEvent.clear(from);
  await userEvent.type(from, '14:00');
  await userEvent.clear(to);
  await userEvent.type(to, '18:00');
  await userEvent.click(screen.getByRole('button', { name: 'Fatto' }));
  await waitFor(async () => expect((await getStop('s1'))?.timeWindows).toEqual([{ start: '14:00', end: '18:00' }]));
  expect(await screen.findByText('14:00–18:00')).toBeInTheDocument();
});

it('salva la posizione del pacco nel veicolo', async () => {
  renderDetail();
  await userEvent.click(await screen.findByRole('button', { name: /Trova il pacco/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Grande' }));
  await userEvent.click(screen.getByRole('button', { name: 'Dietro' }));
  await userEvent.click(screen.getByRole('button', { name: 'Fatto' }));
  await waitFor(async () => expect((await getStop('s1'))?.findPackage).toEqual({ size: 'large', positions: ['back'] }));
});

it('Rimuovi chiede conferma e poi cancella', async () => {
  const onClose = vi.fn();
  renderDetail({ onClose });
  await userEvent.click(await screen.findByRole('button', { name: 'Rimuovi fermata' }));
  expect(await listStops('r1')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Rimuovi' }));
  await waitFor(async () => expect(await listStops('r1')).toHaveLength(0));
  expect(onClose).toHaveBeenCalled();
});

it('Duplica crea una nuova fermata in fondo', async () => {
  renderDetail();
  await userEvent.click(await screen.findByRole('button', { name: 'Duplica fermata' }));
  await waitFor(async () => expect(await listStops('r1')).toHaveLength(2));
  const copy = (await listStops('r1'))[1];
  expect(copy).toMatchObject({ originalIndex: 1, displayId: 2, outcome: 'pending' });
});
