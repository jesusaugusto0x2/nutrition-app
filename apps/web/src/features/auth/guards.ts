import type { AuthMe } from '@nutri/schemas';
import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { clearSessionData, meQueryOptions } from './api';
import { homePath } from './home-path';

/*
 * `beforeLoad` guards of the layouts. They never return `me`: whatever a guard
 * returns stays in the router's context, out of reach of `queryClient.clear()`.
 *
 * `fetchQuery` rather than `ensureQueryData`: a stale `me` is refetched and
 * awaited, so an old answer cannot authorize a navigation. A failure other
 * than a 401 rejects and shows the error page, so a guard fails closed.
 */
function fetchMe(queryClient: QueryClient): Promise<AuthMe | null> {
  return queryClient.fetchQuery(meQueryOptions());
}

/** Comes back to `currentPath` after signing in. */
async function requireMe(
  queryClient: QueryClient,
  currentPath: string,
): Promise<AuthMe> {
  const me = await fetchMe(queryClient);
  if (me) {
    return me;
  }
  // The session may have ended silently, with patient data still cached.
  clearSessionData(queryClient);
  throw redirect({ to: '/login', search: { redirect: currentPath } });
}

export async function requireClinicAccess(
  queryClient: QueryClient,
  currentPath: string,
): Promise<void> {
  const me = await requireMe(queryClient, currentPath);
  if (me.memberships.length === 0) {
    throw redirect({ to: homePath(me) });
  }
}

export async function requirePortalAccess(
  queryClient: QueryClient,
  currentPath: string,
): Promise<void> {
  const me = await requireMe(queryClient, currentPath);
  if (me.patientAccess.length === 0) {
    throw redirect({ to: homePath(me) });
  }
}

/** Only for users with neither a clinic nor portal access. */
export async function requireNoAccount(
  queryClient: QueryClient,
  currentPath: string,
): Promise<void> {
  const me = await requireMe(queryClient, currentPath);
  const home = homePath(me);
  if (home !== '/onboarding') {
    throw redirect({ to: home });
  }
}

export async function redirectIfSignedIn(
  queryClient: QueryClient,
): Promise<void> {
  const me = await fetchMe(queryClient);
  if (me) {
    throw redirect({ to: homePath(me) });
  }
}

export async function redirectToHome(queryClient: QueryClient): Promise<never> {
  const me = await fetchMe(queryClient);
  throw redirect({ to: me ? homePath(me) : '/login' });
}
