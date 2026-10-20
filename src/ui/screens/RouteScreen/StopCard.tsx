import { useRef, useState } from 'react';
import { duplicateStop } from '../../../data/stopOps';
import { formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import type { NavApp, Stop } from '../../../domain/types';
import { PickerSheet } from '../../common/ui';

const ORDINAL = (n: number) => `${n}ª`;
export const NAV_APPS: Array<[NavApp, string]> = [['waze', 'Waze'], ['google', 'Google Maps'], ['apple', 'Apple Maps']];

/** Card della fermata corrente durante il giro. Tenendo premuto "Naviga" si sceglie l'app per questa volta. */
export function StopCard(props: {
  stop: Stop;
  position: number;
  total: number;
  onNavigate: (app?: NavApp) => void;
  onDone: () => void;
  onFailed: () => void;
  onOpen: () => void;
}) {
  const { stop } = props;
  const [chooseApp, setChooseApp] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);

  const startPress = () => {
    longPressed.current = false;
    press.current = setTimeout(() => {
      longPressed.current = true;
      setChooseApp(true);
    }, 550);
  };
  const endPress = () => clearTimeout(press.current);

  return (
    <div className="stop-card">
      <h3 className="stop-card-line">{formatAddressLine(stop.address)}</h3>
      <div className="stop-card-meta">
        <span className="dot" style={{ background: 'var(--accent)' }} />
        <span className="num">
          {props.position}/{props.total}
          {stop.eta ? ` · ${stop.eta}` : ''}
        </span>
      </div>
      <div className="stop-card-actions">
        <button
          className="stop-card-btn primary"
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => !longPressed.current && props.onNavigate()}
        >
          <span aria-hidden="true">▲</span>
          Naviga
        </button>
        <button className="stop-card-btn" onClick={props.onFailed}>
          <span aria-hidden="true" className="danger-icon">✕</span>
          Non riuscita
        </button>
        <button className="stop-card-btn" onClick={props.onDone}>
          <span aria-hidden="true" className="ok-icon">✓</span>
          Effettuata
        </button>
      </div>
      {(stop.senderNotes || stop.notes) && <p className="stop-card-notes">{stop.notes ?? stop.senderNotes}</p>}
      <button className="row" onClick={props.onOpen}>
        <span className="grow">{stop.notes ? 'Modifica note' : 'Aggiungi note'}</span>
      </button>
      <div className="row">
        <span className="grow muted">{formatAddressCity(stop.address)}</span>
        {stop.packages > 1 && <span className="value">{stop.packages} pacchi</span>}
      </div>
      <div className="row">
        <span className="grow">
          ID {stop.displayId} <span className="muted">· In origine {ORDINAL(stop.originalIndex + 1)}</span>
        </span>
      </div>
      <button className="row" onClick={props.onOpen}>
        Modifica fermata
      </button>
      <button className="row" onClick={() => void duplicateStop(stop.id)}>
        Duplica fermata
      </button>

      {chooseApp && (
        <PickerSheet title="Naviga con" onCancel={() => setChooseApp(false)} onDone={() => setChooseApp(false)}>
          {NAV_APPS.map(([app, label]) => (
            <button
              key={app}
              className="row"
              onClick={() => {
                setChooseApp(false);
                props.onNavigate(app);
              }}
            >
              {label}
            </button>
          ))}
        </PickerSheet>
      )}
    </div>
  );
}
