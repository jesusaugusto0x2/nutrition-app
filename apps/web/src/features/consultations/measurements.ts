import type { Consultation } from '@nutri/schemas';
import { calculateBmi } from '@nutri/utils';
import { t } from '@/i18n';
import { type Quantity, unitOf } from '@/lib/format';

/** Measurement fields the user records in every consultation. */
export type MeasureKey = 'weightKg' | 'armCm' | 'waistCm' | 'legCm' | 'hipCm';

export interface MeasureColumn {
  key: MeasureKey | 'bmi';
  label: string;
  quantity: Quantity;
}

/** Columns of the records table and cells of the record card, in order. */
export const measureColumns: readonly MeasureColumn[] = [
  { key: 'weightKg', label: t.consultations.weight, quantity: 'weight' },
  { key: 'bmi', label: t.consultations.bmi, quantity: 'bmi' },
  { key: 'armCm', label: t.consultations.arm, quantity: 'length' },
  { key: 'waistCm', label: t.consultations.waist, quantity: 'length' },
  { key: 'legCm', label: t.consultations.leg, quantity: 'length' },
  { key: 'hipCm', label: t.consultations.hip, quantity: 'length' },
];

/** Header text with its unit, e.g. «Peso (kg)»; BMI has none. */
export function columnHeader(column: MeasureColumn): string {
  return column.key === 'bmi'
    ? column.label
    : t.consultations.withUnit(column.label, unitOf(column.quantity));
}

/**
 * Most recent height recorded, used for consultations without one (height
 * is usually measured once). Expects consultations most recent first.
 */
export function latestHeight(
  consultations: readonly Pick<Consultation, 'heightM'>[],
): number | null {
  return consultations.find((c) => c.heightM !== null)?.heightM ?? null;
}

/** BMI of a consultation, with its own height or the fallback. */
export function bmiOf(
  consultation: Pick<Consultation, 'weightKg' | 'heightM'>,
  fallbackHeightM: number | null,
): number | null {
  const height = consultation.heightM ?? fallbackHeightM;
  return height === null ? null : calculateBmi(consultation.weightKg, height);
}

/** Value of a column for a consultation; `null` when not recorded. */
export function columnValue(
  column: MeasureColumn,
  consultation: Consultation,
  fallbackHeightM: number | null,
): number | null {
  return column.key === 'bmi'
    ? bmiOf(consultation, fallbackHeightM)
    : consultation[column.key];
}
