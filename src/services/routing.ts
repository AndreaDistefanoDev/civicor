import type { AppSettings, LatLng } from '../domain/types';

export type Profile = 'driving-car' | 'cycling-regular';

/** Durate in secondi, distanze in metri. */
export interface Matrix {
  durations: number[][];
  distances: number[][];
}

export interface RoutingProvider {
  matrix(locations: LatLng[], req: { sources: number[]; destinations: number[] }, profile: Profile): Promise<Matrix>;
  routeLine(points: LatLng[], profile: Profile, avoidTolls: boolean): Promise<[number, number][]>;
}

export function profileFor(vehicle: AppSettings['vehicle']): Profile {
  return vehicle === 'bike' ? 'cycling-regular' : 'driving-car';
}
