import { bottomNavItemClass } from '@/components/navigation/bottom-nav';
import { useAccount } from '../use-account';
import { AccountMenu, headerAccountTriggerClass } from './account-menu';
import { AccountPanel } from './account-panel';

/*
 * The account panel and menu wired to the session, one per place they sit
 * in. Each renders nothing once the user is signed out.
 */

/** Foot of the desktop sidebar. */
export function SidebarAccount() {
  const account = useAccount();
  return account && <AccountPanel {...account} />;
}

/** Last cell of the phone bottom bar. */
export function BottomNavAccount() {
  const account = useAccount();
  return (
    account && (
      <AccountMenu
        {...account}
        side="top"
        triggerClassName={bottomNavItemClass}
      />
    )
  );
}

/** Right end of the portal header, on every screen size. */
export function HeaderAccount() {
  const account = useAccount();
  return (
    account && (
      <AccountMenu
        {...account}
        side="bottom"
        triggerClassName={headerAccountTriggerClass}
      />
    )
  );
}
