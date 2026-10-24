import type { Consultation } from '@nutri/schemas';
import { formatDate, formatQuantity } from '@/lib/format';
import { parseDateInput, parseDecimalInput } from '@/lib/parse';
import type { MeasureKey } from './measurements';

/** Text typed while correcting a record, one entry per editable field. */
export type RecordDraft = Record<'date' | MeasureKey, string>;

/** Corrected values, ready to send. Empty measurements become `null`. */
export interface RecordValues {
  date: string;
  weightKg: number;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
  hipCm: number | null;
}

/** Draft pre-filled with a record, formatted as the user reads it. */
export function draftFrom(consultation: Consultation): RecordDraft {
  const length = (value: number | null) =>
    value === null ? '' : formatQuantity(value, 'length');
  return {
    date: formatDate(consultation.date),
    weightKg: formatQuantity(consultation.weightKg, 'weight'),
    armCm: length(consultation.armCm),
    waistCm: length(consultation.waistCm),
    legCm: length(consultation.legCm),
    hipCm: length(consultation.hipCm),
  };
}

/**
 * Values of a draft, or `null` while it cannot be saved: the date and a
 * positive weight are required, and filled measurements must be numbers.
 */
export function readDraft(draft: RecordDraft): RecordValues | null {
  const date = parseDateInput(draft.date);
  const weightKg = parseDecimalInput(draft.weightKg);
  if (date === null || weightKg === null || weightKg <= 0) {
    return null;
  }

  const lengths = {} as Pick<RecordValues, Exclude<MeasureKey, 'weightKg'>>;
  for (const key of ['armCm', 'waistCm', 'legCm', 'hipCm'] as const) {
    if (draft[key].trim() === '') {
      lengths[key] = null;
      continue;
    }
    const value = parseDecimalInput(draft[key]);
    if (value === null || value <= 0) {
      return null;
    }
    lengths[key] = value;
  }

  return { date, weightKg, ...lengths };
}
