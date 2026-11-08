import { makeStop } from '../../test/fixtures';
import { stopMarker } from './markers';

it('fermata da fare in un percorso ottimizzato: segnaposto bianco con il numero e il colore del tipo', () => {
  const el = stopMarker(makeStop({ displayId: 7, sequence: 6 }), '#1f6bff', false);
  expect(el.className).toBe('stop-pin');
  expect(el.querySelector('.stop-pin-num')?.textContent).toBe('7');
  expect(el.getAttribute('aria-label')).toBe('Fermata 7: Via Esempio, 12');
  expect(el.style.getPropertyValue('--pin')).toBe('#1f6bff');
});

it('percorso non ancora ottimizzato: al posto del numero c\'è il "+"', () => {
  const el = stopMarker(makeStop({ displayId: 7, sequence: undefined }), '#1f6bff', false);
  expect(el.className).toBe('stop-pin new');
  expect(el.querySelector('.stop-pin-num')?.textContent).toBe('');
  expect(el.querySelector('svg')).not.toBeNull();
  expect(el.getAttribute('aria-label')).toBe('Fermata 7: Via Esempio, 12');
});

it('fermata attuale: segnaposto più grande', () => {
  expect(stopMarker(makeStop({ sequence: 0 }), '#1f6bff', true).className).toBe('stop-pin current');
});

it('effettuata o non riuscita: stesso segnaposto e stesso numero, ma spento (grigio)', () => {
  const done = stopMarker(makeStop({ displayId: 3, sequence: 2, outcome: 'done' }), '#1f6bff', false);
  const failed = stopMarker(makeStop({ displayId: 3, sequence: 2, outcome: 'failed' }), '#1f6bff', false);
  expect(done.className).toBe('stop-pin off');
  expect(done.querySelector('.stop-pin-num')?.textContent).toBe('3');
  expect(failed.className).toBe('stop-pin off');
  expect(failed.innerHTML).toBe(done.innerHTML);
  expect(done.getAttribute('aria-label')).toBe('Fermata 3, effettuata: Via Esempio, 12');
  expect(failed.getAttribute('aria-label')).toBe('Fermata 3, non riuscita: Via Esempio, 12');
});

it('posizione da verificare: arancione, anche se il tipo ha un altro colore', () => {
  const el = stopMarker(makeStop({ geoStatus: 'uncertain', sequence: 0 }), '#3d8bff', false);
  expect(el.className).toBe('stop-pin uncertain');
  expect(el.style.getPropertyValue('--pin')).toBe('');
});

it('accanto al segnaposto: via abbreviata e orario previsto; le fermate chiuse non hanno etichetta', () => {
  const el = stopMarker(makeStop({ displayId: 2, sequence: 1, eta: '18:21', address: { street: 'Via Roma 28, Scicli', city: 'Scicli' } }), '#1f6bff', false);
  expect(el.querySelector('.stop-pin-label')?.textContent).toBe('V Roma 28, Scicl18:21');
  const done = stopMarker(makeStop({ sequence: 1, eta: '18:21', outcome: 'done' }), '#1f6bff', false);
  expect(done.querySelector('.stop-pin-label')).toBeNull();
});
