import type { Consultation } from '@nutri/schemas';
import { calculateBmi } from './bmi.js';
import { daysBetween } from './dates.js';
import { roundTo } from './rounding.js';

export type ConsultationMeasurements = Pick<
  Consultation,
  'date' | 'weightKg' | 'heightM' | 'armCm' | 'waistCm' | 'legCm' | 'hipCm'
>;

/**
 * Change from `previous` to `current` (current minus previous). A field is
 * `null` when it is missing in either consultation. Deltas are rounded to the
 * precision stored in the database to avoid floating point noise.
 */
export interface ConsultationDiff {
  days: number;
  weightKg: number;
  heightM: number | null;
  bmi: number | null;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
  hipCm: number | null;
}

/**
 * @throws RangeError when `current` is dated before `previous`.
 */
export function diffConsultations(
  previous: ConsultationMeasurements,
  current: ConsultationMeasurements,
): ConsultationDiff {
  const days = daysBetween(previous.date, current.date);
  if (days < 0) {
    throw new RangeError('current consultation is dated before previous');
  }

  return {
    days,
    weightKg: roundTo(current.weightKg - previous.weightKg, 2),
    heightM: delta(previous.heightM, current.heightM, 2),
    bmi: delta(bmiOf(previous), bmiOf(current), 1),
    armCm: delta(previous.armCm, current.armCm, 1),
    waistCm: delta(previous.waistCm, current.waistCm, 1),
    legCm: delta(previous.legCm, current.legCm, 1),
    hipCm: delta(previous.hipCm, current.hipCm, 1),
  };
}

function delta(
  previous: number | null,
  current: number | null,
  decimals: number,
): number | null {
  return previous === null || current === null
    ? null
    : roundTo(current - previous, decimals);
}

function bmiOf(consultation: ConsultationMeasurements): number | null {
  return consultation.heightM === null
    ? null
    : calculateBmi(consultation.weightKg, consultation.heightM);
}
