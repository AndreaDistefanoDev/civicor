import {
  ChevronRight, CopyPlus, ListOrdered, Map as MapIcon, MessageCircle,
  MessageSquareText, Navigation, NotebookPen, Package, PackageCheck, PackageX, Pencil, Phone, Truck, X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { duplicateStop, updateStop } from '../../../data/stopOps';
import { formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import { contactLinks } from '../../../domain/contact/phone';
import type { FailReason, NavApp, Stop } from '../../../domain/types';
import { PickerSheet } from '../../common/ui';
import { FindPackageSheet, POSITION_LABELS, SIZE_LABELS } from '../StopDetail/FindPackageSheet';

const ORDINAL = (n: number) => `${n}ª`;
export const NAV_APPS: Array<[NavApp, string]> = [['waze', 'Waze'], ['google', 'Google Maps'], ['apple', 'Apple Maps']];
export const FAIL_REASONS: Array<[FailReason, string]> = [
  ['not_home', 'Non in casa'],
  ['parcel_shop', 'Lasciato al Parcel Shop'],
  ['refused', 'Rifiutato'],
  ['wrong_address', 'Indirizzo errato o incompleto'],
  ['no_access', 'Accesso impossibile'],
  ['other', 'Altro motivo'],
];
export const failReasonLabel = (r: FailReason) => FAIL_REASONS.find(([k]) => k === r)?.[1] ?? 'Altro motivo';
const ARRIVING = 'Buongiorno, sono il corriere con il suo pacco: arrivo tra circa 10 minuti.';

/** "Dietro · Sinistra": dove sta il pacco nel furgone. Vuoto se non impostato. */
export function vanPosition(fp?: Stop['findPackage']): string {
  return fp?.positions.map((p) => POSITION_LABELS[p]).join(' · ') ?? '';
}

type Sheet = 'nav' | 'fail' | 'van' | null;

/** Card della fermata corrente durante il giro. Tenendo premuto "Naviga" si sceglie l'app per questa volta. */
export function StopCard(props: {
  stop: Stop;
  position: number;
  total: number;
  /** Le prossime fermate da fare, per preparare i pacchi. */
  upcoming: Stop[];
  onNavigate: (app?: NavApp) => void;
  onDone: () => void;
  onFailed: (reason: FailReason, attempt: 1 | 2) => void;
  onOpen: () => void;
  /** X in alto: chiude la scheda e mostra l'elenco del percorso. */
  onClose?: () => void;
}) {
  const { stop } = props;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [attempt, setAttempt] = useState<1 | 2>(1);
  const press = useRef<ReturnType<typeof setTimeout>>(undefined);
  const longPressed = useRef(false);

  const startPress = () => {
    longPressed.current = false;
    press.current = setTimeout(() => {
      longPressed.current = true;
      setSheet('nav');
    }, 550);
  };
  const endPress = () => clearTimeout(press.current);
  const notes = stop.notes ?? stop.senderNotes;
  const van = vanPosition(stop.findPackage);
  const size = stop.findPackage?.size;
  const links = stop.phone ? contactLinks(stop.phone, ARRIVING) : undefined;

  return (
    <section className="stop-card" aria-label="Fermata attuale">
      <div className="stop-card-head">
        {props.onClose && (
          <button className="icon-btn stop-card-close" aria-label="Chiudi scheda" onClick={props.onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        )}
        <h3 className="stop-card-line">{formatAddressLine(stop.address)}</h3>
        <div className="stop-card-kicker">
          <span className="stop-card-dot" aria-hidden="true" />
          <span className="num">{`${props.position}/${props.total}${stop.eta ? ` · ${stop.eta}` : ''}`}</span>
        </div>
      </div>

      <div className="stop-card-actions">
        <button
          className="action-tile primary"
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => !longPressed.current && props.onNavigate()}
        >
          <Navigation size={22} aria-hidden="true" />
          Naviga
        </button>
        <button className="action-tile" onClick={() => setSheet('fail')}>
          <PackageX size={22} aria-hidden="true" />
          Non riuscita
        </button>
        <button className="action-tile" onClick={props.onDone}>
          <PackageCheck size={22} aria-hidden="true" />
          Effettuata
        </button>
      </div>

      <div className="stop-card-rows">
        <button className="row" onClick={() => setSheet('van')} aria-label={van || size ? `Nel furgone: ${[van, size && SIZE_LABELS[size]].filter(Boolean).join(', ')}` : undefined}>
          <span className="detail-icon" aria-hidden="true"><Truck size={20} /></span>
          {van || size ? (
            <span className="grow">
              <span className="row-sub">Nel furgone</span>
              <strong className="stop-card-van-pos">{van || SIZE_LABELS[size!]}</strong>
            </span>
          ) : (
            <span className="grow muted">Dove è il pacco nel furgone?</span>
          )}
          {van && size && <span className="value">{SIZE_LABELS[size]}</span>}
          <ChevronRight size={18} className="chev" aria-hidden="true" />
        </button>
        {notes ? (
          <button className="row" onClick={props.onOpen}>
            <span className="detail-icon" aria-hidden="true"><NotebookPen size={20} /></span>
            <span className="grow stop-card-notes">{notes}</span>
            <ChevronRight size={18} className="chev" aria-hidden="true" />
          </button>
        ) : (
          <button className="row" onClick={props.onOpen}>
            <span className="detail-icon" aria-hidden="true"><NotebookPen size={20} /></span>
            <span className="grow muted">Aggiungi note</span>
            <ChevronRight size={18} className="chev" aria-hidden="true" />
          </button>
        )}
        {links && (
          <div className="row stop-card-contact">
            <span className="detail-icon" aria-hidden="true"><Phone size={20} /></span>
            <a className="contact-btn" href={links.call}>
              <Phone size={16} aria-hidden="true" />
              Chiama
            </a>
            <a className="contact-btn" href={links.sms}>
              <MessageSquareText size={16} aria-hidden="true" />
              SMS
            </a>
            <a className="contact-btn" href={links.whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle size={16} aria-hidden="true" />
              WhatsApp
            </a>
          </div>
        )}
        <div className="row">
          <span className="detail-icon" aria-hidden="true"><MapIcon size={20} /></span>
          <span className="grow">{formatAddressCity(stop.address)}</span>
          {stop.packages > 1 && (
            <span className="value">
              <Package size={14} aria-hidden="true" /> {stop.packages} pacchi
            </span>
          )}
        </div>
        <div className="row">
          <span className="detail-icon detail-id" aria-hidden="true">ID</span>
          <span className="grow">
            <strong>{stop.displayId}</strong> <span className="muted">In origine {ORDINAL(stop.originalIndex + 1)}</span>
          </span>
          {stop.kind === 'pickup' && <span className="pill">Ritiro</span>}
          {stop.timeWindows.length > 0 && <span className="value">{stop.timeWindows.map((w) => `${w.start}–${w.end}`).join(', ')}</span>}
        </div>
        {props.upcoming.length > 0 && (
          <div className="row stop-card-next">
            <span className="detail-icon" aria-hidden="true"><ListOrdered size={20} /></span>
            <span className="stop-card-next-label">Poi</span>
            {props.upcoming.map((s) => (
              <span key={s.id} className="stop-card-next-item">
                <span className="tl-chip num">{s.displayId}</span>
                <span className="stop-card-next-text">{vanPosition(s.findPackage) || formatAddressLine(s.address)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="stop-card-rows more">
        <button className="row" onClick={props.onOpen}>
          <span className="detail-icon" aria-hidden="true"><Pencil size={20} /></span>
          <span className="grow">Modifica fermata</span>
          <ChevronRight size={18} className="chev" aria-hidden="true" />
        </button>
        <button className="row" onClick={() => void duplicateStop(stop.id)}>
          <span className="detail-icon" aria-hidden="true"><CopyPlus size={20} /></span>
          <span className="grow">Duplica fermata</span>
          <ChevronRight size={18} className="chev" aria-hidden="true" />
        </button>
      </div>

      {sheet === 'nav' && (
        <PickerSheet title="Naviga con" onCancel={() => setSheet(null)} onDone={() => setSheet(null)}>
          {NAV_APPS.map(([app, label]) => (
            <button
              key={app}
              className="row"
              onClick={() => {
                setSheet(null);
                props.onNavigate(app);
              }}
            >
              {label}
            </button>
          ))}
        </PickerSheet>
      )}
      {sheet === 'fail' && (
        <PickerSheet title="Perché non è riuscita?" onCancel={() => setSheet(null)} onDone={() => setSheet(null)}>
          <div className="fail-attempt">
            <div className="segmented" role="group" aria-label="Tentativo">
              {([1, 2] as const).map((n) => (
                <button key={n} aria-pressed={attempt === n} onClick={() => setAttempt(n)}>
                  {n}° tentativo
                </button>
              ))}
            </div>
          </div>
          {FAIL_REASONS.map(([reason, label]) => (
            <button
              key={reason}
              className="row"
              onClick={() => {
                setSheet(null);
                props.onFailed(reason, attempt);
              }}
            >
              {label}
            </button>
          ))}
        </PickerSheet>
      )}
      {sheet === 'van' && (
        <FindPackageSheet
          value={stop.findPackage}
          onCancel={() => setSheet(null)}
          onDone={(findPackage) => {
            void updateStop(stop.id, { findPackage });
            setSheet(null);
          }}
        />
      )}
    </section>
  );
}
