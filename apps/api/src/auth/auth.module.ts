import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { CLOCK, systemClock } from '../common/clock/clock';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CredentialsRepository } from './credentials/credentials.repository';
import { LocalStrategy } from './local.strategy';
import { PasswordHasher } from './passwords/password-hasher';
import { PasswordResetService } from './passwords/password-reset.service';
import { SessionCookie } from './sessions/session-cookie';
import { SessionsRepository } from './sessions/sessions.repository';
import { SessionsService } from './sessions/sessions.service';
import { AuthTokensRepository } from './tokens/auth-tokens.repository';

// TODO(auth): The session guard and clinic resolution from the user's
// membership land in the remaining tickets of the Authentication epic (#8).
// Until then the TEMPORARY DevelopmentClinicGuard (common/guards) stays in
// place; it is replaced by a guard that resolves the clinic for
// @ClinicAccess() routes, and portal access via patient_access is added.
@Module({
  imports: [MailModule, PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokensRepository,
    CredentialsRepository,
    LocalStrategy,
    PasswordHasher,
    PasswordResetService,
    SessionsRepository,
    SessionsService,
    SessionCookie,
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [SessionsService, SessionCookie],
})
export class AuthModule {}
