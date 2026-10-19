import { locale } from '@/i18n';

/**
 * Display formatting helpers. Components must use these instead of
 * formatting dates or numbers by hand.
 */

/**
 * `YYYY-MM-DD` (calendar date) or an ISO date-time to `dd/mm/aaaa`.
 * Calendar dates are not shifted by time zone; date-times use local time.
 */
export function formatDate(value: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${value}`);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Decimal number with comma separator, e.g. `74,9`. */
export function formatDecimal(value: number, fractionDigits = 1): string {
  return numberFormat(fractionDigits).format(value);
}

/** Signed change, e.g. `+1,2` / `-0,9` / `0`. */
export function formatChange(value: number, fractionDigits = 1): string {
  return numberFormat(fractionDigits, 'exceptZero').format(value);
}

/** Number followed by its unit, e.g. `74,9 kg`. */
export function formatMeasurement(
  value: number,
  unit: string,
  fractionDigits = 1,
): string {
  return `${formatDecimal(value, fractionDigits)} ${unit}`;
}

const formatters = new Map<string, Intl.NumberFormat>();

function numberFormat(
  fractionDigits: number,
  signDisplay: Intl.NumberFormatOptions['signDisplay'] = 'auto',
): Intl.NumberFormat {
  const key = `${fractionDigits}:${signDisplay}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
      signDisplay,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}
