import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { NavItem, NavKey } from './nav-items';

/**
 * Link for a navigation item. The router marks the current destination
 * with `aria-current="page"` (child routes included, so a patient profile
 * keeps Pacientes active); `activeKey` also marks an item where the route
 * alone cannot tell. Items without a route render disabled.
 */
export function NavLink({
  item,
  activeKey,
  className,
  children,
}: {
  item: NavItem;
  activeKey?: NavKey;
  className: string;
  children: ReactNode;
}) {
  if (!item.to) {
    return (
      <button
        type="button"
        disabled
        aria-current={activeKey === item.key ? 'page' : undefined}
        className={className}
      >
        {children}
      </button>
    );
  }

  return (
    <Link
      to={item.to}
      // Inicio is the root: without `exact` every page would match it.
      activeOptions={{ exact: item.key === 'home' }}
      // The router always adds aria-current to the matching route; this
      // can only add it, never take it away.
      aria-current={activeKey === item.key ? 'page' : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}
