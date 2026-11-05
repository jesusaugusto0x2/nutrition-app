import { useQuery } from '@tanstack/react-query';
import { meQueryOptions, useSignOut } from './api';
import type { AccountPanelProps } from './components/account-panel';

/**
 * The signed-in user and the sign-out action, for the account panel and
 * menu. `me` is already cached by the layout guard. It answers `null` while
 * signing out: `endSession` marks the user signed out before the layout
 * unmounts, and the panel then renders nothing.
 */
export function useAccount(): AccountPanelProps | null {
  const { data: me } = useQuery(meQueryOptions());
  const signOut = useSignOut();

  if (!me) {
    return null;
  }
  return {
    name: me.user.name,
    email: me.user.email,
    onSignOut: () => signOut.mutate(),
    signingOut: signOut.isPending,
    failed: signOut.isError,
  };
}
