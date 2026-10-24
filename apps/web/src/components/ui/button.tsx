import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Spec component 7. Use `<Button>` for actions; for navigation, put
 * `buttonVariants(...)` on a router `<Link>` so it stays a real link.
 * Disabled buttons need a nearby line explaining what is missing.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 font-bold whitespace-nowrap no-underline transition-colors select-none',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled disabled:text-muted-foreground',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground',
        secondary:
          'border-2 border-input bg-surface text-foreground hover:bg-background hover:text-foreground',
        add: 'border-2 border-dashed border-primary bg-surface text-primary hover:bg-primary-soft',
        danger:
          'border-2 border-rust-border bg-surface text-rust hover:bg-rust-soft hover:text-rust',
        text: 'min-h-touch bg-transparent px-1 text-primary hover:text-primary-hover disabled:bg-transparent',
      },
      size: {
        lg: 'h-16 rounded-button-lg px-8 text-[19px]',
        md: 'h-14 rounded-button px-6 text-lg',
        sm: "h-11 rounded-button px-4 text-meta [&_svg:not([class*='size-'])]:size-5",
        icon: 'size-14 rounded-button',
        'icon-sm':
          "size-12 rounded-button [&_svg:not([class*='size-'])]:size-5",
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    compoundVariants: [
      // Text buttons are sized by their text, not by the size scale.
      { variant: 'text', className: 'h-auto rounded-nav px-1' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

function Button({
  className,
  variant,
  size,
  fullWidth,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
