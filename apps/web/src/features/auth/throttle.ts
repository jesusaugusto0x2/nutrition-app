import { ApiClientError } from '@/lib/api-client';

/** When a rate-limited request may be tried again. */
export interface Throttle {
  /** Epoch milliseconds; `null` without a `Retry-After` header. */
  retryAt: number | null;
  /** Whole minutes to wait, rounded up; `null` without the header. */
  minutes: number | null;
}

/** The wait a 429 asks for, or `null` for any other error. */
export function readThrottle(error: unknown): Throttle | null {
  if (!(error instanceof ApiClientError) || error.status !== 429) {
    return null;
  }
  const { retryAfterSeconds: seconds } = error;
  return {
    retryAt: seconds === null ? null : Date.now() + seconds * 1000,
    minutes: seconds === null ? null : Math.ceil(seconds / 60),
  };
}
