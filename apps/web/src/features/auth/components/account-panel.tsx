import { LogOutIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

export interface AccountPanelProps {
  name: string;
  email: string;
  onSignOut: () => void;
  /** The request is in flight: the button stays disabled. */
  signingOut?: boolean;
  /** The API did not confirm, so the session is still open. */
  failed?: boolean;
  className?: string;
}

/**
 * Who is signed in, with «Cerrar sesión». Same block as the portal sidebar
 * footer in the prototype; the staff app had no design for it yet.
 */
export function AccountPanel({
  name,
  email,
  onSignOut,
  signingOut = false,
  failed = false,
  className,
}: AccountPanelProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-meta font-bold break-words">{name}</span>
      <span className="text-sm break-all text-muted-foreground">{email}</span>
      <Button
        variant="text"
        onClick={onSignOut}
        disabled={signingOut}
        className="mt-1 -ml-1 self-start text-meta [&_svg:not([class*='size-'])]:size-5"
      >
        <LogOutIcon aria-hidden />
        {t.account.signOut}
      </Button>
      {failed && (
        <p role="alert" className="m-0 text-sm font-bold text-error">
          {t.account.signOutFailed}
        </p>
      )}
    </div>
  );
}
