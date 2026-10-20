import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { deleteRoute, duplicateRoute, listRoutes, renameRoute } from '../../../data/repos';
import type { Route } from '../../../domain/types';
import { monthLabel, shortDate } from '../../dates';
import { ConfirmDialog, Menu } from '../../common/ui';
import './Drawer.css';

interface DrawerProps {
  today: string;
  currentRouteId?: string;
  onOpenRoute: (id: string) => void;
  onCreateRoute: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

function groupRoutes(routes: Route[], today: string): Array<{ label: string; routes: Route[] }> {
  const groups = new Map<string, Route[]>();
  for (const r of routes) {
    const label = r.date === today ? 'Oggi' : r.date.slice(0, 7) === today.slice(0, 7) ? 'Questo mese' : monthLabel(r.date);
    groups.set(label, [...(groups.get(label) ?? []), r]);
  }
  return [...groups].map(([label, rs]) => ({ label, routes: rs }));
}

export function Drawer(props: DrawerProps) {
  const routes = useLiveQuery(listRoutes, []);
  const [menuFor, setMenuFor] = useState<{ route: Route; top: number }>();
  const [confirmDelete, setConfirmDelete] = useState<Route>();
  const [renaming, setRenaming] = useState<{ route: Route; name: string }>();

  return (
    <>
      <div className="scrim" onClick={props.onClose} />
      <nav className="drawer" aria-label="Percorsi">
        <div className="drawer-head">
          <span className="drawer-brand">Civicor</span>
          <button className="link-btn" onClick={props.onOpenSettings}>
            Impostazioni
          </button>
        </div>
        <div className="drawer-list">
          {routes && routes.length === 0 && <p className="drawer-empty muted">Nessun percorso. Creane uno per iniziare.</p>}
          {routes &&
            groupRoutes(routes, props.today).map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <div className="section-title">{g.label}</div>
                {g.routes.map((r) => (
                  <div key={r.id} className={`drawer-route${r.id === props.currentRouteId ? ' current' : ''}`}>
                    <button className="drawer-route-open" onClick={() => props.onOpenRoute(r.id)}>
                      <span className="num drawer-date">{shortDate(r.date)}</span>
                      <span>{r.name}</span>
                    </button>
                    <button
                      className="drawer-route-more"
                      aria-label={`Altre azioni per ${r.name}`}
                      onClick={(e) => setMenuFor({ route: r, top: (e.currentTarget as HTMLElement).getBoundingClientRect().bottom })}
                    >
                      ⋮
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </div>
        <div className="drawer-foot">
          <button className="btn-primary" onClick={props.onCreateRoute}>
            + Crea percorso
          </button>
        </div>
      </nav>

      {menuFor && (
        <Menu
          top={menuFor.top}
          onClose={() => setMenuFor(undefined)}
          items={[
            { label: 'Rinomina', onSelect: () => setRenaming({ route: menuFor.route, name: menuFor.route.name }) },
            { label: 'Duplica', onSelect: () => void duplicateRoute(menuFor.route.id) },
            { label: 'Elimina', danger: true, onSelect: () => setConfirmDelete(menuFor.route) },
          ]}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={`Eliminare il percorso "${confirmDelete.name}"?`}
          message="Le fermate di questo percorso verranno cancellate."
          confirmLabel="Elimina percorso"
          danger
          onCancel={() => setConfirmDelete(undefined)}
          onConfirm={async () => {
            await deleteRoute(confirmDelete.id);
            setConfirmDelete(undefined);
          }}
        />
      )}
      {renaming && (
        <>
          <div className="scrim" onClick={() => setRenaming(undefined)} />
          <form
            className="dialog"
            onSubmit={async (e) => {
              e.preventDefault();
              if (renaming.name.trim()) await renameRoute(renaming.route.id, renaming.name);
              setRenaming(undefined);
            }}
          >
            <h2>Rinomina percorso</h2>
            <input
              className="rename-input"
              autoFocus
              aria-label="Nome percorso"
              value={renaming.name}
              onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
            />
            <button className="btn-primary" type="submit">
              Salva
            </button>
          </form>
        </>
      )}
    </>
  );
}
