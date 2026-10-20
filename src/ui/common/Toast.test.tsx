import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast } from './Toast';

it('mostra il messaggio e chiama Annulla', async () => {
  const onPress = vi.fn();
  render(<Toast message="Fermata 1 contrassegnata come effettuata" action={{ label: 'Annulla', onPress }} onDismiss={() => {}} />);
  expect(screen.getByText('Fermata 1 contrassegnata come effettuata')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Annulla' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('sparisce da solo dopo 5 secondi', () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  render(<Toast message="Aggiunta" onDismiss={onDismiss} />);
  act(() => vi.advanceTimersByTime(4999));
  expect(onDismiss).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
