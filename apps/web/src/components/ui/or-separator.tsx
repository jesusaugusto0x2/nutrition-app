import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Spec 38: a 1 px line on each side of a short text, between two ways of
 * doing the same thing ("o con tu email").
 */
export function OrSeparator({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 text-meta text-muted-foreground',
        className,
      )}
    >
      <span aria-hidden className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
