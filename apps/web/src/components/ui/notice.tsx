import { CheckIcon, CircleAlertIcon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Spec 31: shown after saving, where the eyes are. Any later change to the
 * form must clear it, so it never says «guardado» over unsaved data.
 */
export function SuccessNotice({
  children,
  action,
  className,
}: {
  children: ReactNode;
  /** Optional link, e.g. «Ver control de medidas». */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card-sm bg-primary-soft px-5 py-3.5 text-primary',
        className,
      )}
    >
      <span className="flex items-center gap-2 text-lg font-bold">
        <CheckIcon aria-hidden className="size-6" strokeWidth={2.6} />
        {children}
      </span>
      {action && <span className="font-bold">{action}</span>}
    </div>
  );
}

/**
 * Spec 32: after removing something. «Deshacer» stays until the next add
 * or remove.
 */
export function UndoNotice({
  children,
  onUndo,
  className,
}: {
  children: ReactNode;
  onUndo: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-field bg-background px-4 py-2.5',
        className,
      )}
    >
      <span className="text-meta">{children}</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={onUndo}
        className="border-primary text-primary"
      >
        {t.notices.undo}
      </Button>
    </div>
  );
}

/**
 * Spec 33: explains something the app did on its own. `clinical` uses the
 * blue of clinical information (e.g. the percentile note).
 */
export function InfoNotice({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'clinical';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'm-0 rounded-field px-4 py-3 text-meta',
        tone === 'clinical'
          ? 'bg-info-soft text-info'
          : 'bg-background text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Spec 40: above a form, for an error that is not about a single field. Keep
 * `children` steady: a live countdown here would be read aloud every second.
 */
export function FormAlert({
  title,
  children,
  icon: Icon = CircleAlertIcon,
  action,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  /** `LockIcon` while the form is blocked. */
  icon?: LucideIcon;
  /** Optional link or button, e.g. «Reenviar enlace». */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-button border border-error-soft-border bg-error-soft px-4 py-3.5 text-error-soft-foreground',
        className,
      )}
    >
      <Icon aria-hidden className="mt-px size-[22px] flex-none" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <strong>{title}</strong>
        <span className="text-meta">{children}</span>
        {action && <div className="mt-1.5">{action}</div>}
      </div>
    </div>
  );
}
