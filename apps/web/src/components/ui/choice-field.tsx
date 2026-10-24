import { useId } from 'react';
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
  className,
}: ChoiceFieldProps<T>) {
  const labelId = useId();

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 md:flex-col md:items-stretch md:gap-1.5',
        className,
      )}
    >
      <span id={labelId} className="font-bold">
        {label}
      </span>
      <RadioGroup
        aria-labelledby={labelId}
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
  );
}
