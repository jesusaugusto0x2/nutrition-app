import type { Consultation } from '@nutri/schemas';
import { todayIsoDate } from '@nutri/schemas';
import { formatDate, formatQuantity } from '@/lib/format';
import {
  parseDateInput,
  parseDecimalInput,
  parseHeightInput,
} from '@/lib/parse';
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

/**
 * Text typed in the full consultation form (the new/edit pages): every
 * record field plus height and notes, one string per input.
 */
export type ConsultationFormDraft = Record<
  'date' | 'heightM' | 'notes' | MeasureKey,
  string
>;

/** Values of the full form, ready to send. Empty fields become `null`. */
export interface ConsultationFormValues {
  date: string;
  weightKg: number;
  heightM: number | null;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
  hipCm: number | null;
  notes: string | null;
}

/** Empty draft for a new consultation, dated today. */
export function emptyConsultationFormDraft(): ConsultationFormDraft {
  return {
    date: formatDate(todayIsoDate()),
    weightKg: '',
    heightM: '',
    armCm: '',
    waistCm: '',
    legCm: '',
    hipCm: '',
    notes: '',
  };
}

/** Draft pre-filled with a consultation, formatted as the user reads it. */
export function consultationFormDraftFrom(
  consultation: Consultation,
): ConsultationFormDraft {
  return {
    ...draftFrom(consultation),
    heightM:
      consultation.heightM === null
        ? ''
        : formatQuantity(consultation.heightM, 'height'),
    notes: consultation.notes ?? '',
  };
}

/**
 * Per-field parses of a form draft, without the all-or-nothing rule: the
 * live diffs read each measurement as it is typed.
 */
export interface ConsultationFormMeasures {
  date: string | null;
  weightKg: number | null;
  heightM: number | null;
  armCm: number | null;
  waistCm: number | null;
  legCm: number | null;
  hipCm: number | null;
}

export function readConsultationFormMeasures(
  draft: ConsultationFormDraft,
): ConsultationFormMeasures {
  const length = (text: string) =>
    text.trim() === '' ? null : parseDecimalInput(text);
  return {
    date: parseDateInput(draft.date),
    weightKg: parseDecimalInput(draft.weightKg),
    heightM:
      draft.heightM.trim() === '' ? null : parseHeightInput(draft.heightM),
    armCm: length(draft.armCm),
    waistCm: length(draft.waistCm),
    legCm: length(draft.legCm),
    hipCm: length(draft.hipCm),
  };
}

/**
 * Values of a full form draft, or `null` while it cannot be saved: a valid
 * date and a positive weight are required, filled measurements must be
 * positive numbers and the height a plausible one.
 */
export function readConsultationFormDraft(
  draft: ConsultationFormDraft,
): ConsultationFormValues | null {
  const record = readDraft(draft);
  if (record === null) {
    return null;
  }
  const heightM =
    draft.heightM.trim() === '' ? null : parseHeightInput(draft.heightM);
  if (draft.heightM.trim() !== '' && heightM === null) {
    return null;
  }
  const notes = draft.notes.trim();
  return { ...record, heightM, notes: notes === '' ? null : notes };
}
