import { makeStop } from '../../test/fixtures';
import { routeShareText } from './routeText';

it('testo da condividere: nome, fine giro e fermate da fare nell\'ordine, con orario', () => {
  const text = routeShareText('Lunedì', '18:29', [
    makeStop({ id: 'b', sequence: 1, eta: '08:20', address: { street: 'Via Seconda, 2', city: 'Ragusa' } }),
    makeStop({ id: 'a', sequence: 0, eta: '08:10', address: { street: 'Via Prima, 1', city: 'Ragusa' } }),
    makeStop({ id: 'c', sequence: 2, outcome: 'done', address: { street: 'Via Fatta, 3', city: 'Ragusa' } }),
  ]);
  expect(text).toBe('Lunedì · fine giro 18:29\n1. 08:10 Via Prima, 1, Ragusa\n2. 08:20 Via Seconda, 2, Ragusa');
});
