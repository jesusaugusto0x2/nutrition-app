import { useId } from 'react';
import { FieldError } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

interface ChoiceFieldProps<T extends string> {
  label: string;
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Error message; set it only after a submit attempt. */
  error?: string;
  className?: string;
}

/**
 * Spec 9: one option among a few, drawn like the Sí/No buttons. Label on
 * the left with 112 px buttons on phones; label above and buttons filling
 * the column from `md`.
 */
export function ChoiceField<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  className,
}: ChoiceFieldProps<T>) {
  const labelId = useId();
  const errorId = error ? `${labelId}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-3 md:flex-col md:items-stretch md:gap-1.5',
        )}
      >
        <span id={labelId} className="font-bold">
          {label}
        </span>
        <RadioGroup
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          value={value}
          onValueChange={(next) => onChange(next as T)}
          className="gap-1.5"
        >
          {options.map((option) => (
            <RadioGroupItem key={option.value} value={option.value}>
              {option.label}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
