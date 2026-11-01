import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PatientAccessService } from '../../modules/portal/patient-access.service';
import { PORTAL_ACCESS_KEY } from '../decorators/portal-access.decorator';
import type { AuthenticatedRequest } from '../http/authenticated-request';

/**
 * Global, after `SessionAuthGuard`. For `@PortalAccess()` routes it exposes
 * the patients the user can see: 403 for a user without any.
 */
@Injectable()
export class PortalAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly patientAccessService: PatientAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresPortal = this.reflector.getAllAndOverride<boolean>(
      PORTAL_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresPortal) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      // A route marked both @Public() and @PortalAccess(): fail closed.
      throw new UnauthorizedException();
    }

    const patientIds = await this.patientAccessService.listPatientIds(
      request.user.id,
    );
    if (patientIds.length === 0) {
      throw new ForbiddenException();
    }

    request.portalPatientIds = patientIds;
    return true;
  }
}
