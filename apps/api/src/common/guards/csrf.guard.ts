import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global, before `SessionAuthGuard`: a rejected request never reaches the
 * database. It covers `@Public()` routes too, because signing in is also a
 * CSRF target (login CSRF).
 *
 * Follows the OWASP CSRF Prevention Cheat Sheet. Unsafe methods are rejected
 * when `Sec-Fetch-Site` is `cross-site`; otherwise `Origin` (`Referer` only
 * when `Origin` is absent) must match `APP_ORIGIN`. That rejects `Origin: null`
 * and requests with neither header, so only browsers on the app can write.
 * Other `Sec-Fetch-Site` values, unknown ones included, decide nothing.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'APP_ORIGIN'>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method) || this.isFromTheApp(request)) {
      return true;
    }

    // Route pattern, not the URL. A wrong APP_ORIGIN shows up here first.
    const route: unknown = request.route?.path;
    this.logger.warn(`Rejected ${request.method} ${String(route)}`);
    throw new ForbiddenException();
  }

  private isFromTheApp(request: Request): boolean {
    if (request.get('sec-fetch-site') === 'cross-site') {
      return false;
    }
    const source =
      request.get('origin') ?? URL.parse(request.get('referer') ?? '')?.origin;
    return source === this.config.APP_ORIGIN;
  }
}
