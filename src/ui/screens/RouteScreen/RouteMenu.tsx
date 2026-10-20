import { useState } from 'react';
import type { RouteStatus } from '../../../domain/types';
import { Menu } from '../../common/ui';

export function RouteMenu(props: {
  status: RouteStatus;
  onSkip: () => void;
  onReoptimize: () => void;
  onResetIds: () => void;
  onDeleteAll: () => void;
  onRouteDetails: () => void;
}) {
  const [open, setOpen] = useState<number>();
  const planning = props.status === 'planning';
  const items = [
    { label: 'Dettagli del percorso', onSelect: props.onRouteDetails },
    ...(planning
      ? [{ label: 'Salta ottimizzazione', onSelect: props.onSkip }]
      : [
          { label: 'Riottimizza percorso…', onSelect: props.onReoptimize },
          { label: 'Reimposta ID di fermata…', onSelect: props.onResetIds },
        ]),
    { label: 'Elimina fermate…', onSelect: props.onDeleteAll, danger: true },
  ];
  return (
    <>
      <button
        className="icon-btn route-more"
        aria-label="Altre azioni del percorso"
        onClick={(e) => setOpen((e.currentTarget as HTMLElement).getBoundingClientRect().bottom + 4)}
      >
        ⋮
      </button>
      {open !== undefined && <Menu top={open} items={items} onClose={() => setOpen(undefined)} />}
    </>
  );
}
