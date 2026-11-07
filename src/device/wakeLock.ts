import { useEffect } from 'react';

interface Sentinel {
  released: boolean;
  release(): Promise<void>;
}
type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> };

/**
 * Tiene lo schermo acceso finché `active` è vero (iPhone: app dalla Home, iOS 18.4+).
 * iOS lo rilascia quando l'app va in secondo piano: lo richiede di nuovo al ritorno.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!active || !api) return;
    let sentinel: Sentinel | undefined;
    let stopped = false;

    const acquire = async () => {
      if (stopped || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const s = await api.request('screen');
        if (stopped) void s.release();
        else sentinel = s;
      } catch {
        // Batteria scarica o permesso negato: lo schermo si spegne come sempre.
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release();
    };
  }, [active]);
}
