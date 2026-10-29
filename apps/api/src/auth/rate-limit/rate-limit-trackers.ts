import { isIP } from 'node:net';
import { normalizeIp } from '@nestjs/throttler';
import { normalizeEmail } from '@nutri/schemas';
import type { Request } from 'express';
import type { AppConfig } from '../../config/app-config';

/**
 * The client's address, as configured by `CLIENT_IP_SOURCE`.
 *
 * Express `trust proxy` stays off: Railway does not guarantee a fixed number
 * of proxy hops, so `X-Forwarded-For` cannot be cut at a known position.
 * Its edge overwrites `X-Real-IP` on every public request instead. Without a
 * valid header the socket's peer (the proxy) is used, which only makes the
 * limit stricter.
 */
export function clientIp(
  request: Request,
  source: AppConfig['CLIENT_IP_SOURCE'],
): string {
  if (source === 'x-real-ip') {
    const header = request.get('x-real-ip')?.trim();
    if (header && isIP(header) !== 0) {
      return header;
    }
  }
  return request.socket.remoteAddress ?? 'unknown';
}

/**
 * Rate-limit key for the client's network: IPv4 addresses as they are,
 * IPv6 addresses grouped by /64 prefix (one customer usually owns a whole
 * /64, so rotating the last 64 bits must not reset the counter).
 */
export function clientIpTracker(
  request: Request,
  source: AppConfig['CLIENT_IP_SOURCE'],
): string {
  return normalizeIp(clientIp(request, source));
}

/**
 * Rate-limit key for the account a request targets, normalized like every
 * email lookup. Guards run before validation, so a body without a string
 * `email` gets a shared key: such a request is rejected with 400 anyway.
 */
export function emailTracker(request: Request): string {
  const email = (request.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? normalizeEmail(email) : '';
}
