/**
 * Source of the current time. Injected (instead of calling `new Date()`) where
 * time-based rules must be testable, such as session expiry.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };
