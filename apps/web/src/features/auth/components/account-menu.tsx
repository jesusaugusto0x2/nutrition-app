import { Popover } from '@base-ui/react/popover';
import { CircleUserRoundIcon } from 'lucide-react';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { AccountPanel, type AccountPanelProps } from './account-panel';

/** Trigger look for a header, such as the portal's. */
export const headerAccountTriggerClass =
  'flex min-h-touch w-fit cursor-pointer items-center gap-2 rounded-nav px-2 font-bold text-primary hover:text-primary-hover aria-expanded:bg-primary-soft';

/**
 * «Cuenta» button that opens the account panel in a popover. On phones it is
 * the last cell of the bottom bar (opens upwards); in the portal header it
 * opens downwards.
 */
export function AccountMenu({
  side = 'top',
  triggerClassName,
  ...account
}: AccountPanelProps & {
  side?: 'top' | 'bottom';
  /** The trigger takes the look of the bar or header it sits in. */
  triggerClassName?: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className={triggerClassName}>
        <CircleUserRoundIcon aria-hidden className="size-6" />
        {t.account.menu}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side={side}
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-20"
        >
          <Popover.Popup
            aria-label={t.account.menu}
            className={cn(
              'w-[min(320px,calc(100vw-24px))] rounded-card border bg-popover p-5 text-popover-foreground shadow-popover',
              'outline-none',
            )}
          >
            <AccountPanel {...account} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
