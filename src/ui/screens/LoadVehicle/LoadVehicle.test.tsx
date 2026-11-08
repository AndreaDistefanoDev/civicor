import { render, screen, within } from '@testing-library/react';
import { LoadVehicle } from './LoadVehicle';
import { db } from '../../../data/db';
import { createRoute, putStops } from '../../../data/repos';
import { makeStop } from '../../../test/fixtures';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('elenca le fermate da caricare al contrario: l\'ultima consegna va caricata per prima', async () => {
  const r = await createRoute({ date: '2026-11-08' });
  await putStops([
    makeStop({ id: 'a', routeId: r.id, sequence: 0, displayId: 4, address: { street: 'Via Prima, 1', city: 'Ragusa' } }),
    makeStop({ id: 'b', routeId: r.id, sequence: 1, displayId: 9, packages: 2, findPackage: { positions: ['back'] }, address: { street: 'Via Seconda, 2', city: 'Ragusa' } }),
    makeStop({ id: 'c', routeId: r.id, sequence: 2, displayId: 2, outcome: 'done', address: { street: 'Via Fatta, 3', city: 'Ragusa' } }),
  ]);
  render(<LoadVehicle routeId={r.id} onClose={vi.fn()} />);
  const list = await screen.findByRole('list', { name: 'Ordine di carico' });
  const rows = within(list).getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent('Via Seconda, 2');
  expect(rows[0]).toHaveTextContent('ID 9');
  expect(rows[0]).toHaveTextContent('2 pacchi');
  expect(rows[0]).toHaveTextContent('Dietro');
  expect(rows[1]).toHaveTextContent('Via Prima, 1');
  expect(screen.getByText('3 pacchi da caricare')).toBeInTheDocument();
});
