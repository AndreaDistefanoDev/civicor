import type { ReactNode } from 'react';
import './common.css';

export function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Schermata a tutto schermo con titolo e chiusura. */
export function Screen(props: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; headerRight?: ReactNode }) {
  return (
    <div className="screen" role="dialog" aria-label={props.title}>
      <div className="screen-head">
        <button className="icon-btn" aria-label="Chiudi" onClick={props.onClose}>
          <CloseIcon />
        </button>
        <h1>{props.title}</h1>
        {props.headerRight}
      </div>
      <div className="screen-body">{props.children}</div>
      {props.footer && <div className="screen-foot">{props.footer}</div>}
    </div>
  );
}

export function ConfirmDialog(props: {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="scrim" onClick={props.onCancel} />
      <div className="dialog" role="alertdialog" aria-label={props.title}>
        <h2>{props.title}</h2>
        {props.message && <p>{props.message}</p>}
        <button className={props.danger ? 'btn-danger' : 'btn-primary'} onClick={props.onConfirm}>
          {props.confirmLabel}
        </button>
        <button className="btn-secondary" onClick={props.onCancel}>
          Annulla
        </button>
      </div>
    </>
  );
}

export function Menu(props: { items: Array<{ label: string; onSelect: () => void; danger?: boolean }>; onClose: () => void; top?: number }) {
  return (
    <>
      <div className="scrim" style={{ background: 'transparent' }} onClick={props.onClose} />
      <div className="menu" role="menu" style={{ top: props.top ?? 56 }}>
        {props.items.map((it) => (
          <button
            key={it.label}
            role="menuitem"
            className={it.danger ? 'danger' : undefined}
            onClick={() => {
              props.onClose();
              it.onSelect();
            }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}

/** Pannello di scelta dal basso con "Annulla" e "Fatto" (fasce orarie, tempi, pacco). */
export function PickerSheet(props: { title: string; onCancel: () => void; onDone: () => void; children: ReactNode }) {
  return (
    <>
      <div className="scrim" onClick={props.onCancel} />
      <div className="picker" role="dialog" aria-label={props.title}>
        <div className="picker-head">
          <button className="link-btn muted-link" onClick={props.onCancel}>
            Annulla
          </button>
          <strong>{props.title}</strong>
          <button className="link-btn" onClick={props.onDone}>
            Fatto
          </button>
        </div>
        <div className="picker-body">{props.children}</div>
      </div>
    </>
  );
}
