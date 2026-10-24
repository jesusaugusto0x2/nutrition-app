import { todayIsoDate } from '@nutri/schemas';
import { parseIsoDate } from './dates.js';

/**
 * Age in completed years on `referenceDate` (default: today, UTC). Dates are
 * `YYYY-MM-DD`. Someone born on 29 February turns a year older on 1 March in
 * non-leap years.
 *
 * @throws RangeError for invalid dates or a reference date before birth.
 */
export function calculateAge(
  birthDate: string,
  referenceDate: string = todayIsoDate(),
): number {
  const birth = parseIsoDate(birthDate);
  const reference = parseIsoDate(referenceDate);
  if (referenceDate < birthDate) {
    throw new RangeError('referenceDate cannot be before birthDate');
  }

  const hadBirthdayThisYear =
    reference.month > birth.month ||
    (reference.month === birth.month && reference.day >= birth.day);
  return reference.year - birth.year - (hadBirthdayThisYear ? 0 : 1);
}

/** Age at which BMI is read with adult categories instead of percentiles. */
export const ADULT_AGE = 18;

/** Whether the patient is a minor on `referenceDate` (default: today). */
export function isMinor(
  birthDate: string,
  referenceDate: string = todayIsoDate(),
): boolean {
  return calculateAge(birthDate, referenceDate) < ADULT_AGE;
}
