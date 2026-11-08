import { parseLabelText, snapCity } from './parseLabelText';

// Testi inventati, come li restituisce un lettore di testo (con qualche errore tipico).
const BRT = `BRT
MITTENTE: NEGOZIO ESEMPIO SRL
VIA DEL MAGAZZINO 5
20100 MILANO MI
DESTINATARIO
MARIO ROSSI
VIA ROMA 10
97100 RAGUSA RG
TEL 333 1234567
COLLI 1 PESO 2,5`;

it('trova il destinatario e scarta il mittente', () => {
  const r = parseLabelText(BRT);
  expect(r.best).toEqual({
    role: 'recipient', recipient: 'Mario Rossi', street: 'Via Roma 10', postcode: '97100', city: 'Ragusa', province: 'RG', phone: '3331234567',
  });
  expect(r.candidates).toHaveLength(2);
  expect(r.candidates[1]).toMatchObject({ role: 'sender', city: 'Milano' });
});

it('etichetta senza parole chiave: sceglie l\'indirizzo che non è del mittente noto, con CAP sulla stessa riga della via', () => {
  const r = parseLabelText(`Ship to:
Giulia Bianchi
Corso Italia 45/B, 97100 Ragusa (RG)
Order 0000`);
  expect(r.best).toMatchObject({ street: 'Corso Italia 45/B', postcode: '97100', city: 'Ragusa', province: 'RG', recipient: 'Giulia Bianchi' });
});

it('corregge gli errori tipici della lettura nel CAP (O al posto di 0)', () => {
  const r = parseLabelText(`DEST. LUCA VERDI
C.DA BOSCO 3
971OO RAGUSA RG`);
  expect(r.best).toMatchObject({ street: 'C.da Bosco 3', postcode: '97100', city: 'Ragusa' });
});

it('due indirizzi senza indicazioni: mostra entrambi, il primo come proposta', () => {
  const r = parseLabelText(`Ditta Uno
Via Etna 2
95100 Catania CT
Anna Neri
Piazza Duomo 1
97100 Ragusa RG`);
  expect(r.candidates.map((c) => c.city)).toEqual(['Catania', 'Ragusa']);
  expect(r.best?.role).toBe('unknown');
});

it('niente indirizzo riconoscibile: nessuna proposta', () => {
  expect(parseLabelText('ciao\n12345\nfragile').best).toBeUndefined();
  expect(parseLabelText('').candidates).toEqual([]);
});

it('testo dell\'iPhone su una riga sola (Scansiona testo)', () => {
  const r = parseLabelText('Destinatario: Paolo Gialli Via Mazzini 7 97015 Modica RG');
  expect(r.best).toMatchObject({ street: 'Via Mazzini 7', postcode: '97015', city: 'Modica', province: 'RG' });
});

// Casi presi da foto vere di etichette (indirizzi inventati): rumore del lettore intorno al testo.
it('CAP e città in mezzo alla riga, con "IT" alla fine e simboli spuri del lettore', () => {
  const r = parseLabelText('= Dati destinatario\n3 ri mario verdi c/o Studio Rossi |\n> 4 Via verdi n.12 97100 ragusa RG IT E\na 3330000000');
  expect(r.best).toMatchObject({ street: 'Via Verdi 12', postcode: '97100', city: 'Ragusa', province: 'RG', phone: '3330000000' });
});

it('blocco principale illeggibile ma riga con CAP più sotto: usa quella', () => {
  const r = parseLabelText('| R2 via verdi, 12 | psi Sepp\nNa RG A |\nTW 000000000 01 0 RG 01/01\n> Via verdi n.12 97100 ragusa RG IT');
  expect(r.best).toMatchObject({ street: 'Via Verdi 12', postcode: '97100', city: 'Ragusa' });
});

it('si legge solo la via (città illeggibile): la propone senza città da completare', () => {
  const r = parseLabelText("SE | sapo Graz\nA R2 |via mazzini, 17/b e PI é '\n| (contante 3330000000 chiamare grazie |");
  expect(r.best).toMatchObject({ street: 'Via Mazzini, 17/B', postcode: '', city: '', phone: '3330000000' });
});

it('via e città su righe diverse senza CAP (come nel blocco grande delle etichette)', () => {
  const r = parseLabelText('MARIO VERDI\nVIA ROMA, 200\nRAGUSA RG');
  expect(r.best).toMatchObject({ street: 'Via Roma, 200', postcode: '', city: 'Ragusa', province: 'RG', recipient: 'Mario Verdi' });
});

it('città sulla riga sotto con un pezzetto spurio davanti ("a RAGUSA")', () => {
  const r = parseLabelText('Mario Verdi\nR2 via garibaldi, 30\na RAGUSA\nTW 000000000 01 0 RG 01/01');
  expect(r.best).toMatchObject({ street: 'Via Garibaldi, 30', city: 'Ragusa' });
});

it('città sporca dal lettore: si ferma alla sigla di provincia vera e scarta le parole senza senso', () => {
  const r = parseLabelText('Via Verdi, 70\nEEE __ qusa RG | Eereaiao');
  expect(r.best).toMatchObject({ street: 'Via Verdi, 70', city: 'Qusa', province: 'RG' });
});

it('due lettere maiuscole che non sono una provincia fanno parte della città', () => {
  const r = parseLabelText('Via Etna 2\n95030 SAN GIOVANNI LA PUNTA CT');
  expect(r.best).toMatchObject({ city: 'San Giovanni la Punta', province: 'CT' });
});

it('aggancia la città letta male a una città nota del giro', () => {
  expect(snapCity('Qusa', ['Ragusa', 'Modica'])).toBe('Ragusa');
  expect(snapCity('Ragusa', ['Ragusa'])).toBe('Ragusa');
  expect(snapCity('Modlca', ['Ragusa', 'Modica'])).toBe('Modica');
  expect(snapCity('Catania', ['Ragusa', 'Modica'])).toBe('Catania');
  expect(snapCity('Rg', ['Ragusa'])).toBe('Rg');
});

it('niente nome inventato quando il lettore legge solo scarabocchi ("Eee")', () => {
  const r = parseLabelText('EEE\nR2 via garibaldi, 30\na RAGUSA');
  expect(r.best?.street).toBe('Via Garibaldi, 30');
  expect(r.best?.recipient).toBeUndefined();
});
