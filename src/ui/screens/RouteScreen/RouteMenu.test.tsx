import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouteMenu } from './RouteMenu';

const handlers = { onSkip: vi.fn(), onReoptimize: vi.fn(), onResetIds: vi.fn(), onDeleteAll: vi.fn(), onRouteDetails: vi.fn() };

it('prima dell\'ottimizzazione: "Salta ottimizzazione", non "Riottimizza percorso…"', async () => {
  render(<RouteMenu status="planning" {...handlers} />);
  await userEvent.click(screen.getByRole('button', { name: 'Altre azioni del percorso' }));
  expect(screen.getByRole('menuitem', { name: 'Salta ottimizzazione' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Riottimizza percorso…' })).toBeNull();
  expect(screen.getByRole('menuitem', { name: 'Elimina fermate…' })).toBeInTheDocument();
});

it('dopo l\'ottimizzazione: Riottimizza e Reimposta ID', async () => {
  render(<RouteMenu status="optimized" {...handlers} />);
  await userEvent.click(screen.getByRole('button', { name: 'Altre azioni del percorso' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Riottimizza percorso…' }));
  expect(handlers.onReoptimize).toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Altre azioni del percorso' }));
  expect(screen.getByRole('menuitem', { name: 'Reimposta ID di fermata…' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Salta ottimizzazione' })).toBeNull();
});
