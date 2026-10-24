import type { Consultation } from '@nutri/schemas';
import { calculateBmi } from '@nutri/utils';
import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { formatDate, formatQuantity, unitOf } from '@/lib/format';
import { parseDecimalInput } from '@/lib/parse';
import { cn } from '@/lib/utils';
import {
  columnHeader,
  latestHeight,
  type MeasureColumn,
  measureColumns,
  type MeasureKey,
} from '../measurements';
import {
  draftFrom,
  readDraft,
  type RecordDraft,
  type RecordValues,
} from '../record-draft';
import { buildRecordRows, type RecordRow, totalChanges } from '../records';
import { ChangeText } from './change-text';

export interface RecordsEditingProps {
  /** Record being corrected, if any. */
  editingId: string | null;
  /** Starts (id) or cancels (`null`) a correction. */
  onEdit: (id: string | null) => void;
  onSave: (id: string, values: RecordValues) => void;
}

interface RecordsTableProps extends RecordsEditingProps {
  /** Every consultation of the patient, most recent first. */
  consultations: readonly Consultation[];
  /** Rows shown (pagination); totals always use every consultation. */
  range?: readonly [start: number, end: number];
  className?: string;
}

/** Horizontal padding of the first and last cells of every row. */
const edges = '[&>:first-child]:pl-6 [&>:last-child]:pr-6';

/**
 * Spec 28: every consultation of a patient, most recent first, each value
 * with its change against the previous one, and a fixed «Cambio total»
 * footer. Scrolls horizontally below 940 px; phones use `RecordCard`.
 */
