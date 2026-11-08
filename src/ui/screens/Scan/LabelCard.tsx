import { useState } from 'react';
import type { LabelAddress } from '../../../domain/label/parseLabelText';

const ROLE_LABEL = { recipient: 'Destinatario', sender: 'Mittente', unknown: 'Indirizzo' } as const;

/** Indirizzo letto dal testo dell'etichetta: si controlla (soprattutto il civico), si corregge e si aggiunge. */
export function LabelCard(props: {
  candidates: LabelAddress[];
  initial: number;
  onAdd: (address: LabelAddress) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState(props.initial);
  const [draft, setDraft] = useState<LabelAddress>(props.candidates[props.initial]);
  const ready = draft.street.trim() !== '' && draft.city.trim() !== '';

  return (
    <div className="label-result" role="group" aria-label="Indirizzo letto">
      {props.candidates.length > 1 && (
        <div className="segmented label-choices" role="group" aria-label="Indirizzi letti">
          {props.candidates.map((c, i) => (
            <button
              key={i}
              aria-pressed={i === choice}
              onClick={() => {
                setChoice(i);
                setDraft(c);
              }}
            >
              {c.role === 'unknown' ? `${ROLE_LABEL.unknown} ${i + 1}` : ROLE_LABEL[c.role]}
            </button>
          ))}
        </div>
      )}
      {draft.recipient && <div className="label-name">{draft.recipient}</div>}
      <label className="field">
        <span>Via e civico</span>
        <input value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} autoComplete="off" />
      </label>
      <div className="label-place">
        <label className="field">
          <span>CAP</span>
          <input inputMode="numeric" value={draft.postcode} onChange={(e) => setDraft({ ...draft, postcode: e.target.value })} />
        </label>
        <label className="field">
          <span>Città</span>
          <input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} autoComplete="off" />
        </label>
      </div>
      <p className="label-check muted">Controlla il civico prima di aggiungere.</p>
      <div className="label-actions">
        <button className="btn-secondary" onClick={props.onCancel}>
          Annulla
        </button>
        <button
          className="btn-primary"
          disabled={!ready}
          onClick={() => props.onAdd({ ...draft, street: draft.street.trim(), city: draft.city.trim(), postcode: draft.postcode.trim() })}
        >
          Aggiungi
        </button>
      </div>
    </div>
  );
}
