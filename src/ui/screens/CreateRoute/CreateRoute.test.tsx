import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRoute } from './CreateRoute';
import { db } from '../../../data/db';
import { listRoutes } from '../../../data/repos';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('con "Domani" crea il percorso di domani e lo apre', async () => {
  const onCreated = vi.fn();
  render(<CreateRoute today="2026-10-20" onCreated={onCreated} onClose={() => {}} />);
  expect(screen.getByPlaceholderText('Martedì')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: /Domani/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Conferma' }));
  const [route] = await listRoutes();
  expect(route).toMatchObject({ date: '2026-10-21', name: 'Mercoledì' });
  expect(onCreated).toHaveBeenCalledWith(route.id);
});

it('usa il nome scritto', async () => {
  render(<CreateRoute today="2026-10-20" onCreated={() => {}} onClose={() => {}} />);
  await userEvent.type(screen.getByLabelText('Nome percorso (facoltativo)'), 'Giro mattina');
  await userEvent.click(screen.getByRole('button', { name: 'Conferma' }));
  expect((await listRoutes())[0]).toMatchObject({ name: 'Giro mattina', date: '2026-10-20' });
});
