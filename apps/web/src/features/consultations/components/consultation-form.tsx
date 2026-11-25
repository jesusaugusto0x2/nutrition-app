import type { Consultation } from '@nutri/schemas';
import { todayIsoDate } from '@nutri/schemas';
import { diffConsultations } from '@nutri/utils';
import { Link, useNavigate } from '@tanstack/react-router';
import { type ChangeEvent, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { FormAlert } from '@/components/ui/notice';
import { Textarea } from '@/components/ui/textarea';
import { UnitInput } from '@/components/ui/unit-input';
import { t } from '@/i18n';
import {
  formatDate,
  formatQuantityWithUnit,
  type Quantity,
} from '@/lib/format';
import { parseDecimalInput } from '@/lib/parse';
import { useCreateConsultation, useUpdateConsultation } from '../api';
import {
  type ConsultationFormDraft,
  consultationFormDraftFrom,
  emptyConsultationFormDraft,
  readConsultationFormDraft,
  readConsultationFormMeasures,
} from '../record-draft';
import { ChangeText } from './change-text';

interface ConsultationFormProps {
  patientId: string;
  /** Edit mode when present. */
  consultation?: Consultation;
  /** The consultation before this one: hints and live diffs against it. */
  previous?: Consultation;
}

/**
 * New and edit consultation (spec §9.4): date defaults to today, every
 * measure shows the previous value and a live diff while typing, and saving
 * stays disabled until at least the weight is filled. Both modes navigate
 * back to the profile with the saved notice.
 */
export function ConsultationForm({
  patientId,
  consultation,
  previous,
}: ConsultationFormProps) {
  const editing = consultation !== undefined;
  const navigate = useNavigate();
  const createConsultation = useCreateConsultation(patientId);
  const updateConsultation = useUpdateConsultation(
    patientId,
    consultation?.id ?? '',
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConsultationFormDraft>(() =>
    consultation
      ? consultationFormDraftFrom(consultation)
      : emptyConsultationFormDraft(),
  );

  const set =
    (key: keyof ConsultationFormDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((current) => ({ ...current, [key]: event.target.value }));

  // Live diff against the previous consultation, only once the draft has a
  // usable date and weight (diffConsultations throws on a negative span).
  const measures = readConsultationFormMeasures(draft);
  const diff =
    previous &&
    measures.date !== null &&
    measures.weightKg !== null &&
    measures.date >= previous.date
      ? diffConsultations(previous, {
          date: measures.date,
          weightKg: measures.weightKg,
          heightM: measures.heightM,
          armCm: measures.armCm,
          waistCm: measures.waistCm,
          legCm: measures.legCm,
          hipCm: measures.hipCm,
        })
      : null;

  const values = readConsultationFormDraft(draft);
  const weight = parseDecimalInput(draft.weightKg);
  const weightMissing = weight === null || weight <= 0;

  const previousHint = (value: number | null, quantity: Quantity) =>
    value === null
      ? undefined
      : t.consultations.previous(formatQuantityWithUnit(value, quantity));

  const liveDiff = (
    change: number | null,
    quantity: Quantity,
    withDays = false,
  ) =>
    change === null ? undefined : (
      <span>
        <ChangeText change={change} quantity={quantity} />
        {withDays && diff && (
          <span className="text-muted-foreground">
            {' '}
            {t.consultations.sincePrevious(diff.days)}
          </span>
        )}
      </span>
    );

  const onSubmit = async () => {
    if (values === null) {
      return;
    }
    setFailure(null);
    try {
      if (editing) {
        await updateConsultation.mutateAsync(values);
      } else {
        await createConsultation.mutateAsync(values);
      }
      void navigate({
        to: '/patients/$patientId',
        params: { patientId },
        state: { notice: 'consultation-saved' },
      });
    } catch {
      setFailure(t.consultations.saveFailed);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      className="flex flex-col gap-[18px]"
    >
      {failure && <FormAlert title={t.common.errorTitle}>{failure}</FormAlert>}

      <FormField label={t.consultations.date}>
        {(controlProps) => (
          <div className="flex items-center gap-3">
            <Input
              {...controlProps}
              size="lg"
              inputMode="numeric"
              placeholder={t.forms.datePlaceholder}
              value={draft.date}
              onChange={set('date')}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  date: formatDate(todayIsoDate()),
                }))
              }
            >
              {t.consultations.today}
            </Button>
          </div>
        )}
      </FormField>

      <FormField
        label={t.consultations.weight}
        hint={previousHint(previous?.weightKg ?? null, 'weight')}
        description={liveDiff(diff?.weightKg ?? null, 'weight', true)}
      >
        {(controlProps) => (
          <UnitInput
            {...controlProps}
            variant="featured"
            unit={t.units.kilograms}
            placeholder="0,0"
            value={draft.weightKg}
            onChange={set('weightKg')}
          />
        )}
      </FormField>

      <FormField
        label={t.consultations.height}
        hint={previousHint(previous?.heightM ?? null, 'height')}
      >
        {(controlProps) => (
          <UnitInput
            {...controlProps}
            unit={t.units.meters}
            placeholder="0,00"
            value={draft.heightM}
            onChange={set('heightM')}
          />
        )}
      </FormField>

      <div className="grid gap-[18px] sm:grid-cols-2">
        {(
          [
            ['armCm', t.consultations.arm, previous?.armCm ?? null],
            ['waistCm', t.consultations.waist, previous?.waistCm ?? null],
            ['legCm', t.consultations.leg, previous?.legCm ?? null],
            ['hipCm', t.consultations.hip, previous?.hipCm ?? null],
          ] as const
        ).map(([key, label, previousValue]) => (
          <FormField
            key={key}
            label={label}
            hint={previousHint(previousValue, 'length')}
            description={liveDiff(diff?.[key] ?? null, 'length')}
          >
            {(controlProps) => (
              <UnitInput
                {...controlProps}
                variant="measure"
                unit={t.units.centimeters}
                placeholder="0"
                value={draft[key]}
                onChange={set(key)}
              />
            )}
          </FormField>
        ))}
      </div>

      <FormField label={t.consultations.notes}>
        {(controlProps) => (
          <Textarea
            {...controlProps}
            value={draft.notes}
            onChange={set('notes')}
          />
        )}
      </FormField>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={values === null}>
            {t.consultations.saveConsultation}
          </Button>
          <Link
            to="/patients/$patientId"
            params={{ patientId }}
            className={buttonVariants({ variant: 'secondary', size: 'lg' })}
          >
            {t.consultations.cancel}
          </Link>
        </div>
        {weightMissing && (
          <p className="m-0 text-meta text-muted-foreground">
            {t.consultations.weightRequired}
          </p>
        )}
      </div>
    </form>
  );
}
