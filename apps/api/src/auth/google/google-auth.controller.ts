import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth.service';
import { AuthThrottlerGuard } from '../rate-limit/auth-throttler.guard';
import { GOOGLE_RATE_LIMITS, RateLimit } from '../rate-limit/rate-limit';
import { SessionCookie } from '../sessions/session-cookie';
import { GoogleAuthService, GoogleSignInError } from './google-auth.service';
import { GoogleFlowCookie } from './google-flow-cookie';

/** Details stay in the log: the URL says only that Google sign-in failed. */
export const GOOGLE_FAILURE_PATH = '/login?error=google';
/** Clinic staff, portal users and onboarding each get routed by the web app. */
export const GOOGLE_SIGNED_IN_PATH = '/';
export const GOOGLE_NEW_ACCOUNT_PATH = '/onboarding';

interface RedirectTo {
  url: string;
}

/**
 * Both routes are browser navigations, so they answer with redirects, never
 * with JSON, except for the 404 when Google is not configured and the 429 of
 * the rate limit. Neither writes on behalf of a session: the callback is
 * protected by `state`, not by `CsrfGuard`, which skips GET.
 */
@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly google: GoogleAuthService,
    private readonly authService: AuthService,
    private readonly sessionCookie: SessionCookie,
    private readonly flowCookie: GoogleFlowCookie,
  ) {}

  @Public()
  @Get()
  @Redirect()
  @RateLimit(GOOGLE_RATE_LIMITS)
  @UseGuards(AuthThrottlerGuard)
  async start(
    @Res({ passthrough: true }) response: Response,
  ): Promise<RedirectTo> {
    this.requireEnabled();
    try {
      const { url, checks } = await this.google.start();
      this.flowCookie.set(response, checks);
      return { url };
    } catch (error) {
      this.logFailure(error);
      return { url: GOOGLE_FAILURE_PATH };
    }
  }

  @Public()
  @Get('callback')
  @Redirect()
  @RateLimit(GOOGLE_RATE_LIMITS)
  @UseGuards(AuthThrottlerGuard)
  async callback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RedirectTo> {
    this.requireEnabled();
    // Good for one attempt, whatever happens next.
    this.flowCookie.clear(response);
    try {
      const { userId, created } = await this.google.finish(
        queryOf(request),
        this.flowCookie.read(request),
      );
      const { token, expiresAt } = await this.authService.startSession(
        userId,
        this.sessionCookie.read(request),
        request.get('user-agent'),
      );
      this.sessionCookie.set(response, token, expiresAt);
      return {
        url: created ? GOOGLE_NEW_ACCOUNT_PATH : GOOGLE_SIGNED_IN_PATH,
      };
    } catch (error) {
      this.logFailure(error);
      return { url: GOOGLE_FAILURE_PATH };
    }
  }

  private requireEnabled(): void {
    if (!this.google.enabled) {
      throw new NotFoundException();
    }
  }

  /** The reason or error name only: messages can quote what Google sent. */
  private logFailure(error: unknown): void {
    let cause: string = typeof error;
    if (error instanceof GoogleSignInError) {
      cause = error.reason;
    } else if (error instanceof Error) {
      cause = error.name;
    }
    this.logger.warn(`Google sign-in failed (${cause})`);
  }
}

/** The raw query string, as `request.query` has already been parsed. */
function queryOf(request: Request): string {
  const start = request.originalUrl.indexOf('?');
  return start === -1 ? '' : request.originalUrl.slice(start + 1);
}
