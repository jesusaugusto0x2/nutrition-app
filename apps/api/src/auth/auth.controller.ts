import {
  Body,
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
import {
  AuthUserDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { LocalAuthGuard } from './local-auth.guard';
import { PasswordResetService } from './passwords/password-reset.service';
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
    private readonly passwordReset: PasswordResetService,
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

  /**
   * Always 202 with no body, whether or not the email has an account; the
   * link is emailed in the background.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  forgotPassword(@Body() body: ForgotPasswordDto): void {
    this.passwordReset.requestReset(body.email);
  }

  /**
   * 204 after setting the new password. Every session of the user ends,
   * including the caller's, so the web app sends them to the login page.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.passwordReset.resetPassword(body.token, body.password);
    this.sessionCookie.clear(response);
  }
}
