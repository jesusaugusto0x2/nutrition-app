import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Spec 34: a list or result without data. One sentence and, when there is
 * one, a link to the action that solves it («Crear nuevo paciente»).
 */
export function EmptyState({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-card-sm border border-dashed border-input bg-surface px-5 py-4',
        className,
      )}
    >
      <p className="m-0">{children}</p>
      {action && <span className="font-bold">{action}</span>}
    </div>
  );
}

/**
 * Spec 35: a future feature, visibly unavailable. Not interactive, so it
 * carries no `aria-disabled` (ignored on an article); the «Próximamente»
 * badge says it in words.
 */
export function ComingSoonCard({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'flex items-start gap-4 rounded-card border border-dashed border-input bg-surface p-5 md:p-6',
        className,
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-field bg-neutral-soft text-muted-foreground">
        <Icon aria-hidden className="size-6" />
      </span>
      <div className="flex flex-col items-start gap-1.5">
        <h2 className="m-0 text-section font-bold">{title}</h2>
        <p className="m-0 text-muted-foreground">{description}</p>
        <Badge tone="neutral">{t.comingSoon.badge}</Badge>
      </div>
    </article>
  );
}
