import { useState } from 'react';
import type { PackageSize, Stop, VehiclePosition } from '../../../domain/types';
import { PickerSheet } from '../../common/ui';

export const SIZE_LABELS: Record<PackageSize, string> = {
  small: 'Piccolo', medium: 'Medio', large: 'Grande', box: 'Scatola', bag: 'Borsa', letter: 'Lettera',
};
export const POSITION_LABELS: Record<VehiclePosition, string> = {
  front: 'Avanti', middle: 'Centro', back: 'Dietro', left: 'Sinistra', right: 'Destra', floor: 'Pavimento', shelf: 'Ripiano',
};

export function describeFindPackage(fp?: Stop['findPackage']): string {
  if (!fp || (!fp.size && fp.positions.length === 0)) return 'Non impostato';
  return [fp.size && SIZE_LABELS[fp.size], ...fp.positions.map((p) => POSITION_LABELS[p])].filter(Boolean).join(', ');
}

export function FindPackageSheet(props: { value?: Stop['findPackage']; onCancel: () => void; onDone: (v: Stop['findPackage']) => void }) {
  const [size, setSize] = useState<PackageSize | undefined>(props.value?.size);
  const [positions, setPositions] = useState<VehiclePosition[]>(props.value?.positions ?? []);
  const toggle = (p: VehiclePosition) => setPositions(positions.includes(p) ? positions.filter((x) => x !== p) : [...positions, p]);

  return (
    <PickerSheet title="Trova il pacco" onCancel={props.onCancel} onDone={() => props.onDone({ size, positions })}>
      <div className="section-title">Descrizione pacco</div>
      <div className="chip-grid">
        {(Object.keys(SIZE_LABELS) as PackageSize[]).map((s) => (
          <button key={s} className="chip" aria-pressed={size === s} onClick={() => setSize(size === s ? undefined : s)}>
            {SIZE_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="section-title">Posizione nel veicolo</div>
      <div className="chip-grid">
        {(Object.keys(POSITION_LABELS) as VehiclePosition[]).map((p) => (
          <button key={p} className="chip" aria-pressed={positions.includes(p)} onClick={() => toggle(p)}>
            {POSITION_LABELS[p]}
          </button>
        ))}
      </div>
    </PickerSheet>
  );
}
