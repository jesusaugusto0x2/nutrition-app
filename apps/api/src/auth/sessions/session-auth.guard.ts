import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../../common/http/authenticated-request';
import { SessionCookie } from './session-cookie';
import { SessionsService } from './sessions.service';

/**
 * Global: every route requires a valid session unless it is `@Public()`.
 * Attaches the signed-in user to the request for the guards after it.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionsService: SessionsService,
    private readonly sessionCookie: SessionCookie,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.sessionCookie.read(request);
    const session = token ? await this.sessionsService.validate(token) : null;
    if (!session) {
      throw new UnauthorizedException();
    }

    request.user = session.user;
    return true;
  }
}
