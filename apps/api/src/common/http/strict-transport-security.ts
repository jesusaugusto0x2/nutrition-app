import type { RequestHandler } from 'express';

/**
 * One year, the value OWASP recommends. No `includeSubDomains`: the session
 * cookies are `__Host-`, which already stops a subdomain from planting them,
 * and the header must not force HTTPS on hosts this app does not serve once
 * a custom domain exists (#41). No `preload`: leaving the browsers' preload
 * list takes months. Why the app sends it and not Railway's edge:
 * docs/deployment.md "Domain and HTTPS".
 */
export const STRICT_TRANSPORT_SECURITY = 'max-age=31536000';

/**
 * Sends `Strict-Transport-Security` on every response, API and web app alike,
 * when the public origin is HTTPS. Browsers ignore the header on plain HTTP,
 * so it is harmless behind Railway's edge, which talks HTTP to the container.
 * Returns `undefined` for an `http://` origin (local development, the
 * production image smoke test), where there is nothing to pin.
 */
export function strictTransportSecurity(
  appOrigin: string,
): RequestHandler | undefined {
  if (new URL(appOrigin).protocol !== 'https:') {
    return undefined;
  }
  return (_request, response, next) => {
    response.setHeader('Strict-Transport-Security', STRICT_TRANSPORT_SECURITY);
    next();
  };
}
