import type { Consultation } from '@nutri/schemas';
import { PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { columnHeader, latestHeight, type MeasureKey } from '../measurements';
import {
  draftFrom,
  readDraft,
  type RecordDraft,
  type RecordValues,
} from '../record-draft';
import { buildRecordRows, type RecordRow, totalChanges } from '../records';
import { ChangeText } from './change-text';
import { draftBmi, type RecordsEditingProps } from './records-table';

interface RecordCardsProps extends RecordsEditingProps {
  /** Every consultation of the patient, most recent first. */
  consultations: readonly Consultation[];
  range?: readonly [start: number, end: number];
  className?: string;
}

/**
 * Spec 29: the phone version of the records table, one card per
 * consultation. Same props as `RecordsTable`.
 */
export function RecordCards({
  consultations,
  range,
  editingId,
  onEdit,
  onSave,
  className,
}: RecordCardsProps) {
  const rows = buildRecordRows(consultations);
  const visible = range ? rows.slice(range[0], range[1]) : rows;
  const fallbackHeight = latestHeight(consultations);

  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {visible.map((row) => (
        <li key={row.consultation.id}>
          {row.consultation.id === editingId ? (
            <EditingCard
              row={row}
              fallbackHeightM={fallbackHeight}
              onCancel={() => onEdit(null)}
              onSave={(values) => onSave(row.consultation.id, values)}
            />
          ) : (
            <ReadingCard row={row} onEdit={() => onEdit(row.consultation.id)} />
          )}
        </li>
      ))}
    </ul>
  );
}

function CardHeading({ row }: { row: RecordRow }) {
  const tag = row.isLatest
    ? t.consultations.latest
    : row.isFirst
      ? t.consultations.first
      : null;
  return (
    <div className="flex flex-col">
      <h3 className="m-0 text-lg font-bold">
        {formatDate(row.consultation.date)}
      </h3>
      {tag && <span className="text-sm text-muted-foreground">{tag}</span>}
    </div>
  );
}

function ReadingCard({ row, onEdit }: { row: RecordRow; onEdit: () => void }) {
  return (
    <article className="flex flex-col gap-3.5 rounded-card border bg-surface p-4.5">
      <div className="flex items-start justify-between gap-3">
        <CardHeading row={row} />
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          aria-label={t.consultations.editOf(formatDate(row.consultation.date))}
          className="text-primary"
        >
          <PencilIcon aria-hidden className="size-4" />
          {t.consultations.edit}
        </Button>
      </div>
      <dl className="grid grid-cols-3 gap-x-2 gap-y-3">
        {row.cells.map(({ column, value, change }) => (
          <div key={column.key} className="flex flex-col leading-tight">
            <dt className="text-[13px] text-muted-foreground">
              {columnHeader(column)}
            </dt>
            <dd className="m-0 text-[19px] font-bold">
              {value === null
                ? t.common.notAvailable
                : formatQuantity(value, column.quantity)}
            </dd>
            <dd className="m-0 text-[13px] whitespace-nowrap">
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
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function EditingCard({
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
  const measures = row.cells.filter(({ column }) => column.key !== 'bmi');

  return (
    <article className="flex flex-col gap-3.5 rounded-card border-2 border-primary bg-surface p-4.5">
      <CardHeading row={row} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <label className="flex flex-col gap-1 text-sm font-bold">
          {t.consultations.date}
          <Input
            size="table"
            inputMode="numeric"
            value={draft.date}
            onChange={(event) => set('date')(event.target.value)}
          />
        </label>
        {measures.map(({ column }) => {
          const key = column.key as MeasureKey;
          return (
            <label key={key} className="flex flex-col gap-1 text-sm font-bold">
              {columnHeader(column)}
              <Input
                size="table"
                inputMode="decimal"
                value={draft[key]}
                onChange={(event) => set(key)(event.target.value)}
                className="font-bold"
              />
            </label>
          );
        })}
      </div>
      <p className="m-0 text-meta text-muted-foreground">
        {t.consultations.bmi}{' '}
        <output className="font-bold text-foreground">
          {draftBmi(draft, fallbackHeightM, row.consultation.heightM)}
        </output>
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={onCancel}>
          {t.consultations.cancel}
        </Button>
        <Button
          disabled={values === null}
          onClick={() => values && onSave(values)}
        >
          {t.consultations.save}
        </Button>
      </div>
    </article>
  );
}

/**
 * «Cambio total» card shown on phones above the bottom bar, with the same
 * six figures as the table footer.
 */
export function TotalChangeCard({
  consultations,
  className,
}: {
  consultations: readonly Consultation[];
  className?: string;
}) {
  const oldest = consultations[consultations.length - 1];
  const newest = consultations[0];
  if (!oldest || !newest || consultations.length < 2) {
    return null;
  }

  return (
    <section
      aria-label={t.consultations.totalChange}
      className={cn(
        'flex flex-col gap-2 rounded-card border-2 border-input bg-background p-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h3 className="m-0 font-bold">{t.consultations.totalChange}</h3>
        <span className="text-[13px] text-muted-foreground">
          {t.consultations.totalRange(
            formatDate(oldest.date),
            formatDate(newest.date),
          )}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-x-2 gap-y-1.5">
        {totalChanges(consultations).map(({ column, change }) => (
          <div key={column.key} className="flex flex-col leading-tight">
            <dt className="text-[13px] text-muted-foreground">
              {columnHeader(column)}
            </dt>
            <dd className="m-0 text-[17px]">
              {change === null ? (
                t.common.notAvailable
              ) : (
                <ChangeText change={change} quantity={column.quantity} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
