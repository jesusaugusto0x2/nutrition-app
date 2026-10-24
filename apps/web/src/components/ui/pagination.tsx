import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

export interface PageWindow {
  pageCount: number;
  /** 1-based index of the first and last item shown. */
  from: number;
  to: number;
  /** Slice bounds for the current page: `items.slice(start, end)`. */
  start: number;
  end: number;
}

/** What a 1-based `page` shows; out-of-range pages are clamped. */
export function pageWindow(
  page: number,
  perPage: number,
  total: number,
): PageWindow {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(page, 1), pageCount);
  const start = (current - 1) * perPage;
  const end = Math.min(start + perPage, total);
  return { pageCount, from: total === 0 ? 0 : start + 1, to: end, start, end };
}

interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  /** 3, 5 or 10 per spec. */
  perPage: number;
  total: number;
  /** Plural noun of what is paged, e.g. «consultas». */
  items: string;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Spec 6. Words follow the list order (most recent first): «Más recientes»
 * goes back, «Más antiguas» forward. Hidden with a single page. Changing
 * page must cancel an open correction; that is the caller's job.
 */
export function Pagination({
  page,
  perPage,
  total,
  items,
  onPageChange,
  className,
}: PaginationProps) {
  const { pageCount, from, to } = pageWindow(page, perPage, total);
  if (pageCount <= 1) {
    return null;
  }
  const isFirst = page <= 1;
  const isLast = page >= pageCount;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const status = t.pagination.showing(from, to, total, items);

  return (
    <nav
      aria-label={t.pagination.label(items)}
      className={cn(
        'flex flex-col items-center gap-2.5 md:flex-row md:flex-wrap md:justify-between',
        className,
      )}
    >
      <span className="order-last text-meta text-muted-foreground md:order-first">
        {status}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={isFirst}
          onClick={() => onPageChange(page - 1)}
          aria-label={t.pagination.newer}
          className="size-12 px-0 text-primary md:size-auto md:h-11 md:px-3.5"
        >
          <ChevronLeftIcon aria-hidden className="size-[18px]" />
          <span className="hidden md:inline">{t.pagination.newer}</span>
        </Button>
        {pages.map((number) => (
          <Button
            key={number}
            variant={number === page ? 'primary' : 'secondary'}
            size="sm"
            aria-label={t.pagination.page(number)}
            aria-current={number === page ? 'page' : undefined}
            onClick={() => onPageChange(number)}
            className="size-12 px-0 md:size-11"
          >
            {number}
          </Button>
        ))}
        <Button
          variant="secondary"
          size="sm"
          disabled={isLast}
          onClick={() => onPageChange(page + 1)}
          aria-label={t.pagination.older}
          className="size-12 px-0 text-primary md:size-auto md:h-11 md:px-3.5"
        >
          <span className="hidden md:inline">{t.pagination.older}</span>
          <ChevronRightIcon aria-hidden className="size-[18px]" />
        </Button>
      </div>
    </nav>
  );
}
