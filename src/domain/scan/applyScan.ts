import { addressKey } from '../address/normalize';
import type { GlsLabel, Stop } from '../types';

export interface ScanContext {
  routeId: string;
  now: number;
  newId: () => string;
  serviceMinutes: number;
  stopTypeId: string;
}

export type ScanOutcome =
  | { kind: 'added'; stop: Stop }
  | { kind: 'duplicate'; stopId: string }
  | { kind: 'merged'; stop: Stop };

/**
 * Decide cosa fare con un'etichetta letta: nuova fermata, doppione (stesso
 * numero di spedizione) o pacco in più su una fermata con lo stesso indirizzo.
 */
export function applyScan(stops: Stop[], label: GlsLabel, ctx: ScanContext): ScanOutcome {
  const duplicate = stops.find((s) => s.trackingNumbers.includes(label.trackingNumber));
  if (duplicate) return { kind: 'duplicate', stopId: duplicate.id };

  const address = { street: label.street, city: label.city, postcode: label.postcode, province: label.province };
  const key = addressKey(address);
  const sameAddress = stops.find((s) => addressKey(s.address) === key);
  if (sameAddress) {
    return {
      kind: 'merged',
      stop: {
        ...sameAddress,
        packages: sameAddress.packages + 1,
        trackingNumbers: [...sameAddress.trackingNumbers, label.trackingNumber],
      },
    };
  }

  const originalIndex = stops.reduce((max, s) => Math.max(max, s.originalIndex + 1), 0);
  return {
    kind: 'added',
    stop: {
      id: ctx.newId(),
      routeId: ctx.routeId,
      address,
      recipient: label.recipient || undefined,
      senderNotes: label.notes,
      trackingNumbers: [label.trackingNumber],
      packages: 1,
      order: 'auto',
      kind: 'delivery',
      timeWindows: [],
      serviceMinutes: ctx.serviceMinutes,
      stopTypeId: ctx.stopTypeId,
      geoStatus: 'pending',
      originalIndex,
      displayId: originalIndex + 1,
      outcome: 'pending',
      createdAt: ctx.now,
    },
  };
}
