import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './theme.css';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSettings, listRoutes, requestPersistentStorage } from '../data/repos';
import { Toast } from './common/Toast';
import { todayIso } from './dates';
import { CreateRoute } from './screens/CreateRoute/CreateRoute';
import { Drawer } from './screens/Drawer/Drawer';
import { RouteScreen } from './screens/RouteScreen/RouteScreen';
import { StopDetail } from './screens/StopDetail/StopDetail';
import { RouteDetails } from './screens/RouteDetails/RouteDetails';
import { Settings } from './screens/Settings/Settings';
import { ScanScreen } from './screens/Scan/ScanScreen';
import { VerifyScreen } from './screens/Verify/VerifyScreen';
import { AddressSearch } from './screens/AddStop/AddressSearch';
import { PasteAddresses } from './screens/AddStop/PasteAddresses';
import { PickOnMap } from './screens/AddStop/PickOnMap';
import { VoiceInput } from './screens/AddStop/VoiceInput';
import { cleanupExpiredRoutes } from '../data/retentionStore';
import { geocoder } from './appServices';
import { StopTypes } from './screens/StopTypes/StopTypes';
import type { Snap } from './sheet/BottomSheet';
import { AppStateContext, type AppState, type OpenScreen, type ScreenName } from './useAppState';

function useTheme(): 'dark' | 'light' {
  const settings = useLiveQuery(getSettings, []);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);
  const pref = settings?.theme ?? 'dark';
  const theme = pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return theme;
}

export default function App() {
  const theme = useTheme();
  const today = todayIso();
  const [currentRouteId, setCurrentRouteId] = useState<string>();
  const [screen, setScreen] = useState<OpenScreen | null>(null);
  const [sheet, setSheet] = useState<Snap>('half');
  const [toast, setToast] = useState<{ message: string; action?: { label: string; onPress: () => void } } | null>(null);
  const routes = useLiveQuery(listRoutes, []);

  useEffect(() => {
    void requestPersistentStorage();
    void cleanupExpiredRoutes(todayIso());
  }, []);

  // All'avvio apre il percorso di oggi più recente.
  useEffect(() => {
    if (currentRouteId || !routes) return;
    const todays = routes.find((r) => r.date === today);
    if (todays) setCurrentRouteId(todays.id);
  }, [routes, currentRouteId, today]);

  // Se il percorso aperto viene eliminato, torna allo stato iniziale.
  useEffect(() => {
    if (currentRouteId && routes && !routes.some((r) => r.id === currentRouteId)) setCurrentRouteId(undefined);
  }, [routes, currentRouteId]);

  const openScreen = useCallback((name: ScreenName, params?: Record<string, string>) => setScreen({ name, params }), []);
  const closeScreen = useCallback(() => setScreen(null), []);
  const showToast = useCallback<AppState['showToast']>((message, action) => setToast({ message, action }), []);

  const state = useMemo<AppState>(
    () => ({ currentRouteId, setCurrentRouteId, sheet, setSheet, openScreen, closeScreen, showToast }),
    [currentRouteId, sheet, openScreen, closeScreen, showToast],
  );

  const openRoute = (id: string) => {
    setCurrentRouteId(id);
    setScreen(null);
  };

  return (
    <AppStateContext.Provider value={state}>
      {currentRouteId ? (
        <RouteScreen routeId={currentRouteId} theme={theme} />
      ) : (
        routes && (
          <main className="welcome">
            <h1 className="welcome-brand">Civicor</h1>
            <p className="welcome-text">Nessun percorso per oggi</p>
            <button className="btn-primary" onClick={() => openScreen('createRoute')}>
              + Crea percorso
            </button>
            {routes.length > 0 && (
              <button className="btn-secondary" onClick={() => openScreen('drawer')}>
                Apri un percorso esistente
              </button>
            )}
          </main>
        )
      )}

      {screen?.name === 'drawer' && (
        <Drawer
          today={today}
          currentRouteId={currentRouteId}
          onOpenRoute={openRoute}
          onCreateRoute={() => openScreen('createRoute')}
          onOpenSettings={() => openScreen('settings')}
          onClose={closeScreen}
        />
      )}
      {screen?.name === 'createRoute' && <CreateRoute today={today} onCreated={openRoute} onClose={closeScreen} />}

      {screen?.name === 'stopDetail' && screen.params?.stopId && (
        <StopDetail
          stopId={screen.params.stopId}
          onClose={closeScreen}
          onManageTypes={() => openScreen('stopTypes', { backTo: screen.params!.stopId })}
          onChangeAddress={(stopId) => openScreen('search', { routeId: currentRouteId ?? '', stopId })}
        />
      )}
      {screen?.name === 'stopTypes' && (
        <StopTypes
          onClose={() => (screen.params?.backTo ? openScreen('stopDetail', { stopId: screen.params.backTo }) : closeScreen())}
        />
      )}

      {screen?.name === 'scan' && screen.params?.routeId && (
        <ScanScreen
          routeId={screen.params.routeId}
          onDone={(routeId) => openScreen('verify', { routeId })}
          onManualAdd={() => openScreen('search', { routeId: screen.params!.routeId })}
          onClose={closeScreen}
          onOpenSettings={() => openScreen('settings')}
        />
      )}
      {screen?.name === 'verify' && screen.params?.routeId && (
        <VerifyScreen routeId={screen.params.routeId} theme={theme} onFinish={closeScreen} onClose={closeScreen} />
      )}
      {screen?.name === 'search' && screen.params?.routeId && (
        <AddressSearch
          routeId={screen.params.routeId}
          stopId={screen.params.stopId}
          geocoder={geocoder}
          onClose={closeScreen}
          onPickOnMap={() => openScreen('pickOnMap', { routeId: screen.params!.routeId })}
          onPaste={() => openScreen('paste', { routeId: screen.params!.routeId })}
        />
      )}
      {screen?.name === 'paste' && screen.params?.routeId && (
        <PasteAddresses routeId={screen.params.routeId} geocoder={geocoder} onDone={() => openScreen('verify', { routeId: screen.params!.routeId })} onClose={closeScreen} />
      )}
      {screen?.name === 'pickOnMap' && screen.params?.routeId && (
        <PickOnMap routeId={screen.params.routeId} start={{ lat: 36.9258, lng: 14.7306 }} theme={theme} onDone={closeScreen} onClose={closeScreen} />
      )}
      {screen?.name === 'voice' && screen.params?.routeId && (
        <VoiceInput routeId={screen.params.routeId} geocoder={geocoder} onClose={closeScreen} />
      )}
      {screen?.name === 'settings' && <Settings onClose={closeScreen} />}
      {screen?.name === 'routeDetails' && currentRouteId && (
        <RouteDetails routeId={currentRouteId} geocoder={geocoder} onClose={closeScreen} />
      )}

      {toast && <Toast message={toast.message} action={toast.action} onDismiss={() => setToast(null)} />}
    </AppStateContext.Provider>
  );
}
