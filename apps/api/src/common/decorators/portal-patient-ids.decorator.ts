import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../http/authenticated-request';

/** The ids of the patients the current portal user can see. */
export const PortalPatientIds = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string[] => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.portalPatientIds) {
      // Programming error: the route is missing @PortalAccess().
      throw new Error(
        '@PortalPatientIds() requires @PortalAccess() on the route',
      );
    }
    return request.portalPatientIds;
  },
);
