import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@nutri/schemas';
import type { Request, Response } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';
import { AuthService } from './auth.service';
import { AuthUserDto } from './dto/auth.dto';
import { LocalAuthGuard } from './local-auth.guard';
import { AuthThrottlerGuard } from './rate-limit/auth-throttler.guard';
import { RateLimit, SIGN_IN_RATE_LIMITS } from './rate-limit/rate-limit';
import { SessionCookie } from './sessions/session-cookie';

/** Request after `LocalAuthGuard` accepted the credentials. */
interface SignedInRequest extends Request {
  user: AuthUser;
}

// Not under /api/clinic or /api/portal: signing in comes before both.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionCookie: SessionCookie,
  ) {}

  /** Body: `signInSchema`, validated by `LocalAuthGuard`. */
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @RateLimit(SIGN_IN_RATE_LIMITS)
  @UseGuards(AuthThrottlerGuard, LocalAuthGuard)
  @ZodSerializerDto(AuthUserDto)
  async signIn(
    @Req() request: SignedInRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const { token, expiresAt } = await this.authService.startSession(
      request.user.id,
      this.sessionCookie.read(request),
      request.get('user-agent'),
    );
    this.sessionCookie.set(response, token, expiresAt);
    return request.user;
  }

  /** Always 204, also without a valid session: the outcome is the same. */
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.signOut(this.sessionCookie.read(request));
    this.sessionCookie.clear(response);
  }
}
