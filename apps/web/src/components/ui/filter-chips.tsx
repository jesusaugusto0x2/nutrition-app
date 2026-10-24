import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import type { Choice } from '@/components/ui/choice-field';

interface FilterChipsProps<T extends string> {
  /** Accessible name of the group, e.g. «Medida de la gráfica». */
  label: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Spec 10: chooses what a chart shows. Always one chip chosen; tapping the
 * chosen one keeps it. Wraps onto several lines when needed.
 */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: FilterChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          size="chip"
          pressed={option.value === value}
          onPressedChange={(pressed) => pressed && onChange(option.value)}
        >
          {option.label}
        </Toggle>
      ))}
    </div>
  );
}
