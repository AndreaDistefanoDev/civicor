import {
  Banknote, Check, ChevronRight, Clock, Copy, CreditCard, MessageCircle, MessageSquareText, Navigation, NotebookPen,
  Package, Pencil, Phone, Truck, X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { duplicateStop, updateStop } from '../../../data/stopOps';
import { formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import { formatEuro } from '../../../domain/cod/cod';
import { contactLinks } from '../../../domain/contact/phone';
import type { CodMethod, FailReason, NavApp, Stop } from '../../../domain/types';
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

type Sheet = 'nav' | 'fail' | 'cod' | 'van' | null;

/** Card della fermata corrente durante il giro. Tenendo premuto "Naviga" si sceglie l'app per questa volta. */
export function StopCard(props: {
  stop: Stop;
  position: number;
  total: number;
  /** Le prossime fermate da fare, per preparare i pacchi. */
  upcoming: Stop[];
  onNavigate: (app?: NavApp) => void;
  onDone: (codMethod?: CodMethod) => void;
  onFailed: (reason: FailReason, attempt: 1 | 2) => void;
  onPostpone: () => void;
  onOpen: () => void;
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
  const codLabel = stop.cod && `Contrassegno ${formatEuro(stop.cod.amount)}`;

  return (
    <section className="stop-card" aria-label="Fermata attuale">
      <div className="stop-card-head">
        <span className="plate lg">{stop.displayId}</span>
        <div className="grow">
          <div className="stop-card-kicker">Fermata {props.position} di {props.total}</div>
          <h3 className="stop-card-line">{formatAddressLine(stop.address)}</h3>
          <div className="stop-card-city">{formatAddressCity(stop.address)}</div>
        </div>
      </div>

      {van || size ? (
        <button className="stop-card-van" onClick={() => setSheet('van')} aria-label={`Nel furgone: ${[van, size && SIZE_LABELS[size]].filter(Boolean).join(', ')}`}>
          <Truck size={22} aria-hidden="true" />
          <span className="grow">
            <span className="stop-card-van-label">Nel furgone</span>
            <strong className="stop-card-van-pos">{van || SIZE_LABELS[size!]}</strong>
          </span>
          {van && size && <span className="pill">{SIZE_LABELS[size]}</span>}
        </button>
      ) : (
        <button className="stop-card-van empty" onClick={() => setSheet('van')}>
          <Truck size={20} aria-hidden="true" />
          <span className="grow">Dove è il pacco nel furgone?</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      )}

      <div className="stop-card-chips">
        {stop.eta && <span className="pill accent num">{stop.eta}</span>}
        {codLabel && (
          <span className="pill warn">
            <Banknote size={14} aria-hidden="true" /> {codLabel}
          </span>
        )}
        {stop.packages > 1 && (
          <span className="pill">
            <Package size={14} aria-hidden="true" /> {stop.packages} pacchi
          </span>
        )}
        {stop.kind === 'pickup' && <span className="pill">Ritiro</span>}
        {stop.timeWindows.length > 0 && (
          <span className="pill">{stop.timeWindows.map((w) => `${w.start}–${w.end}`).join(', ')}</span>
        )}
      </div>

      {notes && <p className="stop-card-notes">{notes}</p>}

      {links && (
        <div className="stop-card-contact">
          <a className="contact-btn" href={links.call}>
            <Phone size={18} aria-hidden="true" />
            Chiama
          </a>
          <a className="contact-btn" href={links.sms}>
            <MessageSquareText size={18} aria-hidden="true" />
            SMS
          </a>
          <a className="contact-btn" href={links.whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" />
            WhatsApp
          </a>
        </div>
      )}

      <button
        className="btn-primary stop-card-nav"
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => !longPressed.current && props.onNavigate()}
      >
        <Navigation size={20} aria-hidden="true" />
        Naviga
      </button>
      <div className="stop-card-outcomes">
        <button className="outcome failed" onClick={() => setSheet('fail')}>
          <X size={20} aria-hidden="true" />
          Non riuscita
        </button>
        <button className="outcome done" onClick={() => (stop.cod ? setSheet('cod') : props.onDone())}>
          <Check size={20} aria-hidden="true" />
          Effettuata
        </button>
      </div>

      {props.upcoming.length > 0 && (
        <div className="stop-card-next">
          <span className="stop-card-next-label">Poi</span>
          {props.upcoming.map((s) => (
            <span key={s.id} className="stop-card-next-item">
              <span className="plate">{s.displayId}</span>
              <span className="stop-card-next-text">{vanPosition(s.findPackage) || formatAddressLine(s.address)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="card stop-card-more">
        <button className="row" onClick={props.onOpen}>
          <span className="row-icon" aria-hidden="true"><NotebookPen size={18} /></span>
          <span className="grow">{stop.notes ? 'Modifica note' : 'Aggiungi note'}</span>
          <ChevronRight size={18} className="chev" aria-hidden="true" />
        </button>
        {props.upcoming.length > 0 && (
          <button className="row" onClick={props.onPostpone}>
            <span className="row-icon" aria-hidden="true"><Clock size={18} /></span>
            <span className="grow">
              Riprova più tardi
              <span className="row-sub">Va in fondo, l'ordine delle altre non cambia</span>
            </span>
          </button>
        )}
        <button className="row" onClick={props.onOpen}>
          <span className="row-icon" aria-hidden="true"><Pencil size={18} /></span>
          <span className="grow">
            Modifica fermata
            <span className="row-sub">
              {stop.phone ? '' : 'Telefono, contrassegno · '}ID {stop.displayId} · In origine {ORDINAL(stop.originalIndex + 1)}
            </span>
          </span>
          <ChevronRight size={18} className="chev" aria-hidden="true" />
        </button>
        <button className="row" onClick={() => void duplicateStop(stop.id)}>
          <span className="row-icon" aria-hidden="true"><Copy size={18} /></span>
          <span className="grow">Duplica fermata</span>
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
      {sheet === 'cod' && codLabel && (
        <PickerSheet title={codLabel} onCancel={() => setSheet(null)} onDone={() => setSheet(null)}>
          <p className="picker-hint">Come ha pagato?</p>
          <div className="cod-methods">
            {([['cash', 'Contanti', Banknote], ['pos', 'POS', CreditCard]] as const).map(([method, label, Icon]) => (
              <button
                key={method}
                className="btn-secondary"
                onClick={() => {
                  setSheet(null);
                  props.onDone(method);
                }}
              >
                <Icon size={20} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
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
