import * as React from 'react';
import { cn } from '@/lib/utils';

/** Visible field label: 16 px bold, always tied to its control by `for`. */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-base leading-snug font-bold text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
