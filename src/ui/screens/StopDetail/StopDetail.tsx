import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { duplicateStop, removeStop, updateStop } from '../../../data/stopOps';
import { getStop, listStopTypes } from '../../../data/repos';
import { formatAddressCity, formatAddressLine } from '../../../domain/address/normalize';
import type { Stop, StopKind, StopOrder } from '../../../domain/types';
import { ConfirmDialog, PickerSheet, Screen } from '../../common/ui';
import { FindPackageSheet, describeFindPackage } from './FindPackageSheet';
import { TimeWindowSheet } from './TimeWindowSheet';
import './StopDetail.css';

type Sheet = 'window' | 'service' | 'findPackage' | 'remove' | null;

function Segmented<T extends string>(props: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={props.label}>
      {props.options.map(([v, text]) => (
        <button key={v} aria-pressed={props.value === v} onClick={() => props.onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function Row(props: { icon?: ReactNode; label: string; value?: ReactNode; onClick?: () => void; children?: ReactNode }) {
  const content = (
    <>
      <span className="grow">{props.label}</span>
      {props.value !== undefined && <span className="value">{props.value}</span>}
      {props.children}
    </>
  );
  return props.onClick ? (
    <button className="row" onClick={props.onClick} aria-label={`${props.label}${typeof props.value === 'string' ? `: ${props.value}` : ''}`}>
      {content}
    </button>
  ) : (
    <div className="row">{content}</div>
  );
}

export function formatService(minutes: number): string {
  const total = Math.round(minutes * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export function StopDetail(props: { stopId: string; onClose: () => void; onManageTypes: () => void; onChangeAddress: (stopId: string) => void }) {
  const stop = useLiveQuery(() => getStop(props.stopId), [props.stopId]);
  const types = useLiveQuery(listStopTypes, []);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [service, setService] = useState({ min: '1', sec: '0' });

  if (!stop) return null;
  const save = (patch: Partial<Stop>) => void updateStop(stop.id, patch);

  return (
    <Screen title={stop.outcome === 'pending' && stop.geoStatus !== 'ok' ? 'Fermata da verificare' : 'Fermata'} onClose={props.onClose}>
      <div className="stop-head">
        <div className="stop-head-id muted">ID {stop.displayId}</div>
        <h2 className="stop-head-line">{formatAddressLine(stop.address)}</h2>
        <div className="muted">{formatAddressCity(stop.address)}</div>
        {stop.geoReason && <div className="stop-head-warn">▲ {stop.geoReason}</div>}
      </div>

      <div className="type-chips" role="group" aria-label="Tipo di fermata">
        {types?.map((t) => (
          <button key={t.id} className="type-chip" aria-pressed={stop.stopTypeId === t.id} onClick={() => save({ stopTypeId: t.id })}>
            <span className="dot" style={{ background: t.color }} />
            {t.name}
          </button>
        ))}
        <button className="type-chip" onClick={props.onManageTypes}>
          Gestisci
        </button>
      </div>

      <label className="field notes">
        <span>Note</span>
        <textarea
          rows={2}
          placeholder="Aggiungi note"
          defaultValue={stop.notes ?? ''}
          onBlur={(e) => save({ notes: e.target.value.trim() || undefined })}
        />
      </label>
      {stop.senderNotes && (
        <div className="sender-notes">
          <span className="muted">Note dell'etichetta</span>
          <div>{stop.senderNotes}</div>
        </div>
      )}
      {stop.recipient && <Row label="Destinatario" value={stop.recipient} />}
      {stop.trackingNumbers.length > 0 && (
        <Row label={stop.trackingNumbers.length > 1 ? 'Spedizioni' : 'Spedizione'}>
          <span className="value num tracking">
            {stop.trackingNumbers.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </span>
        </Row>
      )}

      <Row label="Trova il pacco" value={describeFindPackage(stop.findPackage)} onClick={() => setSheet('findPackage')} />
      <Row label="Pacchi">
        <div className="stepper">
          <button aria-label="Un pacco in meno" disabled={stop.packages <= 1} onClick={() => save({ packages: stop.packages - 1 })}>
            −
          </button>
          <span className="num">{stop.packages}</span>
          <button aria-label="Un pacco in più" onClick={() => save({ packages: stop.packages + 1 })}>
            +
          </button>
        </div>
      </Row>
      <Row label="Ordine">
        <Segmented<StopOrder>
          label="Ordine"
          value={stop.order}
          options={[['first', 'Prima'], ['auto', 'Automatico'], ['last', 'Ultima']]}
          onChange={(order) => save({ order })}
        />
      </Row>
      <Row label="Tipo">
        <Segmented<StopKind>
          label="Tipo"
          value={stop.kind}
          options={[['delivery', 'Consegna'], ['pickup', 'Ritiro']]}
          onChange={(kind) => save({ kind })}
        />
      </Row>
      <Row
        label="Orario di arrivo"
        value={stop.timeWindows.length ? stop.timeWindows.map((w) => `${w.start}–${w.end}`).join(', ') : 'Qualsiasi orario'}
        onClick={() => setSheet('window')}
      />
      <Row
        label="Tempo stimato alla fermata"
        value={formatService(stop.serviceMinutes)}
        onClick={() => {
          const total = Math.round(stop.serviceMinutes * 60);
          setService({ min: String(Math.floor(total / 60)), sec: String(total % 60) });
          setSheet('service');
        }}
      />

      <div className="stop-actions">
        <button className="row" onClick={() => props.onChangeAddress(stop.id)}>
          Cambia indirizzo
        </button>
        <button className="row" onClick={() => void duplicateStop(stop.id)}>
          Duplica fermata
        </button>
        <button className="row danger-row" onClick={() => setSheet('remove')}>
          Rimuovi fermata
        </button>
      </div>

      {sheet === 'window' && (
        <TimeWindowSheet
          windows={stop.timeWindows}
          onCancel={() => setSheet(null)}
          onDone={(timeWindows) => {
            save({ timeWindows });
            setSheet(null);
          }}
        />
      )}
      {sheet === 'findPackage' && (
        <FindPackageSheet
          value={stop.findPackage}
          onCancel={() => setSheet(null)}
          onDone={(findPackage) => {
            save({ findPackage });
            setSheet(null);
          }}
        />
      )}
      {sheet === 'service' && (
        <PickerSheet
          title="Tempo stimato alla fermata"
          onCancel={() => setSheet(null)}
          onDone={() => {
            const minutes = Math.max(0, Number(service.min) || 0) + Math.max(0, Number(service.sec) || 0) / 60;
            save({ serviceMinutes: minutes });
            setSheet(null);
          }}
        >
          <div className="window-row">
            <label className="field">
              <span>Minuti</span>
              <input inputMode="numeric" value={service.min} onChange={(e) => setService({ ...service, min: e.target.value })} />
            </label>
            <label className="field">
              <span>Secondi</span>
              <input inputMode="numeric" value={service.sec} onChange={(e) => setService({ ...service, sec: e.target.value })} />
            </label>
          </div>
        </PickerSheet>
      )}
      {sheet === 'remove' && (
        <ConfirmDialog
          title="Rimuovere questa fermata?"
          message={formatAddressLine(stop.address)}
          confirmLabel="Rimuovi"
          danger
          onCancel={() => setSheet(null)}
          onConfirm={async () => {
            await removeStop(stop.id);
            props.onClose();
          }}
        />
      )}
    </Screen>
  );
}
