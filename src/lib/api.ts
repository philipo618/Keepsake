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
