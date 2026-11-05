import type { ReactNode } from 'react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { bottomNavItems, type NavItem, type NavKey } from './nav-items';
import { NavLink } from './nav-link';

/** Look of a bar cell; the account trigger reuses it. */
export const bottomNavItemClass = cn(
  'flex h-18 w-full cursor-pointer flex-col items-center justify-center gap-1 border-t-3 border-transparent text-sm text-muted-foreground no-underline hover:text-primary',
  'aria-[current=page]:border-primary aria-[current=page]:font-bold aria-[current=page]:text-primary',
  'aria-expanded:font-bold aria-expanded:text-primary',
  'disabled:cursor-not-allowed disabled:text-disabled-foreground',
);

/**
 * Spec 3: main navigation on phones, sticky at the bottom. Inner screens
 * (profile, measurements) keep Pacientes active through their route.
 * Screens with their own save bar do not show it. `account` adds a last
 * cell (the «Cuenta» menu).
 */
export function BottomNav({
  items = bottomNavItems,
  activeKey,
  account,
  className,
}: {
  items?: readonly NavItem[];
  activeKey?: NavKey;
  account?: ReactNode;
  className?: string;
}) {
  const columns = items.length + (account ? 1 : 0);
  return (
    <nav
      aria-label={t.nav.label}
      className={cn('sticky bottom-0 z-10 border-t bg-surface', className)}
    >
      <ul
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => (
          <li key={item.key}>
            <NavLink
              item={item}
              activeKey={activeKey}
              className={bottomNavItemClass}
            >
              <item.icon aria-hidden className="size-6" />
              {item.label}
            </NavLink>
          </li>
        ))}
        {account && <li>{account}</li>}
      </ul>
    </nav>
  );
}
