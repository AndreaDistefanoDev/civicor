import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { db } from '../data/db';
import { createRoute } from '../data/repos';
import { todayIso } from './dates';

// MapLibre richiede WebGL, assente in jsdom.
vi.mock('./map/MapView', () => ({ MapView: () => <div data-testid="map" /> }));

beforeEach(async () => {
  await db.delete();
  await db.open();
});

it('senza percorsi di oggi invita a crearne uno', async () => {
  render(<App />);
  expect(await screen.findByText('Nessun percorso per oggi')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '+ Crea percorso' }));
  expect(screen.getByRole('dialog', { name: 'Crea percorso' })).toBeInTheDocument();
});

it('apre il percorso di oggi con lo stato vuoto', async () => {
  await createRoute({ date: todayIso(), name: 'Giro di prova' });
  render(<App />);
  expect(await screen.findByText('Giro di prova')).toBeInTheDocument();
  expect(screen.getByText('Aggiungi le prime fermate e inizia a creare un percorso')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '+ Aggiungi fermata' })).toBeInTheDocument();
});

it('il menu apre il drawer con i percorsi', async () => {
  await createRoute({ date: todayIso(), name: 'Giro di prova' });
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Menu' }));
  expect(screen.getByRole('navigation', { name: 'Percorsi' })).toBeInTheDocument();
});
