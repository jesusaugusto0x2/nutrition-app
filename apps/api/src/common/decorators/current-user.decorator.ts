import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@nutri/schemas';
import type { AuthenticatedRequest } from '../http/authenticated-request';

/** The signed-in user of the current request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      // Programming error: the route is marked @Public().
      throw new Error('@CurrentUser() cannot be used on a @Public() route');
    }
    return request.user;
  },
);
