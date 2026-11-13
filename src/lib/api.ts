/**
 * Normalizes VITE_API_BASE_URL and builds backend API endpoint URLs without
 * ever duplicating `/api` (e.g. when pointing to a Firebase Cloud Function
 * URL that already ends with `/api`, such as
 * `https://us-central1-<project>.cloudfunctions.net/api`).
 */
export function getNormalizedApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').trim();
  return raw.replace(/\/+$/, '');
}

/**
 * Returns true when running on a static GitHub Pages host (or any non-local static host)
 * with no VITE_API_BASE_URL configured.
 */
export function isStaticHostWithoutBackend(): boolean {
  if (getNormalizedApiBase()) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.endsWith('.github.io');
}

export function hasApiBackend(): boolean {
  return !isStaticHostWithoutBackend();
}

let cachedBackendReachable: boolean | null = null;
let inflightBackendProbe: Promise<boolean> | null = null;

export function resetApiBackendProbeCache(): void {
  cachedBackendReachable = null;
  inflightBackendProbe = null;
}

/**
 * Verifies whether a real JSON API backend is reachable.
 * - Immediately returns false with zero network requests on *.github.io when VITE_API_BASE_URL is unset.
 * - Probes GET /health once per session on custom domains / preview hosts to prevent orphan writes.
 */
export async function verifyApiBackendReachable(): Promise<boolean> {
  if (isStaticHostWithoutBackend()) {
    return false;
  }
  if (cachedBackendReachable !== null) {
    return cachedBackendReachable;
  }
  if (inflightBackendProbe) {
    return inflightBackendProbe;
  }

  inflightBackendProbe = (async () => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId =
      controller && typeof setTimeout !== 'undefined'
        ? setTimeout(() => controller.abort(), 2500)
        : null;
    try {
      const resp = await fetch(buildApiUrl('/health'), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller?.signal,
      });
      const contentType = resp.headers.get('content-type') || '';
      if (!resp.ok || !contentType.includes('application/json')) {
        cachedBackendReachable = false;
        return false;
      }
      const data = (await resp.json().catch(() => null)) as { ok?: boolean } | null;
      const ok = Boolean(data && data.ok === true);
      cachedBackendReachable = ok;
      return ok;
    } catch {
      cachedBackendReachable = false;
      return false;
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
      inflightBackendProbe = null;
    }
  })();

  return inflightBackendProbe;
}

export function buildApiUrl(endpointPath: string): string {
  const cleanEndpoint = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const withoutApiPrefix = cleanEndpoint.startsWith('/api/')
    ? cleanEndpoint.slice(4)
    : cleanEndpoint === '/api'
    ? ''
    : cleanEndpoint;

  const base = getNormalizedApiBase();
  if (!base) {
    return `/api${withoutApiPrefix}`;
  }

  if (base.endsWith('/api')) {
    return `${base}${withoutApiPrefix}`;
  }

  return `${base}/api${withoutApiPrefix}`;
}
