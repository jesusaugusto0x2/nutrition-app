import type { AuthUser } from '@nutri/schemas';
import type { Request } from 'express';

/** Request after the guards resolved who is calling and what they can reach. */
export interface AuthenticatedRequest extends Request {
  /** Set by `SessionAuthGuard`; absent only on `@Public()` routes. */
  user?: AuthUser;
  /** Set by `ClinicAccessGuard` on `@ClinicAccess()` routes. */
  clinicId?: string;
  /** Set by `PortalAccessGuard` on `@PortalAccess()` routes. */
  portalPatientIds?: string[];
}
