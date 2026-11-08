import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stats } from './Stats';
import { db } from '../../../data/db';
import { createRoute, putStops } from '../../../data/repos';
import { makeStop } from '../../../test/fixtures';

const at = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).getTime();

beforeEach(async () => {
  await db.delete();
  await db.open();
  const r1 = await createRoute({ date: '2026-11-03', name: 'Martedì' });
  const r2 = await createRoute({ date: '2026-11-04', name: 'Mercoledì' });
  await db.routes.update(r1.id, { totals: { km: 60, minutes: 1, endTime: '16:00' } });
  await db.routes.update(r2.id, { totals: { km: 40.5, minutes: 1, endTime: '15:00' } });
  await putStops([
    makeStop({ id: 'a', routeId: r1.id, packages: 3, outcome: 'done', outcomeAt: at(3, 9, 0) }),
    makeStop({ id: 'b', routeId: r1.id, outcome: 'failed', failReason: 'not_home', outcomeAt: at(3, 16, 0),
      address: { street: 'Via Roma, 10', city: 'Ragusa', postcode: '97100' } }),
    makeStop({ id: 'c', routeId: r2.id, packages: 1, outcome: 'done', outcomeAt: at(4, 15, 0) }),
    makeStop({ id: 'd', routeId: r2.id, outcome: 'failed', failReason: 'not_home', outcomeAt: at(4, 15, 30),
      address: { street: 'Via Roma 10', city: 'Ragusa', postcode: '97100' } }),
  ]);
});

it('mostra i numeri del mese, gli indirizzi difficili e tutti i giri fatti', async () => {
  const onOpenRoute = vi.fn();
  render(<Stats month="2026-11" currentMonth="2026-11" onOpenRoute={onOpenRoute} onClose={vi.fn()} />);
  const numbers = await screen.findByRole('group', { name: 'Numeri del mese' });
  expect(within(numbers).getByText('Pacchi consegnati').nextSibling).toHaveTextContent('4');
  expect(within(numbers).getByText('Media pacchi al giorno').nextSibling).toHaveTextContent('2');
  expect(within(numbers).getByText('Km').nextSibling).toHaveTextContent('100,5');
  expect(within(numbers).getByText('Consegne riuscite').nextSibling).toHaveTextContent('50%');
  expect(screen.getByText('Non in casa: 2')).toBeInTheDocument();
  expect(screen.getByText('Via Roma 10')).toBeInTheDocument();

  const routes = screen.getByRole('list', { name: 'Giri effettuati' });
  const rows = within(routes).getAllByRole('button');
  expect(rows[0]).toHaveTextContent('4 novMercoledì');
  await userEvent.click(rows[1]);
  expect(onOpenRoute).toHaveBeenCalledWith(expect.any(String));
});

it('si sposta al mese precedente', async () => {
  render(<Stats month="2026-11" currentMonth="2026-11" onOpenRoute={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Mese successivo' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Mese precedente' }));
  expect(await screen.findByText('Ottobre 2026')).toBeInTheDocument();
  expect(await screen.findByText('Nessun giro in questo mese')).toBeInTheDocument();
});
