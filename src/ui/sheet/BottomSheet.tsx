import { useRef, useState, type ReactNode } from 'react';
import './BottomSheet.css';

export type Snap = 'peek' | 'half' | 'full';
const HEIGHT: Record<Snap, number> = { peek: 0.3, half: 0.55, full: 0.9 };

export function sheetHeight(snap: Snap, viewport = window.innerHeight): number {
  return Math.round(HEIGHT[snap] * viewport);
}

/** Pannello trascinabile sopra la mappa, con tre altezze. */
export function BottomSheet(props: { snap: Snap; onSnapChange: (s: Snap) => void; header?: ReactNode; children: ReactNode }) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number }>(null);
  const height = drag ?? sheetHeight(props.snap);

  const onDown = (e: React.PointerEvent) => {
    start.current = { y: e.clientY, h: sheetHeight(props.snap) };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDrag(Math.max(120, Math.min(window.innerHeight * 0.95, start.current.h + start.current.y - e.clientY)));
  };
  const onUp = () => {
    if (start.current && drag !== null) {
      const ratio = drag / window.innerHeight;
      const nearest = (Object.keys(HEIGHT) as Snap[]).reduce((a, b) => (Math.abs(HEIGHT[b] - ratio) < Math.abs(HEIGHT[a] - ratio) ? b : a));
      props.onSnapChange(nearest);
    }
    start.current = null;
    setDrag(null);
  };

  return (
    <section className={`sheet${drag !== null ? ' dragging' : ''}`} style={{ height }}>
      <div className="sheet-grab" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span />
        {props.header}
      </div>
      <div className="sheet-body">{props.children}</div>
    </section>
  );
}
