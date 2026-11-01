import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { CLOCK, systemClock } from '../common/clock/clock';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { MailModule } from '../mail/mail.module';
import { ClinicsModule } from '../modules/clinics/clinics.module';
import { PortalModule } from '../modules/portal/portal.module';
import { AuthAccountsRepository } from './accounts/auth-accounts.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCleanupJob } from './cleanup/auth-cleanup.job';
import { CredentialsRepository } from './credentials/credentials.repository';
import { EmailVerificationService } from './email-verification/email-verification.service';
import { GoogleAuthController } from './google/google-auth.controller';
import { GoogleAuthService } from './google/google-auth.service';
import { GoogleFlowCookie } from './google/google-flow-cookie';
import { GoogleOidcClient } from './google/google-oidc.client';
import { LocalStrategy } from './local.strategy';
import { OnboardingService } from './onboarding/onboarding.service';
import { PasswordHasher } from './passwords/password-hasher';
import { PasswordResetService } from './passwords/password-reset.service';
import { AuthThrottlerGuard } from './rate-limit/auth-throttler.guard';
import { createThrottlerOptions } from './rate-limit/rate-limit';
import { SessionCookie } from './sessions/session-cookie';
import { SessionsRepository } from './sessions/sessions.repository';
import { SessionsService } from './sessions/sessions.service';
import { SignUpService } from './sign-up/sign-up.service';
import { AuthTokensRepository } from './tokens/auth-tokens.repository';

@Module({
  imports: [
    ClinicsModule,
    MailModule,
    PassportModule,
    PortalModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createThrottlerOptions(config),
    }),
  ],
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthAccountsRepository,
    AuthCleanupJob,
    AuthService,
    AuthThrottlerGuard,
    AuthTokensRepository,
    CredentialsRepository,
    EmailVerificationService,
    GoogleAuthService,
    GoogleFlowCookie,
    GoogleOidcClient,
    LocalStrategy,
    OnboardingService,
    PasswordHasher,
    PasswordResetService,
    SessionsRepository,
    SessionsService,
    SessionCookie,
    SignUpService,
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [SessionsService, SessionCookie],
})
export class AuthModule {}
