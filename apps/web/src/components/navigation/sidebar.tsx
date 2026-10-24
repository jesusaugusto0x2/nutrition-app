import type { LinkProps } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { Brand } from './brand';
import {
  comingSoonItems,
  mainNavItems,
  type NavItem,
  type NavKey,
} from './nav-items';
import { NavLink } from './nav-link';

const itemClass = [
  'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-nav px-3 text-left text-foreground no-underline transition-colors hover:bg-background hover:text-foreground',
  'aria-[current=page]:bg-primary-soft aria-[current=page]:font-bold aria-[current=page]:text-primary',
  'disabled:cursor-not-allowed disabled:text-disabled-foreground disabled:hover:bg-transparent',
].join(' ');

/**
 * Spec 2: main navigation on desktop. It is never fixed nor 100vh tall;
 * the layout puts it beside the content and, below about 800 px, above it
 * at full width (flex-wrap with a 240 px basis).
 */
export function Sidebar({
  items = mainNavItems,
  activeKey,
  comingSoonTo,
  className,
}: {
  items?: readonly NavItem[];
  activeKey?: NavKey;
  /** Route of the Próximamente screen, once it exists. */
  comingSoonTo?: LinkProps['to'];
  className?: string;
}) {
  return (
    <nav
      aria-label={t.nav.label}
      className={cn(
        'flex flex-col gap-8 border-r bg-surface px-4.5 py-7',
        className,
      )}
    >
      <Brand variant="menu" className="px-2" />
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.key}>
            <NavLink item={item} activeKey={activeKey} className={itemClass}>
              <item.icon aria-hidden className="size-[22px] shrink-0" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-0.5">
        {comingSoonTo ? (
          <Link
            to={comingSoonTo}
            className="flex min-h-9 items-center px-3 text-[13px] font-bold tracking-[0.06em] text-muted-foreground uppercase no-underline hover:text-primary"
          >
            {t.nav.comingSoon}
          </Link>
        ) : (
          <span className="flex min-h-9 items-center px-3 text-[13px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
            {t.nav.comingSoon}
          </span>
        )}
        <ul className="flex flex-col gap-0.5">
          {comingSoonItems.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                disabled
                className={cn(itemClass, 'min-h-touch text-base')}
              >
                <item.icon aria-hidden className="size-5 shrink-0" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
