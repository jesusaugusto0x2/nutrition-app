import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Spec 19: base container of every section. `featured` marks the field
 * being filled (weight in a new consultation) or a record being edited;
 * `soft` holds measurement cells; `dashed` is for empty and coming-soon
 * states.
 */
const cardVariants = cva('flex flex-col gap-4 rounded-card p-5 md:p-6', {
  variants: {
    variant: {
      default: 'border bg-surface',
      featured: 'border-2 border-primary bg-surface',
      soft: 'rounded-card-sm bg-background',
      dashed: 'border border-dashed border-input bg-surface',
    },
  },
  defaultVariants: { variant: 'default' },
});

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}

/** Title on the left, optional text action (`CardAction`) on the right. */
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({
  className,
  as: Heading = 'h2',
  ...props
}: React.ComponentProps<'h2'> & { as?: 'h2' | 'h3' | 'h4' | 'div' }) {
  return (
    <Heading
      data-slot="card-title"
      className={cn('m-0 text-section font-bold', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-meta text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('font-bold', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('flex flex-col gap-3', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex flex-wrap items-center gap-3', className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
};
