import { SetMetadata } from '@nestjs/common';

export const PORTAL_ACCESS_KEY = 'portalAccess';

/**
 * Marks a controller or handler as portal-scoped: a guard must resolve the
 * patients the caller can see before it runs, and `@PortalPatientIds()`
 * becomes available. Every /api/portal/* controller must use it.
 */
export const PortalAccess = () => SetMetadata(PORTAL_ACCESS_KEY, true);
