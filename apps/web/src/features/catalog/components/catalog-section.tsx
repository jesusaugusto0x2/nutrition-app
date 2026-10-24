import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** One spec component in the catalog, anchored by `id`. */
export function CatalogSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-5 rounded-card border bg-surface p-5 md:p-6"
    >
      <h3 id={`${id}-title`} className="text-section font-bold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A labelled row of examples inside a section. */
export function CatalogRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <div className={cn('flex flex-wrap items-center gap-3', className)}>
        {children}
      </div>
    </div>
  );
}
