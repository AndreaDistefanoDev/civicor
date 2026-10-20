import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { exportBackup, importBackup } from '../../../data/backupStore';
import { getSettings, saveSettings } from '../../../data/repos';
import { validateBackup } from '../../../domain/backup/backup';
import type { AppSettings } from '../../../domain/types';
import { formatService } from '../StopDetail/StopDetail';
import { Screen } from '../../common/ui';
import { todayIso } from '../../dates';
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

  const doExport = async () => {
    const file = await exportBackup();
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicor-backup-${todayIso()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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
          Serve per trovare gli indirizzi e calcolare il percorso. È gratuita:{' '}
          <a href="https://openrouteservice.org/dev/#/signup" target="_blank" rel="noreferrer">
            registrati su openrouteservice.org
          </a>{' '}
          e incollala qui. Resta solo su questo telefono.
        </p>
      </Section>

      <Section title="Dati">
        <button className="row" onClick={doExport}>
          Esporta backup
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
