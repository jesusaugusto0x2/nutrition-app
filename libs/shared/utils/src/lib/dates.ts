export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a `YYYY-MM-DD` calendar date without involving time zones.
 *
 * @throws RangeError when the string is not a real calendar date.
 */
export function parseIsoDate(value: string): CalendarDate {
  const match = ISO_DATE.exec(value);
  if (match) {
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return { year, month, day };
    }
  }
  throw new RangeError(`Invalid ISO date: ${value}`);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (toUtcMs(parseIsoDate(to)) - toUtcMs(parseIsoDate(from))) / msPerDay;
}

function toUtcMs({ year, month, day }: CalendarDate): number {
  return Date.UTC(year, month - 1, day);
}
