import { LeafIcon } from 'lucide-react';
import { Brand } from '@/components/navigation/brand';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

/** Spec 42: left half of the desktop sign-in pages. */
export function BrandPanel({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        'relative flex flex-col justify-between gap-10 overflow-hidden bg-primary px-14 py-12 text-primary-foreground',
        className,
      )}
    >
      <LeafIcon
        aria-hidden
        strokeWidth={0.5}
        className="absolute -right-[140px] -bottom-[150px] size-[520px] opacity-12"
      />
      <Brand variant="inverted" subtitle={null} className="relative" />
      <div className="relative flex max-w-[520px] flex-col gap-4">
        <p className="m-0 font-heading text-[46px] leading-[1.1] font-medium text-balance">
          {t.auth.panelTitle}
        </p>
        <p className="m-0 text-[19px] text-pretty text-primary-foreground-muted">
          {t.auth.panelSubtitle}
        </p>
      </div>
    </aside>
  );
}
