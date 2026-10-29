import type { AuthUser } from '@nutri/schemas';
import type { ActiveSessionRow } from './sessions.repository';

export function toAuthUser(user: ActiveSessionRow['user']): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerifiedAt !== null,
  };
}
