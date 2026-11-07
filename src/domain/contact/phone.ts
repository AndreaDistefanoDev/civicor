// Telefono del destinatario: trovato nelle note dell'etichetta o scritto a mano.

/** Solo cifre, senza prefisso internazionale italiano. Undefined se non sembra un telefono italiano. */
export function normalizePhone(raw: string): string | undefined {
  let digits = raw.replace(/[^\d+]/g, '').replace(/^(\+|00)39/, '').replace(/\D/g, '');
  if (digits.startsWith('39') && digits.length >= 11) digits = digits.slice(2);
  // Cellulari: 3xx e 9-10 cifre. Fissi: 0 + prefisso, 6-11 cifre.
  if (/^3\d{8,9}$/.test(digits) || /^0\d{5,10}$/.test(digits)) return digits;
  return undefined;
}

/** Cerca un numero di telefono in un testo libero (es. "CHIAMARE PRIMA TEL 333 1234567"). */
export function extractPhone(text?: string): string | undefined {
  if (!text) return undefined;
  for (const m of text.matchAll(/(?:\+|00)?[\d][\d .\-/]{5,18}\d/g)) {
    const phone = normalizePhone(m[0]);
    if (phone) return phone;
  }
  return undefined;
}

/** Collegamenti che aprono Telefono, Messaggi e WhatsApp: l'invio lo conferma sempre il corriere. */
export function contactLinks(phone: string, message: string): { call: string; sms: string; whatsapp: string } {
  const text = encodeURIComponent(message);
  return {
    call: `tel:+39${phone}`,
    sms: `sms:+39${phone}&body=${text}`,
    whatsapp: `https://wa.me/39${phone}?text=${text}`,
  };
}
