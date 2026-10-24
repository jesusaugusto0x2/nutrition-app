import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const avatarVariants = cva(
  'flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary select-none',
  {
    variants: {
      size: {
        md: 'size-[46px] text-body',
        lg: 'size-[72px] text-2xl',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

/** First letter of the first given name and of the first surname. */
export function initialsOf(firstName: string, lastName: string): string {
  const first = (text: string) => text.trim().charAt(0).toLocaleUpperCase('es');
  return `${first(firstName)}${first(lastName)}`;
}

/**
 * Spec 20: initials in a circle. Decorative: the name is always written
 * next to it, so it is hidden from assistive technology.
 */
export function InitialsAvatar({
  firstName,
  lastName,
  size,
  className,
}: VariantProps<typeof avatarVariants> & {
  firstName: string;
  lastName: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn(avatarVariants({ size }), className)}>
      {initialsOf(firstName, lastName)}
    </span>
  );
}
