import { useId, type ReactNode } from 'react';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { cn } from '@/lib/utils';

/** Props the control must spread so label, help and error reach it. */
export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FormFieldProps {
  label: ReactNode;
  /** Short text beside the label, e.g. «se calcula sola», «Anterior: 66,9 kg». */
  hint?: ReactNode;
  /** Help below the control. */
  description?: ReactNode;
  /** Error message; set it only after a submit attempt. */
  error?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Visible label above the control, tied by `for`/`id`, with help and error
 * linked through `aria-describedby` (spec: Formularios). Works with React
 * Hook Form's `Controller`:
 *
 * ```tsx
 * <FormField label={t.patients.phone} error={fieldState.error?.message}>
 *   {(control) => <Input {...control} {...field} type="tel" />}
 * </FormField>
 * ```
 */
export function FormField({
  label,
  hint,
  description,
  error,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <div
        className={cn(
          'flex flex-wrap items-baseline gap-x-2.5',
          hint && 'justify-between',
        )}
      >
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {hint && (
          <span className="text-meta text-muted-foreground">{hint}</span>
        )}
      </div>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
