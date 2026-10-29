import { applyDecorators } from '@nestjs/common';
import {
  minutes,
  SkipThrottle,
  Throttle,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import type { Request } from 'express';
import type { AppConfig } from '../../config/app-config';
import { clientIpTracker, emailTracker } from './rate-limit-trackers';

/** Counts requests per client network (IPv4 address or IPv6 /64). */
export const IP_THROTTLER = 'ip';
/** Counts requests per target email, whatever IP they come from. */
export const EMAIL_THROTTLER = 'email';

interface Limit {
  /** Requests allowed per window. */
  limit: number;
  /** Window in milliseconds; it is also how long a client stays blocked. */
  ttl: number;
}

export interface AuthRateLimits {
  [IP_THROTTLER]: Limit;
  /** Only for endpoints whose body carries the target `email`. */
  [EMAIL_THROTTLER]?: Limit;
}

/**
 * Per IP it stops spraying many accounts from one network; per email it
 * stops guessing one account's password from many IPs (5 guesses per 15
 * minutes is 480 a day). Throttled, never locked: the counter resets after
 * the window, so an attacker cannot lock a real user out for good.
 */
export const SIGN_IN_RATE_LIMITS = {
  [IP_THROTTLER]: { limit: 20, ttl: minutes(15) },
  [EMAIL_THROTTLER]: { limit: 5, ttl: minutes(15) },
} satisfies AuthRateLimits;

/**
 * Each request may send an email: per email it stops flooding one inbox
 * with reset links, per IP it stops probing many addresses.
 */
export const FORGOT_PASSWORD_RATE_LIMITS = {
  [IP_THROTTLER]: { limit: 10, ttl: minutes(15) },
  [EMAIL_THROTTLER]: { limit: 3, ttl: minutes(15) },
} satisfies AuthRateLimits;

/**
 * Tokens are 256-bit random values, so guessing is hopeless; the limit caps
 * the password hashing a single client can trigger.
 */
export const RESET_PASSWORD_RATE_LIMITS = {
  [IP_THROTTLER]: { limit: 10, ttl: minutes(15) },
} satisfies AuthRateLimits;

/**
 * Limits for an authentication route. Pair it with
 * `@UseGuards(AuthThrottlerGuard, ...)`, listing the throttler guard first
 * so a throttled request never reaches password hashing.
 */
export function RateLimit(limits: AuthRateLimits) {
  return applyDecorators(
    Throttle({ ...limits }),
    SkipThrottle({ [EMAIL_THROTTLER]: limits[EMAIL_THROTTLER] === undefined }),
  );
}

/**
 * Storage is in memory (the library default), which only works with one
 * API container: see "Known technical debt" in docs/architecture.md.
 */
export function createThrottlerOptions(
  config: AppConfig,
): ThrottlerModuleOptions {
  return {
    // Only `Retry-After`, set by AuthThrottlerGuard on a 429.
    setHeaders: false,
    // Defaults for a route that forgets @RateLimit; the strictest limits.
    throttlers: [
      {
        name: IP_THROTTLER,
        ...SIGN_IN_RATE_LIMITS[IP_THROTTLER],
        // The library types the request loosely; it is Express's.
        getTracker: (request) =>
          clientIpTracker(request as Request, config.CLIENT_IP_SOURCE),
      },
      {
        name: EMAIL_THROTTLER,
        ...SIGN_IN_RATE_LIMITS[EMAIL_THROTTLER],
        getTracker: (request) => emailTracker(request as Request),
      },
    ],
  };
}
