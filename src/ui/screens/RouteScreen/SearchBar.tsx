export function ScanIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d="M2 7V3.5A1.5 1.5 0 0 1 3.5 2H7M15 2h3.5A1.5 1.5 0 0 1 20 3.5V7M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M7 20H3.5A1.5 1.5 0 0 1 2 18.5V15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 7h2v8H6zM10 7h1v8h-1zM13 7h3v8h-3z" fill="currentColor" />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="7.5" y="2" width="7" height="12" rx="3.5" fill="currentColor" />
      <path d="M4.5 10.5a6.5 6.5 0 0 0 13 0M11 17v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Barra fissa in cima al pannello: "Tocca per aggiungere", scansione e voce. */
export function SearchBar(props: { onSearch: () => void; onScan: () => void; onVoice: () => void }) {
  return (
    <div className="search-bar">
      <button className="search-bar-field" onClick={props.onSearch}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>Tocca per aggiungere</span>
      </button>
      <button className="icon-btn search-bar-action" aria-label="Scansiona etichette" onClick={props.onScan}>
        <ScanIcon />
      </button>
      <button className="icon-btn search-bar-action" aria-label="Pronuncia indirizzo" onClick={props.onVoice}>
        <MicIcon />
      </button>
    </div>
  );
}
