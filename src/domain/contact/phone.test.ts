import { contactLinks, extractPhone, normalizePhone } from './phone';

it('trova un cellulare italiano nelle note dell\'etichetta', () => {
  expect(extractPhone('CHIAMARE PRIMA TEL 333 123 4567')).toBe('3331234567');
  expect(extractPhone('cell.+39 347-1234567 citofono rossi')).toBe('3471234567');
});

it('trova un numero fisso con prefisso', () => {
  expect(extractPhone('tel 0932 123456')).toBe('0932123456');
});

it('ignora numeri che non sono telefoni (CAP, civici, codici)', () => {
  expect(extractPhone('SCALA B INT 4 97100')).toBeUndefined();
  expect(extractPhone('consegnare dopo le 14')).toBeUndefined();
  expect(extractPhone(undefined)).toBeUndefined();
});

it('pulisce il numero scritto a mano', () => {
  expect(normalizePhone(' +39 333 12.34.567 ')).toBe('3331234567');
  expect(normalizePhone('0039 0932-123456')).toBe('0932123456');
  expect(normalizePhone('abc')).toBeUndefined();
});

it('prepara chiamata, SMS e WhatsApp con il messaggio già scritto', () => {
  const l = contactLinks('3331234567', 'Sono il corriere, arrivo tra 10 minuti');
  expect(l.call).toBe('tel:+393331234567');
  expect(l.sms).toBe('sms:+393331234567&body=Sono%20il%20corriere%2C%20arrivo%20tra%2010%20minuti');
  expect(l.whatsapp).toBe('https://wa.me/393331234567?text=Sono%20il%20corriere%2C%20arrivo%20tra%2010%20minuti');
});
