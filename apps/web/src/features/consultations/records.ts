import type { Consultation } from '@nutri/schemas';
import {
  columnValue,
  latestHeight,
  type MeasureColumn,
  measureColumns,
} from './measurements';

export interface RecordCell {
  column: MeasureColumn;
  value: number | null;
  /** Change against the previous consultation; `null` when unknown. */
  change: number | null;
}

export interface RecordRow {
  consultation: Consultation;
  cells: RecordCell[];
  isLatest: boolean;
  isFirst: boolean;
}

/**
 * Rows of the records table, most recent first (the order the API returns),
 * each value with its change against the consultation before it.
 */
export function buildRecordRows(
  consultations: readonly Consultation[],
): RecordRow[] {
  const fallbackHeight = latestHeight(consultations);

  return consultations.map((consultation, index) => {
    const previous = consultations[index + 1];
    return {
      consultation,
      isLatest: index === 0,
      isFirst: index === consultations.length - 1,
      cells: measureColumns.map((column) => {
        const value = columnValue(column, consultation, fallbackHeight);
        const before = previous
          ? columnValue(column, previous, fallbackHeight)
          : null;
        return {
          column,
          value,
          change: value !== null && before !== null ? value - before : null,
        };
      }),
    };
  });
}

export interface TotalChange {
  column: MeasureColumn;
  change: number | null;
}

/**
 * Change of every column from the first to the last consultation where it
 * was recorded. Independent of pagination.
 */
export function totalChanges(
  consultations: readonly Consultation[],
): TotalChange[] {
  const fallbackHeight = latestHeight(consultations);

  return measureColumns.map((column) => {
    const values = consultations
      .map((consultation) => columnValue(column, consultation, fallbackHeight))
      .filter((value): value is number => value !== null);
    // Most recent first: the newest value is first, the oldest last.
    const newest = values[0];
    const oldest = values[values.length - 1];
    return {
      column,
      change:
        values.length > 1 && newest !== undefined && oldest !== undefined
          ? newest - oldest
          : null,
    };
  });
}
