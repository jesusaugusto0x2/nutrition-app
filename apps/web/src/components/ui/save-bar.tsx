import { CheckIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { SuccessNotice } from '@/components/ui/notice';
import { cn } from '@/lib/utils';

interface SaveBarProps {
  /** Button text, e.g. «Guardar consulta». */
  label: string;
  /**
   * Line explaining what is missing; when set, the button is disabled
   * (`incompleto`), e.g. «Escriba al menos el peso para poder guardar.».
   */
  missing?: string | null;
  /** Success message shown above the button (`guardado`). */
  saved?: ReactNode;
  /** Submits the form it belongs to, or runs `onSave`. */
  onSave?: () => void;
  /** Id of the form to submit when the bar is outside it. */
  form?: string;
  className?: string;
}

/**
 * Spec 36: keeps «Guardar» at hand in long forms on phones. Sticky at the
 * bottom; on desktop the button goes at the end of the form instead.
 */
export function SaveBar({
  label,
  missing,
  saved,
  onSave,
  form,
  className,
}: SaveBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 flex flex-col gap-2 border-t bg-surface px-5 pt-3 pb-4',
        className,
      )}
    >
      {saved && <SuccessNotice className="py-2.5">{saved}</SuccessNotice>}
      {missing && (
        <p className="m-0 text-center text-meta text-muted-foreground">
          {missing}
        </p>
      )}
      <Button
        type={form || !onSave ? 'submit' : 'button'}
        form={form}
        size="lg"
        fullWidth
        disabled={Boolean(missing)}
        onClick={onSave}
      >
        <CheckIcon aria-hidden strokeWidth={2.6} />
        {label}
      </Button>
    </div>
  );
}
