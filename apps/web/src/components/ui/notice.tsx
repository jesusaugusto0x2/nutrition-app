import { CheckIcon } from 'lucide-react';
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
