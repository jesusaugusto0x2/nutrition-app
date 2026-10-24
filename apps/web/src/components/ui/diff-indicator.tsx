import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { t } from '@/i18n';
import {
  changeDirection,
  formatQuantityChange,
  type Quantity,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const indicatorVariants = cva(
  'flex shrink-0 items-center justify-center gap-1.5 rounded-button border-2 px-2.5 text-center leading-tight font-bold',
  {
    variants: {
      state: {
        empty:
          'border-dashed border-input bg-surface text-meta font-normal text-placeholder',
        down: 'border-transparent bg-primary-soft text-[21px] text-primary',
        up: 'border-transparent bg-amber-soft text-[21px] text-amber',
        none: 'border-transparent bg-neutral-soft text-body text-muted-foreground',
      },
      size: {
        md: 'w-[150px]',
        lg: 'w-[170px]',
      },
    },
  },
);

/**
 * Spec 25: live difference against the previous consultation while the
 * value is typed. Sits beside a `UnitInput`, at its height; announced
 * politely to screen readers.
 */
export function DiffIndicator({
  current,
  previous,
  quantity,
  size = 'md',
  className,
}: {
  /** Parsed current value; `null` while the field is empty or unreadable. */
  current: number | null;
  previous: number;
  quantity: Quantity;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const change = current === null ? null : current - previous;
  const state = change === null ? 'empty' : changeDirection(change, quantity);

  return (
    <span
      aria-live="polite"
      className={cn(indicatorVariants({ state, size }), className)}
    >
      {state === 'down' && <ArrowDownIcon aria-hidden className="size-5" />}
      {state === 'up' && <ArrowUpIcon aria-hidden className="size-5" />}
      {state === 'empty' && t.consultations.difference}
      {state === 'none' && t.consultations.noChange}
      {change !== null &&
        state !== 'none' &&
        formatQuantityChange(change, quantity)}
    </span>
  );
}
