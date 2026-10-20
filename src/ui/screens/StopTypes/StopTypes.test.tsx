import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StopTypes } from './StopTypes';
import { db } from '../../../data/db';
import { listStopTypes } from '../../../data/repos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('toccando "Standard" spiega che non si modifica', async () => {
  render(<StopTypes onClose={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: /Standard/ }));
  expect(screen.getByText('Non puoi modificare questo tipo')).toBeInTheDocument();
});

it('"Nuovo tipo" crea un tipo con nome e colore', async () => {
  render(<StopTypes onClose={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Nuovo tipo' }));
  await userEvent.type(screen.getByLabelText('Nome'), 'Ritiro al pomeriggio');
  await userEvent.click(screen.getByRole('radio', { name: 'Viola' }));
  await userEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await waitFor(async () => expect(await listStopTypes()).toHaveLength(2));
  expect((await listStopTypes())[1]).toMatchObject({ name: 'Ritiro al pomeriggio', color: '#b57bff', builtIn: false, position: 1 });
});

it('sposta un tipo verso l\'alto', async () => {
  await db.stopTypes.bulkPut([
    { id: 'standard', name: 'Standard', color: '#3d7bf2', position: 0, builtIn: true },
    { id: 'a', name: 'A', color: '#3fcf7a', position: 1, builtIn: false },
    { id: 'b', name: 'B', color: '#ff7a59', position: 2, builtIn: false },
  ]);
  render(<StopTypes onClose={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Sposta B più in alto' }));
  await waitFor(async () => expect((await listStopTypes()).map((t) => t.id)).toEqual(['standard', 'b', 'a']));
});
