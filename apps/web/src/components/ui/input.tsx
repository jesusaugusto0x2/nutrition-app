import { Input as InputPrimitive } from '@base-ui/react/input';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Base of every text field (spec 11 and Formularios): white field, 2 px
 * border, visible label elsewhere. Emails use `type="text"` with
 * `inputMode="email"` so the browser does not validate them; dates use
 * `inputMode="numeric"` with the `dd/mm/aaaa` placeholder.
 */
const inputVariants = cva(
  [
    'w-full min-w-0 rounded-field border-2 border-input bg-surface px-4 text-lg text-foreground transition-colors',
    'aria-invalid:border-error-border',
    'disabled:cursor-not-allowed disabled:bg-background disabled:text-disabled-foreground',
  ],
  {
    variants: {
      size: {
        /** 56 px on phones, 52 px on desktop. */
        md: 'h-14 md:h-13',
        /** Login fields. */
        lg: 'h-[58px]',
        /** Editing a cell in a table: no visible label, needs aria-label. */
        table: 'h-12 border-primary px-3',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

type InputProps = Omit<InputPrimitive.Props, 'size'> &
  VariantProps<typeof inputVariants>;

function Input({ className, size, type = 'text', ...props }: InputProps) {
  return (
    <InputPrimitive
      data-slot="input"
      type={type}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants, type InputProps };
