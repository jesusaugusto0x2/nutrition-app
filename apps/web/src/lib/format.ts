import { locale, t } from '@/i18n';

/**
 * Display formatting helpers. Components must use these instead of
 * formatting dates or numbers by hand.
 */

/** Typographic minus (U+2212), used for every negative value shown. */
const MINUS = '−';

/**
 * `YYYY-MM-DD` (calendar date) or an ISO date-time to `dd/mm/aaaa`.
 * Calendar dates are not shifted by time zone; date-times use local time.
 */
export function formatDate(value: string): string {
  const [day, month, year] = dateParts(value);
  return `${day}/${month}/${year}`;
}

/** Short date for chart axes: `dd/mm`. */
export function formatShortDate(value: string): string {
  const [day, month] = dateParts(value);
  return `${day}/${month}`;
}

/** Decimal number with comma separator, e.g. `74,9`. */
export function formatDecimal(value: number, fractionDigits = 1): string {
  return withMinus(numberFormat(fractionDigits).format(value));
}

/** Signed change, e.g. `+1,2` / `−0,9` / `0,0`. */
export function formatChange(value: number, fractionDigits = 1): string {
  return withMinus(numberFormat(fractionDigits, 'exceptZero').format(value));
}

/** Number followed by its unit, e.g. `74,9 kg`. */
export function formatMeasurement(
  value: number,
  unit: string,
  fractionDigits = 1,
): string {
  return `${formatDecimal(value, fractionDigits)} ${unit}`;
}

/**
 * Kinds of values the app displays, each with its own precision (spec,
 * Formatos): kg with 1 decimal, m with 2, cm without decimals when whole,
 * BMI with 1 decimal.
 */
export type Quantity = 'weight' | 'height' | 'length' | 'bmi';

/** Value without unit at the precision of its quantity, e.g. `66,9`. */
export function formatQuantity(value: number, quantity: Quantity): string {
  return formatDecimal(value, fractionDigitsFor(value, quantity));
}

/** Value with its unit, e.g. `66,9 kg`, `1,62 m`, `85 cm`, `25,5 kg/m²`. */
export function formatQuantityWithUnit(
  value: number,
  quantity: Quantity,
): string {
  return `${formatQuantity(value, quantity)} ${unitOf(quantity)}`;
}

/**
 * Signed difference with its unit, e.g. `−2,0 kg`, `+0,5 cm`, `−7 cm`.
 * Weight keeps one decimal even when whole; lengths drop it.
 */
export function formatQuantityChange(
  value: number,
  quantity: Quantity,
): string {
  const digits = fractionDigitsFor(value, quantity);
  return `${formatChange(value, digits)} ${unitOf(quantity)}`;
}

/** Display unit of a quantity. */
export function unitOf(quantity: Quantity): string {
  const { units } = t;
  switch (quantity) {
    case 'weight':
      return units.kilograms;
    case 'height':
      return units.meters;
    case 'length':
      return units.centimeters;
    case 'bmi':
      return units.bmi;
  }
}

function fractionDigitsFor(value: number, quantity: Quantity): number {
  switch (quantity) {
    case 'weight':
    case 'bmi':
      return 1;
    case 'height':
      return 2;
    case 'length':
      return Number.isInteger(roundTenth(value)) ? 0 : 1;
  }
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function dateParts(value: string): [day: string, month: string, year: string] {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return [day, month, year];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${value}`);
  }
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getFullYear()),
  ];
}

function withMinus(formatted: string): string {
  return formatted.replace('-', MINUS);
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
