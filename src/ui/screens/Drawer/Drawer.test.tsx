import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer } from './Drawer';
import { db } from '../../../data/db';
import { createRoute, listRoutes } from '../../../data/repos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const props = { today: '2026-10-20', onOpenRoute: vi.fn(), onCreateRoute: vi.fn(), onOpenSettings: vi.fn(), onClose: vi.fn() };

it('raggruppa i percorsi in Oggi, Questo mese e mesi precedenti', async () => {
  await createRoute({ date: '2026-10-20' });
  await createRoute({ date: '2026-10-16' });
  await createRoute({ date: '2026-09-19' });
  render(<Drawer {...props} />);
  const oggi = await screen.findByRole('group', { name: 'Oggi' });
  expect(within(oggi).getByText('Martedì')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Questo mese' })).getByText('Venerdì')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Settembre 2026' })).getByText('Sabato')).toBeInTheDocument();
});

it('Elimina chiede conferma prima di cancellare', async () => {
  await createRoute({ date: '2026-10-20' });
  render(<Drawer {...props} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Altre azioni per Martedì' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Elimina' }));
  expect(await listRoutes()).toHaveLength(1);
  expect(screen.getByText('Eliminare il percorso "Martedì"?')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Elimina percorso' }));
  await screen.findByText('Nessun percorso. Creane uno per iniziare.');
  expect(await listRoutes()).toHaveLength(0);
});

it('+ Crea percorso chiama onCreateRoute', async () => {
  render(<Drawer {...props} />);
  await userEvent.click(screen.getByRole('button', { name: '+ Crea percorso' }));
  expect(props.onCreateRoute).toHaveBeenCalled();
});
