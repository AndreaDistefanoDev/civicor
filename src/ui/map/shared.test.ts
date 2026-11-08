import { makeStop } from '../../test/fixtures';
import { drawOrder } from './shared';

it('disegna prima le fermate chiuse, poi le altre, per ultima quella attuale; salta quelle senza posizione', () => {
  const stops = [
    makeStop({ id: 'cur' }),
    makeStop({ id: 'done', outcome: 'done' }),
    makeStop({ id: 'todo' }),
    makeStop({ id: 'nowhere', location: undefined }),
  ];
  expect(drawOrder(stops, 'cur').map((s) => s.id)).toEqual(['done', 'todo', 'cur']);
});
