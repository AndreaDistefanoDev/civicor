const FALLBACK_DELAY_MS = 1500;

/**
 * Apre un'app esterna (navigatore). Va chiamata direttamente dal tocco dell'utente:
 * iOS apre le app solo da un gesto. Se dopo un attimo la pagina è ancora visibile
 * (app non installata) apre il link web di riserva. Isolato qui per sostituirlo con Capacitor.
 */
export function openExternal(url: string, fallbackUrl?: string): void {
  location.href = url;
  if (!fallbackUrl || fallbackUrl === url) return;
  setTimeout(() => {
    if (document.visibilityState === 'visible') location.href = fallbackUrl;
  }, FALLBACK_DELAY_MS);
}
