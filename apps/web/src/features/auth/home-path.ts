import type { AuthMe } from '@nutri/schemas';

export type HomePath = '/patients' | '/portal' | '/onboarding';

/**
 * Where a signed-in user belongs. The account kind is derived from data:
 * staff first (someone can be both a nutritionist and a patient), then portal
 * users; a user with neither still has to create their clinic.
 */
export function homePath(me: AuthMe): HomePath {
  if (me.memberships.length > 0) {
    return '/patients';
  }
  return me.patientAccess.length > 0 ? '/portal' : '/onboarding';
}
