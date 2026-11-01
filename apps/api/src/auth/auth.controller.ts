import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { AuthMe, AuthUser } from '@nutri/schemas';
import type { Request, Response } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  AuthMeDto,
  AuthUserDto,
  ForgotPasswordDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SignUpDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { EmailVerificationService } from './email-verification/email-verification.service';
import { LocalAuthGuard } from './local-auth.guard';
import { PasswordResetService } from './passwords/password-reset.service';
import { AuthThrottlerGuard } from './rate-limit/auth-throttler.guard';
import {
  FORGOT_PASSWORD_RATE_LIMITS,
  RateLimit,
  RESEND_VERIFICATION_RATE_LIMITS,
  RESET_PASSWORD_RATE_LIMITS,
  SIGN_IN_RATE_LIMITS,
  SIGN_UP_RATE_LIMITS,
  VERIFY_EMAIL_RATE_LIMITS,
} from './rate-limit/rate-limit';
import { SessionCookie } from './sessions/session-cookie';
import { SignUpService } from './sign-up/sign-up.service';

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
    private readonly signUpService: SignUpService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  /**
   * Always 202 with no body, whether or not the email has an account; the
   * email goes out in the background. No session: the user is signed in when
   * they verify the email.
   */
  @Public()
  @Post('sign-up')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit(SIGN_UP_RATE_LIMITS)
  @UseGuards(AuthThrottlerGuard)
  signUp(@Body() body: SignUpDto): void {
    this.signUpService.requestSignUp(body);
  }

  /** Body: `signInSchema`, validated by `LocalAuthGuard`. */
  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @RateLimit(SIGN_IN_RATE_LIMITS)
  @UseGuards(AuthThrottlerGuard, LocalAuthGuard)
  @ZodSerializerDto(AuthUserDto)
  async signIn(
    @Req() request: SignedInRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    await this.startSession(request.user.id, request, response);
    return request.user;
  }

  /**
   * Verifies the email and signs the user in. A POST, not a GET: link
   * previews in WhatsApp and email clients fetch GET URLs and would consume
   * the token. The web page reads the token from the link and posts it.
   */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @RateLimit(VERIFY_EMAIL_RATE_LIMITS)
  @UseGuards(AuthThrottlerGuard)
  @ZodSerializerDto(AuthUserDto)
  async verifyEmail(
    @Body() body: VerifyEmailDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const user = await this.emailVerification.verify(body.token);
    await this.startSession(user.id, request, response);
    return user;
  }

  /**
   * Always 202 with no body, whether or not the email has an unverified
   * account; the link is emailed in the background.
   */
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit(RESEND_VERIFICATION_RATE_LIMITS)
  @UseGuards(AuthThrottlerGuard)
  resendVerification(@Body() body: ResendVerificationDto): void {
    this.emailVerification.requestResend(body.email);
  }

  /**
   * Who is signed in, so the web app can route them to the clinic area, the
   * portal or onboarding. Needs a session but no clinic.
   */
  @Get('me')
  @ZodSerializerDto(AuthMeDto)
  me(@CurrentUser() user: AuthUser): Promise<AuthMe> {
    return this.authService.getMe(user);
  }

  /** Always 204, also without a valid session: the outcome is the same. */
  @Public()
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
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimit(FORGOT_PASSWORD_RATE_LIMITS)
  @UseGuards(AuthThrottlerGuard)
  forgotPassword(@Body() body: ForgotPasswordDto): void {
    this.passwordReset.requestReset(body.email);
  }

  /**
   * 204 after setting the new password. Every session of the user ends,
   * including the caller's, so the web app sends them to the login page.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit(RESET_PASSWORD_RATE_LIMITS)
  @UseGuards(AuthThrottlerGuard)
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.passwordReset.resetPassword(body.token, body.password);
    this.sessionCookie.clear(response);
  }

  private async startSession(
    userId: string,
    request: Request,
    response: Response,
  ): Promise<void> {
    const { token, expiresAt } = await this.authService.startSession(
      userId,
      this.sessionCookie.read(request),
      request.get('user-agent'),
    );
    this.sessionCookie.set(response, token, expiresAt);
  }
}
