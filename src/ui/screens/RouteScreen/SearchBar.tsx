import { Mic, ScanLine, Search } from 'lucide-react';

/** Barra fissa in cima al pannello: "Tocca per aggiungere", scansione e voce. */
export function SearchBar(props: { onSearch: () => void; onScan: () => void; onVoice: () => void }) {
  return (
    <div className="search-bar">
      <button className="search-bar-field" onClick={props.onSearch}>
        <Search size={18} aria-hidden="true" />
        <span>Tocca per aggiungere</span>
      </button>
      <button className="icon-btn search-bar-action primary" aria-label="Scansiona etichette" onClick={props.onScan}>
        <ScanLine size={22} aria-hidden="true" />
      </button>
      <button className="icon-btn search-bar-action" aria-label="Pronuncia indirizzo" onClick={props.onVoice}>
        <Mic size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
