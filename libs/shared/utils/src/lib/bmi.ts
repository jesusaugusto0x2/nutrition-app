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

/**
 * WHO adult BMI categories. Not valid for minors, whose BMI is read by
 * percentile for age and sex (see `isMinor`).
 */
export type BmiCategory =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obesity1'
  | 'obesity2'
  | 'obesity3';

/** Adult BMI category: < 18.5, < 25, < 30, < 35, < 40, 40 or more. */
export function classifyBmi(bmi: number): BmiCategory {
  assertPositive(bmi, 'bmi');
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  if (bmi < 35) return 'obesity1';
  if (bmi < 40) return 'obesity2';
  return 'obesity3';
}
