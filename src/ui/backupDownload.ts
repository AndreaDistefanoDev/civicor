import { exportBackup } from '../data/backupStore';
import { saveSettings } from '../data/repos';
import { todayIso } from './dates';

/** Scarica la copia di sicurezza (su iPhone: "Salva in File") e ricorda quando è stata fatta. */
export async function downloadBackup(): Promise<void> {
  const file = await exportBackup();
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `civicor-backup-${todayIso()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await saveSettings({ lastBackupAt: Date.now() });
}
