import { SearchIcon } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Spec 14: search field with a magnifier inside. Filtering is the caller's
 * job, with `matchesSearch` from `@/lib/parse` (ignores case and accents).
 */
function SearchInput({
  className,
  ...props
}: Omit<InputProps, 'type' | 'size'>) {
  return (
    <div className="relative">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-[18px] size-6 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        autoComplete="off"
        className={cn('h-15 rounded-button pl-[52px] md:h-16', className)}
        {...props}
      />
    </div>
  );
}

export { SearchInput };
