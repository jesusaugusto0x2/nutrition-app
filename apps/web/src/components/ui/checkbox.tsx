import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { CheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Spec 17: 24 px box in the primary color. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-input bg-surface transition-colors',
        'data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground',
        'data-disabled:cursor-not-allowed data-disabled:bg-background',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator">
        <CheckIcon aria-hidden className="size-4" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** Checkbox whose whole text is clickable, 48 px tall. */
function CheckboxField({
  label,
  className,
  ...props
}: CheckboxPrimitive.Root.Props & { label: ReactNode }) {
  return (
    <label
      className={cn(
        'flex min-h-12 cursor-pointer items-center gap-3 text-body',
        className,
      )}
    >
      <Checkbox {...props} />
      <span>{label}</span>
    </label>
  );
}

export { Checkbox, CheckboxField };
