import { z } from 'zod';

export const idSchema = z.uuid();

/** Calendar date as `YYYY-MM-DD` (no time, no timezone). */
export const isoDateSchema = z.iso.date();

/** Instant in time as an ISO 8601 UTC string, e.g. `2026-01-31T12:00:00.000Z`. */
export const isoDateTimeSchema = z.iso.datetime();

export const timestampsSchema = z.object({
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

/** Today's calendar date in UTC as `YYYY-MM-DD`. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const notInFutureDateSchema = isoDateSchema.refine(
  (value) => value <= todayIsoDate(),
  { error: 'Date cannot be in the future' },
);

/** Optional free text that is stored as NULL when omitted or blank. */
export function optionalTextSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();
}
