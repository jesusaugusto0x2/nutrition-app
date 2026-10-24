import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronLeftIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Spec 4: one level up, naming the destination in words («Pacientes»,
 * «Ficha de Laura Méndez»), never just «Atrás».
 */
export function BackLink({
  label,
  className,
  ...link
}: Pick<LinkProps, 'to' | 'params' | 'search'> & {
  /** Destination in words. */
  label: string;
  className?: string;
}) {
  return (
    <Link
      {...link}
      className={cn(
        'flex min-h-12 w-fit items-center gap-1 font-bold text-primary no-underline hover:text-primary-hover md:min-h-touch',
        className,
      )}
    >
      <ChevronLeftIcon aria-hidden className="size-5" strokeWidth={2.2} />
      {label}
    </Link>
  );
}
