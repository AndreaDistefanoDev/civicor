import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { importBackup } from '../../../data/backupStore';
import { getSettings, saveSettings } from '../../../data/repos';
import { validateBackup } from '../../../domain/backup/backup';
import { lastBackupLabel } from '../../../domain/backup/lastBackup';
import type { AppSettings } from '../../../domain/types';
import { formatService } from '../StopDetail/StopDetail';
import { Screen } from '../../common/ui';
import { downloadBackup } from '../../backupDownload';
import './Settings.css';

const VERSION = '0.1.0';

function SelectRow<T extends string>(props: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  const id = `set-${props.label.replace(/\W+/g, '-')}`;
  return (
    <div className="row">
      <label className="grow" htmlFor={id}>
        {props.label}
      </label>
      <select id={id} className="row-select" value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="section-title">{props.title}</div>
      <div className="detail-card">{props.children}</div>
    </>
  );
}

export function Settings(props: { onClose: () => void }) {
  const settings = useLiveQuery(getSettings, []);
  const [message, setMessage] = useState<string>();
  if (!settings) return null;
  const save = (patch: Partial<AppSettings>) => void saveSettings(patch);

  const doImport = async (f?: File) => {
    if (!f) return;
    try {
      const counts = await importBackup(validateBackup(JSON.parse(await f.text())));
      setMessage(`Backup importato: ${counts.routes} percorsi, ${counts.corrections} posizioni corrette.`);
    } catch {
      setMessage('File di backup non valido');
    }
  };

  return (
    <Screen title="Impostazioni" onClose={props.onClose}>
      {message && <p className="settings-message" role="status">{message}</p>}

      <Section title="Preferenze di percorso">
        <SelectRow
          label="App di navigazione"
          value={settings.navApp}
          options={[['waze', 'Waze'], ['google', 'Google Maps'], ['apple', 'Apple Maps']]}
          onChange={(navApp) => save({ navApp })}
        />
        <SelectRow
          label="Tempo medio alla fermata"
          value={String(settings.defaultServiceMinutes)}
          options={['0.5', '1', '2', '3', '5', '10'].map((m) => [m, formatService(Number(m))])}
          onChange={(v) => save({ defaultServiceMinutes: Number(v) })}
        />
        <SelectRow
          label="Tipo veicolo"
          value={settings.vehicle}
          options={[['car', 'Auto'], ['van', 'Furgone'], ['bike', 'Bici'], ['scooter', 'Scooter']]}
          onChange={(vehicle) => save({ vehicle })}
        />
        <div className="row">
          <label className="grow" htmlFor="set-tolls">
            Evita pedaggi
          </label>
          <input id="set-tolls" type="checkbox" role="switch" className="row-switch" checked={settings.avoidTolls} onChange={(e) => save({ avoidTolls: e.target.checked })} />
        </div>
        <div className="row">
          <label className="grow" htmlFor="set-awake">
            <span className="row-title">Schermo sempre acceso</span>
            <span className="row-sub">Durante il giro, per non sbloccare il telefono a ogni fermata</span>
          </label>
          <input id="set-awake" type="checkbox" role="switch" className="row-switch" checked={settings.keepAwake} onChange={(e) => save({ keepAwake: e.target.checked })} />
        </div>
        <SelectRow
          label="ID fermata"
          value={settings.idMode}
          options={[['classic', 'Classico'], ['after_optimization', "Dopo l'ottimizzazione del percorso"]]}
          onChange={(idMode) => save({ idMode })}
        />
      </Section>

      <Section title="Preferenze generali">
        <SelectRow
          label="Tema"
          value={settings.theme}
          options={[['dark', 'Scuro'], ['light', 'Chiaro'], ['auto', 'Automatico']]}
          onChange={(theme) => save({ theme })}
        />
      </Section>

      <Section title="Servizi">
        <SelectRow
          label="Mappa"
          value={settings.mapProvider}
          options={[['google', 'Google Maps'], ['osm', 'OpenStreetMap (gratis)']]}
          onChange={(mapProvider) => save({ mapProvider })}
        />
        <SelectRow
          label="Ricerca indirizzi"
          value={settings.geocoderProvider}
          options={[['google', 'Google (più preciso)'], ['osm', 'OpenStreetMap (gratis)']]}
          onChange={(geocoderProvider) => save({ geocoderProvider })}
        />
        {(settings.geocoderProvider === 'google' || settings.mapProvider === 'google') && (
          <>
            <label className="field ors-field">
              <span>Chiave Google</span>
              <input
                type="password"
                autoComplete="off"
                defaultValue={settings.googleApiKey ?? ''}
                onBlur={(e) => save({ googleApiKey: e.target.value.trim() || undefined })}
              />
            </label>
            <p className="settings-hint muted">
              Mappa e civici con la precisione di Google Maps. Serve una chiave Google Maps Platform con Maps JavaScript API,
              Places API (New) e Geocoding API attive. Senza chiave valida si usa la mappa OpenStreetMap. Resta solo su
              questo telefono.
            </p>
          </>
        )}
        <label className="field ors-field">
          <span>Chiave OpenRouteService</span>
          <input
            type="password"
            autoComplete="off"
            defaultValue={settings.orsApiKey ?? ''}
            onBlur={(e) => save({ orsApiKey: e.target.value.trim() || undefined })}
          />
        </label>
        <p className="settings-hint muted">
          Serve per calcolare il percorso{settings.geocoderProvider === 'osm' ? ' e trovare gli indirizzi' : ''}. È gratuita:{' '}
          <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noreferrer">
            registrati su openrouteservice.org
          </a>{' '}
          e incollala qui. Resta solo su questo telefono.
        </p>
      </Section>

      <Section title="Dati">
        <button className="row" onClick={() => void downloadBackup()}>
          <span className="grow">
            <span className="row-title">Esporta backup</span>
            <span className="row-sub">Ultima copia: {lastBackupLabel(settings.lastBackupAt, Date.now())}</span>
          </span>
        </button>
        <label className="row file-row">
          <span className="grow">Importa backup</span>
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Importa backup"
            onChange={(e) => {
              void doImport(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <SelectRow
          label="Elimina percorsi più vecchi di"
          value={settings.retentionMonths === null ? 'never' : String(settings.retentionMonths)}
          options={[['6', '6 mesi'], ['12', '12 mesi'], ['24', '24 mesi'], ['never', 'Mai']]}
          onChange={(v) => save({ retentionMonths: v === 'never' ? null : Number(v) })}
        />
      </Section>

      <p className="settings-version muted">Civicor {VERSION}</p>
    </Screen>
  );
}
