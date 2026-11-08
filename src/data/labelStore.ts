import { addressKey } from '../domain/address/normalize';
import type { LabelAddress } from '../domain/label/parseLabelText';
import type { Address, Stop } from '../domain/types';
import { db } from './db';
import { getSettings, listStops, newId } from './repos';

/**
 * Etichetta di un altro corriere letta con la fotocamera: la fermata si salva subito e la posizione
 * si cerca dopo (come per le etichette GLS). Stesso indirizzo nello stesso giro = un pacco in più.
 */
export async function addLabelStop(routeId: string, label: LabelAddress): Promise<{ kind: 'added' | 'merged'; stop: Stop }> {
  const { defaultServiceMinutes } = await getSettings();
  const address: Address = { street: label.street, city: label.city, postcode: label.postcode, province: label.province };
  return db.transaction('rw', db.stops, async () => {
    const stops = await listStops(routeId);
    const same = stops.find((s) => s.outcome === 'pending' && addressKey(s.address) === addressKey(address));
    if (same) {
      const merged = { ...same, packages: same.packages + 1, phone: same.phone ?? label.phone, recipient: same.recipient ?? label.recipient };
      await db.stops.put(merged);
      return { kind: 'merged' as const, stop: merged };
    }
    const index = stops.reduce((m, s) => Math.max(m, s.originalIndex + 1), 0);
    const stop: Stop = {
      id: newId(), routeId, address, recipient: label.recipient, phone: label.phone, trackingNumbers: [], packages: 1,
      order: 'auto', kind: 'delivery', timeWindows: [], serviceMinutes: defaultServiceMinutes, stopTypeId: 'standard',
      geoStatus: 'pending', originalIndex: index, displayId: index + 1, outcome: 'pending', createdAt: Date.now(),
    };
    await db.stops.add(stop);
    return { kind: 'added' as const, stop };
  });
}
