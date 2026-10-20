import { useState } from 'react';
import type { TimeWindow } from '../../../domain/types';
import { PickerSheet } from '../../common/ui';

export function TimeWindowSheet(props: { windows: TimeWindow[]; onCancel: () => void; onDone: (w: TimeWindow[]) => void }) {
  const [windows, setWindows] = useState<TimeWindow[]>(props.windows.length ? props.windows : [{ start: '', end: '' }]);
  const set = (i: number, patch: Partial<TimeWindow>) => setWindows(windows.map((w, j) => (j === i ? { ...w, ...patch } : w)));

  return (
    <PickerSheet
      title="Orario di arrivo"
      onCancel={props.onCancel}
      onDone={() => props.onDone(windows.filter((w) => w.start && w.end && w.start < w.end))}
    >
      {windows.map((w, i) => (
        <div key={i} className="window-row">
          <label className="field">
            <span>Dalle</span>
            <input type="time" value={w.start} onChange={(e) => set(i, { start: e.target.value })} />
          </label>
          <label className="field">
            <span>Alle</span>
            <input type="time" value={w.end} onChange={(e) => set(i, { end: e.target.value })} />
          </label>
        </div>
      ))}
      <button className="link-btn add-window" onClick={() => setWindows([...windows, { start: '', end: '' }])}>
        + Altra fascia oraria
      </button>
      {windows.some((w) => w.start || w.end) && (
        <button className="link-btn add-window muted-link" onClick={() => props.onDone([])}>
          Qualsiasi orario
        </button>
      )}
    </PickerSheet>
  );
}
