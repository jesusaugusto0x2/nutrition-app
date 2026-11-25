import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreatePatientInput,
  PATIENT_ADDRESS_MAX_LENGTH,
  PATIENT_NAME_MAX_LENGTH,
  PATIENT_PHONE_MAX_LENGTH,
  type Patient,
  createPatientSchema,
  todayIsoDate,
} from '@nutri/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ChoiceField } from '@/components/ui/choice-field';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { FormAlert, SuccessNotice } from '@/components/ui/notice';
import { t } from '@/i18n';
import { formatDate } from '@/lib/format';
import { parseDateInput } from '@/lib/parse';
import { useCreatePatient, useUpdatePatient } from '../api';

/**
 * The shared schema decides the rules; the date arrives as `dd/mm/aaaa`
 * text (parsed with lib/parse, never by hand) and leaves as `YYYY-MM-DD`.
 * Refine messages are codes the form maps to Spanish texts.
 */
const patientFormSchema = createPatientSchema.extend({
  birthDate: z
    .string()
    .refine((value) => parseDateInput(value) !== null, { message: 'invalid' })
    .refine(
      (value) => {
        const iso = parseDateInput(value);
        return iso !== null && iso <= todayIsoDate();
      },
      { message: 'future' },
    )
    .transform((value) => parseDateInput(value) as string),
});

function nameError(value: string, required: string): string {
  return value.trim()
    ? t.patients.form.tooLong(PATIENT_NAME_MAX_LENGTH)
    : required;
}

function birthDateError(value: string, code: string | undefined): string {
  if (!value.trim()) {
    return t.patients.form.birthDateRequired;
  }
  return code === 'future'
    ? t.patients.form.birthDateFuture
    : t.patients.form.birthDateInvalid;
}

/**
 * Create and edit patient (spec §8): the same form in both modes. After
 * creating it navigates to the new profile; after editing it stays and
 * shows the success notice, which the next change clears.
 */
export function PatientForm({ patient }: { patient?: Patient }) {
  const editing = patient !== undefined;
  const navigate = useNavigate();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient(patient?.id ?? '');
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      firstName: patient?.firstName ?? '',
      lastName: patient?.lastName ?? '',
      birthDate: patient ? formatDate(patient.birthDate) : '',
      sex: patient?.sex,
      phone: patient?.phone ?? '',
      address: patient?.address ?? '',
    },
  });

  const onSubmit = async (values: CreatePatientInput) => {
    setFailure(null);
    setSaved(false);
    try {
      if (editing) {
        await updatePatient.mutateAsync(values);
        setSaved(true);
      } else {
        const created = await createPatient.mutateAsync(values);
        void navigate({
          to: '/patients/$patientId',
          params: { patientId: created.id },
          state: { patientCreated: true },
        });
      }
    } catch {
      setFailure(
        editing ? t.patients.form.updateFailed : t.patients.form.createFailed,
      );
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      onChange={() => setSaved(false)}
      className="flex flex-col gap-[18px]"
    >
      {failure && <FormAlert title={t.common.errorTitle}>{failure}</FormAlert>}
      {saved && !failure && (
        <SuccessNotice>{t.patients.form.updated}</SuccessNotice>
      )}

      <Controller
        name="firstName"
        control={control}
        render={({ field, fieldState }) => (
          <FormField
            label={t.patients.form.firstName}
            error={
              fieldState.error &&
              nameError(field.value, t.patients.form.firstNameRequired)
            }
          >
            {(controlProps) => (
              <Input
                {...controlProps}
                {...field}
                size="lg"
                autoComplete="given-name"
              />
            )}
          </FormField>
        )}
      />

      <Controller
        name="lastName"
        control={control}
        render={({ field, fieldState }) => (
          <FormField
            label={t.patients.form.lastName}
            error={
              fieldState.error &&
              nameError(field.value, t.patients.form.lastNameRequired)
            }
          >
            {(controlProps) => (
              <Input
                {...controlProps}
                {...field}
                size="lg"
                autoComplete="family-name"
              />
            )}
          </FormField>
        )}
      />

      <Controller
        name="birthDate"
        control={control}
        render={({ field, fieldState }) => (
          <FormField
            label={t.patients.birthDate}
            error={
              fieldState.error &&
              birthDateError(field.value, fieldState.error.message)
            }
          >
            {(controlProps) => (
              <Input
                {...controlProps}
                {...field}
                size="lg"
                inputMode="numeric"
                placeholder={t.forms.datePlaceholder}
              />
            )}
          </FormField>
        )}
      />

      <Controller
        name="sex"
        control={control}
        render={({ field, fieldState }) => (
          <ChoiceField
            label={t.patients.form.sex}
            options={[
              { value: 'female', label: t.patients.sex.female },
              { value: 'male', label: t.patients.sex.male },
            ]}
            value={field.value ?? null}
            onChange={(value) => {
              setSaved(false);
              field.onChange(value);
            }}
            error={fieldState.error && t.patients.form.sexRequired}
          />
        )}
      />

      <Controller
        name="phone"
        control={control}
        render={({ field, fieldState }) => (
          <FormField
            label={t.patients.phone}
            error={
              fieldState.error &&
              t.patients.form.tooLong(PATIENT_PHONE_MAX_LENGTH)
            }
          >
            {(controlProps) => (
              <Input
                {...controlProps}
                {...field}
                value={field.value ?? ''}
                size="lg"
                type="tel"
                autoComplete="tel"
              />
            )}
          </FormField>
        )}
      />

      <Controller
        name="address"
        control={control}
        render={({ field, fieldState }) => (
          <FormField
            label={t.patients.address}
            error={
              fieldState.error &&
              t.patients.form.tooLong(PATIENT_ADDRESS_MAX_LENGTH)
            }
          >
            {(controlProps) => (
              <Input
                {...controlProps}
                {...field}
                value={field.value ?? ''}
                size="lg"
                autoComplete="street-address"
              />
            )}
          </FormField>
        )}
      />

      <Button
        type="submit"
        size="lg"
        fullWidth
        disabled={formState.isSubmitting}
      >
        {editing ? t.patients.form.submitEdit : t.patients.form.submitCreate}
      </Button>
    </form>
  );
}
