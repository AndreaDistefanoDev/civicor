import { lastBackupLabel } from './lastBackup';

const now = new Date(2026, 10, 7, 18, 30).getTime();

it('dice quando è stata fatta l\'ultima copia di sicurezza', () => {
  expect(lastBackupLabel(undefined, now)).toBe('mai');
  expect(lastBackupLabel(new Date(2026, 10, 7, 9, 5).getTime(), now)).toBe('oggi alle 09:05');
  expect(lastBackupLabel(new Date(2026, 10, 6, 20, 0).getTime(), now)).toBe('ieri');
  expect(lastBackupLabel(new Date(2026, 10, 1, 20, 0).getTime(), now)).toBe('6 giorni fa');
});
