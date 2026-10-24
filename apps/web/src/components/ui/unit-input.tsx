import { useId } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Spec 12: number with a decimal comma and its unit fixed inside the field.
 * The value stays the typed text; read it with `parseDecimalInput` or
 * `parseHeightInput` from `@/lib/parse`, which accept comma or dot.
 */
const unitInputVariants = cva('font-bold', {
  variants: {
    variant: {
      default: 'h-14 pr-12 text-[21px] md:h-13',
      /** Weight in a new consultation. */
      featured: 'h-[68px] rounded-button pr-14 pl-[18px] text-[32px]',
      /** Measurements in a new consultation. */
      measure: 'h-15 pr-13 text-2xl',
      /** Editing a table cell. */
      table: 'h-12 pr-10 text-lg',
    },
  },
  defaultVariants: { variant: 'default' },
});

const unitVariants = cva(
  'pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground',
  {
    variants: {
      variant: {
        default: 'right-4 text-lg',
        featured: 'right-[18px] text-[19px]',
        measure: 'right-4 text-body',
        table: 'right-3 text-base',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type UnitInputProps = Omit<InputProps, 'size' | 'type' | 'inputMode'> &
  VariantProps<typeof unitInputVariants> & {
    /** Display unit, e.g. `t.units.kilograms`. */
    unit: string;
  };

function UnitInput({
  unit,
  variant,
  className,
  'aria-describedby': describedBy,
  ...props
}: UnitInputProps) {
  const unitId = useId();

  return (
    <div className="relative w-full min-w-0">
      <Input
        inputMode="decimal"
        autoComplete="off"
        size={variant === 'table' ? 'table' : undefined}
        aria-describedby={describedBy ? `${describedBy} ${unitId}` : unitId}
        className={cn(unitInputVariants({ variant }), className)}
        {...props}
      />
      <span id={unitId} className={unitVariants({ variant })}>
        {unit}
      </span>
    </div>
  );
}

export { UnitInput, type UnitInputProps };
