import { insertStops } from './insertion';

const p = (id: string, lat: number, lng: number) => ({ id, location: { lat, lng } });

it('inserisce ogni fermata nuova nel punto che allunga meno il giro, senza spostare le altre', () => {
  // Giro esistente lungo una retta: a(0) → b(2) → c(4). La nuova x(1) va tra a e b, y(3) tra b e c.
  const order = insertStops([p('a', 36.0, 14.0), p('b', 36.02, 14.0), p('c', 36.04, 14.0)], [p('y', 36.03, 14.0), p('x', 36.01, 14.0)]);
  expect(order).toEqual(['a', 'x', 'b', 'y', 'c']);
});

it('le fermate già fatte restano prima: le nuove vanno solo dopo l\'ultima chiusa', () => {
  const order = insertStops([p('a', 36.0, 14.0), p('b', 36.02, 14.0), p('c', 36.04, 14.0)], [p('x', 36.001, 14.0)], 2);
  expect(order).toEqual(['a', 'b', 'x', 'c']);
});

it('fermate nuove senza posizione: in fondo', () => {
  expect(insertStops([p('a', 36, 14)], [{ id: 'z' }, p('x', 36.01, 14)])).toEqual(['a', 'x', 'z']);
});

it('giro vuoto: le nuove nell\'ordine in cui arrivano', () => {
  expect(insertStops([], [p('x', 36, 14), p('y', 36.1, 14)])).toEqual(['x', 'y']);
});
