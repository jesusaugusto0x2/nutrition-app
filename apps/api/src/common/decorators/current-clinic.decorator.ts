import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ClinicRequest } from '../http/clinic-request';

/** The id of the clinic the current request operates on. */
export const CurrentClinic = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<ClinicRequest>();
    if (!request.clinicId) {
      // Programming error: the route is missing @ClinicAccess().
      throw new Error('@CurrentClinic() requires @ClinicAccess() on the route');
    }
    return request.clinicId;
  },
);
