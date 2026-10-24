import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Context line, e.g. «10/03/2026 · IMC 27,6». */
  context?: ReactNode;
  /**
   * `normal`: white card. `down` / `up`: highlighted total lost or gained.
   * `mini`: soft cell for the change of one measurement.
   */
  variant?: 'normal' | 'down' | 'up' | 'mini';
  className?: string;
}

const containers = {
  normal: 'rounded-card border bg-surface px-6 py-5.5',
  down: 'rounded-card bg-primary-soft px-6 py-5.5 text-primary',
  up: 'rounded-card bg-amber-soft px-6 py-5.5 text-amber',
  mini: 'rounded-button bg-background px-4.5 py-3.5',
};

/** Spec 26: label, large value and context. */
export function StatCard({
  label,
  value,
  context,
  variant = 'normal',
  className,
}: StatCardProps) {
  const highlighted = variant === 'down' || variant === 'up';

  return (
    <div
      className={cn('flex flex-col gap-0.5', containers[variant], className)}
    >
      <span className={cn(highlighted ? 'font-bold' : 'text-muted-foreground')}>
        {label}
      </span>
      <span
        className={cn(
          'flex items-center gap-2 font-bold',
          variant === 'mini' ? 'text-2xl' : 'text-value md:text-value-lg',
        )}
      >
        {variant === 'down' && <ArrowDownIcon aria-hidden className="size-7" />}
        {variant === 'up' && <ArrowUpIcon aria-hidden className="size-7" />}
        {value}
      </span>
      {context && (
        <span
          className={cn('text-meta', !highlighted && 'text-muted-foreground')}
        >
          {context}
        </span>
      )}
    </div>
  );
}
