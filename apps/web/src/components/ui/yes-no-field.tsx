import { Trash2Icon } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/** `null` means the question has not been answered yet. */
export type YesNoAnswer = 'yes' | 'no' | null;

interface YesNoFieldProps {
  label: string;
  value: YesNoAnswer;
  onChange: (value: YesNoAnswer) => void;
  /** Shows the «Quitar» button, for items the user added. */
  onRemove?: () => void;
  className?: string;
}

/**
 * Spec 8: three states with two buttons. Tapping the chosen answer again
 * clears it back to «Sin responder».
 */
export function YesNoField({
  label,
  value,
  onChange,
  onRemove,
  className,
}: YesNoFieldProps) {
  const choose = (answer: 'yes' | 'no') => (pressed: boolean) =>
    onChange(pressed ? answer : null);

  return (
    <div
      className={cn('flex min-h-[62px] items-center gap-3 py-1.5', className)}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="font-bold">{label}</span>
        {value === null && (
          <span className="text-sm text-muted-foreground">
            {t.forms.unanswered}
          </span>
        )}
      </div>
      <div role="group" aria-label={label} className="flex gap-1.5">
        <Toggle
          size="answer"
          pressed={value === 'yes'}
          onPressedChange={choose('yes')}
        >
          {t.common.yes}
        </Toggle>
        <Toggle
          size="answer"
          tone="neutral"
          pressed={value === 'no'}
          onPressedChange={choose('no')}
        >
          {t.common.no}
        </Toggle>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${t.common.remove} ${label}`}
            title={t.common.remove}
            className="flex size-12 cursor-pointer items-center justify-center rounded-nav border-2 border-rust-border bg-surface text-rust hover:bg-rust-soft"
          >
            <Trash2Icon aria-hidden className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}
