import { makeStop } from '../../test/fixtures';
import { searchRouteStops, streetCompletions } from './routeSearch';

const stops = [
  makeStop({ id: 'b', sequence: 1, address: { street: 'Via Roma, 182', city: 'Ragusa' } }),
  makeStop({ id: 'a', sequence: 0, address: { street: 'Via Roma, 165', city: 'Ragusa' } }),
  makeStop({ id: 'c', sequence: 2, address: { street: 'Via Romania, 13', city: 'Ragusa' } }),
  makeStop({ id: 'd', sequence: 3, address: { street: 'Corso Italia, 4', city: 'Ragusa' } }),
];

it('trova le fermate del giro che corrispondono a quello che scrivi, nell\'ordine del giro', () => {
  expect(searchRouteStops(stops, 'via roma').map((s) => s.id)).toEqual(['a', 'b', 'c']);
  expect(searchRouteStops(stops, 'roma 182').map((s) => s.id)).toEqual(['b']);
  expect(searchRouteStops(stops, 'VIA RÒMA').map((s) => s.id)).toEqual(['a', 'b', 'c']);
  expect(searchRouteStops(stops, 'ro')).toEqual([]);
  expect(searchRouteStops(stops, 'via milano')).toEqual([]);
});

it('completamenti: nomi di via che continuano quello che stai scrivendo', () => {
  expect(streetCompletions(['Via Romania, 13', 'Via Roma', 'Via Romania', 'Viale Roma, 2'], 'via roma')).toEqual(['Via Romania']);
  expect(streetCompletions(['Via Pino Blanco, 27', 'Via Pinoli'], 'via pino')).toEqual(['Via Pino Blanco', 'Via Pinoli']);
  expect(streetCompletions(['Via Roma, 10'], 'via roma 1')).toEqual([]);
});
