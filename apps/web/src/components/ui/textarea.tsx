import * as React from 'react';
import { cn } from '@/lib/utils';

/** Spec 15: 3–4 lines that the user can stretch downwards. */
function Textarea({
  className,
  rows = 4,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(
        'w-full min-w-0 resize-y rounded-field border-2 border-input bg-surface px-3.5 py-3 text-lg text-foreground transition-colors',
        'aria-invalid:border-error-border disabled:cursor-not-allowed disabled:bg-background',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
