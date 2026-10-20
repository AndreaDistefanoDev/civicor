export type OrsErrorReason = 'missing_key' | 'bad_key' | 'quota' | 'network' | 'server';

const MESSAGES: Record<OrsErrorReason, string> = {
  missing_key: 'Inserisci la chiave OpenRouteService nelle Impostazioni.',
  bad_key: 'La chiave OpenRouteService non è valida.',
  quota: 'Limite giornaliero di OpenRouteService raggiunto. Riprova più tardi.',
  network: 'Nessuna connessione.',
  server: 'OpenRouteService non risponde.',
};

export class OrsError extends Error {
  constructor(
    public reason: OrsErrorReason,
    message: string = MESSAGES[reason],
  ) {
    super(message);
    this.name = 'OrsError';
  }
}

// api.openrouteservice.org viene spento a inizio novembre 2026: si usa api.heigit.org.
export const ORS_BASE = 'https://api.heigit.org';

export interface OrsRequest {
  apiKey?: string;
  method?: 'GET' | 'POST';
  query?: Record<string, string>;
  body?: unknown;
}

/** Chiamata a OpenRouteService con errori tradotti in OrsError. */
export async function orsFetch(path: string, init: OrsRequest): Promise<unknown> {
  if (!init.apiKey) throw new OrsError('missing_key');
  const method = init.method ?? 'GET';
  const url = new URL(path, ORS_BASE);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: 'application/json, application/geo+json' };
  if (method === 'GET') {
    url.searchParams.set('api_key', init.apiKey);
  } else {
    headers.Authorization = init.apiKey;
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new OrsError('network');
  }
  if (res.status === 401 || res.status === 403) throw new OrsError('bad_key');
  if (res.status === 429) throw new OrsError('quota');
  if (!res.ok) throw new OrsError('server');
  return res.json();
}