export function RecordsTable({
  consultations,
  range,
  editingId,
  onEdit,
  onSave,
  className,
}: RecordsTableProps) {
  const rows = buildRecordRows(consultations);
  const visible = range ? rows.slice(range[0], range[1]) : rows;
  const totals = totalChanges(consultations);
  const oldest = consultations[consultations.length - 1];
  const newest = consultations[0];
  const fallbackHeight = latestHeight(consultations);

  return (
    <div
      role="region"
      aria-label={t.consultations.records}
      tabIndex={0}
      className={cn('overflow-x-auto', className)}
    >
      <table className="w-full min-w-[940px] table-fixed border-collapse">
        <colgroup>
          <col className="w-[174px]" />
          {measureColumns.map((column) => (
            <col key={column.key} />
          ))}
          <col className="w-[174px]" />
        </colgroup>
        <thead>
          <tr
            className={cn(
              edges,
              'border-y bg-surface-muted text-sm font-bold tracking-wide text-muted-foreground uppercase [&>*]:py-2.5 [&>*]:align-bottom',
            )}
          >
            <th scope="col" className="text-left">
              {t.consultations.date}
            </th>
            {measureColumns.map((column) => (
              <th key={column.key} scope="col" className="px-1 text-center">
                {columnHeader(column)}
              </th>
            ))}
            <td />
          </tr>
        </thead>
        <tbody>
          {visible.map((row) =>
            row.consultation.id === editingId ? (
              <EditingRow
                key={row.consultation.id}
                row={row}
                fallbackHeightM={fallbackHeight}
                onCancel={() => onEdit(null)}
                onSave={(values) => onSave(row.consultation.id, values)}
              />
            ) : (
              <ReadingRow
                key={row.consultation.id}
                row={row}
                onEdit={() => onEdit(row.consultation.id)}
              />
            ),
          )}
        </tbody>
        {oldest && newest && consultations.length > 1 && (
          <tfoot>
            <tr
              className={cn(
                edges,
                'h-[72px] border-t-2 border-input bg-background',
              )}
            >
              <th scope="row" className="text-left leading-tight">
                <span className="block font-bold">
                  {t.consultations.totalChange}
                </span>
                <span className="block text-[13px] font-normal text-muted-foreground">
                  {t.consultations.totalRange(
                    formatDate(oldest.date),
                    formatDate(newest.date),
                  )}
                </span>
              </th>
              {totals.map(({ column, change }) => (
                <td key={column.key} className="text-center text-lg">
                  {change === null ? (
                    t.common.notAvailable
                  ) : (
                    <ChangeText change={change} quantity={column.quantity} />
                  )}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function rowTag(row: RecordRow): string | null {
  if (row.isLatest) return t.consultations.latest;
  if (row.isFirst) return t.consultations.first;
  return null;
}

function ReadingRow({ row, onEdit }: { row: RecordRow; onEdit: () => void }) {
  const date = formatDate(row.consultation.date);
  const tag = rowTag(row);

  return (
    <tr className={cn(edges, 'h-[76px] border-b border-divider')}>
      <th scope="row" className="text-left">
        <span className="block font-bold">{date}</span>
        {tag && (
          <span className="block text-sm font-normal text-muted-foreground">
            {tag}
          </span>
        )}
      </th>
      {row.cells.map(({ column, value, change }) => (
        <td key={column.key} className="text-center leading-tight">
          <span className="block text-[19px] font-bold">
            {value === null
              ? t.common.notAvailable
              : formatQuantity(value, column.quantity)}
          </span>
          <span className="block text-sm">
            {change !== null ? (
              <ChangeText change={change} quantity={column.quantity} />
            ) : (
              row.isFirst &&
              value !== null && (
                <span className="font-bold text-muted-foreground">
                  {t.consultations.initial}
                </span>
              )
            )}
          </span>
        </td>
      ))}
      <td className="text-right">
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          aria-label={t.consultations.editOf(date)}
          className="text-primary"
        >
          <PencilIcon aria-hidden className="size-4" />
          {t.consultations.edit}
        </Button>
      </td>
    </tr>
  );
}

/** Label for an input of a column, e.g. «Peso en kg». */
export function inputLabel(column: MeasureColumn): string {
  return t.consultations.inUnit(column.label, unitOf(column.quantity));
}

/** Live BMI of a draft with the patient's latest height. */
export function draftBmi(
  draft: RecordDraft,
  fallbackHeightM: number | null,
  heightM: number | null,
): string {
  const weight = parseDecimalInput(draft.weightKg);
  const height = heightM ?? fallbackHeightM;
  return weight && weight > 0 && height
    ? formatQuantity(calculateBmi(weight, height), 'bmi')
    : t.common.notAvailable;
}

function EditingRow({
  row,
  fallbackHeightM,
  onCancel,
  onSave,
}: {
  row: RecordRow;
  fallbackHeightM: number | null;
  onCancel: () => void;
  onSave: (values: RecordValues) => void;
}) {
  const [draft, setDraft] = useState(() => draftFrom(row.consultation));
  const values = readDraft(draft);
  const set = (key: keyof RecordDraft) => (text: string) =>
    setDraft((current) => ({ ...current, [key]: text }));

  return (
    <tr
      className={cn(
        edges,
        'h-[120px] border-b border-divider bg-primary-soft [&>*]:px-1 [&>*]:py-3',
      )}
    >
      <td>
        <Input
          size="table"
          inputMode="numeric"
          aria-label={t.consultations.date}
          value={draft.date}
          onChange={(event) => set('date')(event.target.value)}
          className="text-base font-bold"
        />
      </td>
      {row.cells.map(({ column }) =>
        column.key === 'bmi' ? (
          <td key={column.key} className="text-center">
            <output className="text-lg font-bold text-muted-foreground">
              {draftBmi(draft, fallbackHeightM, row.consultation.heightM)}
            </output>
          </td>
        ) : (
          <td key={column.key}>
            <Input
              size="table"
              inputMode="decimal"
              aria-label={inputLabel(column)}
              value={draft[column.key as MeasureKey]}
              onChange={(event) =>
                set(column.key as MeasureKey)(event.target.value)
              }
              className="text-center font-bold"
            />
          </td>
        ),
      )}
      <td>
        <div className="flex flex-col gap-1.5">
          <Button
            size="sm"
            disabled={values === null}
            onClick={() => values && onSave(values)}
          >
            {t.consultations.save}
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancel}>
            {t.consultations.cancel}
          </Button>
        </div>
      </td>
    </tr>
  );
}
