import { LeafIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/i18n';

type BrandVariant = 'compact' | 'menu' | 'boxed' | 'inverted';

/**
 * Spec 1: app identity. `compact` for the phone header, `menu` for the
 * sidebar, `boxed` for sign-in on phones and `inverted` (white on
 * primary) for the desktop sign-in panel.
 */
export function Brand({
  variant = 'menu',
  subtitle = t.app.tagline,
  className,
}: {
  variant?: BrandVariant;
  /** Line under the name; ignored by `compact`. */
  subtitle?: string | null;
  className?: string;
}) {
  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'flex items-center gap-2 text-base font-bold text-primary',
          className,
        )}
      >
        <LeafIcon aria-hidden className="size-[22px]" />
        {t.app.name}
      </span>
    );
  }

  const boxed = variant === 'boxed' || variant === 'inverted';
  const inverted = variant === 'inverted';

  return (
    <span
      className={cn(
        'flex items-center gap-3',
        inverted ? 'text-primary-foreground' : 'text-primary',
        className,
      )}
    >
      {boxed ? (
        <span
          className={cn(
            'flex size-[52px] items-center justify-center rounded-button-lg',
            inverted ? 'bg-primary-foreground/15' : 'bg-primary-soft',
          )}
        >
          <LeafIcon aria-hidden className="size-[30px]" />
        </span>
      ) : (
        <LeafIcon aria-hidden className="size-[30px]" />
      )}
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            'font-heading font-semibold',
            boxed ? 'text-2xl' : 'text-[22px]',
            inverted ? 'text-primary-foreground' : 'text-foreground',
          )}
        >
          {t.app.name}
        </span>
        {subtitle && (
          <span
            className={cn(
              boxed ? 'text-meta' : 'text-sm',
              inverted
                ? 'text-primary-foreground-muted'
                : 'text-muted-foreground',
            )}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
