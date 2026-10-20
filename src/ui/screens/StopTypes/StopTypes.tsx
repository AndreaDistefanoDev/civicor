import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { deleteStopType, listStopTypes, newId, reorderStopTypes, saveStopType } from '../../../data/repos';
import type { StopType } from '../../../domain/types';
import { Screen } from '../../common/ui';
import './StopTypes.css';

export const TYPE_COLORS: Array<[string, string]> = [
  ['Blu', '#3d7bf2'], ['Verde', '#3fcf7a'], ['Viola', '#b57bff'], ['Rosa', '#ff6fae'],
  ['Arancio', '#ff9d3d'], ['Ciano', '#2fc6d8'], ['Rosso', '#ff4d5e'], ['Grigio', '#8e99a8'],
];

export function StopTypes(props: { onClose: () => void }) {
  const types = useLiveQuery(listStopTypes, []);
  const [notice, setNotice] = useState<string>();
  const [editing, setEditing] = useState<StopType | null>(null);

  const move = (index: number, dir: -1 | 1) => {
    if (!types) return;
    const ids = types.map((t) => t.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    void reorderStopTypes(ids);
  };

  return (
    <Screen
      title="Tipi di fermata"
      onClose={props.onClose}
      headerRight={
        <button className="link-btn" onClick={() => setEditing({ id: newId(), name: '', color: TYPE_COLORS[1][1], position: types?.length ?? 1, builtIn: false })}>
          Nuovo tipo
        </button>
      }
    >
      {notice && <p className="types-notice">{notice}</p>}
      <ul className="types-list">
        {types?.map((t, i) => (
          <li key={t.id} className="types-row">
            <button
              className="types-open"
              onClick={() => (t.id === 'standard' ? setNotice('Non puoi modificare questo tipo') : setEditing(t))}
            >
              <span className="dot" style={{ background: t.color }} />
              {t.name}
            </button>
            {t.id !== 'standard' && (
              <span className="types-move">
                <button aria-label={`Sposta ${t.name} più in alto`} disabled={i <= 1} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button aria-label={`Sposta ${t.name} più in basso`} disabled={i >= types.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {editing && (
        <>
          <div className="scrim" onClick={() => setEditing(null)} />
          <form
            className="dialog"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing.name.trim()) return;
              await saveStopType({ ...editing, name: editing.name.trim() });
              setEditing(null);
            }}
          >
            <h2>{types?.some((t) => t.id === editing.id) ? 'Modifica tipo' : 'Nuovo tipo'}</h2>
            <label className="field" style={{ padding: 0 }}>
              <span>Nome</span>
              <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <div className="color-grid" role="radiogroup" aria-label="Colore">
              {TYPE_COLORS.map(([name, color]) => (
                <button
                  type="button"
                  key={color}
                  role="radio"
                  aria-checked={editing.color === color}
                  aria-label={name}
                  className="color-swatch"
                  style={{ background: color }}
                  onClick={() => setEditing({ ...editing, color })}
                />
              ))}
            </div>
            <button className="btn-primary" type="submit">
              Salva
            </button>
            {types?.some((t) => t.id === editing.id) && (
              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  await deleteStopType(editing.id);
                  setEditing(null);
                }}
              >
                Elimina tipo
              </button>
            )}
          </form>
        </>
      )}
    </Screen>
  );
}
