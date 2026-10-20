import { validateBackup } from './backup';

const valid = {
  app: 'civicor', version: 1, exportedAt: '2026-10-20T08:00:00.000Z', routes: [], stops: [], stopTypes: [],
  corrections: [], unreadableCodes: [], settings: { navApp: 'waze' },
};

it('accetta un backup Civicor valido', () => {
  expect(validateBackup(valid)).toEqual(valid);
});

it.each([
  ['altra app', { ...valid, app: 'altro' }],
  ['versione sconosciuta', { ...valid, version: 2 }],
  ['liste mancanti', { app: 'civicor', version: 1 }],
  ['non è un oggetto', 'ciao'],
  ['null', null],
])('%s → errore', (_, json) => {
  expect(() => validateBackup(json)).toThrow('File di backup non valido');
});
