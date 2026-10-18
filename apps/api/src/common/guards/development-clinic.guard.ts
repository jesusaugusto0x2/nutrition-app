import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { SEED_CLINIC_ID } from '../../database/seed/seed-ids';
import { ClinicsService } from '../../modules/clinics/clinics.service';
import { CLINIC_ACCESS_KEY } from '../decorators/clinic-access.decorator';
import type { ClinicRequest } from '../http/clinic-request';

/**
 * TEMPORARY: development-only stand-in for authentication. Remove when real
 * auth lands (see auth/auth.module.ts).
 *
 * For routes marked with @ClinicAccess() it assigns the seed clinic to the
 * request, but only when NODE_ENV=development. In any other environment it
 * rejects clinic routes, so production never serves clinic data without auth.
 */
@Injectable()
export class DevelopmentClinicGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
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

    if (this.config.NODE_ENV !== 'development') {
      throw new UnauthorizedException('Authentication is not implemented yet');
    }

    if (!(await this.clinicsService.exists(SEED_CLINIC_ID))) {
      throw new ServiceUnavailableException(
        'Development clinic not found. Run `pnpm db:seed`.',
      );
    }

    context.switchToHttp().getRequest<ClinicRequest>().clinicId =
      SEED_CLINIC_ID;
    return true;
  }
}
