import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

/**
 * Rejects the email-auth flows (sign-up, verification, password reset) when
 * `EMAIL_AUTH_ENABLED` is off, e.g. production while transactional email is
 * sandboxed (#42). It runs before the throttler: there is nothing to
 * rate-limit on a disabled route. Sign-in with an existing password is not
 * gated, so accounts that already have one keep working.
 */
@Injectable()
export class EmailAuthEnabledGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(_context: ExecutionContext): boolean {
    if (this.config.EMAIL_AUTH_ENABLED) {
      return true;
    }
    throw new ForbiddenException({
      code: 'EMAIL_AUTH_DISABLED',
      message: 'Sign-up and password reset with email are disabled',
    });
  }
}
