import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getRoute, saveSettings, updateRoute } from '../../../data/repos';
import type { EndSetting, RouteSettings, StartSetting } from '../../../domain/types';
import type { Geocoder } from '../../../services/geocoder';
import { AddressAutocomplete } from '../../common/AddressAutocomplete';
import { PickerSheet, Screen } from '../../common/ui';
import './RouteDetails.css';

type Sheet = 'startAddress' | 'startTime' | 'end' | 'endAddress' | 'endTime' | 'break' | null;

const DEFAULT_BREAK = { earliest: '08:00', latest: '18:00', minutes: 30 };

function startLabel(s: StartSetting) {
  return s.mode === 'current' ? 'Usa posizione attuale' : s.address.street;
}
function endLabel(e: EndSetting) {
  if (e.mode === 'return') return { title: "Ritorna all'inizio", sub: 'Andata e ritorno dalla posizione iniziale' };
  if (e.mode === 'none') return { title: 'Non usare posizione finale', sub: 'Il percorso finisce all\'ultima fermata' };
  return { title: e.address.street, sub: 'Termina ad altro indirizzo' };
}

export function RouteDetails(props: { routeId: string; geocoder: Geocoder; onClose: () => void }) {
  const route = useLiveQuery(() => getRoute(props.routeId), [props.routeId]);
  const [draft, setDraft] = useState<RouteSettings>();
  const [asDefault, setAsDefault] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [time, setTime] = useState('');
  const [brk, setBrk] = useState(DEFAULT_BREAK);

  useEffect(() => {
    if (route && !draft) setDraft(structuredClone(route.settings));
  }, [route, draft]);
  if (!draft) return null;

  const end = endLabel(draft.end);
  const done = async () => {
    await updateRoute(props.routeId, { settings: draft });
    if (asDefault) await saveSettings({ defaultRouteSettings: draft });
    props.onClose();
  };

  return (
    <Screen
      title="Dettagli del percorso"
      onClose={props.onClose}
      footer={
        <>
          <button className="btn-primary" onClick={done}>
            Fatto
          </button>
          <label className="default-switch">
            <span>Salva come predefinito</span>
            <input type="checkbox" role="switch" aria-label="Salva come predefinito" checked={asDefault} onChange={(e) => setAsDefault(e.target.checked)} />
          </label>
        </>
      }
    >
      <div className="section-title">Inizio</div>
      <div className="detail-card">
        <button className="row" onClick={() => setSheet('startAddress')}>
          <span className="grow">{startLabel(draft.start)}</span>
          <span className="value" aria-hidden="true">›</span>
        </button>
        <button className="row" onClick={() => { setTime(draft.startTime === 'now' ? '' : draft.startTime); setSheet('startTime'); }}>
          <span className="grow">{draft.startTime === 'now' ? 'Inizia ora' : `Inizia alle ${draft.startTime}`}</span>
          <span className="value" aria-hidden="true">›</span>
        </button>
      </div>

      <div className="section-title">Fine</div>
      <div className="detail-card">
        <button className="row" onClick={() => setSheet('end')}>
          <span className="grow">
            <span className="detail-title">{end.title}</span>
            <span className="detail-sub muted">{end.sub}</span>
          </span>
          <span className="value" aria-hidden="true">›</span>
        </button>
        <button className="row" onClick={() => { setTime(draft.endTime ?? ''); setSheet('endTime'); }}>
          <span className="grow">{draft.endTime ? `Fine entro le ${draft.endTime}` : 'Imposta orario finale'}</span>
          <span className="value" aria-hidden="true">›</span>
        </button>
      </div>

      <div className="section-title">Sosta</div>
      <div className="detail-card">
        <button className="row" onClick={() => { setBrk(draft.break ?? DEFAULT_BREAK); setSheet('break'); }}>
          <span className="grow">
            {draft.break ? `Sosta di ${draft.break.minutes} minuti tra le ${draft.break.earliest} e le ${draft.break.latest}` : 'Aggiungi una sosta'}
          </span>
          <span className="value" aria-hidden="true">›</span>
        </button>
      </div>

      {sheet === 'startAddress' && (
        <PickerSheet title="Inizio" onCancel={() => setSheet(null)} onDone={() => setSheet(null)}>
          <button className="row" onClick={() => { setDraft({ ...draft, start: { mode: 'current' } }); setSheet(null); }}>
            Usa posizione attuale
          </button>
          <div className="section-title">Inserisci indirizzo iniziale</div>
          <AddressAutocomplete
            geocoder={props.geocoder}
            onPick={(s) => { setDraft({ ...draft, start: { mode: 'address', address: s.address, location: s.location } }); setSheet(null); }}
          />
        </PickerSheet>
      )}
      {sheet === 'end' && (
        <PickerSheet title="Fine" onCancel={() => setSheet(null)} onDone={() => setSheet(null)}>
          <button className="row" onClick={() => { setDraft({ ...draft, end: { mode: 'return' } }); setSheet(null); }}>
            <span className="grow">
              <span className="detail-title">Ritorna all'inizio</span>
              <span className="detail-sub muted">Andata e ritorno (consigliato)</span>
            </span>
          </button>
          <button className="row" onClick={() => setSheet('endAddress')}>
            <span className="grow">
              <span className="detail-title">Termina ad altro indirizzo</span>
              <span className="detail-sub muted">Inserisci un indirizzo</span>
            </span>
          </button>
          <button className="row" onClick={() => { setDraft({ ...draft, end: { mode: 'none' } }); setSheet(null); }}>
            <span className="grow">
              <span className="detail-title">Non usare posizione finale</span>
              <span className="detail-sub muted">Il percorso finisce all'ultima fermata</span>
            </span>
          </button>
        </PickerSheet>
      )}
      {sheet === 'endAddress' && (
        <PickerSheet title="Termina ad altro indirizzo" onCancel={() => setSheet(null)} onDone={() => setSheet(null)}>
          <AddressAutocomplete
            geocoder={props.geocoder}
            autoFocus
            onPick={(s) => { setDraft({ ...draft, end: { mode: 'address', address: s.address, location: s.location } }); setSheet(null); }}
          />
        </PickerSheet>
      )}
      {(sheet === 'startTime' || sheet === 'endTime') && (
        <PickerSheet
          title={sheet === 'startTime' ? 'Orario di partenza' : 'Orario finale'}
          onCancel={() => setSheet(null)}
          onDone={() => {
            setDraft(sheet === 'startTime' ? { ...draft, startTime: time || 'now' } : { ...draft, endTime: time || undefined });
            setSheet(null);
          }}
        >
          <label className="field">
            <span>Orario</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <button className="link-btn time-reset" onClick={() => setTime('')}>
            {sheet === 'startTime' ? 'Inizia ora' : 'Nessun orario finale'}
          </button>
        </PickerSheet>
      )}
      {sheet === 'break' && (
        <>
          <div className="scrim" onClick={() => setSheet(null)} />
          <div className="picker" role="dialog" aria-label="Aggiungi una sosta">
            <div className="picker-head">
              <button className="link-btn muted-link" onClick={() => setSheet(null)}>Annulla</button>
              <strong>Aggiungi una sosta</strong>
              <span style={{ width: 60 }} />
            </div>
            <p className="break-intro muted">Stime più accurate dei tempi pianificando la pausa all'interno del percorso.</p>
            <div className="section-title">Quando vuoi fare una sosta?</div>
            <div className="window-row">
              <label className="field">
                <span>Primo orario</span>
                <input type="time" value={brk.earliest} onChange={(e) => setBrk({ ...brk, earliest: e.target.value })} />
              </label>
              <label className="field">
                <span>Ultimo orario</span>
                <input type="time" value={brk.latest} onChange={(e) => setBrk({ ...brk, latest: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>Durata sosta (minuti)</span>
              <input inputMode="numeric" value={String(brk.minutes)} onChange={(e) => setBrk({ ...brk, minutes: Number(e.target.value) || 0 })} />
            </label>
            <div className="break-actions">
              <button className="btn-primary" onClick={() => { setDraft({ ...draft, break: brk }); setSheet(null); }}>
                Aggiungi la sosta
              </button>
              {draft.break && (
                <button className="btn-danger" onClick={() => { setDraft({ ...draft, break: undefined }); setSheet(null); }}>
                  Togli la sosta
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </Screen>
  );
}
