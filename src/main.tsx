import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';

async function start() {
  // Solo in sviluppo: ?demo carica un percorso con dati inventati (escluso dalla build di produzione).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    await (await import('./ui/devSeed')).seedDemo();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
