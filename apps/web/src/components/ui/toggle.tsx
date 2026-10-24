import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Selectable option shared by the Sí/No selector, the option selector and
 * filter chips (spec 8–10): white with a field border, filled with the
 * primary color when chosen. Works on toggles (`data-pressed`) and radios
 * (`data-checked`).
 */
const optionVariants = cva(
  [
    'inline-flex cursor-pointer items-center justify-center border-2 border-input bg-surface font-bold whitespace-nowrap text-foreground transition-colors select-none hover:border-primary',
    'data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground',
    'data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground',
    'data-disabled:cursor-not-allowed data-disabled:text-disabled-foreground',
  ],
  {
    variants: {
      size: {
        /** Sí / No buttons. */
        answer: 'h-12 w-16 rounded-nav text-body',
        /** Option selector: fills its column on desktop, 112 px on phones. */
        option: 'h-12 w-28 rounded-nav text-body md:h-13 md:w-auto md:flex-1',
        /** Filter chip. */
        chip: 'h-11 rounded-full px-4 text-meta',
      },
      tone: {
        primary: '',
        /** Selected «No»: lighter fill so it differs from «Sí» by more than hue. */
        neutral:
          'data-pressed:border-foreground data-pressed:bg-disabled data-pressed:text-foreground',
      },
    },
    defaultVariants: { size: 'chip', tone: 'primary' },
  },
);

function Toggle({
  className,
  size,
  tone,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof optionVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(optionVariants({ size, tone }), className)}
      {...props}
    />
  );
}

export { Toggle, optionVariants };
