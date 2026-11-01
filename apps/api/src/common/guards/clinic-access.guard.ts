import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClinicsService } from '../../modules/clinics/clinics.service';
import { CLINIC_ACCESS_KEY } from '../decorators/clinic-access.decorator';
import type { AuthenticatedRequest } from '../http/authenticated-request';

/**
 * Global, after `SessionAuthGuard`. For `@ClinicAccess()` routes it sets the
 * clinic from the user's membership: 403 for a user without one.
 */
@Injectable()
export class ClinicAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clinicsService: ClinicsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresClinic = this.reflector.getAllAndOverride<boolean>(
      CLINIC_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresClinic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      // A route marked both @Public() and @ClinicAccess(): fail closed.
      throw new UnauthorizedException();
    }

    const clinicId = await this.clinicsService.findClinicIdForUser(
      request.user.id,
    );
    if (!clinicId) {
      throw new ForbiddenException();
    }

    request.clinicId = clinicId;
    return true;
  }
}
