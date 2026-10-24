import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Pill label (spec 23 and 24). Tones: `primary` (Peso normal, bajó, Hoy),
 * `amber` (Sobrepeso, subió), `info` (Bajo peso, menor de edad, clinical
 * diagnoses), `rust` (Obesidad), `neutral` (sin cambio, Próximamente).
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-full font-bold whitespace-nowrap',
  {
    variants: {
      tone: {
        primary: 'bg-primary-soft text-primary',
        amber: 'bg-amber-soft text-amber',
        info: 'bg-info-soft text-info',
        rust: 'bg-rust-soft text-rust',
        neutral: 'bg-neutral-soft text-muted-foreground',
      },
      size: {
        sm: 'px-2.5 py-0.5 text-sm',
        md: 'px-3 py-1 text-meta',
        lg: 'px-3.5 py-1.5 text-base',
      },
    },
    defaultVariants: { tone: 'primary', size: 'md' },
  },
);

type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

function Badge({
  className,
  tone,
  size,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ tone, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants, type BadgeTone };
