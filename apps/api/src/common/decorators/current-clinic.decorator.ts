import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../http/authenticated-request';

/** The id of the clinic the current request operates on. */
export const CurrentClinic = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.clinicId) {
      // Programming error: the route is missing @ClinicAccess().
      throw new Error('@CurrentClinic() requires @ClinicAccess() on the route');
    }
    return request.clinicId;
  },
);
