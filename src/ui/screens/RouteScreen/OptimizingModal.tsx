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
        <div className="optimizing-signs" aria-hidden="true">
          <span className="num">1</span>
          <span className="num">2</span>
          <span className="num">3</span>
        </div>
        <p>{s.text}</p>
        <div className="progress">
          <span style={{ width: `${s.progress * 100}%` }} />
        </div>
      </div>
    </>
  );
}
