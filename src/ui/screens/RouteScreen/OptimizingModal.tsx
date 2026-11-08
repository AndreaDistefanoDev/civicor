import type { OptimizeStep } from '../../../data/optimizeRoute';

const STEPS: Record<OptimizeStep, { text: string; progress: number }> = {
  analisi: { text: 'Analisi delle fermate…', progress: 0.2 },
  percorso: { text: 'Elaborazione del percorso migliore…', progress: 0.5 },
  traffico: { text: 'Valutazione dei tempi di guida…', progress: 0.75 },
  creazione: { text: 'Creazione percorso…', progress: 0.95 },
};

export function OptimizingModal(props: { step: OptimizeStep; title?: string }) {
  const s = STEPS[props.step];
  return (
    <>
      <div className="scrim" />
      <div className="dialog optimizing" role="alertdialog" aria-label={props.title ?? 'Ottimizzazione percorso'}>
        <h2>{props.title ?? 'Ottimizzazione percorso'}</h2>
        {/* Disegno di Civicor: tre fermate unite dal percorso. */}
        <svg className="optimizing-art" viewBox="0 0 160 90" aria-hidden="true">
          <path d="M22 70 C 50 70, 50 22, 80 30 S 120 72, 140 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 9" />
          {[[22, 70, '1'], [80, 30, '2'], [140, 24, '3']].map(([x, y, n]) => (
            <g key={n as string} transform={`translate(${x as number - 13} ${y as number - 30})`}>
              <rect x="0" y="0" width="26" height="24" rx="5" className="optimizing-pin" />
              <path d="M9 23 L13 29 L17 23 Z" className="optimizing-pin" />
              <text x="13" y="17" textAnchor="middle" className="optimizing-num">{n}</text>
            </g>
          ))}
        </svg>
        <p>{s.text}</p>
        <div className="progress">
          <span style={{ width: `${s.progress * 100}%` }} />
        </div>
      </div>
    </>
  );
}
