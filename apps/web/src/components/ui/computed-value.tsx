import { useId, type ReactNode } from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

interface ComputedValueProps {
  label: string;
  /** Formatted value; `null` shows «—» until there is data. */
  value: ReactNode | null;
  /** Id of the control the value is computed from, e.g. birth date. */
  htmlFor: string;
  className?: string;
}

/**
 * Spec 16 (`edad`): a value the app computes, drawn so it does not look
 * editable. The BMI result card lives with the BMI classification.
 */
export function ComputedValue({
  label,
  value,
  htmlFor,
  className,
}: ComputedValueProps) {
  const labelId = useId();

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={labelId} className="text-base font-bold">
        {label}{' '}
        <span className="text-sm font-normal text-muted-foreground">
          · {t.forms.computedHint}
        </span>
      </span>
      <output
        htmlFor={htmlFor}
        aria-labelledby={labelId}
        className="flex h-14 items-center rounded-field bg-background px-4 text-lg font-bold md:h-13"
      >
        {value ?? t.common.notAvailable}
      </output>
    </div>
  );
}
