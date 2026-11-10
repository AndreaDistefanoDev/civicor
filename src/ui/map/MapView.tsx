import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useState } from 'react';
import { getSettings, saveSettings } from '../../data/repos';
import { GoogleMap } from './google/GoogleMap';
import { OsmMap } from './OsmMap';
import type { MapViewProps } from './shared';

export type { MapViewProps } from './shared';

/**
 * Mappa di Civicor: Google se scelta nelle Impostazioni e c'è la chiave, altrimenti OpenStreetMap.
 * Se Google rifiuta la chiave (API non attiva, fatturazione assente) si torna da soli a OpenStreetMap.
 */
export function MapView(props: MapViewProps) {
  const settings = useLiveQuery(getSettings, []);
  const [googleFailed, setGoogleFailed] = useState(false);
  const onAuthFailure = useCallback(() => setGoogleFailed(true), []);
  if (!settings) return <div className="map-wrap" />;

  const mode = settings.mapMode;
  const onToggleMode = () => void saveSettings({ mapMode: mode === '3d' ? '2d' : '3d' });
  const key = settings.googleApiKey;
  if (settings.mapProvider === 'google' && key && !googleFailed) {
    return (
      <GoogleMap
        key={`${props.theme}`}
        {...props}
        mode={mode}
        onToggleMode={onToggleMode}
        satellite={settings.mapSatellite}
        onToggleSatellite={() => void saveSettings({ mapSatellite: !settings.mapSatellite })}
        apiKey={key}
        onAuthFailure={onAuthFailure}
      />
    );
  }
  return <OsmMap key={props.theme} {...props} mode={mode} onToggleMode={onToggleMode} />;
}
