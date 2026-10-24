import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { bottomNavItems, type NavItem, type NavKey } from './nav-items';
import { NavLink } from './nav-link';

/**
 * Spec 3: main navigation on phones, sticky at the bottom. Inner screens
 * (profile, measurements) keep Pacientes active through their route.
 * Screens with their own save bar do not show it.
 */
export function BottomNav({
  items = bottomNavItems,
  activeKey,
  className,
}: {
  items?: readonly NavItem[];
  activeKey?: NavKey;
  className?: string;
}) {
  return (
    <nav
      aria-label={t.nav.label}
      className={cn('sticky bottom-0 z-10 border-t bg-surface', className)}
    >
      <ul
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => (
          <li key={item.key}>
            <NavLink
              item={item}
              activeKey={activeKey}
              className={cn(
                'flex h-18 w-full flex-col items-center justify-center gap-1 border-t-3 border-transparent text-sm text-muted-foreground no-underline hover:text-primary',
                'aria-[current=page]:border-primary aria-[current=page]:font-bold aria-[current=page]:text-primary',
                'disabled:cursor-not-allowed disabled:text-disabled-foreground',
              )}
            >
              <item.icon aria-hidden className="size-6" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
