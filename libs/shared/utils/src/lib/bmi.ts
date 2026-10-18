import { roundTo } from './rounding.js';

/**
 * Body mass index: weight (kg) / height (m)². Rounded to one decimal, the
 * usual clinical precision.
 *
 * @throws RangeError when either value is not a finite positive number.
 */
export function calculateBmi(weightKg: number, heightM: number): number {
  assertPositive(weightKg, 'weightKg');
  assertPositive(heightM, 'heightM');
  return roundTo(weightKg / heightM ** 2, 1);
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number`);
  }
}
